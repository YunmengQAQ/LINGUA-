'use strict';

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { URL } = require('node:url');

const LANG_IDS = new Set(['zh', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'ru']);
const MYMEMORY_CODES = { zh: 'zh-CN', en: 'en', ja: 'ja', ko: 'ko', fr: 'fr', de: 'de', es: 'es', ru: 'ru' };
const LANG_NAMES = { zh: '中文', en: '英语', ja: '日语', ko: '韩语', fr: '法语', de: '德语', es: '西班牙语', ru: '俄语' };
const USER_AGENT = 'LINGUA/1.0 (desktop translation tool)';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8'
};

function splitText(text, limit = 460) {
  if (text.length <= limit) return [text];
  const chunks = [];
  let current = '';
  for (let line of text.split(/(?<=\n)/)) {
    while (line.length > limit) {
      const room = limit - current.length;
      if (room <= 0) {
        chunks.push(current);
        current = '';
      }
      const take = limit - current.length;
      chunks.push(current + line.slice(0, take));
      line = line.slice(take);
      current = '';
    }
    if (current.length + line.length > limit) {
      chunks.push(current);
      current = line;
    } else {
      current += line;
    }
  }
  if (current) chunks.push(current);
  return chunks.filter(Boolean);
}

async function fetchWithTimeout(url, options = {}, timeout = 90000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const onAbort = () => controller.abort();
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener('abort', onAbort, { once: true });
  }
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener?.('abort', onAbort);
  }
}

async function mymemoryTranslate(text, source, target, email) {
  if (source === target) return text;
  const src = MYMEMORY_CODES[source] || source;
  const dst = MYMEMORY_CODES[target] || target;
  const parts = [];
  for (const chunk of splitText(text)) {
    const params = new URLSearchParams({ q: chunk, langpair: `${src}|${dst}` });
    if (email) params.set('de', email);
    let response;
    try {
      response = await fetchWithTimeout(
        `https://api.mymemory.translated.net/get?${params.toString()}`,
        { headers: { 'User-Agent': USER_AGENT } },
        45000
      );
    } catch (error) {
      throw new Error(`无法连接 MyMemory：${error.message || error}`);
    }
    const raw = await response.text();
    let payload;
    try { payload = JSON.parse(raw); } catch { throw new Error('MyMemory 返回了无法解析的数据。'); }
    if (!response.ok) throw new Error(`MyMemory 请求失败（HTTP ${response.status}）。`);
    if (payload.responseStatus !== 200) {
      throw new Error(`MyMemory 返回错误：${payload.responseDetails || '未知错误'}`);
    }
    const translated = payload.responseData?.translatedText;
    if (!translated) throw new Error('MyMemory 没有返回译文。');
    parts.push(String(translated));
  }
  return parts.length === 1 ? parts[0] : parts.join('\n');
}

function buildMessages(text, source, target) {
  const sourceName = LANG_NAMES[source] || source;
  const targetName = LANG_NAMES[target] || target;
  return [
    {
      role: 'system',
      content:
        'You are a professional translation engine. ' +
        `Translate the user's text from ${sourceName} to ${targetName}. ` +
        'Return only the translation, without explanations, notes, labels or quotation marks. ' +
        'Preserve line breaks and the original formatting as closely as possible.'
    },
    { role: 'user', content: text }
  ];
}

async function handleOpenAI(payload, res, signal) {
  const cfg = payload.openai || {};
  const endpoint = String(cfg.endpoint || '').trim();
  const model = String(cfg.model || '').trim();
  const apiKey = String(cfg.apiKey || '').trim();
  const stream = !!cfg.stream;
  const text = String(payload.text || '');
  const source = String(payload.source || 'en');
  const target = String(payload.target || 'zh');
  const messages = Array.isArray(payload.messages) && payload.messages.length > 0
    ? payload.messages
    : buildMessages(text, source, target);

  if (!/^https?:\/\//i.test(endpoint)) throw Object.assign(new Error('接口地址必须以 http:// 或 https:// 开头。'), { status: 400 });
  if (!model) throw Object.assign(new Error('请填写模型名称。'), { status: 400 });

  const headers = {
    'Content-Type': 'application/json',
    Accept: stream ? 'text/event-stream' : 'application/json',
    'User-Agent': USER_AGENT
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  let upstream;
  try {
    upstream = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
        stream
      }),
      signal
    }, 120000);
  } catch (error) {
    throw Object.assign(new Error(`无法连接翻译接口：${error.message || error}`), { status: 502 });
  }

  if (!upstream.ok) {
    const raw = await upstream.text().catch(() => '');
    let message = raw;
    try {
      const parsed = JSON.parse(raw);
      message = parsed.error?.message || parsed.message || raw;
    } catch { /* use raw */ }
    throw Object.assign(new Error(`翻译接口返回 HTTP ${upstream.status}：${String(message).slice(0, 300)}`), { status: 502 });
  }

  if (stream && upstream.body) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'close',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*'
    });
    const reader = upstream.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (res.destroyed) {
          try { await reader.cancel(); } catch { /* ignored */ }
          break;
        }
        res.write(Buffer.from(value));
      }
    } catch (error) {
      if (!res.destroyed) res.end();
      return;
    }
    res.end();
    return;
  }

  const raw = await upstream.text();
  let parsed;
  try { parsed = JSON.parse(raw); } catch { throw new Error('翻译接口返回了无法解析的数据。'); }
  const content = parsed.choices?.[0]?.message?.content;
  if (!content) throw new Error('翻译接口返回了空结果。');
  sendJson(res, 200, { ok: true, text: content, provider: 'openai' });
}

function sendJson(res, status, data) {
  if (res.headersSent) return;
  const body = Buffer.from(JSON.stringify(data), 'utf8');
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readBody(req, limit = 2_000_000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('请求内容过大。'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function safeStaticPath(root, pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return null; }
  const relative = decoded.replace(/^\/+/, '') || 'index.html';
  const full = path.resolve(root, relative);
  const rootResolved = path.resolve(root);
  if (full !== rootResolved && !full.startsWith(rootResolved + path.sep)) return null;
  return full;
}

async function startServer(options = {}) {
  const packagedRoot = path.join(__dirname, 'web');
  const defaultRoot = fs.existsSync(path.join(packagedRoot, 'index.html'))
    ? packagedRoot
    : path.resolve(__dirname, '..');
  const root = path.resolve(options.root || defaultRoot);
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400'
      });
      res.end();
      return;
    }

    if (url.pathname === '/api/health' && req.method === 'GET') {
      sendJson(res, 200, { ok: true, name: 'LINGUA', desktop: true });
      return;
    }

    if (url.pathname === '/api/translate' && req.method === 'POST') {
      let body;
      try { body = await readBody(req); } catch (error) {
        sendJson(res, 400, { ok: false, error: error.message }); return;
      }
      let data;
      try { data = JSON.parse(body); } catch {
        sendJson(res, 400, { ok: false, error: '请求不是有效的 JSON。' }); return;
      }
      const controller = new AbortController();
      res.on('close', () => { if (!res.writableEnded) controller.abort(); });
      try {
        const text = String(data.text || '');
        const source = String(data.source || 'en');
        const target = String(data.target || 'zh');
        if (!text.trim()) throw Object.assign(new Error('没有需要翻译的文字。'), { status: 400 });
        if (text.length > 12000) throw Object.assign(new Error('单次翻译最多支持 12000 个字符。'), { status: 413 });
        if (!LANG_IDS.has(source) || !LANG_IDS.has(target)) throw Object.assign(new Error('不支持的语言代码。'), { status: 400 });
        const provider = String(data.provider || 'mymemory');
        if (provider === 'openai') {
          await handleOpenAI(data, res, controller.signal);
        } else if (provider === 'mymemory') {
          const translated = await mymemoryTranslate(text, source, target, String(data.mymemoryEmail || ''));
          sendJson(res, 200, { ok: true, text: translated, provider: 'mymemory' });
        } else {
          throw Object.assign(new Error('未知的翻译服务。'), { status: 400 });
        }
      } catch (error) {
        if (res.headersSent) {
          if (!res.writableEnded) res.end();
        } else {
          sendJson(res, error.status || 500, { ok: false, error: error.message || '本地代理发生错误。' });
        }
      }
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      sendJson(res, 405, { ok: false, error: 'Method not allowed' });
      return;
    }

    const file = safeStaticPath(root, url.pathname);
    if (!file) {
      sendJson(res, 403, { ok: false, error: 'Forbidden' });
      return;
    }
    try {
      const stat = await fsp.stat(file);
      if (!stat.isFile()) throw new Error('not a file');
      const ext = path.extname(file).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Content-Length': stat.size,
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff'
      });
      if (req.method === 'HEAD') { res.end(); return; }
      fs.createReadStream(file).pipe(res);
    } catch {
      sendJson(res, 404, { ok: false, error: 'Not found' });
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port || 0, '127.0.0.1', resolve);
  });
  const address = server.address();
  return { server, port: address.port, url: `http://127.0.0.1:${address.port}/`, root };
}

module.exports = { startServer };

if (require.main === module) {
  startServer({ port: Number(process.env.PORT) || 0 }).then(({ url, root }) => {
    console.log(`LINGUA desktop server: ${url}`);
    console.log(`Root: ${root}`);
  }).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

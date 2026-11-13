(() => {
  'use strict';

  /* =========================================================
     Constants
     ========================================================= */

  const LANGS = [
    { id: 'zh', code: 'ZH', name: '中文', native: 'Chinese', mymemory: 'zh-CN', speech: 'zh-CN', tess: ['chi_sim', 'eng'] },
    { id: 'en', code: 'EN', name: '英语', native: 'English', mymemory: 'en', speech: 'en-US', tess: ['eng'] },
    { id: 'ja', code: 'JA', name: '日语', native: '日本語', mymemory: 'ja', speech: 'ja-JP', tess: ['jpn', 'eng'] },
    { id: 'ko', code: 'KO', name: '韩语', native: '한국어', mymemory: 'ko', speech: 'ko-KR', tess: ['kor', 'eng'] },
    { id: 'fr', code: 'FR', name: '法语', native: 'Français', mymemory: 'fr', speech: 'fr-FR', tess: ['fra', 'eng'] },
    { id: 'de', code: 'DE', name: '德语', native: 'Deutsch', mymemory: 'de', speech: 'de-DE', tess: ['deu', 'eng'] },
    { id: 'es', code: 'ES', name: '西班牙语', native: 'Español', mymemory: 'es', speech: 'es-ES', tess: ['spa', 'eng'] },
    { id: 'ru', code: 'RU', name: '俄语', native: 'Русский', mymemory: 'ru', speech: 'ru-RU', tess: ['rus', 'eng'] }
  ];
  const AUTO_LANG = {
    id: 'auto',
    code: 'AUTO',
    name: '自动检测',
    native: 'Auto',
    mymemory: null,
    speech: 'en-US',
    auto: true,
    tess: ['chi_sim', 'eng', 'jpn', 'kor', 'fra', 'deu', 'spa', 'rus']
  };
  const SOURCE_LANGS = [AUTO_LANG, ...LANGS];
  const LANG_BY_ID = new Map([AUTO_LANG, ...LANGS].map((lang) => [lang.id, lang]));

  const PRESETS = {
    deepseek: {
      endpoint: 'https://api.deepseek.com/v1/chat/completions',
      model: 'deepseek-chat'
    },
    openai: {
      endpoint: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-4o-mini'
    },
    openrouter: {
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      model: 'openai/gpt-4o-mini'
    },
    local: {
      endpoint: 'http://127.0.0.1:11434/v1/chat/completions',
      model: 'qwen2.5:7b'
    }
  };

  const SETTINGS_KEY = 'lingua.settings.v1';
  const OPENAI_KEY = 'lingua.openai.key';
  const SESSION_KEY = 'lingua.openai.session-key';

  const OCR_SCRIPT_URL = 'https://unpkg.com/tesseract.js@5.1.1/dist/tesseract.min.js';
  const OCR_SCRIPT_FALLBACK = 'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.1/tesseract.min.js';
  const OCR_WORKER_URL = 'https://unpkg.com/tesseract.js@5.1.1/dist/worker.min.js';
  const OCR_CORE_URL = 'https://unpkg.com/tesseract.js-core@5.1.1';
  const OCR_LANG_CDN = 'https://tessdata.projectnaptha.com/4.0.0';

  const API_BASE = window.location.protocol === 'file:' ? 'http://127.0.0.1:8787' : '';
  const DESKTOP = !!window.linguaDesktop?.isDesktop;
  const MAX_CHARS = 5000;

  function ocrLangPath() {
    // The desktop build ships the eight language packs next to the web assets,
    // so auto-detect OCR does not have to download ~82 MB on first use.
    if (DESKTOP && /^https?:$/.test(window.location.protocol)) {
      return `${window.location.origin}/tessdata`;
    }
    return OCR_LANG_CDN;
  }

  const DEFAULT_HOTKEY = 'Control+Shift+F2';
  const DEFAULT_AUTO_HOTKEY = 'Control+Alt+A';
  const DEFAULT_SETTINGS = {
    version: 2,
    source: 'auto',
    target: 'zh',
    live: true,
    hotkey: DEFAULT_HOTKEY,
    autoHotkey: DEFAULT_AUTO_HOTKEY,
    snipOpacity: 80,
    autoOpacity: 80,
    disclaimerHidden: false,
    provider: 'mymemory',
    mymemoryEmail: '',
    openai: {
      endpoint: PRESETS.deepseek.endpoint,
      model: PRESETS.deepseek.model,
      apiKey: '',
      remember: true,
      stream: true
    }
  };

  const $ = (id) => document.getElementById(id);
  const dom = {};
  [
    'modeTextBtn',
    'modeScreenBtn',
    'modeAutoBtn',
    'modeHotkeyKbd',
    'autoHotkeyKbd',
    'autoWorkspace',
    'autoStartBtn',
    'autoStopBtn',
    'autoStatus',
    'metaHotkeyKeys',
    'welcomeHotkeyKeys',
    'screenHotkeyKeys',
    'hotkeySection',
    'settingsHotkeyDisplay',
    'hotkeyRecordBtn',
    'hotkeyRecordHint',
    'settingsAutoHotkeyDisplay',
    'autoHotkeyRecordBtn',
    'autoHotkeyRecordHint',
    'opacitySection',
    'snipOpacity',
    'autoOpacity',
    'snipOpacityValue',
    'autoOpacityValue',
    'apiStatusBtn',
    'apiDot',
    'apiPillText',
    'settingsBtn',
    'introEyebrow',
    'introTitle',
    'introDescription',
    'sourceLabel',
    'sourceLang',
    'sourceCode',
    'targetLang',
    'targetCode',
    'swapBtn',
    'liveToggle',
    'languageDirection',
    'textWorkspace',
    'screenWorkspace',
    'inputText',
    'charCount',
    'composerStatus',
    'pasteBtn',
    'clearBtn',
    'translateBtn',
    'translateKeyHint',
    'autoState',
    'outputBody',
    'outputPlaceholder',
    'outputText',
    'outputState',
    'copyBtn',
    'speakBtn',
    'sourceLanguageMeta',
    'targetLanguageMeta',
    'quickSamples',
    'captureStartBtn',
    'welcomeStartBtn',
    'captureFreezeBtn',
    'uploadBtn',
    'welcomeUploadBtn',
    'captureStopBtn',
    'captureStatus',
    'captureStage',
    'captureWelcome',
    'captureFrame',
    'captureVideo',
    'captureImage',
    'captureOverlay',
    'selectionBox',
    'selectionTip',
    'captureProcessing',
    'processingTitle',
    'processingDetail',
    'processingBar',
    'screenEmpty',
    'screenResults',
    'ocrText',
    'ocrCharCount',
    'retranslateBtn',
    'screenTranslation',
    'screenTranslationLang',
    'screenOutputState',
    'screenCopyBtn',
    'screenSpeakBtn',
    'screenLanguageMeta',
    'imageUpload',
    'disclaimerOverlay',
    'disclaimerAccept',
    'disclaimerDontShow',
    'settingsOverlay',
    'providerChoice',
    'mymemoryPane',
    'openaiPane',
    'mymemoryEmail',
    'apiEndpoint',
    'apiModel',
    'apiKey',
    'toggleKeyBtn',
    'rememberKey',
    'streamToggle',
    'testApiBtn',
    'testResult',
    'saveSettingsBtn',
    'toastRegion',
    'liveRegion'
  ].forEach((id) => {
    dom[id] = $(id);
  });

  const cleanInput = (value) => String(value || '').replace(/\r\n/g, '\n');
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function readLocal(key) {
    try { return localStorage.getItem(key); } catch (error) { return null; }
  }
  function writeLocal(key, value) {
    try { localStorage.setItem(key, value); } catch (error) { /* ignored */ }
  }
  function readSession(key) {
    try { return sessionStorage.getItem(key); } catch (error) { return null; }
  }
  function writeSession(key, value) {
    try { sessionStorage.setItem(key, value); } catch (error) { /* ignored */ }
  }
  function removeLocal(key) {
    try { localStorage.removeItem(key); } catch (error) { /* ignored */ }
  }
  function removeSession(key) {
    try { sessionStorage.removeItem(key); } catch (error) { /* ignored */ }
  }

  function loadSettings() {
    let stored = {};
    try {
      stored = JSON.parse(readLocal(SETTINGS_KEY) || '{}') || {};
    } catch (error) {
      stored = {};
    }
    const openai = stored.openai && typeof stored.openai === 'object' ? stored.openai : {};
    const legacySettings = stored.version !== 2;
    const settings = {
      version: 2,
      source: legacySettings || !LANG_BY_ID.has(stored.source) ? DEFAULT_SETTINGS.source : stored.source,
      target: LANGS.some((lang) => lang.id === stored.target) ? stored.target : DEFAULT_SETTINGS.target,
      live: stored.live !== false,
      hotkey: typeof stored.hotkey === 'string' && stored.hotkey.trim()
        ? stored.hotkey.trim()
        : DEFAULT_SETTINGS.hotkey,
      autoHotkey: typeof stored.autoHotkey === 'string' && stored.autoHotkey.trim()
        ? stored.autoHotkey.trim()
        : DEFAULT_SETTINGS.autoHotkey,
      snipOpacity: clampOpacity(stored.snipOpacity),
      autoOpacity: clampOpacity(stored.autoOpacity),
      disclaimerHidden: stored.disclaimerHidden === true,
      provider: stored.provider === 'openai' ? 'openai' : 'mymemory',
      mymemoryEmail: typeof stored.mymemoryEmail === 'string' ? stored.mymemoryEmail : '',
      openai: {
        endpoint: typeof openai.endpoint === 'string' && openai.endpoint
          ? openai.endpoint
          : DEFAULT_SETTINGS.openai.endpoint,
        model: typeof openai.model === 'string' && openai.model
          ? openai.model
          : DEFAULT_SETTINGS.openai.model,
        apiKey: '',
        remember: openai.remember !== false,
        stream: openai.stream !== false
      }
    };
    const remembered = openai.remember !== false;
    const key = remembered
      ? (readLocal(OPENAI_KEY) || readSession(SESSION_KEY) || '')
      : (readSession(SESSION_KEY) || '');
    settings.openai.apiKey = key;
    return settings;
  }

  const settings = loadSettings();

  const state = {
    mode: 'text',
    settings,
    serverOnline: false,
    healthChecked: false,
    liveTimer: 0,
    textAbort: null,
    textSerial: 0,
    lastOutput: '',
    lastDetectedSource: null,
    cache: new Map(),
    settingsDraftProvider: settings.provider,
    updateTimer: 0,
    hotkeyRecording: false,
    hotkeyRecordingKind: '',
    hotkeyBeforeRecording: '',
    auto: {
      active: false,
      token: null,
      timer: 0,
      lastText: '',
      lastTranslatedAt: 0,
      processing: false,
      controller: null
    },
    screen: {
      stream: null,
      kind: null,
      frozen: false,
      busy: false,
      dragging: false,
      dragStart: null,
      selection: null,
      objectUrl: '',
      ocrText: '',
      lastTranslation: '',
      translationAbort: null,
      translationSerial: 0,
      desktopToken: null,
      resultPushAt: 0,
      worker: null,
      workerKey: '',
      workerPromise: null,
      processing: false
    }
  };

  /* =========================================================
     Utilities and UI primitives
     ========================================================= */

  function getLang(id) {
    return LANG_BY_ID.get(id) || LANG_BY_ID.get('en');
  }

  function langLabel(lang) {
    return `${lang.name} · ${lang.native}`;
  }

  function clampOpacity(value, fallback = 80) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(100, Math.max(20, Math.round(number)));
  }

  function updateOpacityLabels() {
    if (dom.snipOpacityValue) dom.snipOpacityValue.textContent = `${dom.snipOpacity.value}%`;
    if (dom.autoOpacityValue) dom.autoOpacityValue.textContent = `${dom.autoOpacity.value}%`;
  }

  function hotkeyTokens(accelerator = state.settings.hotkey) {
    const labels = { Control: 'Ctrl', Command: 'Cmd', Super: 'Win', Option: 'Alt' };
    return String(accelerator || DEFAULT_HOTKEY)
      .split('+')
      .map((part) => labels[part] || part)
      .filter(Boolean);
  }

  function hotkeyDisplay(accelerator = state.settings.hotkey) {
    return hotkeyTokens(accelerator).join(' + ');
  }

  function hotkeyKbdHtml(accelerator = state.settings.hotkey) {
    return hotkeyTokens(accelerator).map((token) => `<kbd>${token}</kbd>`).join('');
  }

  function updateHotkeyUI() {
    const tokens = hotkeyTokens();
    const display = tokens.join(' + ');
    const autoTokens = hotkeyTokens(state.settings.autoHotkey);
    const autoDisplay = autoTokens.join(' + ');
    if (dom.modeHotkeyKbd) dom.modeHotkeyKbd.textContent = tokens.join(' ');
    if (dom.autoHotkeyKbd) dom.autoHotkeyKbd.textContent = autoTokens.join(' ');
    if (dom.metaHotkeyKeys) dom.metaHotkeyKeys.innerHTML = hotkeyKbdHtml();
    if (dom.welcomeHotkeyKeys) dom.welcomeHotkeyKeys.innerHTML = hotkeyKbdHtml();
    if (dom.screenHotkeyKeys) dom.screenHotkeyKeys.innerHTML = hotkeyKbdHtml();
    if (dom.settingsHotkeyDisplay) dom.settingsHotkeyDisplay.textContent = display;
    if (dom.settingsAutoHotkeyDisplay) dom.settingsAutoHotkeyDisplay.textContent = autoDisplay;
    if (dom.modeScreenBtn) dom.modeScreenBtn.title = `${display} 快速划屏`;
    if (dom.modeAutoBtn) dom.modeAutoBtn.title = `${autoDisplay} 自动翻译`;
    if (dom.inputText) {
      dom.inputText.placeholder = `输入或粘贴要翻译的内容…\n\n也可以按 ${display}，直接在屏幕上框选文字。`;
    }
    if (dom.hotkeySection) dom.hotkeySection.hidden = !DESKTOP;
    const welcomeCopy = document.querySelector('.capture-welcome p');
    if (welcomeCopy) {
      welcomeCopy.textContent = DESKTOP
        ? `按 ${display}，或点击“框选屏幕”，在任意软件上拖出一个区域；松开鼠标后自动识别并翻译。`
        : `按 ${display}，或共享一个窗口/屏幕，然后拖出一个翻译区域；文字会自动识别并翻译。`;
    }
    if (state.mode === 'screen') {
      dom.introDescription.textContent = DESKTOP
        ? `按 ${display} 在任意软件上框选区域，松开鼠标后自动识别并翻译。`
        : `按 ${display}，或共享屏幕后拖动框选文字。先识别，再翻译。`;
    }
  }

  function directionLabel() {
    return `${getLang(dom.sourceLang.value).name} → ${getLang(dom.targetLang.value).name}`;
  }

  const LATIN_HINTS = {
    en: new Set(['the', 'and', 'is', 'are', 'of', 'to', 'you', 'it', 'that', 'for', 'with', 'this', 'have', 'not', 'hello', 'good', 'morning', 'thanks', 'please', 'what', 'where', 'from']),
    fr: new Set(['le', 'la', 'les', 'des', 'est', 'et', 'une', 'un', 'que', 'pour', 'dans', 'avec', 'bonjour', 'merci', 'ce', 'pas', 'je', 'vous', 'nous', 'sur', 'au', 'aux']),
    de: new Set(['der', 'die', 'das', 'und', 'ist', 'ein', 'eine', 'mit', 'für', 'auf', 'nicht', 'ich', 'sie', 'guten', 'danke', 'haben', 'den', 'dem', 'zu']),
    es: new Set(['el', 'la', 'los', 'las', 'es', 'y', 'una', 'un', 'que', 'para', 'en', 'con', 'hola', 'gracias', 'por', 'como', 'del', 'se', 'su', 'sus'])
  };

  function detectLanguage(text) {
    const sample = String(text || '').slice(0, 3000);
    if (!sample.trim()) return getLang('en');
    const hangul = (sample.match(/[\uac00-\ud7af]/g) || []).length;
    const kana = (sample.match(/[\u3040-\u30ff]/g) || []).length;
    const han = (sample.match(/[\u4e00-\u9fff]/g) || []).length;
    const latin = (sample.match(/[A-Za-z]/g) || []).length;
    const cyrillic = (sample.match(/[\u0400-\u04ff]/g) || []).length;
    if (hangul > 0) return getLang('ko');

    const cjk = han + kana;
    // Mixed screenshots often contain a lot of Latin UI text. Pick the dominant
    // script instead of letting one stray kana turn Chinese into Japanese.
    if (cjk > 0 && latin <= cjk * 2) {
      if (kana > 0 && han === 0) return getLang('ja');
      if (kana >= 2 && kana / Math.max(1, cjk) >= 0.12) return getLang('ja');
      if (han > 0) return getLang('zh');
    }
    if (cyrillic > 0 && cyrillic >= latin * 0.5) return getLang('ru');

    const lower = sample.toLowerCase();
    const words = lower.match(/[a-zà-ÿœ]+/g) || [];
    const scores = { en: 0, fr: 0, de: 0, es: 0 };
    for (const word of words) {
      for (const [lang, hints] of Object.entries(LATIN_HINTS)) {
        if (hints.has(word)) scores[lang] += 2;
      }
    }
    if (/[äöüß]/.test(lower)) scores.de += 4;
    if (/[çâêîôûœ]/.test(lower)) scores.fr += 4;
    if (/[ñ¿¡]/.test(lower)) scores.es += 4;
    if (/[éèêëàâîïôûù]/.test(lower)) scores.fr += 1;
    if (/[áíóú]/.test(lower)) scores.es += 1;
    if (/(?:th|ing|tion|ness|ment)\b/.test(lower)) scores.en += 1;
    if (/(?:ção|ões|não)\b/.test(lower)) scores.es += 1;

    let best = 'en';
    let bestScore = 0;
    for (const lang of ['en', 'fr', 'de', 'es']) {
      if (scores[lang] > bestScore) {
        best = lang;
        bestScore = scores[lang];
      }
    }
    return getLang(best);
  }

  function setApiStatus() {
    const provider = state.settings.provider;
    const online = state.serverOnline;
    dom.apiStatusBtn.classList.toggle('is-custom', provider === 'openai');
    dom.apiStatusBtn.classList.toggle('is-error', provider === 'openai' && !online);
    if (provider === 'openai') {
      dom.apiPillText.textContent = state.settings.openai.model || 'OpenAI API';
      dom.apiStatusBtn.title = online
        ? 'OpenAI 兼容 API · 本地代理已连接'
        : 'OpenAI 兼容 API · 本地代理未连接';
    } else {
      dom.apiPillText.textContent = online ? 'MyMemory' : 'MyMemory · 直连';
      dom.apiStatusBtn.title = online
        ? 'MyMemory 免费翻译 API · 本地代理已连接'
        : 'MyMemory · 浏览器直连';
    }
  }

  function setOutputState(kind, text) {
    dom.outputState.classList.toggle('is-active', kind === 'active');
    dom.outputState.classList.toggle('is-error', kind === 'error');
    dom.outputState.querySelector('span').textContent = text;
  }

  function setScreenState(kind, text) {
    dom.screenOutputState.classList.toggle('is-active', kind === 'active');
    dom.screenOutputState.classList.toggle('is-error', kind === 'error');
    dom.screenOutputState.querySelector('span').textContent = text;
  }

  function setOutput(text, options = {}) {
    const value = cleanInput(text);
    dom.outputText.textContent = value;
    dom.outputBody.dataset.empty = value ? 'false' : 'true';
    dom.outputBody.classList.toggle('is-loading', !!options.loading);
    dom.copyBtn.disabled = !value;
    dom.speakBtn.disabled = !value;
    if (value) dom.outputBody.scrollTop = 0;
  }

  function setScreenTranslation(text, options = {}) {
    const value = cleanInput(text);
    dom.screenTranslation.textContent = value;
    dom.screenTranslation.dataset.empty = value ? 'false' : 'true';
    dom.screenTranslation.classList.toggle('is-loading', !!options.loading);
    dom.screenCopyBtn.disabled = !value;
    dom.screenSpeakBtn.disabled = !value;
  }

  function setTextBusy(busy) {
    dom.translateBtn.disabled = busy;
    dom.translateBtn.classList.toggle('is-busy', busy);
  }

  function setLiveUI() {
    const live = state.settings.live;
    dom.liveToggle.classList.toggle('is-on', live);
    dom.liveToggle.setAttribute('aria-pressed', live ? 'true' : 'false');
    dom.autoState.classList.toggle('is-on', live);
    dom.autoState.querySelector('span').textContent = live ? '实时已开' : '实时已关';
  }

  function setLanguageUI() {
    const source = getLang(state.settings.source);
    const target = getLang(state.settings.target);
    dom.sourceLang.value = source.id;
    dom.targetLang.value = target.id;
    dom.sourceCode.textContent = source.code;
    dom.targetCode.textContent = target.code;
    dom.sourceLanguageMeta.textContent = source.auto ? '自动检测 · Auto' : langLabel(source);
    dom.targetLanguageMeta.textContent = langLabel(target);
    dom.screenLanguageMeta.textContent = `${source.name} → ${target.name}`;
    dom.screenTranslationLang.textContent = target.name;
    dom.languageDirection.textContent = directionLabel();
    dom.sourceLabel.textContent = state.mode === 'screen' ? '识别语言' : '源语言';
  }

  function populateLanguageSelects() {
    const options = (items) => items.map((lang) => `<option value="${lang.id}">${lang.name} · ${lang.native}</option>`).join('');
    dom.sourceLang.innerHTML = options(SOURCE_LANGS);
    dom.targetLang.innerHTML = options(LANGS);
    dom.sourceLang.value = state.settings.source;
    dom.targetLang.value = state.settings.target;
  }

  function toast(message, options = {}) {
    if (!dom.toastRegion) return;
    const node = document.createElement('div');
    node.className = 'toast';
    node.dataset.type = options.type || 'default';
    node.innerHTML = '<i></i><span></span>';
    node.querySelector('span').textContent = message;
    dom.toastRegion.appendChild(node);
    const duration = Number.isFinite(options.duration) ? options.duration : 2900;
    window.setTimeout(() => {
      node.classList.add('is-leaving');
      window.setTimeout(() => node.remove(), 220);
    }, duration);
    while (dom.toastRegion.children.length > 4) {
      dom.toastRegion.firstElementChild.remove();
    }
  }

  function announce(message) {
    dom.liveRegion.textContent = '';
    window.setTimeout(() => { dom.liveRegion.textContent = message; }, 25);
  }

  function persistSettings() {
    const payload = {
      version: 2,
      source: state.settings.source,
      target: state.settings.target,
      live: state.settings.live,
      hotkey: state.settings.hotkey,
      autoHotkey: state.settings.autoHotkey,
      snipOpacity: state.settings.snipOpacity,
      autoOpacity: state.settings.autoOpacity,
      disclaimerHidden: state.settings.disclaimerHidden === true,
      provider: state.settings.provider,
      mymemoryEmail: state.settings.mymemoryEmail,
      openai: {
        endpoint: state.settings.openai.endpoint,
        model: state.settings.openai.model,
        remember: state.settings.openai.remember,
        stream: state.settings.openai.stream
      }
    };
    writeLocal(SETTINGS_KEY, JSON.stringify(payload));
    if (state.settings.openai.remember) {
      writeLocal(OPENAI_KEY, state.settings.openai.apiKey || '');
      removeSession(SESSION_KEY);
    } else {
      writeSession(SESSION_KEY, state.settings.openai.apiKey || '');
      removeLocal(OPENAI_KEY);
    }
    if (DESKTOP) {
      const desktopPayload = {
        ...payload,
        openai: {
          ...payload.openai,
          apiKey: state.settings.openai.remember ? state.settings.openai.apiKey || '' : ''
        }
      };
      window.linguaDesktop.saveSettings(desktopPayload).catch(() => {});
    }
  }

  function setMode(mode, options = {}) {
    const targetMode = mode === 'screen' || mode === 'auto' ? mode : 'text';
    const previousMode = state.mode;
    const modeChanged = !options.silent && previousMode !== targetMode;
    if (state.mode === 'screen' && targetMode !== 'screen') {
      stopScreenCapture({ keepResult: true, silent: true });
    }
    if (state.mode === 'auto' && targetMode !== 'auto' && state.auto.active) {
      void stopAutoTranslation({ silent: true });
    }
    state.mode = targetMode;
    dom.modeTextBtn.classList.toggle('is-active', targetMode === 'text');
    dom.modeScreenBtn.classList.toggle('is-active', targetMode === 'screen');
    dom.modeAutoBtn.classList.toggle('is-active', targetMode === 'auto');
    dom.modeTextBtn.setAttribute('aria-selected', targetMode === 'text' ? 'true' : 'false');
    dom.modeScreenBtn.setAttribute('aria-selected', targetMode === 'screen' ? 'true' : 'false');
    dom.modeAutoBtn.setAttribute('aria-selected', targetMode === 'auto' ? 'true' : 'false');
    dom.textWorkspace.hidden = targetMode !== 'text';
    dom.screenWorkspace.hidden = targetMode !== 'screen';
    dom.autoWorkspace.hidden = targetMode !== 'auto';
    dom.sourceLabel.textContent = targetMode === 'text' ? '源语言' : '识别语言';
    document.title = targetMode === 'screen'
      ? '划屏翻译 · LINGUA'
      : targetMode === 'auto' ? '自动翻译 · LINGUA' : 'LINGUA · 实时翻译';

    if (targetMode === 'screen') {
      dom.introEyebrow.textContent = 'SCREEN OCR TRANSLATION / 8 LANGUAGES';
      dom.introTitle.innerHTML = '划屏翻译<span>.</span>';
      dom.introDescription.textContent = DESKTOP
        ? `按 ${hotkeyDisplay()} 在任意软件上框选区域，松开鼠标后自动识别并翻译。`
        : `按 ${hotkeyDisplay()}，或共享屏幕后拖动框选文字。先识别，再翻译。`;
      updateCaptureControls();
      if (!options.silent && !navigator.mediaDevices?.getDisplayMedia) {
        toast('当前浏览器不支持屏幕共享，可以改用“上传截图”。', { type: 'danger', duration: 4200 });
      }
    } else if (targetMode === 'auto') {
      dom.introEyebrow.textContent = 'AUTO LIVE TRANSLATION / 8 LANGUAGES';
      dom.introTitle.innerHTML = '自动翻译<span>.</span>';
      dom.introDescription.textContent = DESKTOP
        ? `按 ${hotkeyTokens(state.settings.autoHotkey).join(' + ')} 可从任意页面直接框选；小译文框持续更新，文字变化即翻译，画面不变时每 30 秒刷新。`
        : '自动翻译需要桌面版支持。';
      updateAutoUI();
      if (!DESKTOP && !options.silent) {
        toast('自动翻译仅桌面版支持。', { type: 'gold' });
      }
    } else {
      dom.introEyebrow.textContent = 'LIVE TEXT TRANSLATION / 8 LANGUAGES';
      dom.introTitle.innerHTML = '实时文本翻译<span>.</span>';
      dom.introDescription.textContent = '输入即译。在八种语言之间自由切换，让每一句话都更快抵达。';
      window.setTimeout(() => dom.inputText.focus(), 50);
    }

    if (modeChanged) {
      const order = { text: 0, screen: 1, auto: 2 };
      const direction = order[targetMode] >= order[previousMode] ? 1 : -1;
      document.documentElement.style.setProperty('--mode-shift', `${direction * 20}px`);
      const activeWorkspace = targetMode === 'screen'
        ? dom.screenWorkspace
        : targetMode === 'auto' ? dom.autoWorkspace : dom.textWorkspace;
      for (const workspace of [dom.textWorkspace, dom.screenWorkspace, dom.autoWorkspace]) {
        workspace?.classList.remove('mode-enter');
      }
      if (activeWorkspace) {
        void activeWorkspace.offsetWidth;
        activeWorkspace.classList.add('mode-enter');
      }
      const introCopy = document.querySelector('.intro-copy');
      if (introCopy) {
        introCopy.classList.remove('intro-enter');
        void introCopy.offsetWidth;
        introCopy.classList.add('intro-enter');
      }
      const switcher = document.querySelector('.mode-switch');
      if (switcher) {
        switcher.classList.remove('is-switching');
        void switcher.offsetWidth;
        switcher.classList.add('is-switching');
      }
      window.setTimeout(() => {
        activeWorkspace?.classList.remove('mode-enter');
        introCopy?.classList.remove('intro-enter');
        switcher?.classList.remove('is-switching');
      }, 620);
    }
    // Keep the auto status in sync if the app is reopened while monitoring.
    updateAutoUI();
  }

  /* =========================================================
     Server health
     ========================================================= */

  async function checkServerHealth(options = {}) {
    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 4500);
      const response = await fetch(`${API_BASE}/api/health`, {
        cache: 'no-store',
        signal: controller.signal
      });
      window.clearTimeout(timer);
      const data = await response.json();
      state.serverOnline = response.ok && data.ok === true;
    } catch (error) {
      state.serverOnline = false;
    }
    state.healthChecked = true;
    setApiStatus();
    if (!state.serverOnline && !options.silent && !sessionStorage.getItem('lingua.offline-toast')) {
      writeSession('lingua.offline-toast', '1');
      toast('未检测到本地代理：文本将尝试直连 API；划屏功能建议通过启动器打开。', {
        type: 'gold',
        duration: 5000
      });
    }
    return state.serverOnline;
  }

  /* =========================================================
     Translation API
     ========================================================= */

  function buildOpenAIPayload(text, source, target) {
    const sourceName = getLang(source).name;
    const targetName = getLang(target).name;
    const messages = [
      {
        role: 'system',
        content: `You are a professional translator. Translate the user's text from ${sourceName} to ${targetName}.
Return only the translation, without explanations, notes, labels, or an outer pair of quotation marks. Preserve line breaks and formatting as closely as possible.

Translation rules:
- Translate the meaning naturally and idiomatically. Do not translate word-for-word or add information that is not present in the source.
- Do not invent or alter titles, names, or proper nouns. Never treat an ordinary phrase as a work title.
- Use Chinese book-title marks (《》) only when the source explicitly marks a work title or the entity is unambiguously a known title. Otherwise leave ordinary phrases as ordinary prose.
- Keep character names, game titles, and brand names as written in the source unless a well-established translated name is clearly required.
- Interpret Japanese idioms, slang, omissions, and quoted colloquial phrases by context. For example, ケチの付け所 means "a point to criticize / a flaw to find", not a title.
- Do not add a title, heading, or quotation marks around the whole output.`
      }
    ];
    // Few-shot examples are much more effective than instructions alone for
    // short Japanese idioms that models tend to mistake for titles.
    if (source === 'ja' && target === 'zh') {
      messages.push(
        { role: 'user', content: 'ケチの付け所を探すのが大変な名作' },
        { role: 'assistant', content: '这是一部让人很难挑出毛病的名作。' },
        { role: 'user', content: '次回作のハードルめっちゃ上がったけど大丈夫そうですか（大声）' },
        { role: 'assistant', content: '续作的门槛一下子被抬得这么高，真的没问题吗（大声）' },
        { role: 'user', content: '何やかや言われてるオンラインも僕はそんなにクソとは思わなかったです' },
        { role: 'assistant', content: '在线部分虽然被大家各种吐槽，我倒不觉得有那么烂。' },
        { role: 'user', content: 'おじさんの思い出補正みたいなものはあったんだなあ' },
        { role: 'assistant', content: '看来确实有点大叔我的回忆滤镜/情怀加成啊。' }
      );
    }
    messages.push({ role: 'user', content: text });
    return {
      model: state.settings.openai.model,
      messages,
      temperature: 0.2
    };
  }

  async function directMyMemory(text, source, target) {
    const sourceLang = getLang(source);
    const targetLang = getLang(target);
    if (source === target) return text;
    const params = new URLSearchParams({
      q: text,
      langpair: `${sourceLang.mymemory}|${targetLang.mymemory}`
    });
    if (state.settings.mymemoryEmail) params.set('de', state.settings.mymemoryEmail);
    const response = await fetch(`https://api.mymemory.translated.net/get?${params.toString()}`);
    if (!response.ok) throw new Error(`MyMemory 请求失败（${response.status}）`);
    const data = await response.json();
    if (data.responseStatus !== 200) {
      throw new Error(data.responseDetails || 'MyMemory 返回了错误。');
    }
    return data.responseData?.translatedText || '';
  }

  function parseSSEChunk(buffer, onDelta) {
    let full = '';
    let done = false;
    const lines = buffer.split('\n');
    const remainder = lines.pop() || '';
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      if (payload === '[DONE]') {
        done = true;
        continue;
      }
      try {
        const data = JSON.parse(payload);
        const delta = data.choices?.[0]?.delta?.content
          ?? data.choices?.[0]?.text
          ?? data.choices?.[0]?.message?.content
          ?? '';
        if (typeof delta === 'string' && delta) {
          full += delta;
          onDelta?.(full);
        }
        if (data.error) throw new Error(data.error.message || '流式接口返回错误。');
      } catch (error) {
        if (error instanceof SyntaxError) continue;
        throw error;
      }
    }
    return { full, remainder, done };
  }

  async function consumeApiResponse(response, { stream, onDelta } = {}) {
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok) {
      let detail = '';
      try {
        const data = await response.json();
        detail = data.error || data.message || JSON.stringify(data);
      } catch (error) {
        detail = await response.text().catch(() => '');
      }
      throw new Error(detail || `翻译接口返回 HTTP ${response.status}`);
    }

    if (stream && contentType.includes('text/event-stream') && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let full = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parsed = parseSSEChunk(buffer, onDelta);
        full += parsed.full;
        buffer = parsed.remainder;
        if (parsed.done) {
          try { await reader.cancel(); } catch (error) { /* ignored */ }
          break;
        }
      }
      if (buffer.trim()) {
        const parsed = parseSSEChunk(`${buffer}\n`, onDelta);
        full += parsed.full;
      }
      return full.trim();
    }

    const data = await response.json();
    if (data && data.ok === false) throw new Error(data.error || '翻译服务返回错误。');
    return String(data.text || data.translatedText || data.choices?.[0]?.message?.content || '').trim();
  }

  async function requestTranslation({ text, source, target, stream, onDelta, signal, config }) {
    const providerConfig = config || state.settings;
    if (source === target) return text;
    const provider = providerConfig.provider;

    if (provider === 'mymemory') {
      if (state.serverOnline) {
        const response = await fetch(`${API_BASE}/api/translate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: 'mymemory',
            text,
            source,
            target,
            mymemoryEmail: providerConfig.mymemoryEmail || ''
          }),
          signal
        });
        return consumeApiResponse(response, { stream: false });
      }
      return directMyMemory(text, source, target);
    }

    if (provider === 'openai') {
      const openai = providerConfig.openai;
      if (!openai.endpoint || !openai.model) {
        throw new Error('请先在设置中填写 OpenAI 兼容接口地址与模型名称。');
      }
      if (state.serverOnline) {
        const proxyPayload = buildOpenAIPayload(text, source, target);
        const response = await fetch(`${API_BASE}/api/translate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: 'openai',
            text,
            source,
            target,
            messages: proxyPayload.messages,
            openai: {
              endpoint: openai.endpoint,
              model: openai.model,
              apiKey: openai.apiKey,
              stream: !!openai.stream
            }
          }),
          signal
        });
        return consumeApiResponse(response, { stream: !!openai.stream, onDelta });
      }

      const body = buildOpenAIPayload(text, source, target);
      body.stream = !!openai.stream;
      const headers = { 'Content-Type': 'application/json' };
      if (openai.apiKey) headers.Authorization = `Bearer ${openai.apiKey}`;
      const response = await fetch(openai.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal
      });
      return consumeApiResponse(response, { stream: !!openai.stream, onDelta });
    }

    throw new Error('未知的翻译服务。');
  }

  function cacheKey(text, source, target) {
    const provider = state.settings.provider;
    const extra = provider === 'openai'
      ? `${state.settings.openai.endpoint}|${state.settings.openai.model}`
      : 'mymemory';
    return `${provider}|${extra}|${source}|${target}|${text}`;
  }

  /* =========================================================
     Text translation
     ========================================================= */

  function updateCharCount() {
    const length = dom.inputText.value.length;
    dom.charCount.textContent = `${length} / ${MAX_CHARS}`;
    dom.charCount.style.color = length >= MAX_CHARS ? 'var(--gold)' : '';
  }

  function clearTextOutput() {
    state.textAbort?.abort();
    state.textAbort = null;
    state.textSerial += 1;
    state.lastOutput = '';
    setOutput('', { loading: false });
    setOutputState('idle', '等待输入');
    setTextBusy(false);
    dom.composerStatus.textContent = '';
  }

  function scheduleLiveTranslation() {
    window.clearTimeout(state.liveTimer);
    if (!state.settings.live) return;
    if (!dom.inputText.value.trim()) {
      clearTextOutput();
      return;
    }
    dom.composerStatus.textContent = '实时翻译将在停顿后自动执行…';
    state.liveTimer = window.setTimeout(() => {
      translateTextNow({ manual: false });
    }, 650);
  }

  async function translateTextNow({ manual = false } = {}) {
    window.clearTimeout(state.liveTimer);
    const text = cleanInput(dom.inputText.value);
    if (!text.trim()) {
      clearTextOutput();
      return;
    }
    if (text.length > MAX_CHARS) {
      toast(`单次最多翻译 ${MAX_CHARS} 个字符。`, { type: 'danger' });
      return;
    }

    state.textAbort?.abort();
    state.textAbort = new AbortController();
    const controller = state.textAbort;
    const serial = ++state.textSerial;
    const selectedSource = dom.sourceLang.value;
    let source = selectedSource;
    let detectedLang = null;
    if (selectedSource === 'auto') {
      detectedLang = detectLanguage(text);
      source = detectedLang.id;
      state.lastDetectedSource = source;
    }
    const sourceLang = getLang(source);
    const target = dom.targetLang.value;
    const key = cacheKey(text, source, target);

    setTextBusy(true);
    dom.composerStatus.textContent = detectedLang ? `自动检测：${detectedLang.name}` : '';
    setOutputState('active', detectedLang ? `检测到${sourceLang.name} · 正在翻译…` : '正在翻译…');
    setOutput('', { loading: true });

    if (source === target) {
      state.lastOutput = text;
      setOutput(text);
      setOutputState('idle', `检测到${sourceLang.name} · 无需翻译`);
      dom.composerStatus.textContent = `自动检测：${sourceLang.name}（与输出语言相同）`;
      setTextBusy(false);
      return;
    }

    const cached = state.cache.get(key);
    if (cached) {
      if (serial === state.textSerial) {
        state.lastOutput = cached;
        setOutput(cached);
        setOutputState('idle', detectedLang ? `翻译完成 · ${sourceLang.name} · 记忆命中` : '翻译完成 · 记忆命中');
        setTextBusy(false);
        announce('已从本地缓存载入译文。');
      }
      return;
    }

    try {
      const result = await requestTranslation({
        text,
        source,
        target,
        stream: state.settings.provider === 'openai' && state.settings.openai.stream,
        signal: controller.signal,
        onDelta: (partial) => {
          if (serial !== state.textSerial) return;
          state.lastOutput = partial;
          setOutput(partial, { loading: true });
          setOutputState('active', '正在接收译文…');
        }
      });

      if (serial !== state.textSerial) return;
      const finalText = String(result || '').trim();
      if (!finalText) throw new Error('翻译服务没有返回译文。');
      state.lastOutput = finalText;
      setOutput(finalText);
      setOutputState('idle', detectedLang ? `翻译完成 · ${sourceLang.name}` : '翻译完成');
      state.cache.set(key, finalText);
      if (state.cache.size > 80) {
        const first = state.cache.keys().next().value;
        state.cache.delete(first);
      }
      dom.composerStatus.textContent = detectedLang ? `自动检测：${sourceLang.name}` : '';
      announce('翻译完成。');
    } catch (error) {
      if (error.name === 'AbortError' || serial !== state.textSerial) return;
      const message = error.message || '翻译失败，请稍后重试。';
      setOutput('', { loading: false });
      setOutputState('error', message);
      dom.composerStatus.textContent = message;
      toast(message, { type: 'danger', duration: 4200 });
      announce(`翻译失败：${message}`);
    } finally {
      if (serial === state.textSerial) {
        setTextBusy(false);
        dom.translateBtn.classList.remove('is-busy');
      }
    }
  }

  function swapLanguages() {
    const source = state.settings.source;
    const target = state.settings.target;
    const previousOutput = state.lastOutput;
    let actualSource = source;
    if (source === 'auto') {
      actualSource = state.lastDetectedSource
        || detectLanguage(dom.inputText.value || state.screen.ocrText || '').id;
    }
    state.settings.source = target;
    state.settings.target = actualSource;
    dom.sourceLang.value = target;
    dom.targetLang.value = actualSource;
    setLanguageUI();
    persistSettings();

    if (state.mode === 'text') {
      if (previousOutput) {
        dom.inputText.value = previousOutput;
        updateCharCount();
        clearTextOutput();
        if (state.settings.live) scheduleLiveTranslation();
        else dom.composerStatus.textContent = '已交换文本与语言，点击翻译。';
      } else if (dom.inputText.value.trim()) {
        clearTextOutput();
        if (state.settings.live) scheduleLiveTranslation();
      }
    } else if (state.screen.ocrText.trim()) {
      translateScreenText({ manual: true });
    }
  }

  async function handleLanguageChange() {
    state.settings.source = dom.sourceLang.value;
    state.settings.target = dom.targetLang.value;
    setLanguageUI();
    persistSettings();
    updateScreenResultMeta();

    if (state.mode === 'text') {
      if (dom.inputText.value.trim()) {
        clearTextOutput();
        if (state.settings.live) scheduleLiveTranslation();
        else dom.composerStatus.textContent = '语言已切换，点击翻译。';
      }
    } else if (state.screen.ocrText.trim() && state.settings.live) {
      translateScreenText({ manual: false });
    }
  }

  /* =========================================================
     Error and convenience
     ========================================================= */

  function getTargetSpeechLang() {
    return getLang(dom.targetLang.value).speech;
  }

  async function copyText(text) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    toast('已复制到剪贴板。', { duration: 1700 });
  }

  function speakText(text) {
    if (!text) return;
    if (!('speechSynthesis' in window)) {
      toast('当前浏览器不支持语音朗读。', { type: 'danger' });
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = getTargetSpeechLang();
    utterance.rate = 0.95;
    const voices = window.speechSynthesis.getVoices();
    const matched = voices.find((voice) => voice.lang === utterance.lang)
      || voices.find((voice) => voice.lang.startsWith(utterance.lang.split('-')[0]));
    if (matched) utterance.voice = matched;
    window.speechSynthesis.speak(utterance);
    toast('正在朗读译文…', { duration: 1500 });
  }

  /* =========================================================
     Settings modal
     ========================================================= */

  function updateProviderChoices(provider) {
    state.settingsDraftProvider = provider;
    dom.providerChoice.querySelectorAll('.provider-card').forEach((card) => {
      card.classList.toggle('is-active', card.dataset.provider === provider);
    });
    dom.mymemoryPane.hidden = provider !== 'mymemory';
    dom.openaiPane.hidden = provider !== 'openai';
    dom.testResult.textContent = '';
    dom.testResult.className = 'test-result';
  }

  function fillSettingsForm() {
    dom.mymemoryEmail.value = state.settings.mymemoryEmail || '';
    dom.apiEndpoint.value = state.settings.openai.endpoint || '';
    dom.apiModel.value = state.settings.openai.model || '';
    dom.apiKey.value = state.settings.openai.apiKey || '';
    dom.rememberKey.checked = state.settings.openai.remember !== false;
    dom.streamToggle.checked = state.settings.openai.stream !== false;
    dom.apiKey.type = 'password';
    dom.toggleKeyBtn.textContent = '显示';
    dom.snipOpacity.value = String(clampOpacity(state.settings.snipOpacity));
    dom.autoOpacity.value = String(clampOpacity(state.settings.autoOpacity));
    updateOpacityLabels();
    updateProviderChoices(state.settings.provider);
    updateHotkeyUI();
    if (!state.hotkeyRecording) resetHotkeyRecordUI();
  }

  function openSettings() {
    fillSettingsForm();
    dom.settingsOverlay.classList.add('is-open');
    dom.settingsOverlay.setAttribute('aria-hidden', 'false');
    window.requestAnimationFrame(() => {
      const preferred = dom.settingsOverlay.querySelector('.provider-card.is-active')
        || dom.settingsOverlay.querySelector('.modal-close');
      preferred?.focus({ preventScroll: true });
    });
  }

  function closeSettings() {
    if (state.hotkeyRecording) void cancelHotkeyRecording({ silent: true });
    dom.settingsOverlay.classList.remove('is-open');
    dom.settingsOverlay.setAttribute('aria-hidden', 'true');
    dom.settingsBtn.blur();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.setTimeout(() => {
      if (dom.settingsOverlay.contains(document.activeElement) || document.activeElement === dom.settingsBtn) {
        document.activeElement?.blur?.();
      }
    }, 60);
  }

  let disclaimerShown = false;

  async function showDisclaimerIfNeeded() {
    if (disclaimerShown || !dom.disclaimerOverlay) return;
    let hidden = state.settings.disclaimerHidden === true;
    if (DESKTOP && typeof window.linguaDesktop.getDisclaimerHidden === 'function') {
      try {
        hidden = (await window.linguaDesktop.getDisclaimerHidden()) === true;
      } catch (error) { /* fall back to the local setting */ }
    }
    if (hidden) return;
    disclaimerShown = true;
    dom.disclaimerDontShow.checked = false;
    dom.disclaimerOverlay.classList.add('is-open');
    dom.disclaimerOverlay.setAttribute('aria-hidden', 'false');
    window.requestAnimationFrame(() => {
      dom.disclaimerAccept?.focus({ preventScroll: true });
    });
  }

  function closeDisclaimer() {
    dom.disclaimerOverlay.classList.remove('is-open');
    dom.disclaimerOverlay.setAttribute('aria-hidden', 'true');
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.setTimeout(() => {
      if (state.mode === 'text' && !dom.settingsOverlay.classList.contains('is-open')) {
        dom.inputText?.focus({ preventScroll: true });
      }
    }, 120);
  }

  function acceptDisclaimer() {
    const hide = !!dom.disclaimerDontShow?.checked;
    state.settings.disclaimerHidden = hide;
    persistSettings();
    if (DESKTOP && typeof window.linguaDesktop.setDisclaimerHidden === 'function') {
      window.linguaDesktop.setDisclaimerHidden(hide).catch(() => {});
    }
    closeDisclaimer();
  }

  function readSettingsForm() {
    const provider = state.settingsDraftProvider;
    const openai = {
      endpoint: dom.apiEndpoint.value.trim(),
      model: dom.apiModel.value.trim(),
      apiKey: dom.apiKey.value.trim(),
      remember: dom.rememberKey.checked,
      stream: dom.streamToggle.checked
    };
    return {
      provider,
      mymemoryEmail: dom.mymemoryEmail.value.trim(),
      snipOpacity: clampOpacity(dom.snipOpacity.value),
      autoOpacity: clampOpacity(dom.autoOpacity.value),
      openai
    };
  }

  function hotkeyControl(kind) {
    if (kind === 'auto') {
      return {
        kind,
        label: '自动翻译',
        button: dom.autoHotkeyRecordBtn,
        display: dom.settingsAutoHotkeyDisplay,
        hint: dom.autoHotkeyRecordHint,
        defaultValue: DEFAULT_AUTO_HOTKEY,
        defaultHint: '建议使用 Ctrl / Alt 加字母或功能键',
        set: (accelerator) => window.linguaDesktop.setAutoHotkey(accelerator)
      };
    }
    return {
      kind: 'snip',
      label: '划屏',
      button: dom.hotkeyRecordBtn,
      display: dom.settingsHotkeyDisplay,
      hint: dom.hotkeyRecordHint,
      defaultValue: DEFAULT_HOTKEY,
      defaultHint: '建议使用 Ctrl / Alt / Shift 加字母或功能键',
      set: (accelerator) => window.linguaDesktop.setHotkey(accelerator)
    };
  }

  function resetHotkeyRecordUI(hint = '', kind = '') {
    for (const item of [hotkeyControl('snip'), hotkeyControl('auto')]) {
      if (!item.button) continue;
      item.button.disabled = false;
      item.button.classList.remove('is-recording');
      item.button.textContent = '修改快捷键';
      item.hint.textContent = item.defaultHint;
      item.hint.classList.remove('is-error');
    }
    const target = kind ? hotkeyControl(kind) : null;
    if (target && hint) {
      target.hint.textContent = hint;
      target.hint.classList.add('is-error');
    }
    dom.saveSettingsBtn.disabled = false;
    updateHotkeyUI();
  }

  function keyEventToAccelerator(event) {
    if (!(event.ctrlKey || event.altKey || event.metaKey)) return '';
    const parts = [];
    if (event.ctrlKey) parts.push('Control');
    if (event.altKey) parts.push('Alt');
    if (event.shiftKey) parts.push('Shift');
    if (event.metaKey) parts.push('Super');
    const code = event.code || '';
    let key = '';
    if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) key = code;
    else if (/^Key[A-Z]$/.test(code)) key = code.slice(3);
    else if (/^Digit[0-9]$/.test(code)) key = code.slice(5);
    else if (code === 'Space') key = 'Space';
    else if (code === 'ArrowUp') key = 'Up';
    else if (code === 'ArrowDown') key = 'Down';
    else if (code === 'ArrowLeft') key = 'Left';
    else if (code === 'ArrowRight') key = 'Right';
    else if (['Home', 'End', 'PageUp', 'PageDown', 'Insert', 'Delete'].includes(code)) key = code;
    if (!key) return '';
    parts.push(key);
    const accelerator = parts.join('+');
    if (accelerator === 'Control+Alt+Delete' || accelerator === 'Alt+F4') return '';
    return accelerator;
  }

  async function cancelHotkeyRecording(options = {}) {
    if (!state.hotkeyRecording) return;
    state.hotkeyRecording = false;
    state.hotkeyRecordingKind = '';
    window.removeEventListener('keydown', captureHotkeyKeydown, true);
    resetHotkeyRecordUI();
    if (DESKTOP) {
      try { await window.linguaDesktop.resumeHotkey(); } catch (error) { /* ignored */ }
    }
    if (!options.silent) toast('已取消修改快捷键。', { duration: 1600 });
  }

  async function beginHotkeyRecording(kind = 'snip') {
    if (!DESKTOP) {
      toast('全局快捷键仅桌面版支持。', { type: 'gold' });
      return;
    }
    if (state.hotkeyRecording) return;
    const control = hotkeyControl(kind);
    state.hotkeyRecording = true;
    state.hotkeyRecordingKind = kind;
    state.hotkeyBeforeRecording = control.kind === 'auto'
      ? state.settings.autoHotkey
      : state.settings.hotkey;
    for (const item of [hotkeyControl('snip'), hotkeyControl('auto')]) {
      item.button.disabled = true;
      item.hint.classList.remove('is-error');
      item.hint.textContent = item.defaultHint;
    }
    control.button.classList.add('is-recording');
    control.button.textContent = '请按下组合键…';
    control.hint.textContent = '正在录制；按 Esc 取消';
    control.display.textContent = '等待按键…';
    dom.saveSettingsBtn.disabled = true;
    try { await window.linguaDesktop.suspendHotkey(); } catch (error) { /* ignored */ }
    window.addEventListener('keydown', captureHotkeyKeydown, true);
  }

  async function submitRecordedHotkey(accelerator) {
    const kind = state.hotkeyRecordingKind || 'snip';
    const control = hotkeyControl(kind);
    window.removeEventListener('keydown', captureHotkeyKeydown, true);
    control.button.disabled = true;
    control.button.textContent = '正在应用…';
    try {
      const result = await control.set(accelerator);
      if (!result?.ok) {
        throw new Error(result?.error || '这个快捷键不可用。');
      }
      state.settings.hotkey = result.hotkey || state.settings.hotkey;
      state.settings.autoHotkey = result.autoHotkey || state.settings.autoHotkey;
      state.hotkeyRecording = false;
      state.hotkeyRecordingKind = '';
      persistSettings();
      const value = kind === 'auto' ? state.settings.autoHotkey : state.settings.hotkey;
      resetHotkeyRecordUI();
      control.hint.textContent = `已生效：${hotkeyDisplay(value)}`;
      toast(`${control.label}快捷键已更新为 ${hotkeyDisplay(value)}`, { duration: 2400 });
    } catch (error) {
      state.hotkeyRecording = false;
      state.hotkeyRecordingKind = '';
      resetHotkeyRecordUI(`设置失败：${error.message || error}`, kind);
      try { await window.linguaDesktop.resumeHotkey(); } catch (resumeError) { /* ignored */ }
      toast(error.message || '快捷键注册失败。', { type: 'danger', duration: 3600 });
    }
  }

  function captureHotkeyKeydown(event) {
    if (!state.hotkeyRecording) return;
    const control = hotkeyControl(state.hotkeyRecordingKind || 'snip');
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Escape') {
      void cancelHotkeyRecording();
      return;
    }
    if (event.repeat) return;
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) {
      control.hint.textContent = '继续按一个字母、数字或 F1–F12 键…';
      return;
    }
    const accelerator = keyEventToAccelerator(event);
    if (!accelerator) {
      control.hint.textContent = '请使用 Ctrl / Alt / Win 加字母、数字或功能键。';
      control.hint.classList.add('is-error');
      return;
    }
    void submitRecordedHotkey(accelerator);
  }

  async function syncDesktopHotkey() {
    if (!DESKTOP) return;
    try {
      const status = await window.linguaDesktop.status();
      let nextScreen = status?.hotkey || state.settings.hotkey;
      let nextAuto = status?.autoHotkey || state.settings.autoHotkey;
      if (state.settings.hotkey && state.settings.hotkey !== nextScreen) {
        const result = await window.linguaDesktop.setHotkey(state.settings.hotkey);
        if (result?.ok) {
          nextScreen = result.hotkey;
          if (result.autoHotkey) nextAuto = result.autoHotkey;
        } else {
          toast(result?.error || '无法恢复上次的划屏快捷键，已切换到可用组合。', { type: 'gold', duration: 3200 });
        }
      }
      if (state.settings.autoHotkey && state.settings.autoHotkey !== nextAuto) {
        const result = await window.linguaDesktop.setAutoHotkey(state.settings.autoHotkey);
        if (result?.ok) {
          nextScreen = result.hotkey || nextScreen;
          nextAuto = result.autoHotkey || nextAuto;
        } else {
          toast(result?.error || '无法恢复上次的自动翻译快捷键，已切换到可用组合。', { type: 'gold', duration: 3200 });
        }
      }
      state.settings.hotkey = nextScreen;
      state.settings.autoHotkey = nextAuto;
      persistSettings();
      updateHotkeyUI();
    } catch (error) {
      // Keep the current UI as a fallback.
    }
  }

  async function syncDesktopSettings() {
    if (!DESKTOP) return;
    let stored = null;
    try {
      stored = await window.linguaDesktop.getSettings();
    } catch (error) {
      stored = null;
    }
    if (!stored) {
      // Seed the main-process settings file from the browser settings.
      persistSettings();
      await syncDesktopHotkey();
      return;
    }

    if (stored.source === 'auto' || LANG_BY_ID.has(stored.source)) {
      state.settings.source = stored.source;
    }
    if (LANGS.some((lang) => lang.id === stored.target)) {
      state.settings.target = stored.target;
    }
    state.settings.live = stored.live !== false;
    if (typeof stored.hotkey === 'string' && stored.hotkey.trim()) {
      state.settings.hotkey = stored.hotkey.trim();
    }
    if (typeof stored.autoHotkey === 'string' && stored.autoHotkey.trim()) {
      state.settings.autoHotkey = stored.autoHotkey.trim();
    }
    if (stored.snipOpacity !== undefined) state.settings.snipOpacity = clampOpacity(stored.snipOpacity);
    if (stored.autoOpacity !== undefined) state.settings.autoOpacity = clampOpacity(stored.autoOpacity);
    state.settings.disclaimerHidden = stored.disclaimerHidden === true;
    state.settings.provider = stored.provider === 'openai' ? 'openai' : 'mymemory';
    state.settings.mymemoryEmail = typeof stored.mymemoryEmail === 'string'
      ? stored.mymemoryEmail
      : '';
    const openai = stored.openai && typeof stored.openai === 'object' ? stored.openai : {};
    state.settings.openai = {
      endpoint: typeof openai.endpoint === 'string' ? openai.endpoint : state.settings.openai.endpoint,
      model: typeof openai.model === 'string' ? openai.model : state.settings.openai.model,
      apiKey: openai.remember !== false && typeof openai.apiKey === 'string'
        ? openai.apiKey
        : '',
      remember: openai.remember !== false,
      stream: openai.stream !== false
    };
    if (!state.settings.openai.apiKey && state.settings.openai.remember) {
      const localKey = readLocal(OPENAI_KEY) || readSession(SESSION_KEY) || '';
      if (localKey) state.settings.openai.apiKey = localKey;
    }

    dom.sourceLang.value = state.settings.source;
    dom.targetLang.value = state.settings.target;
    setLanguageUI();
    setLiveUI();
    setApiStatus();
    updateHotkeyUI();
    updateCharCount();
    persistSettings();
    await syncDesktopHotkey();
  }

  async function testApiConnection() {
    const draft = readSettingsForm();
    if (draft.provider === 'openai' && (!draft.openai.endpoint || !draft.openai.model)) {
      dom.testResult.textContent = '请先填写接口地址和模型名称。';
      dom.testResult.className = 'test-result is-error';
      return;
    }
    dom.testApiBtn.disabled = true;
    dom.testResult.textContent = '正在连接…';
    dom.testResult.className = 'test-result';
    try {
      const testConfig = {
        provider: draft.provider,
        mymemoryEmail: draft.mymemoryEmail,
        openai: { ...draft.openai, stream: false }
      };
      const text = await requestTranslation({
        text: 'Hello',
        source: 'en',
        target: 'zh',
        stream: false,
        config: testConfig
      });
      dom.testResult.textContent = `连接成功：${text || '你好'}`;
      dom.testResult.className = 'test-result is-success';
    } catch (error) {
      dom.testResult.textContent = `连接失败：${error.message || '未知错误'}`;
      dom.testResult.className = 'test-result is-error';
    } finally {
      dom.testApiBtn.disabled = false;
    }
  }

  function saveModalSettings() {
    if (state.hotkeyRecording) {
      toast('请先完成快捷键录制，或按 Esc 取消。', { type: 'gold' });
      return;
    }
    const draft = readSettingsForm();
    if (draft.provider === 'openai' && (!draft.openai.endpoint || !draft.openai.model)) {
      toast('请填写 OpenAI 兼容接口地址和模型名称。', { type: 'danger' });
      return;
    }
    state.settings.provider = draft.provider;
    state.settings.mymemoryEmail = draft.mymemoryEmail;
    state.settings.snipOpacity = draft.snipOpacity;
    state.settings.autoOpacity = draft.autoOpacity;
    state.settings.openai = { ...draft.openai };
    persistSettings();
    state.cache.clear();
    setApiStatus();
    closeSettings();
    toast(draft.provider === 'mymemory' ? '翻译引擎：MyMemory' : `翻译引擎：${draft.openai.model}`, {
      duration: 2200
    });
    if (draft.provider === 'openai' && draft.openai.apiKey) {
      window.setTimeout(() => {
        if (draft.openai.remember) {
          toast('API Key 已保存在本机，重启软件后仍会保留。', { duration: 3200 });
        } else {
          toast('未勾选“记住 API Key”，退出软件后需要重新输入。', {
            type: 'gold',
            duration: 4400
          });
        }
      }, 600);
    }
    if (dom.inputText.value.trim() && state.settings.live) translateTextNow();
  }

  /* =========================================================
     Screen capture
     ========================================================= */

  function updateCaptureControls() {
    const hasMedia = !!state.screen.kind;
    const isVideo = state.screen.kind === 'video';
    dom.captureStartBtn.hidden = hasMedia && !DESKTOP;
    if (DESKTOP) {
      dom.captureStartBtn.innerHTML = `<svg><use href="#i-screen"></use></svg><span>${hasMedia ? '重新框选' : '框选屏幕'}</span>`;
    }
    dom.captureFreezeBtn.disabled = !isVideo;
    dom.captureStopBtn.disabled = !hasMedia;
    if (isVideo) {
      const label = state.screen.frozen ? '继续' : '冻结';
      const icon = state.screen.frozen ? '#i-play' : '#i-pause';
      dom.captureFreezeBtn.innerHTML = `<svg><use href="${icon}"></use></svg><span>${label}</span>`;
    } else {
      dom.captureFreezeBtn.innerHTML = '<svg><use href="#i-pause"></use></svg><span>冻结</span>';
    }
    dom.captureStatus.classList.toggle('is-live', hasMedia && !state.screen.processing);
    dom.captureStatus.classList.toggle('is-processing', state.screen.processing);
    dom.captureStatus.innerHTML = state.screen.processing
      ? '<i></i>识别中'
      : isVideo
        ? `<i></i>${state.screen.frozen ? '画面已冻结' : '共享中'}`
        : hasMedia
          ? '<i></i>截图已载入'
          : '<i></i>未开始';
  }

  function resetSelection() {
    state.screen.dragging = false;
    state.screen.dragStart = null;
    state.screen.selection = null;
    dom.selectionBox.hidden = true;
    dom.selectionBox.style.cssText = '';
    dom.selectionTip.hidden = false;
  }

  function fitCaptureFrame() {
    if (!state.screen.kind || dom.captureFrame.hidden) return;
    const video = dom.captureVideo;
    const image = dom.captureImage;
    const width = state.screen.kind === 'video' ? video.videoWidth : image.naturalWidth;
    const height = state.screen.kind === 'video' ? video.videoHeight : image.naturalHeight;
    if (!width || !height) return;
    const stageWidth = Math.max(100, dom.captureStage.clientWidth - 22);
    const stageHeight = Math.max(100, dom.captureStage.clientHeight - 22);
    const scale = Math.min(stageWidth / width, stageHeight / height);
    dom.captureFrame.style.width = `${Math.max(80, Math.round(width * scale))}px`;
    dom.captureFrame.style.height = `${Math.max(60, Math.round(height * scale))}px`;
  }

  function showCaptureFrame(kind) {
    state.screen.kind = kind;
    dom.captureWelcome.hidden = true;
    dom.captureFrame.hidden = false;
    dom.captureVideo.hidden = kind !== 'video';
    dom.captureImage.hidden = kind !== 'image';
    dom.captureOverlay.hidden = false;
    resetSelection();
    updateCaptureControls();
    window.requestAnimationFrame(() => {
      fitCaptureFrame();
    });
  }

  function clearScreenResults() {
    state.screen.ocrText = '';
    state.screen.lastTranslation = '';
    dom.ocrText.value = '';
    dom.ocrCharCount.textContent = '0 字符';
    dom.retranslateBtn.disabled = true;
    dom.screenResults.hidden = true;
    dom.screenEmpty.hidden = false;
    setScreenTranslation('', { loading: false });
    dom.screenTranslation.dataset.empty = 'true';
    setScreenState('idle', '等待框选');
  }

  function stopScreenCapture(options = {}) {
    if (state.screen.stream) {
      state.screen.stream.getTracks().forEach((track) => {
        try { track.stop(); } catch (error) { /* ignored */ }
      });
      state.screen.stream = null;
    }
    state.screen.busy = false;
    state.screen.processing = false;
    state.screen.frozen = false;
    state.screen.translationAbort?.abort();
    if (state.screen.objectUrl) {
      URL.revokeObjectURL(state.screen.objectUrl);
      state.screen.objectUrl = '';
    }
    dom.captureVideo.pause();
    dom.captureVideo.srcObject = null;
    dom.captureVideo.hidden = true;
    dom.captureImage.removeAttribute('src');
    dom.captureImage.hidden = true;
    dom.captureFrame.hidden = true;
    dom.captureWelcome.hidden = false;
    dom.captureProcessing.hidden = true;
    resetSelection();
    state.screen.kind = null;
    updateCaptureControls();
    if (!options.silent) {
      toast(options.keepResult ? '已停止屏幕共享，之前的识别结果仍保留。' : '已停止屏幕共享。', {
        duration: 1900
      });
    }
  }

  async function waitForVideo() {
    if (dom.captureVideo.readyState >= 1) return;
    await new Promise((resolve) => {
      const handler = () => {
        dom.captureVideo.removeEventListener('loadedmetadata', handler);
        resolve();
      };
      dom.captureVideo.addEventListener('loadedmetadata', handler);
      window.setTimeout(resolve, 2500);
    });
  }

  async function startScreenCapture() {
    if (DESKTOP) {
      if (state.screen.busy || state.screen.processing) return;
      if (dom.settingsOverlay.classList.contains('is-open')) closeSettings();
      document.activeElement?.blur?.();
      try {
        await window.linguaDesktop.startCapture('single');
      } catch (error) {
        toast(`无法开始框选：${error.message || error}`, { type: 'danger', duration: 3600 });
      }
      return;
    }
    if (state.screen.stream) {
      toast('屏幕正在共享中，直接在画面里拖动框选即可。', { duration: 2200 });
      return;
    }
    if (state.screen.kind === 'image') {
      stopScreenCapture({ silent: true, keepResult: true });
    }
    if (!navigator.mediaDevices?.getDisplayMedia) {
      toast('当前浏览器不支持屏幕共享，请改用“上传截图”。', { type: 'danger', duration: 4200 });
      return;
    }
    if (state.screen.busy) return;
    dom.captureStartBtn.disabled = true;
    dom.welcomeStartBtn.disabled = true;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 15, max: 30 } },
        audio: false
      });
      state.screen.stream = stream;
      state.screen.frozen = false;
      clearScreenResults();
      dom.captureVideo.srcObject = stream;
      await waitForVideo();
      await dom.captureVideo.play();
      showCaptureFrame('video');
      const track = stream.getVideoTracks()[0];
      if (track) {
        track.addEventListener('ended', () => {
          if (state.screen.stream === stream) {
            stopScreenCapture({ silent: true });
            toast('屏幕共享已结束。', { duration: 2000 });
          }
        });
      }
      toast('屏幕共享已开始，拖动框选要翻译的区域。', { duration: 2600 });
      announce('屏幕共享已开始。拖动框选文字区域。');
    } catch (error) {
      const message = error.name === 'NotAllowedError'
        ? '屏幕共享被取消或拒绝。'
        : `无法开始屏幕共享：${error.message || '未知错误'}`;
      toast(message, { type: 'danger', duration: 3600 });
    } finally {
      dom.captureStartBtn.disabled = false;
      dom.welcomeStartBtn.disabled = false;
    }
  }

  function useUploadedImage(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast('请选择图片文件。', { type: 'danger' });
      return;
    }
    if (state.screen.stream) {
      state.screen.stream.getTracks().forEach((track) => track.stop());
      state.screen.stream = null;
    }
    if (state.screen.objectUrl) URL.revokeObjectURL(state.screen.objectUrl);
    clearScreenResults();
    resetSelection();
    state.screen.frozen = false;
    state.screen.objectUrl = URL.createObjectURL(file);
    dom.captureImage.onload = () => {
      showCaptureFrame('image');
      toast('截图已载入，拖动框选文字区域。', { duration: 2500 });
    };
    dom.captureImage.src = state.screen.objectUrl;
    dom.imageUpload.value = '';
  }

  function pauseVideoForSelection() {
    if (state.screen.kind !== 'video') return;
    if (!dom.captureVideo.paused) {
      dom.captureVideo.pause();
      state.screen.frozen = true;
      updateCaptureControls();
    }
  }

  function toggleFreeze() {
    if (state.screen.kind !== 'video') return;
    if (dom.captureVideo.paused) {
      dom.captureVideo.play().catch(() => {});
      state.screen.frozen = false;
    } else {
      dom.captureVideo.pause();
      state.screen.frozen = true;
    }
    updateCaptureControls();
  }

  function updateSelectionBox(start, end) {
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);
    dom.selectionBox.style.left = `${x}px`;
    dom.selectionBox.style.top = `${y}px`;
    dom.selectionBox.style.width = `${width}px`;
    dom.selectionBox.style.height = `${height}px`;
    dom.selectionBox.hidden = width < 2 || height < 2;
  }

  function handleSelectionStart(event) {
    if (state.screen.busy || !state.screen.kind || event.button !== 0) return;
    const rect = dom.captureOverlay.getBoundingClientRect();
    const point = {
      x: clamp(event.clientX - rect.left, 0, rect.width),
      y: clamp(event.clientY - rect.top, 0, rect.height)
    };
    state.screen.dragging = true;
    state.screen.dragStart = point;
    state.screen.selection = null;
    dom.selectionTip.hidden = true;
    dom.selectionBox.hidden = false;
    updateSelectionBox(point, point);
    try { dom.captureOverlay.setPointerCapture(event.pointerId); } catch (error) { /* ignored */ }
    event.preventDefault();
  }

  function handleSelectionMove(event) {
    if (!state.screen.dragging || !state.screen.dragStart) return;
    const rect = dom.captureOverlay.getBoundingClientRect();
    const point = {
      x: clamp(event.clientX - rect.left, 0, rect.width),
      y: clamp(event.clientY - rect.top, 0, rect.height)
    };
    updateSelectionBox(state.screen.dragStart, point);
    state.screen.selection = {
      x: Math.min(state.screen.dragStart.x, point.x),
      y: Math.min(state.screen.dragStart.y, point.y),
      width: Math.abs(point.x - state.screen.dragStart.x),
      height: Math.abs(point.y - state.screen.dragStart.y)
    };
    event.preventDefault();
  }

  function handleSelectionEnd(event) {
    if (!state.screen.dragging) return;
    state.screen.dragging = false;
    try { dom.captureOverlay.releasePointerCapture(event.pointerId); } catch (error) { /* ignored */ }
    const selection = state.screen.selection;
    if (!selection || selection.width < 24 || selection.height < 14) {
      resetSelection();
      return;
    }
    pauseVideoForSelection();
    processSelection(selection);
    state.screen.selection = null;
  }

  function mediaCropCanvas(selection) {
    const media = state.screen.kind === 'video' ? dom.captureVideo : dom.captureImage;
    const naturalWidth = state.screen.kind === 'video' ? media.videoWidth : media.naturalWidth;
    const naturalHeight = state.screen.kind === 'video' ? media.videoHeight : media.naturalHeight;
    const rect = dom.captureOverlay.getBoundingClientRect();
    if (!naturalWidth || !naturalHeight || !rect.width || !rect.height) {
      throw new Error('画面尺寸尚未准备好，请重试。');
    }
    const sx = clamp(selection.x / rect.width * naturalWidth, 0, naturalWidth - 1);
    const sy = clamp(selection.y / rect.height * naturalHeight, 0, naturalHeight - 1);
    const sw = clamp(selection.width / rect.width * naturalWidth, 1, naturalWidth - sx);
    const sh = clamp(selection.height / rect.height * naturalHeight, 1, naturalHeight - sy);

    const targetWidth = Math.max(1, Math.round(sw));
    const targetHeight = Math.max(1, Math.round(sh));
    const upscale = sw < 500 ? Math.min(2.6, 800 / sw) : 1;
    const work = document.createElement('canvas');
    work.width = Math.round(targetWidth * upscale);
    work.height = Math.round(targetHeight * upscale);
    const wctx = work.getContext('2d', { willReadFrequently: true });
    wctx.imageSmoothingEnabled = true;
    wctx.imageSmoothingQuality = 'high';
    wctx.drawImage(media, sx, sy, sw, sh, 0, 0, work.width, work.height);

    const imageData = wctx.getImageData(0, 0, work.width, work.height);
    const data = imageData.data;
    let sum = 0;
    const samples = Math.max(1, Math.floor(data.length / 4 / 48));
    for (let i = 0; i < data.length; i += 4 * samples) {
      sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    const mean = sum / Math.ceil(data.length / 4 / samples);
    const invert = mean < 108;

    for (let i = 0; i < data.length; i += 4) {
      let lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (invert) lum = 255 - lum;
      lum = clamp((lum - 128) * 1.12 + 128, 0, 255);
      data[i] = lum;
      data[i + 1] = lum;
      data[i + 2] = lum;
      data[i + 3] = 255;
    }
    wctx.putImageData(imageData, 0, 0);

    const padded = document.createElement('canvas');
    padded.width = work.width + 32;
    padded.height = work.height + 32;
    const pctx = padded.getContext('2d');
    pctx.fillStyle = '#ffffff';
    pctx.fillRect(0, 0, padded.width, padded.height);
    pctx.drawImage(work, 16, 16);
    return padded;
  }

  function setProcessing(show, title = '正在识别文字…', detail = '准备 OCR 引擎') {
    dom.captureProcessing.hidden = !show;
    state.screen.processing = show;
    if (show) {
      dom.processingTitle.textContent = title;
      dom.processingDetail.textContent = detail;
      dom.processingBar.style.width = '4%';
    }
    updateCaptureControls();
  }

  function setProcessingProgress(progress, detail) {
    const percent = clamp(Math.round(progress * 100), 0, 100);
    dom.processingBar.style.width = `${percent}%`;
    if (detail) dom.processingDetail.textContent = detail;
  }

  function loadScript(url) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`无法加载脚本：${url}`));
      document.head.appendChild(script);
    });
  }

  let tesseractLoader = null;
  async function loadTesseract() {
    if (window.Tesseract) return window.Tesseract;
    if (!tesseractLoader) {
      tesseractLoader = loadScript(OCR_SCRIPT_URL)
        .catch(() => loadScript(OCR_SCRIPT_FALLBACK))
        .then(() => {
          if (!window.Tesseract) throw new Error('OCR 引擎未正确加载。');
          return window.Tesseract;
        })
        .catch((error) => {
          tesseractLoader = null;
          throw new Error(`OCR 引擎加载失败，请检查网络后重试。${error.message || ''}`);
        });
    }
    return tesseractLoader;
  }

  async function getOcrWorker(langs, options = {}) {
    const key = langs.join('+');
    if (state.screen.worker && state.screen.workerKey === key) return state.screen.worker;
    if (state.screen.workerPromise) {
      await state.screen.workerPromise.catch(() => {});
    }
    if (state.screen.worker && state.screen.workerKey !== key) {
      try { await state.screen.worker.terminate(); } catch (error) { /* ignored */ }
      state.screen.worker = null;
      state.screen.workerKey = '';
    }

    state.screen.workerPromise = (async () => {
      const Tesseract = await loadTesseract();
      if (!options.silent) {
        setProcessing(true, '正在加载 OCR 语言包…', `识别语言：${getLang(dom.sourceLang.value).name}`);
      }
      const worker = await Tesseract.createWorker(langs, 1, {
        workerPath: OCR_WORKER_URL,
        corePath: OCR_CORE_URL,
        langPath: ocrLangPath(),
        logger: (message) => {
          if (!state.screen.processing) return;
          if (message.status) {
            const labels = {
              'loading tesseract core': '加载识别核心…',
              'initializing tesseract': '初始化识别引擎…',
              'loading language traineddata': '下载语言数据…',
              'initializing api': '准备识别…',
              'recognizing text': '正在识别文字…'
            };
            setProcessingProgress(
              Number(message.progress) || 0,
              labels[message.status] || message.status
            );
          }
        },
        errorHandler: (error) => {
          console.error('Tesseract worker error:', error);
        }
      });
      state.screen.worker = worker;
      state.screen.workerKey = key;
      return worker;
    })();

    try {
      return await state.screen.workerPromise;
    } finally {
      state.screen.workerPromise = null;
    }
  }

  async function processSelection(selection) {
    if (state.screen.busy) return;
    state.screen.busy = true;
    dom.selectionBox.hidden = true;
    dom.selectionTip.hidden = true;
    setProcessing(true, '正在识别文字…', '准备 OCR 引擎');
    pushDesktopResult({
      status: 'loading',
      detail: '正在识别屏幕文字…',
      sourceLabel: '自动检测',
      targetLabel: getLang(dom.targetLang.value).name
    });
    try {
      const canvas = mediaCropCanvas(selection);
      const langs = getLang(dom.sourceLang.value).tess;
      const worker = await getOcrWorker(langs);
      if (!worker) throw new Error('OCR 引擎未准备好。');
      setProcessing(true, '正在识别文字…', '正在识别画面文字');
      setProcessingProgress(0.65, '正在识别画面文字…');
      const result = await worker.recognize(canvas.toDataURL('image/png'));
      setProcessingProgress(1, '识别完成');
      const text = cleanInput(result?.data?.text || '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      if (!text) {
        throw new Error('没有识别到文字。请框选更清晰、面积更大的区域。');
      }
      state.screen.ocrText = text;
      dom.ocrText.value = text;
      dom.ocrCharCount.textContent = `${text.length} 字符`;
      dom.retranslateBtn.disabled = false;
      dom.screenEmpty.hidden = true;
      dom.screenResults.hidden = false;
      setProcessing(false);
      updateCaptureControls();
      toast('已识别文字，正在翻译…', { duration: 2200 });
      await translateScreenText({ manual: true });
    } catch (error) {
      console.error(error);
      if (error?.name === 'AbortError') return;
      setProcessing(false);
      updateCaptureControls();
      dom.selectionTip.hidden = false;
      toast(error.message || '识别失败，请稍后重试。', { type: 'danger', duration: 4800 });
      setScreenState('error', error.message || '识别失败');
      pushDesktopResult({
        status: 'error',
        message: error.message || '识别失败，请稍后重试。',
        targetLabel: getLang(dom.targetLang.value).name
      });
    } finally {
      state.screen.busy = false;
      dom.selectionBox.hidden = true;
      dom.selectionTip.hidden = state.screen.kind ? false : true;
      setProcessing(false);
      updateCaptureControls();
    }
  }

  function updateScreenResultMeta(detectedSourceId) {
    const target = getLang(dom.targetLang.value);
    const selected = dom.sourceLang.value;
    let sourceName = '自动检测';
    if (detectedSourceId) sourceName = getLang(detectedSourceId).name;
    else if (selected !== 'auto') sourceName = getLang(selected).name;
    dom.screenTranslationLang.textContent = target.name;
    dom.screenLanguageMeta.textContent = `${sourceName} → ${target.name}`;
  }

  function pushDesktopResult(payload) {
    if (!DESKTOP || !state.screen.desktopToken) return;
    window.linguaDesktop.updateResult({
      ...payload,
      token: state.screen.desktopToken
    });
  }

  /* =========================================================
     Auto translation: a persistent, self-updating region
     ========================================================= */

  function updateAutoUI() {
    if (!dom.autoStartBtn || !dom.autoStopBtn) return;
    const active = state.auto.active;
    dom.autoStartBtn.disabled = active || !DESKTOP;
    dom.autoStopBtn.disabled = !active;
    if (dom.autoStatus) {
      const label = dom.autoStatus.querySelector('span');
      if (label) {
        label.textContent = !DESKTOP
          ? '自动翻译仅桌面版支持'
          : active ? '自动翻译中 · 画面变化时更新' : '未开始';
      }
      dom.autoStatus.classList.toggle('is-active', active);
    }
  }

  function clearAutoTimer() {
    if (state.auto.timer) window.clearTimeout(state.auto.timer);
    state.auto.timer = 0;
  }

  function stopAutoLoop() {
    clearAutoTimer();
    state.auto.controller?.abort?.();
    state.auto.controller = null;
    state.auto.processing = false;
    state.auto.active = false;
    state.auto.token = null;
    state.auto.lastText = '';
    state.auto.lastTranslatedAt = 0;
  }

  function handleAutoStop(payload = {}) {
    if (payload.token && state.auto.token && payload.token !== state.auto.token) return;
    stopAutoLoop();
    updateAutoUI();
  }

  async function stopAutoTranslation(options = {}) {
    const wasActive = state.auto.active;
    stopAutoLoop();
    updateAutoUI();
    if (DESKTOP) {
      try { await window.linguaDesktop.stopAuto(); } catch (error) { /* ignored */ }
    }
    if (!options.silent) {
      toast(wasActive ? '自动翻译已停止。' : '当前没有正在运行的自动翻译。', { duration: 1800 });
    }
  }

  function normalizeAutoText(text) {
    return String(text || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async function prepareAutoFrame(dataUrl) {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('读取自动翻译画面失败。'));
      img.src = dataUrl;
    });
    const sourceWidth = image.naturalWidth || 1;
    const sourceHeight = image.naturalHeight || 1;
    const scale = Math.min(2.4, Math.max(1, 760 / sourceWidth));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;
    let total = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      total += (pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114);
    }
    const mean = total / Math.max(1, pixels.length / 4);
    const invert = mean < 108;
    for (let index = 0; index < pixels.length; index += 4) {
      let gray = pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114;
      if (invert) gray = 255 - gray;
      gray = Math.max(0, Math.min(255, (gray - 128) * 1.16 + 128));
      pixels[index] = gray;
      pixels[index + 1] = gray;
      pixels[index + 2] = gray;
    }
    ctx.putImageData(imageData, 0, 0);
    const padded = document.createElement('canvas');
    padded.width = width + 28;
    padded.height = height + 28;
    const paddedCtx = padded.getContext('2d');
    paddedCtx.fillStyle = '#ffffff';
    paddedCtx.fillRect(0, 0, padded.width, padded.height);
    paddedCtx.drawImage(canvas, 14, 14);
    return padded.toDataURL('image/png');
  }

  async function recognizeAutoFrame(dataUrl) {
    const prepared = await prepareAutoFrame(dataUrl);
    const worker = await getOcrWorker(getLang(dom.sourceLang.value).tess, { silent: true });
    if (!worker) throw new Error('OCR 引擎未准备好。');
    const result = await worker.recognize(prepared);
    return cleanInput(result?.data?.text || '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  async function translateAutoText(text) {
    state.auto.controller?.abort?.();
    const controller = new AbortController();
    state.auto.controller = controller;
    const selectedSource = dom.sourceLang.value;
    let source = selectedSource;
    let detected = null;
    if (selectedSource === 'auto') {
      detected = detectLanguage(text);
      source = detected.id;
    }
    const sourceLang = getLang(source);
    const target = dom.targetLang.value;
    const targetLang = getLang(target);
    const translated = source === target
      ? text
      : await requestTranslation({
        text,
        source,
        target,
        stream: false,
        signal: controller.signal
      });
    if (!state.auto.active) return;
    const stamp = new Date().toLocaleTimeString('zh-CN', {
      hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    pushDesktopResult({
      status: 'success',
      text: translated,
      sourceLabel: selectedSource === 'auto' ? `自动检测 · ${sourceLang.name}` : sourceLang.name,
      targetLabel: targetLang.name,
      detected: detected ? sourceLang.name : '',
      original: text,
      auto: true,
      autoStatus: `自动更新 · ${stamp}`
    });
  }

  async function autoTick(token) {
    if (!state.auto.active || state.auto.token !== token) return;
    state.auto.processing = true;
    try {
      const frame = await window.linguaDesktop.captureAutoFrame(token);
      if (!state.auto.active || state.auto.token !== token) return;
      if (!frame?.ok) {
        if (/会话已结束/.test(frame?.error || '')) {
          stopAutoLoop();
          updateAutoUI();
          return;
        }
        throw new Error(frame?.error || '截取屏幕失败。');
      }
      const text = await recognizeAutoFrame(frame.dataUrl);
      if (!state.auto.active || state.auto.token !== token) return;
      const normalized = normalizeAutoText(text);
      const now = Date.now();
      if (normalized) {
        const changed = normalized !== state.auto.lastText;
        const due = now - state.auto.lastTranslatedAt >= 30000;
        if (changed || due) {
          state.auto.lastText = normalized;
          state.auto.lastTranslatedAt = now;
          await translateAutoText(normalized);
        }
      }
    } catch (error) {
      if (error?.name === 'AbortError') return;
      if (state.auto.active && state.auto.token === token) {
        pushDesktopResult({
          status: 'error',
          message: `自动翻译暂时失败：${error.message || '请稍后重试。'}`,
          auto: true,
          autoStatus: '自动翻译出错'
        });
      }
    } finally {
      state.auto.processing = false;
      if (state.auto.active && state.auto.token === token) {
        clearAutoTimer();
        state.auto.timer = window.setTimeout(() => autoTick(token), 1200);
      }
    }
  }

  function handleAutoStart(payload = {}) {
    if (!payload.token) return;
    clearAutoTimer();
    state.auto.controller?.abort?.();
    state.screen.desktopToken = payload.token;
    state.auto.active = true;
    state.auto.token = payload.token;
    state.auto.lastText = '';
    state.auto.lastTranslatedAt = 0;
    state.auto.processing = false;
    updateAutoUI();
    if (state.mode !== 'auto') setMode('auto', { silent: true });
    void autoTick(payload.token);
  }

  async function startAutoFromUI() {
    if (!DESKTOP) {
      toast('自动翻译需要桌面版支持。', { type: 'gold' });
      return;
    }
    if (state.auto.active) {
      toast('自动翻译正在运行，请先停止或直接重新框选。', { duration: 2200 });
      return;
    }
    setMode('auto', { silent: true });
    if (dom.settingsOverlay.classList.contains('is-open')) closeSettings();
    await window.linguaDesktop.startCapture('auto');
  }

  async function translateScreenText({ manual = false } = {}) {
    const text = (state.screen.ocrText || dom.ocrText.value || '').trim();
    if (!text) return;
    state.screen.translationAbort?.abort();
    state.screen.translationAbort = new AbortController();
    const controller = state.screen.translationAbort;
    const serial = ++state.screen.translationSerial;
    const selectedSource = dom.sourceLang.value;
    let source = selectedSource;
    let detectedLang = null;
    if (selectedSource === 'auto') {
      detectedLang = detectLanguage(text);
      source = detectedLang.id;
      state.lastDetectedSource = source;
    }
    const sourceLang = getLang(source);
    const target = dom.targetLang.value;
    const targetLang = getLang(target);
    updateScreenResultMeta(detectedLang ? sourceLang.id : (selectedSource === 'auto' ? null : source));
    setScreenState('active', detectedLang ? `检测到${sourceLang.name} · 正在翻译…` : '正在翻译…');
    setScreenTranslation('', { loading: true });
    pushDesktopResult({
      status: 'loading',
      detail: '正在翻译…',
      sourceLabel: selectedSource === 'auto' ? `自动检测 · ${sourceLang.name}` : sourceLang.name,
      targetLabel: targetLang.name,
      original: text,
      showOriginal: true
    });

    if (source === target) {
      state.screen.lastTranslation = text;
      setScreenTranslation(text);
      setScreenState('idle', `检测到${sourceLang.name} · 无需翻译`);
      pushDesktopResult({
        status: 'success',
        text,
        sourceLabel: sourceLang.name,
        targetLabel: targetLang.name,
        detected: sourceLang.name,
        original: text,
        showOriginal: true
      });
      announce('语言相同，无需翻译。');
      return;
    }

    state.screen.resultPushAt = 0;
    try {
      const result = await requestTranslation({
        text,
        source,
        target,
        stream: state.settings.provider === 'openai' && state.settings.openai.stream,
        signal: controller.signal,
        onDelta: (partial) => {
          if (serial !== state.screen.translationSerial) return;
          state.screen.lastTranslation = partial;
          setScreenTranslation(partial, { loading: true });
          setScreenState('active', '正在接收译文…');
          const now = performance.now();
          if (now - state.screen.resultPushAt > 80) {
            state.screen.resultPushAt = now;
            pushDesktopResult({
              status: 'streaming',
              text: partial,
              sourceLabel: sourceLang.name,
              targetLabel: targetLang.name,
              detected: detectedLang ? sourceLang.name : '',
              original: text,
              showOriginal: true
            });
          }
        }
      });
      if (serial !== state.screen.translationSerial) return;
      const finalText = String(result || '').trim();
      if (!finalText) throw new Error('翻译服务没有返回译文。');
      state.screen.lastTranslation = finalText;
      setScreenTranslation(finalText);
      setScreenState('idle', detectedLang ? `翻译完成 · ${sourceLang.name}` : '翻译完成');
      pushDesktopResult({
        status: 'success',
        text: finalText,
        sourceLabel: sourceLang.name,
        targetLabel: targetLang.name,
        detected: detectedLang ? sourceLang.name : '',
        original: text,
        showOriginal: true
      });
      announce('屏幕文字翻译完成。');
    } catch (error) {
      if (error.name === 'AbortError' || serial !== state.screen.translationSerial) return;
      const message = error.message || '屏幕翻译失败。';
      setScreenTranslation('', { loading: false });
      setScreenState('error', message);
      toast(message, { type: 'danger', duration: 4200 });
      pushDesktopResult({
        status: 'error',
        message,
        sourceLabel: sourceLang.name,
        targetLabel: targetLang.name
      });
    }
  }

  /* =========================================================
     Desktop integration
     ========================================================= */

  function handleDesktopCapture(payload) {
    const dataUrl = payload?.dataUrl;
    if (!dataUrl) return;
    if (payload.inline) {
      void processInlineCapture(payload);
      return;
    }
    state.screen.desktopToken = payload.token || null;
    document.activeElement?.blur?.();
    window.scrollTo(0, 0);
    document.querySelector('.main')?.scrollTo?.(0, 0);
    if (dom.settingsOverlay.classList.contains('is-open')) closeSettings();
    setMode('screen', { silent: true });

    if (state.screen.stream) {
      state.screen.stream.getTracks().forEach((track) => {
        try { track.stop(); } catch (error) { /* ignored */ }
      });
      state.screen.stream = null;
      dom.captureVideo.srcObject = null;
    }
    if (state.screen.objectUrl) {
      URL.revokeObjectURL(state.screen.objectUrl);
      state.screen.objectUrl = '';
    }

    state.screen.busy = false;
    state.screen.processing = false;
    state.screen.frozen = true;
    clearScreenResults();
    resetSelection();
    dom.captureImage.onload = () => {
      showCaptureFrame('image');
      dom.captureStatus.innerHTML = '<i></i>桌面截图';
      toast('已截取屏幕区域，正在识别…', { duration: 1900 });
      window.setTimeout(() => {
        fitCaptureFrame();
        const rect = dom.captureOverlay.getBoundingClientRect();
        if (rect.width > 10 && rect.height > 10) {
          processSelection({ x: 0, y: 0, width: rect.width, height: rect.height });
        }
      }, 80);
    };
    dom.captureImage.src = dataUrl;
  }

  let inlineAbort = null;

  function inlineParagraphs(data, imageWidth, imageHeight) {
    const lines = [];
    const blocks = Array.isArray(data?.blocks) ? data.blocks : [];
    for (const block of blocks) {
      const paragraphs = Array.isArray(block.paragraphs) ? block.paragraphs : [];
      const lineSource = paragraphs.length
        ? paragraphs.flatMap((paragraph) => Array.isArray(paragraph.lines) ? paragraph.lines : [])
        : (Array.isArray(block.lines) ? block.lines : []);
      for (const line of lineSource) {
        const text = String(line.text || '').trim();
        const bbox = line.bbox;
        if (!text || !bbox || bbox.x1 <= bbox.x0 || bbox.y1 <= bbox.y0) continue;
        lines.push({ text, bbox });
      }
    }

    if (!lines.length) {
      const paragraphs = [];
      for (const block of blocks) {
        for (const paragraph of (Array.isArray(block.paragraphs) ? block.paragraphs : [])) {
          const text = String(paragraph.text || '').trim();
          if (text && paragraph.bbox) paragraphs.push({ text, bbox: paragraph.bbox });
        }
        if (block.text && block.bbox) paragraphs.push({ text: String(block.text).trim(), bbox: block.bbox });
      }
      if (paragraphs.length) return paragraphs;
      if (data?.text) {
        return [{
          text: String(data.text).trim(),
          bbox: { x0: 0, y0: 0, x1: imageWidth, y1: imageHeight }
        }];
      }
      return [];
    }

    lines.sort((a, b) => a.bbox.y0 - b.bbox.y0 || a.bbox.x0 - b.bbox.x0);
    const groups = [];
    for (const line of lines) {
      const previous = groups[groups.length - 1];
      if (!previous) {
        groups.push({ text: line.text, bbox: { ...line.bbox } });
        continue;
      }
      const lineHeight = Math.max(1, line.bbox.y1 - line.bbox.y0);
      const gap = line.bbox.y0 - previous.bbox.y1;
      const overlap = Math.min(line.bbox.x1, previous.bbox.x1) - Math.max(line.bbox.x0, previous.bbox.x0);
      const aligned = Math.abs(line.bbox.x0 - previous.bbox.x0) < Math.max(32, lineHeight * 2);
      if (gap <= Math.max(10, lineHeight * 1.15) && (overlap > 0 || aligned)) {
        previous.text += `\n${line.text}`;
        previous.bbox.x0 = Math.min(previous.bbox.x0, line.bbox.x0);
        previous.bbox.y0 = Math.min(previous.bbox.y0, line.bbox.y0);
        previous.bbox.x1 = Math.max(previous.bbox.x1, line.bbox.x1);
        previous.bbox.y1 = Math.max(previous.bbox.y1, line.bbox.y1);
      } else {
        groups.push({ text: line.text, bbox: { ...line.bbox } });
      }
    }
    return groups;
  }

  async function prepareInlineImage(dataUrl) {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('读取截图失败。'));
      img.src = dataUrl;
    });
    const sourceWidth = Math.max(1, image.naturalWidth || 1);
    const sourceHeight = Math.max(1, image.naturalHeight || 1);
    const scale = Math.min(2, Math.max(1, 1600 / sourceWidth));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;
    let total = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      total += pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114;
    }
    const mean = total / Math.max(1, pixels.length / 4);
    const invert = mean < 108;
    for (let index = 0; index < pixels.length; index += 4) {
      let gray = pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114;
      if (invert) gray = 255 - gray;
      gray = Math.max(0, Math.min(255, (gray - 128) * 1.12 + 128));
      pixels[index] = gray;
      pixels[index + 1] = gray;
      pixels[index + 2] = gray;
    }
    ctx.putImageData(imageData, 0, 0);
    return { dataUrl: canvas.toDataURL('image/png'), width, height };
  }

  async function processInlineCapture(payload) {
    const token = payload.token;
    inlineAbort?.abort();
    const controller = new AbortController();
    inlineAbort = controller;
    try {
      window.linguaDesktop.updateInlineStatus({ token, text: '正在识别屏幕文字…' });
      const worker = await getOcrWorker(getLang(dom.sourceLang.value).tess, { silent: true });
      if (!worker) throw new Error('OCR 引擎未准备好。');
      const prepared = await prepareInlineImage(payload.dataUrl);
      if (controller.signal.aborted) return;
      try {
        await worker.setParameters({ tessedit_pageseg_mode: '11' });
      } catch (error) { /* older worker: keep default PSM */ }
      const result = await worker.recognize(prepared.dataUrl, {}, { blocks: true });
      if (controller.signal.aborted) return;
      const paragraphs = inlineParagraphs(result?.data, prepared.width, prepared.height);
      if (!paragraphs.length) throw new Error('没有识别到文字。');
      const selectedSource = dom.sourceLang.value;
      const target = dom.targetLang.value;
      const translated = [];
      for (let index = 0; index < paragraphs.length; index++) {
        if (controller.signal.aborted) return;
        const paragraph = paragraphs[index];
        let source = selectedSource;
        if (source === 'auto') source = detectLanguage(paragraph.text).id;
        window.linguaDesktop.updateInlineStatus({
          token,
          text: `正在翻译 ${index + 1} / ${paragraphs.length}…`
        });
        const text = source === target
          ? paragraph.text
          : await requestTranslation({
            text: paragraph.text,
            source,
            target,
            stream: false,
            signal: controller.signal
          });
        if (controller.signal.aborted) return;
        const bbox = paragraph.bbox;
        translated.push({
          text: String(text || '').trim(),
          x: bbox.x0 / prepared.width,
          y: bbox.y0 / prepared.height,
          w: (bbox.x1 - bbox.x0) / prepared.width,
          h: (bbox.y1 - bbox.y0) / prepared.height
        });
      }
      if (controller.signal.aborted) return;
      window.linguaDesktop.updateInline({ token, blocks: translated });
    } catch (error) {
      if (error?.name === 'AbortError' || controller.signal.aborted) return;
      window.linguaDesktop.updateInlineStatus({
        token,
        error: true,
        text: `翻译失败：${error.message || '请稍后重试。'}`
      });
    } finally {
      if (inlineAbort === controller) inlineAbort = null;
    }
  }

  function initDesktopIntegration() {
    if (!DESKTOP) return;
    document.body.classList.add('is-desktop');
    const brandSmall = document.querySelector('.brand-copy small');
    if (brandSmall) brandSmall.textContent = '轻软版 / 8 LANGUAGES';

    updateHotkeyUI();
    dom.welcomeStartBtn.innerHTML = '<svg><use href="#i-screen"></use></svg><span>框选屏幕</span>';
    const hotkeyLabel = document.querySelector('.welcome-hotkey span');
    if (hotkeyLabel) hotkeyLabel.textContent = '全局快捷键';
    const captureFoot = document.querySelector('.capture-foot > span:first-child');
    if (captureFoot && captureFoot.lastChild) {
      captureFoot.lastChild.textContent = '截图只在本机识别，不会上传画面。';
    }

    window.linguaDesktop.onCapture((payload) => handleDesktopCapture(payload));
    window.linguaDesktop.onInlineCancel(() => {
      inlineAbort?.abort();
    });
    window.linguaDesktop.onAutoStart((payload) => handleAutoStart(payload));
    window.linguaDesktop.onAutoStop((payload) => handleAutoStop(payload));
    window.linguaDesktop.onCancelled((payload) => {
      if (payload?.mode === 'auto') setMode('auto', { silent: true });
      else setMode('screen', { silent: true });
      toast('已取消框选。', { duration: 1700 });
    });
    window.linguaDesktop.onError((payload) => {
      toast(payload?.message || '桌面截图失败。', { type: 'danger', duration: 4200 });
    });

    updateCaptureControls();
    updateAutoUI();
    void syncDesktopSettings().finally(() => showDisclaimerIfNeeded());

    // Auto-detect OCR initializes eight local language models. Warm it up in
    // the background so the first real snip is not stuck on initialization.
    window.setTimeout(() => {
      if (state.settings.source === 'auto' && !state.screen.worker) {
        getOcrWorker(AUTO_LANG.tess, { silent: true }).catch(() => {});
      }
    }, 2600);
  }

  /* =========================================================
     Event bindings
     ========================================================= */

  function bindEvents() {
    dom.disclaimerAccept.addEventListener('click', acceptDisclaimer);
    document.addEventListener('keydown', (event) => {
      if (!dom.disclaimerOverlay.classList.contains('is-open')) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);
    dom.modeTextBtn.addEventListener('click', () => setMode('text'));
    dom.modeScreenBtn.addEventListener('click', () => setMode('screen'));
    dom.modeAutoBtn.addEventListener('click', () => setMode('auto'));
    dom.autoStartBtn.addEventListener('click', () => void startAutoFromUI());
    dom.autoStopBtn.addEventListener('click', () => void stopAutoTranslation());

    dom.sourceLang.addEventListener('change', handleLanguageChange);
    dom.targetLang.addEventListener('change', handleLanguageChange);
    dom.swapBtn.addEventListener('click', swapLanguages);

    dom.inputText.addEventListener('input', () => {
      updateCharCount();
      if (state.settings.live) scheduleLiveTranslation();
      else dom.composerStatus.textContent = '';
    });
    dom.inputText.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        translateTextNow({ manual: true });
      }
    });
    dom.translateBtn.addEventListener('click', () => translateTextNow({ manual: true }));

    dom.liveToggle.addEventListener('click', () => {
      state.settings.live = !state.settings.live;
      setLiveUI();
      persistSettings();
      if (state.settings.live && dom.inputText.value.trim()) {
        scheduleLiveTranslation();
      } else {
        window.clearTimeout(state.liveTimer);
        dom.composerStatus.textContent = state.settings.live ? '' : '实时翻译已关闭。';
      }
    });

    dom.pasteBtn.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (!text) return;
        dom.inputText.value = text.slice(0, MAX_CHARS);
        updateCharCount();
        dom.inputText.focus();
        if (state.settings.live) scheduleLiveTranslation();
      } catch (error) {
        toast('无法读取剪贴板，请手动粘贴。', { type: 'danger' });
      }
    });
    dom.clearBtn.addEventListener('click', () => {
      dom.inputText.value = '';
      updateCharCount();
      clearTextOutput();
      dom.inputText.focus();
    });
    dom.copyBtn.addEventListener('click', () => copyText(state.lastOutput));
    dom.speakBtn.addEventListener('click', () => speakText(state.lastOutput));

    dom.quickSamples.querySelectorAll('[data-text]').forEach((button) => {
      button.addEventListener('click', () => {
        const lang = button.dataset.sample;
        if (LANG_BY_ID.has(lang)) {
          state.settings.source = lang;
          dom.sourceLang.value = lang;
          setLanguageUI();
          persistSettings();
        }
        dom.inputText.value = button.dataset.text;
        updateCharCount();
        dom.inputText.focus();
        if (state.settings.live) scheduleLiveTranslation();
        else translateTextNow({ manual: true });
      });
    });

    dom.settingsBtn.addEventListener('click', openSettings);
    dom.apiStatusBtn.addEventListener('click', openSettings);
    dom.settingsOverlay.addEventListener('click', (event) => {
      if (event.target === dom.settingsOverlay) closeSettings();
    });
    document.querySelectorAll('[data-close]').forEach((button) => {
      button.addEventListener('click', () => {
        if (button.dataset.close === 'settingsOverlay') closeSettings();
      });
    });
    dom.providerChoice.addEventListener('click', (event) => {
      const card = event.target.closest('[data-provider]');
      if (!card) return;
      updateProviderChoices(card.dataset.provider);
    });
    document.querySelectorAll('[data-preset]').forEach((button) => {
      button.addEventListener('click', () => {
        const preset = PRESETS[button.dataset.preset];
        if (!preset) return;
        dom.apiEndpoint.value = preset.endpoint;
        dom.apiModel.value = preset.model;
        dom.testResult.textContent = '';
        dom.testResult.className = 'test-result';
      });
    });
    dom.toggleKeyBtn.addEventListener('click', () => {
      const showing = dom.apiKey.type === 'text';
      dom.apiKey.type = showing ? 'password' : 'text';
      dom.toggleKeyBtn.textContent = showing ? '显示' : '隐藏';
    });
    dom.testApiBtn.addEventListener('click', testApiConnection);
    dom.saveSettingsBtn.addEventListener('click', saveModalSettings);
    dom.hotkeyRecordBtn.addEventListener('click', () => {
      if (state.hotkeyRecording) void cancelHotkeyRecording();
      else void beginHotkeyRecording('snip');
    });
    dom.autoHotkeyRecordBtn.addEventListener('click', () => {
      if (state.hotkeyRecording) void cancelHotkeyRecording();
      else void beginHotkeyRecording('auto');
    });
    dom.snipOpacity.addEventListener('input', updateOpacityLabels);
    dom.autoOpacity.addEventListener('input', updateOpacityLabels);

    dom.captureStartBtn.addEventListener('click', startScreenCapture);
    dom.welcomeStartBtn.addEventListener('click', startScreenCapture);
    dom.captureFreezeBtn.addEventListener('click', toggleFreeze);
    dom.captureStopBtn.addEventListener('click', () => stopScreenCapture());
    dom.uploadBtn.addEventListener('click', () => dom.imageUpload.click());
    dom.welcomeUploadBtn.addEventListener('click', () => dom.imageUpload.click());
    dom.imageUpload.addEventListener('change', () => useUploadedImage(dom.imageUpload.files?.[0]));

    dom.captureOverlay.addEventListener('pointerdown', handleSelectionStart);
    dom.captureOverlay.addEventListener('pointermove', handleSelectionMove);
    dom.captureOverlay.addEventListener('pointerup', handleSelectionEnd);
    dom.captureOverlay.addEventListener('pointercancel', () => {
      state.screen.dragging = false;
      resetSelection();
    });

    dom.retranslateBtn.addEventListener('click', () => {
      state.screen.ocrText = dom.ocrText.value;
      if (!state.screen.ocrText.trim()) return;
      translateScreenText({ manual: true });
    });
    dom.ocrText.addEventListener('input', () => {
      state.screen.ocrText = dom.ocrText.value;
      const length = dom.ocrText.value.length;
      dom.ocrCharCount.textContent = `${length} 字符`;
      dom.retranslateBtn.disabled = !dom.ocrText.value.trim();
    });
    dom.screenCopyBtn.addEventListener('click', () => copyText(state.screen.lastTranslation));
    dom.screenSpeakBtn.addEventListener('click', () => speakText(state.screen.lastTranslation));

    window.addEventListener('resize', fitCaptureFrame);
    window.addEventListener('beforeunload', () => {
      state.textAbort?.abort();
      state.screen.translationAbort?.abort();
      state.screen.stream?.getTracks().forEach((track) => track.stop());
      try {
        state.screen.worker?.terminate?.();
      } catch (error) {
        /* ignored */
      }
    });

    document.addEventListener('keydown', handleHotkeys);
  }

  function handleHotkeys(event) {
    if (state.hotkeyRecording) return;
    if (event.key === 'Escape') {
      if (dom.settingsOverlay.classList.contains('is-open')) {
        closeSettings();
        event.preventDefault();
        return;
      }
      if (state.mode === 'screen' && state.screen.kind) {
        if (state.screen.dragging) {
          state.screen.dragging = false;
          resetSelection();
          event.preventDefault();
        } else {
          resetSelection();
        }
      }
      return;
    }

    if (!DESKTOP && (event.ctrlKey || event.metaKey) && event.shiftKey && event.code === 'F2') {
      event.preventDefault();
      if (dom.settingsOverlay.classList.contains('is-open')) {
        closeSettings();
        return;
      }
      if (state.mode !== 'screen') setMode('screen');
      if (state.screen.kind) {
        dom.selectionTip.hidden = false;
        toast('在画面中拖动框选要翻译的区域。', { duration: 2200 });
        dom.captureOverlay.focus?.();
      } else {
        startScreenCapture();
      }
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && state.mode === 'text') {
      if (document.activeElement === dom.inputText) {
        event.preventDefault();
        translateTextNow({ manual: true });
      }
    }
  }

  /* =========================================================
     Init
     ========================================================= */

  function init() {
    populateLanguageSelects();
    setLanguageUI();
    setLiveUI();
    updateHotkeyUI();
    updateCharCount();
    setApiStatus();
    updateCaptureControls();
    updateScreenResultMeta();
    bindEvents();
    initDesktopIntegration();
    if (!DESKTOP) {
      dom.modeAutoBtn.hidden = true;
      dom.opacitySection.hidden = true;
    }
    setMode('text', { silent: true });
    updateAutoUI();
    if (!DESKTOP) {
      window.setTimeout(showDisclaimerIfNeeded, 220);
    }
    checkServerHealth();
    clearScreenResults();
    dom.inputText.value = '';
    window.setTimeout(() => {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        // Keep the screen mode useful even when screen sharing is unavailable.
        dom.captureStartBtn.title = '当前浏览器不支持屏幕共享，请使用上传截图';
      }
    }, 100);
  }

  init();
})();

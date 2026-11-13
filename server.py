#!/usr/bin/env python3
"""LINGUA local server.

Serves the translation UI and provides a small same-origin proxy for:
  * MyMemory's public translation API
  * Any OpenAI-compatible /chat/completions endpoint (streaming or JSON)

Only the Python standard library is required. The server binds to localhost.
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
HOST = "127.0.0.1"
DEFAULT_PORT = 8787
USER_AGENT = "LINGUA/1.0 (local translation tool)"

LANG_IDS = {"zh", "en", "ja", "ko", "fr", "de", "es", "ru"}
MYMEMORY_CODES = {
    "zh": "zh-CN",
    "en": "en",
    "ja": "ja",
    "ko": "ko",
    "fr": "fr",
    "de": "de",
    "es": "es",
    "ru": "ru",
}
LANG_NAMES = {
    "zh": "中文",
    "en": "英语",
    "ja": "日语",
    "ko": "韩语",
    "fr": "法语",
    "de": "德语",
    "es": "西班牙语",
    "ru": "俄语",
}


class ApiError(Exception):
    def __init__(self, message: str, status: int = 502):
        super().__init__(message)
        self.message = message
        self.status = status


def split_text(text: str, limit: int = 460) -> list[str]:
    """Split text into API-sized chunks while preserving line breaks."""
    if len(text) <= limit:
        return [text]

    chunks: list[str] = []
    current = ""
    for line in text.splitlines(keepends=True):
        while len(line) > limit:
            space = limit - len(current)
            if space <= 0:
                chunks.append(current)
                current = ""
                space = limit
            chunks.append(current + line[:space])
            line = line[space:]
            current = ""
        if len(current) + len(line) > limit:
            chunks.append(current)
            current = line
        else:
            current += line
    if current:
        chunks.append(current)
    return [chunk for chunk in chunks if chunk]


def mymemory_translate(text: str, source: str, target: str, email: str) -> str:
    if source == target:
        return text
    src = MYMEMORY_CODES.get(source, source)
    dst = MYMEMORY_CODES.get(target, target)
    parts: list[str] = []
    for chunk in split_text(text):
        params = {
            "q": chunk,
            "langpair": f"{src}|{dst}",
        }
        if email:
            params["de"] = email
        url = "https://api.mymemory.translated.net/get?" + urllib.parse.urlencode(params)
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                raw = response.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", "replace")
            raise ApiError(f"MyMemory 请求失败（HTTP {exc.code}）：{detail[:180]}", 502)
        except urllib.error.URLError as exc:
            raise ApiError(f"无法连接 MyMemory：{exc.reason}", 502)

        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            raise ApiError("MyMemory 返回了无法解析的数据。", 502)

        status = payload.get("responseStatus")
        if status != 200:
            detail = payload.get("responseDetails") or payload.get("responseData") or "未知错误"
            raise ApiError(f"MyMemory 返回错误：{str(detail)[:180]}", 502)
        data = payload.get("responseData") or {}
        translated = data.get("translatedText")
        if not translated:
            raise ApiError("MyMemory 没有返回译文。", 502)
        parts.append(str(translated))
    return "".join(parts) if len(parts) == 1 else "\n".join(parts)


def build_messages(text: str, source: str, target: str) -> list[dict]:
    source_name = LANG_NAMES.get(source, source)
    target_name = LANG_NAMES.get(target, target)
    return [
        {
            "role": "system",
            "content": (
                "You are a professional translation engine. "
                f"Translate the user's text from {source_name} to {target_name}. "
                "Return only the translation, without explanations, notes, labels or quotation marks. "
                "Preserve line breaks and the original formatting as closely as possible."
            ),
        },
        {"role": "user", "content": text},
    ]


def proxy_openai(handler: "Handler", data: dict) -> None:
    config = data.get("openai") or {}
    endpoint = str(config.get("endpoint") or "").strip()
    model = str(config.get("model") or "").strip()
    api_key = str(config.get("apiKey") or "").strip()
    use_stream = bool(config.get("stream"))
    text = str(data.get("text") or "")
    source = str(data.get("source") or "en")
    target = str(data.get("target") or "zh")
    client_messages = data.get("messages")
    messages = client_messages if isinstance(client_messages, list) and client_messages else build_messages(text, source, target)

    if not endpoint.startswith(("https://", "http://")):
        raise ApiError("接口地址必须以 http:// 或 https:// 开头。", 400)
    if not model:
        raise ApiError("请填写模型名称。", 400)

    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.2,
        "stream": use_stream,
    }
    headers = {
        "Content-Type": "application/json",
        "Accept": "text/event-stream" if use_stream else "application/json",
        "User-Agent": USER_AGENT,
    }
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    request = urllib.request.Request(
        endpoint,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers=headers,
        method="POST",
    )

    try:
        response = urllib.request.urlopen(request, timeout=120)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")
        try:
            parsed = json.loads(detail)
            message = parsed.get("error", {}).get("message") or parsed.get("message") or detail
        except Exception:
            message = detail
        raise ApiError(f"翻译接口返回 HTTP {exc.code}：{str(message)[:260]}", 502)
    except urllib.error.URLError as exc:
        raise ApiError(f"无法连接翻译接口：{exc.reason}", 502)

    if use_stream:
        handler.send_response(200)
        handler.send_header("Content-Type", "text/event-stream; charset=utf-8")
        handler.send_header("Cache-Control", "no-cache, no-transform")
        handler.send_header("Connection", "close")
        handler.send_header("X-Accel-Buffering", "no")
        handler.send_header("Access-Control-Allow-Origin", "*")
        handler.end_headers()
        try:
            while True:
                chunk = response.read(1536)
                if not chunk:
                    break
                handler.wfile.write(chunk)
                handler.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            handler.close_connection = True
            try:
                response.close()
            except Exception:
                pass
        return

    try:
        raw = response.read().decode("utf-8", "replace")
    finally:
        response.close()

    try:
        parsed = json.loads(raw)
        content = parsed.get("choices", [{}])[0].get("message", {}).get("content", "")
        if not content:
            raise ApiError("翻译接口返回了空结果。", 502)
        handler.send_json({"ok": True, "text": content, "provider": "openai"})
    except json.JSONDecodeError:
        raise ApiError("翻译接口返回了无法解析的数据。", 502)


class Handler(SimpleHTTPRequestHandler):
    server_version = "LINGUA/1.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt: str, *args) -> None:
        # Keep the console readable: only report API requests and errors.
        path = self.path or ""
        if path.startswith("/api/") or args and str(args[0]).startswith("4"):
            print(f"[LINGUA] {self.address_string()} {fmt % args}")

    def end_headers(self) -> None:
        if not self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Max-Age", "86400")
        self.end_headers()

    def do_GET(self) -> None:
        if self.path.split("?")[0] == "/api/health":
            self.send_json({"ok": True, "name": "LINGUA", "time": int(time.time())})
            return
        super().do_GET()

    def do_POST(self) -> None:
        if self.path.split("?")[0] != "/api/translate":
            self.send_json({"ok": False, "error": "Not found"}, 404)
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0 or length > 2_000_000:
            self.send_json({"ok": False, "error": "请求内容为空或过大。"}, 400)
            return

        try:
            data = json.loads(self.rfile.read(length).decode("utf-8", "replace"))
        except json.JSONDecodeError:
            self.send_json({"ok": False, "error": "请求不是有效的 JSON。"}, 400)
            return

        try:
            text = str(data.get("text") or "")
            source = str(data.get("source") or "en")
            target = str(data.get("target") or "zh")
            if not text.strip():
                raise ApiError("没有需要翻译的文字。", 400)
            if len(text) > 12_000:
                raise ApiError("单次翻译最多支持 12000 个字符。", 413)
            if source not in LANG_IDS or target not in LANG_IDS:
                raise ApiError("不支持的语言代码。", 400)

            provider = str(data.get("provider") or "mymemory")
            if provider == "openai":
                proxy_openai(self, data)
                return
            if provider != "mymemory":
                raise ApiError("未知的翻译服务。", 400)

            email = str((data.get("mymemoryEmail") or ""))
            translated = mymemory_translate(text, source, target, email)
            self.send_json({"ok": True, "text": translated, "provider": "mymemory"})
        except ApiError as exc:
            self.send_json({"ok": False, "error": exc.message}, exc.status)
        except Exception as exc:
            self.send_json({"ok": False, "error": f"本地代理发生错误：{exc}"}, 500)

    def send_json(self, obj: dict, status: int = 200) -> None:
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass


def open_browser_later(url: str) -> None:
    def _open() -> None:
        time.sleep(0.65)
        try:
            webbrowser.open(url)
        except Exception:
            pass

    threading.Thread(target=_open, daemon=True).start()


def main() -> None:
    parser = argparse.ArgumentParser(description="LINGUA local translation server")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()

    try:
        server = ThreadingHTTPServer((HOST, args.port), Handler)
    except OSError as exc:
        print(f"[LINGUA] 无法启动：{exc}")
        print(f"[LINGUA] 端口 {args.port} 可能已被占用。")
        raise SystemExit(1)

    url = f"http://{HOST}:{args.port}/"
    print("")
    print("  LINGUA · 实时翻译")
    print(f"  {url}")
    print("  按 Ctrl+C 停止本地服务")
    print("")
    if not args.no_browser:
        open_browser_later(url)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[LINGUA] 服务已停止。")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()

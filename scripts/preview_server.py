#!/usr/bin/env python3
"""Статический сервер превью с честными заголовками Cache-Control.

`python -m http.server` не шлёт cache-заголовков вовсе: браузер и service
worker держат старые бандлы «по эвристике». Для PWA это смертельно: workbox
precache не пускает новую сборку, и человек слушает прошлогодний синтез,
пока сервер уже отдаёт новый. Правила:

  • index.html, sw.js, manifest, engine.js и любые .html — no-store;
  • хешированные /assets/* (main-<hash>.js) — immutable на год;
  • остальное — no-cache (перевайалидация каждый раз).
"""
import argparse
import os
import re
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

# Сюда лаборатория шлёт записи («⏺ Записать 10 с»): в iframe превью
# автоскачивание запрещено браузером, а файл нужен в рабочей области.
UPLOAD_DIR = Path(os.getcwd()) / 'recordings'
MAX_UPLOAD = 25 * 1024 * 1024
AUDIO_EXT = ('.webm', '.wav', '.mp3', '.m4a', '.ogg', '.opus')

NO_STORE = {'', 'index.html', 'sw.js', 'manifest.webmanifest', 'engine.js'}


class Handler(SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path.split('?')[0] != '/upload':
            self.send_error(404)
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_UPLOAD:
            self.send_error(413)
            return
        query = parse_qs(urlparse(self.path).query)
        name = (query.get('name') or ['rec'])[0]
        name = re.sub(r'[^A-Za-z0-9._-]', '_', name)[:80] or 'rec'
        if not name.endswith(AUDIO_EXT):
            name += '.webm'
        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        (UPLOAD_DIR / name).write_bytes(self.rfile.read(length))
        payload = f'{{"ok": true, "saved": "{name}", "bytes": {length}}}'.encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def end_headers(self):
        path = self.path.split('?')[0].split('#')[0].rstrip('/')
        name = path.rsplit('/', 1)[-1]
        if name in NO_STORE or name.endswith('.html'):
            self.send_header('Cache-Control', 'no-store, must-revalidate')
        elif path.startswith('/assets/') or ('-' in name and name.endswith(('.js', '.css'))):
            self.send_header('Cache-Control', 'public, max-age=31536000, immutable')
        else:
            self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8080)
    parser.add_argument('--bind', default='0.0.0.0')
    parser.add_argument('--directory', default='preview')
    args = parser.parse_args()
    handler = partial(Handler, directory=args.directory)
    with ThreadingHTTPServer((args.bind, args.port), handler) as httpd:
        httpd.serve_forever()


if __name__ == '__main__':
    main()

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
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

NO_STORE = {'', 'index.html', 'sw.js', 'manifest.webmanifest', 'engine.js'}


class Handler(SimpleHTTPRequestHandler):
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

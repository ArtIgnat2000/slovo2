#!/usr/bin/env python3
"""Мини-сервер прототипа игровых механик (npm run proto:serve).

Зачем свой сервер, а не `python3 -m http.server`:
  * корень отдачи — репозиторий, потому что прототип показывает картинки слов
    из `public/words/` (соседняя папка со страницей), а не их копию;
  * адрес `/` сразу ведёт на страницу прототипа — превью в песочнице
    открывается одним касанием, без набора глубокого пути.

Скрипт ничего не пишет и не меняет: только отдаёт файлы репозитория.
"""

import http.server
import os
import socketserver
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
ENTRY = '/docs/game-mechanics/prototype/'
PORT = int(os.environ.get('PORT', 8099))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):  # noqa: N802 (имя метода задано базовым классом)
        if self.path in ('/', '/index.html'):
            self.send_response(302)
            self.send_header('Location', ENTRY)
            self.end_headers()
            return
        super().do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')  # прототип правится каждый раз
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write('%s\n' % (fmt % args))


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == '__main__':
    with Server(('0.0.0.0', PORT), Handler) as httpd:
        print('прототип: http://localhost:%d%s' % (PORT, ENTRY), flush=True)
        print('корень отдачи: %s' % ROOT, flush=True)
        httpd.serve_forever()

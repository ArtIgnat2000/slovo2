#!/usr/bin/env node
// Локальный сервер страницы мерча: отдаёт docs/merch как корень, чтобы
// ES-модули и картинки грузились без сборки Vite.
//
//   node scripts/merch-preview.mjs [порт]
//
// Слушает 0.0.0.0 — предпросмотр в песочнице открывается по внешнему адресу.

import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../docs/merch');
const PORT = Number(process.argv[2] ?? 4173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8',
};

const server = createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  const rel = url === '/' ? 'index.html' : url.replace(/^\/+/, '');
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  let st;
  try {
    st = statSync(file);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('не найдено: ' + rel);
    return;
  }
  if (st.isDirectory()) {
    res.writeHead(302, { Location: rel + '/' }).end();
    return;
  }
  res.writeHead(200, {
    'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream',
    'Content-Length': st.size,
    // Картинки линейки меняются при пересборке — пусть браузер перепроверяет.
    'Cache-Control': 'no-cache',
  });
  createReadStream(file).pipe(res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`мерч: http://0.0.0.0:${PORT}/ (корень — docs/merch)`);
});

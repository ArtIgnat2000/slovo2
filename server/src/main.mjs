// Точка входа: читает окружение, поднимает HTTP и корректно закрывается.
// Никаких зависимостей — образ собирается из официального node:22-alpine.

import { createServer } from './app.mjs';

const port = Number(process.env.PORT ?? 8080);
const host = process.env.HOST ?? '0.0.0.0';
const dbPath = process.env.DB_PATH ?? '/data/slovo.db';
const tz = process.env.TZ || 'Europe/Moscow';
const adminToken = process.env.ADMIN_TOKEN ?? '';
const trustProxy = process.env.TRUST_PROXY === '1';
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

if (adminToken.length < 24) {
  console.error(
    JSON.stringify({
      level: 'error',
      msg: 'ADMIN_TOKEN_too_short',
      hint: 'Нужен случайный токен не короче 24 символов: openssl rand -base64 32',
    }),
  );
  process.exit(1);
}

const app = createServer({ dbPath, adminToken, allowedOrigins, tz, trustProxy });

app.server.listen(port, host, () => {
  console.log(
    JSON.stringify({
      level: 'info',
      msg: 'listening',
      host,
      port,
      dbPath,
      tz,
      allowedOrigins,
      trustProxy,
    }),
  );
});

let closing = false;
async function shutdown(signal) {
  if (closing) return;
  closing = true;
  console.log(JSON.stringify({ level: 'info', msg: 'shutdown', signal }));
  const timer = setTimeout(() => process.exit(1), 10_000);
  timer.unref();
  await app.close();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

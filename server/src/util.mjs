// Мелкие утилиты сервера: идентификаторы, токены, дни и периоды.
//
// Отдельный модуль без зависимостей, чтобы его можно было проверить
// обычным node --test и переиспользовать в тестах и бэкапе.

import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Короткий публичный идентификатор: не раскрывает порядок создания. */
export function newId(prefix) {
  return `${prefix}_${randomBytes(9).toString('base64url')}`;
}

/** Непрозрачный токен устройства. Хранится только его хеш. */
export function newToken() {
  return randomBytes(32).toString('base64url');
}

export function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

/** Сравнение секретов без утечки длины/времени. */
export function safeEqual(a, b) {
  const left = Buffer.from(sha256(a), 'hex');
  const right = Buffer.from(sha256(b), 'hex');
  return timingSafeEqual(left, right);
}

/**
 * Алфавит без похожих символов (0/O, 1/I/L): код класса диктуют вслух
 * и вводят с телефона, поэтому «O или 0» — это лишняя поддержка.
 */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function newJoinCode(length = 6) {
  let out = '';
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return out;
}

/** «a1b2-c3» → «A1B2C3»: код прощают за пробелы, дефисы и регистр. */
export function normalizeCode(value) {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function isJoinCode(value) {
  return typeof value === 'string' && /^[A-Z0-9]{6}$/.test(value);
}

/** Календарный день YYYY-MM-DD в заданной зоне (по умолчанию — Москва). */
export function dayInTz(ts, tz) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(ts));
  const get = (type) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function isDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

export function addDays(day, delta) {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

/** Понедельник недели, в которую попадает день (неделя Пн–Вс). */
export function weekStart(day) {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - (dow - 1));
  return date.toISOString().slice(0, 10);
}

/**
 * Границы периода для таблицы класса.
 * `week` — текущая неделя (Пн..сегодня), `30d` — последние 30 дней,
 * `all` — весь сезон класса (для итогов в конце четверти).
 */
export function periodRange(kind, now, tz = 'Europe/Moscow') {
  const today = dayInTz(now, tz);
  if (kind === '30d') return { kind, from: addDays(today, -29), to: today };
  if (kind === 'all') return { kind, from: '2000-01-01', to: today };
  return { kind: 'week', from: weekStart(today), to: today };
}

/** День события: клиент присылает свой, но сервер проверяет окно. */
export function clampDay(eventDay, ts, now, tz) {
  const today = dayInTz(now, tz);
  // Ребёнок может быть в Камчатке, сервер — в Москве: разрешаем +1 день.
  const min = addDays(today, -14);
  const max = addDays(today, 1);
  const candidate = isDay(eventDay) ? eventDay : dayInTz(ts, tz);
  if (candidate < min || candidate > max) return null;
  return candidate;
}

/** Текст для логов и ошибок: обрезаем и убираем управляющие символы. */
export function cleanText(value, max = 120) {
  return String(value ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, max);
}

// Пилотный API «СЛОВО 2.0»: классы, звёзды за освоенные слова, таблица класса
// и обезличенная телеметрия.
//
// Сознательные ограничения пилота (почему так — в docs/proposals/backend-social-plan.md):
//  * нет аккаунтов детей и их имён: только псевдоним, аватар и согласие родителя;
//  * сервер не хранит введённый текст ответов — только факт «верно/неверно»;
//  * нет сети на критическом пути: клиент присылает пачку событий, когда может;
//  * одна зависимость рантайма — встроенный node:sqlite; всё остальное из node:*.
//
// Контракт намеренно маленький: 9 маршрутов. Этого достаточно, чтобы
// проверить продуктовую модель на живом классе и потом заменить SQLite
// на PostgreSQL, не переписывая клиент.

import { createServer as createHttpServer } from 'node:http';
import { audit, openDb, runRetention } from './db.mjs';
import {
  addDays,
  clampDay,
  cleanText,
  dayInTz,
  DAY_MS,
  isJoinCode,
  newId,
  newJoinCode,
  newToken,
  normalizeCode,
  periodRange,
  safeEqual,
  sha256,
} from './util.mjs';

/** Версия текста согласия. Меняется, когда меняется формулировка. */
export const CONSENT_VERSION = '2026-10-21';

/** Потолок звёзд в день: 10 освоенных слов. Дальше — тренировка без рейтинга. */
export const STAR_CAP_PER_DAY = 10;

/** Минимум детей в классе, чтобы класс попал в таблицу школы. */
export const MIN_SCHOOL_PARTICIPANTS = 5;

const MAX_BODY_BYTES = 64 * 1024;
const MAX_EVENTS_PER_SYNC = 100;
const MAX_TELEMETRY_PER_BATCH = 200;

/** Аватары те же, что в приложении (src/ui/screens/ProfilesScreen.tsx). */
const AVATARS = ['🦊', '🐱', '🐼', '🦉', '🐸', '🦄', '🐨', '🐯', '🐙', '🦖'];

const TASK_KINDS = new Set(['intro', 'syllables', 'gap', 'build', 'write', 'visual', 'fix']);

/**
 * Белый список событий телеметрии. Всё, чего здесь нет, отбрасывается:
 * так случайный `props.answer` или имя ребёнка не уедет на сервер.
 */
const TELEMETRY_EVENTS = new Set([
  'first_run',
  'app_open',
  'profile_created',
  'lesson_start',
  'lesson_finish',
  'review_finish',
  'task_answer',
  'hint_used',
  'chest_open',
  'shop_buy',
  'pwa_install',
  'update_applied',
  'client_error',
  'sync_failed',
]);

const WORD_RE = /^[\p{L}\p{N}_-]{2,32}$/u;
const NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} ._-]{1,19}$/u;

function httpError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function sendJson(res, status, body, headers = {}) {
  const payload = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    ...headers,
  });
  res.end(payload);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooLarge = false;
    const chunks = [];
    req.on('data', (chunk) => {
      if (tooLarge) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
        chunks.length = 0;
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooLarge) return reject(httpError(413, 'body_too_large', 'Слишком большой запрос'));
      if (size === 0) return resolve({});
      try {
        const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          throw new Error('not an object');
        }
        resolve(value);
      } catch {
        reject(httpError(400, 'bad_json', 'Ожидается JSON-объект'));
      }
    });
    req.on('error', reject);
  });
}

function intInRange(value, min, max, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function bearerToken(req) {
  const header = req.headers.authorization ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(String(header));
  return match ? match[1].trim() : '';
}

function sanitizeNickname(value) {
  const text = cleanText(value, 20);
  if (!NAME_RE.test(text)) return null;
  if (/https?:|www\.|@|\.(ru|com|net)/i.test(text)) return null;
  return text;
}

function sanitizeProps(props) {
  if (!props || typeof props !== 'object' || Array.isArray(props)) return null;
  const out = {};
  let count = 0;
  for (const [key, value] of Object.entries(props)) {
    if (count >= 12) break;
    if (!/^[a-z][a-z0-9_]{0,23}$/.test(key)) continue;
    if (typeof value === 'string') out[key] = cleanText(value, 80);
    else if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
    else if (typeof value === 'boolean') out[key] = value;
    else continue;
    count += 1;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function createServer(options = {}) {
  const dbPath = options.dbPath ?? ':memory:';
  const tz = options.tz ?? 'Europe/Moscow';
  const adminToken = options.adminToken ?? '';
  const allowedOrigins = options.allowedOrigins ?? [];
  // За обратным прокси (DSM, Caddy, Cloudflare Tunnel) remoteAddress — это
  // адрес прокси, и все дети попали бы в один лимит. Доверять заголовку
  // X-Forwarded-For можно только когда прокси действительно наш.
  const trustProxy = options.trustProxy ?? false;
  const now = options.now ?? (() => Date.now());
  const logger = options.logger ?? console;
  const db = openDb(dbPath);

  const buckets = new Map();

  function clientIp(req) {
    if (trustProxy) {
      const forwarded = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim();
      if (forwarded) return forwarded;
      const real = String(req.headers['x-real-ip'] ?? '').trim();
      if (real) return real;
    }
    return req.socket.remoteAddress ?? 'unknown';
  }

  /** Простой fixed-window лимит: защищает от случайного цикла и детского любопытства. */
  function allow(key, limit, windowMs) {
    const stamp = now();
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= stamp) {
      buckets.set(key, { count: 1, resetAt: stamp + windowMs });
      return true;
    }
    bucket.count += 1;
    return bucket.count <= limit;
  }

  const cleanup = setInterval(() => {
    const stamp = now();
    for (const [key, bucket] of buckets) if (bucket.resetAt <= stamp) buckets.delete(key);
  }, 60_000);
  cleanup.unref();

  const retention = setInterval(() => {
    try {
      runRetention(db, now());
    } catch (error) {
      logger.error?.(JSON.stringify({ level: 'error', msg: 'retention_failed', error: String(error) }));
    }
  }, 6 * 60 * 60 * 1000);
  retention.unref();
  runRetention(db, now());

  function requireAdmin(req) {
    if (!adminToken) throw httpError(503, 'admin_disabled', 'ADMIN_TOKEN не задан');
    const provided = String(req.headers['x-admin-token'] ?? '') || bearerToken(req);
    if (!provided || !safeEqual(provided, adminToken)) {
      throw httpError(401, 'admin_required', 'Нужен токен администратора');
    }
  }

  function authChild(req) {
    const token = bearerToken(req);
    if (!token) throw httpError(401, 'token_required', 'Нужен токен устройства');
    const row = db
      .prepare(
        `SELECT id, class_id, nickname, avatar, consent_version, last_seen_at
           FROM children WHERE token_hash = ? AND deleted_at IS NULL`,
      )
      .get(sha256(token));
    if (!row) throw httpError(401, 'token_invalid', 'Токен недействителен');
    // Не пишем в базу на каждый запрос: обновляем «был здесь» раз в минуту.
    if (now() - Number(row.last_seen_at) > 60_000) {
      db.prepare('UPDATE children SET last_seen_at = ? WHERE id = ?').run(now(), row.id);
    }
    return row;
  }

  function classById(id) {
    return db
      .prepare(
        'SELECT id, school_code, school_name, label, code, goal_stars, created_at FROM classes WHERE id = ? AND archived_at IS NULL',
      )
      .get(id);
  }

  function uniqueClassCode() {
    for (let i = 0; i < 50; i++) {
      const code = newJoinCode();
      const exists = db.prepare('SELECT 1 AS x FROM classes WHERE code = ?').get(code);
      if (!exists) return code;
    }
    throw httpError(500, 'code_exhausted', 'Не удалось выдать код класса');
  }

  function defaultNickname(classId) {
    const used = new Set(
      db.prepare('SELECT nickname FROM children WHERE class_id = ?').all(classId).map((r) => r.nickname),
    );
    for (let i = 1; i < 500; i++) {
      const candidate = `Ученик ${i}`;
      if (!used.has(candidate)) return candidate;
    }
    return `Ученик ${Math.floor(Math.random() * 900) + 100}`;
  }

  // ── Роуты ──────────────────────────────────────────────────────────────────

  async function health() {
    db.prepare('SELECT 1 AS ok').get();
    return {
      ok: true,
      service: 'slovo-api',
      time: now(),
      timezone: tz,
      consentVersion: CONSENT_VERSION,
      starCapPerDay: STAR_CAP_PER_DAY,
    };
  }

  async function createClass(req) {
    requireAdmin(req);
    const body = await readJson(req);
    const schoolCode = cleanText(body.schoolCode, 32).toLowerCase();
    const schoolName = body.schoolName ? cleanText(body.schoolName, 60) : null;
    const label = cleanText(body.label, 40);
    if (!/^[a-z0-9][a-z0-9-]{2,31}$/.test(schoolCode)) {
      throw httpError(400, 'bad_school_code', 'schoolCode: 3–32 символа, латиница/цифры/дефис');
    }
    if (label.length < 1) throw httpError(400, 'bad_label', 'Нужно название класса');
    const goalStars = intInRange(body.goalStars ?? 100, 0, 100_000);
    const id = newId('cls');
    const code = uniqueClassCode();
    db.prepare(
      `INSERT INTO classes (id, school_code, school_name, label, code, goal_stars, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, schoolCode, schoolName, label, code, goalStars, now());
    audit(db, 'class_create', `${id} ${schoolCode}/${label}`, now());
    return {
      classId: id,
      code,
      schoolCode,
      schoolName,
      label,
      goalStars,
      consentVersion: CONSENT_VERSION,
    };
  }

  async function rotateCode(req, id) {
    requireAdmin(req);
    const row = classById(id);
    if (!row) throw httpError(404, 'class_not_found', 'Класс не найден');
    const code = uniqueClassCode();
    db.prepare('UPDATE classes SET code = ? WHERE id = ?').run(code, id);
    audit(db, 'class_rotate_code', id, now());
    return { classId: id, code };
  }

  async function listClasses(req) {
    requireAdmin(req);
    const rows = db
      .prepare(
        `SELECT cl.id, cl.school_code, cl.school_name, cl.label, cl.code, cl.goal_stars,
                cl.created_at,
                (SELECT COUNT(*) FROM children c
                  WHERE c.class_id = cl.id AND c.deleted_at IS NULL) AS children
           FROM classes cl
          WHERE cl.archived_at IS NULL
          ORDER BY cl.created_at DESC`,
      )
      .all();
    return { classes: rows };
  }

  async function join(req) {
    const ip = clientIp(req);
    if (!allow(`join:${ip}`, 60, 10 * 60 * 1000)) {
      throw httpError(429, 'too_many_joins', 'Слишком много попыток, попробуйте позже');
    }
    const body = await readJson(req);
    if (body.consent !== true || typeof body.consentVersion !== 'string') {
      throw httpError(400, 'consent_required', 'Нужно согласие родителя на участие в соревновании');
    }
    if (body.consentVersion !== CONSENT_VERSION) {
      throw httpError(409, 'consent_outdated', 'Текст согласия обновился, покажите его родителю ещё раз');
    }
    const code = normalizeCode(body.code);
    if (!isJoinCode(code)) throw httpError(400, 'bad_code', 'Код класса: 6 символов');
    const cls = db
      .prepare(
        'SELECT id, school_code, school_name, label, goal_stars FROM classes WHERE code = ? AND archived_at IS NULL',
      )
      .get(code);
    if (!cls) throw httpError(404, 'class_not_found', 'Класс с таким кодом не найден');

    let nickname = defaultNickname(cls.id);
    if (body.nickname !== undefined && body.nickname !== null && body.nickname !== '') {
      const clean = sanitizeNickname(body.nickname);
      if (!clean) throw httpError(400, 'bad_nickname', 'Псевдоним: 2–20 букв, цифр, пробел, точка, дефис');
      // SQLite COLLATE NOCASE не знает кириллицу, поэтому сравниваем
      // нормализованные строки в JS: детей в классе десятки, не миллионы.
      const key = clean.normalize('NFKC').toLocaleLowerCase('ru');
      const taken = db
        .prepare('SELECT nickname FROM children WHERE class_id = ? AND deleted_at IS NULL')
        .all(cls.id)
        .some((row) => String(row.nickname).normalize('NFKC').toLocaleLowerCase('ru') === key);
      if (taken) {
        throw httpError(409, 'nickname_taken', 'Такой псевдоним уже занят — добавьте цифру или выберите другой');
      }
      nickname = clean;
    }
    const avatar = AVATARS.includes(body.avatar) ? body.avatar : AVATARS[0];
    const token = newToken();
    const id = newId('chd');
    db.prepare(
      `INSERT INTO children
         (id, class_id, nickname, avatar, token_hash, consent_version, consent_at, created_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, cls.id, nickname, avatar, sha256(token), CONSENT_VERSION, now(), now(), now());
    audit(db, 'child_join', cls.id, now());
    return {
      childId: id,
      token,
      nickname,
      avatar,
      class: { id: cls.id, label: cls.label, schoolCode: cls.school_code, schoolName: cls.school_name },
      consentVersion: CONSENT_VERSION,
      time: now(),
    };
  }

  function classBoard(classId, from, to) {
    const rows = db
      .prepare(
        `SELECT c.id, c.nickname, c.avatar, c.created_at,
                COALESCE(SUM(d.stars), 0) AS stars,
                COUNT(DISTINCT CASE WHEN d.lessons > 0 THEN d.day END) AS days
           FROM children c
           LEFT JOIN daily d ON d.child_id = c.id AND d.day BETWEEN ? AND ?
          WHERE c.class_id = ? AND c.deleted_at IS NULL
          GROUP BY c.id
          ORDER BY stars DESC, days DESC, c.created_at ASC, c.id ASC`,
      )
      .all(from, to, classId);

    let place = 0;
    let previous = null;
    return rows.map((row, index) => {
      const stars = Number(row.stars);
      const days = Number(row.days);
      if (!previous || previous.stars !== stars || previous.days !== days) place = index + 1;
      previous = { stars, days };
      return {
        id: row.id,
        place,
        nickname: row.nickname,
        avatar: row.avatar,
        stars,
        days,
      };
    });
  }

  async function board(req) {
    const child = authChild(req);
    const url = new URL(req.url, 'http://localhost');
    const period = periodRange(url.searchParams.get('period') ?? 'week', now(), tz);
    const cls = classById(child.class_id);
    if (!cls) throw httpError(410, 'class_archived', 'Класс закрыт');

    const ranked = classBoard(cls.id, period.from, period.to);
    const meIndex = ranked.findIndex((row) => row.id === child.id);
    const me =
      meIndex >= 0
        ? { place: ranked[meIndex].place, stars: ranked[meIndex].stars, days: ranked[meIndex].days }
        : { place: null, stars: 0, days: 0 };
    // В интерфейсе показываем пьедестал и себя: так у остальных нет
    // публичного «последнего места», а сравнение остаётся возможным.
    const top = ranked.slice(0, 3);
    const publicRow = (row) => ({
      place: row.place,
      nickname: row.nickname,
      avatar: row.avatar,
      stars: row.stars,
      days: row.days,
      ...(row.id === child.id ? { me: true } : {}),
    });
    const entries = top.map(publicRow);
    if (meIndex >= 3) entries.push(publicRow(ranked[meIndex]));
    if (meIndex < 0) {
      entries.push({ place: null, nickname: child.nickname, avatar: child.avatar, stars: 0, days: 0, me: true });
    }

    const teamStars = ranked.reduce((sum, row) => sum + row.stars, 0);

    const classes = db
      .prepare(
        `SELECT cl.id, cl.label,
                COALESCE(SUM(d.stars), 0) AS stars,
                COUNT(DISTINCT d.child_id) AS active,
                COUNT(DISTINCT c.id) AS children
           FROM classes cl
           LEFT JOIN children c ON c.class_id = cl.id AND c.deleted_at IS NULL
           LEFT JOIN daily d ON d.child_id = c.id AND d.day BETWEEN ? AND ?
          WHERE cl.school_code = ? AND cl.archived_at IS NULL
          GROUP BY cl.id`,
      )
      .all(period.from, period.to, cls.school_code)
      .filter((row) => Number(row.active) >= MIN_SCHOOL_PARTICIPANTS)
      .map((row) => {
        const active = Number(row.active);
        const stars = Number(row.stars);
        return {
          label: row.label,
          stars,
          active,
          children: Number(row.children),
          starsPerChild: Math.round((stars / Math.max(1, active)) * 10) / 10,
        };
      })
      .sort((a, b) => b.starsPerChild - a.starsPerChild || b.stars - a.stars);

    return {
      metric: 'stars',
      period: { kind: period.kind, from: period.from, to: period.to, timezone: tz },
      capPerDay: STAR_CAP_PER_DAY,
      class: {
        id: cls.id,
        label: cls.label,
        school: { code: cls.school_code, name: cls.school_name },
        total: ranked.length,
        entries,
        me: { ...me, nickname: child.nickname, avatar: child.avatar },
        team: { stars: teamStars, goal: Number(cls.goal_stars), reached: teamStars >= Number(cls.goal_stars) },
      },
      school: {
        name: cls.school_name,
        minParticipants: MIN_SCHOOL_PARTICIPANTS,
        classes,
      },
      serverTime: now(),
    };
  }

  function upsertDaily(childId, day, patch, stamp) {
    db.prepare(
      `INSERT INTO daily (child_id, day, lessons, tasks, correct, wrong, active_seconds, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (child_id, day) DO UPDATE SET
         lessons = lessons + excluded.lessons,
         tasks = tasks + excluded.tasks,
         correct = correct + excluded.correct,
         wrong = wrong + excluded.wrong,
         active_seconds = active_seconds + excluded.active_seconds,
         updated_at = excluded.updated_at`,
    ).run(
      childId,
      day,
      patch.lessons ?? 0,
      patch.tasks ?? 0,
      patch.correct ?? 0,
      patch.wrong ?? 0,
      patch.activeSeconds ?? 0,
      stamp,
    );
  }

  function recomputeStars(childId, day, stamp) {
    db.prepare(
      `INSERT INTO daily (child_id, day, stars, updated_at)
       VALUES (?, ?, MIN(?, (SELECT COUNT(*) FROM mastered WHERE child_id = ? AND day = ?)), ?)
       ON CONFLICT (child_id, day) DO UPDATE SET
         stars = MIN(?, (SELECT COUNT(*) FROM mastered WHERE child_id = ? AND day = ?)),
         updated_at = excluded.updated_at`,
    ).run(
      childId,
      day,
      STAR_CAP_PER_DAY,
      childId,
      day,
      stamp,
      STAR_CAP_PER_DAY,
      childId,
      day,
    );
  }

  function handleEvent(child, event, stamp) {
    const id = typeof event.id === 'string' ? event.id.slice(0, 64) : '';
    if (id.length < 8) return { ok: false, reason: 'bad_event_id' };

    const rawTs = Number(event.at);
    const ts = Number.isFinite(rawTs) ? rawTs : stamp;
    if (ts > stamp + 5 * 60_000 || ts < stamp - 14 * DAY_MS) {
      return { ok: false, reason: 'timestamp_out_of_range' };
    }
    const day = clampDay(event.day, ts, stamp, tz);
    if (!day) return { ok: false, reason: 'day_out_of_range' };

    const duplicate = db
      .prepare('SELECT 1 AS x FROM seen_events WHERE child_id = ? AND id = ?')
      .get(child.id, id);
    if (duplicate) return { ok: false, reason: 'duplicate' };

    // Сначала проверяем событие целиком, и только потом отмечаем его
    // принятым: иначе отклонённое событие нельзя было бы повторить.
    let apply;
    switch (event.type) {
      case 'lesson': {
        const tasks = intInRange(event.tasks, 0, 60);
        if (tasks < 1) return { ok: false, reason: 'bad_lesson' };
        const correct = Math.min(intInRange(event.correct, 0, 60), tasks);
        const wrong = Math.min(intInRange(event.wrong, 0, 60), tasks);
        const activeSeconds = intInRange(event.activeSeconds, 0, 3600);
        apply = () => upsertDaily(child.id, day, { lessons: 1, tasks, correct, wrong, activeSeconds }, stamp);
        break;
      }
      case 'mastered': {
        const wordId = cleanText(event.wordId, 32);
        if (!WORD_RE.test(wordId)) return { ok: false, reason: 'bad_word' };
        apply = () => {
          db.prepare(
            'INSERT OR IGNORE INTO mastered (child_id, day, word_id, at) VALUES (?, ?, ?, ?)',
          ).run(child.id, day, wordId, ts);
          upsertDaily(child.id, day, {}, stamp);
          recomputeStars(child.id, day, stamp);
        };
        break;
      }
      case 'active': {
        apply = () => upsertDaily(child.id, day, {}, stamp);
        break;
      }
      case 'answer': {
        const wordId = cleanText(event.wordId, 32);
        if (!WORD_RE.test(wordId)) return { ok: false, reason: 'bad_word' };
        const kind = TASK_KINDS.has(event.kind) ? event.kind : 'other';
        apply = () =>
          db.prepare(
            `INSERT OR IGNORE INTO answers (id, child_id, ts, day, word_id, kind, correct, hint, ms)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).run(
            `${child.id}:${id}`,
            child.id,
            ts,
            day,
            wordId,
            kind,
            event.correct ? 1 : 0,
            event.hint ? 1 : 0,
            Number.isFinite(Number(event.ms)) ? intInRange(event.ms, 0, 600_000) : null,
          );
        break;
      }
      default:
        return { ok: false, reason: 'unknown_type' };
    }

    db.prepare('INSERT INTO seen_events (child_id, id, at) VALUES (?, ?, ?)').run(child.id, id, stamp);
    apply();
    return { ok: true };
  }

  async function sync(req) {
    const child = authChild(req);
    if (!allow(`sync:${child.id}`, 240, 60_000)) {
      throw httpError(429, 'too_many_syncs', 'Слишком часто; попробуйте через минуту');
    }
    const body = await readJson(req);
    if (!Array.isArray(body.events) || body.events.length === 0) {
      throw httpError(400, 'no_events', 'Нужен непустой массив events');
    }
    if (body.events.length > MAX_EVENTS_PER_SYNC) {
      throw httpError(400, 'too_many_events', `Не больше ${MAX_EVENTS_PER_SYNC} событий за раз`);
    }
    const stamp = now();
    let accepted = 0;
    let duplicates = 0;
    const rejected = [];
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const event of body.events) {
        if (!event || typeof event !== 'object') {
          rejected.push({ id: null, reason: 'bad_event' });
          continue;
        }
        const result = handleEvent(child, event, stamp);
        if (result.ok) accepted += 1;
        else if (result.reason === 'duplicate') duplicates += 1;
        else rejected.push({ id: typeof event.id === 'string' ? event.id.slice(0, 64) : null, reason: result.reason });
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }

    const period = periodRange('week', stamp, tz);
    const ranked = classBoard(child.class_id, period.from, period.to);
    const meIndex = ranked.findIndex((row) => row.id === child.id);
    const me =
      meIndex >= 0
        ? { place: ranked[meIndex].place, stars: ranked[meIndex].stars, days: ranked[meIndex].days }
        : { place: null, stars: 0, days: 0 };
    return {
      accepted,
      duplicates,
      rejected,
      week: { from: period.from, to: period.to },
      me,
      capPerDay: STAR_CAP_PER_DAY,
      serverTime: stamp,
    };
  }

  async function deleteMe(req) {
    const child = authChild(req);
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('DELETE FROM answers WHERE child_id = ?').run(child.id);
      db.prepare('DELETE FROM seen_events WHERE child_id = ?').run(child.id);
      db.prepare('DELETE FROM children WHERE id = ?').run(child.id);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    audit(db, 'child_delete', sha256(child.id).slice(0, 12), now());
    return null;
  }

  async function telemetry(req) {
    const ip = clientIp(req);
    if (!allow(`tel-ip:${ip}`, 600, 60_000)) {
      throw httpError(429, 'too_many_requests', 'Слишком много запросов');
    }
    const body = await readJson(req);
    const installId = cleanText(body.installId, 64);
    if (!/^[A-Za-z0-9-]{8,64}$/.test(installId)) {
      throw httpError(400, 'bad_install_id', 'installId: 8–64 символа, латиница/цифры/дефис');
    }
    if (!allow(`tel:${installId}`, 60, 60_000)) {
      throw httpError(429, 'too_many_requests', 'Слишком много запросов');
    }
    const events = Array.isArray(body.events) ? body.events.slice(0, MAX_TELEMETRY_PER_BATCH) : [];
    if (events.length === 0) throw httpError(400, 'no_events', 'Нужен непустой массив events');
    const version = body.appVersion ? cleanText(body.appVersion, 24) : null;
    const stamp = now();
    let accepted = 0;
    let rejected = 0;
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const event of events) {
        if (!event || typeof event !== 'object' || !TELEMETRY_EVENTS.has(event.name)) {
          rejected += 1;
          continue;
        }
        const rawTs = Number(event.at);
        const at = Number.isFinite(rawTs) ? Math.min(stamp + 5 * 60_000, Math.max(stamp - 14 * DAY_MS, rawTs)) : stamp;
        const id = typeof event.id === 'string' && event.id.length >= 8 ? event.id.slice(0, 64) : newId('tel');
        const day = dayInTz(at, tz);
        const props = sanitizeProps(event.props);
        const result = db
          .prepare(
            `INSERT OR IGNORE INTO telemetry (id, install_id, at, day, app_version, name, props)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(id, installId, at, day, version, event.name, props ? JSON.stringify(props) : null);
        if (result.changes > 0) accepted += 1;
        else rejected += 1;
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    return { accepted, rejected };
  }

  async function metrics(req) {
    requireAdmin(req);
    const url = new URL(req.url, 'http://localhost');
    const days = intInRange(url.searchParams.get('days') ?? 30, 1, 90);
    const to = dayInTz(now(), tz);
    const from = addDays(to, -(days - 1));

    const dau = db
      .prepare(
        `SELECT day, COUNT(DISTINCT install_id) AS installs
           FROM telemetry WHERE day BETWEEN ? AND ?
          GROUP BY day ORDER BY day`,
      )
      .all(from, to);
    const eventsByName = db
      .prepare(
        `SELECT name, COUNT(*) AS total FROM telemetry
          WHERE day BETWEEN ? AND ? GROUP BY name ORDER BY total DESC`,
      )
      .all(from, to);
    const versions = db
      .prepare(
        `SELECT app_version AS version, COUNT(DISTINCT install_id) AS installs
           FROM telemetry WHERE day BETWEEN ? AND ? AND app_version IS NOT NULL
          GROUP BY app_version ORDER BY installs DESC LIMIT 10`,
      )
      .all(from, to);
    const installs = db
      .prepare('SELECT COUNT(DISTINCT install_id) AS total FROM telemetry WHERE day BETWEEN ? AND ?')
      .get(from, to);
    const answers = db
      .prepare(
        `SELECT COUNT(*) AS total, COALESCE(SUM(correct), 0) AS correct,
                COALESCE(SUM(hint), 0) AS hints
           FROM answers WHERE day BETWEEN ? AND ?`,
      )
      .get(from, to);
    const kinds = db
      .prepare(
        `SELECT kind, COUNT(*) AS total, COALESCE(SUM(correct), 0) AS correct
           FROM answers WHERE day BETWEEN ? AND ? GROUP BY kind ORDER BY total DESC`,
      )
      .all(from, to);
    const hardWords = db
      .prepare(
        `SELECT word_id, COUNT(*) AS total,
                SUM(CASE WHEN correct = 0 THEN 1 ELSE 0 END) AS wrong
           FROM answers WHERE day BETWEEN ? AND ?
          GROUP BY word_id HAVING total >= 5
          ORDER BY (1.0 * wrong / total) DESC, wrong DESC LIMIT 12`,
      )
      .all(from, to);
    const lessons = db
      .prepare('SELECT COALESCE(SUM(lessons), 0) AS total FROM daily WHERE day BETWEEN ? AND ?')
      .get(from, to);
    const classes = db
      .prepare('SELECT COUNT(*) AS total FROM classes WHERE archived_at IS NULL')
      .get();
    const schools = db
      .prepare('SELECT COUNT(DISTINCT school_code) AS total FROM classes WHERE archived_at IS NULL')
      .get();
    const children = db
      .prepare('SELECT COUNT(*) AS total FROM children WHERE deleted_at IS NULL')
      .get();

    const total = Number(answers.total);
    return {
      range: { from, to, days, timezone: tz },
      installs: Number(installs.total),
      dau,
      versions,
      events: eventsByName,
      lessons: Number(lessons.total),
      children: Number(children.total),
      classes: Number(classes.total),
      schools: Number(schools.total),
      answers: {
        total,
        correct: Number(answers.correct),
        hints: Number(answers.hints),
        accuracy: total > 0 ? Math.round((Number(answers.correct) / total) * 1000) / 1000 : null,
        hintRate: total > 0 ? Math.round((Number(answers.hints) / total) * 1000) / 1000 : null,
        byKind: kinds.map((row) => ({
          kind: row.kind,
          total: Number(row.total),
          accuracy: Number(row.total) > 0 ? Math.round((Number(row.correct) / Number(row.total)) * 1000) / 1000 : null,
        })),
        hardWords: hardWords.map((row) => ({
          wordId: row.word_id,
          total: Number(row.total),
          errorRate: Math.round((Number(row.wrong) / Number(row.total)) * 1000) / 1000,
        })),
      },
      generatedAt: now(),
    };
  }

  // ── Маршрутизация ─────────────────────────────────────────────────────────

  async function route(req, res) {
    const method = req.method ?? 'GET';
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (method === 'GET' && path === '/healthz') return sendJson(res, 200, await health());

    if (method === 'POST' && path === '/v1/admin/classes') {
      return sendJson(res, 201, await createClass(req));
    }
    if (method === 'GET' && path === '/v1/admin/classes') {
      return sendJson(res, 200, await listClasses(req));
    }
    const rotate = /^\/v1\/admin\/classes\/([A-Za-z0-9_-]+)\/rotate-code$/.exec(path);
    if (method === 'POST' && rotate) {
      return sendJson(res, 200, await rotateCode(req, rotate[1]));
    }

    if (method === 'POST' && path === '/v1/join') return sendJson(res, 201, await join(req));
    if (method === 'GET' && path === '/v1/board') return sendJson(res, 200, await board(req));
    if (method === 'POST' && path === '/v1/sync') return sendJson(res, 200, await sync(req));
    if (method === 'DELETE' && path === '/v1/me') {
      await deleteMe(req);
      return sendJson(res, 204, undefined);
    }

    if (method === 'POST' && path === '/v1/telemetry') return sendJson(res, 202, await telemetry(req));
    if (method === 'GET' && path === '/v1/admin/metrics') return sendJson(res, 200, await metrics(req));

    throw httpError(404, 'not_found', 'Нет такого маршрута');
  }

  const server = createHttpServer(async (req, res) => {
    const started = Date.now();
    const method = req.method ?? 'GET';
    const path = (req.url ?? '/').split('?')[0];

    const origin = req.headers.origin;
    if (origin && (allowedOrigins.includes('*') || allowedOrigins.includes(origin))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token');
    res.setHeader('Access-Control-Max-Age', '600');

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    let status = 500;
    try {
      await route(req, res);
      status = res.statusCode;
    } catch (error) {
      const statusCode = Number(error?.status) || 500;
      status = statusCode;
      if (statusCode >= 500) {
        logger.error?.(JSON.stringify({ level: 'error', msg: 'request_failed', path, error: String(error?.stack ?? error) }));
        sendJson(res, 500, { error: { code: 'internal', message: 'Внутренняя ошибка' } });
      } else {
        sendJson(res, statusCode, {
          error: { code: error.code ?? 'error', message: error.message ?? 'Ошибка запроса' },
        });
      }
    } finally {
      logger.log?.(
        JSON.stringify({ level: 'info', method, path, status, ms: Date.now() - started }),
      );
    }
  });

  return {
    server,
    db,
    close() {
      clearInterval(cleanup);
      clearInterval(retention);
      return new Promise((resolve) => server.close(() => {
        try {
          db.close();
        } catch {
          /* база уже закрыта */
        }
        resolve();
      }));
    },
  };
}

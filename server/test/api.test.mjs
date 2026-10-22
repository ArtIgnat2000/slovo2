// Контрактные тесты пилотного API.
//
// Проверяют не «роут отвечает 200», а продуктовые инварианты:
// потолок звёзд, идемпотентность повторной отправки, приватность
// (в таблицу не попадают имена), согласие, удаление данных и то,
// что маленький класс не выигрывает у большого за счёт размера.

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { createServer, CONSENT_VERSION, STAR_CAP_PER_DAY } from '../src/app.mjs';
import { openDb, runRetention } from '../src/db.mjs';
import { runBackup } from '../scripts/backup.mjs';
import { dayInTz } from '../src/util.mjs';

const ADMIN = 'test-admin-token-01234567890123456789';
const TZ = 'Europe/Moscow';
const today = () => dayInTz(Date.now(), TZ);

let app;
let base;
let sequence = 0;

before(async () => {
  app = createServer({
    dbPath: ':memory:',
    adminToken: ADMIN,
    allowedOrigins: ['http://localhost:5173'],
    tz: TZ,
    logger: { log() {}, error() {} },
  });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${app.server.address().port}`;
});

after(async () => {
  await app.close();
});

async function call(method, path, { body, token, admin, origin } = {}) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  if (admin) headers['x-admin-token'] = ADMIN;
  if (origin) headers.origin = origin;
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
    headers: response.headers,
  };
}

let classCounter = 0;
async function makeClass({ schoolCode = 'school-42', label, goalStars } = {}) {
  classCounter += 1;
  const response = await call('POST', '/v1/admin/classes', {
    admin: true,
    body: { schoolCode, label: label ?? `${classCounter} «А»`, goalStars },
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  return response.body;
}

async function joinChild(code, nickname) {
  const response = await call('POST', '/v1/join', {
    body: { code, consent: true, consentVersion: CONSENT_VERSION, nickname },
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  return response.body;
}

function event(type, payload = {}) {
  sequence += 1;
  return {
    id: `evt-${String(sequence).padStart(6, '0')}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    at: Date.now(),
    day: today(),
    ...payload,
  };
}

async function sync(token, events) {
  const response = await call('POST', '/v1/sync', { token, body: { events } });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response.body;
}

test('health: сервер отвечает и объявляет правила', async () => {
  const response = await call('GET', '/healthz');
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.starCapPerDay, STAR_CAP_PER_DAY);
  assert.equal(response.body.consentVersion, CONSENT_VERSION);
});

test('класс создаёт только администратор, код читаемый', async () => {
  const denied = await call('POST', '/v1/admin/classes', {
    body: { schoolCode: 'school-1', label: '2 «А»' },
  });
  assert.equal(denied.status, 401);
  assert.equal(denied.body.error.code, 'admin_required');

  const created = await makeClass({ label: '2 «А»', goalStars: 50 });
  assert.match(created.code, /^[A-Z2-9]{6}$/);
  assert.equal(created.goalStars, 50);
  assert.equal(created.consentVersion, CONSENT_VERSION);
  assert.equal(created.schoolCode, 'school-42');

  const list = await call('GET', '/v1/admin/classes', { admin: true });
  assert.equal(list.status, 200);
  assert.ok(list.body.classes.some((row) => row.id === created.classId));
});

test('вход в класс: согласие, код, псевдоним и аватар', async () => {
  const cls = await makeClass();

  const noConsent = await call('POST', '/v1/join', {
    body: { code: cls.code, consentVersion: CONSENT_VERSION },
  });
  assert.equal(noConsent.status, 400);
  assert.equal(noConsent.body.error.code, 'consent_required');

  const outdated = await call('POST', '/v1/join', {
    body: { code: cls.code, consent: true, consentVersion: '2020-01-01' },
  });
  assert.equal(outdated.status, 409);

  const wrongCode = await call('POST', '/v1/join', {
    body: { code: 'ZZZZZZ', consent: true, consentVersion: CONSENT_VERSION },
  });
  assert.equal(wrongCode.status, 404);

  const badNickname = await call('POST', '/v1/join', {
    body: {
      code: cls.code,
      consent: true,
      consentVersion: CONSENT_VERSION,
      nickname: 'зайди на https://example.com',
    },
  });
  assert.equal(badNickname.status, 400);

  const child = await joinChild(cls.code.toLowerCase(), 'Звёздочка');
  assert.equal(child.nickname, 'Звёздочка');
  assert.equal(child.avatar, '🦊');
  assert.equal(child.consentVersion, CONSENT_VERSION);
  assert.ok(child.token.length >= 32);
  assert.equal(child.class.id, cls.classId);

  // Псевдонимы в классе не повторяются: иначе таблица нечитаема.
  const duplicate = await call('POST', '/v1/join', {
    body: { code: cls.code, consent: true, consentVersion: CONSENT_VERSION, nickname: 'звёздочка' },
  });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.error.code, 'nickname_taken');

  const defaulted = await joinChild(cls.code);
  assert.match(defaulted.nickname, /^Ученик \d+$/);
});

test('звёзды: потолок в день, повторная отправка не накручивает', async () => {
  const cls = await makeClass();
  const first = await joinChild(cls.code);
  const second = await joinChild(cls.code);

  const words = Array.from({ length: 12 }, (_, i) => `g2_слово${i + 1}`);
  const batch = [
    ...words.map((wordId) => event('mastered', { wordId })),
    event('lesson', { tasks: 12, correct: 11, wrong: 1, activeSeconds: 240 }),
  ];
  const result = await sync(first.token, batch);
  assert.equal(result.accepted, 13);
  assert.equal(result.rejected.length, 0);
  // 12 освоенных слов, но в рейтинг идут только 10.
  assert.equal(result.me.stars, STAR_CAP_PER_DAY);

  const replay = await sync(first.token, batch);
  assert.equal(replay.accepted, 0);
  assert.equal(replay.duplicates, 13);
  assert.equal(replay.me.stars, STAR_CAP_PER_DAY);

  // Событие «из будущего» не принимается: часы можно перевести.
  const future = event('mastered', { wordId: 'g2_будущее', at: Date.now() + 60 * 60_000 });
  const futureResult = await sync(first.token, [future]);
  assert.equal(futureResult.rejected[0].reason, 'timestamp_out_of_range');

  await sync(second.token, words.slice(0, 4).map((wordId) => event('mastered', { wordId })));
  const board = await call('GET', '/v1/board', { token: second.token });
  assert.equal(board.status, 200);
  assert.equal(board.body.class.total, 2);
  assert.equal(board.body.class.me.place, 2);
  assert.equal(board.body.class.me.stars, 4);
  assert.equal(board.body.class.team.stars, STAR_CAP_PER_DAY + 4);
  assert.equal(board.body.class.entries.find((row) => row.me).nickname, second.nickname);
  assert.equal(board.body.metric, 'stars');
  assert.equal(board.body.period.kind, 'week');
});

test('таблица школы сравнивает среднее, а не сумму: маленький класс не выигрывает', async () => {
  const big = await makeClass({ label: '2 «Б»' });
  const small = await makeClass({ label: '2 «В»' });

  for (let i = 0; i < 6; i++) {
    const child = await joinChild(big.code);
    const words = Array.from({ length: 2 }, (_, n) => `g2_б${i}_${n}`);
    await sync(child.token, words.map((wordId) => event('mastered', { wordId })));
  }

  const four = [];
  for (let i = 0; i < 4; i++) four.push(await joinChild(small.code));
  for (const child of four) {
    await sync(child.token, ['g2_мал1', 'g2_мал2', 'g2_мал3'].map((wordId) => event('mastered', { wordId })));
  }

  const excluded = await call('GET', '/v1/board', { token: four[0].token });
  assert.equal(excluded.body.school.classes.length, 1);
  assert.equal(excluded.body.school.classes[0].label, '2 «Б»');
  assert.equal(excluded.body.school.minParticipants, 5);

  const fifth = await joinChild(small.code);
  await sync(fifth.token, ['g2_мал4', 'g2_мал5', 'g2_мал6'].map((wordId) => event('mastered', { wordId })));

  const included = await call('GET', '/v1/board', { token: fifth.token });
  assert.equal(included.body.school.classes.length, 2);
  const smallRow = included.body.school.classes.find((row) => row.label === '2 «В»');
  assert.equal(smallRow.active, 5);
  assert.equal(smallRow.stars, 15);
  assert.equal(smallRow.starsPerChild, 3);
  // 15/5 = 3.0 против 12/6 = 2.0: победил класс, где активнее каждый.
  assert.equal(included.body.school.classes[0].label, '2 «В»');
});

test('телеметрия: белый список событий, очистка свойств, агрегаты', async () => {
  const installId = '11111111-2222-4333-8444-555555555555';

  const sent = await call('POST', '/v1/telemetry', {
    body: {
      installId,
      appVersion: '0.26.1',
      events: [
        { id: 'tel-event-0001', name: 'app_open', at: Date.now(), props: { screen: 'home' } },
        { id: 'tel-event-0002', name: 'lesson_finish', at: Date.now(), props: { tasks: 12, pct: 92 } },
        {
          id: 'tel-event-0003',
          name: 'client_error',
          props: { code: 'render', http: 500, secret: { nested: true }, 'bad-key': 'x' },
        },
        // имя события вне белого списка — отбрасывается
        { id: 'tel-event-0004', name: 'answer', props: { word: 'Москва' } },
        // повтор id — не учитывается второй раз
        { id: 'tel-event-0001', name: 'app_open' },
      ],
    },
  });
  assert.equal(sent.status, 202);
  assert.equal(sent.body.accepted, 3);
  assert.equal(sent.body.rejected, 2);

  const metrics = await call('GET', '/v1/admin/metrics?days=7', { admin: true });
  assert.equal(metrics.status, 200);
  assert.ok(metrics.body.installs >= 1);
  const open = metrics.body.events.find((row) => row.name === 'app_open');
  assert.equal(open.total, 1);
  assert.ok(metrics.body.versions.some((row) => row.version === '0.26.1'));
  assert.ok(metrics.body.children >= 1);
  assert.ok(metrics.body.classes >= 1);
});

test('ответы: разбор ошибок по словам и видам заданий', async () => {
  const cls = await makeClass({ label: '3 «А»' });
  const child = await joinChild(cls.code);
  const answers = [
    { correct: false, hint: true },
    { correct: false, hint: false },
    { correct: false, hint: false },
    { correct: false, hint: true },
    { correct: true, hint: false },
  ];
  const events = answers.map(({ correct, hint }) =>
    event('answer', { wordId: 'g2_Москва', kind: 'write', correct, hint, ms: 1500 }),
  );
  events.push(event('answer', { wordId: 'g2_Родина', kind: 'gap', correct: true, hint: false }));
  const result = await sync(child.token, events);
  assert.equal(result.accepted, 6);

  const metrics = await call('GET', '/v1/admin/metrics?days=7', { admin: true });
  assert.ok(metrics.body.answers.total >= 6);
  const moscow = metrics.body.answers.hardWords.find((row) => row.wordId === 'g2_Москва');
  assert.ok(moscow, JSON.stringify(metrics.body.answers.hardWords));
  assert.equal(moscow.total, 5);
  assert.equal(moscow.errorRate, 0.8);
  const write = metrics.body.answers.byKind.find((row) => row.kind === 'write');
  assert.equal(write.total, 5);
  assert.equal(write.accuracy, 0.2);
  assert.ok(metrics.body.answers.hintRate > 0);
});

test('удаление: ребёнок исчезает из таблицы, токен больше не работает', async () => {
  const cls = await makeClass({ label: '4 «А»' });
  const child = await joinChild(cls.code);
  await sync(child.token, [event('mastered', { wordId: 'g2_яблоко' })]);

  const beforeDelete = await call('GET', '/v1/board', { token: child.token });
  assert.equal(beforeDelete.body.class.total, 1);

  const removed = await call('DELETE', '/v1/me', { token: child.token });
  assert.equal(removed.status, 204);

  const afterDelete = await call('GET', '/v1/board', { token: child.token });
  assert.equal(afterDelete.status, 401);
  assert.equal(afterDelete.body.error.code, 'token_invalid');

  // Удаление не оставляет «хвостов»: ни ответов, ни звёзд, ни дедупликации.
  for (const table of ['answers', 'daily', 'mastered', 'seen_events']) {
    const row = app.db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE child_id = ?`).get(child.childId);
    assert.equal(Number(row.n), 0, `${table} не очищен`);
  }

  const admin = await call('GET', '/v1/admin/classes', { admin: true });
  const row = admin.body.classes.find((item) => item.id === cls.classId);
  assert.equal(row.children, 0);
});

test('CORS: превью и локальная разработка разрешены, чужой origin — нет', async () => {
  const allowed = await call('OPTIONS', '/v1/board', { origin: 'http://localhost:5173' });
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5173');

  const foreign = await call('OPTIONS', '/v1/board', { origin: 'https://evil.example' });
  assert.equal(foreign.status, 204);
  assert.equal(foreign.headers.get('access-control-allow-origin'), null);
});

test('ошибки: без токена 401, неизвестный маршрут 404', async () => {
  const noToken = await call('GET', '/v1/board');
  assert.equal(noToken.status, 401);
  const missing = await call('GET', '/v1/nothing');
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error.code, 'not_found');
});

test('ретенция удаляет сырые события, но не результаты', () => {
  const db = openDb(':memory:');
  const stamp = Date.now();
  const old = stamp - 200 * 24 * 60 * 60 * 1000;
  const recentDay = new Date(stamp - 100 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const ancientDay = new Date(stamp - 500 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  db.prepare(
    `INSERT INTO classes (id, school_code, label, code, goal_stars, created_at)
     VALUES ('cls_x', 's', 'к', 'AAAAAA', 10, ?)`,
  ).run(stamp);
  db.prepare(
    `INSERT INTO children (id, class_id, nickname, avatar, token_hash, consent_version, consent_at, created_at, last_seen_at)
     VALUES ('chd_x', 'cls_x', 'Ученик 1', '🦊', 'hash', 'v', ?, ?, ?)`,
  ).run(old, old, old);
  db.prepare('INSERT INTO daily (child_id, day, stars, updated_at) VALUES (?, ?, ?, ?)').run(
    'chd_x',
    recentDay,
    3,
    old,
  );
  db.prepare(
    'INSERT INTO daily (child_id, day, stars, updated_at) VALUES (?, ?, ?, ?)',
  ).run('chd_x', ancientDay, 4, old);
  db.prepare(
    'INSERT INTO mastered (child_id, day, word_id, at) VALUES (?, ?, ?, ?)',
  ).run('chd_x', ancientDay, 'g2_старое', old);
  db.prepare(
    'INSERT INTO answers (id, child_id, ts, day, word_id, kind, correct, hint, ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).run('a1', 'chd_x', old, '2025-01-01', 'g2_слово', 'write', 0, 0, 100);
  db.prepare(
    'INSERT INTO telemetry (id, install_id, at, day, name) VALUES (?, ?, ?, ?, ?)',
  ).run('t1', 'install-1234', old, '2025-01-01', 'app_open');

  const removed = runRetention(db, stamp);
  assert.equal(removed.answers, 1);
  assert.equal(removed.telemetry, 1);
  // Результат за последние 400 дней остаётся, древний — удаляется.
  assert.equal(removed.daily, 1);
  assert.equal(removed.mastered, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM daily').get().n, 1);
  db.close();
});

test('бэкап: копия читается как база, лишние файлы удаляются', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'slovo-backup-'));
  try {
    const dbPath = join(dir, 'slovo.db');
    const db = openDb(dbPath);
    db.prepare(
      `INSERT INTO classes (id, school_code, label, code, goal_stars, created_at)
       VALUES ('cls_b', 's', 'к', 'BBBBBB', 10, ?)`,
    ).run(Date.now());
    db.close();

    const result = await runBackup({ dbPath, backupDir: join(dir, 'backups'), keep: 2 });
    const copy = openDb(result.file);
    assert.equal(copy.prepare('SELECT COUNT(*) AS n FROM classes').get().n, 1);
    copy.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

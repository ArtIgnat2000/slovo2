// Сейф прогресса: чистые правила из src/engine/vault.ts.
//
// Появились после аудита «у ребёнка пропал весь прогресс»
// (docs/progress-loss-audit.md). Проверяем главным образом то, что решает,
// выживут данные или нет: когда снимать копию, как не потерять удалённый
// профиль и как не зациклиться на сбое записи.
import assert from 'node:assert/strict';
import {
  LOG_MAX,
  SNAPSHOT_SLOTS,
  TRASH_MAX,
  addTrash,
  agoLabel,
  emptyVault,
  isDestructive,
  nextSlot,
  normalizeVault,
  pluralRu,
  purgeTrash,
  pushLog,
  pushLogDedup,
  readRecord,
  snapshotDecision,
  snapshotMetaOf,
  upsertSnapshot,
  type Profile,
  type SnapshotMeta,
} from '../src/engine/vault';

const profile = (id: string, xp: number, words = 0): Profile =>
  ({ id, name: id, avatar: '🦊', createdAt: 0, xp, gems: 0, streak: 0, lastDay: '', freezes: 0,
     words: Object.fromEntries(Array.from({ length: words }, (_, i) => [`w${i}`, { s: 50, due: 0, iv: 1, n: 1, seen: 0, ok: 1, wrong: 0 }])),
     lessons: {}, errors: {}, days: {}, achievements: [] } as unknown as Profile);

const record = (profiles: Profile[]) => JSON.stringify({ state: { profiles }, version: 1 });

// 1) разбор записи: целая, «пустая» и битая
assert.deepEqual(readRecord(null), null);
assert.deepEqual(readRecord('{"state":{"profiles":[{"id":"p_1","na'), null, 'битая запись не должна ронять разбор');
assert.deepEqual(readRecord(record([]))?.count, 0);
const twoProfiles = readRecord(record([profile('a', 100, 3), profile('b', 250, 4)]));
assert.deepEqual(
  { count: twoProfiles?.count, xp: twoProfiles?.xp, words: twoProfiles?.words },
  { count: 2, xp: 350, words: 7 },
);

// 2) «разрушительная» запись: стало меньше профилей, XP или слов
assert.equal(isDestructive(readRecord(record([profile('a', 100)]))!, readRecord(record([]))!), true);
assert.equal(isDestructive(readRecord(record([profile('a', 100)]))!, readRecord(record([profile('a', 90)]))!), true);
assert.equal(isDestructive(readRecord(record([profile('a', 100, 4)]))!, readRecord(record([profile('a', 100, 3)]))!), true);
assert.equal(isDestructive(readRecord(record([profile('a', 100)]))!, readRecord(record([profile('a', 150)]))!), false);
assert.equal(isDestructive(readRecord(record([profile('a', 100)]))!, readRecord(record([profile('a', 100), profile('b', 0)]))!), false);

// 3) слоты: сначала свободные, потом — самый старый
const snaps = (...list: SnapshotMeta[]): SnapshotMeta[] => list;
assert.equal(nextSlot([]), 1);
assert.equal(nextSlot(snaps({ slot: 1, at: 10, bytes: 1, profiles: 1, xp: 1, names: [] })), 2);
assert.equal(
  nextSlot(
    snaps(
      { slot: 1, at: 50, bytes: 1, profiles: 1, xp: 1, names: [] },
      { slot: 2, at: 10, bytes: 1, profiles: 1, xp: 1, names: [] },
      { slot: 3, at: 30, bytes: 1, profiles: 1, xp: 1, names: [] },
    ),
  ),
  2,
  'кольцо: перезаписывается самая старая копия',
);

// 4) решение о копии
const one = record([profile('a', 100)]);
const none = record([]);
assert.equal(snapshotDecision({ prev: null, next: one, snapshots: [], lastAt: null, now: 0 }).needed, false);
assert.equal(snapshotDecision({ prev: one, next: one, snapshots: [], lastAt: null, now: 0 }).needed, false);
assert.equal(
  snapshotDecision({ prev: one, next: none, snapshots: [], lastAt: 0, now: 1_000 }).reason,
  'destructive',
  'удаление профиля — всегда копия, хоть через секунду после прошлой',
);
assert.equal(
  snapshotDecision({ prev: 'не json', next: none, snapshots: [], lastAt: 0, now: 1_000 }).reason,
  'unreadable',
  'нечитаемую запись не затираем без копии',
);
assert.equal(
  snapshotDecision({ prev: one, next: record([profile('a', 200)]), snapshots: [], lastAt: null, now: 0 }).reason,
  'time',
);
assert.equal(
  snapshotDecision({ prev: one, next: record([profile('a', 200)]), snapshots: [], lastAt: 0, now: 1_000 }).needed,
  false,
  'чаще раза в полчаса копии не снимаем',
);
assert.equal(
  snapshotDecision({
    prev: one,
    next: record([profile('a', 200)]),
    snapshots: snaps({ slot: 1, at: 0, bytes: 1, profiles: 1, xp: 200, names: ['a'] }),
    lastAt: null,
    now: 60 * 60_000,
  }).needed,
  false,
  'копия, ничем не отличающаяся от последней, не нужна',
);
assert.equal(
  snapshotDecision({ prev: one, next: none, snapshots: [], lastAt: null, now: 0 }).needed,
  true,
);
assert.equal(
  snapshotDecision({ prev: one, next: none, snapshots: [], lastAt: null, now: 0 }).needed,
  true,
);
// пустое состояние копировать незачем
assert.equal(
  snapshotDecision({ prev: one, next: none, snapshots: [], lastAt: null, now: 60 * 60_000 }).reason,
  'destructive',
);
assert.equal(
  snapshotDecision({ prev: none, next: none, snapshots: [], lastAt: null, now: 60 * 60_000 }).needed,
  false,
);

// 5) метки копий: нечитаемая запись сохраняется, но помечается
const brokenMeta = snapshotMetaOf('{сломано', 1, 0);
assert.equal(brokenMeta.profiles, null);
assert.equal(brokenMeta.bytes, '{сломано'.length);
assert.deepEqual(snapshotMetaOf(one, 2, 0).names, ['a']);

// 6) журнал: ограничен и не забивается повторами
let vault = emptyVault();
for (let i = 0; i < LOG_MAX + 20; i++) vault = pushLog(vault, 'boot', undefined, i);
assert.equal(vault.log.length, LOG_MAX, 'журнал не растёт бесконечно');
assert.equal(vault.log[vault.log.length - 1].at, LOG_MAX + 19, 'храним последние события');
const once = pushLogDedup(vault, 'write-error', 'квота', 1_000, 60_000);
const twice = pushLogDedup(once, 'write-error', 'квота', 2_000, 60_000);
assert.equal(twice, once, 'повтор того же события в журнал не пишется (иначе сбой записи зациклится)');
assert.notEqual(pushLogDedup(once, 'write-error', 'квота', 120_000, 60_000), once, 'а через окно — пишется');

// 7) корзина: не больше TRASH_MAX и со сроком жизни
let withTrash = emptyVault();
for (let i = 0; i < TRASH_MAX + 3; i++) {
  withTrash = addTrash(withTrash, profile(`p${i}`, 10), 'delete', i);
}
assert.equal(withTrash.trash.length, TRASH_MAX);
assert.equal(withTrash.trash[withTrash.trash.length - 1].profile.id, `p${TRASH_MAX + 2}`, 'новый — последний');
assert.equal(withTrash.trash[0].reason, 'delete');
const day = 24 * 60 * 60 * 1000;
assert.equal(purgeTrash(withTrash, 31 * day).trash.length, 0, 'старше 30 дней удаляем');
assert.equal(purgeTrash(withTrash, 29 * day).trash.length, TRASH_MAX, 'недавние остаются');

// 8) санитайзер импорта: мусор не ломает состояние
assert.deepEqual(normalizeVault(undefined), emptyVault());
assert.deepEqual(normalizeVault({ trash: 'не массив', log: null, snapshots: 5, lastExportAt: 'вчера' }), emptyVault());
assert.equal(
  normalizeVault({ log: [{ at: 1, kind: 'boot' }, { at: 'нет' }, null] }).log.length,
  1,
  'журнал из файла чистим',
);
assert.equal(normalizeVault({ lastExportAt: 42 }).lastExportAt, 42);

// 9) копии в слотах: не больше SNAPSHOT_SLOTS
let many = emptyVault().snapshots;
for (let i = 1; i <= SNAPSHOT_SLOTS + 2; i++) {
  many = upsertSnapshot(many, { slot: i % (SNAPSHOT_SLOTS + 1) || 1, at: i, bytes: 1, profiles: 1, xp: i, names: [] });
}
assert.ok(many.length <= SNAPSHOT_SLOTS);

// 10) подписи времени
assert.equal(agoLabel(Date.now()), 'только что');
assert.equal(agoLabel(Date.now() - 5 * 60_000), '5 минут назад');
assert.equal(agoLabel(Date.now() - 3 * 60 * 60_000), '3 часа назад');
assert.equal(agoLabel(Date.now() - 2 * 24 * 60 * 60_000), '2 дня назад');
assert.equal(pluralRu(1, 'минуту', 'минуты', 'минут'), '1 минуту');
assert.equal(pluralRu(3, 'час', 'часа', 'часов'), '3 часа');
assert.equal(pluralRu(11, 'день', 'дня', 'дней'), '11 дней');

console.log('✓ сейф прогресса: копии, корзина, журнал и защита от зацикливания');

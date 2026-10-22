// Схема и открытие базы пилотного сервера.
//
// Пилот сознательно на SQLite (node:sqlite, без npm-зависимостей):
// один файл, простой бэкап, хватает на сотни классов. Для школьного
// контракта с несколькими тысячами активных детей в документе
// предложен переезд на PostgreSQL без изменения контракта API.

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { DAY_MS } from './util.mjs';

const SCHEMA_VERSION = 1;

const SCHEMA = `
CREATE TABLE classes (
  id           TEXT PRIMARY KEY,
  school_code  TEXT NOT NULL,
  school_name  TEXT,
  label        TEXT NOT NULL,
  code         TEXT NOT NULL UNIQUE,
  goal_stars   INTEGER NOT NULL DEFAULT 100,
  created_at   INTEGER NOT NULL,
  archived_at  INTEGER
);
CREATE INDEX classes_school ON classes (school_code);

CREATE TABLE children (
  id              TEXT PRIMARY KEY,
  class_id        TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  nickname        TEXT NOT NULL,
  avatar          TEXT NOT NULL,
  token_hash      TEXT NOT NULL UNIQUE,
  consent_version TEXT NOT NULL,
  consent_at      INTEGER NOT NULL,
  created_at      INTEGER NOT NULL,
  last_seen_at    INTEGER NOT NULL,
  deleted_at      INTEGER
);
CREATE INDEX children_class ON children (class_id);
CREATE INDEX children_alive ON children (class_id, deleted_at);

CREATE TABLE daily (
  child_id       TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  day            TEXT NOT NULL,
  stars          INTEGER NOT NULL DEFAULT 0,
  lessons        INTEGER NOT NULL DEFAULT 0,
  tasks          INTEGER NOT NULL DEFAULT 0,
  correct        INTEGER NOT NULL DEFAULT 0,
  wrong          INTEGER NOT NULL DEFAULT 0,
  active_seconds INTEGER NOT NULL DEFAULT 0,
  updated_at     INTEGER NOT NULL,
  PRIMARY KEY (child_id, day)
);
CREATE INDEX daily_day ON daily (day);

CREATE TABLE mastered (
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  day      TEXT NOT NULL,
  word_id  TEXT NOT NULL,
  at       INTEGER NOT NULL,
  PRIMARY KEY (child_id, day, word_id)
);
CREATE INDEX mastered_day ON mastered (day);

CREATE TABLE answers (
  id       TEXT PRIMARY KEY,
  child_id TEXT NOT NULL,
  ts       INTEGER NOT NULL,
  day      TEXT NOT NULL,
  word_id  TEXT NOT NULL,
  kind     TEXT NOT NULL,
  correct  INTEGER NOT NULL,
  hint     INTEGER NOT NULL,
  ms       INTEGER
);
CREATE INDEX answers_day ON answers (day);
CREATE INDEX answers_word ON answers (word_id, day);
CREATE INDEX answers_child ON answers (child_id, day);

CREATE TABLE seen_events (
  child_id TEXT NOT NULL,
  id       TEXT NOT NULL,
  at       INTEGER NOT NULL,
  PRIMARY KEY (child_id, id)
);
CREATE INDEX seen_events_at ON seen_events (at);

CREATE TABLE telemetry (
  id          TEXT PRIMARY KEY,
  install_id  TEXT NOT NULL,
  at          INTEGER NOT NULL,
  day         TEXT NOT NULL,
  app_version TEXT,
  name        TEXT NOT NULL,
  props       TEXT
);
CREATE INDEX telemetry_day ON telemetry (day, name);
CREATE INDEX telemetry_install ON telemetry (install_id);

CREATE TABLE audit (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  at     INTEGER NOT NULL,
  action TEXT NOT NULL,
  detail TEXT
);
CREATE INDEX audit_at ON audit (at);
`;

export function openDb(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  const row = db.prepare('PRAGMA user_version').get();
  const version = Number(row?.user_version ?? 0);
  if (version < SCHEMA_VERSION) {
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(SCHEMA);
      db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  return db;
}

export function audit(db, action, detail, now = Date.now()) {
  db.prepare('INSERT INTO audit (at, action, detail) VALUES (?, ?, ?)').run(
    now,
    String(action).slice(0, 48),
    detail ? String(detail).slice(0, 400) : null,
  );
}

/**
 * Ретенция: сырые ответы и телеметрия нужны для разбора качества,
 * но не вечно. Результаты (daily, mastered) держим до 400 дней —
 * это сезон и история, дальше они не нужны ни ребёнку, ни школе.
 */
export function runRetention(db, now = Date.now()) {
  const answerCutoff = now - 90 * DAY_MS;
  const telemetryCutoff = now - 90 * DAY_MS;
  const eventCutoff = now - 30 * DAY_MS;
  const auditCutoff = now - 365 * DAY_MS;
  const archiveCutoffDay = new Date(now - 400 * DAY_MS).toISOString().slice(0, 10);
  const removed = {};
  removed.answers = db.prepare('DELETE FROM answers WHERE ts < ?').run(answerCutoff).changes;
  removed.telemetry = db.prepare('DELETE FROM telemetry WHERE at < ?').run(telemetryCutoff).changes;
  removed.seenEvents = db.prepare('DELETE FROM seen_events WHERE at < ?').run(eventCutoff).changes;
  removed.daily = db.prepare('DELETE FROM daily WHERE day < ?').run(archiveCutoffDay).changes;
  removed.mastered = db.prepare('DELETE FROM mastered WHERE day < ?').run(archiveCutoffDay).changes;
  removed.audit = db.prepare('DELETE FROM audit WHERE at < ?').run(auditCutoff).changes;
  return removed;
}

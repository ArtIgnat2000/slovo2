#!/usr/bin/env node
// Горячий бэкап SQLite через встроенный API node:sqlite.
//
// Запуск (внутри контейнера или на NAS):
//   node scripts/backup.mjs
// Переменные: DB_PATH, BACKUP_DIR, BACKUP_KEEP.
//
// Это не замена выгрузке на другой носитель: файл в том же томе
// защищает от порчи базы, но не от потери диска. В плане —
// ежедневная копия на второй носитель и раз в неделю — вне NAS.

import { mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync, backup } from 'node:sqlite';

export async function runBackup({
  dbPath = process.env.DB_PATH ?? '/data/slovo.db',
  backupDir = process.env.BACKUP_DIR ?? '/data/backups',
  keep = Math.max(2, Number(process.env.BACKUP_KEEP ?? 14)),
} = {}) {
  mkdirSync(backupDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = join(backupDir, `slovo-${stamp}.db`);

  const source = new DatabaseSync(dbPath, { readOnly: true });
  try {
    await backup(source, target);
  } finally {
    source.close();
  }

  const files = readdirSync(backupDir)
    .filter((name) => /^slovo-.*\.db$/.test(name))
    .map((name) => ({ name, at: statSync(join(backupDir, name)).mtimeMs }))
    .sort((a, b) => b.at - a.at);

  for (const old of files.slice(keep)) unlinkSync(join(backupDir, old.name));

  return {
    file: target,
    kept: Math.min(files.length, keep),
    removed: Math.max(0, files.length - keep),
  };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const result = await runBackup();
  console.log(JSON.stringify({ level: 'info', msg: 'backup_done', ...result }));
}

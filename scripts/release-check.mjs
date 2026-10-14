import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function parts(version) {
  if (typeof version !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error(`Нужна стабильная версия major.minor.patch, получено: ${version}`);
  }
  return version.split('.').map(BigInt);
}

export function validateRelease({ baseVersion, version, lockVersion, rootVersion, hasNote, title }) {
  const base = parts(baseVersion);
  const current = parts(version);
  let greater = false;
  for (let i = 0; i < 3; i++) {
    if (current[i] === base[i]) continue;
    greater = current[i] > base[i];
    break;
  }
  if (!greater) throw new Error(`Каждый PR должен увеличивать версию: main ${baseVersion}, PR ${version}`);
  if (lockVersion !== version || rootVersion !== version) {
    throw new Error('Версии package.json и package-lock.json (включая packages[""]) должны совпадать');
  }
  if (!hasNote) throw new Error(`Нет релизной заметки docs/RELEASE-${version}.md`);
  if (title !== undefined && !title.startsWith(`v${version} — `)) {
    throw new Error(`Заголовок PR должен начинаться с «v${version} — »`);
  }
}

export function checkRelease(baseRef = 'origin/main') {
  // Ошибка чтения main — ошибка проверки, не повод молча пропустить её.
  const base = JSON.parse(execFileSync('git', ['show', `${baseRef}:package.json`], { encoding: 'utf8' }));
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
  validateRelease({
    baseVersion: base.version,
    version: pkg.version,
    lockVersion: lock.version,
    rootVersion: lock.packages?.['']?.version,
    hasNote: existsSync(`docs/RELEASE-${pkg.version}.md`),
    title: process.env.PR_TITLE,
  });
  console.log(`✓ релиз: ${base.version} → ${pkg.version}, lock и заметка согласованы${process.env.PR_TITLE !== undefined ? ', заголовок PR проверен' : ''}`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    checkRelease(process.argv[2]);
  } catch (error) {
    console.error(`✗ ${error.message}`);
    process.exitCode = 1;
  }
}

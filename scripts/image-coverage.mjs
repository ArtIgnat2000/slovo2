#!/usr/bin/env node
/**
 * Покрытие слов картинками (npm run images:report).
 *
 * В банке 257 карточек, а WebP-иллюстрации нарисованы только для 94 слов
 * 2 класса. Этот отчёт показывает, сколько слов каждого класса уже с картинкой,
 * сколько живёт на эмодзи, и сколько весят файлы — чтобы решение «рисовать
 * дальше или оставить эмодзи» принималось по цифрам, а не на глаз.
 *
 * Отчёт ничего не меняет и не падает. С `--strict` завершается с кодом 1,
 * если у какого-то класса есть слова без картинки: это пригодится, когда
 * картинки станут обязательными.
 *
 * Запуск: npm run images:report [-- --strict]
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const contentFile = path.join(root, 'src/content/words.ts');
const wordsDir = path.join(root, 'public/words');

const src = fs.readFileSync(contentFile, 'utf8');
const raw = src.match(/const RAW = `([\s\S]*?)`/);
if (!raw) {
  console.error('Не найден блок RAW в src/content/words.ts');
  process.exit(1);
}

const gradesOf = new Map();
for (const match of src.matchAll(/^\s*'([^']+)':\s*\[([\d,\s]+)\],/gm)) {
  gradesOf.set(match[1], match[2].split(',').map((n) => Number(n.trim())).filter(Boolean));
}

const words = raw[1]
  .trim()
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => {
    const parts = line.split('|');
    return { text: parts[0], image: parts[9] || '', grades: gradesOf.get(parts[0]) ?? [] };
  });

if (words.some((w) => w.grades.length === 0)) {
  const broken = words.filter((w) => w.grades.length === 0).map((w) => w.text);
  console.error(`✗ У слов нет класса в GRADES_OF: ${broken.join(', ')}`);
  process.exit(1);
}

const classes = [1, 2, 3, 4];
const rows = classes.map((grade) => {
  const list = words.filter((w) => w.grades.includes(grade));
  const withImage = list.filter((w) => w.image && fs.existsSync(path.join(wordsDir, `${w.image}.webp`)));
  return { grade, total: list.length, withImage: withImage.length, without: list.length - withImage.length };
});

const files = fs.existsSync(wordsDir) ? fs.readdirSync(wordsDir).filter((f) => f.endsWith('.webp')) : [];
const bytes = files.reduce((sum, f) => sum + fs.statSync(path.join(wordsDir, f)).size, 0);

console.log('Картинки к словам по классам\n');
console.log('  класс │ слов │ с картинкой │ на эмодзи │ покрытие');
console.log('  ──────┼──────┼─────────────┼───────────┼─────────');
for (const row of rows) {
  const pct = row.total ? Math.round((row.withImage / row.total) * 100) : 0;
  console.log(
    `    ${row.grade}   │ ${String(row.total).padStart(4)} │ ${String(row.withImage).padStart(11)} │ ${String(row.without).padStart(9)} │ ${String(pct).padStart(6)}%`,
  );
}
const total = words.length;
const withImage = words.filter((w) => w.image && fs.existsSync(path.join(wordsDir, `${w.image}.webp`))).length;
console.log('  ──────┴──────┴─────────────┴───────────┴─────────');
console.log(`  всего │ ${String(total).padStart(4)} │ ${String(withImage).padStart(11)} │ ${String(total - withImage).padStart(9)} │ ${String(Math.round((withImage / total) * 100)).padStart(6)}%`);
console.log(`\n  файлов в public/words: ${files.length}, всего ${(bytes / 1024).toFixed(0)} КБ`);
console.log('  решение по оставшимся словам — docs/proposals/word-images-1-4.md');

const strict = process.argv.includes('--strict');
if (strict && rows.some((row) => row.without > 0)) {
  console.error('\n✗ --strict: есть слова без картинок');
  process.exit(1);
}

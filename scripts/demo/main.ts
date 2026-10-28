// Точка входа генератора: собрать файл, проверить инварианты и записать JSON.
// Запускается через scripts/make-demo-progress.mjs (esbuild-бандл, как у smoke).
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildDemoFile, sectionReport, verifyDemoFile } from './generate';

// После esbuild-бандла import.meta.url указывает в .tmp-art, поэтому корень
// репозитория передаёт раннер scripts/make-demo-progress.mjs через DEMO_ROOT.
const root = process.env.DEMO_ROOT
  ? path.resolve(process.env.DEMO_ROOT)
  : path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const outPath = process.env.DEMO_OUT
  ? path.resolve(process.env.DEMO_OUT)
  : path.join(root, 'docs/promo/slovo2-demo-progress.json');

mkdirSync(path.dirname(outPath), { recursive: true });

const file = buildDemoFile();
verifyDemoFile(file);
writeFileSync(outPath, JSON.stringify(file, null, 2) + '\n', 'utf8');

console.log(`\nФайл записан: ${path.relative(root, outPath)} (${(JSON.stringify(file).length / 1024).toFixed(1)} КБ)`);
console.log('\nДоли покупок по разделам (цель 20–45%):');
for (const row of sectionReport(file)) {
  const bar = '█'.repeat(Math.round(row.pct / 5)) + '·'.repeat(9 - Math.round(row.pct / 5));
  console.log(`  ${row.profile.padEnd(5)} ${row.section.padEnd(8)} ${bar} ${row.owned}/${row.total} (${row.pct}%)`);
}

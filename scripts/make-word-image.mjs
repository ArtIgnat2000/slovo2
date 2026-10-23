// Сборка ОДНОЙ картинки слова: сгенерированный кадр → public/words/<slug>.webp
//
// Устройство пайплайна (партии картинок 3–4 класса, 2026-10-23):
//   1. кадр кладётся в `images-src/gen/<slug>.png` (папка вне git, .gitignore);
//   2. этот скрипт приводит кадр к формату пака: 256×256, WebP q82 без
//      метаданных — как `scripts/make-word-images.mjs` для 94 нарисованных слов;
//   3. имя файла вписывается в 10-е поле `RAW` (src/content/words.ts),
//      затем `npm run content:check` и `npm run images:report`.
//
// Запуск:
//   node scripts/make-word-image.mjs                 # все кадры из images-src/gen
//   node scripts/make-word-image.mjs pogoda porosha  # только эти слаги
//   node scripts/make-word-image.mjs --trim          # обрезать поля по содержимому
//
// Требования к кадру: без текста и букв (иначе картинка подсказывает написание),
// один предмет по центру, фон — однотонный кремовый. `--trim` нужен, если
// генератор оставил широкие поля: обрезка идёт по содержимому, потом кадр
// вписывается в квадрат на кремовом фоне пака.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'images-src/gen');
const outDir = path.join(root, 'public/words');

/** Фон пака: тот же кремовый, что у 94 картинок 2 класса (≈ #FAF4E1). */
const BG = '#faf4e1';
/** Предел веса одной картинки: столько же весит самая тяжёлая в паке. */
const MAX_BYTES = 20 * 1024;
/** Что действительно лежит в паке: 256×256, без прозрачности. */
const SIDE = 256;

mkdirSync(outDir, { recursive: true });
mkdirSync(srcDir, { recursive: true });

const args = process.argv.slice(2);
const trim = args.includes('--trim');
const only = args.filter((a) => !a.startsWith('-'));
const files = readdirSync(srcDir)
  .filter((f) => /\.(png|jpe?g)$/i.test(f))
  .filter((f) => !only.length || only.includes(f.replace(/\.(png|jpe?g)$/i, '')))
  .sort();

if (!files.length) {
  console.log(`Нет кадров в ${path.relative(root, srcDir)}`);
  console.log('Положите кадр как images-src/gen/<slug>.png и запустите снова.');
  process.exit(0);
}

let total = 0;
let heavy = 0;
for (const file of files) {
  const slug = file.replace(/\.(png|jpe?g)$/i, '');
  const target = path.join(outDir, `${slug}.webp`);
  const pipeline = [path.join(srcDir, file)];
  if (trim) pipeline.push('-fuzz', '6%', '-trim', '+repage');
  pipeline.push(
    // Вписываем целиком (без обрезки краёв): предмет должен быть виден весь.
    '-resize', `${Math.round(SIDE * 0.92)}x${Math.round(SIDE * 0.92)}`,
    '-gravity', 'center',
    '-background', BG,
    '-extent', `${SIDE}x${SIDE}`,
    '-strip',
    '-quality', '82',
    target,
  );
  execFileSync('convert', pipeline);
  const size = statSync(target).size;
  total += size;
  const flag = size > MAX_BYTES ? '  ← тяжелее предела' : '';
  if (size > MAX_BYTES) heavy += 1;
  console.log(`  ${slug.padEnd(18)} ${(size / 1024).toFixed(1)} КБ${flag}`);
}

console.log(`✓ готово: ${files.length}, всего ${(total / 1024).toFixed(0)} КБ`);
if (heavy) console.log(`  ${heavy} файл(ов) тяжелее ${MAX_BYTES / 1024} КБ`);
console.log('  дальше: вписать слаги в 10-е поле RAW, затем npm run content:check и npm run images:report');

// Какие слаги ещё не подключены в контенте — чтобы не забыть проводку.
const raw = readFileSync(path.join(root, 'src/content/words.ts'), 'utf8');
const missing = files
  .map((f) => f.replace(/\.(png|jpe?g)$/i, ''))
  .filter((slug) => !new RegExp(`\\|${slug}\\s*$`, 'm').test(raw));
if (missing.length) console.log(`  ещё не подключены в RAW: ${missing.join(', ')}`);

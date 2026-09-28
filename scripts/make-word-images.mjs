// Сборка картинок слов: images-src/*.png (крупные исходники) → public/words/*.webp
//
// В репозиторий попадают только оптимизированные WebP 256×256 (~5 КБ каждый),
// а исходники лежат вне git (см. .gitignore: images-src/) — приложение должно
// оставаться лёгким, оно же офлайн PWA.
//
// Запуск: node scripts/make-word-images.mjs   (нужен ImageMagick: `convert`)
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'images-src');
const out = path.join(root, 'public/words');

mkdirSync(out, { recursive: true });

const files = readdirSync(src).filter((f) => f.endsWith('.png'));
let total = 0;
for (const f of files) {
  const name = f.replace(/\.png$/, '');
  const target = path.join(out, `${name}.webp`);
  execFileSync('convert', [
    path.join(src, f),
    '-resize', '256x256^',
    '-gravity', 'center',
    '-extent', '256x256',
    '-strip',
    '-quality', '82',
    target,
  ]);
  const size = statSync(target).size;
  total += size;
  console.log(`  ${name.padEnd(12)} ${(size / 1024).toFixed(1)} КБ`);
}
console.log(`✓ картинок: ${files.length}, всего ${(total / 1024).toFixed(0)} КБ`);
console.log('  не забудьте указать имя файла в 10-м поле слова в src/content/words.ts и запустить npm run content:check');

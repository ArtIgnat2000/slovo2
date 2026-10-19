// Сборка картинок машин: images-src/cars/*.png (крупные исходники) → public/cars/*.webp
//
// 0.21.0: легендарные авто в магазине — не мультяшные силуэты, а карандашные
// рисунки конкретных моделей (флагманский седан, спортивный седан, квадратный
// внедорожник, двухцветный и парадный лимузины, гиперкар, суперкар, болид,
// внедорожник, такси). 0.21.1: рисунки стали цветными — цветной карандаш с
// той же графитовой штриховкой. Рисунки готовятся художником/генератором как
// PNG на белой бумаге, а здесь приводятся к одному виду:
//
//   1. белый фон вырезается заливкой от углов (fuzz 12 %) — остаётся только
//      машина с её собственной тенью и штриховкой;
//   2. от маски берётся самая большая связная область и её рамка: зернистая
//      бумага иногда оставляет «пылинки» в углу листа, и без этого шага они
//      приезжали в магазин светлыми пятнами на тёмной теме;
//   3. изображение обрезается по рамке машины и вписывается в 676×404;
//   4. ставится на прозрачное полотно 720×480 так, чтобы низ машины (и тень)
//      стоял на одной линии у всех десяти рисунков;
//   5. сохраняется WebP с альфой — в git идут только оптимизированные файлы
//      (исходники лежат в .gitignore, как images-src слов; для цветных работ
//      важна и альфа, и палитра).
//
// Запуск: node scripts/make-car-images.mjs   (нужен ImageMagick: `convert`)
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'images-src/cars');
const out = path.join(root, 'public/cars');

const W = 720;
const H = 480;
// Низ рисунка — на этой высоте полотна: одна линия «пола» у всех машин.
// 8 px запаса снизу: тень не обрезается, а колёса стоят почти на краю —
// на витрине рисунок садится на подиум без зазора.
const BASELINE = H - 8;

mkdirSync(out, { recursive: true });

/** Вырезать бумагу: заливка от углов. Возвращает временный файл с альфой. */
function cutPaper(file, tmp) {
  execFileSync('convert', [
    file,
    '-alpha', 'on',
    '-fuzz', '12%',
    '-fill', 'none',
    '-draw', 'color 0,0 floodfill',
    tmp,
  ]);
  return tmp;
}

/**
 * Рамка самой большой связной области маски. Пылинки бумаги — отдельные
 * мелкие области; всё, что вне рамки машины, в магазин не едет.
 */
function subjectBox(file) {
  const report = execFileSync(
    'convert',
    [
      file,
      '-alpha', 'extract',
      '-threshold', '50%',
      '-define', 'connected-components:verbose=true',
      '-define', 'connected-components:area-threshold=100',
      '-connected-components', '8',
      'null:',
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
  );
  let best = null;
  for (const line of report.split('\n').slice(1)) {
    const m = line.match(/^\s*\d+:\s+(\d+)x(\d+)\+(\d+)\+(\d+)\s+\S+\s+(\d+)\s+gray\(255\)/);
    if (!m) continue;
    const area = Number(m[5]);
    if (!best || area > best.area) best = { w: +m[1], h: +m[2], x: +m[3], y: +m[4], area };
  }
  if (!best) throw new Error(`не нашёл рисунок машины в ${file}`);
  return best;
}

const files = readdirSync(src).filter((f) => f.endsWith('.png') && !f.startsWith('.'));
let total = 0;
for (const f of files) {
  const id = f.replace(/\.png$/, '');
  const target = path.join(out, `${id}.webp`);
  const cut = path.join(src, `.${id}-cut.png`);
  const trim = path.join(src, `.${id}-trim.png`);
  cutPaper(path.join(src, f), cut);
  // Рамка машины (с запасом, чтобы не срезать мягкую тень под колёсами).
  const box = subjectBox(cut);
  const margin = 6;
  execFileSync('convert', [
    cut,
    '-crop', `${box.w + margin * 2}x${box.h + margin * 2}+${Math.max(0, box.x - margin)}+${Math.max(0, box.y - margin)}`,
    '+repage',
    '-trim',
    '+repage',
    // Вписываем в поле, оставляя воздух вокруг машины.
    '-resize', '676x404>',
    trim,
  ]);
  // Ставим на общее полотно: низ машины — на BASELINE.
  // Мягкая кромка (blur по альфе) убирает белый «ореол» бумаги на тёмной теме.
  execFileSync('convert', [
    '-size', `${W}x${H}`, 'xc:none',
    '(', trim, '-channel', 'A', '-blur', '0x0.6', '+channel', ')',
    '-gravity', 'south',
    '-geometry', `+0+${H - BASELINE}`,
    '-composite',
    '-strip',
    '-define', 'webp:alpha-quality=92',
    '-quality', '76',
    target,
  ]);
  execFileSync('rm', ['-f', cut, trim]);
  const size = statSync(target).size;
  total += size;
  console.log(`  ${id.padEnd(14)} ${(size / 1024).toFixed(1)} КБ`);
}
console.log(`✓ рисунков: ${files.length}, всего ${(total / 1024).toFixed(0)} КБ`);

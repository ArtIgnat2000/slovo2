// Сборка фотографий товаров: images-src/products/*.png → public/products/*.webp
//
// 0.76.0: картинки магазина стали фотореалистичными студийными снимками.
// Генератор отдаёт кадры разного формата (обычно широкие 1408×768, иногда
// вертикальные 768×1376), а витрина показывает один формат — 4:3. Здесь кадр
// приводится к нему так, чтобы предмет никогда не обрезался:
//
//   • широкий кадр из списка CROP — центральный кроп по ширине: там машина
//     стоит по центру, а по бокам только задник, поэтому кроп безопасен;
//   • любой другой кадр (в том числе широкий, но не проверенный) — вписываем
//     целиком на размытый задник из того же снимка: никаких серых полей и
//     никакой обрезки. Раньше резали все широкие кадры подряд, и у розового
//     кабриолета окно 4:3 срезало передний бампер;
//   • сохраняем WebP: в git едут только готовые файлы, исходники лежат
//     в images-src (в .gitignore, как картинки слов).
//
// Запуск: node scripts/make-product-images.mjs   (нужен ImageMagick: `convert`)
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'images-src/products');
const out = path.join(root, 'public/products');

const W = 1200;
const H = 900;
const RATIO = W / H;

/**
 * 0.81.0: кадры, которым кроп до 4:3 не вредит. Список пополняется глазами:
 * собрал — посмотрел, есть ли вокруг предмета задник.
 *
 * Почему список такой короткий: в этих студийных кадрах корпус машины идёт
 * почти во всю ширину исходника (1408×768 против окна 1024), и центральный
 * кроп срезал то бампер спереди, то корму. Поэтому по умолчанию кадр
 * вписывается целиком на продолженный задник, а режем мы только те снимки,
 * где предмет заведомо компактнее окна.
 */
const CROP = new Set(['car-arctic-base', 'laptop-air']);

mkdirSync(out, { recursive: true });

const files = readdirSync(src).filter((name) => name.toLowerCase().endsWith('.png'));
if (!files.length) {
  console.error(`✗ нет исходников в ${path.relative(root, src)}`);
  process.exit(1);
}

function size(file) {
  const [w, h] = execFileSync('identify', ['-format', '%w %h', file], { encoding: 'utf8' }).trim().split(' ').map(Number);
  return { w, h };
}

/** Кадр целиком на продолженный задник: студия из собственных цветов снимка. */
function fitOnBackdrop(from, to, id) {
  const bg = path.join(out, `.${id}-bg.png`);
  const fg = path.join(out, `.${id}-fg.png`);
  execFileSync('convert', [from, '-auto-orient', '-resize', '8x6!', '-resize', `${W}x${H}!`, '-blur', '0x60', bg]);
  execFileSync('convert', [from, '-auto-orient', '-resize', `${W}x${H}`, fg]);
  execFileSync('convert', [bg, fg, '-gravity', 'center', '-composite', '-quality', '82', '-define', 'webp:method=6', to]);
  rmSync(bg, { force: true });
  rmSync(fg, { force: true });
}

for (const name of files) {
  const id = name.replace(/\.png$/i, '');
  const from = path.join(src, name);
  const to = path.join(out, `${id}.webp`);
  const { w, h } = size(from);

  if (w / h >= RATIO && CROP.has(id)) {
    execFileSync('convert', [
      from, '-auto-orient',
      '-gravity', 'center',
      '-crop', `${Math.round(h * RATIO)}x${h}+0+0`,
      '+repage',
      '-resize', `${W}x${H}`,
      '-quality', '82', '-define', 'webp:method=6',
      to,
    ]);
  } else {
    fitOnBackdrop(from, to, id);
  }
  console.log(`✓ ${id}.webp`);
}

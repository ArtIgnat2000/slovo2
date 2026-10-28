// Сборка фотографий товаров: images-src/products/*.png → public/products/*.webp
//
// 0.76.0: картинки магазина стали фотореалистичными студийными снимками.
// Генератор отдаёт кадры разного формата (обычно широкие 1408×768, иногда
// вертикальные 768×1376), а витрина показывает один формат — 4:3. Здесь кадр
// приводится к нему так, чтобы предмет никогда не обрезался:
//
//   • широкий кадр — центральный кроп по ширине (предмет стоит по центру,
//     по бокам только задник, поэтому кроп безопасен);
//   • вертикальный или равный — предмет вписывается целиком на размытый
//     задник из того же кадра: никаких серых полей, студия продолжается;
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

for (const name of files) {
  const id = name.replace(/\.png$/i, '');
  const from = path.join(src, name);
  const to = path.join(out, `${id}.webp`);
  const { w, h } = size(from);

  if (w / h >= RATIO) {
    // Широкий кадр: режем поля по бокам — предмет стоит по центру, по краям
    // только студийный задник, поэтому кроп безопасен.
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
    // Вертикальный кадр: предмет вписываем целиком, а по бокам продолжаем
    // студию — задник собирается из собственных цветов снимка, сведённых к
    // мягкому градиенту (без «второго размытого пуделя» рядом с настоящим).
    const bg = path.join(out, `.${id}-bg.png`);
    const fg = path.join(out, `.${id}-fg.png`);
    execFileSync('convert', [
      from, '-auto-orient',
      '-resize', '8x6!',
      '-resize', `${W}x${H}!`,
      '-blur', '0x60',
      bg,
    ]);
    execFileSync('convert', [from, '-auto-orient', '-resize', `${W}x${H}`, fg]);
    execFileSync('convert', [bg, fg, '-gravity', 'center', '-composite', '-quality', '82', '-define', 'webp:method=6', to]);
    rmSync(bg, { force: true });
    rmSync(fg, { force: true });
  }
  console.log(`✓ ${id}.webp`);
}

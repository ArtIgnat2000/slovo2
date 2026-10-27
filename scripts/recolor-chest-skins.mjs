// Перекраска обликов сундука: public/illustrations/chests/<base>-{closed,open}.webp
// → <skin>-{closed,open}.webp того же холста 512×512.
//
// 0.70.0: два «уютных» облика (docs/proposals/shop-girls-catalog.md, вариант A) —
// «Цветочный» и «Радужный». Рисовать новые спрайты не нужно и вредно: сундук в
// магазине стоит сеткой, и если у нового облика другой холст или другая рамка,
// карточка «прыгает» при переключении. Поэтому здесь берётся готовый спрайт и
// поворачивается оттенок в HSL целиком, без изменения геометрии:
//
//   -modulate <яркость>,<насыщенность>,<оттенок>
//
// Первая попытка с поворотом оттенка на 80° дала кислотно-розовый/зелёный — для
// пастельного исходника это читается как «неон», а не как «сказка». Рабочие
// значения: 160° (розово-мятный «цветочный») и 124° (сиренево-лаймовый
// «радужный»). Яркость и насыщенность меняются на единицы процентов: исходник
// уже светлый, и сильнее насыщать его нельзя — теряются блики на крышке.
//
// Запуск: node scripts/recolor-chest-skins.mjs   (нужен ImageMagick: `convert`)
import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'public/illustrations/chests');

// id облика → от какого спрайта и с каким сдвигом оттенка его получаем.
const SKINS = [
  { id: 'flower', base: 'sky', modulate: '104,106,160', title: 'Цветочный сундук' },
  { id: 'rainbow', base: 'sky', modulate: '100,112,124', title: 'Радужный сундук' },
];

const STATES = ['closed', 'open'];

for (const skin of SKINS) {
  for (const state of STATES) {
    const from = path.join(dir, `${skin.base}-${state}.webp`);
    const to = path.join(dir, `${skin.id}-${state}.webp`);
    if (!existsSync(from)) {
      console.error(`✗ нет исходника ${path.relative(root, from)}`);
      process.exitCode = 1;
      continue;
    }
    // -quality 82 как у остальных спрайтов магазина: 40–55 КБ на файл.
    execFileSync('convert', [from, '-modulate', skin.modulate, '-quality', '82', to], {
      stdio: 'inherit',
    });
    const kb = Math.round(statSync(to).size / 1024);
    console.log(`✓ ${skin.title}: ${path.relative(root, to)} (${kb} КБ)`);
  }
}

if (!process.exitCode) console.log('✓ облики сундука перекрашены');

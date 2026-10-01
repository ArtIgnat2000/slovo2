// Разовый генератор картинок костюмов для проверки (не часть приложения).
// Рендерим тот же <Mascot>, что видит ребёнок, в SVG и раскладываем на лист
// + отдельные карточки. Запуск: node .preview/run.mjs (см. runner).
import { renderToString } from 'react-dom/server';
import { createElement as h } from 'react';
import { writeFileSync } from 'node:fs';
import { COSTUMES } from '../../src/engine/puzzles';
import { Mascot } from '../../src/ui/Mascot';

/** Вытаскиваем чистый svg Маскота и задаём ему фиксированный размер (viewBox 100×120). */
function mascotSvg(costumeId: string | null, mood: 'idle' | 'happy' | 'dance' = 'idle'): string {
  const html = renderToString(h(Mascot, { mood, costumeId, size: 200, stage: 3 }));
  const m = html.match(/<svg[\s\S]*?<\/svg>/);
  if (!m) throw new Error('Mascot не отдал svg');
  return m[0]
    .replace(/ width="[^"]*"/, ` width="${100 * (240 / 120)}"`)
    .replace(/ height="[^"]*"/, ' height="240"');
}

function esc(t: string) {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Перенос подписи по словам под указанную ширину (грубо, по средней ширине глифа). */
function wrap(t: string, max: number, lines = 2): string[] {
  const out: string[] = [];
  let cur = '';
  for (const w of t.split(' ')) {
    if ((cur + ' ' + w).trim().length > max && cur) { out.push(cur); cur = w; if (out.length === lines) break; }
    else cur = (cur ? cur + ' ' : '') + w;
  }
  if (out.length < lines && cur) out.push(cur);
  return out;
}

const CARD_W = 260, CARD_H = 344, GAP = 20, PAD = 26, COLS = 4;
const items = [{ id: null as string | null, title: 'Без костюма (обычный БУК)', desc: '' },
  ...COSTUMES.map((c) => ({ id: c.id as string | null, title: `«${c.title}»`, desc: c.desc }))];
const rows = Math.ceil(items.length / COLS);
const W = PAD * 2 + COLS * CARD_W + (COLS - 1) * GAP;
const H = PAD * 2 + 56 + rows * (CARD_H + GAP) - GAP;

let sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#ffffff"/>
<text x="${PAD}" y="${PAD + 26}" font-family="DejaVu Sans" font-size="26" font-weight="bold" fill="#241f36">Костюмные пазлы — 10 образов БУКа (v0.9.0)</text>`;

items.forEach((it, i) => {
  const cx = PAD + (i % COLS) * (CARD_W + GAP);
  const cy = PAD + 56 + Math.floor(i / COLS) * (CARD_H + GAP);
  sheet += `<g transform="translate(${cx} ${cy})">
<rect width="${CARD_W}" height="${CARD_H}" rx="18" fill="#fff8ec" stroke="#efe9dd"/>
<svg x="${(CARD_W - 200) / 2}" y="18" width="200" height="240" viewBox="0 0 100 120">${mascotSvg(it.id).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</svg>
<text x="${CARD_W / 2}" y="288" text-anchor="middle" font-family="DejaVu Sans" font-size="16" font-weight="bold" fill="#241f36">${esc(it.title)}</text>
${wrap(it.desc, 44, 2).map((l, k) => `<text x="${CARD_W / 2}" y="${308 + k * 16}" text-anchor="middle" font-family="DejaVu Sans" font-size="12" fill="#6b6480">${esc(l)}</text>`).join('\n')}
</g>`;
});
sheet += '</svg>';
writeFileSync(process.env.OUT_DIR + '/costumes-sheet.svg', sheet);

// Отдельные карточки — крупнее, с подписью
for (const it of items) {
  const w = 420, hh = 520;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${hh}" viewBox="0 0 ${w} ${hh}">
<rect width="${w}" height="${hh}" rx="26" fill="#fff8ec" stroke="#efe9dd" stroke-width="2"/>
<svg x="85" y="34" width="250" height="300" viewBox="0 0 100 120">${mascotSvg(it.id).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</svg>
<text x="${w / 2}" y="386" text-anchor="middle" font-family="DejaVu Sans" font-size="24" font-weight="bold" fill="#241f36">${esc(it.title)}</text>
${wrap(it.desc, 52, 3).map((l, k) => `<text x="${w / 2}" y="${418 + k * 22}" text-anchor="middle" font-family="DejaVu Sans" font-size="15" fill="#6b6480">${esc(l)}</text>`).join('\n')}
</svg>`;
  writeFileSync(`${process.env.OUT_DIR}/c-${it.id ?? 'bare'}.svg`, svg);
}
console.log('svg written:', items.length + 1, 'files');

// Разовый генератор листа акцентов костюмов для ревью (не часть приложения).
// Рендерим тот же <Mascot>, что видит ребёнок (React→SVG), подставляя в стор
// профиль с выбранным акцентом, и раскладываем по листам: строка — костюм,
// столбцы — базовый акцент и три платных. Так акценты видно без 9 уроков.
import { renderToString } from 'react-dom/server';
import { createElement as h } from 'react';
import { writeFileSync } from 'node:fs';
import { COSTUMES } from '../../src/engine/puzzles';
import { COSTUME_PALETTES } from '../../src/engine/tints';
import { Mascot } from '../../src/ui/Mascot';
import { useApp } from '../../src/state/store';
import type { Profile } from '../../src/types';

/** Пустой профиль с собранным костюмом и выбранным акцентом — для рендера. */
function seedProfile(costumeId: string, tintId: string): Profile {
  return {
    id: 'p_accents_demo',
    name: 'Демо',
    avatar: '🦉',
    createdAt: 0,
    xp: 0,
    gems: 0,
    streak: 0,
    lastDay: '',
    freezes: 0,
    words: {},
    lessons: {},
    errors: {},
    days: {},
    achievements: [],
    shop: {
      owned: [],
      equipped: {},
      tuning: {
        current: tintId === 'base' ? {} : { [costumeId]: tintId },
        unlocked: {},
      },
    },
    puzzle: { pieces: {}, collecting: null, assembled: [costumeId], worn: costumeId },
  };
}

// renderToString берёт у zustand серверный снапшот (getInitialState), а setState
// создаёт новый объект состояния — поэтому посев кладём прямо в начальное
// состояние: БУК читает тот же стор, что и в приложении.
const seedState = (patch: Record<string, unknown>) => Object.assign(useApp.getInitialState(), patch);

/** Чистый svg БУКа в выбранном костюме и акценте. */
function mascotSvg(costumeId: string, tintId: string): string {
  seedState({ profiles: [seedProfile(costumeId, tintId)], activeId: 'p_accents_demo' });
  const html = renderToString(h(Mascot, { mood: 'idle', costumeId, size: 200, stage: 3 }));
  const match = html.match(/<svg[\s\S]*?<\/svg>/);
  if (!match) throw new Error('Mascot не отдал svg');
  return match[0].replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
}

function esc(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const CARD_W = 230;
const CARD_H = 320;
const GAP = 16;
const PAD = 24;
const HEADER = 56;
const COLS = 4;

const rows: { costume: string; cells: { tintId: string; label: string; glow: string; cape?: string }[] }[] =
  COSTUMES.map((costume) => ({
    costume: costume.id,
    cells: [
      { tintId: 'base', label: `база · ${COSTUME_PALETTES[costume.id].base.title}`, glow: costume.glow, cape: costume.cape },
      ...COSTUME_PALETTES[costume.id].extra.map((tint) => ({
        tintId: tint.id,
        label: `1 кристалл · ${tint.title}`,
        glow: tint.glow,
        cape: tint.cape,
      })),
    ],
  }));

const PER_SHEET = 5;
const sheets = Math.ceil(rows.length / PER_SHEET);

for (let sheetIndex = 0; sheetIndex < sheets; sheetIndex++) {
  const part = rows.slice(sheetIndex * PER_SHEET, (sheetIndex + 1) * PER_SHEET);
  const W = PAD * 2 + COLS * CARD_W + (COLS - 1) * GAP;
  const H = PAD * 2 + HEADER + part.length * (CARD_H + GAP) - GAP;
  let sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#ffffff"/>
<text x="${PAD}" y="${PAD + 26}" font-family="DejaVu Sans" font-size="24" font-weight="bold" fill="#241f36">Акценты костюмов: свечение и плащ (лист ${sheetIndex + 1}/${sheets})</text>
<text x="${PAD}" y="${PAD + 47}" font-family="DejaVu Sans" font-size="14" fill="#6b6480">Строка — костюм, столбцы: бесплатная база и три акцента за 1 кристалл. Корпус, крылья и металл не меняются.</text>`;

  part.forEach((row, rowIndex) => {
    const costume = COSTUMES.find((c) => c.id === row.costume)!;
    row.cells.forEach((cell, colIndex) => {
      const cx = PAD + colIndex * (CARD_W + GAP);
      const cy = PAD + HEADER + rowIndex * (CARD_H + GAP);
      const badges = [cell.glow, cell.cape]
        .filter((fill): fill is string => Boolean(fill))
        .map(
          (fill, badgeIndex) =>
            `<circle cx="${CARD_W - 22 - badgeIndex * 22}" cy="22" r="9" fill="${fill}" stroke="#241f36" stroke-opacity=".15"/>`,
        )
        .join('');
      sheet += `<g transform="translate(${cx} ${cy})">
<rect width="${CARD_W}" height="${CARD_H}" rx="18" fill="#fff8ec" stroke="#efe9dd"/>
${badges}
<svg x="${(CARD_W - 200) / 2}" y="22" width="200" height="240" viewBox="0 0 100 120">${mascotSvg(costume.id, cell.tintId)}</svg>
<text x="${CARD_W / 2}" y="286" text-anchor="middle" font-family="DejaVu Sans" font-size="16" font-weight="bold" fill="#241f36">${esc(costume.title)}</text>
<text x="${CARD_W / 2}" y="306" text-anchor="middle" font-family="DejaVu Sans" font-size="13" fill="#6b6480">${esc(cell.label)}</text>
</g>`;
    });
  });

  sheet += '</svg>';
  const name = sheets > 1 ? `accents-sheet-${sheetIndex + 1}` : 'accents-sheet';
  writeFileSync(`${process.env.OUT_DIR}/${name}.svg`, sheet);
}

// Зум на клинок: у «световых» костюмов лезвие почти белое, и на общем листе
// перекраску видно плохо. Здесь тот же кадр, но с обрезкой по клинку.
const ZOOM: { costume: string; view: string }[] = [
  { costume: 'light-master', view: '60 10 42 82' },
  { costume: 'dark-lord', view: '60 10 42 82' },
];
{
  const TW = 260;
  const TH = 430;
  const W = PAD * 2 + COLS * TW + (COLS - 1) * GAP;
  const H = PAD * 2 + HEADER + ZOOM.length * (TH + GAP) - GAP;
  let sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#ffffff"/>
<text x="${PAD}" y="${PAD + 26}" font-family="DejaVu Sans" font-size="24" font-weight="bold" fill="#241f36">Акценты: клинок крупным планом</text>
<text x="${PAD}" y="${PAD + 47}" font-family="DejaVu Sans" font-size="14" fill="#6b6480">Тот же кадр с обрезкой по лезвию: видно, что перекрашивается и лезвие, и ореол.</text>`;
  ZOOM.forEach((zoom, rowIndex) => {
    const cells = rows.find((r) => r.costume === zoom.costume)!.cells;
    cells.forEach((cell, colIndex) => {
      const cx = PAD + colIndex * (TW + GAP);
      const cy = PAD + HEADER + rowIndex * (TH + GAP);
      const badges = [cell.glow, cell.cape]
        .filter((fill): fill is string => Boolean(fill))
        .map(
          (fill, badgeIndex) =>
            `<circle cx="${TW - 22 - badgeIndex * 22}" cy="22" r="9" fill="${fill}" stroke="#241f36" stroke-opacity=".15"/>`,
        )
        .join('');
      sheet += `<g transform="translate(${cx} ${cy})">
<rect width="${TW}" height="${TH}" rx="18" fill="#fff8ec" stroke="#efe9dd"/>
${badges}
<svg x="10" y="34" width="${TW - 20}" height="${TH - 96}" viewBox="${zoom.view}">${mascotSvg(zoom.costume, cell.tintId)}</svg>
<text x="${TW / 2}" y="${TH - 40}" text-anchor="middle" font-family="DejaVu Sans" font-size="16" font-weight="bold" fill="#241f36">${esc(COSTUMES.find((c) => c.id === zoom.costume)!.title)}</text>
<text x="${TW / 2}" y="${TH - 18}" text-anchor="middle" font-family="DejaVu Sans" font-size="13" fill="#6b6480">${esc(cell.label)}</text>
</g>`;
    });
  });
  sheet += '</svg>';
  writeFileSync(`${process.env.OUT_DIR}/accents-zoom.svg`, sheet);
  console.log('zoom sheet: accents-zoom');
}

console.log('svg written:', sheets, 'sheets');

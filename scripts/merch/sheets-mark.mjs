// Лист «знак»: проверка перерисовки против логотипа, замки, печати, сетка.
// Это не товар, а фундамент: пока знак не совпадает с присланным логотипом,
// остальное рисовать рано.

import {
  C,
  mark,
  lockupH,
  lockupV,
  seal,
  paper,
  svgDoc,
  text,
  yearText,
  MARK_BOX,
} from './brand.mjs';

/** Знак крупно в четырёхцветной и одноцветной версиях + печать. */
function systemSheet() {
  const w = 1600;
  const h = 1000;
  const s = 3.2;
  const body =
    paper(w, h) +
    text(90, 110, 'ЗНАК', { size: 26, color: '#8A7F6B', spacing: 6 }) +
    `<g transform="translate(${90 - MARK_BOX.x * s} ${150 - MARK_BOX.y * s})">${mark({ scale: s, color: true })}</g>` +
    `<g transform="translate(${100 - MARK_BOX.x * 1.6} ${640 - MARK_BOX.y * 1.6})">${mark({ scale: 1.6, color: false, mono: C.navy })}</g>` +
    `<g transform="translate(${470 - MARK_BOX.x * 1.6} ${640 - MARK_BOX.y * 1.6})">${mark({ scale: 1.6, color: false, mono: C.red })}</g>` +
    `<rect x="880" y="600" width="650" height="330" rx="8" fill="${C.navy}"/>` +
    `<g transform="translate(${1010 - MARK_BOX.x * 1.1} ${660 - MARK_BOX.y * 1.1})">${mark({ scale: 1.1, color: false, mono: C.cream })}</g>` +
    `<g transform="translate(1010 130)">${seal({ r: 155, color: C.blue, id: 'sb' })}</g>`;
  return svgDoc(w, h, body);
}

/** Горизонтальный и вертикальный замки, размеры, «ш к о л а» вразрядку. */
function lockupSheet() {
  const w = 1600;
  const h = 900;
  const body =
    paper(w, h) +
    text(90, 110, 'СЛОВЕСНЫЕ ЗАМКИ', { size: 26, color: '#8A7F6B', spacing: 6 }) +
    `<g transform="translate(0 180)">${lockupH({ h: 120, color: C.blue })}</g>` +
    `<g transform="translate(80 560)">${lockupH({ h: 64, color: C.navy, colorMark: true })}</g>` +
    `<g transform="translate(1100 180)">${lockupV({ h: 150, color: C.blue })}</g>`;
  return svgDoc(w, h, body);
}

export function markSheets(shot) {
  return Promise.all([
    shot('mark-system', systemSheet(), 1600),
    shot('mark-lockups', lockupSheet(), 1600),
  ]);
}

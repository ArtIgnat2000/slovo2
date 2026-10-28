// Карточка предмета: одна и та же «съёмка» для всей коллекции.
// 900×1120 — тот же ритм, что у карточек магазина БУКа: предмет сверху,
// название и одна строка пользы снизу, палитра доступных выкрасок в углу.

import { C, paper, svgDoc, text, MARK_BOX } from './brand.mjs';

export function productCard({
  w = 900,
  h = 1120,
  art,
  name,
  sub,
  tag = null,
  palette = [],
  tint = C.paper,
  note = null,
}) {
  return svgDoc(w, h, paper(w, h, tint) + art + cardChrome({ w, h, name, sub, tag, palette, note }));
}

/**
 * Только «обвязка» карточки — метка, палитра, линейка, название и подпись.
 * Нужна, когда предмет собран не вектором, а растром (фотография): тогда
 * бумага и фото склеиваются в sharp, а этот слой кладётся сверху.
 */
export function cardChrome({ w = 900, h = 1120, name, sub, tag = null, palette = [], note = null }) {
  const labelY = h - 96;
  const tagSvg = tag
    ? `<g transform="translate(56 56)">` +
      `<rect x="0" y="0" width="${tag.length * 13.4 + 44}" height="50" rx="25" fill="rgba(10,44,94,.07)"/>` +
      text(tag.length * 6.7 + 22, 33, tag, { size: 21, color: C.blue, anchor: 'middle', spacing: 2.2 }) +
      `</g>`
    : '';
  const paletteSvg = palette.length
    ? `<g transform="translate(${w - 56} 81)">` +
      palette
        .map(
          (col, i) =>
            `<circle cx="${-i * 34}" cy="0" r="13" fill="${col}" stroke="rgba(20,26,36,.12)" stroke-width="1.2"/>`,
        )
        .join('') +
      `</g>`
    : '';
  return (
    tagSvg +
    paletteSvg +
    `<path d="M56 ${labelY - 62} H${w - 56}" stroke="rgba(20,26,36,.10)" stroke-width="1.5"/>` +
    text(w / 2, labelY, name, { size: 34, color: C.ink, anchor: 'middle', spacing: 0.2 }) +
    (sub ? text(w / 2, labelY + 44, sub, { size: 25, weight: 500, color: '#7B7566', anchor: 'middle' }) : '') +
    (note ? text(w / 2, labelY + 82, note, { size: 20, weight: 500, color: '#9A9384', anchor: 'middle' }) : '')
  );
}

/** Заголовок раздела — тёмная плашка с замком и перечнем. */
export function sectionCard({ w = 1400, h = 520, title, lead, kind = 'dark', art = '' }) {
  const dark = kind === 'dark';
  const bg = dark ? C.navyDeep : C.paper;
  const fg = dark ? C.cream : C.navy;
  return svgDoc(
    w,
    h,
    `<rect width="${w}" height="${h}" fill="${bg}"/>` +
      (dark
        ? `<defs><radialGradient id="glow" cx="82%" cy="10%" r="70%"><stop offset="0" stop-color="#1B4C92" stop-opacity="0.85"/><stop offset="1" stop-color="#061B3D" stop-opacity="0"/></radialGradient></defs><rect width="${w}" height="${h}" fill="url(#glow)"/>`
        : '') +
      art +
      text(90, 150, title, { size: 64, color: fg, spacing: -0.5 }) +
      (lead ? text(92, 226, lead, { size: 28, weight: 500, color: dark ? '#A9BBD6' : '#6E6858' }) : ''),
  );
}

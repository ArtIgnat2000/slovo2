// Фирменный слой мерча НААШ: палитра, знак, замки, печать, бумага для съёмки.
//
// Знак перерисован вектором по растровым версиям логотипа, которые прислала
// школа (logo_naash2…5.jpg). Пропорции сняты с растра по пикселям, а не «на глаз»:
//   • высота капители (буквы НААШ) = 100 единиц, ширина буквы = 28,
//     толщина штамба = 6, шаг букв = 35;
//   • горизонтальная планка у «Н» и «А» — на 75-й единице от верха,
//     у «Ш» — подошва по базовой линии;
//   • крыша: карниз на −11, конёк внешнего ската на −67, внутреннего на −40,
//     вылет карниза 33 единицы, оконце-арка под коньком;
//   • печатная линейка — на 112-й единице, толщиной 6, по ширине блока букв.
// Одной геометрией закрываются оба сценария печати: цветной знак (как в логотипе)
// и одноцветный (вышивка, тиснение, гравировка на технике).
//
// Шрифт — Golos Text (SIL OFL 1.1), кириллица, 500/700/900. Он ближе всего
// к набору логотипа: широкий геометрический гротеск с крупными просветами.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const FONT_DIR = path.resolve(HERE, '../../docs/merch/fonts');

let fontCss = null;
/** @font-face для SVG: sharp/резолвер не умеет системные шрифты, вшиваем base64. */
export function fonts() {
  if (fontCss) return fontCss;
  const face = (w) =>
    `@font-face{font-family:'Golos';font-weight:${w};src:url('data:font/woff2;base64,${readFileSync(
      path.join(FONT_DIR, `golos-text-cyrillic-${w}-normal.woff2`),
    ).toString('base64')}') format('woff2');}`;
  fontCss = face(500) + face(700) + face(900);
  return fontCss;
}

// ───────────────────────────────────────────────────────────────── палитра ──
/**
 * Палитра мерча. Синий снят с логотипа; красный/янтарный/зелёный — цвета
 * букв. Остальное — «гардероб» коллекции: крем и графит вместо неона,
 * чтобы вещь жила дольше одного сезона.
 */
export const C = {
  blue: '#0F4CA0',
  navy: '#0A2C5E',
  navyDeep: '#061B3D',
  red: '#D4212B',
  amber: '#F0A31C',
  green: '#2E8B45',
  sky: '#8FB7DC',
  cream: '#F4EFE4',
  paper: '#F3EEE5',
  bone: '#EDE6D8',
  ink: '#141A24',
  graphite: '#2B3140',
  stone: '#8D8577',
  clay: '#C96A45',
  plum: '#5C4A7D',
  white: '#FFFFFF',
};

// ──────────────────────────────────────────────────────────── геометрия знака ──
const CAP = 100;
const LW = 29; // ширина буквы
const STEM = 6.2; // толщина штамба
const ADV = 35; // шаг букв
const BLOCK = LW + ADV * 3; // 134 — полная ширина блока
const SILL = 75.6; // планка «Н» и «А» (в логотипе она ниже середины)
const ROOF = { eave: -12, ridge: -70, innerRidge: -50, overhang: 30, stroke: 8.6, inner: 7.4 };
const WINDOW = { r: 15, stroke: 7 };
const RULE = { y: 112, h: 6, w: BLOCK };

const mid = (x0) => x0 + LW / 2;
const left = (x0) => x0 + STEM / 2;
const right = (x0) => x0 + LW - STEM / 2;

/** «Н» — два штамба и низкая планка (как в логотипе, не по центру). */
function letterH(x0, color) {
  return (
    `<path d="M${left(x0)} ${CAP} V0 M${right(x0)} ${CAP} V0 M${left(x0)} ${SILL} H${right(x0)}" ` +
    `fill="none" stroke="${color}" stroke-width="${STEM}"/>`
  );
}

/** «А» — домик: крутой двускатник, стены до базовой линии, планка-подоконник. */
function letterA(x0, color) {
  const kneeY = 47;
  return (
    `<path d="M${left(x0)} ${CAP} V${kneeY} L${mid(x0)} 0 L${right(x0)} ${kneeY} V${CAP} M${left(x0)} ${SILL} H${right(x0)}" ` +
    `fill="none" stroke="${color}" stroke-width="${STEM}" stroke-linejoin="miter"/>`
  );
}

/** «Ш» — три штамба и подошва по базовой линии. */
function letterSha(x0, color) {
  const floor = CAP - STEM / 2;
  return (
    `<path d="M${left(x0)} 0 V${CAP} M${mid(x0)} 0 V${floor} M${right(x0)} 0 V${CAP} ` +
    `M${left(x0)} ${floor} H${right(x0)}" fill="none" stroke="${color}" stroke-width="${STEM}"/>`
  );
}

/**
 * Скат крыши как замкнутая полоса-шеврон: два ската, вертикальные торцы,
 * глухой стык в коньке. Полосы (а не обводки) дают чистые углы при печати —
 * у штриха в коньке вылезал бы «шип» miter-стыка.
 */
function chevron({ eaveY, ridgeY, thickness, halfWidth }) {
  const { eave } = ROOF;
  const t = thickness / 2;
  const cx = BLOCK / 2;
  // Внутренняя кромка скатов: по всей длине полосы одинаковой толщины по вертикали.
  return (
    `M${cx - halfWidth} ${eaveY + t} L${cx} ${ridgeY + t} L${cx + halfWidth} ${eaveY + t} ` +
    `L${cx + halfWidth} ${eaveY - t} L${cx} ${ridgeY - t} L${cx - halfWidth} ${eaveY - t} Z`
  );
}

/** Крыша: внешний и внутренний скат, оконце-арка. */
function roof({ color, window: win = true }) {
  const { eave, ridge, innerRidge, overhang, stroke, inner } = ROOF;
  const cx = BLOCK / 2;
  const outer = `<path d="${chevron({ eaveY: eave, ridgeY: ridge, thickness: stroke, halfWidth: cx + overhang })}" fill="${color}"/>`;
  const innerBand = `<path d="${chevron({
    eaveY: eave,
    ridgeY: innerRidge,
    thickness: inner,
    halfWidth: cx + overhang - 21,
  })}" fill="${color}"/>`;
  const { r, stroke: archStroke } = WINDOW;
  const arch = win
    ? `<path d="M${cx - r} ${eave} A${r} ${r} 0 0 1 ${cx + r} ${eave}" ` +
      `fill="none" stroke="${color}" stroke-width="${archStroke}"/>`
    : '';
  return outer + innerBand + arch;
}

/**
 * Знак «НААШ».
 * @param {object} o
 * @param {boolean} [o.color]  четыре цвета букв; false — всё одним цветом
 * @param {string}  [o.mono]   цвет одноцветной версии (по умолчанию navy)
 * @param {number}  [o.scale]  1 = капитель 100 px
 * @param {boolean} [o.rule]   печатная линейка
 * @param {boolean} [o.window] оконце под коньком
 */
export function mark({ color = true, mono = C.navy, scale = 1, rule = true, window: win = true } = {}) {
  const red = color ? C.red : mono;
  const amber = color ? C.amber : mono;
  const green = color ? C.green : mono;
  const blue = color ? C.blue : mono;
  const letters =
    letterH(0, red) + letterA(ADV, amber) + letterA(ADV * 2, green) + letterSha(ADV * 3, blue);
  const bar = rule
    ? `<rect x="0" y="${RULE.y}" width="${RULE.w}" height="${RULE.h}" rx="0.6" fill="${color ? C.blue : mono}"/>`
    : '';
  return `<g transform="scale(${scale})">${roof({ color: color ? C.blue : mono, window: win })}${letters}${bar}</g>`;
}

/** Габариты знака в единицах (0 — верх капители). */
export const MARK_BOX = {
  x: -ROOF.overhang - ROOF.stroke / 2,
  y: ROOF.ridge - ROOF.stroke / 2,
  w: BLOCK + (ROOF.overhang + ROOF.stroke / 2) * 2,
  h: RULE.y + RULE.h - (ROOF.ridge - ROOF.stroke / 2),
};

// ─────────────────────────────────────────────────────────── словесный замок ──
const LINES = ['НИЖЕГОРОДСКАЯ', 'АВТОРСКАЯ', 'АКАДЕМИЧЕСКАЯ', 'Ш К О Л А'];

/**
 * Горизонтальный замок: знак слева, четыре строки названия справа —
 * как в основном логотипе школы. Высота капители знака = h.
 * Возвращает разметку в координатах (0,0) — левый верх габарита.
 */
export function lockupH({ h = 100, color = C.blue, colorMark = true, gap = 0.22 } = {}) {
  const s = h / 100;
  // Пропорции сняты с исходного логотипа по пикселям (logo_naash2.jpg, 517×350):
  // знак 203 px, просвет 23 px, текст 244 px; высота строки ≈ 47 px при
  // капители знака 98 px → кегль 0,30 капители, интерлиньяж 1,32.
  const fs = 0.30 * h;
  const lineH = fs * 1.32;
  const ox = -MARK_BOX.x * s;
  const oy = -MARK_BOX.y * s;
  // Текст ставим за габаритом знака (а не за блоком букв): крыша выступает
  // вправо, и при расчёте от BLOCK первая строка прилипала к скату.
  const textX = ox + MARK_BOX.w * s + gap * h;
  const blockH = lineH * 3 + fs * 0.72;
  const firstBaseline = oy + CAP * s * 0.5 - blockH / 2 + fs * 0.72;
  const rows = LINES.map(
    (line, i) =>
      `<text x="${textX}" y="${firstBaseline + lineH * i}" ${font(700)} font-size="${fs}" ` +
      `letter-spacing="${line.includes(' ') ? fs * 0.28 : fs * -0.005}" fill="${color}">${line}</text>`,
  ).join('');
  return (
    `<g transform="translate(${ox} ${oy})">${mark({ scale: s, color: colorMark })}</g>` + rows
  );
}

/**
 * Вертикальный замок: знак, четыре строки по центру — для нашивки,
 * бирки, оборота упаковки.
 */
export function lockupV({ h = 100, color = C.blue, colorMark = true, gap = 0.34 } = {}) {
  const s = h / 100;
  const fs = 0.24 * h;
  const ox = -MARK_BOX.x * s;
  const oy = -MARK_BOX.y * s;
  const cx = ox + (BLOCK / 2) * s;
  const top = oy + (RULE.y + RULE.h) * s + gap * h + fs * 0.78;
  const rows = ['НИЖЕГОРОДСКАЯ', 'АВТОРСКАЯ', 'АКАДЕМИЧЕСКАЯ', 'ШКОЛА']
    .map(
      (line, i) =>
        `<text x="${cx}" y="${top + fs * 1.4 * i}" text-anchor="middle" ${font(700)} ` +
        `font-size="${fs}" letter-spacing="${i === 3 ? fs * 0.3 : fs * 0.012}" fill="${color}">${line}</text>`,
    )
    .join('');
  return (
    `<g transform="translate(${ox} ${oy})">${mark({ scale: s, color: colorMark })}</g>` + rows
  );
}

/** Подпись «1995» — год основания. */
export const yearText = (x, y, size, color = C.blue) =>
  `<text x="${x}" y="${y}" text-anchor="middle" ${font(700)} font-size="${size}" ` +
  `letter-spacing="${size * 0.16}" fill="${color}">1995</text>`;

/**
 * Круглая печать: кольцо с названием по дуге, знак в центре, год внизу.
 * Штамп ложится на крафт-пакет, тоут и оборот футболки.
 */
export function seal({ r = 100, color = C.blue, bg = null, id = 'seal' } = {}) {
  const arcR = r * 0.38;
  // Дуга от 200° до 340° (по часовой) — верхняя половина, текст идёт слева направо.
  const arc =
    `M${r - arcR} ${r} A${arcR} ${arcR} 0 1 1 ${r + arcR} ${r}`;
  const label = 'НИЖЕГОРОДСКАЯ АВТОРСКАЯ АКАДЕМИЧЕСКАЯ ШКОЛА';
  const markH = r * 0.46;
  const markTop = r - markH * 0.72;
  return (
    (bg ? `<circle cx="${r}" cy="${r}" r="${r}" fill="${bg}"/>` : '') +
    `<circle cx="${r}" cy="${r}" r="${r - r * 0.03}" fill="none" stroke="${color}" stroke-width="${r * 0.02}"/>` +
    `<circle cx="${r}" cy="${r}" r="${r - r * 0.1}" fill="none" stroke="${color}" stroke-width="${r * 0.006}"/>` +
    `<defs><path id="${id}" d="${arc}" fill="none"/></defs>` +
    `<text ${font(700)} font-size="${r * 0.082}" fill="${color}" letter-spacing="${r * 0.014}">` +
    `<textPath href="#${id}" startOffset="2%">${label}</textPath></text>` +
    `<g transform="translate(${r - (markH * (BLOCK / CAP)) / 2 - r * 0.02} ${markTop - MARK_BOX.y * (markH / CAP)})">` +
    `${mark({ scale: markH / CAP, color: false, mono: color })}</g>` +
    yearText(r + r * 0.02, r + r * 0.58, r * 0.12, color) +
    `<path d="M${r - r * 0.3} ${r + r * 0.4} H${r - r * 0.16} M${r + r * 0.16} ${r + r * 0.4} H${r + r * 0.3}" stroke="${color}" stroke-width="${r * 0.008}"/>`
  );
}

/** Строка вразрядку («Ш К О Л А»). */
export const spaced = (str, size, color, weight = 700) =>
  `<text x="0" y="0" ${font(weight)} font-size="${size}" letter-spacing="${size * 0.3}" fill="${color}">${str}</text>`;

// ────────────────────────────────────────────────────────── типографика/текст ──
export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const font = (w = 500) => `font-family="Golos" font-weight="${w}"`;

export const text = (x, y, str, { size = 24, weight = 700, color = C.ink, anchor = 'start', spacing = 0 } = {}) =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" ${font(weight)} font-size="${size}"` +
  ` letter-spacing="${spacing}" fill="${color}">${esc(str)}</text>`;

// ──────────────────────────────────────────────────────────── сцена «съёмки» ──
export const DEFS = `
<filter id="ground" x="-50%" y="-50%" width="200%" height="200%">
  <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#231C10" flood-opacity="0.26"/>
</filter>
<filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
  <feDropShadow dx="0" dy="7" stdDeviation="9" flood-color="#231C10" flood-opacity="0.2"/>
</filter>
<filter id="lift" x="-60%" y="-60%" width="220%" height="220%">
  <feDropShadow dx="0" dy="30" stdDeviation="38" flood-color="#231C10" flood-opacity="0.3"/>
</filter>
<filter id="inner" x="-20%" y="-20%" width="140%" height="140%">
  <feGaussianBlur stdDeviation="2.2"/>
</filter>`;

/**
 * Бумага: тёплый фон, вертикальный градиент «свет сверху», мягкое световое
 * пятно за предметом, виньетка по краям и очень мелкое зерно.
 * Зерно даёт ощущение бумаги, а не заливки — на нём «держится» вся серия.
 */
export function paper(w, h, tint = C.paper) {
  const id = `vig${w}x${h}`;
  return (
    `<defs>` +
    `<linearGradient id="paperGrad" x1="0" y1="0" x2="0.15" y2="1">` +
    `<stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/>` +
    `<stop offset="0.5" stop-color="#ffffff" stop-opacity="0.06"/>` +
    `<stop offset="1" stop-color="#7A6B4E" stop-opacity="0.14"/>` +
    `</linearGradient>` +
    `<radialGradient id="${id}" cx="50%" cy="33%" r="72%">` +
    `<stop offset="0" stop-color="#ffffff" stop-opacity="0.75"/>` +
    `<stop offset="0.55" stop-color="#ffffff" stop-opacity="0.18"/>` +
    `<stop offset="1" stop-color="#7A6B4E" stop-opacity="0.1"/>` +
    `</radialGradient>` +
    `<filter id="grain" x="0" y="0" width="100%" height="100%">` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="11" result="n"/>` +
    `<feColorMatrix type="saturate" values="0" in="n"/>` +
    `</filter>` +
    `</defs>` +
    `<rect width="${w}" height="${h}" fill="${tint}"/>` +
    `<rect width="${w}" height="${h}" fill="url(#paperGrad)"/>` +
    `<rect width="${w}" height="${h}" fill="url(#${id})"/>` +
    `<rect width="${w}" height="${h}" filter="url(#grain)" opacity="0.045" style="mix-blend-mode:multiply"/>`
  );
}

/** Мягкая тень-подиум под предметом. */
export const podium = (cx, cy, rx, ry, op = 0.18) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#231C10" opacity="${op}"/>`;

/** Обёртка SVG с вшитым шрифтом и общими фильтрами. */
export function svgDoc(w, h, body, { bg = null } = {}) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<defs>${fonts()}</defs><defs>${DEFS}</defs>` +
    (bg ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : '') +
    body +
    `</svg>`
  );
}

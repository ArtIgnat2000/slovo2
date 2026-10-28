// Носители: одежда и ткани. Силуэты — вектор по одной сетке, печать
// накладывается «по крою» и клипается тканью.
//
// Сетка карточки 900×1120: арт живёт в полосе y=140…950, центр cx=450.
// Правила света: тело — плоский цвет, сверху мягкий радиальный блик,
// справа — тень; швы и резинки на пол-тона темнее тела; печать без своей тени.

import { C, mark, lockupV, lockupH, seal, text, font, MARK_BOX } from './brand.mjs';

export const shade = (hex, amt) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + amt)));
  return `#${[f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')}`;
};

/** Светлый или тёмный цвет полотна — от этого зависит сила блика и тени. */
export const isLight = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62;
};

const fabricDefs = (id, light, lightAt) => `
<linearGradient id="${id}" x1="0.15" y1="0" x2="0.85" y2="1">
  <stop offset="0" stop-color="#ffffff" stop-opacity="${light ? 0.26 : 0.12}"/>
  <stop offset="0.4" stop-color="#ffffff" stop-opacity="0"/>
  <stop offset="1" stop-color="#000000" stop-opacity="${light ? 0.1 : 0.24}"/>
</linearGradient>
${
  lightAt
    ? `<radialGradient id="${id}Light" gradientUnits="userSpaceOnUse" cx="${lightAt.cx}" cy="${lightAt.cy}" r="${lightAt.r}">
  <stop offset="0" stop-color="#ffffff" stop-opacity="${light ? 0.5 : 0.2}"/>
  <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
</radialGradient>`
    : ''
}`;

export const stitchLine = (d, color, w = 1.5, dash = '6 7') =>
  
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-dasharray="${dash}" opacity="0.65"/>`;

/** Резинка: полоса + тонкие вертикальные рёбра. */
const ribFill = (x, y, w, h, color, ribColor, vertical = true) => {
  const ribs = [];
  const step = Math.max(7, w / 26);
  for (let px = x + step / 2; px < x + w; px += step) {
    ribs.push(
      vertical
        ? `<path d="M${px} ${y + 2} V${y + h - 2}" stroke="${ribColor}" stroke-width="1.4" opacity="0.5"/>`
        : `<path d="M${x + 2} ${px} H${x + w - 2}" stroke="${ribColor}" stroke-width="1.4" opacity="0.4"/>`,
    );
  }
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}"/>${ribs.join('')}`;
};

// ─────────────────────────────────────────────────────── футболка ──
function teeGeometry(cx, top, w, h, neck = 'front') {
  const neckHalf = w * (neck === 'back' ? 0.1 : 0.105);
  const neckDepth = h * (neck === 'back' ? 0.02 : 0.05);
  const shoulder = { x: w * 0.35, y: top + h * 0.012 };
  const sleeveTop = { x: w * 0.455, y: top + h * 0.075 };
  const sleeveHemOut = { x: w * 0.505, y: top + h * 0.245 };
  const sleeveHemIn = { x: w * 0.415, y: top + h * 0.29 };
  const armpit = { x: w * 0.35, y: top + h * 0.205 };
  const hem = { x: w * 0.385, y: top + h };
  const path =
    `M${cx - neckHalf} ${top + neckDepth * 0.4} ` +
    `C${cx - neckHalf - w * 0.05} ${top} ${cx - shoulder.x * 0.7} ${top - h * 0.004} ${cx - shoulder.x} ${shoulder.y} ` +
    `Q${cx - sleeveTop.x + w * 0.012} ${sleeveTop.y - h * 0.014} ${cx - sleeveTop.x} ${sleeveTop.y} ` +
    `L${cx - sleeveHemOut.x} ${sleeveHemOut.y} ` +
    `Q${cx - sleeveHemOut.x + w * 0.012} ${sleeveHemOut.y + h * 0.017} ${cx - sleeveHemIn.x + w * 0.008} ${sleeveHemIn.y} ` +
    `L${cx - armpit.x} ${armpit.y} L${cx - hem.x} ${hem.y - h * 0.012} ` +
    `Q${cx} ${hem.y + h * 0.018} ${cx + hem.x} ${hem.y - h * 0.012} ` +
    `L${cx + armpit.x} ${armpit.y} L${cx + sleeveHemIn.x - w * 0.008} ${sleeveHemIn.y} ` +
    `Q${cx + sleeveHemOut.x - w * 0.012} ${sleeveHemOut.y + h * 0.017} ${cx + sleeveHemOut.x} ${sleeveHemOut.y} ` +
    `L${cx + sleeveTop.x} ${sleeveTop.y} ` +
    `Q${cx + sleeveTop.x - w * 0.012} ${sleeveTop.y - h * 0.014} ${cx + shoulder.x} ${shoulder.y} ` +
    `C${cx + shoulder.x * 0.7} ${top - h * 0.004} ${cx + neckHalf + w * 0.05} ${top} ${cx + neckHalf} ${top + neckDepth * 0.4} ` +
    `Q${cx} ${top + neckDepth * 2.2} ${cx - neckHalf} ${top + neckDepth * 0.4} Z`;
  return { path, neckHalf, neckDepth, shoulder, sleeveTop, sleeveHemOut, sleeveHemIn, armpit, hem };
}

export function tee({
  cx = 450,
  top = 250,
  w = 600,
  h = 610,
  body = C.cream,
  trim = null,
  print = null,
  printY = 0.36,
  printW = 0.34,
  neck = 'front',
} = {}) {
  const g = teeGeometry(cx, top, w, h, neck);
  const light = isLight(body);
  const edge = shade(body, light ? -26 : -34);
  const rib = trim ?? shade(body, light ? -12 : 16);
  const neckCurve = `M${cx - g.neckHalf} ${top + g.neckDepth * 0.4} Q${cx} ${top + g.neckDepth * 2.2} ${cx + g.neckHalf} ${top + g.neckDepth * 0.4}`;
  return (
    `<defs><clipPath id="teeClip"><path d="${g.path}"/></clipPath>${fabricDefs('tee', light, {
      cx: cx - w * 0.06,
      cy: top + h * 0.4,
      r: w * 0.62,
    })}</defs>` +
    `<g filter="url(#ground)">` +
    `<path d="${g.path}" fill="${body}"/>` +
    `<g clip-path="url(#teeClip)">` +
    `<rect x="${cx - w}" y="${top - 60}" width="${w * 2}" height="${h * 1.7}" fill="url(#tee)"/>` +
    `<rect x="${cx - w}" y="${top - 40}" width="${w * 2}" height="${h * 1.6}" fill="url(#teeLight)"/>` +
    (print ? `<g transform="translate(${cx} ${top + h * printY})">${print(printW * w)}</g>` : '') +
    `</g>` +
    `<path d="${neckCurve} Q${cx} ${top + g.neckDepth * 2.2 + h * 0.02} ${cx - g.neckHalf} ${top + g.neckDepth * 0.4} Z" fill="${rib}"/>` +
    `<path d="${neckCurve}" fill="none" stroke="${edge}" stroke-width="1.5" opacity="0.5"/>` +
    `<path d="M${cx - g.armpit.x - w * 0.06} ${g.armpit.y - h * 0.06} L${cx - g.armpit.x} ${g.armpit.y}" stroke="${edge}" stroke-width="1.3" opacity="0.35"/>` +
    `<path d="M${cx + g.armpit.x + w * 0.06} ${g.armpit.y - h * 0.06} L${cx + g.armpit.x} ${g.armpit.y}" stroke="${edge}" stroke-width="1.3" opacity="0.35"/>` +
    stitchLine(
      `M${cx - g.hem.x + 10} ${g.hem.y - h * 0.006} Q${cx} ${g.hem.y + h * 0.012} ${cx + g.hem.x - 10} ${g.hem.y - h * 0.006}`,
      edge,
    ) +
    `</g>`
  );
}

// ─────────────────────────────────────────────────────────── поло ──
export function polo({ cx = 450, top = 250, w = 600, h = 610, body = C.blue, trim = null, print = null, printW = 0.18 } = {}) {
  const light = isLight(body);
  const edge = shade(body, light ? -30 : -34);
  const nh = w * 0.105;                 // полуширина горловины
  const nd = h * 0.05;                  // глубина горловины
  const nY = top + nd * 0.4;
  const bandTop = nY - h * 0.042;       // верх стойки
  const collarCol = trim ?? shade(body, light ? -14 : 16);
  // Отдельная база: горловина затемнена — это «внутренность», а не светлая заплатка.
  const base = tee({ cx, top, w, h, body, trim: shade(body, light ? -26 : -30), print: null });

  // Стойка: верхняя кромка чуть поднимается к центру, концы отходят к плечам.
  const collar =
    `M${cx - nh - w * 0.02} ${nY - h * 0.012} ` +
    `Q${cx} ${bandTop} ${cx + nh + w * 0.02} ${nY - h * 0.012} ` +
    `L${cx + nh} ${nY + nd * 0.4} ` +
    `Q${cx} ${nY + nd * 1.9} ${cx - nh} ${nY + nd * 0.4} Z`;
  const collarTopEdge = `M${cx - nh - w * 0.02} ${nY - h * 0.012} Q${cx} ${bandTop} ${cx + nh + w * 0.02} ${nY - h * 0.012}`;

  const pw = w * 0.034;                 // полуширина планки
  const placketTop = nY + nd * 0.9;
  const placketBottom = nY + h * 0.2;
  const placket =
    `M${cx - pw} ${placketTop} V${placketBottom} Q${cx} ${placketBottom + h * 0.006} ${cx + pw} ${placketBottom} V${placketTop} Z`;

  return (
    base +
    // планка под стойкой
    `<path d="${placket}" fill="${shade(body, light ? -7 : 9)}"/>` +
    `<path d="M${cx - pw} ${placketTop} V${placketBottom} M${cx + pw} ${placketTop} V${placketBottom}" stroke="${edge}" stroke-width="1.1" opacity="0.55"/>` +
    `<path d="M${cx - pw * 0.35} ${placketTop + h * 0.012} V${placketBottom - h * 0.01} M${cx + pw * 0.35} ${placketTop + h * 0.012} V${placketBottom - h * 0.01}" stroke="${edge}" stroke-width="0.9" opacity="0.28"/>` +
    `<circle cx="${cx}" cy="${placketTop + h * 0.045}" r="${w * 0.008}" fill="${shade(body, light ? -34 : 40)}"/>` +
    `<circle cx="${cx}" cy="${placketTop + h * 0.105}" r="${w * 0.008}" fill="${shade(body, light ? -34 : 40)}"/>` +
    // тень горловины под стойкой: иначе воротник «наклеен» на плоскую ткань
    `<path d="M${cx - nh - w * 0.02} ${nY - h * 0.012} Q${cx} ${bandTop} ${cx + nh + w * 0.02} ${nY - h * 0.012} ` +
    `L${cx + nh} ${nY + nd * 0.6} Q${cx} ${nY + nd * 2.2} ${cx - nh} ${nY + nd * 0.6} Z" fill="#000" opacity="${light ? 0.06 : 0.18}"/>` +
    // стойка
    `<path d="${collar}" fill="${collarCol}"/>` +
    `<path d="${collarTopEdge}" fill="none" stroke="${shade(body, light ? -38 : 30)}" stroke-width="1.4" opacity="0.55"/>` +
    `<path d="M${cx - nh} ${nY + nd * 0.4} Q${cx} ${nY + nd * 1.9} ${cx + nh} ${nY + nd * 0.4}" fill="none" stroke="${shade(body, light ? -40 : 34)}" stroke-width="1.2" opacity="0.45"/>` +
    (print ? `<g transform="translate(${cx + w * 0.19} ${top + h * 0.24})">${print(printW * w)}</g>` : '')
  );
}

// ───────────────────────────────────────────────────────── лонгслив ──
export function longSleeve({ cx = 450, top = 240, w = 580, h = 660, body = C.white, trim = null, print = null, printY = 0.34, printW = 0.3 } = {}) {
  const light = isLight(body);
  const edge = shade(body, light ? -24 : -32);
  const neckHalf = w * 0.105;
  const neckDepth = h * 0.048;
  const shoulder = { x: w * 0.35, y: top + h * 0.014 };
  const cuffOut = { x: w * 0.47, y: top + h * 0.52 };
  const cuffIn = { x: w * 0.395, y: top + h * 0.55 };
  const armpit = { x: w * 0.35, y: top + h * 0.2 };
  const hem = { x: w * 0.39, y: top + h };
  const path =
    `M${cx - neckHalf} ${top + neckDepth * 0.4} ` +
    `C${cx - neckHalf - w * 0.05} ${top} ${cx - shoulder.x * 0.7} ${top - h * 0.004} ${cx - shoulder.x} ${shoulder.y} ` +
    `L${cx - cuffOut.x} ${cuffOut.y} L${cx - cuffIn.x} ${cuffIn.y} L${cx - armpit.x} ${armpit.y} ` +
    `L${cx - hem.x} ${hem.y - h * 0.01} Q${cx} ${hem.y + h * 0.016} ${cx + hem.x} ${hem.y - h * 0.01} ` +
    `L${cx + armpit.x} ${armpit.y} L${cx + cuffIn.x} ${cuffIn.y} L${cx + cuffOut.x} ${cuffOut.y} ` +
    `L${cx + shoulder.x} ${shoulder.y} ` +
    `C${cx + shoulder.x * 0.7} ${top - h * 0.004} ${cx + neckHalf + w * 0.05} ${top} ${cx + neckHalf} ${top + neckDepth * 0.4} ` +
    `Q${cx} ${top + neckDepth * 2.2} ${cx - neckHalf} ${top + neckDepth * 0.4} Z`;
  const neckCurve = `M${cx - neckHalf} ${top + neckDepth * 0.4} Q${cx} ${top + neckDepth * 2.2} ${cx + neckHalf} ${top + neckDepth * 0.4}`;
  return (
    `<defs><clipPath id="lsClip"><path d="${path}"/></clipPath>${fabricDefs('ls', light, {
      cx: cx - w * 0.05,
      cy: top + h * 0.38,
      r: w * 0.6,
    })}</defs>` +
    `<g filter="url(#ground)"><path d="${path}" fill="${body}"/>` +
    `<g clip-path="url(#lsClip)">` +
    `<rect x="${cx - w}" y="${top - 60}" width="${w * 2}" height="${h * 1.7}" fill="url(#ls)"/>` +
    `<rect x="${cx - w}" y="${top - 60}" width="${w * 2}" height="${h * 1.7}" fill="url(#lsLight)"/>` +
    `<path d="M${cx - armpit.x} ${armpit.y} Q${cx - w * 0.34} ${top + h * 0.6} ${cx - w * 0.36} ${top + h}" stroke="#000" stroke-opacity="0.05" stroke-width="${w * 0.05}" fill="none"/>` +
    `<path d="M${cx + armpit.x} ${armpit.y} Q${cx + w * 0.34} ${top + h * 0.6} ${cx + w * 0.36} ${top + h}" stroke="#000" stroke-opacity="0.06" stroke-width="${w * 0.05}" fill="none"/>` +
    (print ? `<g transform="translate(${cx} ${top + h * printY})">${print(printW * w)}</g>` : '') +
    `</g>` +
    `<path d="${neckCurve} Q${cx} ${top + neckDepth * 2.2 + h * 0.018} ${cx - neckHalf} ${top + neckDepth * 0.4} Z" fill="${trim ?? shade(body, light ? -12 : 16)}"/>` +
    `<path d="${neckCurve}" fill="none" stroke="${edge}" stroke-width="1.4" opacity="0.5"/>` +
    // манжеты
    `<path d="M${cx - cuffOut.x} ${cuffOut.y} L${cx - cuffIn.x} ${cuffIn.y} l${w * 0.012} ${h * 0.038} L${cx - cuffOut.x + w * 0.02} ${cuffOut.y + h * 0.036} Z" fill="${shade(body, light ? -10 : 14)}"/>` +
    `<path d="M${cx + cuffOut.x} ${cuffOut.y} L${cx + cuffIn.x} ${cuffIn.y} l-${w * 0.012} ${h * 0.038} L${cx + cuffOut.x - w * 0.02} ${cuffOut.y + h * 0.036} Z" fill="${shade(body, light ? -10 : 14)}"/>` +
    stitchLine(`M${cx - hem.x + 10} ${hem.y - h * 0.006} Q${cx} ${hem.y + h * 0.01} ${cx + hem.x - 10} ${hem.y - h * 0.006}`, edge) +
    `</g>`
  );
}

// ───────────────────────────────────────────────────────── худи ──
/**
 * Рукав «вниз»: от плеча S к манжете, манжета — четырёхугольник поперёк
 * рукава. Возвращает точки и разметку манжеты, чтобы вещь и худи, и свитшот
 * строились по одной сетке.
 */
function sleeveShape(side, cx, top, w, h) {
  const S = { x: cx + side * w * 0.385, y: top + h * 0.055 };
  const O = { x: cx + side * w * 0.45, y: top + h * 0.6 };
  const I = { x: cx + side * w * 0.35, y: top + h * 0.655 };
  const A = { x: cx + side * w * 0.315, y: top + h * 0.21 };
  const H = { x: cx + side * w * 0.37, y: top + h };
  const dx = I.x - O.x;
  const dy = I.y - O.y;
  const len = Math.hypot(dx, dy) || 1;
  const n = { x: -(dy / len), y: dx / len };
  const t = h * 0.06;
  const cuff = [
    O,
    I,
    { x: I.x + n.x * t, y: I.y + n.y * t },
    { x: O.x + n.x * t, y: O.y + n.y * t },
  ];
  return { S, O, I, A, H, cuff, cuffColor: null };
}

const poly = (pts, fill, extra = '') =>
  `<path d="M${pts.map((p) => `${p.x} ${p.y}`).join(' L')} Z" fill="${fill}" ${extra}/>`;

export function hoodie({
  cx = 450,
  top = 320,
  w = 640,
  h = 600,
  body = C.navy,
  trim = null,
  print = null,
  printY = 0.3,
  printW = 0.26,
} = {}) {
  const light = isLight(body);
  const edge = shade(body, light ? -28 : -34);
  const ribCol = trim ?? shade(body, light ? -10 : 18);
  const L = sleeveShape(-1, cx, top, w, h);
  const R = sleeveShape(1, cx, top, w, h);
  const neckHalf = w * 0.1;
  const neckDepth = h * 0.045;
  const path =
    `M${cx - neckHalf} ${top + neckDepth * 0.5} ` +
    `C${cx - w * 0.19} ${top - h * 0.01} ${cx - L.S.x + cx + w * 0.02} ${top + h * 0.01} ${L.S.x} ${L.S.y} ` +
    `L${L.O.x} ${L.O.y} L${L.I.x} ${L.I.y} L${L.A.x} ${L.A.y} ` +
    `L${L.H.x} ${L.H.y - h * 0.012} ` +
    `Q${cx} ${top + h + h * 0.016} ${R.H.x} ${R.H.y - h * 0.012} ` +
    `L${R.A.x} ${R.A.y} L${R.I.x} ${R.I.y} L${R.O.x} ${R.O.y} L${R.S.x} ${R.S.y} ` +
    `C${cx + w * 0.19} ${top + h * 0.01} ${cx + neckHalf + w * 0.06} ${top - h * 0.01} ${cx + neckHalf} ${top + neckDepth * 0.5} ` +
    `Q${cx} ${top + neckDepth * 2.2} ${cx - neckHalf} ${top + neckDepth * 0.5} Z`;
  const pocket =
    `M${cx - w * 0.225} ${top + h * 0.6} Q${cx - w * 0.19} ${top + h * 0.645} ${cx - w * 0.14} ${top + h * 0.645} ` +
    `H${cx + w * 0.14} Q${cx + w * 0.19} ${top + h * 0.645} ${cx + w * 0.225} ${top + h * 0.6} ` +
    `L${cx + w * 0.205} ${top + h * 0.9} H${cx - w * 0.205} Z`;
  return (
    `<defs><clipPath id="hoodClip"><path d="${path}"/></clipPath>${fabricDefs('hd', light, {
      cx: cx - w * 0.06,
      cy: top + h * 0.42,
      r: w * 0.66,
    })}</defs>` +
    `<g filter="url(#ground)">` +
    // капюшон за плечами
    `<path d="M${cx - w * 0.225} ${top + h * 0.1} C${cx - w * 0.235} ${top + h * 0.005} ${cx - w * 0.11} ${top - h * 0.03} ${cx} ${top - h * 0.03} C${cx + w * 0.11} ${top - h * 0.03} ${cx + w * 0.235} ${top + h * 0.005} ${cx + w * 0.225} ${top + h * 0.1} C${cx + w * 0.12} ${top + h * 0.06} ${cx - w * 0.12} ${top + h * 0.06} ${cx - w * 0.225} ${top + h * 0.1} Z" fill="${shade(body, light ? -12 : -18)}"/>` +
    `<path d="M${cx - w * 0.225} ${top + h * 0.1} C${cx - w * 0.235} ${top + h * 0.005} ${cx - w * 0.11} ${top - h * 0.03} ${cx} ${top - h * 0.03} C${cx + w * 0.11} ${top - h * 0.03} ${cx + w * 0.235} ${top + h * 0.005} ${cx + w * 0.225} ${top + h * 0.1}" fill="none" stroke="${shade(body, light ? 24 : 34)}" stroke-width="1.6" opacity="0.4"/>` +
    `<path d="${path}" fill="${body}"/>` +
    `<g clip-path="url(#hoodClip)">` +
    `<rect x="${cx - w}" y="${top - 140}" width="${w * 2}" height="${h * 2}" fill="url(#hd)"/>` +
    `<rect x="${cx - w}" y="${top - 140}" width="${w * 2}" height="${h * 2}" fill="url(#hdLight)"/>` +
    `<path d="M${L.A.x} ${L.A.y} Q${cx - w * 0.32} ${top + h * 0.62} ${cx - w * 0.35} ${top + h}" stroke="#000" stroke-opacity="0.07" stroke-width="${w * 0.05}" fill="none"/>` +
    `<path d="M${R.A.x} ${R.A.y} Q${cx + w * 0.32} ${top + h * 0.62} ${cx + w * 0.35} ${top + h}" stroke="#000" stroke-opacity="0.08" stroke-width="${w * 0.05}" fill="none"/>` +
    // карман-кенгуру
    `<path d="${pocket}" fill="${shade(body, light ? -12 : 24)}"/>` +
    stitchLine(`M${cx - w * 0.225} ${top + h * 0.605} Q${cx - w * 0.19} ${top + h * 0.65} ${cx - w * 0.14} ${top + h * 0.65} H${cx + w * 0.14} Q${cx + w * 0.19} ${top + h * 0.65} ${cx + w * 0.225} ${top + h * 0.605}`, edge, 1.4, '5 6') +
    (print ? `<g transform="translate(${cx} ${top + h * printY})">${print(printW * w)}</g>` : '') +
    // резинка по низу
    ribFill(cx - w * 0.365 + 4, top + h - h * 0.06, w * 0.73 - 8, h * 0.06, ribCol, shade(body, light ? -22 : 34)) +
    `</g>` +
    // манжеты
    poly(L.cuff, ribCol) +
    poly(R.cuff, ribCol) +
    // капюшон спереди
    `<path d="M${cx - w * 0.115} ${top + h * 0.075} C${cx - w * 0.125} ${top + h * 0.145} ${cx + w * 0.125} ${top + h * 0.145} ${cx + w * 0.115} ${top + h * 0.075} C${cx + w * 0.07} ${top + h * 0.12} ${cx - w * 0.07} ${top + h * 0.12} ${cx - w * 0.115} ${top + h * 0.075} Z" fill="${shade(body, light ? -20 : -26)}"/>` +
    `<path d="M${cx - w * 0.115} ${top + h * 0.075} C${cx - w * 0.125} ${top + h * 0.145} ${cx + w * 0.125} ${top + h * 0.145} ${cx + w * 0.115} ${top + h * 0.075}" fill="none" stroke="${shade(body, light ? 28 : 40)}" stroke-width="2" opacity="0.5"/>` +
    `<path d="M${cx - w * 0.062} ${top + h * 0.12} Q${cx - w * 0.068} ${top + h * 0.185} ${cx - w * 0.06} ${top + h * 0.235}" stroke="${shade(body, light ? -36 : 70)}" stroke-width="2.8" fill="none" stroke-linecap="round"/>` +
    `<path d="M${cx + w * 0.062} ${top + h * 0.12} Q${cx + w * 0.068} ${top + h * 0.185} ${cx + w * 0.06} ${top + h * 0.235}" stroke="${shade(body, light ? -36 : 70)}" stroke-width="2.8" fill="none" stroke-linecap="round"/>` +
    `<circle cx="${cx - w * 0.06}" cy="${top + h * 0.242}" r="3.2" fill="${C.amber}"/>` +
    `<circle cx="${cx + w * 0.06}" cy="${top + h * 0.242}" r="3.2" fill="${C.amber}"/>` +
    `</g>`
  );
}

// ─────────────────────────────────────────────────────── свитшот ──
/** Свитшот с круглым воротом: та же сетка, что у худи, но без капюшона. */
export function sweatshirt({
  cx = 450,
  top = 300,
  w = 620,
  h = 590,
  body = C.bone,
  trim = null,
  print = null,
  printY = 0.34,
  printW = 0.26,
} = {}) {
  const light = isLight(body);
  const edge = shade(body, light ? -26 : -32);
  const ribCol = trim ?? shade(body, light ? -10 : 16);
  const L = sleeveShape(-1, cx, top, w, h);
  const R = sleeveShape(1, cx, top, w, h);
  const neckHalf = w * 0.1;
  const neckDepth = h * 0.045;
  const path =
    `M${cx - neckHalf} ${top + neckDepth * 0.5} ` +
    `C${cx - w * 0.19} ${top - h * 0.012} ${cx - L.S.x + cx + w * 0.02} ${top + h * 0.008} ${L.S.x} ${L.S.y} ` +
    `L${L.O.x} ${L.O.y} L${L.I.x} ${L.I.y} L${L.A.x} ${L.A.y} ` +
    `L${L.H.x} ${L.H.y - h * 0.012} ` +
    `Q${cx} ${top + h + h * 0.016} ${R.H.x} ${R.H.y - h * 0.012} ` +
    `L${R.A.x} ${R.A.y} L${R.I.x} ${R.I.y} L${R.O.x} ${R.O.y} L${R.S.x} ${R.S.y} ` +
    `C${cx + w * 0.19} ${top + h * 0.008} ${cx + neckHalf + w * 0.06} ${top - h * 0.012} ${cx + neckHalf} ${top + neckDepth * 0.5} ` +
    `Q${cx} ${top + neckDepth * 2.2} ${cx - neckHalf} ${top + neckDepth * 0.5} Z`;
  const neckCurve = `M${cx - neckHalf} ${top + neckDepth * 0.5} Q${cx} ${top + neckDepth * 2.2} ${cx + neckHalf} ${top + neckDepth * 0.5}`;
  return (
    `<defs><clipPath id="swClip"><path d="${path}"/></clipPath>${fabricDefs('sw', light, {
      cx: cx - w * 0.06,
      cy: top + h * 0.42,
      r: w * 0.66,
    })}</defs>` +
    `<g filter="url(#ground)"><path d="${path}" fill="${body}"/>` +
    `<g clip-path="url(#swClip)">` +
    `<rect x="${cx - w}" y="${top - 80}" width="${w * 2}" height="${h * 2}" fill="url(#sw)"/>` +
    `<rect x="${cx - w}" y="${top - 80}" width="${w * 2}" height="${h * 2}" fill="url(#swLight)"/>` +
    `<path d="M${L.A.x} ${L.A.y} Q${cx - w * 0.32} ${top + h * 0.62} ${cx - w * 0.35} ${top + h}" stroke="#000" stroke-opacity="0.05" stroke-width="${w * 0.05}" fill="none"/>` +
    `<path d="M${R.A.x} ${R.A.y} Q${cx + w * 0.32} ${top + h * 0.62} ${cx + w * 0.35} ${top + h}" stroke="#000" stroke-opacity="0.06" stroke-width="${w * 0.05}" fill="none"/>` +
    (print ? `<g transform="translate(${cx} ${top + h * printY})">${print(printW * w)}</g>` : '') +
    ribFill(cx - w * 0.365 + 4, top + h - h * 0.085, w * 0.73 - 8, h * 0.085, ribCol, shade(body, light ? -22 : 32)) +
    `</g>` +
    poly(L.cuff, ribCol) +
    poly(R.cuff, ribCol) +
    `<path d="${neckCurve} Q${cx} ${top + neckDepth * 2.2 + h * 0.022} ${cx - neckHalf} ${top + neckDepth * 0.5} Z" fill="${ribCol}"/>` +
    `<path d="${neckCurve}" fill="none" stroke="${edge}" stroke-width="1.5" opacity="0.5"/>` +
    stitchLine(`M${cx - w * 0.34} ${top + h - h * 0.095} H${cx + w * 0.34}`, edge, 1.3, '5 6') +
    `</g>`
  );
}

// ───────────────────────────────────────────────────────── кепка ──
/** Кепка, вид спереди: купол, панельные швы, козырёк с отворотом. */
export function cap({ cx = 450, cy = 470, r = 215, body = C.navy, brim = null, print = null } = {}) {
  const light = isLight(body);
  const edge = shade(body, light ? -30 : -24);
  const brimCol = brim ?? shade(body, light ? -16 : 16);
  const base = cy + r * 0.06;          // линия пришива козырька
  const dome =
    `M${cx - r} ${base} ` +
    `C${cx - r * 1.02} ${cy - r * 0.5} ${cx - r * 0.52} ${cy - r * 0.95} ${cx} ${cy - r * 0.95} ` +
    `C${cx + r * 0.52} ${cy - r * 0.95} ${cx + r * 1.02} ${cy - r * 0.5} ${cx + r} ${base} Z`;
  return (
    `<g filter="url(#ground)">` +
    `<defs>` +
    `<radialGradient id="capShade" gradientUnits="userSpaceOnUse" cx="${cx - r * 0.3}" cy="${cy - r * 0.62}" r="${r * 1.5}">` +
    `<stop offset="0" stop-color="#fff" stop-opacity="${light ? 0.42 : 0.2}"/>` +
    `<stop offset="0.62" stop-color="#fff" stop-opacity="0"/>` +
    `<stop offset="1" stop-color="#000" stop-opacity="${light ? 0.08 : 0.26}"/></radialGradient>` +
    `<linearGradient id="capBrim" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#fff" stop-opacity="${light ? 0.3 : 0.16}"/>` +
    `<stop offset="1" stop-color="#000" stop-opacity="${light ? 0.1 : 0.3}"/></linearGradient>` +
    `</defs>` +
    // купол
    `<path d="${dome}" fill="${body}"/>` +
    `<path d="${dome}" fill="url(#capShade)"/>` +
    // швы шести панелей
    `<path d="M${cx} ${cy - r * 0.95} V${base}" stroke="${edge}" stroke-width="1.6" opacity="0.35"/>` +
    `<path d="M${cx} ${cy - r * 0.93} Q${cx - r * 0.5} ${cy - r * 0.5} ${cx - r * 0.97} ${base}" stroke="${edge}" stroke-width="1.4" fill="none" opacity="0.28"/>` +
    `<path d="M${cx} ${cy - r * 0.93} Q${cx + r * 0.5} ${cy - r * 0.5} ${cx + r * 0.97} ${base}" stroke="${edge}" stroke-width="1.4" fill="none" opacity="0.28"/>` +
    // пуговица
    `<circle cx="${cx}" cy="${cy - r * 0.945}" r="${r * 0.038}" fill="${shade(body, light ? -20 : 36)}"/>` +
    // козырёк — спереди, поэтому читается объём
    `<path d="M${cx - r * 1.08} ${base - r * 0.02} ` +
    `Q${cx} ${base + r * 0.62} ${cx + r * 1.08} ${base - r * 0.02} ` +
    `Q${cx} ${base + r * 0.1} ${cx - r * 1.08} ${base - r * 0.02} Z" fill="${brimCol}"/>` +
    `<path d="M${cx - r * 1.08} ${base - r * 0.02} ` +
    `Q${cx} ${base + r * 0.62} ${cx + r * 1.08} ${base - r * 0.02} ` +
    `Q${cx} ${base + r * 0.1} ${cx - r * 1.08} ${base - r * 0.02} Z" fill="url(#capBrim)"/>` +
    // отстрочка по краю козырька
    `<path d="M${cx - r * 1.0} ${base + r * 0.03} Q${cx} ${base + r * 0.54} ${cx + r * 1.0} ${base + r * 0.03}" fill="none" stroke="${C.cream}" stroke-width="1.6" stroke-dasharray="7 6" opacity="0.4"/>` +
    // тень от купола на козырьке
    `<path d="M${cx - r * 0.98} ${base - r * 0.01} Q${cx} ${base + r * 0.2} ${cx + r * 0.98} ${base - r * 0.01} L${cx + r * 0.98} ${base + r * 0.05} Q${cx} ${base + r * 0.26} ${cx - r * 0.98} ${base + r * 0.05} Z" fill="#000" opacity="${light ? 0.07 : 0.18}"/>` +
    (print ? `<g transform="translate(${cx} ${cy - r * 0.24})">${print(r * 0.52)}</g>` : '') +
    `</g>`
  );
}

// ───────────────────────────────────────────────────────── шапка-бини ──
/** Шапка-бини: вязаный купол с рёбрами и отворот; помпон — по желанию. */
export function beanie({ cx = 450, cy = 490, r = 200, body = C.red, cuff = null, print = null, pom = true } = {}) {
  const light = isLight(body);
  const cuffCol = cuff ?? shade(body, light ? -12 : 14);
  const hw = r * 0.86;                 // полуширина шапки (она выше, чем шире)
  const bTop = cy + r * 0.16;          // линия отворота
  const bBot = cy + r * 0.56;          // низ шапки
  const topY = cy - r * 0.8;           // макушка
  const ribCol = shade(body, light ? -22 : 22);
  // Купол: полная ширина у отворота, плечи скруглены, макушка мягкая, без углов.
  const crown =
    `M${cx - hw} ${bTop} ` +
    `C${cx - hw * 1.06} ${cy - r * 0.3} ${cx - hw * 0.92} ${topY + r * 0.12} ${cx - hw * 0.42} ${topY + r * 0.02} ` +
    `Q${cx} ${topY - r * 0.08} ${cx + hw * 0.42} ${topY + r * 0.02} ` +
    `C${cx + hw * 0.92} ${topY + r * 0.12} ${cx + hw * 1.06} ${cy - r * 0.3} ${cx + hw} ${bTop} Z`;
  // Вертикальные «косы» вязки: сходятся к макушке, повторяя купол.
  const ribs = Array.from({ length: 11 }, (_, i) => {
    const t = (i / 10) * 2 - 1;
    const xa = cx + t * hw * 0.92;
    const xb = cx + t * hw * 0.4;
    const ya = bTop - 2;
    const yb = topY + r * 0.1 + Math.abs(t) * r * 0.09;
    return (
      `<path d="M${xa} ${ya} Q${(xa + xb) / 2 - t * hw * 0.05} ${(ya + yb) / 2} ${xb} ${yb}" ` +
      `stroke="${ribCol}" stroke-width="2.2" fill="none" opacity="0.4" stroke-linecap="round"/>`
    );
  }).join('');
  const pomR = r * 0.2;
  const cw = hw * 0.99;                // полуширина отворота
  return (
    `<defs><linearGradient id="bnShade" gradientUnits="userSpaceOnUse" x1="${cx - hw}" y1="${topY}" x2="${cx + hw}" y2="${bBot}">` +
    `<stop offset="0" stop-color="#fff" stop-opacity="${light ? 0.32 : 0.14}"/>` +
    `<stop offset="0.55" stop-color="#fff" stop-opacity="0"/>` +
    `<stop offset="1" stop-color="#000" stop-opacity="${light ? 0.1 : 0.26}"/></linearGradient></defs>` +
    `<g filter="url(#ground)">` +
    // помпон: садится на макушку, нижняя часть уходит под купол
    (pom
      ? `<circle cx="${cx}" cy="${topY - pomR * 0.5}" r="${pomR}" fill="${shade(body, light ? 2 : 22)}"/>` +
        `<circle cx="${cx - pomR * 0.32}" cy="${topY - pomR * 0.85}" r="${pomR * 0.4}" fill="#fff" opacity="0.22"/>` +
        `<path d="M${cx - pomR * 0.9} ${topY - pomR * 0.05} Q${cx} ${topY + pomR * 0.55} ${cx + pomR * 0.9} ${topY - pomR * 0.05}" fill="#000" opacity="${light ? 0.06 : 0.14}"/>`
      : '') +
    `<path d="${crown}" fill="${body}"/>` +
    `<path d="${crown}" fill="url(#bnShade)"/>` +
    ribs +
    (print ? `<g transform="translate(${cx} ${cy - r * 0.24})">${print(r * 0.52)}</g>` : '') +
    // мягкая тень от купола на отворот — иначе отворот читается как отдельная коробка
    `<path d="M${cx - hw} ${bTop} Q${cx} ${bTop + hw * 0.09} ${cx + hw} ${bTop} L${cx + hw} ${bTop + hw * 0.07} Q${cx} ${bTop + hw * 0.16} ${cx - hw} ${bTop + hw * 0.07} Z" fill="#000" opacity="${light ? 0.07 : 0.16}"/>` +
    // отворот: двойная вязка, шов сверху, скруглённые углы
    `<g><clipPath id="bnCuff"><rect x="${cx - cw}" y="${bTop}" width="${cw * 2}" height="${bBot - bTop}" rx="${hw * 0.1}"/></clipPath>` +
    ribFill(cx - cw, bTop, cw * 2, bBot - bTop, cuffCol, shade(body, light ? -26 : 30)) +
    `<g clip-path="url(#bnCuff)"><path d="M${cx - cw} ${bTop + (bBot - bTop) * 0.32} H${cx + cw}" stroke="${shade(body, light ? -30 : 34)}" stroke-width="2" opacity="0.38"/></g>` +
    `<rect x="${cx - cw}" y="${bTop}" width="${cw * 2}" height="${bBot - bTop}" rx="${hw * 0.1}" fill="none" stroke="${shade(body, light ? -30 : 32)}" stroke-width="1.3" opacity="0.4"/></g>` +
    `</g>`
  );
}

// ───────────────────────────────────────────────────────── шарф ──
/**
 * Шарф: полотно свисает «волной» — два видимых сгиба, поэтому читается как
 * шарф, а не как прямоугольник. Полосы в цветах букв, бахрома внизу, знак у края.
 */
export function scarf({ cx = 450, cy = 540, len = 470, wid = 165, body = C.blue, stripe = C.cream, print = null } = {}) {
  const light = isLight(body);
  const edge = shade(body, light ? -28 : -34);
  const W = 300;                 // ширина полотна
  const H = 540;                 // высота «подвеса»
  const top = cy - H * 0.5;
  const left = cx - W * 0.5;

  // Полотно: слева уходит вверх за кадр, справа свисает ниже — мягкий перекос.
  const sheet =
    `M${left} ${top + 20} ` +
    `C${left + W * 0.28} ${top - 6} ${left + W * 0.72} ${top + 26} ${left + W} ${top + 6} ` +
    `L${left + W} ${top + H * 0.78} ` +
    `C${left + W * 0.7} ${top + H * 0.84} ${left + W * 0.3} ${top + H * 0.76} ${left} ${top + H * 0.82} Z`;

  // Бахрома по нижнему краю — с тем же перекосом.
  const fringe = Array.from({ length: 14 }, (_, i) => {
    const t = i / 13;
    const x = left + 10 + t * (W - 20);
    const y = top + H * 0.80 + Math.sin(t * Math.PI) * -8 + t * 4;
    return `<path d="M${x.toFixed(1)} ${y.toFixed(1)} l${(t - 0.5) * 3} ${26 + (i % 3) * 4}" stroke="${shade(body, light ? -18 : 16)}" stroke-width="3.6" stroke-linecap="round"/>`;
  }).join('');

  return (
    `<defs><clipPath id="scClip"><path d="${sheet}"/></clipPath>${fabricDefs('sc', light)}</defs>` +
    `<g filter="url(#ground)">` +
    fringe +
    `<path d="${sheet}" fill="${body}"/>` +
    `<g clip-path="url(#scClip)">` +
    `<path d="${sheet}" fill="url(#sc)"/>` +
    // полосы: кремовая полоса и нить из трёх цветов букв — ритм, а не «флаг»
    `<rect x="${left - 4}" y="${top + H * 0.14}" width="${W + 8}" height="${H * 0.05}" fill="${stripe}" opacity="0.92"/>` +
    `<rect x="${left - 4}" y="${top + H * 0.245}" width="${W + 8}" height="${H * 0.011}" fill="${C.red}" opacity="0.9"/>` +
    `<rect x="${left - 4}" y="${top + H * 0.268}" width="${W + 8}" height="${H * 0.011}" fill="${C.amber}" opacity="0.9"/>` +
    `<rect x="${left - 4}" y="${top + H * 0.291}" width="${W + 8}" height="${H * 0.011}" fill="${C.green}" opacity="0.9"/>` +
    // мягкие складки
    `<path d="M${left + W * 0.2} ${top} q${W * 0.05} ${H * 0.4} -${W * 0.025} ${H * 0.8}" stroke="#000" stroke-opacity="${light ? 0.04 : 0.07}" stroke-width="${W * 0.13}" fill="none"/>` +
    `<path d="M${left + W * 0.68} ${top + 10} q-${W * 0.05} ${H * 0.36} ${W * 0.02} ${H * 0.72}" stroke="#000" stroke-opacity="${light ? 0.05 : 0.09}" stroke-width="${W * 0.08}" fill="none"/>` +
    `<path d="M${left + W * 0.06} ${top + 6} q${W * 0.02} ${H * 0.4} 0 ${H * 0.74}" stroke="#fff" stroke-opacity="${light ? 0.2 : 0.12}" stroke-width="${W * 0.06}" fill="none"/>` +
    (print ? `<g transform="translate(${cx} ${top + H * 0.36})">${print(W * 0.34)}</g>` : '') +
    `</g>` +
    stitchLine(`M${left + 8} ${top + H * 0.78} Q${cx} ${top + H * 0.81} ${left + W - 8} ${top + H * 0.76}`, edge, 1.3, '5 6') +
    `</g>`
  );
}

// ───────────────────────────────────────────────────────── носки ──
export function socks({ cx = 450, cy = 520, body = C.white, accent = C.blue } = {}) {
  const sock = (x, rot) => `
    <g transform="translate(${x} ${cy}) rotate(${rot})">
      <path d="M-58 -170 h116 v132 q0 34 34 34 h22 q38 0 38 38 t-38 38 h-72 q-100 0 -100 -100 Z" fill="${body}" stroke="${shade(body, -26)}" stroke-width="2"/>
      <path d="M-58 -170 h116 v132 q0 34 34 34 h22 q38 0 38 38 t-38 38 h-72 q-100 0 -100 -100 Z" fill="url(#skShade)"/>
      <rect x="-58" y="-170" width="116" height="40" fill="${accent}"/>
      <rect x="-58" y="-124" width="116" height="12" fill="${accent}" opacity="0.6"/>
      <rect x="-58" y="-106" width="116" height="7" fill="${accent}" opacity="0.4"/>
      <g transform="translate(-14 -10)">${mark({ scale: 0.42, color: false, mono: accent, rule: false })}</g>
    </g>`;
  return (
    `<defs>${fabricDefs('sk', true)}</defs>` +
    `<g filter="url(#ground)">${sock(cx - 74, -6)}${sock(cx + 74, 6)}</g>`
  );
}

// ───────────────────────────────────────────────────────── шоппер ──
export function tote({ cx = 450, cy = 580, w = 440, h = 460, body = C.cream, handle = null, print = null } = {}) {
  const light = isLight(body);
  const edge = shade(body, light ? -26 : -30);
  return (
    `<g filter="url(#ground)">` +
    `<path d="M${cx - w * 0.24} ${cy - h / 2 + 4} C${cx - w * 0.24} ${cy - h / 2 - 140} ${cx + w * 0.24} ${cy - h / 2 - 140} ${cx + w * 0.24} ${cy - h / 2 + 4}" fill="none" stroke="${handle ?? shade(body, light ? -20 : 16)}" stroke-width="14" stroke-linecap="round"/>` +
    `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="8" fill="${body}"/>` +
    `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="8" fill="url(#ttShade)"/>` +
    `<defs>${fabricDefs('tt', light)}<clipPath id="toteClip"><rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="8"/></clipPath></defs>` +
    // мягкая складка ткани
    `<path d="M${cx - w * 0.1} ${cy - h / 2 + 8} Q${cx - w * 0.16} ${cy + h * 0.2} ${cx - w * 0.09} ${cy + h / 2 - 8}" stroke="#000" stroke-opacity="0.05" stroke-width="${w * 0.06}" fill="none"/>` +
    `<path d="M${cx + w * 0.2} ${cy - h / 2 + 8} Q${cx + w * 0.24} ${cy + h * 0.2} ${cx + w * 0.19} ${cy + h / 2 - 8}" stroke="#000" stroke-opacity="0.04" stroke-width="${w * 0.05}" fill="none"/>` +
    `<path d="M${cx - w / 2 + 8} ${cy - h / 2 + 6} H${cx + w / 2 - 8}" stroke="${edge}" stroke-width="1.6" opacity="0.45"/>` +
    // Печать вписываем с запасом: вертикальный замок выше, чем кажется (×2,72).
    (print
      ? `<g clip-path="url(#toteClip)"><g transform="translate(${cx} ${cy - h * 0.04})">${print(Math.min(w * 0.4, (h * 0.78) / 1.36))}</g></g>`
      : '') +
    stitchLine(`M${cx - w / 2 + 12} ${cy + h / 2 - 12} H${cx + w / 2 - 12}`, edge, 1.4, '5 6') +
    `</g>`
  );
}

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

const fmt = (n) => Math.round(n * 10) / 10;

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
/**
 * Кепка в 3/4: купол из шести панелей, козырёк выходит из-под купола
 * влево-вниз к зрителю. Порядок важен: козырёк → купол, иначе козырёк
 * читается как отдельная «лодка» под шапкой.
 */
export function cap({ cx = 440, cy = 470, r = 215, body = C.navy, brim = null, print = null } = {}) {
  const light = isLight(body);
  const edge = shade(body, light ? -30 : -24);
  const brimCol = brim ?? shade(body, light ? -8 : 12);
  const topY = cy - r * 0.9;
  const rimY = cy + r * 0.16;
  const left = cx - r * 1.06;
  const right = cx + r * 0.98;

  const crown =
    `M${left} ${rimY - 4} ` +
    `C${left + r * 0.02} ${cy - r * 0.46} ${cx - r * 0.5} ${topY} ${cx - r * 0.04} ${topY} ` +
    `C${cx + r * 0.44} ${topY} ${right - r * 0.06} ${cy - r * 0.44} ${right} ${rimY - 10} ` +
    `C${right - r * 0.32} ${rimY + 14} ${left + r * 0.3} ${rimY + 16} ${left} ${rimY - 4} Z`;

  // козырёк — эллипс, сдвинутый к зрителю: кепка повёрнута влево, поэтому
  // козырёк асимметричен, а верх купола читается как отдельная плоскость
  const brimCx = cx - r * 0.12;
  const brimCy = rimY + r * 0.04;
  const brimRx = r * 1.04;
  const brimRy = r * 0.34;
  const brimRot = -4;

  return (
    `<g filter="url(#ground)">` +
    `<defs>` +
    `<radialGradient id="capDome" gradientUnits="userSpaceOnUse" cx="${cx - r * 0.5}" cy="${cy - r * 0.7}" r="${r * 1.9}">` +
    `<stop offset="0" stop-color="#fff" stop-opacity="${light ? 0.5 : 0.28}"/>` +
    `<stop offset="0.52" stop-color="#fff" stop-opacity="0"/>` +
    `<stop offset="1" stop-color="#000" stop-opacity="${light ? 0.1 : 0.3}"/></radialGradient>` +
    `<linearGradient id="capBrimG" gradientUnits="userSpaceOnUse" x1="${left}" y1="${rimY - 30}" x2="${cx}" y2="${rimY + r * 0.4}">` +
    `<stop offset="0" stop-color="#fff" stop-opacity="${light ? 0.3 : 0.16}"/>` +
    `<stop offset="0.6" stop-color="#fff" stop-opacity="0"/>` +
    `<stop offset="1" stop-color="#000" stop-opacity="${light ? 0.14 : 0.3}"/></linearGradient>` +
    `</defs>` +
    // козырёк (купол потом перекроет его верхнюю часть)
    `<g transform="rotate(${brimRot} ${brimCx} ${brimCy})">` +
    `<ellipse cx="${brimCx}" cy="${brimCy}" rx="${brimRx}" ry="${brimRy}" fill="${brimCol}"/>` +
    `<ellipse cx="${brimCx}" cy="${brimCy}" rx="${brimRx}" ry="${brimRy}" fill="url(#capBrimG)"/>` +
    `<path d="M${brimCx - brimRx * 0.92} ${brimCy + brimRy * 0.26} A${brimRx * 0.94} ${brimRy * 0.94} 0 0 0 ${brimCx + brimRx * 0.92} ${brimCy + brimRy * 0.26}" fill="none" stroke="${C.cream}" stroke-width="1.4" stroke-dasharray="7 6" opacity="0.22"/>` +
    `<path d="M${brimCx - brimRx} ${brimCy + brimRy * 0.1} A${brimRx} ${brimRy} 0 0 0 ${brimCx + brimRx} ${brimCy + brimRy * 0.1}" fill="none" stroke="${shade(brimCol, light ? -34 : -22)}" stroke-width="5" opacity="0.55"/>` +
    `</g>` +
    // купол
    `<path d="${crown}" fill="${body}"/>` +
    `<path d="${crown}" fill="url(#capDome)"/>` +
    // тень купола на козырьке у кромки
    `<path d="M${left - 2} ${rimY - 2} C${cx - r * 0.4} ${rimY + 18} ${cx + r * 0.4} ${rimY + 14} ${right} ${rimY - 8}" fill="none" stroke="#000" stroke-width="14" opacity="${light ? 0.07 : 0.16}"/>` +
    // швы панелей
    `<path d="M${cx - r * 0.04} ${topY + 6} C${cx - r * 0.08} ${cy - r * 0.34} ${cx + r * 0.02} ${cy - r * 0.04} ${cx + r * 0.04} ${rimY + 2}" stroke="${edge}" stroke-width="1.7" fill="none" opacity="0.38"/>` +
    `<path d="M${cx - r * 0.04} ${topY + 8} C${cx - r * 0.36} ${cy - r * 0.26} ${cx - r * 0.7} ${cy + r * 0.04} ${cx - r * 0.88} ${rimY - 2}" stroke="${edge}" stroke-width="1.5" fill="none" opacity="0.3"/>` +
    `<path d="M${cx - r * 0.04} ${topY + 8} C${cx + r * 0.3} ${cy - r * 0.32} ${cx + r * 0.58} ${cy - r * 0.04} ${cx + r * 0.76} ${rimY - 18}" stroke="${edge}" stroke-width="1.5" fill="none" opacity="0.3"/>` +
    // верхняя панель светлее
    `<path d="M${cx - r * 0.04} ${topY + 2} C${cx + r * 0.36} ${topY + 12} ${cx + r * 0.62} ${cy - r * 0.52} ${cx + r * 0.74} ${cy - r * 0.14} C${cx + r * 0.28} ${cy - r * 0.32} ${cx - r * 0.32} ${cy - r * 0.42} ${cx - r * 0.04} ${topY + 2} Z" fill="${shade(body, light ? -8 : 18)}" opacity="0.5"/>` +
    // пуговица
    `<ellipse cx="${cx - r * 0.04}" cy="${topY - 1}" rx="${r * 0.044}" ry="${r * 0.03}" fill="${shade(body, light ? -22 : 34)}"/>` +
    `<ellipse cx="${cx - r * 0.05}" cy="${topY - 3}" rx="${r * 0.021}" ry="${r * 0.013}" fill="#fff" opacity="${light ? 0.5 : 0.26}"/>` +
    // люверсы
    `<circle cx="${cx - r * 0.6}" cy="${cy + r * 0.02}" r="${r * 0.03}" fill="${edge}" opacity="0.5"/>` +
    `<circle cx="${cx + r * 0.56}" cy="${cy - r * 0.16}" r="${r * 0.028}" fill="${edge}" opacity="0.45"/>` +
    (print ? `<g transform="translate(${cx - r * 0.04} ${cy - r * 0.3})">${print(r * 0.46)}</g>` : '') +
    `</g>`
  );
}

// ───────────────────────────────────────────────────────── шапка-бини ──
/** Шапка-бини: вытянутый вязаный купол, рёбра к макушке, отворот с толщиной. */
export function beanie({ cx = 450, cy = 500, r = 200, body = C.red, cuff = null, print = null, pom = true } = {}) {
  const light = isLight(body);
  const cuffCol = cuff ?? shade(body, light ? -12 : 14);
  const hw = r * 0.74;                 // полуширина: шапка выше, чем шире
  const bTop = cy + r * 0.1;           // линия отворота
  const bBot = cy + r * 0.54;          // низ шапки
  const topY = cy - r * 0.96;          // макушка
  const ribCol = shade(body, light ? -24 : 24);
  const crown =
    `M${cx - hw} ${bTop} ` +
    `C${cx - hw * 1.04} ${cy - r * 0.36} ${cx - hw * 0.86} ${topY + r * 0.14} ${cx - hw * 0.3} ${topY + r * 0.02} ` +
    `Q${cx + r * 0.02} ${topY - r * 0.1} ${cx + hw * 0.36} ${topY + r * 0.04} ` +
    `C${cx + hw * 0.9} ${topY + r * 0.16} ${cx + hw * 1.06} ${cy - r * 0.34} ${cx + hw} ${bTop} Z`;
  const ribs = Array.from({ length: 13 }, (_, i) => {
    const t = (i / 12) * 2 - 1;
    const xa = cx + t * hw * 0.94;
    const xb = cx + t * hw * 0.34;
    const ya = bTop - 2;
    const yb = topY + r * 0.1 + Math.abs(t) * r * 0.12;
    return (
      `<path d="M${xa} ${ya} Q${(xa + xb) / 2 - t * hw * 0.06} ${(ya + yb) / 2} ${xb} ${yb}" ` +
      `stroke="${ribCol}" stroke-width="2.4" fill="none" opacity="0.42" stroke-linecap="round"/>`
    );
  }).join('');
  const pomR = r * 0.19;
  const cw = hw * 1.02;
  const cuffH = bBot - bTop;
  return (
    `<defs><linearGradient id="bnShade" gradientUnits="userSpaceOnUse" x1="${cx - hw}" y1="${topY}" x2="${cx + hw}" y2="${bBot}">` +
    `<stop offset="0" stop-color="#fff" stop-opacity="${light ? 0.34 : 0.16}"/>` +
    `<stop offset="0.5" stop-color="#fff" stop-opacity="0"/>` +
    `<stop offset="1" stop-color="#000" stop-opacity="${light ? 0.1 : 0.26}"/></linearGradient>` +
    `<clipPath id="bnCuff"><rect x="${cx - cw}" y="${bTop}" width="${cw * 2}" height="${cuffH}" rx="${hw * 0.12}"/></clipPath></defs>` +
    `<g filter="url(#ground)">` +
    // помпон
    (pom
      ? `<circle cx="${cx + r * 0.03}" cy="${topY - pomR * 0.45}" r="${pomR}" fill="${shade(body, light ? 2 : 20)}"/>` +
        [0, 1, 2, 3, 4, 5].map((i) => {
          const a = (i / 6) * Math.PI * 2;
          return `<circle cx="${cx + r * 0.03 + Math.cos(a) * pomR * 0.62}" cy="${topY - pomR * 0.45 + Math.sin(a) * pomR * 0.62}" r="${pomR * 0.34}" fill="${shade(body, light ? -4 : 16)}"/>`;
        }).join('') +
        `<circle cx="${cx + r * 0.03 - pomR * 0.3}" cy="${topY - pomR * 0.75}" r="${pomR * 0.3}" fill="#fff" opacity="0.2"/>`
      : '') +
    // купол
    `<path d="${crown}" fill="${body}"/>` +
    `<path d="${crown}" fill="url(#bnShade)"/>` +
    ribs +
    (print ? `<g transform="translate(${cx} ${cy - r * 0.2})">${print(r * 0.44)}</g>` : '') +
    // отворот
    `<rect x="${cx - cw}" y="${bTop}" width="${cw * 2}" height="${cuffH}" rx="${hw * 0.12}" fill="${cuffCol}"/>` +
    `<g clip-path="url(#bnCuff)">` +
    ribFill(cx - cw, bTop, cw * 2, cuffH, cuffCol, shade(body, light ? -30 : 34)) +
    // тень от купола на отвороте
    `<path d="M${cx - cw} ${bTop} Q${cx} ${bTop + hw * 0.14} ${cx + cw} ${bTop} L${cx + cw} ${bTop + hw * 0.1} Q${cx} ${bTop + hw * 0.24} ${cx - cw} ${bTop + hw * 0.1} Z" fill="#000" opacity="${light ? 0.08 : 0.18}"/>` +
    // нижняя кромка: отворот огибает голову
    `<path d="M${cx - cw} ${bBot} Q${cx} ${bBot + hw * 0.16} ${cx + cw} ${bBot} L${cx + cw} ${bBot - hw * 0.1} Q${cx} ${bBot + hw * 0.05} ${cx - cw} ${bBot - hw * 0.1} Z" fill="${shade(body, light ? -18 : 16)}" opacity="0.9"/>` +
    `<path d="M${cx - cw} ${bTop + cuffH * 0.52} H${cx + cw}" stroke="${shade(body, light ? -32 : 36)}" stroke-width="2" opacity="0.3"/>` +
    `</g>` +
    `<rect x="${cx - cw}" y="${bTop}" width="${cw * 2}" height="${cuffH}" rx="${hw * 0.12}" fill="none" stroke="${shade(body, light ? -30 : 32)}" stroke-width="1.3" opacity="0.35"/>` +
    `</g>`
  );
}

// ───────────────────────────────────────────────────────── шарф ──
/**
 * Шарф перекинут через плечо: сложенное пополам полотно — узкая длинная петля,
 * два конца разной длины и бахрома. Так силуэт читается сразу.
 */
export function scarf({ cx = 450, cy = 520, body = C.blue, stripe = C.cream, print = null } = {}) {
  const light = isLight(body);
  const edge = shade(body, light ? -26 : -34);
  const R = 104;                     // полуширина сложенного полотна
  const left = cx - R;
  const right = cx + R;
  const top = cy - 250;
  const loopY = top + R;
  const endL = cy + 104;
  const endR = cy + 218;

  const cloth =
    `M${left} ${endL} V${loopY} A${R} ${R} 0 0 1 ${right} ${loopY} V${endR} ` +
    `Q${cx + 26} ${endR - 12} ${left} ${endL} Z`;

  const fringe = (x0, x1, yEnd, dir) =>
    Array.from({ length: 9 }, (_, i) => {
      const t = i / 8;
      const x = x0 + 8 + t * (x1 - x0 - 16);
      const sway = (t - 0.5) * 6 * dir;
      const h = 26 + (i % 3) * 6;
      return `<path d="M${fmt(x)} ${fmt(yEnd - 6)} q${fmt(sway * 0.3)} ${fmt(h * 0.7)} ${fmt(sway)} ${h}" stroke="${shade(body, light ? -10 : 16)}" stroke-width="6.5" stroke-linecap="round" fill="none"/>`;
    }).join('');

  return (
    `<defs>${fabricDefs('sc', light)}` +
    `<clipPath id="scBand"><path d="${cloth}"/></clipPath>` +
    `<linearGradient id="scCrease" gradientUnits="userSpaceOnUse" x1="${cx - 20}" y1="0" x2="${cx + 20}" y2="0">` +
    `<stop offset="0" stop-color="#000" stop-opacity="0"/>` +
    `<stop offset="0.42" stop-color="#000" stop-opacity="${light ? 0.06 : 0.16}"/>` +
    `<stop offset="0.56" stop-color="#fff" stop-opacity="${light ? 0.2 : 0.1}"/>` +
    `<stop offset="1" stop-color="#fff" stop-opacity="0"/>` +
    `</linearGradient>` +
    `<linearGradient id="scLoop" gradientUnits="userSpaceOnUse" x1="0" y1="${top}" x2="0" y2="${loopY + 56}">` +
    `<stop offset="0" stop-color="#000" stop-opacity="${light ? 0.05 : 0.14}"/>` +
    `<stop offset="0.55" stop-color="#fff" stop-opacity="${light ? 0.38 : 0.16}"/>` +
    `<stop offset="1" stop-color="#fff" stop-opacity="0"/>` +
    `</linearGradient>` +
    `</defs>` +
    `<g filter="url(#ground)">` +
    fringe(left, cx + 4, endL, -1) +
    fringe(cx - 4, right, endR, 1) +
    `<path d="${cloth}" fill="${body}"/>` +
    `<g clip-path="url(#scBand)">` +
    `<path d="${cloth}" fill="url(#sc)"/>` +
    `<path d="${cloth}" fill="url(#scLoop)"/>` +
    // рисунок: кремовая лента с нитью триколора, огибает сложенное полотно
    `<rect x="${left - 4}" y="${loopY + 54}" width="${R * 2 + 8}" height="26" fill="${stripe}" opacity="0.94"/>` +
    `<rect x="${left - 4}" y="${loopY + 90}" width="${R * 2 + 8}" height="6" fill="${C.red}"/>` +
    `<rect x="${left - 4}" y="${loopY + 99}" width="${R * 2 + 8}" height="6" fill="${C.amber}"/>` +
    `<rect x="${left - 4}" y="${loopY + 108}" width="${R * 2 + 8}" height="6" fill="${C.green}"/>` +
    // перегиб: дальняя половина уходит назад (мягкая тень, не линия)
    `<rect x="${cx - 20}" y="${loopY + 2}" width="40" height="${endR - loopY - 4}" fill="url(#scCrease)"/>` +
    // мягкие складки вдоль полотна
    `<path d="M${left + R * 0.34} ${loopY + 20} Q${left + R * 0.2} ${cy} ${left + R * 0.3} ${endL - 16}" stroke="#000" stroke-opacity="${light ? 0.03 : 0.06}" stroke-width="${R * 0.16}" fill="none"/>` +
    `<path d="M${right - R * 0.3} ${loopY + 16} Q${right - R * 0.44} ${cy + 40} ${right - R * 0.34} ${endR - 20}" stroke="#000" stroke-opacity="${light ? 0.04 : 0.08}" stroke-width="${R * 0.14}" fill="none"/>` +
    (print ? `<g transform="translate(${cx + R * 0.5} ${endR - 110})">${print(R * 0.5)}</g>` : '') +
    `</g>` +
    stitchLine(`M${left + 6} ${endL - 20} Q${cx - R * 0.5} ${endL - 34} ${cx - 2} ${endL - 22}`, edge, 1.4, '5 6') +
    stitchLine(`M${cx + 2} ${endR - 20} Q${cx + R * 0.5} ${endR - 36} ${right - 6} ${endR - 20}`, edge, 1.4, '5 6') +
    `</g>`
  );
}

// ───────────────────────────────────────────────────────── носки ──
/** Пара носков в профиль: голень, пятка, стопа, резинка с рёбрами. */
export function socks({ cx = 450, cy = 520, body = C.white, accent = C.blue } = {}) {
  const sock = (x, y, rot, tone, accentTone, back = false) => {
    const shape =
      `M-48 -312 H48 V-44 Q48 6 92 6 H160 Q190 6 190 34 Q190 92 132 92 H-14 ` +
      `Q-78 92 -78 44 Q-78 26 -48 26 Z`;
    return (
      `<g transform="translate(${x} ${y}) rotate(${rot})">` +
      `<path d="${shape}" fill="${tone}" stroke="${shade(tone, -26)}" stroke-width="2.2" stroke-opacity="0.55"/>` +
      `<path d="${shape}" fill="url(#skShade)" opacity="${back ? 0.9 : 1}"/>` +
      // резинка
      `<path d="M-48 -312 H48 V-256 H-48 Z" fill="${accentTone}"/>` +
      `<g clip-path="url(#skCuff)">` +
      Array.from({ length: 11 }, (_, i) => `<path d="M${-44 + i * 9} -310 V-258" stroke="${shade(accentTone, -26)}" stroke-width="2" opacity="0.45"/>`).join('') +
      `</g>` +
      // две тонкие полосы под резинкой
      `<path d="M-48 -248 H48 V-241 H-48 Z" fill="${accentTone}" opacity="0.85"/>` +
      `<path d="M-48 -231 H48 V-227 H-48 Z" fill="${accentTone}" opacity="0.6"/>` +
      // пятка и мысок — чуть темнее
      `<path d="M-78 44 Q-78 92 -14 92 Q-58 84 -60 44 Z" fill="${shade(tone, -18)}" opacity="0.45"/>` +
      `<path d="M132 92 Q190 92 190 34 Q190 80 126 78 Z" fill="${shade(tone, -20)}" opacity="0.4"/>` +
      // складки
      `<path d="M-24 -210 Q-18 -120 -26 -40" stroke="#000" stroke-opacity="0.06" stroke-width="13" fill="none"/>` +
      `<path d="M20 -200 Q27 -120 18 -50" stroke="#000" stroke-opacity="0.05" stroke-width="9" fill="none"/>` +
      // знак на голени
      (back ? '' : `<g transform="translate(-4 -160)">${mark({ scale: 0.4, color: false, mono: accentTone, rule: false })}</g>`) +
      `</g>`
    );
  };
  return (
    `<defs>${fabricDefs('sk', true)}` +
    `<clipPath id="skCuff"><path d="M-48 -312 H48 V-256 H-48 Z"/></clipPath></defs>` +
    `<g filter="url(#ground)">` +
    sock(cx - 104, cy + 6, -7, shade(body, -16), shade(accent, -16), true) +
    sock(cx + 88, cy, 5, body, accent) +
    `</g>`
  );
}

// ───────────────────────────────────────────────────────── шоппер ──
export function tote({ cx = 450, cy = 590, w = 440, h = 450, body = C.cream, handle = null, print = null } = {}) {
  const light = isLight(body);
  const edge = shade(body, light ? -26 : -30);
  const strap = handle ?? shade(body, light ? -20 : 16);
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const y0 = cy - h / 2;
  const y1 = cy + h / 2;
  const gus = w * 0.075;              // боковая складка (боковина)
  // ручки — плоские ремни: дальняя выше и темнее, ближняя светлее
  const strapPath = (dx, dy, hh) => {
    const xl = cx - w * 0.19 + dx;
    const xr = cx + w * 0.19 + dx;
    const rr = (xr - xl) / 2;
    const top = y0 - hh + dy;
    return `M${xl} ${y0 + 12} L${xl} ${top + rr} A${rr} ${rr} 0 0 1 ${xr} ${top + rr} L${xr} ${y0 + 12}`;
  };
  return (
    `<g filter="url(#ground)">` +
    `<defs>${fabricDefs('tt', light)}<clipPath id="toteClip"><rect x="${x0}" y="${y0}" width="${w - gus}" height="${h}"/></clipPath></defs>` +
    `<path d="${strapPath(w * 0.058, -26, h * 0.225)}" fill="none" stroke="${shade(strap, light ? -30 : 8)}" stroke-width="20" stroke-linecap="butt" opacity="0.9"/>` +
    `<path d="${strapPath(0, 0, h * 0.2)}" fill="none" stroke="${strap}" stroke-width="26" stroke-linecap="butt"/>` +
    `<path d="${strapPath(0, 0, h * 0.2)}" fill="none" stroke="${shade(strap, light ? 20 : -16)}" stroke-width="8" stroke-linecap="butt" opacity="0.55"/>` +
    // корпус и боковина
    `<path d="M${x0} ${y0 + 6} H${x1 - gus} L${x1} ${y0 + 22} V${y1 - 8} L${x1 - gus} ${y1} H${x0} Z" fill="${body}"/>` +
    `<path d="M${x1 - gus} ${y0 + 6} L${x1} ${y0 + 22} V${y1 - 8} L${x1 - gus} ${y1} Z" fill="${shade(body, light ? -16 : 12)}"/>` +
    `<path d="M${x0} ${y0 + 6} H${x1 - gus} L${x1} ${y0 + 22} V${y1 - 8} L${x1 - gus} ${y1} H${x0} Z" fill="url(#tt)"/>` +
    // мягкие складки
    `<path d="M${x0 + w * 0.24} ${y0 + 10} Q${x0 + w * 0.18} ${cy} ${x0 + w * 0.24} ${y1 - 6}" stroke="#000" stroke-opacity="${light ? 0.05 : 0.09}" stroke-width="${w * 0.07}" fill="none"/>` +
    `<path d="M${x1 - gus - w * 0.06} ${y0 + 10} Q${x1 - gus - w * 0.1} ${cy} ${x1 - gus - w * 0.05} ${y1 - 6}" stroke="#000" stroke-opacity="${light ? 0.04 : 0.07}" stroke-width="${w * 0.05}" fill="none"/>` +
    `<path d="M${x0 + 14} ${y0 + 18} Q${cx} ${y0 + 4} ${x1 - gus - 10} ${y0 + 14}" stroke="#fff" stroke-opacity="${light ? 0.5 : 0.16}" stroke-width="4" fill="none"/>` +
    // верхняя кромка: подгиб и тень внутрь
    `<path d="M${x0} ${y0 + 6} H${x1 - gus} L${x1} ${y0 + 22}" fill="none" stroke="${edge}" stroke-width="2" opacity="0.45"/>` +
    stitchLine(`M${x0 + 10} ${y0 + 30} H${x1 - gus - 4}`, edge, 1.4, '5 6') +
    // печать
    (print
      ? `<g clip-path="url(#toteClip)"><g transform="translate(${cx - gus / 2} ${cy - h * 0.02})">${print(Math.min(w * 0.4, (h * 0.72) / 1.36))}</g></g>`
      : '') +
    // шов по низу
    stitchLine(`M${x0 + 12} ${y1 - 14} H${x1 - gus - 4}`, edge, 1.4, '5 6') +
    `</g>`
  );
}

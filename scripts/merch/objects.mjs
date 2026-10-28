// Предметы: канцелярия, посуда, сумки, аксессуары. Тот же свет и материал,
// что у одежды: плоская заливка + один градиент + тень на бумаге.

import { C, mark, lockupV, lockupH, seal, text, font, MARK_BOX } from './brand.mjs';
import { shade, isLight, stitchLine as stitch } from './garments.mjs';
import { pMark, pWord, pSeal, pLockupV } from './prints.mjs';

const paperGrain = (id) => `
<linearGradient id="${id}" x1="0" y1="0" x2="0.6" y2="1">
  <stop offset="0" stop-color="#fff" stop-opacity="0.22"/>
  <stop offset="0.5" stop-color="#fff" stop-opacity="0.02"/>
  <stop offset="1" stop-color="#000" stop-opacity="0.16"/>
</linearGradient>`;

// ─────────────────────────────────────────────────────────── блокнот A5 ──
export function notebook({ cx = 450, cy = 540, w = 380, h = 500, body = C.navy, band = C.red, print = null } = {}) {
  const skew = 26;
  const edge = shade(body, -26);
  return (
    `<g filter="url(#ground)">` +
    // блок страниц
    `<path d="M${cx - w / 2 + 10} ${cy - h / 2 + 16} L${cx + w / 2 + 10} ${cy - h / 2 + 16} L${cx + w / 2 + 10} ${cy + h / 2 + 16} L${cx - w / 2 + 10} ${cy + h / 2 + 16} Z" fill="#F7F2E6"/>` +
    `<path d="M${cx - w / 2 + 10} ${cy + h / 2 + 16} H${cx + w / 2 + 10}" stroke="#D9D0BC" stroke-width="2"/>` +
    // обложка
    `<path d="M${cx - w / 2} ${cy - h / 2} H${cx + w / 2} V${cy + h / 2} H${cx - w / 2} Z" fill="${body}"/>` +
    `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" fill="url(#nbShade)"/>` +
    `<defs>${paperGrain('nbShade')}</defs>` +
    // корешок
    `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w * 0.055}" height="${h}" fill="${edge}"/>` +
    // резинка
    `<rect x="${cx + w * 0.32}" y="${cy - h / 2 - 3}" width="${w * 0.03}" height="${h + 6}" rx="2" fill="${band}"/>` +
    (print ? `<g transform="translate(${cx + w * 0.03} ${cy - h * 0.06})">${print(w * 0.5)}</g>` : '') +
    `<path d="M${cx - w / 2 + 16} ${cy + h / 2 - 14} H${cx + w / 2 - 16}" stroke="${shade(body, 40)}" stroke-width="1.6" opacity="0.5"/>` +
    `</g>`
  );
}

// ──────────────────────────────────────────────────────────── ручка ──
export function pen({ cx = 450, cy = 545, len = 560, body = C.navy, accent = C.amber, print = null } = {}) {
  const rot = -26;
  const r = 15;
  const x0 = -len / 2;      // кончик
  const x1 = len / 2;       // торец
  const capX = len * 0.16;  // начало колпачка
  return (
    `<g filter="url(#ground)" transform="translate(${cx} ${cy}) rotate(${rot})">` +
    `<defs>` +
    `<linearGradient id="penG" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#fff" stop-opacity="0.34"/>` +
    `<stop offset="0.32" stop-color="#fff" stop-opacity="0.06"/>` +
    `<stop offset="0.72" stop-color="#000" stop-opacity="0.1"/>` +
    `<stop offset="1" stop-color="#000" stop-opacity="0.34"/></linearGradient>` +
    `<linearGradient id="penMetal" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#F2EADA"/><stop offset="0.45" stop-color="#CFC3AC"/><stop offset="1" stop-color="#9E927C"/>` +
    `</linearGradient></defs>` +
    // корпус
    `<path d="M${x0 + 34} ${-r} H${capX + 2} V${r} H${x0 + 34} Q${x0 + 12} ${r * 0.6} ${x0 + 6} ${r * 0.12} Q${x0 + 12} ${-r * 0.6} ${x0 + 34} ${-r} Z" fill="${body}"/>` +
    `<path d="M${x0 + 34} ${-r} H${capX + 2} V${r} H${x0 + 34} Q${x0 + 12} ${r * 0.6} ${x0 + 6} ${r * 0.12} Q${x0 + 12} ${-r * 0.6} ${x0 + 34} ${-r} Z" fill="url(#penG)"/>` +
    // рифление хвата
    Array.from({ length: 7 }, (_, i) =>
      `<path d="M${x0 + 52 + i * 9} ${-r + 3} V${r - 3}" stroke="#000" stroke-opacity="0.16" stroke-width="2"/>`,
    ).join('') +
    // металлический конус и пишущий узел
    `<path d="M${x0 + 44} ${-r * 0.62} L${x0 + 4} ${-r * 0.2} L${x0 + 4} ${r * 0.2} L${x0 + 44} ${r * 0.62} Z" fill="url(#penMetal)"/>` +
    `<path d="M${x0 + 6} ${-r * 0.2} L${x0 - 8} 0 L${x0 + 6} ${r * 0.2} Z" fill="#3A3A3C"/>` +
    // колпачок
    `<path d="M${capX} ${-r - 1} H${x1 - 6} Q${x1} ${-r - 1} ${x1} ${-r + 4} V${r - 4} Q${x1} ${r + 1} ${x1 - 6} ${r + 1} H${capX} Z" fill="${accent}"/>` +
    `<path d="M${capX} ${-r - 1} H${x1 - 6} Q${x1} ${-r - 1} ${x1} ${-r + 4} V${r - 4} Q${x1} ${r + 1} ${x1 - 6} ${r + 1} H${capX} Z" fill="url(#penG)"/>` +
    // кольцо стыка
    `<rect x="${capX - 5}" y="${-r - 1}" width="5" height="${r * 2 + 2}" fill="#000" opacity="0.22"/>` +
    `<rect x="${capX - 5}" y="${-r - 1}" width="2" height="${r * 2 + 2}" fill="#fff" opacity="0.28"/>` +
    // клип
    `<path d="M${x1 - 12} ${-r - 1} q22 -2 22 12 v${r * 1.1} q0 6 -7 6 h-4" fill="none" stroke="url(#penMetal)" stroke-width="5" stroke-linecap="round"/>` +
    // гравировка поперёк корпуса
    (print ? `<g transform="translate(${-len * 0.16} 0) rotate(90)">${print(r * 0.85)}</g>` : '') +
    `<text x="${x1 - 34}" y="${r * 0.55}" text-anchor="end" ${font(700)} font-size="${r * 0.42}" letter-spacing="${r * 0.12}" fill="${C.cream}" opacity="0.75">1995</text>` +
    `</g>`
  );
}

// ───────────────────────────────────────────────────────── карандаши ──
/** Набор карандашей веером — рифма к логотипу с цветными карандашами. */
export function pencils({ cx = 450, cy = 560, colors = [C.red, C.amber, C.green, C.blue], print = null } = {}) {
  const n = colors.length;
  return (
    `<g filter="url(#ground)">` +
    colors
      .map((col, i) => {
        const rot = -26 + (i * 52) / (n - 1);
        const dx = (i - (n - 1) / 2) * 46;
        return (
          `<g transform="translate(${cx + dx} ${cy}) rotate(${rot})">` +
          `<rect x="-15" y="-230" width="30" height="400" fill="${col}"/>` +
          `<rect x="-15" y="-230" width="9" height="400" fill="#fff" opacity="0.16"/>` +
          `<rect x="6" y="-230" width="9" height="400" fill="#000" opacity="0.12"/>` +
          `<path d="M-15 -230 L0 -290 L15 -230 Z" fill="${shade(col, 40)}"/>` +
          `<path d="M-5 -262 L0 -290 L5 -262 Z" fill="#2C2C2C"/>` +
          `<rect x="-15" y="150" width="30" height="20" fill="${shade(col, 55)}"/>` +
          (print ? `<g transform="translate(0 -120) rotate(90)">${print(11)}</g>` : '') +
          `</g>`
        );
      })
      .join('') +
    `</g>`
  );
}

// ──────────────────────────────────────────────────────────── бутылка ──
export function bottle({ cx = 450, cy = 555, w = 170, h = 440, body = C.blue, cap = C.cream, print = null } = {}) {
  const light = isLight(body);
  const edge = shade(body, -34);
  const top = cy - h * 0.5;
  const bottom = cy + h * 0.5;
  const neckY = top + h * 0.12;
  const shoulderY = top + h * 0.26;
  const x0 = cx - w * 0.44;
  const x1 = cx + w * 0.44;
  const bodyPath =
    `M${x0} ${shoulderY} ` +
    `C${x0} ${neckY + h * 0.04} ${cx - w * 0.2} ${neckY} ${cx - w * 0.18} ${neckY} ` +
    `V${top + h * 0.03} H${cx + w * 0.18} V${neckY} ` +
    `C${cx + w * 0.2} ${neckY} ${x1} ${neckY + h * 0.04} ${x1} ${shoulderY} ` +
    `V${bottom - h * 0.06} Q${x1} ${bottom} ${cx + w * 0.34} ${bottom} ` +
    `H${cx - w * 0.34} Q${x0} ${bottom} ${x0} ${bottom - h * 0.06} Z`;
  return (
    `<g filter="url(#ground)">` +
    `<defs>` +
    `<linearGradient id="btlG" x1="0" y1="0" x2="1" y2="0">` +
    `<stop offset="0" stop-color="#000" stop-opacity="0.22"/>` +
    `<stop offset="0.22" stop-color="#fff" stop-opacity="${light ? 0.5 : 0.26}"/>` +
    `<stop offset="0.46" stop-color="#fff" stop-opacity="0.04"/>` +
    `<stop offset="0.8" stop-color="#000" stop-opacity="0.12"/>` +
    `<stop offset="1" stop-color="#000" stop-opacity="0.3"/></linearGradient>` +
    `<linearGradient id="btlCap" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#fff" stop-opacity="0.5"/><stop offset="1" stop-color="#000" stop-opacity="0.22"/>` +
    `</linearGradient>` +
    `</defs>` +
    // корпус
    `<path d="${bodyPath}" fill="${body}"/>` +
    `<path d="${bodyPath}" fill="url(#btlG)"/>` +
    // кольцо горловины и крышка-поилка
    `<rect x="${cx - w * 0.2}" y="${neckY - h * 0.012}" width="${w * 0.4}" height="${h * 0.022}" rx="4" fill="${edge}" opacity="0.55"/>` +
    `<path d="M${cx - w * 0.19} ${top + h * 0.03} V${top + h * 0.012} Q${cx - w * 0.19} ${top} ${cx - w * 0.14} ${top} H${cx + w * 0.14} Q${cx + w * 0.19} ${top} ${cx + w * 0.19} ${top + h * 0.012} V${top + h * 0.03} Z" fill="${cap}"/>` +
    `<path d="M${cx - w * 0.19} ${top + h * 0.03} V${top + h * 0.012} Q${cx - w * 0.19} ${top} ${cx - w * 0.14} ${top} H${cx + w * 0.14} Q${cx + w * 0.19} ${top} ${cx + w * 0.19} ${top + h * 0.012} V${top + h * 0.03} Z" fill="url(#btlCap)"/>` +
    // петля-ручка на крышке
    `<path d="M${cx + w * 0.05} ${top + h * 0.012} q${w * 0.1} ${-h * 0.03} ${w * 0.16} ${h * 0.005}" fill="none" stroke="${shade(cap, -22)}" stroke-width="5" stroke-linecap="round"/>` +
    // блик и тень на корпусе
    `<rect x="${cx - w * 0.3}" y="${shoulderY + h * 0.04}" width="${w * 0.075}" height="${h * 0.52}" rx="${w * 0.04}" fill="#fff" opacity="${light ? 0.32 : 0.18}"/>` +
    `<rect x="${cx + w * 0.26}" y="${shoulderY + h * 0.04}" width="${w * 0.05}" height="${h * 0.52}" rx="${w * 0.025}" fill="#000" opacity="0.1"/>` +
    // гравировка
    (print ? `<g transform="translate(${cx} ${cy + h * 0.02})">${print(w * 0.46)}</g>` : '') +
    `<text x="${cx}" y="${cy + h * 0.24}" text-anchor="middle" ${font(700)} font-size="${h * 0.026}" letter-spacing="${h * 0.012}" fill="${light ? C.navy : C.cream}" opacity="0.55">500 ML</text>` +
    `</g>`
  );
}

// ────────────────────────────────────────────────────────────── кружка ──
export function mug({ cx = 450, cy = 540, w = 300, h = 330, body = C.cream, inner = C.blue, print = null } = {}) {
  const edge = shade(body, -30);
  return (
    `<g filter="url(#ground)">` +
    `<path d="M${cx + w * 0.44} ${cy - h * 0.22} q${w * 0.3} 0 ${w * 0.3} ${h * 0.24} q0 ${h * 0.24} -${w * 0.3} ${h * 0.24}" fill="none" stroke="${body}" stroke-width="${w * 0.1}"/>` +
    `<path d="M${cx - w / 2} ${cy - h / 2} h${w} l-${w * 0.07} ${h * 0.9} q-${w * 0.02} ${h * 0.1} -${w * 0.12} ${h * 0.1} h-${w * 0.62} q-${w * 0.1} 0 -${w * 0.12} -${h * 0.1} Z" fill="${body}"/>` +
    `<path d="M${cx - w / 2} ${cy - h / 2} h${w} l-${w * 0.07} ${h * 0.9} q-${w * 0.02} ${h * 0.1} -${w * 0.12} ${h * 0.1} h-${w * 0.62} q-${w * 0.1} 0 -${w * 0.12} -${h * 0.1} Z" fill="url(#mugShade)"/>` +
    `<defs><linearGradient id="mugShade" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.2"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.16"/></linearGradient></defs>` +
    `<ellipse cx="${cx}" cy="${cy - h / 2}" rx="${w / 2}" ry="${h * 0.09}" fill="${inner}"/>` +
    `<ellipse cx="${cx}" cy="${cy - h / 2}" rx="${w / 2}" ry="${h * 0.09}" fill="none" stroke="${edge}" stroke-width="2" opacity="0.4"/>` +
    (print ? `<g transform="translate(${cx} ${cy + h * 0.02})">${print(w * 0.4)}</g>` : '') +
    `</g>`
  );
}

// ─────────────────────────────────────────────────────────── термокружка ──
export function tumbler({ cx = 450, cy = 540, w = 170, h = 420, body = C.metal ?? '#C9CED6', lid = C.navy, print = null } = {}) {
  const bodyCol = body;
  return (
    `<g filter="url(#ground)">` +
    `<path d="M${cx - w / 2} ${cy - h / 2 + 40} h${w} l-${w * 0.1} ${h * 0.88} q-${w * 0.02} ${h * 0.06} -${w * 0.1} ${h * 0.06} h-${w * 0.6} q-${w * 0.08} 0 -${w * 0.1} -${h * 0.06} Z" fill="${bodyCol}"/>` +
    `<defs><linearGradient id="tumShade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0.45"/><stop offset="0.35" stop-color="#fff" stop-opacity="0.05"/><stop offset="0.75" stop-color="#000" stop-opacity="0.12"/><stop offset="1" stop-color="#000" stop-opacity="0.3"/></linearGradient></defs>` +
    `<path d="M${cx - w / 2} ${cy - h / 2 + 40} h${w} l-${w * 0.1} ${h * 0.88} q-${w * 0.02} ${h * 0.06} -${w * 0.1} ${h * 0.06} h-${w * 0.6} q-${w * 0.08} 0 -${w * 0.1} -${h * 0.06} Z" fill="url(#tumShade)"/>` +
    `<rect x="${cx - w * 0.52}" y="${cy - h * 0.5}" width="${w * 1.04}" height="${h * 0.16}" rx="12" fill="${lid}"/>` +
    `<rect x="${cx - w * 0.2}" y="${cy - h * 0.58}" width="${w * 0.4}" height="${h * 0.09}" rx="8" fill="${shade(lid, 18)}"/>` +
    (print ? `<g transform="translate(${cx} ${cy + h * 0.06})">${print(w * 0.46)}</g>` : '') +
    `</g>`
  );
}

// ─────────────────────────────────────────────────────────── рюкзак ──
/** Рюкзак, вид спереди: клапан, боковые карманы, лямки, светоотражатель. */
export function backpack({ cx = 450, cy = 570, w = 400, h = 460, body = C.navy, accent = C.amber, print = null } = {}) {
  const light = ((parseInt(body.slice(1, 3), 16) * 0.299 + parseInt(body.slice(3, 5), 16) * 0.587 + parseInt(body.slice(5, 7), 16) * 0.114) / 255) > 0.62;
  const edge = shade(body, light ? -30 : -32);
  const top = cy - h / 2;
  const bodyW = w * 0.82;
  return (
    `<defs><linearGradient id="bpG" x1="0.1" y1="0" x2="0.9" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="${light ? 0.4 : 0.12}"/><stop offset="1" stop-color="#000" stop-opacity="${light ? 0.1 : 0.24}"/></linearGradient></defs>` +
    `<g filter="url(#ground)">` +
    // ручка сверху
    `<path d="M${cx - w * 0.1} ${top + 8} q${w * 0.1} -46 ${w * 0.2} 0" fill="none" stroke="${shade(body, light ? -18 : 14)}" stroke-width="14" stroke-linecap="round"/>` +
    // боковые карманы
    `<path d="M${cx - bodyW / 2 - w * 0.07} ${cy - h * 0.16} q-${w * 0.04} 0 -${w * 0.04} ${h * 0.06} v${h * 0.2} q0 ${h * 0.06} ${w * 0.04} ${h * 0.06} Z" fill="${shade(body, light ? -12 : 12)}"/>` +
    `<path d="M${cx + bodyW / 2 + w * 0.07} ${cy - h * 0.16} q${w * 0.04} 0 ${w * 0.04} ${h * 0.06} v${h * 0.2} q0 ${h * 0.06} -${w * 0.04} ${h * 0.06} Z" fill="${shade(body, light ? -12 : 12)}"/>` +
    // корпус
    `<path d="M${cx - bodyW / 2} ${top + h * 0.1} q0 -${h * 0.1} ${w * 0.14} -${h * 0.1} h${bodyW - w * 0.28} q${w * 0.14} 0 ${w * 0.14} ${h * 0.1} v${h * 0.78} q0 ${h * 0.06} -${w * 0.06} ${h * 0.06} h-${bodyW - w * 0.12} q-${w * 0.06} 0 -${w * 0.06} -${h * 0.06} Z" fill="${body}"/>` +
    `<path d="M${cx - bodyW / 2} ${top + h * 0.1} q0 -${h * 0.1} ${w * 0.14} -${h * 0.1} h${bodyW - w * 0.28} q${w * 0.14} 0 ${w * 0.14} ${h * 0.1} v${h * 0.78} q0 ${h * 0.06} -${w * 0.06} ${h * 0.06} h-${bodyW - w * 0.12} q-${w * 0.06} 0 -${w * 0.06} -${h * 0.06} Z" fill="url(#bpG)"/>` +
    // клапан
    `<path d="M${cx - bodyW / 2} ${top + h * 0.1} q0 -${h * 0.1} ${w * 0.14} -${h * 0.1} h${bodyW - w * 0.28} q${w * 0.14} 0 ${w * 0.14} ${h * 0.1} v${h * 0.26} q-${bodyW / 2} ${h * 0.08} -${bodyW} 0 Z" fill="${shade(body, light ? -10 : 10)}"/>` +
    `<path d="M${cx - bodyW / 2} ${top + h * 0.36} q${bodyW / 2} ${h * 0.08} ${bodyW} 0" fill="none" stroke="${edge}" stroke-width="2" opacity="0.55"/>` +
    // пряжки
    `<rect x="${cx - w * 0.09}" y="${top + h * 0.33}" width="26" height="18" rx="4" fill="${accent}"/>` +
    `<rect x="${cx + w * 0.05}" y="${top + h * 0.33}" width="26" height="18" rx="4" fill="${accent}"/>` +
    // молния по центру
    `<path d="M${cx} ${top + h * 0.38} V${top + h * 0.88}" stroke="${edge}" stroke-width="3" stroke-dasharray="4 4" opacity="0.6"/>` +
    // светоотражающая полоса
    `<rect x="${cx - bodyW * 0.34}" y="${top + h * 0.72}" width="${bodyW * 0.68}" height="${h * 0.03}" rx="4" fill="#EDF1F5" opacity="0.85"/>` +
    (print ? `<g transform="translate(${cx} ${top + h * 0.55})">${print(w * 0.36)}</g>` : '') +
    `</g>`
  );
}


// ─────────────────────────────────────────────────────────── зонт ──
/**
 * Зонт: шесть клиньев через один, фестоны по нижней кромке, спицы,
 * ручка-крюк. Клинья считаются в полярных координатах от вершины купола.
 */
export function umbrella({ cx = 450, cy = 560, r = 260, colors = [C.navy, C.cream], print = null } = {}) {
  const apex = { x: cx, y: cy - r * 0.42 };
  const hemY = cy + r * 0.06;
  const R = r;
  const n = 6;
  const hemX = (i) => cx - R + (i * 2 * R) / n;
  const panel = (i) => {
    const x0 = hemX(i);
    const x1 = hemX(i + 1);
    const mid = (x0 + x1) / 2;
    const dx = x1 - x0;
    return (
      `M${apex.x} ${apex.y} ` +
      `Q${x0 + dx * 0.42} ${hemY - r * 0.42} ${x0} ${hemY} ` +
      `Q${mid} ${hemY + r * 0.06} ${x1} ${hemY} ` +
      `Q${x1 - dx * 0.42} ${hemY - r * 0.42} ${apex.x} ${apex.y} Z`
    );
  };
  return (
    `<g filter="url(#ground)">` +
    // ручка
    `<path d="M${cx} ${apex.y - r * 0.06} V${cy + r * 0.62} q0 ${r * 0.16} ${-r * 0.15} ${r * 0.16}" fill="none" stroke="#7A808C" stroke-width="9" stroke-linecap="round"/>` +
    `<path d="M${cx} ${apex.y - r * 0.16} V${apex.y + 2}" stroke="#7A808C" stroke-width="9" stroke-linecap="round"/>` +
    `<circle cx="${cx}" cy="${apex.y - r * 0.2}" r="7" fill="#7A808C"/>` +
    Array.from({ length: n }, (_, i) => `<path d="${panel(i)}" fill="${colors[i % colors.length]}"/>`).join('') +
    `<defs><radialGradient id="umG" cx="34%" cy="18%" r="85%"><stop offset="0" stop-color="#fff" stop-opacity="0.38"/><stop offset="1" stop-color="#000" stop-opacity="0.16"/></radialGradient></defs>` +
    Array.from({ length: n }, (_, i) => `<path d="${panel(i)}" fill="url(#umG)"/>`).join('') +
    // спицы и блик
    Array.from({ length: n + 1 }, (_, i) => {
      const x = hemX(i);
      return `<path d="M${apex.x} ${apex.y} Q${(apex.x + x) / 2} ${hemY - r * 0.38} ${x} ${hemY}" fill="none" stroke="#000" stroke-opacity="0.12" stroke-width="2"/>`;
    }).join('') +

    (print ? `<g transform="translate(${cx} ${cy - r * 0.1})">${print(r * 0.42)}</g>` : '') +
    `</g>`
  );
}


// ─────────────────────────────────────────────────────── лист наклеек ──
/** Лист с шестью наклейками: знак, печать, «1995», крыша, слово, дом. */
export function stickerSheet({ cx = 450, cy = 550, w = 520, h = 600 } = {}) {
  const pad = 46;
  const cols = 2;
  const rows = 3;
  const cellW = (w - pad * 2) / cols;
  const cellH = (h - pad * 2) / rows;
  const r = Math.min(cellW, cellH) * 0.44;
  const content = r * 1.44; // рабочая ширина рисунка внутри наклейки
  const cells = [
    pMark(content, { color: true }),
    `<g transform="translate(${-content * 0.5} ${-content * 0.5})">${seal({ r: content * 0.5, color: C.blue, id: 'stk1' })}</g>`,
    pWord('1995', content, { color: C.red, weight: 900, spacing: 0.04 }),
    roofBadge(content),
    pWord('НААШ', content, { color: C.blue, spacing: 0.04 }),
    `<g transform="translate(0 ${content * 0.03})">` +
      `<path d="M${-content * 0.4} ${-content * 0.28} L${content * 0.4} ${-content * 0.28} L${content * 0.22} ${content * 0.3} L${-content * 0.22} ${content * 0.3} Z" fill="none" stroke="${C.amber}" stroke-width="${content * 0.09}" stroke-linejoin="round"/>` +
      `<path d="M${-content * 0.12} ${content * 0.02} L${content * 0.12} ${content * 0.02}" stroke="${C.green}" stroke-width="${content * 0.09}"/>` +
      `</g>`,
  ];
  let out = '';
  for (let i = 0; i < 6; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = cx - w / 2 + pad + cellW * (col + 0.5);
    const y = cy - h / 2 + pad + cellH * (row + 0.5);
    out +=
      `<g transform="translate(${x} ${y})">` +
      `<circle r="${r}" fill="#fff"/>` +
      `<circle r="${r}" fill="none" stroke="#EBE7DA" stroke-width="1.8"/>` +
      `<circle r="${r}" fill="url(#stGlass)"/>` +
      cells[i] +
      `</g>`;
  }
  return (
    `<defs><radialGradient id="stGlass" cx="32%" cy="18%" r="90%"><stop offset="0" stop-color="#fff" stop-opacity="0.9"/><stop offset="0.6" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.05"/></radialGradient></defs>` +
    `<g filter="url(#soft)">` +
    `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="16" fill="#FCFBF7"/>` +
    `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="16" fill="none" stroke="#E4E0D2" stroke-width="2"/>` +
    out +
    `</g>`
  );
}


// ─────────────────────────────────────────────────────── значки (эмаль) ──
/** Три значка в ряд: знак в цвете, «1995» и крыша с полосой. */
export function pins({ cx = 450, cy = 545 } = {}) {
  const one = (x, y, r, inner) => `
    <g transform="translate(${x} ${y})">
      <circle r="${r}" fill="url(#pinRim)"/>
      <circle r="${r - r * 0.075}" fill="#FBF8F1"/>
      <circle r="${r - r * 0.075}" fill="url(#pinGlass)"/>
      ${inner}
    </g>`;
  return (
    `<defs>
      <linearGradient id="pinRim" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#F3DBA2"/><stop offset="0.45" stop-color="#C9A44C"/><stop offset="1" stop-color="#8B6C28"/>
      </linearGradient>
      <radialGradient id="pinGlass" cx="34%" cy="22%" r="85%">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.8"/>
        <stop offset="0.5" stop-color="#ffffff" stop-opacity="0.04"/>
        <stop offset="1" stop-color="#000000" stop-opacity="0.12"/>
      </radialGradient>
    </defs>` +
    `<g filter="url(#ground)">` +
    one(cx - 150, cy - 20, 112, `<g transform="translate(0 2)">${pMark(150, { color: true })}</g>`) +
    one(cx + 46, cy - 66, 80, pWord('1995', 86, { color: C.blue, weight: 900, spacing: 0.05 })) +
    one(cx + 96, cy + 116, 64, `<g transform="translate(0 4)">${roofBadge(92)}</g>`) +
    `</g>`
  );
}

/** Знак «крыша» без букв — для значков, нашивок и наклеек. */
export function roofBadge(size) {
  const s = size / 134;
  return `<g transform="translate(${-67 * s} ${34 * s}) scale(${s})">
    <path d="M-44 -14 L67 -86 L178 -14" fill="none" stroke="${C.blue}" stroke-width="9" stroke-linejoin="miter"/>
    <path d="M-30 -14 L67 -58 L164 -14" fill="none" stroke="${C.blue}" stroke-width="7.4" stroke-linejoin="miter"/>
    <path d="M56 -14 A11 11 0 0 1 78 -14" fill="none" stroke="${C.blue}" stroke-width="7.4"/>
    <rect x="0" y="14" width="134" height="6" fill="${C.blue}"/>
  </g>`;
}


// ─────────────────────────────────────────────────────── нашивка/шеврон ──
/** Тканая нашивка со скруглённым щитом, обмёткой и знаком. */
export function patch({ cx = 450, cy = 545, w = 340, h = 400, body = C.navy, thread = C.cream, print = null } = {}) {
  const shield = `M${cx - w / 2} ${cy - h * 0.34} Q${cx - w / 2} ${cy - h / 2} ${cx - w * 0.3} ${cy - h / 2} H${cx + w * 0.3} Q${cx + w / 2} ${cy - h / 2} ${cx + w / 2} ${cy - h * 0.34} V${cy + h * 0.28} Q${cx + w / 2} ${cy + h * 0.46} ${cx} ${cy + h * 0.5} Q${cx - w / 2} ${cy + h * 0.46} ${cx - w / 2} ${cy + h * 0.28} Z`;
  return (
    `<g filter="url(#ground)">` +
    `<path d="${shield}" fill="${shade(body, -16)}"/>` +
    `<path d="${shield}" transform="translate(0 6) scale(1)" fill="${body}" clip-path="none"/>` +
    `<g transform="translate(${cx} ${cy}) scale(0.94) translate(${-cx} ${-cy})"><path d="${shield}" fill="${body}"/></g>` +
    `<g transform="translate(${cx} ${cy}) scale(0.9) translate(${-cx} ${-cy})"><path d="${shield}" fill="none" stroke="${thread}" stroke-width="2.6" stroke-dasharray="8 6" opacity="0.85"/></g>` +
    (print ? `<g transform="translate(${cx} ${cy - h * 0.1})">${print(w * 0.62)}</g>` : '') +
    `<g transform="translate(${cx} ${cy + h * 0.24})">${pWord('1995', w * 0.3, { color: thread, spacing: 0.12 })}</g>` +
    `</g>`
  );
}


// ──────────────────────────────────────────────────── ланъярд с пропуском ──
/** Лента с карабином и бейдж: знак на ленте, имя и класс на карточке. */
export function lanyard({ cx = 450, cy = 600 } = {}) {
  const top = cy - 380;
  const strapW = 30;
  const clipY = cy - 156;
  const cardW = 280;
  const cardH = 340;
  const cardTop = cy - 128;
  const strapL = `M${cx - 120} ${top} C${cx - 126} ${top + 150} ${cx - 40} ${clipY - 20} ${cx - 6} ${clipY - 8}`;
  const strapR = `M${cx + 120} ${top} C${cx + 126} ${top + 150} ${cx + 40} ${clipY - 20} ${cx + 6} ${clipY - 8}`;
  return (
    `<g filter="url(#ground)">` +
    `<path d="${strapL}" fill="none" stroke="${C.blue}" stroke-width="${strapW}"/>` +
    `<path d="${strapR}" fill="none" stroke="${C.blue}" stroke-width="${strapW}"/>` +
    `<path d="${strapL}" fill="none" stroke="${C.cream}" stroke-width="2.6" stroke-dasharray="2 14" opacity="0.85"/>` +
    `<path d="${strapR}" fill="none" stroke="${C.cream}" stroke-width="2.6" stroke-dasharray="2 14" opacity="0.85"/>` +
    // карабин
    `<rect x="${cx - 15}" y="${clipY - 12}" width="30" height="38" rx="7" fill="#C2C8D2"/>` +
    `<rect x="${cx - 8}" y="${clipY - 6}" width="16" height="16" rx="3" fill="#8D95A3"/>` +
    // карточка
    `<rect x="${cx - cardW / 2}" y="${cardTop}" width="${cardW}" height="${cardH}" rx="16" fill="#FCFAF4" stroke="#E3DDCC" stroke-width="2"/>` +
    `<path d="M${cx - cardW / 2} ${cardTop + 16} a16 16 0 0 1 16 -16 h${cardW - 32} a16 16 0 0 1 16 16 v58 h-${cardW} Z" fill="${C.navy}"/>` +
    `<text x="${cx - cardW / 2 + 24}" y="${cardTop + 48}" ${font(900)} font-size="26" letter-spacing="3" fill="${C.cream}">НААШ</text>` +
    `<text x="${cx + cardW / 2 - 24}" y="${cardTop + 46}" text-anchor="end" ${font(500)} font-size="14" letter-spacing="2" fill="#9FB6D6">ПРОПУСК</text>` +
    `<text x="${cx - cardW / 2 + 24}" y="${cardTop + 116}" ${font(700)} font-size="25" fill="${C.ink}">Мария Соколова</text>` +
    `<text x="${cx - cardW / 2 + 24}" y="${cardTop + 148}" ${font(500)} font-size="19" fill="#7B7566">3 «Б» · школа № 186</text>` +
    `<path d="M${cx - cardW / 2 + 24} ${cardTop + 172} H${cx + cardW / 2 - 24}" stroke="#E7E1D2" stroke-width="1.4"/>` +
    `<text x="${cx - cardW / 2 + 24}" y="${cardTop + 196}" ${font(500)} font-size="14" letter-spacing="1.2" fill="#9A9384">ДЕЙСТВИТЕЛЕН ДО 31.08.2027</text>` +
    `<g transform="translate(${cx} ${cardTop + 258})">${pMark(84, { color: true })}</g>` +
    `<text x="${cx}" y="${cardTop + 312}" text-anchor="middle" ${font(500)} font-size="13" letter-spacing="2.6" fill="#B3AC9C">НИЖНИЙ НОВГОРОД</text>` +
    `</g>`
  );
}


// ─────────────────────────────────────────────────────── чехол телефона ──
export function phoneCase({ cx = 450, cy = 540, w = 240, h = 470, body = C.navy, print = null } = {}) {
  return (
    `<g filter="url(#ground)">` +
    `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="${w * 0.2}" fill="${body}"/>` +
    `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="${w * 0.2}" fill="url(#phShade)"/>` +
    `<defs><linearGradient id="phShade" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.18"/><stop offset="1" stop-color="#000" stop-opacity="0.2"/></linearGradient></defs>` +
    `<rect x="${cx - w * 0.32}" y="${cy - h * 0.4}" width="${w * 0.42}" height="${w * 0.42}" rx="${w * 0.12}" fill="#0B0F16" opacity="0.55"/>` +
    `<circle cx="${cx - w * 0.2}" cy="${cy - h * 0.34}" r="${w * 0.07}" fill="#1B2430"/>` +
    `<circle cx="${cx - w * 0.2}" cy="${cy - h * 0.34}" r="${w * 0.03}" fill="#3E5A78"/>` +
    (print ? `<g transform="translate(${cx} ${cy + h * 0.16})">${print(w * 0.52)}</g>` : '') +
    `</g>`
  );
}

// ────────────────────────────────────────────────────────── чехол ноутбука ──
export function sleeve({ cx = 450, cy = 540, w = 500, h = 360, body = C.stone, band = C.navy, print = null } = {}) {
  const light = isLight(body);
  const edge = shade(body, light ? -22 : -30);
  const x0 = cx - w / 2;
  const y0 = cy - h / 2;
  return (
    `<g filter="url(#ground)">` +
    `<defs>` +
    `<linearGradient id="slvG" x1="0" y1="0" x2="0.7" y2="1">` +
    `<stop offset="0" stop-color="#fff" stop-opacity="${light ? 0.4 : 0.2}"/>` +
    `<stop offset="0.55" stop-color="#fff" stop-opacity="0"/>` +
    `<stop offset="1" stop-color="#000" stop-opacity="${light ? 0.1 : 0.24}"/></linearGradient>` +
    `<filter id="felt" x="-10%" y="-10%" width="120%" height="120%">` +
    `<feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="4" result="n"/>` +
    `<feColorMatrix type="saturate" values="0" in="n" result="g"/>` +
    `<feComposite in="SourceGraphic" in2="g" operator="in" result="masked"/>` +
    `</filter>` +
    `</defs>` +
    // корпус с мягкими углами
    `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="${h * 0.09}" fill="${body}"/>` +
    `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="${h * 0.09}" fill="url(#slvG)"/>` +
    // фактура фетра
    `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="${h * 0.09}" filter="url(#felt)" opacity="0.16"/>` +
    // передний карман
    `<path d="M${x0 + w * 0.06} ${cy + h * 0.1} h${w * 0.88} v${h * 0.3} q0 ${h * 0.06} -${w * 0.03} ${h * 0.06} h-${w * 0.82} q-${w * 0.03} 0 -${w * 0.03} -${h * 0.06} Z" fill="${shade(body, light ? -8 : 12)}"/>` +
    `<path d="M${x0 + w * 0.06} ${cy + h * 0.1} h${w * 0.88}" stroke="${edge}" stroke-width="2.5" opacity="0.55"/>` +
    stitch(`M${x0 + w * 0.09} ${cy + h * 0.135} H${x0 + w * 0.91}`, shade(body, light ? -30 : 26), 1.6, '7 6') +
    // кант по периметру
    `<rect x="${x0 + 7}" y="${y0 + 7}" width="${w - 14}" height="${h - 14}" rx="${h * 0.08}" fill="none" stroke="${edge}" stroke-width="2" opacity="0.45"/>` +
    stitch(`M${x0 + 16} ${y0 + 18} H${x0 + w - 16}`, C.cream, 1.5, '6 7') +
    // контрастная планка-застёжка
    `<rect x="${x0 + w * 0.78}" y="${y0 + h * 0.24}" width="${w * 0.055}" height="${h * 0.3}" rx="${w * 0.028}" fill="${band}"/>` +
    `<circle cx="${x0 + w * 0.8075}" cy="${y0 + h * 0.31}" r="${h * 0.018}" fill="${shade(band, 34)}"/>` +
    // печать на кармане
    `<g transform="translate(${x0 + w * 0.22} ${cy + h * 0.26})">${print ? print(w * 0.18) : ''}</g>` +
    `</g>`
  );
}

// ─────────────────────────────────────────────────────────── коврик ──
/** Коврик 60×30: крупный знак сбоку, «1995» и отстрочка по краю. */
export function deskmat({ cx = 450, cy = 545, w = 660, h = 350, body = C.navy, print = null } = {}) {
  return (
    `<g filter="url(#ground)">` +
    `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="14" fill="${shade(body, -22)}"/>` +
    `<rect x="${cx - w / 2 + 5}" y="${cy - h / 2 + 5}" width="${w - 10}" height="${h - 10}" rx="11" fill="${body}"/>` +
    `<rect x="${cx - w / 2 + 5}" y="${cy - h / 2 + 5}" width="${w - 10}" height="${h - 10}" rx="11" fill="url(#dmG)"/>` +
    `<defs><linearGradient id="dmG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.12"/><stop offset="1" stop-color="#000" stop-opacity="0.22"/></linearGradient></defs>` +
    stitch(`M${cx - w / 2 + 16} ${cy - h / 2 + 16} H${cx + w / 2 - 16} V${cy + h / 2 - 16} H${cx - w / 2 + 16} Z`, C.cream, 1.5, '6 7') +
    (print ? `<g transform="translate(${cx + w * 0.24} ${cy - h * 0.04})">${print(w * 0.2)}</g>` : '') +
    `<text x="${cx - w / 2 + 46}" y="${cy + h * 0.13}" ${font(900)} font-size="${h * 0.15}" letter-spacing="${h * 0.03}" fill="${C.cream}" opacity="0.92">НААШ</text>` +
    `<text x="${cx - w / 2 + 48}" y="${cy + h * 0.26}" ${font(500)} font-size="${h * 0.062}" letter-spacing="${h * 0.028}" fill="${C.cream}" opacity="0.55">НИЖНИЙ НОВГОРОД · 1995</text>` +
    `</g>`
  );
}

// ────────────────────────────────────────────────────────── пауэрбанк ──
/** Пауэрбанк: корпус, индикатор из четырёх точек, USB-C и USB-A. */
export function powerbank({ cx = 450, cy = 545, w = 400, h = 225, body = C.graphite, print = null } = {}) {
  const light = isLight(body);
  const edge = shade(body, light ? -22 : 26);
  const x0 = cx - w / 2;
  const y0 = cy - h / 2;
  return (
    `<g filter="url(#ground)">` +
    `<defs>` +
    `<linearGradient id="pbG" x1="0" y1="0" x2="0.8" y2="1">` +
    `<stop offset="0" stop-color="#fff" stop-opacity="${light ? 0.4 : 0.26}"/>` +
    `<stop offset="0.5" stop-color="#fff" stop-opacity="0"/>` +
    `<stop offset="1" stop-color="#000" stop-opacity="${light ? 0.12 : 0.34}"/></linearGradient>` +
    `</defs>` +
    // корпус: верхняя панель светлее — читается объём
    `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="${h * 0.18}" fill="${body}"/>` +
    `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="${h * 0.18}" fill="url(#pbG)"/>` +
    `<rect x="${x0 + w * 0.02}" y="${y0 + h * 0.04}" width="${w * 0.96}" height="${h * 0.9}" rx="${h * 0.16}" fill="#fff" opacity="${light ? 0.2 : 0.05}"/>` +
    // индикатор: четыре сегмента
    Array.from({ length: 4 }, (_, i) =>
      `<rect x="${x0 + w * 0.08 + i * w * 0.045}" y="${y0 + h * 0.14}" width="${w * 0.032}" height="${h * 0.03}" rx="${h * 0.015}" fill="${i < 3 ? C.green : '#4B5563'}"/>`,
    ).join('') +
    `<text x="${x0 + w * 0.92}" y="${y0 + h * 0.175}" text-anchor="end" ${font(700)} font-size="${h * 0.075}" letter-spacing="${h * 0.012}" fill="#EDF1F5" opacity="0.5">10 000 mAh</text>` +
    // печать посередине
    (print ? `<g transform="translate(${cx - w * 0.08} ${cy + h * 0.02})">${print(w * 0.22)}</g>` : '') +
    // порты снизу
    `<rect x="${x0 + w * 0.1}" y="${y0 + h * 0.76}" width="${w * 0.12}" height="${h * 0.055}" rx="${h * 0.027}" fill="#0E1218"/>` +
    `<rect x="${x0 + w * 0.25}" y="${y0 + h * 0.76}" width="${w * 0.14}" height="${h * 0.055}" rx="${h * 0.014}" fill="#0E1218"/>` +
    `<circle cx="${x0 + w * 0.44}" cy="${y0 + h * 0.79}" r="${h * 0.022}" fill="${C.amber}" opacity="0.8"/>` +
    `<path d="M${x0 + w * 0.56} ${y0 + h * 0.79} h${w * 0.3}" stroke="${edge}" stroke-width="1.4" opacity="0.35"/>` +
    `</g>`
  );
}

// ───────────────────────────────────────────────────────── мышь ──
/** Мышь сверху: корпус с сужением к переду, шов кнопок, колесо, кабель. */
export function mouse({ cx = 450, cy = 560, body = C.cream, print = null } = {}) {
  const light = ((parseInt(body.slice(1, 3), 16) * 0.299 + parseInt(body.slice(3, 5), 16) * 0.587 + parseInt(body.slice(5, 7), 16) * 0.114) / 255) > 0.62;
  const edge = shade(body, light ? -34 : -28);
  const w = 220;
  const h = 330;
  const topY = cy - h * 0.5;
  const botY = cy + h * 0.5;
  const outline =
    `M${cx - w * 0.42} ${topY + h * 0.14} ` +
    `C${cx - w * 0.44} ${topY} ${cx + w * 0.44} ${topY} ${cx + w * 0.42} ${topY + h * 0.14} ` +
    `C${cx + w * 0.5} ${topY + h * 0.62} ${cx + w * 0.3} ${botY} ${cx} ${botY} ` +
    `C${cx - w * 0.3} ${botY} ${cx - w * 0.5} ${topY + h * 0.62} ${cx - w * 0.42} ${topY + h * 0.14} Z`;
  return (
    `<defs><radialGradient id="msG" cx="34%" cy="20%" r="80%"><stop offset="0" stop-color="#fff" stop-opacity="${light ? 0.75 : 0.26}"/><stop offset="1" stop-color="#000" stop-opacity="${light ? 0.1 : 0.24}"/></radialGradient></defs>` +
    `<g filter="url(#ground)">` +
    // кабель
    `<path d="M${cx} ${topY + 6} C${cx - w * 0.1} ${topY - h * 0.14} ${cx + w * 0.16} ${topY - h * 0.2} ${cx + w * 0.1} ${topY - h * 0.32}" fill="none" stroke="${edge}" stroke-width="5" stroke-linecap="round" opacity="0.75"/>` +
    `<path d="${outline}" fill="${body}"/>` +
    `<path d="${outline}" fill="url(#msG)"/>` +
    // шов кнопок
    `<path d="M${cx} ${topY + h * 0.06} V${topY + h * 0.34}" stroke="${edge}" stroke-width="2.2" opacity="0.55"/>` +
    `<path d="M${cx - w * 0.33} ${topY + h * 0.28} Q${cx} ${topY + h * 0.22} ${cx + w * 0.33} ${topY + h * 0.28}" fill="none" stroke="${edge}" stroke-width="1.6" opacity="0.32"/>` +
    // колесо
    `<rect x="${cx - 10}" y="${topY + h * 0.2}" width="20" height="52" rx="10" fill="${shade(body, light ? -46 : 26)}"/>` +
    `<rect x="${cx - 4}" y="${topY + h * 0.235}" width="8" height="36" rx="4" fill="${light ? '#8E8878' : '#C9CED6'}" opacity="0.75"/>` +
    (print ? `<g transform="translate(${cx} ${cy + h * 0.2})">${print(w * 0.36)}</g>` : '') +
    `</g>`
  );
}


// ─────────────────────────────────────────────────────── ланч-бокс ──
export function lunchbox({ cx = 450, cy = 560, w = 460, h = 250, body = C.clay, print = null } = {}) {
  const light = isLight(body);
  const edge = shade(body, light ? -26 : -30);
  const lidTop = cy - h * 0.52;
  const seam = cy - h * 0.02;
  const bottom = cy + h * 0.5;
  return (
    `<g filter="url(#ground)">` +
    `<defs><linearGradient id="lbG" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="#fff" stop-opacity="${light ? 0.45 : 0.2}"/>` +
    `<stop offset="0.55" stop-color="#fff" stop-opacity="0"/>` +
    `<stop offset="1" stop-color="#000" stop-opacity="${light ? 0.12 : 0.26}"/></linearGradient></defs>` +
    // ручка
    `<path d="M${cx - w * 0.2} ${lidTop + 4} q${w * 0.2} ${-h * 0.36} ${w * 0.4} 0" fill="none" stroke="${edge}" stroke-width="${h * 0.075}" stroke-linecap="round"/>` +
    `<path d="M${cx - w * 0.2} ${lidTop + 4} q${w * 0.2} ${-h * 0.36} ${w * 0.4} 0" fill="none" stroke="#fff" stroke-opacity="0.18" stroke-width="${h * 0.03}" stroke-linecap="round"/>` +
    // корпус
    `<path d="M${cx - w / 2} ${seam} h${w} v${(bottom - seam) * 0.82} q0 ${(bottom - seam) * 0.18} -${w * 0.05} ${(bottom - seam) * 0.18} h-${w * 0.9} q-${w * 0.05} 0 -${w * 0.05} -${(bottom - seam) * 0.18} Z" fill="${body}"/>` +
    `<path d="M${cx - w / 2} ${seam} h${w} v${(bottom - seam) * 0.82} q0 ${(bottom - seam) * 0.18} -${w * 0.05} ${(bottom - seam) * 0.18} h-${w * 0.9} q-${w * 0.05} 0 -${w * 0.05} -${(bottom - seam) * 0.18} Z" fill="url(#lbG)"/>` +
    // крышка
    `<path d="M${cx - w * 0.51} ${lidTop} q0 ${-h * 0.1} ${w * 0.05} ${-h * 0.1} h${w * 0.92} q${w * 0.05} 0 ${w * 0.05} ${h * 0.1} v${(seam - lidTop) * 0.84} h-${w * 1.02} Z" fill="${shade(body, light ? 6 : 14)}"/>` +
    `<path d="M${cx - w * 0.51} ${lidTop} q0 ${-h * 0.1} ${w * 0.05} ${-h * 0.1} h${w * 0.92} q${w * 0.05} 0 ${w * 0.05} ${h * 0.1} v${(seam - lidTop) * 0.84} h-${w * 1.02} Z" fill="url(#lbG)"/>` +
    // шов крышки
    `<path d="M${cx - w * 0.51} ${seam - 2} H${cx + w * 0.51}" stroke="${edge}" stroke-width="2.4" opacity="0.55"/>` +
    `<path d="M${cx - w * 0.51} ${lidTop + (seam - lidTop) * 0.3} H${cx + w * 0.51}" stroke="${edge}" stroke-width="1.4" opacity="0.22"/>` +
    // защёлки по бокам
    [-1, 1]
      .map((side) => {
        const lx = side > 0 ? cx + w * 0.52 : cx - w * 0.555;
        return (
          `<rect x="${lx}" y="${seam - h * 0.11}" width="${w * 0.035}" height="${h * 0.22}" rx="${h * 0.03}" fill="${shade(body, light ? -18 : 22)}"/>` +
          `<rect x="${lx + 3}" y="${seam - h * 0.06}" width="${w * 0.012}" height="${h * 0.12}" rx="2" fill="#fff" opacity="0.3"/>`
        );
      })
      .join('') +
    // гравировка на крышке
    (print ? `<g transform="translate(${cx} ${lidTop + (seam - lidTop) * 0.46})">${print(w * 0.2)}</g>` : '') +
    `</g>`
  );
}

// ─────────────────────────────────────────────────────── стикерпак «дом» ──
export function magnet({ cx = 450, cy = 545, w = 320, h = 400, body = '#FBF7EE', print = null } = {}) {
  return (
    `<g filter="url(#soft)">` +
    `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="16" fill="${body}" stroke="#E7DFCD" stroke-width="2"/>` +
    `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h * 0.16}" fill="${C.blue}"/>` +
    `<text x="${cx}" y="${cy - h / 2 + h * 0.108}" text-anchor="middle" ${font(700)} font-size="${h * 0.055}" letter-spacing="${h * 0.02}" fill="${C.cream}">С 1995 ГОДА</text>` +
    (print ? `<g transform="translate(${cx} ${cy - h * 0.06})">${print(w * 0.62)}</g>` : '') +
    `<text x="${cx}" y="${cy + h * 0.22}" text-anchor="middle" ${font(900)} font-size="${h * 0.085}" letter-spacing="${h * 0.012}" fill="${C.ink}">НИЖНИЙ</text>` +
    `<text x="${cx}" y="${cy + h * 0.32}" text-anchor="middle" ${font(900)} font-size="${h * 0.085}" letter-spacing="${h * 0.012}" fill="${C.ink}">НОВГОРОД</text>` +
    `<path d="M${cx - w * 0.22} ${cy + h * 0.38} H${cx + w * 0.22}" stroke="${C.red}" stroke-width="${h * 0.012}"/>` +
    `</g>`
  );
}

export { paperGrain };

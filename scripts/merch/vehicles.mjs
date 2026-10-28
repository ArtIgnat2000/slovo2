// Техника в ливрее: лайнер, школьный автобус, ретро-трамвай, болид, самокат,
// велосипед. Все шесть — в одном 3/4-ракурсе (камера спереди-справа-сверху),
// с одним светом и одной манерой: три тона на три плоскости, мягкая тень на
// полу, тонкая линия блика по крыше. Полка должна читаться как серия снятых
// моделей, а не как шесть разных наклеек.
//
// Мир: x — вперёд (нос вправо), y — вверх, z — на зрителя. Проекция — iso.mjs.
// Видны: ближний борт, крыша, нос. Дальние колёса и задний торец не рисуем —
// их всё равно скрывает корпус.

import { C, MARK_BOX, mark, esc, font } from './brand.mjs';
import { shade } from './garments.mjs';
import {
  pr,
  poly,
  line,
  topFace,
  endFace,
  sideFace,
  discX,
  discY,
  contact,
  arch,
  ISO_DEFS,
  SX,
  DYX,
  setDepth,
  depth,
} from './iso.mjs';

const fmt = (n) => Math.round(n * 100) / 100;
const TRICOLOR = [C.red, C.amber, C.green];
const TIRE = '#171B22';
const RIM = '#AEB5C0';
const HUB = '#78808D';
const GLASS = '#1D2B3A';

/** Три тона одной краски: крыша светлее, борт базовый, нос чуть светлее борта. */
const tones = (base) => ({ top: shade(base, 30), side: shade(base, -3), front: shade(base, 16) });

const scene = (body, { s = 1, cx = 450, cy = 600 } = {}) =>
  `<defs>${ISO_DEFS}</defs><g transform="translate(${cx} ${cy}) scale(${s})">${body}</g>`;

// ─────────────────────────────────────────────────── плоскости для графики ──
/** Группа на ближнем борту: u — вперёд, v — вниз. Текст читается прямо. */
function onSide(x, y, z, inner) {
  const [sx, sy] = pr(x, y, z);
  return `<g transform="translate(${fmt(sx)} ${fmt(sy)}) matrix(${SX} ${DYX} 0 1 0 0)">${inner}</g>`;
}

/** Группа на носовом торце: u — налево (влево по ходу), v — вниз. */
function onFront(x, y, z, inner) {
  const [sx, sy] = pr(x, y, z);
  const { dx, dy } = depth();
  return `<g transform="translate(${fmt(sx)} ${fmt(sy)}) matrix(${fmt(-dx)} ${fmt(-dy)} 0 1 0 0)">${inner}</g>`;
}

/** Группа на горизонтальной плоскости (дека, капот): u — вперёд, v — вглубь. */
function onTop(x, y, z, inner) {
  const [sx, sy] = pr(x, y, z);
  const { dx, dy } = depth();
  return `<g transform="translate(${fmt(sx)} ${fmt(sy)}) matrix(${SX} ${DYX} ${fmt(dx)} ${fmt(dy)} 0 0)">${inner}</g>`;
}

/** Знак по центру точки (x, y) на борту, ширина w в пикселях борта. */
function markSide(x, y, z, w, { color = false, mono = C.navy } = {}) {
  const k = w / MARK_BOX.w;
  const ox = (MARK_BOX.x + MARK_BOX.w / 2) * k;
  const oy = (MARK_BOX.y + MARK_BOX.h / 2) * k;
  return onSide(
    x,
    y,
    z,
    `<g transform="translate(${fmt(-ox)} ${fmt(-oy)})">${mark({ scale: k, color, mono, rule: false })}</g>`,
  );
}

/** Знак по центру точки на торце. */
function markFront(x, y, z, w, { color = false, mono = C.cream } = {}) {
  const k = w / MARK_BOX.w;
  const ox = (MARK_BOX.x + MARK_BOX.w / 2) * k;
  const oy = (MARK_BOX.y + MARK_BOX.h / 2) * k;
  return onFront(
    x,
    y,
    z,
    `<g transform="translate(${fmt(-ox)} ${fmt(-oy)})">${mark({ scale: k, color, mono, rule: false })}</g>`,
  );
}

/** Блик-объём по борту: сверху светлее, снизу темнее. */
const sheenDef = (id, yTop, yBottom) =>
  `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${fmt(yTop)}" x2="0" y2="${fmt(yBottom)}">` +
  `<stop offset="0" stop-color="#FFFFFF" stop-opacity="0.20"/>` +
  `<stop offset="0.2" stop-color="#FFFFFF" stop-opacity="0.02"/>` +
  `<stop offset="0.64" stop-color="#000000" stop-opacity="0"/>` +
  `<stop offset="1" stop-color="#000000" stop-opacity="0.18"/>` +
  `</linearGradient>`;

/** Колесо: шина с толщиной, диск, ступица, спицы, арка. */
function wheel(x, y, z, r, { spin = 0, tire = TIRE, rim = RIM, hub = HUB, arch = true, archColor = '#141A22' } = {}) {
  const spokes = Array.from({ length: 5 }, (_, i) => {
    const a = ((i * 72 + spin) * Math.PI) / 180;
    return line(
      [x + Math.cos(a) * r * 0.16, y + Math.sin(a) * r * 0.16, z + 0.8],
      [x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5, z + 0.8],
      shade(rim, -22),
      Math.max(2, r * 0.06),
      'stroke-linecap="round"',
    );
  }).join('');
  return (
    (arch ? discX(x, y, z - 2, r + 11, archColor, 'opacity="0.9"') : '') +
    discX(x, y, z - 4, r, shade(tire, -12)) +
    discX(x, y, z, r, tire) +
    discX(x - r * 0.02, y + r * 0.02, z + 0.3, r * 0.56, shade(rim, -34)) +
    discX(x - r * 0.02, y + r * 0.02, z + 0.5, r * 0.47, rim) +
    spokes +
    discX(x, y, z + 0.9, r * 0.19, hub) +
    discX(x - r * 0.05, y + r * 0.05, z + 1.1, r * 0.08, '#FFFFFF', 'opacity="0.4"')
  );
}

/** Лента триколора по борту: три тонкие линии. */
const liveryStripes = (z, x0, x1, y, h = 4.4, gap = 0.8) =>
  TRICOLOR.map((c, i) => sideFace(z, x0, x1, y + i * (h + gap), y + h + i * (h + gap), c)).join('');

/** Та же лента, но на носовом торце. */
const liveryStripesFront = (x, z0, z1, y, h = 4.4, gap = 0.8) =>
  TRICOLOR.map((c, i) => endFace(x, y + i * (h + gap), y + h + i * (h + gap), z0, z1, c)).join('');

// ───────────────────────────────────────────────────────────── автобус ──
/** Школьный автобус: длинный борт с окнами, кремовая юбка, номер рейса, знак. */
export function bus({ s = 1.12 } = {}) {
  const L = 300;
  const Z = 96;
  const y0 = 62;
  const y1 = 268;
  const ch = 26; // скос лобового
  const roofIn = Z - 14;
  const base = C.navy;
  const t = tones(base);
  const cream = C.cream;
  const wR = 64;

  const profile = [
    [-L, y0, Z],
    [-L, y1, Z],
    [L - ch, y1, Z],
    [L, y1 - ch, Z],
    [L, y0, Z],
  ];

  const body =
    sheenDef('busSheen', pr(0, y1, Z)[1], pr(0, y0, Z)[1]) +
    contact(14, 0, 0, 310, 170, 0.17) +
    // колёса (верх скрывает корпус)
    wheel(-190, wR, Z - 6, wR, { arch: false }) +
    wheel(178, wR, Z - 6, wR, { arch: false }) +
    // арки
    arch(-190, wR, Z + 0.4, wR + 10, '#1E2733', 7, 'opacity="0.55"') +
    arch(178, wR, Z + 0.4, wR + 10, '#1E2733', 7, 'opacity="0.55"') +
    // корпус
    poly(profile, t.side) +
    endFace(L, y0, y1 - ch, -Z, Z, t.front) +
    // скос лобового и закругление крыши
    poly(
      [
        [L - ch, y1, Z],
        [L, y1 - ch, Z],
        [L, y1 - ch, -Z],
        [L - ch, y1, -Z],
      ],
      shade(t.top, -12),
    ) +
    poly(
      [
        [-L, y1, Z],
        [L - ch, y1, Z],
        [L - ch, y1 + 10, roofIn],
        [-L, y1 + 10, roofIn],
      ],
      shade(t.top, -6),
    ) +
    topFace(-L, L - ch, -roofIn, roofIn, y1 + 10, t.top) +
    // крыша: кондиционер, люки
    topFace(-60, 60, -40, 40, y1 + 24, shade(t.top, -2)) +
    sideFace(40, -60, 60, y1 + 10, y1 + 24, shade(t.top, -14)) +
    endFace(60, y1 + 10, y1 + 24, -40, 40, shade(t.top, -18)) +
    topFace(-196, -148, -26, 26, y1 + 11, '#1B2735') +
    topFace(148, 196, -26, 26, y1 + 11, '#1B2735') +
    // кремовая юбка и лента
    sideFace(Z + 0.2, -L, L, y0, 152, cream) +
    endFace(L + 0.2, y0, 152, -Z, Z, shade(cream, -7)) +
    liveryStripes(Z + 0.6, -L, L, 138) +
    liveryStripesFront(L + 0.8, -Z + 10, Z - 10, 138) +
    // окна: кормовая часть, дверь, передняя часть
    sideFace(Z + 0.4, -286, -30, 162, 242, GLASS) +
    sideFace(Z + 0.5, -282, -34, 162, 182, shade(GLASS, 32)) +
    sideFace(Z + 0.4, 48, 292, 162, 242, GLASS) +
    sideFace(Z + 0.5, 52, 288, 162, 182, shade(GLASS, 32)) +
    sideFace(Z + 0.35, -24, 42, 54, 250, shade(cream, -12)) +
    sideFace(Z + 0.45, -18, 36, 78, 242, shade(GLASS, 16)) +
    sideFace(Z + 0.55, -14, 32, 78, 98, shade(GLASS, 44)) +
    sideFace(Z + 0.6, -18, 36, 156, 162, shade(cream, -22)) +
    // стойки
    [-222, -158, -94].map((x) => sideFace(Z + 0.9, x, x + 8, 162, 242, shade(base, -8))).join('') +
    [116, 180, 244].map((x) => sideFace(Z + 0.9, x, x + 8, 162, 242, shade(base, -8))).join('') +
    [-18, 30].map((x) => sideFace(Z + 1, x, x + 6, 78, 242, shade(base, 4))).join('') +
    // номер рейса и знак
    onSide(
      258,
      126,
      Z + 1.2,
      `<text x="0" y="0" ${font(900)} font-size="46" text-anchor="middle" fill="${base}" letter-spacing="-1">07</text>`,
    ) +
    markSide(-124, 108, Z + 1.2, 58, { mono: base }) +
    // блик по борту
    poly(
      profile.map(([x, y, z]) => [x, y, z + 1.6]),
      'url(#busSheen)',
    ) +
    // лобовое стекло и лицо
    endFace(L + 0.5, 158, 250, -84, 84, shade(cream, -10)) +
    endFace(L + 0.6, 166, 244, -76, 76, GLASS) +
    endFace(L + 0.9, 166, 190, -72, 72, shade(GLASS, 34)) +
    endFace(L + 0.9, 214, 240, 20, 74, shade(GLASS, 20), 'opacity="0.8"') +
    endFace(L + 0.6, 248, 264, -58, 58, '#0E151E') +
    endFace(L + 0.9, 252, 260, -50, 4, C.amber, 'opacity="0.92"') +
    endFace(L + 0.6, 96, 142, -94, -56, '#F7E9C2') +
    endFace(L + 0.6, 96, 142, 56, 94, '#F7E9C2') +
    endFace(L + 0.6, 108, 130, -42, 42, shade(base, -20)) +
    endFace(L + 0.6, 64, 90, -90, 90, shade(base, -24)) +
    // колёса в арках
    // зеркала
    line([L - 6, 206, Z - 6], [L + 8, 198, Z + 34], '#20262F', 5, 'stroke-linecap="round"') +
    poly(
      [
        [L + 2, 184, Z + 34],
        [L + 12, 184, Z + 34],
        [L + 12, 212, Z + 34],
        [L + 2, 212, Z + 34],
      ],
      '#20262F',
    ) +
    // блик по кромке крыши
    line([-L, y1 + 10, roofIn], [L - ch, y1 + 10, roofIn], '#FFFFFF', 3, 'opacity="0.28" stroke-linecap="round"');

  return scene(body, { s });
}

// ───────────────────────────────────────────────────────────── трамвай ──
/** Ретро-трамвай: красный кузов, кремовая лента, арочная крыша, пантограф. */
export function tram({ s = 1.06 } = {}) {
  const L = 278;
  const Z = 88;
  const y0 = 46;
  const y1 = 268;
  const roofY = 306;
  const base = C.red;
  const t = tones(base);
  const cream = C.cream;
  const navy = C.navy;
  const wR = 40;

  const profile = [
    [-L, y0, Z],
    [-L, y1, Z],
    [L - 34, y1, Z],
    [L, y1 - 30, Z],
    [L, y0, Z],
  ];

  const body =
    sheenDef('tramSheen', pr(0, y1, Z)[1], pr(0, y0, Z)[1]) +
    contact(0, 0, 0, 300, 180, 0.17) +
    // тележки
    sideFace(Z + 0.2, -L + 10, L - 10, y0, y0 + 26, shade(C.graphite, -6)) +
    [-190, -66, 66, 190].map((x) => wheel(x, wR, Z - 8, wR, { arch: false })).join('') +
    // кузов
    poly(profile, t.side) +
    endFace(L, y0, y1 - 30, -Z, Z, t.front) +
    poly(
      [
        [L - 34, y1, Z],
        [L, y1 - 30, Z],
        [L, y1 - 30, -Z],
        [L - 34, y1, -Z],
      ],
      shade(t.top, -12),
    ) +
    topFace(-L, L - 34, -Z, Z, y1, t.top) +
    // арочная кремовая крыша
    poly(
      [
        [-L, y1, Z],
        [L - 34, y1, Z],
        [L - 40, roofY, Z - 26],
        [-L + 6, roofY, Z - 26],
      ],
      cream,
    ) +
    topFace(-L + 6, L - 40, -(Z - 26), Z - 26, roofY, shade(cream, -6)) +
    endFace(L - 40, y1, roofY, -(Z - 26), Z - 26, shade(cream, -14)) +
    // кремовая лента с триколором
    sideFace(Z + 0.2, -L, L, 96, 152, cream) +
    endFace(L + 0.2, 96, 152, -Z, Z, shade(cream, -8)) +
    liveryStripes(Z + 0.6, -L, L, 136, 3.8, 0.6) +
    liveryStripesFront(L + 0.9, -Z + 12, Z - 12, 136, 3.8, 0.6) +
    // окна
    [-250, -178, -40, 32, 104, 176].map((x, i) =>
      sideFace(Z + 0.4, x, x + (i === 2 || i === 3 ? 52 : 64), 160, 256, GLASS) +
      sideFace(Z + 0.5, x + 3, x + (i === 2 || i === 3 ? 49 : 61), 160, 180, shade(GLASS, 30)),
    ).join('') +
    // двери
    [-132, 96].map((x) =>
      sideFace(Z + 0.7, x, x + 34, 96, 256, cream) +
      sideFace(Z + 0.9, x + 4, x + 30, 160, 250, shade(GLASS, 14)) +
      sideFace(Z + 1.1, x + 16, x + 18, 96, 256, shade(cream, -26)),
    ).join('') +
    // номер и знак
    onSide(
      240,
      126,
      Z + 1.2,
      `<text x="0" y="0" ${font(900)} font-size="40" text-anchor="middle" fill="${navy}" letter-spacing="-0.6">7</text>`,
    ) +
    markSide(-232, 122, Z + 1.2, 46, { mono: navy }) +
    // блик по борту
    poly(
      profile.map(([x, y, z]) => [x, y, z + 1.6]),
      'url(#tramSheen)',
    ) +
    // лобовое, маршрут, фара, бампер
    endFace(L + 0.5, 152, 252, -74, 74, cream) +
    endFace(L + 0.6, 158, 246, -68, -6, GLASS) +
    endFace(L + 0.6, 158, 246, 6, 68, GLASS) +
    endFace(L + 0.9, 158, 178, -64, -10, shade(GLASS, 34)) +
    endFace(L + 0.9, 158, 178, 10, 64, shade(GLASS, 34)) +
    endFace(L + 0.6, 254, 268, -56, 56, '#0E151E') +
    endFace(L + 0.9, 256, 266, -46, 6, C.amber, 'opacity="0.9"') +
    onFront(
      L + 1.2,
      118,
      0,
      `<ellipse cx="0" cy="0" rx="46" ry="24" fill="${shade(cream, -40)}"/>` +
        `<ellipse cx="0" cy="0" rx="38" ry="19" fill="#F8EED2"/>` +
        `<ellipse cx="0" cy="0" rx="19" ry="9" fill="#FFFCF2"/>`,
    ) +
    endFace(L + 0.5, 60, 92, -Z, Z, shade(base, -30)) +
    endFace(L + 0.6, 64, 86, -40, 40, shade(cream, -8)) +
    // пантограф
    line([-30, roofY, -24], [-30, roofY + 14, -24], '#2B3140', 12) +
    line([52, roofY, -24], [52, roofY + 14, -24], '#2B3140', 12) +
    line([-30, roofY + 6, 30], [46, roofY + 66, -26], '#39424F', 7, 'stroke-linecap="round"') +
    line([-30, roofY + 6, -30], [46, roofY + 66, 26], '#39424F', 7, 'stroke-linecap="round"') +
    line([46, roofY + 66, 26], [96, roofY + 96, 0], '#39424F', 7, 'stroke-linecap="round"') +
    line([46, roofY + 66, -26], [96, roofY + 96, 0], '#39424F', 7, 'stroke-linecap="round"') +
    line([92, roofY + 96, -48], [92, roofY + 96, 48], '#20262F', 8, 'stroke-linecap="round"') +
    line([92, roofY + 99, -40], [92, roofY + 99, 40], '#8A919C', 3, 'stroke-linecap="round"') +
    // блик по крыше
    line([-L + 6, roofY + 1, Z - 26], [L - 40, roofY + 1, Z - 26], '#FFFFFF', 3, 'opacity="0.3" stroke-linecap="round"');

  return scene(body, { s });
}

// ──────────────────────────────────────────────────────────────── болид ──
/** Болид: клин с кокпитом, открытые колёса, переднее и заднее крыло. */
export function raceCar({ s = 1.18 } = {}) {
  const base = C.navy;
  const t = tones(base);
  const amber = C.amber;
  const Z = 46;

  // сечения кузова: [x, верх, полуширина, низ]
  const st = [
    [214, 24, 16, 16],
    [186, 30, 26, 14],
    [140, 40, 34, 14],
    [96, 52, 44, 16],
    [40, 70, 46, 18],
    [-16, 86, 44, 18],
    [-72, 96, 42, 20],
    [-130, 98, 40, 22],
    [-180, 88, 34, 24],
    [-214, 72, 24, 24],
  ];

  const topEdge = st.map(([x, y, w]) => [x, y, w]);
  const botEdge = st.map(([x, y, w, b]) => [x, b, w]);
  const shellTop = [
    ...topEdge,
    ...[...topEdge].reverse().map(([x, y, w]) => [x, y, -w]),
  ];
  const shellSide = [...topEdge, ...[...botEdge].reverse()];

  const wFront = { x: 156, r: 42 };
  const wRear = { x: -164, r: 48 };
  const wZ = 88;

  const body =
    sheenDef('carSheen', pr(0, 98, Z)[1], pr(0, 14, Z)[1]) +
    contact(0, 0, 0, 280, 140, 0.18) +
    // заднее крыло
    // стойки «лебединая шея»
    poly(
      [
        [-196, 78, 34],
        [-186, 86, 34],
        [-186, 132, 34],
        [-196, 132, 34],
      ],
      '#20262F',
    ) +
    poly(
      [
        [-196, 78, -34],
        [-186, 86, -34],
        [-186, 132, -34],
        [-196, 132, -34],
      ],
      '#20262F',
    ) +
    poly(
      [
        [-226, 134, 94],
        [-182, 138, 94],
        [-182, 138, -94],
        [-226, 134, -94],
      ],
      t.top,
    ) +
    poly(
      [
        [-226, 134, 94],
        [-182, 138, 94],
        [-182, 126, 94],
        [-226, 122, 94],
      ],
      shade(base, -24),
    ) +
    poly(
      [
        [-182, 138, 94],
        [-174, 138, 94],
        [-174, 114, 94],
        [-182, 126, 94],
      ],
      amber,
    ) +
    poly(
      [
        [-226, 134, -94],
        [-182, 138, -94],
        [-182, 126, -94],
        [-226, 122, -94],
      ],
      shade(base, -34),
    ) +
    // дальние колёса
    wheel(wRear.x, wRear.r, -wZ, wRear.r, { arch: false, spin: 18 }) +
    wheel(wFront.x, wFront.r, -wZ, wFront.r, { arch: false, spin: 36 }) +
    // корпус
    poly(shellSide, t.side) +
    poly(shellTop, t.top) +
    // кокпит
    poly(
      [
        [46, 66, 38],
        [0, 82, 34],
        [-52, 90, 32],
        [-52, 90, -32],
        [0, 82, -34],
        [46, 66, -38],
      ],
      '#12171F',
    ) +
    poly(
      [
        [40, 70, 32],
        [2, 84, 28],
        [-46, 91, 26],
        [-46, 91, -26],
        [2, 84, -28],
        [40, 70, -32],
      ],
      '#24313F',
      'opacity="0.9"',
    ) +
    // воздухозаборник над головой
    poly(
      [
        [-44, 92, 24],
        [-62, 96, 22],
        [-62, 112, 22],
        [-44, 108, 24],
      ],
      t.side,
    ) +
    poly(
      [
        [-44, 108, 24],
        [-62, 112, 22],
        [-62, 112, -22],
        [-44, 108, -24],
      ],
      t.top,
    ) +
    poly(
      [
        [-62, 112, 22],
        [-62, 112, -22],
        [-62, 98, -22],
        [-62, 98, 22],
      ],
      '#0D1218',
    ) +
    // подголовник и дуга
    poly(
      [
        [-40, 96, 18],
        [-58, 98, 18],
        [-58, 98, -18],
        [-40, 96, -18],
      ],
      shade(base, -12),
    ) +
    line([-56, 88, -24], [-64, 124, -16], '#20262F', 8, 'stroke-linecap="round"') +
    line([-64, 124, -16], [-64, 124, 16], '#20262F', 8, 'stroke-linecap="round"') +
    line([-64, 124, 16], [-56, 88, 24], '#20262F', 8, 'stroke-linecap="round"') +
    // ливрея
    liveryStripes(Z + 0.5, -186, 132, 46, 3.6, 0.8) +
    onSide(
      96,
      42,
      Z + 1,
      `<text x="0" y="0" ${font(900)} font-size="38" text-anchor="middle" fill="${C.cream}" letter-spacing="-1">07</text>`,
    ) +
    markSide(-124, 60, Z + 1, 34, { mono: C.cream }) +
    // воздухозаборник
    poly(
      [
        [-24, 92, 34],
        [-46, 94, 32],
        [-46, 94, -32],
        [-24, 92, -34],
      ],
      '#0D1218',
    ) +
    // подвеска
    [1, -1].map((k) =>
      line([104, 44, k * 38], [156, 52, k * 82], '#20262F', 6, 'stroke-linecap="round"') +
      line([104, 22, k * 36], [156, 32, k * 82], '#20262F', 6, 'stroke-linecap="round"') +
      line([-116, 46, k * 36], [-164, 56, k * 84], '#20262F', 7, 'stroke-linecap="round"') +
      line([-116, 24, k * 34], [-164, 34, k * 84], '#20262F', 7, 'stroke-linecap="round"'),
    ).join('') +
    // ближние колёса
    wheel(wRear.x, wRear.r, wZ, wRear.r, { arch: false, spin: 18 }) +
    wheel(wFront.x, wFront.r, wZ, wFront.r, { arch: false, spin: 36 }) +
    // переднее крыло
    poly(
      [
        [176, 20, 96],
        [222, 22, 96],
        [222, 22, -96],
        [176, 20, -96],
      ],
      t.top,
    ) +
    poly(
      [
        [176, 20, 96],
        [222, 22, 96],
        [222, 12, 96],
        [176, 10, 96],
      ],
      shade(base, -24),
    ) +
    poly(
      [
        [176, 20, -96],
        [222, 22, -96],
        [222, 12, -96],
        [176, 10, -96],
      ],
      shade(base, -34),
    ) +
    poly(
      [
        [176, 20, 96],
        [222, 22, 96],
        [222, 40, 96],
        [176, 38, 96],
      ],
      shade(base, -16),
    ) +
    // блик
    poly(shellSide, 'url(#carSheen)') +
    line([36, 72, 48], [-176, 92, 42], '#FFFFFF', 2.6, 'opacity="0.32" stroke-linecap="round"');

  return scene(body, { s });
}

// ───────────────────────────────────────────────────────────── самокат ──
/** Складной самокат: низкая дека, стойка с вилкой, руль, два колеса. */
export function scooter({ s = 1.2 } = {}) {
  const base = C.navy;
  const deckY = 40;
  const Z = 36;
  const t = tones(base);
  const rearW = { x: -152, r: 36 };
  const frontW = { x: 148, r: 46 };
  const deckRear = -96;
  const deckFront = 70;
  const stemBase = { x: 74, y: deckY + 4 };
  const stemTop = { x: 106, y: 272 };

  const body =
    sheenDef('scootSheen', pr(0, deckY, Z)[1], pr(0, 20, Z)[1]) +
    contact(-16, 0, 0, 180, 76, 0.16) +
    // заднее колесо и маятник
    wheel(rearW.x, rearW.r, -8, rearW.r, { arch: false, spin: 12 }) +
    wheel(rearW.x, rearW.r, 0, rearW.r, { arch: false, spin: 12 }) +
    line([deckRear + 4, 30, -22], [rearW.x + 4, rearW.r, -16], shade(base, -8), 9, 'stroke-linecap="round"') +
    line([deckRear + 4, 30, 22], [rearW.x + 4, rearW.r, 16], shade(base, -8), 9, 'stroke-linecap="round"') +
    // дека
    poly(
      [
        [deckRear, 20, Z],
        [deckFront, 20, Z],
        [deckFront + 16, 20, 0],
        [deckFront, 20, -Z],
        [deckRear, 20, -Z],
      ],
      shade(base, -22),
    ) +
    poly(
      [
        [deckRear, deckY, Z],
        [deckFront, deckY, Z],
        [deckFront + 18, deckY, 0],
        [deckFront, deckY, -Z],
        [deckRear, deckY, -Z],
      ],
      t.top,
    ) +
    poly(
      [
        [deckRear, 20, Z],
        [deckFront, 20, Z],
        [deckFront, deckY, Z],
        [deckRear, deckY, Z],
      ],
      t.side,
    ) +
    poly(
      [
        [deckFront, 20, Z],
        [deckFront + 16, 20, 0],
        [deckFront + 18, deckY, 0],
        [deckFront, deckY, Z],
      ],
      t.front,
    ) +
    poly(
      [
        [deckRear, 20, Z],
        [deckRear + 14, 20, 0],
        [deckRear + 12, deckY, 0],
        [deckRear, deckY, Z],
      ],
      shade(t.side, -10),
    ) +
    // накладка
    poly(
      [
        [deckRear + 8, deckY + 0.7, 28],
        [deckFront - 6, deckY + 0.7, 28],
        [deckFront + 6, deckY + 0.7, 0],
        [deckFront - 6, deckY + 0.7, -28],
        [deckRear + 8, deckY + 0.7, -28],
      ],
      '#222C3A',
    ) +
    Array.from({ length: 8 }, (_, i) => {
      const x = deckRear + 16 + i * 20;
      return line([x, deckY + 1, -26], [x, deckY + 1, 26], '#3C4A5E', 2.6);
    }).join('') +
    markSide(deckRear + 34, 32, Z + 1, 26, { mono: C.cream }) +
    // вилка
    line([stemBase.x - 8, stemBase.y + 46, -24], [frontW.x - 4, frontW.r + 2, -18], '#C9CED6', 12, 'stroke-linecap="round"') +
    line([stemBase.x + 8, stemBase.y + 46, 24], [frontW.x + 4, frontW.r + 2, 18], '#C9CED6', 12, 'stroke-linecap="round"') +
    // стойка
    line([stemBase.x, stemBase.y, 0], [stemTop.x, stemTop.y, 0], shade(base, 4), 21, 'stroke-linecap="round"') +
    line([stemBase.x + 3, stemBase.y + 8, 6], [stemTop.x + 3, stemTop.y - 8, 6], '#DDE3EA', 6, 'stroke-linecap="round"') +
    // замок
    poly(
      [
        [stemBase.x - 15, stemBase.y + 2, 19],
        [stemBase.x + 15, stemBase.y + 14, 19],
        [stemBase.x + 15, stemBase.y + 14, -19],
        [stemBase.x - 15, stemBase.y + 2, -19],
      ],
      '#20262F',
    ) +
    // руль
    line([stemTop.x, stemTop.y, -62], [stemTop.x, stemTop.y, 62], '#20262F', 13, 'stroke-linecap="round"') +
    line([stemTop.x, stemTop.y, -62], [stemTop.x - 4, stemTop.y + 8, -78], '#0E1319', 19, 'stroke-linecap="round"') +
    line([stemTop.x, stemTop.y, 62], [stemTop.x - 4, stemTop.y + 8, 78], '#0E1319', 19, 'stroke-linecap="round"') +
    poly(
      [
        [stemTop.x - 15, stemTop.y - 6, 18],
        [stemTop.x + 17, stemTop.y - 6, 18],
        [stemTop.x + 17, stemTop.y - 6, -18],
        [stemTop.x - 15, stemTop.y - 6, -18],
      ],
      '#141A22',
    ) +
    discY(stemTop.x, stemTop.y - 2, 0, 8, C.amber) +
    // переднее колесо и крыло
    wheel(frontW.x, frontW.r, -8, frontW.r, { arch: false, spin: 24 }) +
    wheel(frontW.x, frontW.r, 0, frontW.r, { arch: false, spin: 24 }) +
    arch(frontW.x, frontW.r, 0, frontW.r + 3, t.side, 10) +
    arch(rearW.x, rearW.r, 0, rearW.r + 3, shade(base, 12), 8) +
    // подножка
    line([-96, 20, Z], [-24, 20, Z], '#20262F', 6, 'stroke-linecap="round"');

  return scene(body, { s, cy: 590 });
}

// ────────────────────────────────────────────────────────────── велосипед ──
/** Велосипед: рама из труб в двух плоскостях, колёса, седло, руль. */
export function bike({ s = 1.06 } = {}) {
  const base = C.blue;
  const R = 108;
  const rear = { x: -148, y: R };
  const front = { x: 164, y: R };
  const bb = { x: -4, y: R - 26 };
  const seatTop = { x: -62, y: R + 112 };
  const head = { x: 116, y: R + 96 };
  const stem = { x: 126, y: R + 128 };
  const saddle = { x: -68, y: R + 152 };

  const hoop = (c, z, r, w = 15) =>
    discX(c.x, c.y, z, r, 'none', `stroke="${TIRE}" stroke-width="${w}"`) +
    discX(c.x, c.y, z, r * 0.94, 'none', `stroke="${shade(RIM, -14)}" stroke-width="4.2"`) +
    discX(c.x, c.y, z + 0.1, r * 0.15, HUB) +
    Array.from({ length: 16 }, (_, i) => {
      const a = (i * 22.5 * Math.PI) / 180;
      return line(
        [c.x + Math.cos(a) * r * 0.15, c.y + Math.sin(a) * r * 0.15, z - 0.2],
        [c.x + Math.cos(a) * r * 0.9, c.y + Math.sin(a) * r * 0.9, z - 0.2],
        '#9AA1AB',
        1.2,
      );
    }).join('');

  const tube = (a, b, z = 0, w = 11, color = base) =>
    line([a.x, a.y, z], [b.x, b.y, z], color, w, 'stroke-linecap="round"');

  const body =
    contact(-4, 0, 0, 210, 84, 0.14) +
    // дальние перья и вилка
    tube(rear, bb, -17, 6.5, shade(base, -30)) +
    tube(seatTop, rear, -17, 6.5, shade(base, -30)) +
    tube(head, front, -15, 7.5, shade(base, -30)) +
    // колёса
    hoop(rear, 0, R) +
    hoop(front, 0, R) +
    // цепь
    line([bb.x, bb.y - 24, -9], [rear.x, rear.y + 20, -9], '#6B7280', 2.4, 'stroke-dasharray="4 3"') +
    line([bb.x, bb.y - 2, -9], [rear.x, rear.y - 4, -9], '#6B7280', 2.4, 'stroke-dasharray="4 3"') +
    // рама
    tube(rear, bb) +
    tube(bb, seatTop) +
    tube(bb, head) +
    tube(seatTop, head) +
    tube(seatTop, rear, 15, 6.5) +
    tube(rear, bb, 17, 6.5) +
    tube(head, front, 15, 7.5) +
    // рулевая колонка и вынос
    tube(head, stem, 0, 10, shade(base, -16)) +
    // подседельный штырь и седло
    line([seatTop.x, seatTop.y, 0], [saddle.x, saddle.y - 8, 0], '#2A3441', 9, 'stroke-linecap="round"') +
    poly(
      [
        [saddle.x - 34, saddle.y, 24],
        [saddle.x + 26, saddle.y, 21],
        [saddle.x + 26, saddle.y, -21],
        [saddle.x - 34, saddle.y, -24],
      ],
      '#161C24',
    ) +
    poly(
      [
        [saddle.x - 34, saddle.y + 10, 24],
        [saddle.x + 26, saddle.y + 10, 21],
        [saddle.x + 26, saddle.y, 21],
        [saddle.x - 34, saddle.y, 24],
      ],
      '#2A3542',
    ) +
    // руль с загибом назад
    line([stem.x, stem.y, -48], [stem.x, stem.y, 48], '#20262F', 9, 'stroke-linecap="round"') +
    line([stem.x, stem.y, 48], [stem.x - 16, stem.y + 4, 58], '#20262F', 9, 'stroke-linecap="round"') +
    line([stem.x, stem.y, -48], [stem.x - 14, stem.y - 12, -58], '#20262F', 9, 'stroke-linecap="round"') +
    line([stem.x - 16, stem.y + 4, 58], [stem.x - 34, stem.y + 8, 60], '#11161D', 13, 'stroke-linecap="round"') +
    line([stem.x - 14, stem.y - 12, -58], [stem.x - 32, stem.y - 12, -60], '#11161D', 13, 'stroke-linecap="round"') +
    // система, шатун и педаль
    discX(bb.x, bb.y, 18, 27, 'none', `stroke="${shade(RIM, -30)}" stroke-width="5.5"`) +
    discX(bb.x, bb.y, 20, 26, 'none', `stroke="${shade(base, -20)}" stroke-width="9"`) +
    discX(bb.x, bb.y, 22, 10, HUB) +
    line([bb.x, bb.y, 20], [bb.x + 26, bb.y - 26, 38], '#20262F', 6, 'stroke-linecap="round"') +
    poly(
      [
        [bb.x + 32, bb.y - 30, 46],
        [bb.x + 16, bb.y - 30, 46],
        [bb.x + 16, bb.y - 30, 26],
        [bb.x + 32, bb.y - 30, 26],
      ],
      '#20262F',
    ) +
    // знак на подседельной трубе
    markSide(-40, R + 46, 6.6, 24, { mono: C.cream }) +
    // катафоты
    discX(front.x, front.y, 6, 6, C.amber) +
    discX(rear.x, rear.y, 6, 6, C.red);

  return scene(body, { s });
}

// ──────────────────────────────────────────────────────────────── лайнер ──
/** Лайнер: фюзеляж-тубус, стреловидные крылья, киль, шасси, ливрея. */
export function airliner({ s = 1.14 } = {}) {
  setDepth(-0.58, 0.26);
  const R = 44;
  const yc = 122; // ось фюзеляжа
  const base = C.cream;
  const navy = C.navy;

  const fuse = [
    [-292, yc + 26, 0],
    [-252, yc + 40, 0],
    [110, yc + R, 0],
    [206, yc + 42, 0],
    [262, yc + 34, 0],
    [300, yc + 18, 0],
    [316, yc, 0],
    [298, yc - 20, 0],
    [252, yc - 34, 0],
    [150, yc - R, 0],
    [-150, yc - 42, 0],
    [-236, yc - 26, 0],
    [-292, yc + 2, 0],
  ];

  const yw = yc - 18;
  const wingPts = (k, col, span = 300) => {
    const zt = span;
    const pts = [
      [122, yw, k * 42],
      [-30, yw, k * 42],
      [-118, yw + 10, k * zt],
      [-34, yw + 10, k * zt],
    ];
    return (
      poly(pts, col) +
      // законцовка
      poly(
        [
          [-118, yw + 10, k * zt],
          [-34, yw + 10, k * zt],
          [-30, yw + 40, k * zt],
          [-112, yw + 40, k * zt],
        ],
        shade(col, -20),
      ) +
      line(pts[0], pts[3], shade(col, -40), 2.8) +
      line(pts[1], pts[2], shade(col, -24), 1.8)
    );
  };

  // гондола: стадион в плоскости борта + пилон
  const nac = (x0, x1, y0, r, z, fill) =>
    poly(
      [
        [x0, y0 + r, z],
        [x1, y0 + r, z],
        [x1, y0 - r, z],
        [x0, y0 - r, z],
      ],
      fill,
    ) +
    discX(x0, y0, z, r, fill) +
    discX(x1, y0, z, r, fill);

  const eng = (k, tone = '#D3DBE6') => {
    const z = k * 118;
    const y0 = yw - 26;
    return (
      // дальняя часть гондолы
      nac(30, 120, y0 - 5, 20, z - k * 28, shade(tone, -24)) +
      // пилон
      poly(
        [
          [56, yw + 10, z],
          [102, yw + 10, z],
          [102, y0 + 14, z],
          [56, y0 + 14, z],
        ],
        shade(tone, -18),
      ) +
      // ближняя часть
      nac(30, 120, y0, 22, z, tone) +
      line([38, y0 - 12, z + 0.4], [114, y0 - 11, z + 0.4], shade(tone, -26), 8, 'opacity="0.5"') +
      // воздухозаборник
      discX(120, y0, z + 0.2, 22, shade(tone, -36)) +
      discX(120, y0, z + 0.4, 16, '#26303C') +
      discX(120, y0, z + 0.6, 7, RIM)
    );
  };

  const gear = (x, z, r) =>
    line([x, yc - R + 6, z], [x, r + 2, z], '#2B3140', 6, 'stroke-linecap="round"') +
    discX(x, r, z - 4, r, TIRE) +
    discX(x, r, z, r, shade(TIRE, 6)) +
    discX(x, r, z + 0.4, r * 0.4, RIM);

  const body =
    `<defs>` +
    `<linearGradient id="plFuse" gradientUnits="userSpaceOnUse" x1="0" y1="${fmt(-(yc + R))}" x2="0" y2="${fmt(-(yc - R))}">` +
    `<stop offset="0" stop-color="#FFFFFF"/>` +
    `<stop offset="0.28" stop-color="${shade(base, 6)}"/>` +
    `<stop offset="0.74" stop-color="${shade(base, -8)}"/>` +
    `<stop offset="1" stop-color="${shade(base, -24)}"/>` +
    `</linearGradient>` +
    `<linearGradient id="plNavy" gradientUnits="userSpaceOnUse" x1="0" y1="${fmt(-(yc + 180))}" x2="0" y2="${fmt(-yc)}">` +
    `<stop offset="0" stop-color="${shade(navy, 34)}"/>` +
    `<stop offset="1" stop-color="${shade(navy, -12)}"/>` +
    `</linearGradient>` +
    `</defs>` +
    contact(-6, 0, 0, 300, 150, 0.13) +
    // шасси
    gear(-96, -66, 16) +
    gear(-96, 66, 16) +
    gear(248, 0, 14) +
    // дальняя плоскость и стабилизатор
    wingPts(-1, '#AEBAC9', 236) +
    eng(-1, '#B4C0CE') +
    poly(
      [
        [-244, yc + 18, -14],
        [-292, yc + 20, -104],
        [-314, yc + 20, -100],
        [-266, yc + 18, -14],
      ],
      shade(navy, -20),
    ) +
    // киль
    poly(
      [
        [-228, yc + 38, 0],
        [-302, yc + 26, 0],
        [-340, yc + 164, 0],
        [-284, yc + 172, 0],
      ],
      'url(#plNavy)',
    ) +
    // фюзеляж
    poly(fuse, 'url(#plFuse)') +
    // тёмная юбка, блик по верху
    line([-250, yc - 40, 0], [240, yc - 41, 0], shade(base, -34), 9, 'opacity="0.55" stroke-linecap="round"') +
    line([-246, yc + 40, 0], [232, yc + 40, 0], '#FFFFFF', 8, 'opacity="0.7" stroke-linecap="round"') +
    line([-240, yc + 22, 0], [226, yc + 22, 0], '#FFFFFF', 3, 'opacity="0.45" stroke-linecap="round"') +
    // хвост и нос в цвет
    poly(
      [
        [-292, yc + 26, 0],
        [-252, yc + 40, 0],
        [-252, yc - 40, 0],
        [-292, yc + 2, 0],
      ],
      navy,
    ) +
    poly(
      [
        [262, yc + 34, 0],
        [300, yc + 18, 0],
        [316, yc, 0],
        [298, yc - 20, 0],
        [252, yc - 34, 0],
        [246, yc - 14, 0],
        [250, yc + 14, 0],
      ],
      navy,
    ) +
    // кабина
    poly(
      [
        [252, yc + 18, 0],
        [288, yc + 12, 0],
        [292, yc - 2, 0],
        [254, yc + 2, 0],
      ],
      '#1D2B3A',
    ) +
    // лента, иллюминаторы, дверь
    TRICOLOR.map((c, i) => line([-228, yc - 12 + i * 6, 4], [244, yc - 13 + i * 6, 4], c, 4.4)).join('') +
    Array.from({ length: 16 }, (_, i) =>
      discX(-206 + i * 26, yc + 16, 6, 3.2, '#1D2B3A', 'opacity="0.85"'),
    ).join('') +
    poly(
      [
        [88, yc + 30, 2],
        [112, yc + 30, 2],
        [112, yc - 6, 2],
        [88, yc - 6, 2],
      ],
      shade(base, -22),
      'opacity="0.5"',
    ) +
    // ближнее крыло и двигатель
    wingPts(1, '#CCD5E0') +
    eng(1, '#D3DBE6') +
    // знак на киле и надпись
    markSide(-290, yc + 120, 1, 38, { mono: C.cream }) +
    onSide(
      148,
      yc + 28,
      2,
      `<text x="0" y="0" ${font(900)} font-size="30" fill="${navy}" letter-spacing="2.4">НААШ</text>`,
    ) +
    onSide(
      148,
      yc + 40,
      2,
      `<text x="0" y="0" ${font(500)} font-size="11" fill="${shade(navy, 30)}" letter-spacing="3">АЭРОЛИНИИ</text>`,
    );

  setDepth(-0.55, 0.36);
  return scene(body, { s, cy: 560 });
}

export { esc, font };

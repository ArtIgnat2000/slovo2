// Техника в ливрее: не вектор, а «съёмка».
//
// Почему так. Плоский вектор честно показывает композицию, но в нём нет того,
// из чего складывается ощущение настоящей вещи: отражений в краске, толщины
// стекла, зерна на резине. Полка ливреи — единственное место, где зритель
// сразу понимает «это фотография предмета», поэтому здесь работает съёмка:
// студийный кадр + наша бумага + знак, наложенный как краска по поверхности.
//
// Как собирается карточка:
//   1. бумага — та же функция `paper()`, что у всей серии;
//   2. кадр обрезан по габариту предмета (студия вокруг только мешает);
//   3. края кадра растворяются мягкой маской, поэтому прямоугольника не видно:
//      снимок уходит в бумагу постепенно;
//   4. знак — отдельный слой, смешанный с кадром (`screen` для кремовой краски
//      по тёмному борту, `multiply` для тёмной по светлому), с лёгким
//      размытием: так он читается как краска, а не как наклейка;
//   5. сверху — градиенты, зерно и векторные подписи `cardChrome()`.
//
// Исходники — `docs/merch/src/*-photo.webp` (студийные кадры, 1264 px). В git идут только готовые
// карточки `docs/merch/img/<id>.webp`.

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { C, mark, paper, svgDoc, MARK_BOX } from './brand.mjs';
import { cardChrome } from './card.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SRC = path.resolve(HERE, '../../docs/merch/src');

/** У id каталога и у файла кадра разные имена (bus-city → bus). */
const SHOT_FILE = {
  'plane-livery': 'plane',
  'bus-city': 'bus',
  'tram-nn': 'tram',
  'race-car': 'race',
  scooter: 'scooter',
  'bike-frame': 'bike',
};

/**
 * Настройки кадра.
 *
 * crop — габарит предмета в пикселях исходника (снят по тёмным и цветным
 *        пикселям), чтобы предмет занимал карточку, а не терялся в студии;
 * mark — центр и ширина знака в долях от обрезанного кадра;
 * ink  — цвет краски: 'cream' (по тёмному) или 'navy' (по светлому).
 */
export const PHOTOS = {
  'plane-livery': {
    crop: [200, 151, 1031, 654],
    pad: 26,
    mark: { x: 0.9, y: 0.29, w: 0.075, ink: 'cream' },
    tint: { saturation: 0.94, brightness: 1.02 },
  },
  'bus-city': {
    crop: [142, 200, 1100, 684],
    pad: 24,
    mark: { x: 0.2, y: 0.66, w: 0.1, ink: 'navy' },
    tint: { saturation: 0.96, brightness: 1.0 },
  },
  'tram-nn': {
    crop: [250, 74, 1073, 751],
    pad: 24,
    mark: { x: 0.27, y: 0.5, w: 0.07, ink: 'navy' },
    tint: { saturation: 0.97, brightness: 1.0 },
  },
  'race-car': {
    crop: [131, 220, 1156, 730],
    pad: 24,
    mark: { x: 0.455, y: 0.63, w: 0.058, ink: 'cream' },
    tint: { saturation: 0.99, brightness: 1.0 },
  },
  scooter: {
    crop: [305, 69, 926, 803],
    pad: 26,
    mark: { x: 0.5, y: 0.795, w: 0.11, ink: 'cream' },
    tint: { saturation: 0.97, brightness: 1.0 },
  },
  'bike-frame': {
    crop: [3, 135, 1155, 844],
    pad: 20,
    mark: { x: 0.405, y: 0.555, w: 0.032, ink: 'cream' },
    tint: { saturation: 0.96, brightness: 1.02 },
  },
};

const clamp = (min, max, v) => Math.min(max, Math.max(min, v));
const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Средний цвет «пустой студии»: берём углы уже обрезанного кадра. */
async function sampleCorners(sharp, file, box) {
  const side = 28;
  const spots = [
    [box.left, box.top],
    [box.left + box.width - side, box.top],
    [box.left, box.top + box.height - side],
    [box.left + box.width - side, box.top + box.height - side],
  ];
  const acc = [0, 0, 0];
  for (const [left, top] of spots) {
    const { data, info } = await sharp(file)
      .extract({ left, top, width: side, height: side })
      .raw()
      .toBuffer({ resolveWithObject: true });
    for (let i = 0; i < data.length; i += info.channels) {
      acc[0] += data[i];
      acc[1] += data[i + 1];
      acc[2] += data[i + 2];
    }
  }
  const n = spots.length * side * side;
  return acc.map((v) => v / n);
}

/** Близкие к цвету студии пиксели — в цвет бумаги, с мягким переходом. */
async function paintBackgroundToPaper(sharp, buf, bgRgb, cfg) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.from(data);
  const paper = hexToRgb(C.paper);
  const cx = info.width / 2;
  const cy = info.height / 2;
  const rx = info.width / 2;
  const ry = info.height / 2;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const i = (y * info.width + x) * info.channels;
      // вес растёт к краям кадра: в центре предмет не трогаем
      const rr = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      const edgeW = Math.min(1, Math.max(0, (rr - 0.62) / 0.5));
      if (edgeW <= 0) continue;
      const d = Math.max(
        Math.abs(data[i] - bgRgb[0]),
        Math.abs(data[i + 1] - bgRgb[1]),
        Math.abs(data[i + 2] - bgRgb[2]),
      );
      // далеко от цвета студии — это предмет, его не трогаем
      const keep = Math.min(1, Math.max(0, (d - 10) / 34));
      const w = edgeW * (1 - keep);
      if (w <= 0.002) continue;
      for (let c = 0; c < 3; c += 1) {
        out[i + c] = Math.round(data[i + c] * (1 - w) + paper[c] * w);
      }
    }
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

/** Поле печати карточки: сюда вписывается кадр. */
const FRAME = { x0: 56, y0: 132, x1: 844, y1: 950 };

/**
 * Карточка из фотографии → PNG-буфер 900×1120.
 */
export async function photoCard({ id, name, sub, tag = null, palette = [], w = 900, h = 1120 }) {
  const sharp = (await import('sharp')).default;
  const cfg = PHOTOS[id];
  if (!cfg) throw new Error(`нет настроек кадра для «${id}»`);
  const file = path.join(SRC, `${SHOT_FILE[id] ?? id}-photo.webp`);
  if (!existsSync(file)) throw new Error(`нет исходника ${file}`);

  const meta = await sharp(file).metadata();

  // ── 1. обрезка по предмету ──
  const [cx0, cy0, cx1, cy1] = cfg.crop;
  const pad = cfg.pad ?? 20;
  const left = Math.max(0, cx0 - pad);
  const top = Math.max(0, cy0 - pad);
  const width = Math.min(meta.width - left, cx1 - cx0 + pad * 2);
  const height = Math.min(meta.height - top, cy1 - cy0 + pad * 2);

  const fw = FRAME.x1 - FRAME.x0;
  const fh = FRAME.y1 - FRAME.y0;
  const scale = Math.min(fw / width, fh / height);
  const tw = Math.round(width * scale);
  const th = Math.round(height * scale);

  // ── 2. тон под бумагу серии ──
  // У студии тёплый серый, у бумаги — свой тон. Приводим кадр к бумаге по
  // углам: иначе полка выпадает из общего материала.
  const paperRgb = hexToRgb(C.paper);
  const corners = await sampleCorners(sharp, file, { left, top, width, height });
  const gain = paperRgb.map((p, i) => clamp(0.7, 1.45, p / Math.max(1, corners[i])));

  let shot = sharp(file)
    .extract({ left, top, width, height })
    .resize({ width: tw, height: th, fit: 'fill', kernel: 'lanczos3' });
  if (cfg.tint) shot = shot.modulate(cfg.tint);
  shot = shot.linear(gain, [0, 0, 0]);
  let subject = await shot.png().toBuffer();

  // ── 2a. фон кадра красим в бумагу ──
  // Студия светлее бумаги, и на растворении это давало белое гало вокруг
  // предмета. Поэтому пиксели, близкие к цвету студии, перекрашиваются в цвет
  // бумаги: край кадра уходит в бумагу не «светлым», а тем же тоном.
  subject = await paintBackgroundToPaper(sharp, subject, corners, cfg);

  // ── 3. мягкое растворение краёв ──
  // Маска — овал с большим размытием: у прямоугольника угол всегда читается,
  // у овала нет. Кадр «проявляется» из бумаги, а не лежит на ней карточкой.
  const mw = tw;
  const mh = th;
  const maskSvg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${mw}" height="${mh}">` +
    `<defs><filter id="f" x="-40%" y="-40%" width="180%" height="180%">` +
    `<feGaussianBlur stdDeviation="${Math.round(Math.min(mw, mh) * 0.045)}"/></filter></defs>` +
    `<rect x="${Math.round(mw * 0.02)}" y="${Math.round(mh * 0.03)}" ` +
    `width="${Math.round(mw * 0.96)}" height="${Math.round(mh * 0.94)}" ` +
    `rx="${Math.round(Math.min(mw, mh) * 0.1)}" fill="#fff" filter="url(#f)"/></svg>`;
  const mask = await sharp(Buffer.from(maskSvg)).greyscale().toBuffer();
  const keyed = await sharp(subject).ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();

  // ── 4. знак как краска по поверхности ──
  // Знак рисуем в 4× и уменьшаем: тонкие штрихи знака на 40 px иначе «мылятся».
  const markW = Math.max(20, Math.round(tw * cfg.mark.w));
  const k = markW / MARK_BOX.w;
  const ink = cfg.mark.ink === 'cream' ? '#F2EBDC' : C.navy;
  const markH = Math.round(markW * (MARK_BOX.h / MARK_BOX.w));
  const SS = 4;
  const markSvg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${markW * SS}" height="${markH * SS}">` +
    `<g transform="scale(${(k * SS).toFixed(5)})">` +
    mark({ scale: 1, color: false, mono: ink, rule: false }) +
    `</g></svg>`;
  const decal = await sharp(Buffer.from(markSvg))
    .resize({ width: markW, height: markH, fit: 'fill', kernel: 'lanczos3' })
    // краска ложится по поверхности: чуть размываем и оставляем зерно
    .blur(Math.max(0.3, markW * 0.006))
    .png()
    .toBuffer();
  const decalMeta = await sharp(decal).metadata();
  const left0 = FRAME.x0 + Math.round((fw - tw) / 2);
  const top0 = FRAME.y0 + Math.round((fh - th) / 2);
  const mx = Math.round(left0 + tw * cfg.mark.x - decalMeta.width / 2);
  const my = Math.round(top0 + th * cfg.mark.y - decalMeta.height / 2);

  // ── 5. бумага и свет ──
  // Фон — бумага серии, не кадр: так карточка ливреи живёт в одном материале
  // с остальными полками. Студию внутри снимка мы уже перекрасили в тон бумаги
  // (шаг 2a), поэтому кадр сходится с фоном без прямоугольника.
  const paperSvg = svgDoc(w, h, paper(w, h));
  const base = await sharp(Buffer.from(paperSvg)).png().toBuffer();

  const lightSvg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<defs>` +
    `<linearGradient id="foot" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${C.paper}" stop-opacity="0"/>` +
    `<stop offset="0.45" stop-color="${C.paper}" stop-opacity="0.5"/>` +
    `<stop offset="1" stop-color="${C.paper}" stop-opacity="0.95"/>` +
    `</linearGradient>` +
    `<radialGradient id="vig" cx="50%" cy="44%" r="70%">` +
    `<stop offset="0.5" stop-color="#5C4A2C" stop-opacity="0"/>` +
    `<stop offset="1" stop-color="#5C4A2C" stop-opacity="0.09"/>` +
    `</radialGradient>` +
    `<filter id="gr"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="11"/>` +
    `<feColorMatrix type="saturate" values="0"/></filter>` +
    `</defs>` +
    `<rect y="${Math.round(h * 0.68)}" width="${w}" height="${Math.round(h * 0.32)}" fill="url(#foot)"/>` +
    `<rect width="${w}" height="${h}" fill="url(#vig)"/>` +
    `<rect width="${w}" height="${h}" filter="url(#gr)" opacity="0.045" style="mix-blend-mode:multiply"/>` +
    `</svg>`;
  const overlay = await sharp(Buffer.from(lightSvg)).png().toBuffer();

  const chromeSvg = svgDoc(w, h, cardChrome({ w, h, name, sub, tag, palette }));
  const chrome = await sharp(Buffer.from(chromeSvg)).png().toBuffer();

  return sharp(base)
    .composite([
      { input: keyed, left: left0, top: top0 },
      { input: decal, left: mx, top: my, blend: cfg.mark.ink === 'cream' ? 'screen' : 'multiply' },
      { input: overlay, left: 0, top: 0 },
      { input: chrome, left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
}

/** Все шесть кадров полки ливреи. */
export const PHOTO_IDS = Object.keys(PHOTOS);

// Листы мерча и сборка данных для страницы.
//
//   goods    — карточки всех предметов каталога
//   covers   — обложки разделов
//   textile  — узоры, упаковка, лента
//   hero     — верхняя «съёмка» коллекции
//   mark     — знак, замки, печать

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { C, mark, lockupV, lockupH, seal, paper, svgDoc, text, MARK_BOX, fonts } from './brand.mjs';
import { productCard, sectionCard } from './card.mjs';
import { ITEMS, SECTIONS } from './catalog.mjs';
import { markSheets } from './sheets-mark.mjs';
import { tee, tote, hoodie } from './garments.mjs';
import { pMark, pLockupV } from './prints.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DOCS = path.join(ROOT, 'docs/merch');

// ─────────────────────────────────────────── единый масштаб предметов ──
// Разные предметы рисуются в своих координатах: футболка занимает почти всё
// поле, пауэрбанк — маленький прямоугольник. На полке это даёт «рваный» ритм.
// Поэтому перед рендером измеряем реальный габарит арта (по альфе) и вписываем
// его в общую рамку печати: так все предметы оптически одного веса.
const FRAME = { x0: 60, y0: 150, x1: 840, y1: 940 };

async function fitArt(art) {
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    return art; // без sharp масштаб не считаем — рендер всё равно не пойдёт
  }
  const probe = await sharp(Buffer.from(svgDoc(900, 1120, art)))
    .flatten({ background: '#000' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  // ﬂatten на чёрном: пиксель «светлее чёрного» = что-то нарисовано.
  const { data, info } = probe;
  let minX = 900, minY = 1120, maxX = -1, maxY = -1;
  for (let y = 0; y < info.height; y += 2) {
    for (let x = 0; x < info.width; x += 2) {
      const i = (y * info.width + x) * info.channels;
      if (data[i] + data[i + 1] + data[i + 2] > 96) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return art;
  const bw = maxX - minX;
  const bh = maxY - minY;
  const fw = FRAME.x1 - FRAME.x0;
  const fh = FRAME.y1 - FRAME.y0;
  // Крупные предметы (одежда, рюкзак, транспорт) уже занимают поле — их не
  // трогаем. Мелкие (ручка, пауэрбанк, мышь) подтягиваем, но не больше 1,35:
  // иначе вещь «наезжает» на карточку и выглядит как крупный план.
  const big = Math.max(bw, bh) > 520;
  const base = Math.min(fw / bw, fh / bh) * 0.94;
  const scale = big ? Math.min(1, Math.max(0.86, base)) : Math.min(1.35, Math.max(1, base));
  if (Math.abs(scale - 1) < 0.04) return art;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const targetX = (FRAME.x0 + FRAME.x1) / 2;
  const targetY = (FRAME.y0 + FRAME.y1) / 2;
  return (
    `<g transform="translate(${targetX} ${targetY}) scale(${scale.toFixed(4)}) translate(${(-cx).toFixed(2)} ${(-cy).toFixed(2)})">` +
    art +
    `</g>`
  );
}

/** Все предметы каталога → docs/merch/img/<id>.webp. */
async function goods(shot) {
  const made = [];
  for (const item of ITEMS) {
    await shot(
      item.id,
      productCard({
        art: await fitArt(item.art),
        name: item.name,
        sub: item.sub,
        tag: item.tag,
        palette: item.palette,
      }),
      760,
    );
    made.push(item.id);
  }
  return made;
}

/** Перенос строки по словам — для подзаголовков обложек. */
const wrap = (str, max = 62) => {
  const words = str.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).trim().length > max) {
      lines.push(line.trim());
      line = word;
    } else {
      line += ' ' + word;
    }
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
};

/** Обложки разделов: тёмная плашка, крупный знак, ничего лишнего. */
async function covers(shot) {
  const made = [];
  for (const section of SECTIONS) {
    const lines = wrap(section.lead, 58);
    const body =
      `<rect width="1400" height="520" fill="${C.navyDeep}"/>` +
      `<defs><radialGradient id="gl" cx="76%" cy="4%" r="78%">` +
      `<stop offset="0" stop-color="#1E559E" stop-opacity="0.85"/>` +
      `<stop offset="1" stop-color="#061B3D" stop-opacity="0"/></radialGradient></defs>` +
      `<rect width="1400" height="520" fill="url(#gl)"/>` +
      `<g transform="translate(1010 -70)">${mark({ scale: 2.1, color: false, mono: 'rgba(244,239,228,0.07)', rule: false })}</g>` +
      `<path d="M92 150 H236" stroke="${C.amber}" stroke-width="4"/>` +
      text(92, 268, section.title, { size: 78, color: C.cream, spacing: -0.8 }) +
      lines
        .map((line, i) =>
          text(94, 348 + i * 46, line, { size: 27, weight: 500, color: '#A9BBD6' }),
        )
        .join('');
    await shot(`cover-${section.id}`, svgDoc(1400, 520, body), 1200);
    made.push(`cover-${section.id}`);
  }
  return made;
}

// ──────────────────────────────────────────────────────────── узоры ──
/** Узор «крыши»: сетка знаков в шахматном порядке, обрезанная по листу. */
function patternSheet({ title, base, markColor, w = 900, h = 1120 }) {
  const step = 138;
  const size = 92;
  const top = 130;
  const bottom = h - 330;
  let grid = '';
  let row = 0;
  for (let y = top - 30; y < bottom - 60; y += step, row++) {
    const offset = row % 2 ? step / 2 : 0;
    for (let x = 30 + offset; x < w - 20; x += step) {
      grid += `<g transform="translate(${x} ${y})">${mark({
        scale: size / 140,
        color: false,
        mono: markColor,
        rule: false,
      })}</g>`;
    }
  }
  return svgDoc(
    w,
    h,
    `<defs><clipPath id="pt"><rect x="70" y="120" width="${w - 140}" height="${h - 260}" rx="4"/></clipPath></defs>` +
      `<rect width="${w}" height="${h}" fill="${C.paper}"/>` +
      `<g clip-path="url(#pt)"><rect x="70" y="120" width="${w - 140}" height="${h - 260}" fill="${base}"/>${grid}</g>` +
      `<rect x="70" y="120" width="${w - 140}" height="${h - 260}" rx="4" fill="none" stroke="rgba(20,26,36,.10)" stroke-width="2"/>` +
      text(w / 2, 1000, title, { size: 26, weight: 700, color: C.navy, anchor: 'middle', spacing: 3 }),
  );
}

async function textile(shot) {
  return Promise.all([
    shot(
      'pattern-wrap',
      patternSheet({ title: 'ОБЁРТОЧНАЯ БУМАГА · 70×100 СМ', base: C.paper, markColor: 'rgba(15,76,160,.55)' }),
      760,
    ),
    shot(
      'pattern-fabric',
      patternSheet({ title: 'ТКАНЬ ДЛЯ СУМОК И УПАКОВКИ', base: C.cream, markColor: 'rgba(10,44,94,.5)' }),
      760,
    ),
  ]);
}

/** Верхняя «съёмка»: футболка, худи и шоппер — три вещи и воздух. */
function hero() {
  const w = 2000;
  const h = 1000;
  const body =
    `<rect width="${w}" height="${h}" fill="${C.paper}"/>` +
    `<defs><radialGradient id="hv" cx="46%" cy="28%" r="82%">` +
    `<stop offset="0" stop-color="#ffffff" stop-opacity="0.95"/>` +
    `<stop offset="0.62" stop-color="#ffffff" stop-opacity="0.22"/>` +
    `<stop offset="1" stop-color="#7A6B4E" stop-opacity="0.14"/></radialGradient></defs>` +
    `<rect width="${w}" height="${h}" fill="url(#hv)"/>` +
    // водяной знак знака в углу
    `<g transform="translate(-40 -30)" opacity="0.55">${mark({ scale: 1.15, color: false, mono: 'rgba(10,44,94,0.045)', rule: false })}</g>` +
    tee({
      cx: 380,
      top: 270,
      w: 520,
      h: 560,
      body: C.cream,
      print: (s) => pMark(s, { color: true }),
      printW: 0.42,
      printY: 0.36,
    }) +
    hoodie({
      cx: 960,
      top: 340,
      w: 600,
      h: 570,
      body: C.navy,
      print: (s) => pMark(s, { color: false, mono: C.cream }),
      printW: 0.26,
      printY: 0.33,
    }) +
    tote({
      cx: 1560,
      cy: 600,
      w: 400,
      h: 420,
      body: C.cream,
      print: (s) => pLockupV(s, { color: C.navy }),
    }) +
    text(1900, 130, 'ЗНАК НА ВЕЩАХ', { size: 56, weight: 900, color: C.navy, spacing: 2, anchor: 'end' }) +
    text(1900, 186, 'Примеры оформления · 2026', { size: 28, weight: 500, color: 'rgba(20,26,36,0.45)', spacing: 1, anchor: 'end' }) +
    text(1900, 226, '37 примеров · 6 полок', { size: 28, weight: 500, color: 'rgba(20,26,36,0.45)', spacing: 1, anchor: 'end' });
  return svgDoc(w, h, body);
}

// ──────────────────────────────────────────────────────────── лукбук ──
// Одна «съёмка» из нескольких вещей: на полке каждая вещь живёт отдельно,
// а здесь видно, что они из одной серии.
//
// Каждая вещь нарисована в своём поле 900×1120 и не всегда по центру, поэтому
// ставим её не «на глаз», а по измеренному габариту: считаем bbox арта и
// вписываем в нужный прямоугольник раскладки.
const bboxCache = new Map();

async function measureArt(id, art) {
  if (bboxCache.has(id)) return bboxCache.get(id);
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    return null;
  }
  const { data, info } = await sharp(Buffer.from(svgDoc(900, 1120, art)))
    .flatten({ background: '#000' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let minX = 900, minY = 1120, maxX = -1, maxY = -1;
  for (let y = 0; y < info.height; y += 2) {
    for (let x = 0; x < info.width; x += 2) {
      const i = (y * info.width + x) * info.channels;
      if (data[i] + data[i + 1] + data[i + 2] > 96) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const box = maxX < 0 ? null : { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
  bboxCache.set(id, box);
  return box;
}

/** Вписать арт в прямоугольник {x0,y0,x1,y1}: по центру, с сохранением пропорций. */
async function placeIn(id, box) {
  const art = ITEMS.find((it) => it.id === id).art;
  const b = await measureArt(id, art);
  if (!b) return '';
  const bw = box.x1 - box.x0;
  const bh = box.y1 - box.y0;
  const k = Math.min(bw / b.w, bh / b.h);
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  const tx = box.x0 + bw / 2;
  const ty = box.y0 + bh / 2;
  return (
    `<g transform="translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${k.toFixed(4)}) translate(${(-cx).toFixed(1)} ${(-cy).toFixed(1)})">` +
    art +
    `</g>`
  );
}

async function lookbook() {
  const w = 1800;
  const h = 900;
  // Раскладка: дальний план — крупные вещи, передний — мелочь.
  const slots = [
    ['backpack-school', { x0: 40, y0: 150, x1: 420, y1: 720 }],
    ['tote-canvas', { x0: 1400, y0: 300, x1: 1780, y1: 800 }],
    ['tee-classic', { x0: 470, y0: 110, x1: 950, y1: 760 }],
    ['hoodie-roof', { x0: 980, y0: 60, x1: 1420, y1: 620 }],
    ['cap-roof', { x0: 120, y0: 640, x1: 460, y1: 880 }],
    ['notebook-a5', { x0: 420, y0: 640, x1: 640, y1: 880 }],
    ['pen-gel', { x0: 640, y0: 700, x1: 980, y1: 880 }],
    ['socks-pair', { x0: 1000, y0: 650, x1: 1220, y1: 880 }],
    ['bottle-steel', { x0: 1230, y0: 620, x1: 1400, y1: 880 }],
  ];
  const placed = (await Promise.all(slots.map(([id, box]) => placeIn(id, box)))).join('');
  const body =
    paper(w, h) +
    `<ellipse cx="900" cy="820" rx="760" ry="56" fill="#231C10" opacity="0.06"/>` +
    placed +
    text(96, 92, 'ОДНА СЕРИЯ', { size: 30, weight: 700, color: C.blue, spacing: 5 }) +
    text(96, 140, 'Знак, полоса из трёх цветов и один шрифт — на ткани, бумаге и металле', {
      size: 24,
      weight: 500,
      color: '#8A7F6B',
    });
  return svgDoc(w, h, body);
}

// ─────────────────────────────────────────────────────── статичные полки ──
// Полки пишутся прямо в HTML: страница должна показывать картинки даже без
// JavaScript (и без сборщика). Скрипт нужен только для просмотра крупно.
const escHtml = (str) =>
  String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const PATTERN_CARDS = {
  textile: [
    {
      name: 'Обёрточная бумага',
      sub: 'Узор из знака, шаг 7 мм, 70×100 см',
      src: './img/pattern-wrap.webp',
    },
    {
      name: 'Ткань для сумок и упаковки',
      sub: 'Тот же узор в один цвет — печать по льну и хлопку',
      src: './img/pattern-fabric.webp',
    },
  ],
};

const cardHtml = ({ src, name, sub, tag }) => {
  const alt = `${name} — ${sub}`;
  return (
    '          <article class="card">\n' +
    (tag ? `            <div class="card__tag">${escHtml(tag)}</div>\n` : '') +
    `            <img class="card__img" src="${src}" alt="${escHtml(alt)}" loading="lazy" decoding="async" tabindex="0" role="button" aria-label="${escHtml(name)}. Открыть крупно" />\n` +
    '            <div class="card__body">\n' +
    `              <h2 class="card__name">${escHtml(name)}</h2>\n` +
    (sub ? `              <p class="card__sub">${escHtml(sub)}</p>\n` : '') +
    '            </div>\n' +
    '          </article>\n'
  );
};

const shelvesHtml = () => {
  let out = '';
  for (const section of SECTIONS) {
    const own = ITEMS.filter((it) => it.section === section.id);
    out += `        <section id="${section.id}">\n`;
    out +=
      '          <div class="sec__cover">' +
      `<img class="sec__cover-img" src="./img/cover-${section.id}.webp" alt="${escHtml(section.title)}" loading="lazy" decoding="async" /></div>\n`;
    out += '          <div class="grid">\n';
    for (const item of own) {
      out += cardHtml({
        src: `./img/${item.id}.webp`,
        name: item.name,
        sub: item.sub,
        tag: item.tag,
      });
    }
    for (const extra of PATTERN_CARDS[section.id] ?? []) out += cardHtml(extra);
    out += '          </div>\n';
    if (PATTERN_CARDS[section.id]) {
      out +=
        '          <p class="sec__note">Эти два листа — материал, а не позиции каталога: ' +
        'узор можно использовать на бумаге и ткани, поэтому в счёте из 37 примеров его нет.</p>\n';
    }
    out += '        </section>\n';
  }
  return out;
};

const writeShelvesHtml = () => {
  const file = path.join(DOCS, 'index.html');
  const html = readFileSync(file, 'utf8');
  const start = html.indexOf('<!-- shelves:start');
  const end = html.indexOf('<!-- shelves:end -->');
  if (start < 0 || end < 0) throw new Error('в index.html нет маркеров shelves:start/shelves:end');
  const head = html.slice(0, html.indexOf('-->', start) + 3) + '\n';
  const tail = '        ' + html.slice(end);
  writeFileSync(file, head + shelvesHtml() + tail);
};

/** Данные для страницы: id, раздел, название, файл картинки. */
function writeCatalogJs() {
  const sections = SECTIONS.map((s) => ({
    id: s.id,
    title: s.title,
    lead: s.lead,
  }));
  const items = ITEMS.map((it) => ({
    id: it.id,
    section: it.section,
    name: it.name,
    sub: it.sub,
    tag: it.tag ?? null,
    palette: it.palette,
  }));
  // Пути — строками, а не import: страница открывается как обычный статический
  // сайт (npm run merch:preview), без сборщика. Браузер не умеет import './x.webp'.
  const js =
    '// Сгенерировано scripts/merch/sheets.mjs — не править руками.\n' +
    `export const heroImage = './img/hero.webp';\n` +
    `export const sections = ${JSON.stringify(sections, null, 2)};\n` +
    `export const items = ${JSON.stringify(items, null, 2)};\n` +
    `export const coverOf = (id) => \`./img/cover-\${id}.webp\`;\n` +
    `export const imageOf = (id) => \`./img/\${id}.webp\`;\n`;
  writeFileSync(path.join(DOCS, 'catalog.js'), js);
}

export const SHEETS = {
  mark: markSheets,
  goods: async (shot) => {
    const made = await goods(shot);
    return made;
  },
  covers: async (shot) => {
    const made = await covers(shot);
    // catalog.js собирается последним куском «товаров»: к этому моменту есть и
    // карточки, и обложки.
    writeCatalogJs();
    writeShelvesHtml();
    return made;
  },
  textile,
  hero: async (shot) => [await shot('hero', hero(), 1800)],
  lookbook: async (shot) => [await shot('lookbook', await lookbook(), 1800)],
};

export { goods, covers, textile, hero };

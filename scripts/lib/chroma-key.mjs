// Хромакей для иллюстраций сундуков (PNG за генератором: 8-bit TrueColor, «зелёный экран»).
//
// Почему свой проход, а не `convert -fuzz … -fill none -draw 'floodfill'`:
// у открытых сундуков из крышки идёт мягкое световое сияние, и от заливки по
// контуру оставался зелёный ореол, а сам сундук получал 2–3 px зелёной каймы
// (видно на превью, см. docs/chest-skins.png). Здесь считаем прозрачность
// ПО КАЖДОМУ ПИКСЕЛЮ: «зелёность» = g − max(r, b), она одинаково работает и
// для ярко-зелёного, и для приглушённого тёмно-зелёного фона у ночных обликов,
// а «разлив» зелёного в остатках сияния гасим, ограничивая g сверху.
//
// Модуль без зависимостей: zlib + ручной разбор PNG (IHDR/IDAT/IEND, фильтры 0..4).

import { deflateSync, inflateSync } from 'node:zlib';

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/** Разбор PNG: только то, что выдают генераторы картинок — 8 бит, TrueColor, без интерлейса. */
export function decodePng(buffer) {
  if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error('не PNG');
  let offset = 8;
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const depth = data[8];
      const colorType = data[9];
      const interlace = data[12];
      if (depth !== 8) throw new Error(`ожидались 8 бит на канал, а тут ${depth}`);
      if (interlace !== 0) throw new Error('интерлейс не поддерживается');
      if (colorType === 2) channels = 3;
      else if (colorType === 6) channels = 4;
      else throw new Error(`неизвестный тип цвета PNG: ${colorType}`);
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = Buffer.alloc(height * stride);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const out = pixels.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? out[x - channels] : 0;
      const up = prev[x];
      const upLeft = x >= channels ? prev[x - channels] : 0;
      let value = line[x];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        value += pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      }
      out[x] = value & 0xff;
    }
    prev = out;
  }
  return { width, height, channels, pixels };
}

/** Сохранение RGBA-PNG (фильтр 0: файл временный, размер не важен, важна предсказуемость). */
export function encodePng({ width, height, pixels }) {
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Снимает «зелёный экран» и возвращает RGBA-пиксели.
 *
 * Пороги считаются от фона: `key_bg` — медиана «зелёности» по рамке картинки.
 * Так один и тот же код работает и для яркой зелени (#00FF00), и для тёмной
 * (у ночных обликов фон уходит в #0a1f0a — жёсткий порог оставлял бы ореол).
 */
export function keyOutGreen({ width, height, channels, pixels }) {
  const max = Math.max;
  const at = (x, y) => {
    const i = (y * width + x) * channels;
    return [pixels[i], pixels[i + 1], pixels[i + 2]];
  };
  const greenness = (r, g, b) => g - max(r, b);

  // Фон измеряем по рамке: и «зелёность» (порог), и сам цвет (для размиксовки
  // кромки). Так один код работает и для яркого #00FF00, и для приглушённого
  // тёмно-зелёного фона ночных обликов.
  const border = [];
  for (let x = 0; x < width; x += 4) {
    border.push(at(x, 0), at(x, height - 1));
  }
  for (let y = 0; y < height; y += 4) {
    border.push(at(0, y), at(width - 1, y));
  }
  const median = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)] || 0;
  };
  const bg = [
    median(border.map((p) => p[0])),
    median(border.map((p) => p[1])),
    median(border.map((p) => p[2])),
  ];
  const keyBg = greenness(...bg);

  const t0 = Math.min(38, Math.max(6, keyBg * 0.16));
  const t1 = Math.min(150, Math.max(t0 + 22, keyBg * 0.55));

  const out = Buffer.alloc(width * height * 4);
  for (let i = 0, p = 0; i < pixels.length; i += channels, p += 4) {
    const [r, g, b] = [pixels[i], pixels[i + 1], pixels[i + 2]];
    const key = greenness(r, g, b);
    let alpha = 255;
    if (key >= t1) alpha = 0;
    else if (key >= t0) alpha = Math.round((255 * (t1 - key)) / (t1 - t0));
    else if (key > 0) {
      // Слабый «зелёный» оттенок — это сглаженная кромка или мягкое сияние из
      // открытой крышки. Отдаём часть прозрачности, чтобы кромка не была пилой,
      // а свет оставался светом (иначе он превращался в плотные кремовые клинья).
      alpha = Math.round((255 * (t0 - key)) / t0);
    }

    if (alpha === 0) {
      out[p] = 0;
      out[p + 1] = 0;
      out[p + 2] = 0;
      out[p + 3] = 0;
      continue;
    }
    if (alpha < 255) {
      // Размиксовка (unpremultiply): наблюдаемый цвет = alpha·F + (1−alpha)·фон.
      // Возвращаем истинный цвет объекта — тогда на ЛЮБОЙ подложке (тёмная сцена
      // открытия, светлая карточка) кромка выглядит чистой, без зелёной каймы.
      // Без этого шага превью показывало светло-мятный ореол вокруг сундука.
      const a = alpha / 255;
      const unmix = (c, bgc) => {
        const value = Math.round((c - (1 - a) * bgc) / a);
        return value < 0 ? 0 : value > 255 ? 255 : value;
      };
      const fr = unmix(r, bg[0]);
      const fg = unmix(g, bg[1]);
      const fb = unmix(b, bg[2]);
      // Зелёного в самих обликах нет (см. промпты в PLAN): если после размиксовки
      // в смешанной зоне G всё равно обгоняет R/B, значит осталась примесь фона —
      // подрезаем её. Иначе на свету оставались жёлто-зелёные клинья.
      const cap = Math.max(fr, fb) + 6;
      out[p] = fr;
      out[p + 1] = fg > cap ? cap : fg;
      out[p + 2] = fb;
      out[p + 3] = alpha;
      continue;
    }
    out[p] = r;
    out[p + 1] = g;
    out[p + 2] = b;
    out[p + 3] = 255;
  }
  return { width, height, pixels: out, keyBg: Math.round(keyBg), t0: Math.round(t0), t1: Math.round(t1) };
}

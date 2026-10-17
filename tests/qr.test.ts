// QR-код ссылки на приложение (обратная связь 2026-10-14: «непонятно, как передать
// ссылку новому ученику»).
//
// Проверяем не «нарисовалось ли что-то», а сам код:
//  • ёмкости и разбивка на блоки — по таблицам стандарта (ISO/IEC 18004);
//  • служебные биты формата и версии — по эталонным значениям из стандарта;
//  • матрица читается ОБРАТНО: снимаем маску, идём «змейкой», собираем кодовые
//    слова, у каждого блока проверяем синдромы Рида–Соломона (все нули) и
//    разбираем заголовок — текст должен совпасть с исходным;
//  • эталонная матрица зафиксирована снимком: если раскладка изменится, тест
//    упадёт и заставит перепроверить код внешним декодером (при разработке
//    матрица сверена с библиотекой `qrcode` — 0 отличий — и прочитана `jsqr`).
import assert from 'node:assert/strict';
import {
  QR_MAX_VERSION,
  qrByteCapacity,
  qrEccLayout,
  qrEncode,
  qrFormatBits,
  qrPickVersion,
  qrReservedModules,
  qrVersionBits,
  type QrEcc,
  type QrMatrix,
} from '../src/engine/qr';
import { QR_MODULE_PX, QR_QUIET_ZONE, qrPngBytes, qrPngDataUrl } from '../src/engine/qrPng';
import { decodePng, pngBytesFromDataUrl } from './qr-png-helper';

// ── Ёмкости: сколько байт влезает в каждую версию (таблица стандарта) ────────
{
  const m = [14, 26, 42, 62, 84, 106, 122, 152, 180, 213];
  const l = [17, 32, 53, 78, 106, 134, 154, 192, 230, 271];
  for (let version = 1; version <= QR_MAX_VERSION; version++) {
    assert.equal(qrByteCapacity(version, 'M'), m[version - 1], `версия ${version}-M`);
    assert.equal(qrByteCapacity(version, 'L'), l[version - 1], `версия ${version}-L`);
  }
  assert.equal(qrPickVersion(37, 'M'), 3, 'ссылка на Pages укладывается в версию 3');
  assert.equal(qrPickVersion(14, 'M'), 1);
  assert.equal(qrPickVersion(15, 'M'), 2, 'на байт больше — берём следующую версию');
  assert.equal(qrPickVersion(213, 'M'), 10);
  assert.equal(qrPickVersion(214, 'M'), null, 'чересчур длинное — кода не будет');
  assert.equal(qrPickVersion(271, 'L'), 10, 'на уровне L влезает больше');
  assert.equal(qrPickVersion(272, 'L'), null);
}

// ── Разбивка на блоки: данные и коррекция по версиям ────────────────────────
{
  assert.deepEqual(qrEccLayout(3, 'M'), {
    totalCodewords: 70,
    blockCount: 1,
    ecPerBlock: 26,
    blocksInGroup1: 1,
    dataInGroup1: 44,
    blocksInGroup2: 0,
    dataInGroup2: 45,
  });
  assert.deepEqual(qrEccLayout(5, 'L'), {
    totalCodewords: 134,
    blockCount: 1,
    ecPerBlock: 26,
    blocksInGroup1: 1,
    dataInGroup1: 108,
    blocksInGroup2: 0,
    dataInGroup2: 109,
  });
  const v10 = qrEccLayout(10, 'M');
  assert.equal(v10.blockCount, 5);
  assert.equal(v10.ecPerBlock, 26);
  assert.equal(v10.blocksInGroup1 * v10.dataInGroup1 + v10.blocksInGroup2 * v10.dataInGroup2, 216);
}

// ── Служебные биты: эталонные значения из стандарта ─────────────────────────
{
  assert.equal(qrFormatBits('M', 0), 0b101010000010010);
  assert.equal(qrFormatBits('L', 0), 0b111011111000100);
  assert.equal(qrFormatBits('M', 2), 0b101111001111100);
  // Битовая запись информации о версии — прямо из таблицы стандарта (приложение D).
  assert.equal(qrVersionBits(7), 0b000111110010010100, 'информация о версии 7');
  assert.equal(qrVersionBits(8), 0b001000010110111100);
  assert.equal(qrVersionBits(9), 0b001001101010011001);
  assert.equal(qrVersionBits(10), 0b001010010011010011);
}

// ── Арифметика поля Галуа и проверка синдромов (независимая копия) ──────────
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}
const mul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/** Условия маски — те же, что в стандарте, записаны заново руками. */
const MASK_RULES: ((row: number, col: number) => boolean)[] = [
  (row, col) => (row + col) % 2 === 0,
  (row) => row % 2 === 0,
  (_row, col) => col % 3 === 0,
  (row, col) => (row + col) % 3 === 0,
  (row, col) => (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0,
  (row, col) => ((row * col) % 2) + ((row * col) % 3) === 0,
  (row, col) => (((row * col) % 2) + ((row * col) % 3)) % 2 === 0,
  (row, col) => (((row + col) % 2) + ((row * col) % 3)) % 2 === 0,
];

/** Обратное чтение: снимаем маску, идём «змейкой» по два столбца, собираем байты. */
function readCodewords(matrix: QrMatrix): number[] {
  const { size, modules, version, mask } = matrix;
  const reserved = qrReservedModules(version);
  const maskFn = MASK_RULES[mask];
  const bits: number[] = [];
  let row = size - 1;
  let direction = -1;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (;;) {
      for (let c = 0; c < 2; c++) {
        const target = col - c;
        const index = row * size + target;
        if (reserved[index]) continue;
        let dark = modules[index];
        if (maskFn(row, target)) dark = !dark;
        bits.push(dark ? 1 : 0);
      }
      row += direction;
      if (row < 0 || row >= size) {
        row -= direction;
        direction = -direction;
        break;
      }
    }
  }
  const codewords: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    codewords.push(byte);
  }
  return codewords;
}

/** Обратная сборка блоков: данные и коррекция каждого блока порознь. */
function readBlocks(codewords: number[], version: number, ecc: QrEcc): { data: number[][]; full: number[][] } {
  const { blockCount, blocksInGroup1, dataInGroup1, dataInGroup2, ecPerBlock } = qrEccLayout(version, ecc);
  const dataSize = (block: number) => (block < blocksInGroup1 ? dataInGroup1 : dataInGroup2);
  const data: number[][] = Array.from({ length: blockCount }, (_, block) => []);
  const ec: number[][] = Array.from({ length: blockCount }, () => []);
  let index = 0;
  const maxData = Math.max(dataInGroup1, dataInGroup2);
  for (let i = 0; i < maxData; i++) {
    for (let block = 0; block < blockCount; block++) {
      if (i < dataSize(block)) data[block].push(codewords[index++]);
    }
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (let block = 0; block < blockCount; block++) ec[block].push(codewords[index++]);
  }
  return { data, full: data.map((block, i) => [...block, ...ec[i]]) };
}

/** Синдромы: у корректного блока коррекции они все равны нулю. */
function syndromes(block: number[], ecCount: number): number[] {
  const result: number[] = [];
  for (let s = 0; s < ecCount; s++) {
    let sum = 0;
    for (let i = 0; i < block.length; i++) {
      sum ^= mul(block[i], EXP[(s * (block.length - 1 - i)) % 255]);
    }
    result.push(sum);
  }
  return result;
}

/** Заголовок: режим 0100, счётчик байт, сами байты — и текст обратно. */
function readText(codewords: number[], version: number): string {
  const bits: number[] = [];
  for (const byte of codewords) {
    for (let i = 7; i >= 0; i--) bits.push((byte >> i) & 1);
  }
  const take = (from: number, length: number) => {
    let value = 0;
    for (let i = 0; i < length; i++) value = (value << 1) | bits[from + i];
    return value;
  };
  assert.equal(take(0, 4), 0b0100, 'режим должен быть байтовым');
  const countLength = version < 10 ? 8 : 16;
  const length = take(4, countLength);
  const bytes: number[] = [];
  for (let i = 0; i < length; i++) bytes.push(take(4 + countLength + i * 8, 8));
  return new TextDecoder().decode(new Uint8Array(bytes));
}

// ── Полный круг: код → матрица → обратное чтение → тот же текст ─────────────
{
  const samples = [
    'https://artignat2000.github.io/slovo2/',
    'http://localhost:5173/',
    'https://artignat2000.github.io/slovo2/?diag=1',
    'СЛОВО 2.0 — ссылка с юникодом',
    `https://artignat2000.github.io/slovo2/${'x'.repeat(150)}`,
  ];
  for (const text of samples) {
    const matrix = qrEncode(text);
    assert.ok(matrix, `код для «${text.slice(0, 30)}…» должен построиться`);
    const codewords = readCodewords(matrix);
    const { data, full } = readBlocks(codewords, matrix.version, matrix.ecc);
    const ecCount = qrEccLayout(matrix.version, matrix.ecc).ecPerBlock;
    for (const [index, block] of full.entries()) {
      const bad = syndromes(block, ecCount).filter((value) => value !== 0);
      assert.equal(bad.length, 0, `блок ${index} версии ${matrix.version}-${matrix.ecc}: коррекция не сходится`);
    }
    // Данные идут по блокам по очереди, поэтому склеиваем их обратно.
    const text2 = readText(data.flat(), matrix.version);
    assert.equal(text2, text, 'текст должен читаться обратно из матрицы');
  }
}

// ── Снимок эталонной матрицы ────────────────────────────────────────────────
// Матрица проверена внешним декодером (jsqr читает её как ту же ссылку) и
// совпала с библиотекой qrcode до последнего модуля при той же маске.
{
  const matrix = qrEncode('https://artignat2000.github.io/slovo2/');
  assert.ok(matrix);
  assert.equal(matrix.version, 3);
  assert.equal(matrix.ecc, 'M');
  assert.equal(matrix.mask, 2);
  assert.equal(matrix.size, 29);
  const bits = matrix.modules.map((dark) => (dark ? '1' : '0')).join('');
  const bytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | (bits[i + j] === '1' ? 1 : 0);
    bytes.push(byte);
  }
  const snapshot = Buffer.from(bytes).toString('base64');
  assert.equal(
    snapshot,
    '/kJ7/BNtUG6sJrt1GIXbrkmuwU+BB/qqr+AUVwC+cdPlw+e8d/voYAvJRK6opIZk6EvEbaQLj5Fw8nc4SWcL9b1j6fkJMYhBKKe++4B0fH/4p2uQWlUTuohPpdRzS+6w6P0EVTOv72RKAA==',
    'эталонная матрица изменилась — сверьте новый код внешним декодером',
  );
}

// ── Границы: слишком длинная строка и детерминированность ───────────────────
{
  assert.equal(qrEncode('x'.repeat(300)), null, 'слишком длинная строка не даёт «полу-кода»');
  const long = `https://example.org/${'y'.repeat(200)}`;
  const auto = qrEncode(long);
  assert.ok(auto && auto.ecc === 'L', 'длинная ссылка уходит на уровень L');
  const again = qrEncode('https://artignat2000.github.io/slovo2/');
  const first = qrEncode('https://artignat2000.github.io/slovo2/');
  assert.deepEqual(again?.modules, first?.modules, 'код должен быть воспроизводимым');
}

// ── PNG-картинка: QR должен оставаться чёрно-белым ────────────────────────
// На Android с принудительной тёмной темой браузер переводит цвет SVG-отрисовки
// в одну яркость, и код из инлайнового SVG становится однотонно серым. Поэтому
// код рисуется картинкой, и проверяем именно пиксели: модули — чёрные, поле и
// «тихая зона» — белые.
{
  const matrix = qrEncode('https://artignat2000.github.io/slovo2/');
  assert.ok(matrix);
  const modulePx = QR_MODULE_PX;
  const side = (matrix.size + QR_QUIET_ZONE * 2) * modulePx;
  const decoded = decodePng(qrPngBytes(matrix));
  assert.equal(decoded.width, side, 'ширина картинки — сторона кода в пикселях');
  assert.equal(decoded.height, side, 'высота картинки — сторона кода в пикселях');
  assert.equal(decoded.bitDepth, 1, 'картинка чёрно-белая: один бит на пиксель');

  /** Цвет модуля (mx, my) в центре модуля; минус — «тихая зона». */
  const pixel = (mx: number, my: number): boolean => {
    const x = (mx + QR_QUIET_ZONE) * modulePx + (modulePx >> 1);
    const y = (my + QR_QUIET_ZONE) * modulePx + (modulePx >> 1);
    return decoded.pixels[y][x];
  };

  let dark = 0;
  let light = 0;
  for (let my = 0; my < matrix.size; my += 1) {
    for (let mx = 0; mx < matrix.size; mx += 1) {
      const isDark = matrix.modules[my * matrix.size + mx];
      assert.equal(pixel(mx, my), !isDark, `модуль (${mx}, ${my}) должен быть ${isDark ? 'чёрным' : 'белым'}`);
      if (isDark) dark += 1;
      else light += 1;
    }
  }
  assert.ok(dark > 0 && light > 0, 'в коде есть и чёрные, и белые модули');
  assert.equal(pixel(-1, -1), true, '«тихая зона» белая');
  assert.equal(pixel(-1, matrix.size), true, '«тихая зона» белая');
  assert.equal(pixel(matrix.size, -1), true, '«тихая зона» белая');
  assert.equal(pixel(matrix.size, matrix.size), true, '«тихая зона» белая');

  // Картинка отдаётся как data-URL: ни сети, ни файлов — только память.
  const url = qrPngDataUrl(matrix);
  assert.ok(url.startsWith('data:image/png;base64,'), 'QR отдаётся как data-URL');
  const fromUrl = decodePng(pngBytesFromDataUrl(url));
  assert.deepEqual(fromUrl.pixels, decoded.pixels, 'картинка из data-URL совпадает с собранной');
}

console.log('✓ QR-код ссылки: ёмкости, форматы, обратное чтение, синдромы, снимок и чёрно-белая картинка');

// Проверка кодировщика QR (src/engine/qr.ts) внешним декодером.
//
// В обычный контур проверок не входит: нужны зависимости, которых нет в
// package.json (их ставим разово, как @resvg/resvg-js для промо):
//
//   npm i --no-save qrcode jsqr
//   npm run test:qr
//
// Нужен, когда меняется сам кодировщик — например, если упал снимок матрицы
// в tests/qr.test.ts. Скрипт кодирует несколько ссылок нашим кодом, рисует
// матрицу в пиксели, читает её jsqr-ом (независимый декодер) и дополнительно
// сверяет результат с библиотекой qrcode при той же маске.
import { build } from 'esbuild';
import { mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, '.qr-check');
const entry = path.join(out, 'entry.ts');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const source = `
import { qrEncode } from '${path.join(root, 'src/engine/qr').replace(/\\/g, '/')}';
import jsQR from 'jsqr';
import QRCode from 'qrcode';

type Matrix = { size: number; modules: boolean[]; version: number; ecc: string; mask: number };

function paint(matrix: Matrix, scale = 6, quiet = 4) {
  const side = (matrix.size + quiet * 2) * scale;
  const data = new Uint8ClampedArray(side * side * 4).fill(255);
  for (let y = 0; y < matrix.size; y++) {
    for (let x = 0; x < matrix.size; x++) {
      if (!matrix.modules[y * matrix.size + x]) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const pixel = ((y + quiet) * scale + dy) * side + ((x + quiet) * scale + dx);
          data[pixel * 4] = 0;
          data[pixel * 4 + 1] = 0;
          data[pixel * 4 + 2] = 0;
          data[pixel * 4 + 3] = 255;
        }
      }
    }
  }
  return { data, side };
}

const cases = [
  'https://artignat2000.github.io/slovo2/',
  'http://localhost:5173/',
  'https://8080-abcxyz.e2b.app/',
  'https://artignat2000.github.io/slovo2/?diag=1',
  'СЛОВО 2.0 — проверка юникода',
  'https://artignat2000.github.io/slovo2/' + 'x'.repeat(150),
];

let bad = 0;
for (const text of cases) {
  const matrix = qrEncode(text);
  if (!matrix) {
    console.log('✗ не закодировалось: ' + text.slice(0, 46));
    bad++;
    continue;
  }
  const { data, side } = paint(matrix);
  const decoded = jsQR(data, side, side, { inversionAttempts: 'dontInvert' });
  const ok = !!decoded && decoded.data === text;
  if (!ok) bad++;
  console.log(
    (ok ? '✓' : '✗') +
      ' v' + matrix.version + '-' + matrix.ecc + ' маска ' + matrix.mask + ' (' + matrix.size + '×' + matrix.size + '): ' +
      (decoded ? decoded.data.slice(0, 46) : 'не распознан'),
  );
}

const text = 'https://artignat2000.github.io/slovo2/';
const mine = qrEncode(text)!;
const reference = QRCode.create(text, { errorCorrectionLevel: mine.ecc.toLowerCase() });
const referenceData = reference.modules.data as unknown as Uint8Array;
let diff = 0;
for (let i = 0; i < referenceData.length; i++) {
  if ((mine.modules[i] === true) !== (referenceData[i] === 1)) diff++;
}
console.log('сверка с библиотекой qrcode: отличий ' + diff + ' из ' + referenceData.length + ' (маска у библиотеки ' + reference.maskPattern + ', у нас ' + mine.mask + ')');
if (diff !== 0) bad++;

console.log(bad ? '✗ проверка QR не пройдена' : '✓ QR-код читается независимым декодером и совпадает с эталоном');
process.exit(bad ? 1 : 0);
`;

try {
  const { writeFileSync } = await import('node:fs');
  writeFileSync(entry, source, 'utf8');
  await build({
    entryPoints: [entry],
    outfile: path.join(out, 'out.mjs'),
    bundle: true,
    platform: 'node',
    format: 'esm',
    logLevel: 'warning',
    external: ['qrcode', 'jsqr'],
  });
  const result = spawnSync(process.execPath, [path.join(out, 'out.mjs')], { stdio: 'inherit', cwd: root });
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(out, { recursive: true, force: true });
}

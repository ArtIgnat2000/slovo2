// Разбор PNG-картинки для тестов: проверяем настоящие пиксели QR-кода.
//
// Это не «ещё одна реализация» ради теста: смысл проверки в том, чтобы
// утверждать, что код на экране чёрно-белый, а не серый. Поэтому картинку
// нужно распаковать и посмотреть на пиксели, а не на цвет в атрибуте.
//
// Формат: PNG с 1 битом на пиксель (оттенки серого), строки с фильтром.

export interface DecodedPng {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  /** Пиксели построчно: true — белый (в 1-битном изображении 1 = белый). */
  pixels: boolean[][];
}

/** Байты из data-URL вида `data:image/png;base64,...`. */
export function pngBytesFromDataUrl(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/** Распаковать поток zlib из несжатых блоков deflate. */
function inflateStored(data: Uint8Array): Uint8Array {
  if (data[0] !== 0x78) throw new Error(`Не zlib: ${data[0]}`);
  const out: number[] = [];
  let offset = 2;
  for (;;) {
    const header = data[offset];
    const last = (header & 1) === 1;
    const type = (header >> 1) & 3;
    if (type !== 0) throw new Error(`Ожидался несжатый блок deflate, а не ${type}`);
    const len = data[offset + 1] | (data[offset + 2] << 8);
    const nlen = data[offset + 3] | (data[offset + 4] << 8);
    if ((len ^ 0xffff) !== nlen) throw new Error('Повреждён блок deflate');
    for (let i = 0; i < len; i += 1) out.push(data[offset + 5 + i]);
    offset += 5 + len;
    if (last) break;
  }
  return new Uint8Array(out);
}

/** Распаковать PNG: размеры и пиксели. */
export function decodePng(bytes: Uint8Array): DecodedPng {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < signature.length; i += 1) {
    if (bytes[i] !== signature[i]) throw new Error('Это не PNG');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat: number[] = [];
  let sawEnd = false;

  while (offset < bytes.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
    const dataStart = offset + 8;
    if (type === 'IHDR') {
      width = view.getUint32(dataStart);
      height = view.getUint32(dataStart + 4);
      bitDepth = bytes[dataStart + 8];
      colorType = bytes[dataStart + 9];
    } else if (type === 'IDAT') {
      for (let i = 0; i < length; i += 1) idat.push(bytes[dataStart + i]);
    } else if (type === 'IEND') {
      sawEnd = true;
    }
    offset = dataStart + length + 4;
  }
  if (!sawEnd) throw new Error('В PNG нет чанка IEND');
  if (bitDepth !== 1 || colorType !== 0) {
    throw new Error(`Ожидался 1 бит на пиксель, оттенки серого; а получено ${bitDepth}/${colorType}`);
  }

  const raw = inflateStored(new Uint8Array(idat));
  const rowBytes = Math.ceil(width / 8);
  const pixels: boolean[][] = [];
  let previous = new Uint8Array(rowBytes);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (rowBytes + 1)];
    const source = raw.subarray(y * (rowBytes + 1) + 1, y * (rowBytes + 1) + 1 + rowBytes);
    const row = new Uint8Array(rowBytes);
    for (let x = 0; x < rowBytes; x += 1) {
      const a = x >= 1 ? row[x - 1] : 0;
      const b = previous[x];
      const c = x >= 1 ? previous[x - 1] : 0;
      let value = source[x];
      if (filter === 1) value += a;
      else if (filter === 2) value += b;
      else if (filter === 3) value += (a + b) >> 1;
      else if (filter === 4) value += paeth(a, b, c);
      else if (filter !== 0) throw new Error(`Неизвестный фильтр строки: ${filter}`);
      row[x] = value & 0xff;
    }
    const line: boolean[] = [];
    for (let x = 0; x < width; x += 1) {
      line.push(((row[x >> 3] >> (7 - (x & 7))) & 1) === 1);
    }
    pixels.push(line);
    previous = row;
  }

  return { width, height, bitDepth, colorType, pixels };
}

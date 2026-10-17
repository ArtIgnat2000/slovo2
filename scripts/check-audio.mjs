/**
 * Проверка аудио каталога: файлы public/audio/ обязаны совпадать с каталогом
 * музыки (src/engine/music.ts). Запускается перед сборкой и релизом:
 * `npm run audio:check`.
 *
 * Что ловит:
 *  • трек каталога без файла (ребёнок купил мелодию — она молчит);
 *  • «сироту»: файл без трека (забытый после правки каталога);
 *  • подозрительный размер или формат (обрезанная/пустая загрузка).
 *
 * Если файлов ещё нет (свежий клон до `npm run music:fetch`), проверка падает
 * с понятной подсказкой — так честнее, чем тихо собрать игру без музыки.
 */
import { readdirSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { join } from 'node:path';
import { loadMusicCatalog, ROOT } from './lib/music-catalog.mjs';

const AUDIO_DIR = join(ROOT, 'public/audio');
const MIN_BYTES = 300_000; // меньше — почти наверняка обрыв или заглушка
const MAX_BYTES = 25_000_000;

function looksLikeMp3(path) {
  const buf = Buffer.alloc(3);
  const fd = openSync(path, 'r');
  try {
    readSync(fd, buf, 0, 3, 0);
  } finally {
    closeSync(fd);
  }
  return buf.toString('latin1', 0, 3) === 'ID3' || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0);
}

const { MUSIC_TRACKS, audioFileOf } = await loadMusicCatalog();

let files = [];
try {
  files = readdirSync(AUDIO_DIR).filter((f) => f.endsWith('.mp3'));
} catch {
  console.error('✗ public/audio/ не найдено — аудио ещё не скачано.');
  console.error('  Запустите: npm run music:fetch (официальные файлы с incompetech.com).');
  process.exit(1);
}

const problems = [];
let total = 0;

for (const track of MUSIC_TRACKS) {
  const name = `${track.id}.mp3`;
  const path = join(AUDIO_DIR, name);
  if (!files.includes(name)) {
    problems.push(`нет файла ${name} (трек «${track.originalTitle}», ${audioFileOf(track)})`);
    continue;
  }
  const size = statSync(path).size;
  total += size;
  if (size < MIN_BYTES) problems.push(`${name}: подозрительно мал (${size} байт)`);
  if (size > MAX_BYTES) problems.push(`${name}: подозрительно велик (${size} байт)`);
  if (!looksLikeMp3(path)) problems.push(`${name}: это не MP3`);
}

const expected = new Set(MUSIC_TRACKS.map((t) => `${t.id}.mp3`));
for (const f of files) {
  if (!expected.has(f)) problems.push(`лишний файл ${f}: в каталоге такого трека нет`);
}

if (problems.length) {
  console.error('✗ аудио не сходится с каталогом:');
  for (const p of problems) console.error(`  — ${p}`);
  process.exit(1);
}

console.log(`✓ аудио: ${MUSIC_TRACKS.length} файлов в public/audio/, всего ${(total / 1048576).toFixed(1)} МБ (каталог и файлы сходятся)`);

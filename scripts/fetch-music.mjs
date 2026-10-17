/**
 * Качает официальные MP3 фоновой музыки в public/audio/.
 *
 * Источник — ТОЛЬКО официальные страницы треков incompetech.com (Kevin MacLeod,
 * CC BY 4.0): файлы берутся из раздела скачивания сайта автора, никаких
 * YouTube и сторонних перезаливов. Список треков, ISRC и лицензии сверены
 * постранично и живут в src/engine/music.ts — скрипт читает именно его.
 *
 * Запуск:  node scripts/fetch-music.mjs [--keep-original] [--only id1,id2]
 *   --keep-original   оставить файлы как скачаны (без пережатия);
 *                     по умолчанию каждый трек пережимается в MP3 128 кбит/с
 *                     для офлайн-кэша PWA (требует ffmpeg, см. `modified`).
 *   --only id,id      скачать только перечисленные треки.
 *
 * Выход: файлы public/audio/<id>.mp3 + сводка по размерам. Проверка того, что
 * каталог и аудио не разошлись, — `npm run audio:check`.
 */
import { spawnSync } from 'node:child_process';
import { closeSync, createWriteStream, existsSync, mkdirSync, openSync, readSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { join } from 'node:path';
import { loadMusicCatalog, ROOT } from './lib/music-catalog.mjs';

const argv = process.argv.slice(2);
const keepOriginal = argv.includes('--keep-original');
const onlyArg = argv.find((a) => a.startsWith('--only'));
const only = onlyArg ? (onlyArg.includes('=') ? onlyArg.split('=')[1] : argv[argv.indexOf(onlyArg) + 1] ?? '')
  .split(',').map((s) => s.trim()).filter(Boolean) : null;

const AUDIO_DIR = join(ROOT, 'public/audio');
const BITRATE = 128; // кбит/с: хватает для фона на телефоне и в наушниках

function ffmpegPath() {
  for (const c of ['ffmpeg', '/usr/bin/ffmpeg']) {
    const probe = spawnSync(c, ['-version'], { encoding: 'utf8' });
    if (probe.status === 0) return c;
  }
  return null;
}

/** Официальный файл скачивается по названию записи; трек-страница — источник истины. */
function officialMp3Url(track) {
  return `https://incompetech.com/music/royalty-free/mp3-royaltyfree/${encodeURIComponent(track.originalTitle)}.mp3`;
}

async function download(url, dest) {
  // Сайт автора иногда рвёт соединение после нескольких файлов подряд
  // («fetch failed» на ровном месте): повторяем с паузой, а между треками
  // даём секунду передышки.
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'slovo2-audio-fetch/1.0' } });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} для ${url}`);
      const file = createWriteStream(dest);
      await finished(Readable.fromWeb(res.body).pipe(file));
      return;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, attempt * 2500));
    }
  }
  throw lastErr;
}

function looksLikeMp3(path) {
  const buf = Buffer.alloc(3);
  const fd = openSync(path, 'r');
  try {
    readSync(fd, buf, 0, 3, 0);
  } finally {
    closeSync(fd);
  }
  // ID3v2-тег ('ID3') или сразу MPEG-фрейм (0xFFEx)
  return buf.toString('latin1', 0, 3) === 'ID3' || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0);
}

const { MUSIC_TRACKS } = await loadMusicCatalog();
const tracks = only ? MUSIC_TRACKS.filter((t) => only.includes(t.id)) : MUSIC_TRACKS;
if (!tracks.length) {
  console.error('✗ не найдено ни одного трека по --only');
  process.exit(1);
}
if (only && tracks.length !== only.length) {
  console.error(`✗ в каталоге нет треков: ${only.filter((id) => !tracks.some((t) => t.id === id)).join(', ')}`);
  process.exit(1);
}

const ffmpeg = keepOriginal ? null : ffmpegPath();
if (!keepOriginal && !ffmpeg) {
  console.error('✗ для пержатия нужен ffmpeg (или запустите с --keep-original)');
  process.exit(1);
}

mkdirSync(AUDIO_DIR, { recursive: true });

let total = 0;
const failed = [];
for (const track of tracks) {
  const dest = join(AUDIO_DIR, `${track.id}.mp3`);
  if (existsSync(dest) && statSync(dest).size > 200_000 && looksLikeMp3(dest)) {
    total += statSync(dest).size;
    console.log(`= ${track.id} уже скачан, пропускаю`);
    continue;
  }
  const tmp = `${dest}.download`;
  const url = officialMp3Url(track);
  process.stdout.write(`↓ ${track.id} (${track.originalTitle}) … `);
  try {
    await download(url, tmp);
    const size = statSync(tmp).size;
    if (size < 200_000) throw new Error(`файл подозрительно мал (${size} байт)`);
    if (!looksLikeMp3(tmp)) throw new Error('это не MP3');
    if (keepOriginal) {
      renameSync(tmp, dest);
    } else {
      const out = `${dest}.tmp.mp3`;
      const res = spawnSync(ffmpeg, [
        '-y', '-i', tmp, '-codec:a', 'libmp3lame', '-b:a', `${BITRATE}k`, '-ar', '44100', '-ac', '2', out,
      ], { encoding: 'utf8' });
      if (res.status !== 0) throw new Error(`ffmpeg: ${(res.stderr || '').split('\n').slice(-3).join(' ')}`);
      if (!looksLikeMp3(out)) throw new Error('ffmpeg выдал не MP3');
      renameSync(out, dest);
      rmSync(tmp, { force: true });
    }
    total += statSync(dest).size;
    console.log(`ок, ${(statSync(dest).size / 1048576).toFixed(1)} МБ`);
  } catch (e) {
    rmSync(tmp, { force: true });
    rmSync(`${dest}.tmp.mp3`, { force: true });
    console.error(`✗ ${e.message}`);
    console.error(`  источник: ${url} (страница трека: ${track.sourceUrl})`);
    failed.push(track.id);
  }
  await new Promise((r) => setTimeout(r, 1000));
}

if (failed.length) {
  console.error(`\n✗ не скачаны: ${failed.join(', ')} — повторите запуск, уже скачанное не перекачивается`);
  process.exit(1);
}

console.log(`\n✓ аудио готово: ${tracks.length} файлов, всего ${(total / 1048576).toFixed(1)} МБ в public/audio/`);
if (!keepOriginal) {
  console.log(`  (пережато в MP3 ${BITRATE} кбит/с — требование CC BY об изменениях выполнено полем modified каталога)`);
}
if (existsSync(join(AUDIO_DIR, 'manifest.json'))) rmSync(join(AUDIO_DIR, 'manifest.json'));
writeFileSync(
  join(AUDIO_DIR, 'README.txt'),
  [
    'Файлы скачаны с официальных страниц треков incompetech.com (Kevin MacLeod).',
    'Список, ISRC, лицензии и отметки об изменениях — src/engine/music.ts,',
    'а также раздел «Авторы и лицензии» в приложении.',
    'Скачать заново: npm run music:fetch',
    '',
  ].join('\n'),
);

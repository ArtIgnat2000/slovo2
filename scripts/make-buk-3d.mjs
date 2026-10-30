/**
 * Сборка 3D-атласов БУКа: images-src/buk/frames/<ступень>/<клип>-NN.png
 *   → public/buk3d/<ступень>/<клип>.webp + public/buk3d/manifest.json
 *
 * Этап 1 пайплайна (docs/buk-companion-3d.md §6.3): кадры из Blender
 * (scripts/make-buk-art.py) сжимаются в спрайт-атласы WebP — прецедент:
 * арт сундуков 512×512 (scripts/process-chest-art.mjs, нужен ImageMagick).
 *
 * Манифест — источник правды для плеера (этап 2) и для юнита/контрольки:
 * клипы, сетки, углы, реальные байты на ступень (бюджет ≤ 500 кБ §6.4).
 * Атласы лежат ВНЕ precache: globIgnores в vite.config.ts обязан содержать
 * `buk3d/**` — кладётся в runtime-кэш `slovo2-buk3d` при первом открытии.
 *
 * Запуск: node scripts/make-buk-3d.mjs   (после python3 scripts/make-buk-art.py)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'images-src', 'buk', 'frames');
const out = path.join(root, 'public', 'buk3d');

/** Ячейка кадра в px (§6.4: WebP 256–320 px на кадр). */
const CELL = 256;
/** Бюджет профиля в байтах (§6.4: ≤ 500 кБ на ступень, всё вместе). */
const BUDGET = 500_000;
/** Качество WebP атласов: спрайты должны быть ≤ бюджета. */
const QUALITY = 80;

/** Реестр клипов — тот же, что в scripts/make-buk-art.py. */
const CLIPS = [
  { name: 'idle', grid: [4, 4], frames: 16, fps: 10, kind: 'circle' },
  { name: 'face', grid: [2, 2], frames: 4, fps: 6, mood: 'idle' },
  { name: 'happy', grid: [2, 2], frames: 4, fps: 6, mood: 'happy' },
  { name: 'excited', grid: [2, 2], frames: 4, fps: 6, mood: 'excited' },
  { name: 'sad', grid: [2, 2], frames: 4, fps: 4, mood: 'sad' },
  { name: 'think', grid: [2, 2], frames: 4, fps: 4, mood: 'think' },
  { name: 'dance', grid: [2, 2], frames: 4, fps: 8, mood: 'dance' },
  { name: 'sleep', grid: [2, 2], frames: 4, fps: 3, mood: 'sleep' },
  { name: 'curious', grid: [2, 2], frames: 4, fps: 6, mood: 'curious' },
];
const FACE_ANGLES = [-45, -15, 15, 45];
const PROFILES = ['chick', 'student', 'sage', 'master'];

const problems = [];

if (!existsSync(src)) {
  console.error('✗ нет каталога кадров images-src/buk/frames — запусти сначала:');
  console.error('  python3 scripts/make-buk-art.py (Blender headless, локально)');
  process.exit(1);
}

mkdirSync(out, { recursive: true });

let totalBytes = 0;
const bytesPerProfile = {};
const atlas = {};

for (const profile of PROFILES) {
  const dir = path.join(src, profile);
  if (!existsSync(dir)) {
    problems.push(`нет кадров ступени ${profile} (${dir})`);
    continue;
  }
  mkdirSync(path.join(out, profile), { recursive: true });
  atlas[profile] = {};
  let profileBytes = 0;

  for (const clip of CLIPS) {
    const frames = [];
    for (let i = 0; i < clip.frames; i++) {
      const p = path.join(dir, `${clip.name}-${String(i).padStart(2, '0')}.png`);
      if (!existsSync(p)) {
        problems.push(`нет кадра ${profile}/${clip.name}-${i}`);
        break;
      }
      frames.push(p);
    }
    if (frames.length !== clip.frames) continue;

    const [cols, rows] = clip.grid;
    const atlasPng = path.join(dir, `${clip.name}-atlas.png`);
    const webp = path.join(out, profile, `${clip.name}.webp`);

    // montage по образцу process-chest-art.mjs: сетка cols×rows, ячейка 256
    execFileSync('montage', [
      ...frames,
      '-tile', `${cols}x${rows}`,
      '-geometry', `${CELL}x${CELL}+0+0`,
      '-background', 'none',
      atlasPng,
    ], { stdio: 'pipe' });
    execFileSync('convert', [
      atlasPng,
      '-quality', String(QUALITY),
      '-strip',
      webp,
    ], { stdio: 'pipe' });

    const rel = `${profile}/${clip.name}.webp`;
    const size = statSync(webp).size;
    atlas[profile][clip.name] = rel;
    profileBytes += size;
    const kbps = (size / 1024).toFixed(0);
    console.log(`· ${rel}: ${kbps} кБ`);
  }

  bytesPerProfile[profile] = profileBytes;
  totalBytes += profileBytes;
  const verdict = profileBytes <= BUDGET ? '✓' : '✗ ПРЕВЫШЕН бюджет';
  console.log(`${verdict} ${profile}: ${(profileBytes / 1024).toFixed(0)} кБ / ${BUDGET / 1000} кБ`);
  if (profileBytes > BUDGET) {
    problems.push(`${profile}: ${profileBytes} байт > бюджета ${BUDGET} (§6.4)`);
  }
}

if (problems.length) {
  console.error('✗ проблемы сборки атласов:');
  for (const p of problems) console.error('  — ' + p);
  process.exit(1);
}

const manifest = {
  version: 1,
  cell: CELL,
  profiles: PROFILES,
  clips: Object.fromEntries(
    CLIPS.map((c) => [
      c.name,
      {
        frames: c.frames,
        grid: c.grid,
        fps: c.fps,
        ...(c.kind === 'circle'
          ? { kind: 'circle', stepDeg: 22.5 }
          : { kind: 'faces', mood: c.mood, angles: FACE_ANGLES }),
      },
    ]),
  ),
  atlas,
  budgetBytesPerProfile: BUDGET,
  bytesPerProfile,
  totalBytes,
};

writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`✓ manifest: ${PROFILES.length} ступени, ${CLIPS.length} клипов, ${(totalBytes / 1024).toFixed(0)} кБ всего`);

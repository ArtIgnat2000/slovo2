/**
 * Контролька 3D-атласов БУКа: `npm run buk:check`
 *
 * Что ловит (этап 1, §6.6–6.8 docs/buk-companion-3d.md):
 *  • манифест без клипа/ступени — плеер запросит дыру и упадёт в тишину;
 *  • кадр не на месте: атлас отсутствует или габариты ≠ сетке манифеста;
 *  • бюджет: ступень тяжелее 500 кБ (§6.4) или байты в манифесте врут;
 *  • precache-дыру: в vite.config.ts нет `buk3d/**` в globIgnores — атласы
 *    полезут в precache PWA и раздуют установку (должны жить в кэше
 *    `slovo2-buk3d`).
 *
 * Реестр клипов дублирует scripts/make-buk-art.py / make-buk-3d.mjs —
 * юнит tests/buk-3d-art.test.ts сверяет манифест с этим же списком.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(root, 'public', 'buk3d', 'manifest.json');
const viteConfig = path.join(root, 'vite.config.ts');

/** Реестр клипов: имя → число кадров (§6.4: 48 кадров на профиль). */
const EXPECTED_CLIPS = {
  idle: 16, // полный круг, шаг 22.5°
  face: 4,
  happy: 4,
  excited: 4,
  sad: 4,
  think: 4,
  dance: 4,
  sleep: 4,
  curious: 4,
};
const EXPECTED_PROFILES = ['chick', 'student', 'sage', 'master'];
const FACE_ANGLES = [-45, -15, 15, 45];
const BUDGET = 500_000;

const problems = [];

// ── манифест ───────────────────────────────────────────────────────────────
let manifest = null;
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch (e) {
  problems.push(`public/buk3d/manifest.json не читается: ${e.message}`);
}

function readWebpSize(buf) {
  if (buf.length < 30 || buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WEBP') {
    return null;
  }
  let off = 12;
  while (off + 8 <= buf.length) {
    const id = buf.toString('latin1', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    const data = off + 8;
    if (id === 'VP8X' && data + 10 <= buf.length) {
      return {
        w: 1 + (buf[data + 4] | (buf[data + 5] << 8) | (buf[data + 6] << 16)),
        h: 1 + (buf[data + 7] | (buf[data + 8] << 8) | (buf[data + 9] << 16)),
      };
    }
    if (id === 'VP8L' && data + 5 <= buf.length && buf[data] === 0x2f) {
      return {
        w: 1 + (buf[data + 1] | ((buf[data + 2] & 0x3f) << 8)),
        h: 1 + ((buf[data + 2] >> 6) | (buf[data + 3] << 2) | (buf[data + 4] << 10)),
      };
    }
    if (id === 'VP8 ' && data + 10 <= buf.length) {
      return {
        w: buf.readUInt16LE(data + 6) & 0x3fff,
        h: buf.readUInt16LE(data + 8) & 0x3fff,
      };
    }
    off = data + size + (size % 2);
  }
  return null;
}

if (manifest) {
  if (manifest.version !== 1) problems.push(`манифест version=${manifest.version}, ожидалось 1`);
  if (manifest.cell !== 256) problems.push(`манифест cell=${manifest.cell}, ожидалось 256`);

  for (const [name, frames] of Object.entries(EXPECTED_CLIPS)) {
    const clip = manifest.clips?.[name];
    if (!clip) {
      problems.push(`нет клипа «${name}» в манифесте`);
      continue;
    }
    if (clip.frames !== frames) problems.push(`клип «${name}»: frames=${clip.frames}, ожидалось ${frames}`);
    if (name === 'idle') {
      if (clip.kind !== 'circle' || clip.stepDeg !== 22.5) {
        problems.push(`клип «idle»: ожидался круг (kind=circle, stepDeg=22.5)`);
      }
    } else {
      if (clip.kind !== 'faces') problems.push(`клип «${name}»: ожидался kind=faces`);
      if (JSON.stringify(clip.angles) !== JSON.stringify(FACE_ANGLES)) {
        problems.push(`клип «${name}»: углы ${JSON.stringify(clip.angles)} ≠ ${JSON.stringify(FACE_ANGLES)}`);
      }
      if (name !== 'face' && clip.mood !== name) {
        problems.push(`клип «${name}»: mood=${clip.mood}, ожидалось ${name}`);
      }
    }
  }

  const extra = Object.keys(manifest.clips ?? {}).filter((k) => !(k in EXPECTED_CLIPS));
  if (extra.length) problems.push(`лишние клипы в манифесте: ${extra.join(', ')}`);

  for (const profile of EXPECTED_PROFILES) {
    const dir = path.join(root, 'public', 'buk3d', profile);
    let bytes = 0;
    for (const [name, frames] of Object.entries(EXPECTED_CLIPS)) {
      const rel = manifest.atlas?.[profile]?.[name];
      if (!rel) {
        problems.push(`${profile}: нет ссылки на атлас «${name}»`);
        continue;
      }
      const file = path.join(root, 'public', 'buk3d', rel);
      if (!existsSync(file)) {
        problems.push(`${profile}: файл атласа отсутствует (${rel})`);
        continue;
      }
      const size = statSync(file).size;
      bytes += size;
      if (size < 5_000) {
        problems.push(`${rel}: подозрительно мал (${size} байт)`);
      }
      const buf = readFileSync(file);
      const dim = readWebpSize(buf);
      const clip = manifest.clips?.[name];
      if (!dim || !clip) continue;
      const [cols, rows] = clip.grid;
      const want = { w: manifest.cell * cols, h: manifest.cell * rows };
      if (dim.w !== want.w || dim.h !== want.h) {
        problems.push(`${rel}: габариты ${dim.w}×${dim.h} ≠ сетке ${want.w}×${want.h}`);
      }
    }
    const declared = manifest.bytesPerProfile?.[profile];
    if (declared !== undefined && declared !== bytes) {
      problems.push(`${profile}: в манифесте ${declared} байт, реально ${bytes}`);
    }
    if (bytes > BUDGET) {
      problems.push(`${profile}: ${(bytes / 1024).toFixed(0)} кБ > бюджета 500 кБ (§6.4)`);
    } else {
      console.log(`· ${profile}: ${(bytes / 1024).toFixed(0)} кБ ≤ 500 кБ`);
    }
    void dir;
  }
}

// ── атласы обязаны быть ВНЕ precache ───────────────────────────────────────
if (existsSync(viteConfig)) {
  const vc = readFileSync(viteConfig, 'utf8');
  const globIgnores = vc.match(/globIgnores:\s*\[([^\]]*)\]/);
  if (!globIgnores) {
    problems.push('vite.config.ts: не найден globIgnores — атласы БУКа попадут в precache');
  } else if (!globIgnores[1].includes('buk3d')) {
    problems.push("vite.config.ts: в globIgnores нет 'buk3d/**' — атласы попадут в precache PWA");
  } else {
    console.log('· вне precache: globIgnores содержит buk3d/**');
  }
} else {
  problems.push('vite.config.ts не найден');
}

if (problems.length) {
  console.error('✗ проблемы 3D-атласов:');
  for (const p of problems) console.error('  — ' + p);
  process.exit(1);
}
console.log('✓ buk:check — манифест цел, атласы в бюджете, вне precache');

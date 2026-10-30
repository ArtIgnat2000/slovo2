// 3D-атласы БУКа (docs/buk-companion-3d.md §6.3–6.6) — без DOM: юнит ловит
// дыру в манифесте и раздувание бюджета ДО того, как плеер (этап 2) попросит
// несуществующий клип. Подключён из tests/adaptive.test.ts.
// Габариты WebP и precache-гард дублирует `npm run buk:check` — здесь мы
// сверяем сам контракт манифеста со спекой.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// esbuild кладёт бандл во временную папку (scripts/adaptive-test.mjs, как
// tests/naash.test.ts), поэтому корень репозитория берём из рабочей папки.
const root = process.cwd();
const manifestPath = join(root, 'public', 'buk3d', 'manifest.json');

/** Реестр клипов спеки §6.4: 16 + 5×4 + 4 + 4 + 4 = 48 кадров на ступень. */
const EXPECTED_CLIPS: Record<string, number> = {
  idle: 16,
  face: 4,
  happy: 4,
  excited: 4,
  sad: 4,
  think: 4,
  dance: 4,
  sleep: 4,
  curious: 4,
};
const PROFILES = ['chick', 'student', 'sage', 'master'];
const BUDGET = 500_000;

// Fresh clone без рендера: честная ошибка с подсказкой (как audio:check).
assert.ok(
  existsSync(manifestPath),
  'нет public/buk3d/manifest.json — сгенерируй: npm run buk:art (нужен Blender headless)',
);

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

assert.equal(manifest.version, 1, 'манифест version = 1');
assert.equal(manifest.cell, 256, 'ячейка кадра 256px (§6.4)');
assert.deepEqual(manifest.profiles, PROFILES, 'ступени роста: птенец, ученик, знаток, магистр');

// ── манифест цел: каждый клип спеки, точное число кадров ───────────────────
const got = manifest.clips as Record<string, { frames: number; kind?: string; stepDeg?: number; angles?: number[] }>;
assert.deepEqual(Object.keys(got).sort(), Object.keys(EXPECTED_CLIPS).sort(), 'состав клипов = реестру спеки');
let totalFrames = 0;
for (const [name, frames] of Object.entries(EXPECTED_CLIPS)) {
  assert.equal(got[name]?.frames, frames, `клик «${name}»: ${frames} кадров`);
  totalFrames += frames;
}
assert.equal(totalFrames, 48, 'бюджет §6.4: 48 кадров на профиль');
assert.equal(got.idle?.kind, 'circle', 'idle — полный круг, шаг 22.5°');
assert.equal(got.idle?.stepDeg, 22.5, 'idle-шаг ровно 22.5°');
for (const [name, clip] of Object.entries(got)) {
  if (name === 'idle') continue;
  assert.equal(clip.kind, 'faces', `${name} — только фронтальные углы (§6.4)`);
  assert.deepEqual(clip.angles, [-45, -15, 15, 45], `${name}: 4 фронта ±45/±15`);
}

// ── атласы существуют, бюджет ≤ 500 кБ на ступень ─────────────────────────
assert.equal(manifest.budgetBytesPerProfile, BUDGET, 'бюджет 500 кБ на ступень (§6.4)');
for (const profile of PROFILES) {
  const files = manifest.atlas?.[profile] as Record<string, string> | undefined;
  assert.ok(files, `в манифесте нет ступени ${profile}`);
  let bytes = 0;
  for (const name of Object.keys(EXPECTED_CLIPS)) {
    const rel = files[name];
    assert.ok(rel, `${profile}: нет ссылки на атлас «${name}»`);
    assert.ok(existsSync(join(root, 'public', 'buk3d', rel)), `${profile}/${name}.webp отсутствует на диске`);
    bytes += (statSize as (p: string) => number)(join(root, 'public', 'buk3d', rel));
  }
  assert.ok(
    bytes <= BUDGET,
    `${profile}: ${(bytes / 1024).toFixed(0)} кБ > бюджета 500 кБ — подними качество-вниз в make-buk-3d.mjs`,
  );
  assert.equal(manifest.bytesPerProfile?.[profile], bytes, `${profile}: байты в манифесте честные`);
}

function statSize(p: string): number {
  return readFileSync(p).length;
}

// ── вне precache: globIgnores в vite.config.ts обязан упоминать buk3d ─────
const viteConfig = readFileSync(join(root, 'vite.config.ts'), 'utf8');
const ignores = viteConfig.match(/globIgnores:\s*\[([^\]]*)\]/);
assert.ok(ignores, 'vite.config.ts: не найден globIgnores');
assert.ok(
  ignores[1].includes('buk3d'),
  "vite.config.ts: в globIgnores нет 'buk3d/**' — атласы попадут в precache PWA (§6.4)",
);

// Общий помощник скриптов аудио: достаёт каталог музыки из TS-модуля приложения.
// Каталог (src/engine/music.ts) — единственный источник правды: и игра, и скрипты
// видят одни и те же треки, лицензии и имена файлов.
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Собирает src/engine/music.ts и возвращает { MUSIC_TRACKS, ... }. */
export async function loadMusicCatalog() {
  const root = resolve(new URL('../..', import.meta.url).pathname);
  const dir = mkdtempSync(join(tmpdir(), 'slovo-catalog-'));
  try {
    const outfile = join(dir, 'catalog.mjs');
    await build({
      entryPoints: [join(root, 'src/engine/music.ts')],
      outfile,
      bundle: true,
      platform: 'node',
      format: 'esm',
      logLevel: 'silent',
    });
    return await import(pathToFileURL(outfile).href);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export const ROOT = resolve(new URL('../..', import.meta.url).pathname);

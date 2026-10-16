/**
 * Собирает аудио-лабораторию из того же движка, что звучит в приложении:
 * docs/music-demo/entry.ts (точка входа с грувами волн 2–5) → engine.js.
 * Без этого шага лаборатория рисковала бы разъехаться с приложением.
 */
import { build } from 'esbuild';

await build({
  entryPoints: ['docs/music-demo/entry.ts'],
  bundle: true,
  format: 'iife',
  globalName: 'SLOVO_DEMO',
  outfile: 'docs/music-demo/engine.js',
  target: 'es2020',
  minify: true,
  legalComments: 'none',
});

console.log('✓ demo: docs/music-demo/engine.js собран из src/platform/music.ts');

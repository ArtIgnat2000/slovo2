// Сборка пробной страницы озвучки (TTS) — docs/tts/tts-trial.html
//
// Зачем: раньше пробы системного TTS звучали с неправильным ударением.
// Прежде чем решать «не делаем озвучку» или «тихие системные голоса для
// подсказок», владелец слушает реальные слова на реальном устройстве и
// возвращает сводку. Страница — самодостаточная (один файл, без сборки и
// зависимостей), открывается на iOS/Android в обычном браузере.
//
// Данные берутся из банка (src/content/words.ts) — ударение никогда не
// вписывается руками. Слова отобраны по риску ошибки TTS: заглавные, «ё»,
// длинные (≥11 букв) и все слова банка, попавшие в словарь известных
// ударений (KNOWN_STRESS). При пополнении банка генератор пересоздаёт
// страницу целиком:  npm run tts:trial
import { build } from 'esbuild';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = mkdtempSync(join(tmpdir(), 'slovo-tts-'));
try {
  const bundle = join(dir, 'data.mjs');
  await build({
    entryPoints: ['src/content/tts-trial.ts'],
    outfile: bundle,
    bundle: true,
    platform: 'node',
    format: 'esm',
  });
  const { pickRiskWords } = await import(bundle);
  const items = pickRiskWords();

  const template = readFileSync('scripts/tts-trial-template.html', 'utf8');
  const html = template.replace(
    '/*__DATA__*/',
    `const WORDS = ${JSON.stringify(items, null, 1)};`,
  );
  mkdirSync('docs/tts', { recursive: true });
  writeFileSync('docs/tts/tts-trial.html', html);
  console.log(`✓ docs/tts/tts-trial.html: ${items.length} слов`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

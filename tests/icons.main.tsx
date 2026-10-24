// Точка входа стенда «UI-иконки»: запускается scripts/icons-check.mjs
// после сборки esbuild в Node с jsdom (как смоук, но без всего приложения —
// проверяются только правила набора иконок).
import { runIconChecks } from './icons.test';
import { failureCount } from './ui-helpers';

await runIconChecks();

const failed = failureCount();
console.log(failed ? `\n✗ ошибок: ${failed}` : '\n✓ UI-иконки: все проверки пройдены');
process.exit(failed ? 1 : 0);

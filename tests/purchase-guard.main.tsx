// Точка входа стенда «защита покупок» (npm run test:guard).
import { failureCount } from './ui-helpers';
import { runPurchaseGuardChecks } from './purchase-guard.test';

async function main() {
  await runPurchaseGuardChecks();
  process.exit(failureCount() ? 1 : 0);
}

main().catch((e) => {
  console.error('стенд защиты покупок упал:', e);
  process.exit(1);
});

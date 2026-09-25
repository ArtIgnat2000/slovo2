import { registerSW } from 'virtual:pwa-register';

let updateSW: ((reload?: boolean) => Promise<void>) | null = null;

export function initPWA(onUpdate: () => void) {
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh: onUpdate,
  });
}

export function applyUpdate() {
  void updateSW?.(true);
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  );
}

/** Показываем подсказку «добавить на экран» только один раз. */
export function shouldSuggestInstall(): boolean {
  if (isStandalone()) return false;
  try {
    return !localStorage.getItem('slovo2-install-hint');
  } catch {
    return false;
  }
}

export function markInstallHintShown() {
  try {
    localStorage.setItem('slovo2-install-hint', '1');
  } catch {
    /* ignore */
  }
}

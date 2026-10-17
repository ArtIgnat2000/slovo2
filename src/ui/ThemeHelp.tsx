import { browserDarkModeHelp, browserName } from '../platform/theme';
import { isStandalone } from '../platform/pwa';

/** Подсказка доступна и в установленном PWA, где нельзя дописать ?diag=1 в адрес. */
export function ThemeHelp({ onOpenDiagnostics }: { onOpenDiagnostics: () => void }) {
  const browser = browserName(navigator.userAgent);

  return (
    <details className="theme-help">
      <summary>Светлая тема всё равно серая?</summary>
      <p className="setting-hint">
        {isStandalone() ? 'Ярлык работает через браузер, из которого его установили.' : 'Страница открыта в браузере.'}{' '}
        Сейчас: <b>{browser}</b>. Его принудительное затемнение может менять цвета уже после оформления СЛОВО;
        переключатель темы в приложении его не выключает.
      </p>
      <p className="setting-hint">{browserDarkModeHelp(browser)}</p>
      <button type="button" className="btn ghost sm" onClick={onOpenDiagnostics}>
        Проверить тему и браузер
      </button>
      <p className="setting-hint">
        Не удаляйте ярлык и не очищайте данные браузера: там хранится прогресс. Если решите перейти
        в другой браузер, сначала сохраните файл в «Родителям → Прогресс».
      </p>
    </details>
  );
}

import { useEffect, useState } from 'react';
import { browserDarkModeHelp, browserName, detectForcedRepaint } from '../platform/theme';

/**
 * Плашка только для случаев, когда проверка Chrome Auto Dark действительно
 * увидела перекраску. Samsung Internet иногда меняет пиксели уже после
 * getComputedStyle — тогда проверка ничего не видит. Родителю доступна ручная
 * проверка в «Родителям → Настройки → Вид» даже без адресной строки ярлыка.
 */

const DISMISSED_KEY = 'slovo2-repaint-hint';

function wasDismissed(): boolean {
  try {
    return window.sessionStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

function rememberDismissed(): void {
  try {
    window.sessionStorage.setItem(DISMISSED_KEY, '1');
  } catch {
    // Без хранилища плашка просто появится снова в следующей сессии.
  }
}

export function ThemeBanner() {
  const [repaint, setRepaint] = useState(false);
  const [browser, setBrowser] = useState('');

  useEffect(() => {
    // Проверка идёт после первой отрисовки: браузеру нужно время, чтобы
    // применить свои собственные цвета.
    const id = window.setTimeout(() => {
      if (wasDismissed()) return;
      if (!detectForcedRepaint()) return;
      setBrowser(browserName(navigator.userAgent));
      setRepaint(true);
    }, 120);
    return () => window.clearTimeout(id);
  }, []);

  if (!repaint) return null;

  return (
    <div className="banner theme-banner" role="status">
      <b>Браузер перекрашивает страницу.</b>{' '}
      {browser} изменил цвета страницы поверх палитры приложения — поэтому переключение темы
      может почти не менять вид экрана.
      <span className="theme-banner-hint">{browserDarkModeHelp(browser)}</span>
      <span className="theme-banner-hint">Не удаляйте ярлык и не очищайте данные браузера: там хранится прогресс ребёнка.</span>
      <button
        className="btn ghost sm"
        onClick={() => {
          rememberDismissed();
          setRepaint(false);
        }}
      >
        Понятно
      </button>
    </div>
  );
}

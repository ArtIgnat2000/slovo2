import { useEffect, useState } from 'react';
import { browserName, detectForcedRepaint } from '../platform/theme';

/**
 * Плашка «браузер перекрашивает страницу».
 *
 * Если экран серый, а в настройках выбрана светлая тема, то палитру искажает не
 * приложение, а сам браузер: он накладывает поверх страницы собственную тёмную
 * тему («Auto Dark Mode» в Chrome, «Тёмный режим для веб-контента» в Samsung
 * Internet). Отключить это со страницы нельзя — настройка живёт в браузере.
 *
 * Поэтому единственное, что мы можем сделать, — сказать об этом прямо и дать
 * точную инструкку для того браузера, которым открыли приложение. Молчаливый
 * серый экран выглядит как поломка приложения, а это не поломка.
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

/** Что именно выключить в этом браузере. */
function instruction(browser: string): string {
  if (browser === 'Samsung Internet') {
    return 'Samsung Internet: меню ☰ → Настройки → Lab → «Использовать тёмную тему сайта» — выключить.';
  }
  if (browser === 'Яндекс.Браузер') {
    return 'Яндекс.Браузер: Настройки → Внешний вид → отключите «Принудительно тёмная тема».';
  }
  if (browser === 'Chrome') {
    return 'Chrome: ⋮ → Настройки → Темы → выключите «Затемнять сайты».';
  }
  return 'В настройках браузера выключите принудительную тёмную тему для сайтов.';
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
      {browser} наложил свою тёмную тему поверх палитры приложения — поэтому цвета выглядят
      серыми, даже когда в настройках выбрана светлая тема.
      <span className="theme-banner-hint">{instruction(browser)}</span>
      <span className="theme-banner-hint">Откройте приложение в Chrome — там эта настройка не мешает.</span>
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

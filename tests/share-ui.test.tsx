// «Передать приложение» (обратная связь 2026-10-14: непонятно, как поделиться
// ссылкой с новым учеником).
//
// Проверяем, что взрослому действительно есть чем поделиться:
//  • в «Родителям» и на экране «Кто будет учиться?» есть карточка со ссылкой;
//  • QR-код нарисован картинкой (чёрно-белый PNG) и его можно увеличить;
//  • ссылка называется человекочитаемо и совпадает с адресом приложения;
//  • копирование в jsdom не имеет Clipboard API — значит, ссылку показывают
//    текстом, чтобы её можно было скопировать руками (не «кнопка-обманка»);
//  • платформенные функции честно сообщают о своих возможностях.
import { appUrl, canNativeShare, copyAppLink, linkLabel, shareApp, SHARE_TITLE } from '../src/platform/share';
import { useApp } from '../src/state/store';
import { qrEncode } from '../src/engine/qr';
import { buttons, check, click, has, openParentSection, sleep } from './ui-helpers';
import { decodePng, pngBytesFromDataUrl } from './qr-png-helper';

const linkText = () => appUrl();

/** Карточка «Передать приложение» видна на текущем экране. */
function shareCard(): HTMLElement | null {
  return document.querySelector('.share-app');
}

function bigQr(): HTMLElement | null {
  return document.querySelector('.share-zoom-art');
}

/**
 * QR чёрный на белом? Смотрим настоящие пиксели картинки: модули должны быть
 * чёрными, «тихая зона» — белой. Именно это ломает принудительная тёмная
 * тема браузера, если код нарисован SVG: браузер переводит цвет SVG в одну
 * яркость, и чёрное с белым сливается.
 */
function qrIsBlackOnWhite(node: Element | null): boolean {
  if (!node || node.tagName !== 'IMG') return false;
  const src = node.getAttribute('src') ?? '';
  if (!src.startsWith('data:image/png;base64,')) return false;
  let decoded;
  try {
    decoded = decodePng(pngBytesFromDataUrl(src));
  } catch {
    return false;
  }
  let black = 0;
  let white = 0;
  for (const row of decoded.pixels) {
    for (const pixel of row) {
      if (pixel) white += 1;
      else black += 1;
    }
  }
  const corner = decoded.pixels[0][0] && decoded.pixels[0][decoded.width - 1];
  return corner && black > 100 && white > black;
}

export async function runShareAppChecks(): Promise<void> {
  console.log('\n── «Передать приложение»: QR и ссылка ──');

  const originalTheme = useApp.getState().settings.theme;
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = (query) => ({ ...originalMatchMedia(query), matches: true });
  for (const theme of ['light', 'dark', 'auto'] as const) {
    useApp.getState().setSettings({ theme });
    await sleep(40);
    const expected = theme === 'light' ? 'light' : 'dark';
    const expectedScheme = expected === 'light' ? 'only light' : 'only dark';
    const expectedMeta = expected === 'light' ? 'only light' : 'dark';
    const schemeMeta = document.querySelector('meta[name="color-scheme"]');
    check(`тема ${theme} при тёмной системе: явная схема браузера`,
      document.documentElement.dataset.theme === expected &&
      document.documentElement.style.colorScheme === expectedScheme,
      document.documentElement.style.colorScheme);
    // Тег синхронизирован с CSS: только светлая тема использует «only» в
    // HTML-метатеге; для тёмной допустимое значение метатега — «dark».
    // Samsung Internet с Force Dark может проигнорировать и то, и другое.
    check(`тема ${theme}: тег <meta name="color-scheme"> синхронизирован`,
      schemeMeta?.getAttribute('content') === expectedMeta,
      schemeMeta?.getAttribute('content') ?? 'нет тега');
  }
  window.matchMedia = originalMatchMedia;
  useApp.getState().setSettings({ theme: originalTheme });
  await sleep(40);


  check('ссылка на приложение выглядит как адрес, а не как путь', /^https?:\/\//.test(linkText()), linkText());
  // Смоук-сборка (как и настоящая сборка на Pages) закрепляет адрес через
  // VITE_PUBLIC_URL: значит, родителю не уедет `localhost` из тестовой среды.
  check(
    'закреплённый сборкой адрес важнее адреса запуска',
    linkText() === 'https://artignat2000.github.io/slovo2/',
    linkText(),
  );
  check(
    'подпись ссылки человекочитаемая (хост и путь без слэша на конце)',
    linkLabel('https://artignat2000.github.io/slovo2/') === 'artignat2000.github.io/slovo2',
    linkLabel('https://artignat2000.github.io/slovo2/'),
  );
  check('название для системного «Поделиться» задано', SHARE_TITLE.includes('СЛОВО'), SHARE_TITLE);
  check('QR-код ссылки строится и имеет разумный размер', (() => {
    const matrix = qrEncode(linkText());
    return !!matrix && matrix.size >= 21 && matrix.size <= 57 && matrix.version <= 10;
  })(), String(qrEncode(linkText())?.version));

  // jsdom: ни navigator.share, ни navigator.clipboard — ожидаем ручной способ.
  check('в тестовой среде системного «Поделиться» нет', !canNativeShare(), String(typeof navigator.share));
  const copied = await copyAppLink();
  check('копирование без Clipboard API честно просит скопировать вручную', copied === 'manual', copied);
  const shared = await shareApp();
  check('«Поделиться» без системного меню уходит в тот же запасной путь', shared === 'manual', shared);

  // Открываем «Родителям»: раздел закрыт примером (как в жизни), решаем его.
  const parentTab = buttons().find(
    (b) => (b.textContent ?? '').includes('Родителям') && b.className.includes('tab'),
  );
  check('вкладка «Родителям» на месте', !!parentTab, document.body.textContent?.slice(0, 120) ?? '');
  click(parentTab);
  await sleep(60);
  const equation = document.body.textContent?.match(/(\d+) × (\d+) = \?/);
  const answerInput = document.querySelector('input.input') as HTMLInputElement | null;
  if (equation && answerInput) {
    const value = String(Number(equation[1]) * Number(equation[2]));
    const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setValue?.call(answerInput, value);
    answerInput.dispatchEvent(new window.Event('input', { bubbles: true }));
    await sleep(20);
    click(buttons().find((b) => (b.textContent ?? '').trim() === 'Войти'));
    await sleep(60);
  }
  check('раздел «Родителям» открыт на обзоре', has('XP за сегодня'), document.body.textContent?.slice(0, 160) ?? '');
  // Ссылка для нового ученика — про приложение, поэтому живёт в разделе «Приложение».
  await openParentSection('Приложение');
  check('в «Родителям» есть карточка «Передать приложение»', !!shareCard(), document.body.textContent?.slice(0, 200) ?? '');
  check('в карточке видна ссылка на приложение', has(linkLabel()), document.body.textContent?.slice(0, 200) ?? '');
  const qrArt = document.querySelector('.share-qr-art');
  check(
    'QR-код нарисован картинкой без сети (data-URL, а не SVG)',
    !!qrArt && qrArt.tagName === 'IMG' && (qrArt.getAttribute('src') ?? '').startsWith('data:image/png;base64,'),
    (qrArt?.outerHTML.slice(0, 80)) ?? '',
  );
  check(
    'QR-код чёрный на белом — проверяем пиксели картинки',
    qrIsBlackOnWhite(qrArt),
    (qrArt?.getAttribute('src') ?? '').slice(0, 40),
  );
  check(
    'в карточке есть пошаговая инструкция для второго телефона',
    has('Добавить на экран') && has('Наведи камеру'),
    document.body.textContent?.slice(0, 200) ?? '',
  );

  check('маленький QR чёрный на белом', qrIsBlackOnWhite(qrArt), qrArt?.getAttribute('src')?.slice(0, 40) ?? '');

  click(document.querySelector('.share-qr'));
  await sleep(40);
  check('нажатие на QR открывает крупный вид', !!bigQr(), document.body.textContent?.slice(0, 160) ?? '');
  check('крупный QR чёрный на белом', qrIsBlackOnWhite(bigQr()), bigQr()?.getAttribute('src')?.slice(0, 40) ?? '');
  const closeZoom = buttons().find((b) => (b.textContent ?? '').trim() === 'Закрыть');
  click(closeZoom);
  await sleep(40);
  check('крупный вид закрывается', !bigQr(), document.body.textContent?.slice(0, 160) ?? '');

  const copyButton = buttons().find((b) => (b.textContent ?? '').includes('Скопировать ссылку'));
  check('есть кнопка копирования ссылки', !!copyButton, document.body.textContent?.slice(0, 200) ?? '');
  click(copyButton);
  await sleep(60);
  const manualInput = document.querySelector('.share-manual') as HTMLInputElement | null;
  check(
    'после копирования видно, что делать дальше (ссылка текстом или отметка об успехе)',
    !!manualInput || has('Ссылка скопирована'),
    document.body.textContent?.slice(0, 240) ?? '',
  );
  if (manualInput) {
    check('ссылка в ручном поле совпадает с адресом приложения', manualInput.value === linkText(), manualInput.value);
  }

  // Экран «Кто будет учиться?» — вторая точка, где ищут ссылку для нового ученика.
  // Идём туда через «Дети» в родительском разделе (это тот же экран профилей).
  click(buttons().find((b) => (b.textContent ?? '').includes('Дети') && !b.className.includes('tab')));
  await sleep(80);
  check(
    'на экране «Кто будет учиться?» тоже есть ссылка для нового ученика',
    has('Кто будет учиться') && !!shareCard() && has(linkLabel()),
    document.body.textContent?.slice(0, 200) ?? '',
  );
  check(
    'короткая карточка обходится без пошаговой инструкции',
    !!document.querySelector('.share-app.compact') && !has('Наведи камеру'),
    document.body.textContent?.slice(0, 200) ?? '',
  );
  const closeProfiles = buttons().find((b) => (b.textContent ?? '').trim() === 'Закрыть');
  if (closeProfiles) {
    click(closeProfiles);
    await sleep(60);
  }
  // Возвращаемся на главную: раздел родителей блокируется сам, а другим проверкам
  // нужен обычный экран ученика.
  click(buttons().find((b) => (b.textContent ?? '').includes('Уроки') && b.className.includes('tab')));
  await sleep(60);
  check('после проверок снова виден экран ученика', has('Мой путь') && has('Сегодня'), document.body.textContent?.slice(0, 160) ?? '');
}

// Плавающий БУК: перетаскивание по экрану, сворачивание и реакция на тап
// (замечание 2026-10-04). События шлём так же, как их присылает браузер:
// pointerdown — по самому БУКу, pointermove/pointerup — по окну (обработчик
// жеста слушает окно, иначе палец «терялся» бы, выйдя за пределы совы).
// Проверяем результат: координаты в DOM, запись в localStorage и реплику в пузыре.
import { SECRET_PHRASES } from '../src/state/mascot';
import { check, click, sleep } from './ui-helpers';

const POS_KEY = 'slovo2-buk-pos';
const FOLD_KEY = 'slovo2-buk-folded';

function pev(type: string, x: number, y: number, target: EventTarget) {
  target.dispatchEvent(
    new window.PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      pointerId: 7,
      pointerType: 'touch',
    }),
  );
}

export async function runFloatingMascotChecks(): Promise<void> {
  console.log('\n── Плавающий БУК: перетаскивание, сворачивание, тап ──');

  // Блок идёт от экрана результатов урока: возвращаемся на главную вкладку.
  const toLessons = Array.from(document.querySelectorAll('button')).find(
    (b) => (b.textContent ?? '').includes('К урокам'),
  ) as HTMLButtonElement | undefined;
  if (toLessons) {
    click(toLessons);
    await sleep(60);
  }

  const before = { pos: localStorage.getItem(POS_KEY), fold: localStorage.getItem(FOLD_KEY) };
  localStorage.removeItem(POS_KEY);
  localStorage.removeItem(FOLD_KEY);

  const owl = () => document.querySelector('.app > .mascot') as HTMLElement | null;
  const el = owl();
  check('БУК: плавающий БУК принимает жесты (класс interactive)', !!el?.classList.contains('interactive'), el?.className ?? 'элемента нет');
  check(
    'БУК: у плавающего БУКа есть кнопка «свернуть»',
    !!el?.querySelector('.mascot-fold'),
    el?.querySelector('.mascot-fold')?.outerHTML.slice(0, 60) ?? 'кнопки нет',
  );
  check('БУК: БУК доступен с клавиатуры (role=button)', el?.getAttribute('role') === 'button', el?.getAttribute('role') ?? 'нет роли');

  // ── Баннер внизу (обновление/установка): БУК не должен закрывать его кнопки
  window.dispatchEvent(new window.Event('slovo2:update'));
  await sleep(40);
  check(
    'БУК: при баннере внизу БУК поднимается выше него',
    !!owl()?.classList.contains('raised'),
    owl()?.className ?? 'класса raised нет',
  );

  // ── Перетаскивание: сдвиг больше порога → координаты в left/top и в localStorage
  pev('pointerdown', 300, 500, el!);
  pev('pointermove', 310, 508, window); // меньше порога (6 px) — ещё не тащим
  pev('pointermove', 360, 565, window);
  pev('pointerup', 360, 565, window);
  await sleep(40);

  const moved = owl();
  const saved = JSON.parse(localStorage.getItem(POS_KEY) ?? 'null') as { x: number; y: number } | null;
  check(
    'БУК: после перетаскивания позиция задана через left/top',
    !!moved && moved.style.left !== '' && moved.style.top !== '',
    moved?.style.cssText ?? 'стиля нет',
  );
  check(
    'БУК: угол right/bottom отпущен, чтобы позиция не спорила с CSS',
    moved?.style.right === 'auto' && moved?.style.bottom === 'auto',
    moved?.style.cssText ?? 'стиля нет',
  );
  check(
    'БУК: позиция сохранена в localStorage',
    !!saved && Number.isFinite(saved.x) && Number.isFinite(saved.y),
    localStorage.getItem(POS_KEY) ?? 'пусто',
  );
  check(
    'БУК: координаты остаются в пределах экрана',
    !!saved && saved.x >= 0 && saved.y >= 0 && saved.x <= window.innerWidth && saved.y <= window.innerHeight,
    JSON.stringify(saved),
  );
  check('БУК: во время жеста класс перетаскивания снят', !owl()?.classList.contains('is-dragging'), owl()?.className ?? '');
  check(
    'БУК: сдвинутого ребёнком БУКа не тянет обратно к баннеру',
    !owl()?.classList.contains('raised'),
    owl()?.className ?? '',
  );

  // ── Тап (без сдвига) — это «погладить»: реплика в пузыре
  pev('pointerdown', 120, 120, owl()!);
  pev('pointerup', 120, 120, window);
  await sleep(40);
  const bubble = document.querySelector('.app > .mascot .bubble');
  check(
    'БУК: тап по БУКу вызывает реплику',
    !!bubble && (bubble.textContent ?? '').trim().length > 0,
    document.querySelector('.app > .mascot')?.textContent?.slice(-48) ?? '',
  );
  check('БУК: после тапа снова виден жест «плавания»', !owl()?.classList.contains('is-dragging'), '');

  // ── Удержание: «секрет» (кружение) вместо тапа
  pev('pointerdown', 130, 130, owl()!);
  await sleep(650);
  const secretText = document.querySelector('.app > .mascot .bubble')?.textContent ?? '';
  check(
    'БУК: удержание показывает секретную реплику',
    SECRET_PHRASES.includes(secretText.trim()),
    secretText || 'пузыря нет',
  );
  pev('pointerup', 130, 130, window);
  await sleep(40);
  check(
    'БУК: после удержания обычная реплика не накладывается',
    SECRET_PHRASES.includes((document.querySelector('.app > .mascot .bubble')?.textContent ?? '').trim()),
    document.querySelector('.app > .mascot .bubble')?.textContent ?? 'пузырь исчез',
  );

  // ── Сворачивание и разворот
  click(owl()?.querySelector('.mascot-fold') as HTMLButtonElement | null);
  await sleep(40);
  check('БУК: кнопка «свернуть» сворачивает сову', !!owl()?.classList.contains('folded'), owl()?.className ?? '');
  check(
    'БУК: «свёрнут» переживает перезапуск (localStorage)',
    localStorage.getItem(FOLD_KEY) === '1',
    String(localStorage.getItem(FOLD_KEY)),
  );
  check('БУК: у свёрнутого нет кнопки «свернуть»', !owl()?.querySelector('.mascot-fold'), 'кнопка осталась');
  check('БУК: свёрнутый не показывает пузырь', !owl()?.querySelector('.bubble'), 'пузырь остался');
  check(
    'БУК: свёрнутый остаётся один и тот же элемент (`.app > .mascot`)',
    document.querySelectorAll('.app > .mascot').length === 1,
    `${document.querySelectorAll('.app > .mascot').length}`,
  );

  pev('pointerdown', 120, 120, owl()!);
  pev('pointerup', 120, 120, window);
  await sleep(40);
  check('БУК: тап по свёрнутому разворачивает его', !owl()?.classList.contains('folded'), owl()?.className ?? '');
  check('БУК: после разворота кнопка «свернуть» вернулась', !!owl()?.querySelector('.mascot-fold'), '');

  // ── Возврат в угол: после перетаскивания появляется кнопка «в угол»
  check('БУК: после перетаскивания есть кнопка «вернуть в угол»', !!owl()?.querySelector('.mascot-home'), '');
  click(owl()?.querySelector('.mascot-home') as HTMLButtonElement | null);
  await sleep(40);
  check('БУК: «в угол» возвращает CSS-позицию (left/top очищены)', owl()?.style.left === '' && owl()?.style.top === '', owl()?.style.cssText ?? '');
  check('БУК: «в угол» убирает собственную запись позиции', localStorage.getItem(POS_KEY) === null, String(localStorage.getItem(POS_KEY)));
  check('БУК: кнопка «в угол» исчезает после возврата', !owl()?.querySelector('.mascot-home'), '');

  // ── Автоскрытие при прокрутке в jsdom выключено (AUTO_HIDE=false) ───────────
  check('БУК: в тестовой среде автоскрытие не включается', !owl()?.classList.contains('hidden'), owl()?.className ?? '');

  // ── Живой SVG (0.85.0): глаза следят за указателем, веки моргают ──────────
  pev('pointermove', window.innerWidth - 60, 60, window);
  await sleep(40);
  const pupils = document.querySelector('.app > .mascot .buk-pupils') as SVGGElement | null;
  check(
    'БУК: зрачки поворачиваются за указателем',
    !!pupils && /translate\(-?\d/.test(pupils.style.transform),
    pupils?.style.transform ?? 'группы нет',
  );
  check(
    'БУК: развёрнутый плавающий БУК живой (.buk-stage.alive)',
    !!document.querySelector('.app > .mascot .buk-stage.alive'),
    '',
  );
  check('БУК: у живого БУКа включены веки-моргание', !!document.querySelector('.app > .mascot .buk-lid.on'), '');

  // ── Навигатор (0.85.0): кнопка 🧭 открывает дугу из пяти дверей ────────────
  const hubBtn = document.querySelector('.app > .mascot .mascot-hub') as HTMLButtonElement | null;
  check(
    'БУК: есть кнопка навигатора «Куда полетим»',
    !!hubBtn && hubBtn.getAttribute('aria-expanded') === 'false',
    hubBtn?.outerHTML.slice(0, 70) ?? 'кнопки нет',
  );
  if (hubBtn) click(hubBtn);
  await sleep(40);
  const doorCount = document.querySelectorAll('.app > .mascot .buk-door').length;
  check('БУК: навигатор открывает дугу из пяти дверей', doorCount === 5, `дверей: ${doorCount}`);
  check('БУК: под дугой есть подложка для тапа мимо', !!document.querySelector('.app > .mascot .buk-hub-veil'), '');
  check('БУК: кнопка навигатора помечена раскрытой', document.querySelector('.mascot-hub')?.getAttribute('aria-expanded') === 'true', '');
  // 0.86.2: пока дуга открыта, ряд кнопок скрыт — подписи дверей не закрыты.
  check('БУК: с открытой дугой у совы класс hub-open', !!document.querySelector('.app > .mascot.hub-open'), '');
  check(
    'БУК: после открытия фокус — на первой двери',
    document.activeElement?.classList.contains('buk-door') ?? false,
    (document.activeElement as HTMLElement | null)?.className ?? '',
  );
  // Позиции дверей считает BukHub до первого кадра: центры обязаны быть
  // внутри вьюпорта — на телефоне подписи не уезжают за край экрана.
  const doorCenters = Array.from(document.querySelectorAll('.buk-door')).map((d) => {
    const st = (d as HTMLElement).style;
    return { x: parseFloat(st.left) + 32, y: parseFloat(st.top) + 23 };
  });
  check(
    'БУК: у всех дверей проставлены координаты',
    doorCenters.length === 5 && doorCenters.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
    JSON.stringify(doorCenters.slice(0, 2)),
  );
  check(
    'БУК: центры дверей внутри экрана (кламп к краям)',
    doorCenters.every((p) => p.x >= 0 && p.x <= window.innerWidth && p.y >= 0 && p.y <= window.innerHeight),
    JSON.stringify(doorCenters),
  );

  // Escape закрывает дугу — как любой лист в приложении.
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
  await sleep(40);
  check('БУК: Escape закрывает навигатор', !document.querySelector('.buk-hub'), 'дуга осталась');
  check('БУК: после закрытия класс hub-open снят', !document.querySelector('.mascot.hub-open'), '');
  check(
    'БУК: после закрытия фокус вернулся на кнопку навигатора',
    document.activeElement === hubBtn,
    (document.activeElement as HTMLElement | null)?.className ?? '',
  );

  // Тап мимо дверей (подложка) тоже закрывает.
  if (hubBtn) click(hubBtn);
  await sleep(40);
  const veil = document.querySelector('.app > .mascot .buk-hub-veil');
  check('БУК: дуга открылась повторно', !!veil && !!document.querySelector('.buk-hub'), '');
  if (veil) click(veil);
  await sleep(40);
  check('БУК: тап по подложке закрывает навигатор', !document.querySelector('.buk-hub'), '');

  // ── Дверь «🎁 Задания»: разовая команда главной открывает лист заданий ─────
  if (hubBtn) click(hubBtn);
  await sleep(40);
  const questsDoor = Array.from(document.querySelectorAll('.buk-door')).find((d) =>
    (d.textContent ?? '').includes('Задания'),
  );
  check('БУК: дверь «Задания» есть в дуге', !!questsDoor, '');
  if (questsDoor) click(questsDoor);
  await sleep(60);
  check('БУК: дверь «Задания» открыла лист заданий', !!document.querySelector('.rewards-sheet'), 'листа нет');
  check('БУК: после выбора двери навигатор закрыт', !document.querySelector('.buk-hub'), '');
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
  await sleep(40);
  check('БУК: лист заданий закрывается Escape', !document.querySelector('.rewards-sheet'), '');

  // ── Дверь «🎵 Музыка»: витрина сразу на полке «Музыка» ─────────────────────
  if (hubBtn) click(hubBtn);
  await sleep(40);
  const musicDoor = Array.from(document.querySelectorAll('.buk-door')).find((d) =>
    (d.textContent ?? '').includes('Музыка'),
  );
  check('БУК: дверь «Музыка» есть в дуге', !!musicDoor, '');
  if (musicDoor) click(musicDoor);
  await sleep(60);
  const musicTab = Array.from(document.querySelectorAll('.shop-cats [role="tab"]')).find((b) =>
    (b.textContent ?? '').includes('Музыка'),
  );
  check(
    'БУК: витрина открылась сразу на полке «Музыка»',
    musicTab?.getAttribute('aria-selected') === 'true',
    musicTab ? `aria-selected=${musicTab.getAttribute('aria-selected')}` : 'вкладки нет',
  );

  // Возвращаемся на главную: дальше дуга проверяется дверью «Мой мир».
  const toHome = () =>
    Array.from(document.querySelectorAll('.tabs .tab')).find((b) => (b.textContent ?? '').includes('Уроки')) as
      | HTMLButtonElement
      | undefined;
  const homeTab1 = toHome();
  if (homeTab1) click(homeTab1);
  await sleep(60);
  check('БУК: после «Музыки» вернулись на «Уроки»', !!document.querySelector('.app > .mascot'), '');

  // ── Дверь «🌍 Мой мир»: мир открывается из дуги ─────────────────────────────
  const hubBtn2 = document.querySelector('.app > .mascot .mascot-hub') as HTMLButtonElement | null;
  if (hubBtn2) click(hubBtn2);
  await sleep(40);
  const worldDoor = Array.from(document.querySelectorAll('.buk-door')).find((d) =>
    (d.textContent ?? '').includes('Мой мир'),
  );
  check('БУК: дверь «Мой мир» есть в дуге', !!worldDoor, '');
  if (worldDoor) click(worldDoor);
  await sleep(60);
  check('БУК: дверь «Мой мир» открыла мир', !!document.querySelector('.my-world'), 'мира нет');
  check('БУК: после перехода из дуги навигатор закрыт', !document.querySelector('.buk-hub'), '');
  const homeTab2 = toHome();
  if (homeTab2) click(homeTab2);
  await sleep(60);
  check(
    'БУК: из мира вернулись на «Уроки» — порядок блоков сохранён',
    !document.querySelector('.my-world') && !!document.querySelector('.app > .mascot'),
    '',
  );

  // ── БУК не мешает остальным экранам: во время карточек урока его нет.
  // (проверка pretest-audit «во время карточек урока плавающий БУК скрыт»)

  // Возвращаем настройки устройства как было, чтобы не влиять на другие блоки.
  if (before.pos === null) localStorage.removeItem(POS_KEY);
  else localStorage.setItem(POS_KEY, before.pos);
  if (before.fold === null) localStorage.removeItem(FOLD_KEY);
  else localStorage.setItem(FOLD_KEY, before.fold);
}

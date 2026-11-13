// «Колесо букв» и «Хитрая буква» через настоящий UI (0.103.0).
//
// Проверяем ровно то, что нельзя проверить движком: карточки стоят на месте,
// игра открывается, круг ведёт к победе, а ошибка в «Хитрой букве» даёт
// подсказку, а не провал.
import { WORDS_BY_GRADE } from '../src/content/words';
import { MASTERED_SCORE } from '../src/engine/classes';
import { dayKey, useApp } from '../src/state/store';
import { btnText, buttons, check, click, sleep } from './ui-helpers';

async function goTab(name: string) {
  const tab = buttons().find((b) => (b.textContent ?? '').includes(name) && b.className.includes('tab'));
  click(tab);
  await sleep(60);
}

async function goGroup(title: string) {
  const seg = Array.from(document.querySelectorAll('.games-switch-btn')).find((b) =>
    (b.textContent ?? '').includes(title),
  ) as HTMLButtonElement | undefined;
  if (seg) {
    click(seg);
    await sleep(60);
  }
  return !!seg;
}

async function goGame(title: string, group: string) {
  await goGroup(group);
  const card = Array.from(document.querySelectorAll('.games-card')).find((b) =>
    (b.textContent ?? '').includes(title),
  ) as HTMLButtonElement | undefined;
  if (card) {
    click(card);
    await sleep(80);
  }
  return !!card;
}

export async function runGamesLetterUiChecks(): Promise<void> {
  console.log('\n── Игры: колесо букв и хитрая буква (UI) ──');
  useApp.getState().setSettings({ gamesGates: 'open' });
  await sleep(40);

  // Профиль уже создан сценариями игр выше; добираем знакомые слова класса,
  // чтобы у новых игр был пул.
  const active = useApp.getState().profiles.find((p) => p.id === useApp.getState().activeId);
  const grade = (active?.activeClass ?? 2) as keyof typeof WORDS_BY_GRADE;
  const learned = (WORDS_BY_GRADE[grade] ?? []).filter((w) => !w.text.includes(' ')).slice(0, 10);
  const seed: Record<string, { s: number; due: number; iv: number; n: number; seen: number; ok: number; wrong: number }> = {};
  for (const w of learned) seed[w.id] = { s: MASTERED_SCORE, due: 0, iv: 4, n: 3, seen: 3, ok: 3, wrong: 0 };
  useApp.setState((s) => ({
    profiles: s.profiles.map((p) => (p.id === s.activeId ? { ...p, words: { ...p.words, ...seed } } : p)),
  }));
  await sleep(40);

  await goTab('Игры');
  await sleep(60);

  // ── Карточки: обе игры на витрине ───────────────────────────────────────
  const cards = () => Array.from(document.querySelectorAll('.games-card')) as HTMLButtonElement[];
  await goGroup('Быстро');
  check(
    'колесо: карточка есть в группе «Быстро»',
    cards().some((c) => (c.textContent ?? '').includes('Колесо букв')),
    cards().map((c) => c.textContent).join(' | '),
  );
  await goGroup('Подумать');
  check(
    'хитрая буква: карточка есть в группе «Подумать»',
    cards().some((c) => (c.textContent ?? '').includes('Хитрая буква')),
    cards().map((c) => c.textContent).join(' | '),
  );

  // ── Колесо: игра открывается и доводится до победы ──────────────────────
  await goGame('Колесо букв', 'Быстро');
  const dots = () => Array.from(document.querySelectorAll('.ring-dot')) as HTMLButtonElement[];
  check('колесо UI: круг нарисован', dots().length >= 3, `точек: ${dots().length}`);
  const wordText = (document.querySelector('.ring-word')?.textContent ?? '').trim();
  check('колесо UI: слово показано точками, а не целиком', !/[а-яё]/i.test(wordText), wordText);

  // Проходим круг по порядку — как ребёнок пальцем.
  const order = dots().slice().sort(
    (a, b) => Number(a.dataset.ringIndex) - Number(b.dataset.ringIndex),
  );
  for (const dot of order) {
    click(dot);
    await sleep(20);
  }
  await sleep(120);
  check(
    'колесо UI: прохождение по кругу собирает слово',
    !!document.querySelector('.ring-win') && (document.querySelector('.ring-win-word')?.textContent ?? '').length > 0,
    document.querySelector('.ring-status')?.textContent ?? 'нет строки',
  );

  // «Другое слово» даёт новое слово и чистый круг.
  const winWord = document.querySelector('.ring-win-word')?.textContent ?? '';
  click(btnText('Другое слово →'));
  await sleep(120);
  check('колесо UI: «Другое слово» начинает заново', !document.querySelector('.ring-win') && dots().length >= 3, '');
  check(
    'колесо UI: новое слово не то же самое',
    (document.querySelector('.ring-word')?.textContent ?? '') !== winWord,
    `${winWord} → ${document.querySelector('.ring-word')?.textContent ?? ''}`,
  );

  // ── Колесо: слово собирается ВЕДЕНИЕМ пальца, а не только тапами ───────
  // Игра обещает «проведи по буквам» — до 0.109.1 движение не засчитывалось
  // вовсе. jsdom не считает геометрию, поэтому `elementFromPoint` подменяется
  // по координатам: «палец» идёт по буквам в порядке слова.
  const wheel = document.querySelector('.ring') as HTMLElement | null;
  if (wheel) {
    const byCoord: Record<string, Element> = {};
    const order = dots().slice().sort(
      (a, b) => Number(a.dataset.ringIndex) - Number(b.dataset.ringIndex),
    );
    order.forEach((dot, i) => {
      byCoord[`${i},0`] = dot;
    });
    const original = document.elementFromPoint;
    (document as unknown as { elementFromPoint: unknown }).elementFromPoint = (x: number, y: number) =>
      byCoord[`${x},${y}`] ?? null;

    const pev = (type: string, x: number, y: number) => {
      wheel.dispatchEvent(
        new window.PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1 }),
      );
    };

    pev('pointerdown', 0, 0);
    await sleep(20);
    check(
      'колесо UI: нажатие на букву засчитывается без click',
      /1/.test(document.querySelector('.ring-bar strong')?.textContent ?? ''),
      document.querySelector('.ring-bar strong')?.textContent ?? '',
    );

    // Ведём палец дальше — вторая и третья буквы принимаются движением, без
    // единого click. Слово не доводим до конца: победа и награда уже проверены
    // выше тапами, а лишний `playGame` сдвинул бы общий поток рандома для
    // последующих сценариев (они детерминированы сидом).
    for (let i = 1; i < Math.min(3, order.length); i++) {
      pev('pointermove', i, 0);
      await sleep(15);
    }
    pev('pointerup', 2, 0);
    await sleep(80);

    const barText = document.querySelector('.ring-bar strong')?.textContent ?? '';
    check(
      'колесо UI: ведение пальцем принимает буквы по порядку',
      barText.includes('3') && !document.querySelector('.ring-win'),
      barText,
    );

    (document as unknown as { elementFromPoint: unknown }).elementFromPoint = original;
  }

  // ── Хитрая буква: ошибка даёт подсказку, а не провал ────────────────────
  await goGame('Хитрая буква', 'Подумать');
  const options = () => Array.from(document.querySelectorAll('.tl-option')) as HTMLButtonElement[];
  check('хитрая буква UI: четыре варианта', options().length === 4, `вариантов: ${options().length}`);
  check('хитрая буква UI: буква в слове скрыта', !!document.querySelector('.tl-slot-hidden'), '');

  // Первая ошибка: нажимаем заведомо неверную букву, если она есть.
  const wrongOption = options().find((b) => !b.className.includes('tl-option-right'));
  if (wrongOption) {
    // Верная буква неизвестна из DOM, поэтому ошибаемся до появления
    // подсказки: три разных варианта — это минимум одна ошибка.
    let guesses = 0;
    while (!document.querySelector('.tl-hints p:not(.tiny.muted)') && guesses < 3) {
      const candidate = options().find((b) => !b.disabled);
      if (!candidate) break;
      click(candidate);
      guesses++;
      await sleep(60);
    }
    check(
      'хитрая буква UI: ошибка даёт подсказку, а не провал',
      !!document.querySelector('.tl-hints') && !!document.querySelector('.tl-card'),
      document.querySelector('.tl-hints')?.textContent ?? 'подсказки нет',
    );
    check('хитрая буква UI: попытки не кончаются', options().some((b) => !b.disabled), '');
  }

  useApp.getState().setSettings({ gamesGates: 'points' });
  await sleep(40);
  // День не трогаем: сценарий доступа выставляет его сам.
  void dayKey;
}

/**
 * «Цветок слова» через UI (0.105.0): карточка на витрине, слово раскрывается
 * по буквам, а промах не блокирует выбор.
 */
export async function runWordFlowerUiChecks(): Promise<void> {
  console.log('\n── Игры: цветок слова (UI) ──');
  useApp.getState().setSettings({ gamesGates: 'open' });
  await sleep(60);
  await goTab('Игры');
  await sleep(60);
  const opened = await goGame('Цветок слова', 'Подумать');
  check('цветок UI: карточка открывается', opened && !!document.querySelector('.flower-card'), '');
  if (!opened) return;

  const letters = () => Array.from(document.querySelectorAll('.tl-option')) as HTMLButtonElement[];
  check('цветок UI: четыре карточки-буквы', letters().length === 4, `карточек: ${letters().length}`);
  // 0.108.0: сцена вместо списка — лепестки вокруг центра, стебель, земля.
  // Проверяем именно визуал: владелец сказал «нет никакого визуала».
  check('цветок UI: сцена нарисована (лепестки по числу букв)',
    document.querySelectorAll('.flower-blossom').length >= 2 &&
      !!document.querySelector('.flower-core') &&
      !!document.querySelector('.flower-trunk') &&
      !!document.querySelector('.flower-soil'),
    `лепестков: ${document.querySelectorAll('.flower-blossom').length}`);
  // 0.109.0: цветок нарисован картинками, а не CSS-кружками. Проверяем, что
  // ассеты действительно подключены (иначе сцена молча деградирует до фигур).
  const petalImgs = Array.from(document.querySelectorAll('.flower-blossom img.flower-petal-img')) as HTMLImageElement[];
  check('цветок UI: лепестки нарисованы (картинка на каждом)',
    petalImgs.length === document.querySelectorAll('.flower-blossom').length && petalImgs.length >= 2 &&
      petalImgs.every((img) => img.getAttribute('src') === '/flower/petal.webp'),
    `картинок: ${petalImgs.length}`);
  check('цветок UI: серединка, листья и поляна — тоже рисунок',
    (document.querySelector('.flower-core img') as HTMLImageElement | null)?.getAttribute('src') === '/flower/center.webp' &&
      document.querySelectorAll('img.flower-leaf').length === 2 &&
      !!document.querySelector('.flower-meadow'),
    '');
  check('цветок UI: ни один лепесток не открыт в начале',
    document.querySelectorAll('.flower-blossom.is-open').length === 0, '');
  check('цветок UI: закрытые лепестки букв не выдают',
    document.querySelectorAll('.flower-petal-letter').length === 0, '');

  // Раскрываем слово: на каждом шаге перебираем карточки, пока одна не сработает.
  // Так проверка не зависит от того, какое слово выпало.
  let guard = 0;
  let advanced = 0;
  while (!document.querySelector('.flower-win') && guard++ < 40) {
    const before = document.querySelectorAll('.flower-blossom.is-open').length;
    // Перебираем все четыре карточки шага: верная одна, остальные — соседки.
    for (const card of letters()) {
      click(card);
      await sleep(15);
      if (document.querySelectorAll('.flower-blossom.is-open').length > before) break;
    }
    const after = document.querySelectorAll('.flower-blossom.is-open').length;
    if (after > before) advanced++;
    else break;
  }
  check('цветок UI: слово раскрывается по буквам', advanced > 0, `шагов: ${advanced}`);
  check('цветок UI: раскрытое слово даёт победу', !!document.querySelector('.flower-win'),
    document.querySelector('.flower-word')?.textContent ?? '');
  check('цветок UI: на победе буквы стоят на лепестках',
    document.querySelectorAll('.flower-petal-letter').length ===
      document.querySelectorAll('.flower-blossom').length, '');
  check('цветок UI: на победе сцена цветёт (все лепестки открыты)',
    document.querySelector('.flower-scene')?.getAttribute('data-flower-done') === '1' &&
      document.querySelectorAll('.flower-blossom.is-open').length ===
        document.querySelectorAll('.flower-blossom').length,
    `открыто: ${document.querySelectorAll('.flower-blossom.is-open').length} из ${document.querySelectorAll('.flower-blossom').length}`);

  const winWord = document.querySelector('.flower-win-word')?.textContent ?? '';
  click(btnText('Новое слово →'));
  await sleep(120);
  check('цветок UI: «Новое слово» начинает заново', !document.querySelector('.flower-win') && letters().length === 4, '');
  check('цветок UI: новое слово не то же самое',
    (document.querySelector('.flower-word')?.textContent ?? '') !== winWord,
    `${winWord} → ${document.querySelector('.flower-word')?.textContent ?? ''}`);

  useApp.getState().setSettings({ gamesGates: 'points' });
  await sleep(40);
}

/**
 * «Слоговая мозаика» через UI (0.106.0): карточка на витрине, слово
 * складывается из слогов, неверный порядок ничего не отнимает.
 */
export async function runSyllableUiChecks(): Promise<void> {
  console.log('\n── Игры: слоговая мозаика (UI) ──');
  useApp.getState().setSettings({ gamesGates: 'open' });
  await sleep(60);
  await goTab('Игры');
  await sleep(60);
  const opened = await goGame('Слоговая мозаика', 'Быстро');
  check('мозаика UI: карточка открывается', opened && !!document.querySelector('.syl-card'), '');
  if (!opened) return;

  const tiles = () => Array.from(document.querySelectorAll('.syl-tile')) as HTMLButtonElement[];
  const slots = () => Array.from(document.querySelectorAll('.syl-slot')) as HTMLButtonElement[];
  check('мозаика UI: слоты и плитки нарисованы', slots().length >= 2 && tiles().length === slots().length,
    `слотов: ${slots().length}, плиток: ${tiles().length}`);

  // Собираем в правильном порядке: слово из карточки ищем в банке класса и
  // берём его слоги. Перебирать перестановки (до 6! = 720) — плохая проверка:
  // она проверяет терпение теста, а не игру.
  const text = document.querySelector('.syl-card')?.getAttribute('data-syl-word') ?? '';
  const bank = ([] as Array<{ text: string; syllables: string[] }>).concat(
    ...[1, 2, 3, 4, 5].map((g) => WORDS_BY_GRADE[g as 1 | 2 | 3 | 4 | 5] as unknown as Array<{ text: string; syllables: string[] }>),
  );
  const source = bank.find((w) => w.text === text);
  check('мозаика UI: слово из карточки есть в банке', !!source, text);
  const order = (source?.syllables ?? []).filter((s) => s.trim().length > 0);
  const used = new Set<number>();
  for (const part of order) {
    const tile = Array.from(document.querySelectorAll('.syl-tile')).find(
      (t, index) => !used.has(index) && (t.textContent ?? '') === part,
    ) as HTMLButtonElement | undefined;
    if (!tile) break;
    used.add(Array.from(document.querySelectorAll('.syl-tile')).indexOf(tile));
    click(tile);
    await sleep(30);
  }
  await sleep(80);
  check('мозаика UI: слово складывается из слогов', !!document.querySelector('.syl-win'),
    document.querySelector('.syl-win-word')?.textContent ?? slots().map((s) => s.textContent).join('-'));

  const winWord = document.querySelector('.syl-win-word')?.textContent ?? '';
  click(btnText('Другое слово →'));
  await sleep(150);
  check('мозаика UI: «Другое слово» начинает заново', !document.querySelector('.syl-win') && tiles().length >= 2, '');
  check('мозаика UI: новое слово не то же самое',
    (document.querySelector('.syl-tile') ? document.querySelector('.syl-card')?.textContent ?? '' : '') !== winWord,
    winWord);

  useApp.getState().setSettings({ gamesGates: 'points' });
  await sleep(40);
}

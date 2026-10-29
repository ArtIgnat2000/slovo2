// Структурированный словарик: 4 цветовые группы, круговая диаграмма, легенда,
// поиск и подведение итога по каждой колонке.
import './setup';
import { WORDS_BY_GRADE } from '../src/content/words';
import {
  COLLAPSE_PREVIEW_COUNT,
  WORD_BUCKETS,
  buildDictionarySummary,
  buildDonutSegments,
  matchesWordQuery,
  safePct,
  wordBucket,
} from '../src/engine/dictionary';
import { useApp } from '../src/state/store';
import type { WordState } from '../src/types';
import { body, btnText, buttons, check, click, sleep } from './ui-helpers';

function setInputValue(el: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new window.Event('input', { bubbles: true }));
}

function mkState(partial: Partial<WordState>): WordState {
  return {
    s: 0,
    due: 0,
    iv: 0,
    n: 0,
    seen: 1,
    ok: 0,
    wrong: 0,
    ...partial,
  };
}

export async function runDictionaryUiChecks(): Promise<void> {
  console.log('\n── Словарик: цвета, круговая диаграмма, легенда и итоги колонок ──');

  // ── 1. Чистая логика движка словарика ─────────────────────────────────────
  check(
    'движок словарика: новое слово без ответов → new',
    wordBucket(undefined) === 'new' && wordBucket(mkState({ seen: 0 })) === 'new',
  );
  check(
    'движок словарика: первое знакомство без ошибок (s=15) → mid («Учу»), без слепой зоны',
    wordBucket(mkState({ s: 15, ok: 1, wrong: 0 })) === 'mid',
  );
  check(
    'движок словарика: слово в работе (s=65, была ошибка раньше) → mid',
    wordBucket(mkState({ s: 65, ok: 5, wrong: 1 })) === 'mid',
  );
  check(
    'движок словарика: слово с ошибкой и низким счётом → weak («Трудные»)',
    wordBucket(mkState({ s: 0, ok: 0, wrong: 1 })) === 'weak' &&
      wordBucket(mkState({ s: 25, ok: 2, wrong: 2 })) === 'weak',
  );
  check(
    'движок словарика: s ≥ 90 → good («Знаю»)',
    wordBucket(mkState({ s: 90, ok: 7, wrong: 0 })) === 'good' &&
      wordBucket(mkState({ s: 100, ok: 10, wrong: 1 })) === 'good',
  );

  check(
    'движок словарика: safePct не рисует ложные 100% до полного освоения и ложные 0% при начатом прогрессе',
    safePct(0, 94) === 0 &&
      safePct(1, 94) >= 1 &&
      safePct(93, 94) === 99 &&
      safePct(94, 94) === 100,
    `93/94=${safePct(93, 94)}%`,
  );

  const g2Words = WORDS_BY_GRADE[2];
  const sampleStates: Record<string, WordState> = {
    [g2Words[0].id]: mkState({ s: 95, ok: 7, wrong: 0 }),
    [g2Words[1].id]: mkState({ s: 92, ok: 6, wrong: 1 }),
    [g2Words[2].id]: mkState({ s: 55, ok: 4, wrong: 0 }),
    [g2Words[3].id]: mkState({ s: 15, ok: 1, wrong: 0 }),
    [g2Words[4].id]: mkState({ s: 20, ok: 1, wrong: 2 }),
  };
  const summary = buildDictionarySummary(g2Words, sampleStates);
  const sumCounts =
    summary.counts.good + summary.counts.mid + summary.counts.weak + summary.counts.new;
  check(
    'движок словарика: сумма слов по 4 колонкам строго равна общему числу слов',
    sumCounts === g2Words.length &&
      summary.counts.good === 2 &&
      summary.counts.mid === 2 &&
      summary.counts.weak === 1 &&
      summary.counts.new === g2Words.length - 5,
    `good=${summary.counts.good}, mid=${summary.counts.mid}, weak=${summary.counts.weak}, new=${summary.counts.new}`,
  );
  check(
    'движок словарика: «знаю» + «осталось выучить» = все слова выборки',
    summary.mastered + summary.remaining === summary.total && summary.inProgress === 3,
    `${summary.mastered} + ${summary.remaining} vs ${summary.total}`,
  );

  const newGroupWords = summary.groups.find((g) => g.bucket === 'new')!.words;
  const sortedCopy = [...newGroupWords].sort((a, b) => a.text.localeCompare(b.text, 'ru'));
  check(
    'движок словарика: слова внутри колонки отсортированы по алфавиту А–Я',
    newGroupWords.every((w, idx) => w.id === sortedCopy[idx].id),
  );

  const segs = buildDonutSegments({ good: 1, mid: 1, weak: 1, new: 91 }, 94);
  const segSum = segs.reduce((acc, s) => acc + s.fraction, 0);
  check(
    'круговая диаграмма: даже 1 слово из 94 получает заметную дугу, а сумма долей равна 1',
    segs.length === 4 &&
      segs.every((s) => s.fraction >= 0.035) &&
      Math.abs(segSum - 1) < 1e-6,
    segs.map((s) => `${s.bucket}:${s.fraction.toFixed(3)}`).join(', '),
  );
  const singleSeg = buildDonutSegments({ good: 0, mid: 0, weak: 0, new: 94 }, 94);
  check(
    'круговая диаграмма: одна непустая группа занимает весь круг без зазора',
    singleSeg.length === 1 && singleSeg[0].fraction === 1 && singleSeg[0].startFraction === 0,
  );

  const bereza = g2Words.find((w) => w.text === 'берёза');
  check(
    'поиск словарика: понимает «е» вместо «ё» и не зависит от регистра',
    !!bereza && matchesWordQuery(bereza, 'БЕРЕЗ') && matchesWordQuery(bereza, 'берёз'),
  );

  // ── 2. UI: открываем вкладку «Слова» с засеянным прогрессом всех 4 цветов ─
  const storeBefore = useApp.getState();
  const activeProfile = storeBefore.profiles.find((p) => p.id === storeBefore.activeId);
  if (!activeProfile) throw new Error('словарик: нет активного профиля');
  const savedWords = structuredClone(activeProfile.words);
  const savedClass = activeProfile.activeClass;

  useApp.setState((s) => ({
    profiles: s.profiles.map((p) =>
      p.id !== activeProfile.id
        ? p
        : {
            ...p,
            activeClass: 2,
            words: sampleStates,
          },
    ),
  }));

  const wordsTab = buttons().find(
    (b) => (b.textContent ?? '').includes('Слова') && b.className.includes('tab'),
  );
  click(wordsTab);
  await sleep(80);

  // Сводка + круговая диаграмма
  const hero = document.querySelector('[data-dict-summary]');
  const donut = document.querySelector('.dict-donut svg');
  const arcs = Array.from(document.querySelectorAll('[data-donut-arc]'));
  check('UI словарика: показана сводка прогресса с круговой диаграммой', !!hero && !!donut);
  check(
    'UI словарика: на круговой диаграмме 4 цветные дуги по числу непустых групп',
    arcs.length === 4,
    `дуг: ${arcs.length}`,
  );
  const donutText = donut?.textContent ?? '';
  check(
    'UI словарика: в центре круговой диаграммы нет дроби со слэшем («из 94», решение №3)',
    !donutText.includes('/') && donutText.includes('2') && donutText.includes(`из ${g2Words.length}`),
    donutText,
  );
  const midArc = document.querySelector('[data-donut-hit="mid"]') as SVGCircleElement | null;
  check('UI словарика: дуги имеют подпись, роль кнопки и доступны с клавиатуры',
    !!midArc && midArc.getAttribute('role') === 'button' &&
    midArc.getAttribute('tabindex') === '0' &&
    (midArc.getAttribute('aria-label') ?? '').includes('Учу: 2'));
  midArc?.dispatchEvent(new window.FocusEvent('focusin', { bubbles: true }));
  await sleep(30);
  check('UI словарика: фокус на дуге показывает число и название группы в центре',
    (document.querySelector('.dict-donut svg')?.textContent ?? '').includes('Учу'));
  midArc?.dispatchEvent(new window.FocusEvent('focusout', { bubbles: true }));
  click(midArc);
  await sleep(50);
  check('UI словарика: тап по дуге фильтрует колонку и синхронизирует легенду',
    document.querySelectorAll('[data-word-column]').length === 1 &&
    !!document.querySelector('[data-word-column="mid"]') &&
    midArc?.getAttribute('aria-pressed') === 'true' &&
    document.querySelector('[data-legend="mid"]')?.getAttribute('aria-pressed') === 'true');
  midArc?.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await sleep(50);
  check('UI словарика: Enter по выбранной дуге возвращает все колонки',
    document.querySelectorAll('[data-word-column]').length === 4 &&
    midArc?.getAttribute('aria-pressed') === 'false');

  const heroText = hero?.textContent ?? '';
  check(
    'UI словарика: сводка показывает три непересекающихся статуса без повторов',
    heroText.includes('Знаю: 2') && heroText.includes('Учу: 3') &&
      heroText.includes(`Новые: ${g2Words.length - 5}`) && !heroText.includes('Осталось выучить'),
    heroText.slice(0, 180),
  );

  // Легенда цветов
  const legend = document.querySelector('[data-dict-legend]');
  const legendItems = WORD_BUCKETS.map((b) => document.querySelector(`[data-legend="${b}"]`));
  check(
    'UI словарика: есть легенда «Что означают цвета» со всеми 4 цветами',
    !!legend &&
      (legend.textContent ?? '').includes('Что означают цвета') &&
      legendItems.every(Boolean),
  );
  check(
    'UI словарика: легенда объясняет значение каждого цвета детскими словами',
    (legend?.textContent ?? '').includes('пишу без ошибок') &&
      (legend?.textContent ?? '').includes('закрепляю в уроках') &&
      (legend?.textContent ?? '').includes('Были ошибки') &&
      (legend?.textContent ?? '').includes('Ещё впереди'),
  );

  // 4 колонки и подведение итога по каждой колонке
  const cols = Array.from(document.querySelectorAll('[data-word-column]')) as HTMLElement[];
  check(
    'UI словарика: слова разложены в 4 цветовые колонки в порядке Знаю → Учу → Трудные → Новые',
    cols.map((c) => c.dataset.wordColumn).join(',') === 'good,mid,weak,new',
    cols.map((c) => c.dataset.wordColumn).join(','),
  );

  const expectedCounts: Record<string, number> = {
    good: 2,
    mid: 2,
    weak: 1,
    new: g2Words.length - 5,
  };
  for (const bucket of WORD_BUCKETS) {
    const column = document.querySelector(`[data-word-column="${bucket}"]`);
    const count = column?.querySelector('.dict-col-count')?.textContent ?? '';
    check(
      `UI словарика: число слов в колонке «${bucket}» показано один раз в заголовке`,
      count === String(expectedCounts[bucket]) && !column?.querySelector('[data-col-total]'),
      count,
    );
  }

  // Цветовые классы чипов внутри колонок соответствуют степени освоения
  const goodChips = document.querySelectorAll('[data-word-column="good"] .word-chip.good').length;
  const midChips = document.querySelectorAll('[data-word-column="mid"] .word-chip.mid').length;
  const weakChips = document.querySelectorAll('[data-word-column="weak"] .word-chip.weak').length;
  check(
    'UI словарика: плашки слов внутри колонок окрашены своим цветом (good / mid / weak)',
    goodChips === 2 && midChips === 2 && weakChips === 1,
    `good=${goodChips}, mid=${midChips}, weak=${weakChips}`,
  );

  // Эргономичное сворачивание длинной колонки «Новые» + честное раскрытие
  const newChipsBefore = document.querySelectorAll('[data-word-column="new"] .word-chip').length;
  const expandNewBtn = document.querySelector('[data-col-expand="new"]') as HTMLButtonElement | null;
  check(
    `UI словарика: длинная колонка показывает первые ${COLLAPSE_PREVIEW_COUNT} слов и кнопку раскрытия`,
    newChipsBefore === COLLAPSE_PREVIEW_COUNT &&
      !!expandNewBtn &&
      expandNewBtn.getAttribute('aria-expanded') === 'false',
    `показано: ${newChipsBefore}`,
  );
  click(expandNewBtn);
  await sleep(50);
  const newChipsExpanded = document.querySelectorAll('[data-word-column="new"] .word-chip').length;
  check(
    'UI словарика: кнопка «показать все» раскрывает все слова колонки без потерь',
    newChipsExpanded === expectedCounts.new &&
      document.querySelector('[data-col-expand="new"]')?.getAttribute('aria-expanded') === 'true',
    `раскрыто: ${newChipsExpanded} из ${expectedCounts.new}`,
  );
  click(document.querySelector('[data-col-expand="new"]'));
  await sleep(40);

  // Фильтрация колонки по нажатию на пункт легенды
  const weakLegend = document.querySelector('[data-legend="weak"]') as HTMLButtonElement | null;
  click(weakLegend);
  await sleep(50);
  const filteredCols = document.querySelectorAll('[data-word-column]');
  check(
    'UI словарика: тап по цвету в легенде оставляет выбранную колонку (удобно на телефоне)',
    filteredCols.length === 1 &&
      (filteredCols[0] as HTMLElement).dataset.wordColumn === 'weak' &&
      weakLegend?.getAttribute('aria-pressed') === 'true',
  );
  click(btnText('Все 4 колонки'));
  await sleep(50);
  check(
    'UI словарика: «Все 4 колонки» возвращает все 4 колонки',
    document.querySelectorAll('[data-word-column]').length === 4,
  );

  // Поиск слова по «е» вместо «ё»
  const searchInput = document.querySelector('.dict-search-input') as HTMLInputElement | null;
  check('UI словарика: есть поле быстрого поиска слова', !!searchInput);
  if (searchInput) {
    setInputValue(searchInput, 'берез');
    await sleep(50);
    const visibleChips = Array.from(document.querySelectorAll('[data-dict-board] .word-chip'));
    check(
      'UI словарика: поиск по «берез» находит слово «берёза»',
      visibleChips.some((c) => (c.textContent ?? '').includes('берёза')),
      visibleChips.map((c) => c.textContent).join(', '),
    );
    click(document.querySelector('.dict-search-clear'));
    await sleep(50);
    check('UI словарика: крестик очищает поиск', searchInput.value === '');
  }

  // Разделы-уроки убраны: детский словарик показывает весь класс без второй ленты.
  check(
    'UI словарика: в шапке нет разделов и фильтра уроков',
    !document.querySelector('.dict-scroll-row') && !body().includes('Все темы'),
  );

  // Открытие карточки слова и статус цвета внутри неё + закрытие по Escape
  const firstGoodChip = document.querySelector(
    '[data-word-column="good"] .word-chip',
  ) as HTMLButtonElement | null;
  click(firstGoodChip);
  await sleep(50);
  const modalStatus = document.querySelector('.sheet .dict-modal-status.good');
  check(
    'UI словарика: в открытой карточке слова виден его цветовой статус («Знаю твёрдо»)',
    !!modalStatus && (modalStatus.textContent ?? '').includes('Знаю твёрдо'),
    modalStatus?.textContent ?? 'нет статуса',
  );
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
  await sleep(50);
  check('UI словарика: клавиша Escape закрывает карточку слова', !document.querySelector('.sheet'));

  // Компактный выбор класса не переключает программу профиля.
  const gradePicker = document.querySelector('.dict-grade-picker select') as HTMLSelectElement | null;
  check('UI словарика: один компактный выбор класса вместо ряда чипов',
    !!gradePicker && gradePicker.options.length === 4 && gradePicker.value === '2');
  if (gradePicker) {
    gradePicker.value = '3';
    gradePicker.dispatchEvent(new window.Event('change', { bubbles: true }));
    await sleep(50);
    const nowProfile = useApp.getState().profiles.find((p) => p.id === activeProfile.id);
    check('UI словарика: просмотр 3 класса не меняет программу профиля',
      nowProfile?.activeClass === 2 &&
      (document.querySelector('[data-dict-summary]')?.textContent ?? '').includes('3 класс'));
  }

  // Восстанавливаем исходный профиль и возвращаемся на «Уроки» для следующих проверок смоука
  useApp.setState((s) => ({
    profiles: s.profiles.map((p) =>
      p.id !== activeProfile.id
        ? p
        : {
            ...p,
            activeClass: savedClass,
            words: savedWords,
          },
    ),
  }));
  const homeTab = buttons().find(
    (b) => (b.textContent ?? '').includes('Уроки') && b.className.includes('tab'),
  );
  if (homeTab) {
    click(homeTab);
    await sleep(60);
  }
  check('UI словарика: после проверок профиль и экран возвращены в исходное состояние', !body().includes('Такого слова здесь не нашлось'));
}

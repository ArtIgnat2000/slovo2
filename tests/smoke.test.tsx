// Смоук-тест (npm run test:smoke): в jsdom проходит урок целиком «руками» —
// кликами по настоящим кнопкам — и проверяет то, что нельзя проверить сборкой:
// диалог выхода из урока, монотонную полоску прогресса, пометку отработки ошибки,
// экран результатов с целью дня, выдачу награды за задания дня и сундук.
import './setup';
import './adaptive.test';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../src/App';
import { body, btn, btnText, buttons, check, click, currentWord, failureCount, gemAmounts, has, hasGem, hintButton, openHomeMenu, openParentSection, openRewardsSheet, sleep } from './ui-helpers';
import { runAdaptiveUiChecks } from './adaptive-ui.test';
import { runQuestUiChecks } from './quests-ui.test';
import { runInstallHintChecks } from './install-hint.test';
import { runChestCeremonyChecks } from './chest-ceremony-ui.test';
import { runChestSkinsUiChecks } from './chest-skins-ui.test';
import { runParentUiChecks } from './parent-ui.test';
import { runListsChecks } from './lists-ui.test';
import { runPretestAuditChecks } from './pretest-audit.test';
import { runPuzzleUiChecks } from './puzzles-ui.test';
import { runShopCardChecks } from './cards-ui.test';
import { runDiagnosticsRouteChecks } from './diagnostics-ui.test';
import { runUpdateCheckUiChecks } from './update-check-ui.test';
import { runQuickSoundChecks } from './quick-sound-ui.test';
import { runShareAppChecks } from './share-ui.test';
import { runThemeChecks } from './theme-ui.test';
import { runFloatingMascotChecks } from './mascot-ui.test';
import { runBukChatChecks } from './buk-chat-ui.test';
import { runBukLessonChecks } from './buk-lesson-ui.test';
import { runLessonArtChecks } from './lesson-art-ui.test';
import { runVerdictChecks } from './verdict-ui.test';
import { runTypingChecks } from './typing-ui.test';
import { runUiCleanupChecks } from './ui-cleanup.test';
import { runHomePathChecks } from './home-path.test';
import { runDictionaryUiChecks } from './dictionary-ui.test';
import { runClassChecks } from './classes.test';
import { runWorldUiChecks } from './world-ui.test';
import { runBaseTourUiChecks } from './base-tour-ui.test';
import { runRatingUiChecks } from './rating-ui.test';
// Смена цвета купленной вещи не должна включать музыку (регрессия магазина).
import './recolor-music.test';
import { LESSONS, WORDS } from '../src/content/words';
import { MUSIC_TRACKS } from '../src/engine/music';
import { SOUND_PACKS, STARTER_SOUND_IDS } from '../src/engine/sounds';
import { resolvePhotoSize, resolveWordCardVariant } from '../src/ui/WordView';
import { buildLesson, lessonCardLimit } from '../src/engine/scheduler';
import { dayKey, dayPlan, useApp } from '../src/state/store';
import { idbStorage } from '../src/platform/storage';
import { MAIN_KEY } from '../src/platform/vault';
import { questTitle } from '../src/engine/quests';
import { ITEM_BY_ID, SHOP_ITEMS, TOY_ITEMS, growthStage, sellPrice } from '../src/engine/shop';
import { hasProductPhoto } from '../src/ui/ProductPhoto';
import { isTechTourItem } from '../src/ui/TechTour';
import { TINT_PALETTES, TINT_PRICE } from '../src/engine/tints';
import { hasProductPhoto } from '../src/ui/ProductPhoto';
import { hasOutfitPair } from '../src/ui/PhotoPair';
import { THEME_STYLES } from '../src/engine/theme-styles';
import { masteredCount } from '../src/state/store';
import { runStudyEngineChecks } from './study.test';

// Общая обвязка (клики, поиск кнопок, счётчик проверок) — в tests/ui-helpers.ts:
// её же использует блок интеграционных проверок адаптации.

/**
 * Проверяет, что товарные карточки внутри витрины стоят по возрастанию цены.
 *
 * С 0.79.0 ценник — компактная плашка в подвале карточки (`.shop-foot`), и в
 * неё попадают только настоящие числа. Фильтр `/^\d+$/` остаётся страховкой:
 * счётчики фрагментов и плашки состояний — не цены, в сравнение не идут.
 */
function pricesAscending(selector: string, root: ParentNode = document): boolean {
  const prices = Array.from(root.querySelectorAll(selector))
    .map((card) => (card.querySelector('.shop-price')?.textContent ?? '').trim())
    .filter((text) => /^\d+$/.test(text))
    .map(Number);
  return prices.length > 0 && prices.every((price, index) => index === 0 || prices[index - 1] <= price);
}

/** Витрины полки в порядке появления — у объединённой полки их несколько. */
function shopGrids(shelf: string): Element[] {
  return Array.from(document.querySelectorAll(`section[aria-label="${shelf}"] .shop-boutique`));
}

/** Кнопка-чип полки магазина по названию. */
function shopChip(title: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll('.shop-cats .chip')).find((chip) =>
    (chip.textContent ?? '').includes(title),
  ) as HTMLButtonElement | undefined;
}

/** Полоска прогресса именно урока (в шапке), а не уровня на главной. */
function lessonBarWidth(): number {
  const i = document.querySelector('.row.mb .bar > i') as HTMLElement | null;
  return i ? parseFloat(i.style.width) || 0 : -1;
}

/** Проходит урок кликами до экрана результатов. */
async function playLesson(second = false) {
  // ── Урок ──────────────────────────────────────────────────────────────────
  const startBtn =
    (document.querySelector('.node-btn.current') as HTMLButtonElement | null) ??
    (document.querySelector('.node-btn') as HTMLButtonElement);
  click(startBtn);
  await sleep(60);
  check(`открылся урок${second ? ' (второй)' : ''}`, document.querySelector('.task') !== null, body().slice(0, 200));
  if (!second) check('короткий режим ограничивает базовый урок 12 карточками', /\/12/.test(body()), '');

  const widths: number[] = [];
  let verdicts = 0;
  let lastHadVerdict = false;
  let repairBadges = 0;
  let counterHiddenOnRepair = true;
  let sawDialog = false;
  let exitTried = false;
  let idle = 0;
  let madeMistake = false;
  let steps = 0;
  let reachedResults = false;

  while (steps++ < 1200) {
    await sleep(20);

    const verdictBar = document.querySelector('.footer-bar');
    const inVerdict = !!verdictBar && !!btnText('Далее');
    if (inVerdict && !lastHadVerdict) verdicts++;
    lastHadVerdict = inVerdict;
    // вердикт «✗ Ошибка» виден до нажатия «Далее» — фиксируем, что промах засчитан
    if (document.querySelector('.footer-bar.bad')) madeMistake = true;

    const w = lessonBarWidth();
    if (w >= 0) widths.push(w);

    if (btnText('К урокам') && has('Цель дня') && !document.querySelector('.task')) {
      reachedResults = true;
      break;
    }

    if (document.querySelector('.stat-pill.repair')) {
      repairBadges = steps;
      if (document.querySelector('.stat-pill.tasks')) counterHiddenOnRepair = false;
    }

    // выход из урока: пробуем один раз, уже ответив на что-нибудь
    if (!exitTried && verdicts >= 1 && !inVerdict) {
      exitTried = true;
      const x = btn((b) => b.getAttribute('aria-label') === 'Выйти из урока');
      if (x) {
        click(x);
        await sleep(40);
        if (has('Выйти из урока?')) {
          sawDialog = true;
          check('в диалоге есть безопасная кнопка «Продолжить урок»', !!btnText('Продолжить урок'));
          click(btnText('Продолжить урок')!);
          await sleep(40);
          if (!document.querySelector('.task')) break;
          continue;
        }
      }
    }

    if (btnText('Далее')) {
      idle = 0;
      click(btnText('Далее')!);
      continue;
    }

    // 1. Проговаривание по слогам
    const syllable = buttons().find((b) => b.className.includes('syllable') && !b.disabled);
    if (syllable) {
      idle = 0;
      click(syllable);
      continue;
    }

    // 2. Знакомство
    if (btnText('Запомнил')) {
      idle = 0;
      click(btnText('Запомнил')!);
      continue;
    }

    // 3. Сборка слова — подсказка подставляет буквы и закрывает задание
    const buildHint = btnText('Подставить букву') ?? btnText('Ещё букву');
    if (buildHint && document.querySelector('.letter')) {
      idle = 0;
      click(buildHint);
      continue;
    }

    // 4. Окошко / исправь робота. Первое такое задание в уроке отвечаем НЕВЕРНО —
    //    но только когда уверены, что жмём именно неверный вариант. Раньше ошибка
    //    вставлялась «в каждое третье задание» и проверка отработки была рулеткой:
    //    примерно один прогон из семи был красным на ровном месте.
    const options = Array.from(document.querySelectorAll('.option')) as HTMLButtonElement[];
    if (options.length) {
      idle = 0;
      const word = currentWord();
      const visible = document.querySelector('.word-big')?.textContent ?? '';
      let correct: HTMLButtonElement | undefined;
      if (word && visible.includes('□')) {
        const letter = word.text[visible.indexOf('□')];
        correct = options.find((o) => (o.textContent ?? '').toLowerCase() === letter);
      } else if (word) {
        correct = options.find((o) => (o.textContent ?? '').trim() === word.text);
      }
      const wrong = correct ? options.find((o) => o !== correct) : undefined;
      const wantWrong = !madeMistake && !!wrong;
      click((wantWrong ? wrong : correct) ?? options[0]);
      continue;
    }

    // 5. Письмо / зрительный диктант — набираем слово на своей клавиатуре
    const keys = Array.from(document.querySelectorAll('.key')) as HTMLButtonElement[];
    const word = currentWord();
    if (keys.length && word) {
      idle = 0;
      // первое задание на письмо тоже отвечаем неверно, чтобы отработка ошибки
      // гарантированно встретилась. Букву берём ту, что ТОЧНО есть на клавиатуре:
      // раньше набирали «ъ», а его в раскладке нет — промах не засчитывался вовсе
      const wantWrong = !madeMistake;
      const typed = (document.querySelector('.typed')?.textContent ?? '').replace('·', '').trim();
      const need = wantWrong ? word.text.slice(typed.length, -1) : word.text.slice(typed.length);
      for (const ch of need) {
        const k = keys.find((b) => (b.textContent ?? '').trim() === ch);
        if (!k) break;
        click(k);
        await sleep(6);
      }
      if (wantWrong) {
        const nextLetter = word.text[typed.length + need.length];
        const bad = keys.find((b) => {
          const t = (b.textContent ?? '').trim();
          return t !== '⌫' && t !== nextLetter;
        });
        if (bad) click(bad);
      }
      const checkBtn = btnText('Проверить');
      if (checkBtn && !checkBtn.disabled) click(checkBtn);
      continue;
    }

    // 6. Любая подсказка — если задание почему-то не поддаётся
    const anyHint = hintButton();
    if (anyHint) {
      idle = 0;
      click(anyHint);
      continue;
    }

    if (++idle > 100) break; // идёт пауза перед вердиктом — подождём
  }

  const compact = widths.filter((v, i) => i === 0 || v !== widths[i - 1]);
  let mono = true;
  for (let i = 1; i < compact.length; i++) if (compact[i] + 0.001 < compact[i - 1]) mono = false;
  check(
    `полоска прогресса урока не откатывается${second ? ' (2-й урок)' : ''} (${compact.length} замеров, шагов ${steps})`,
    mono && compact.length > 3,
    JSON.stringify(compact.map((v) => Math.round(v))),
  );
  return { sawDialog, reachedResults, verdicts, repairBadges, counterHiddenOnRepair, madeMistake };
}


async function main() {
  // Как в main.tsx: сначала дожидаемся чтения сохранения. Сторож записи держит
  // запись замороженной до подтверждённого чтения, иначе тесты писали бы впустую.
  await useApp.persist.rehydrate();
  runStudyEngineChecks();

  // ── Первый запуск: профиля ещё нет ──────────────────────────────────────────
  // Здесь ловится «пустой экран» с GitHub Pages. useLook() возвращал литерал {}
  // на каждый вызов, zustand 5 сравнивает результат селектора по ссылке, React
  // не получал стабильного снимка и уходил в бесконечный цикл перерисовок
  // (на проде — «Minified React error #185»), поэтому #root оставался пустым.
  // Профиль создаём ПОСЛЕ первой отрисовки: иначе у селектора всегда есть
  // стабильный equipped, и баг не воспроизводится.
  // React в dev-режиме при бесконечном цикле пишет предупреждение в console.error
  // и роняет процесс непойманным «Maximum update depth exceeded» — перехватываем
  // оба канала, чтобы проверка упала внятно, а не молчаливым крашем.
  const bootErrors: string[] = [];
  const realError = console.error;
  const onUncaught = (e: Error) => {
    bootErrors.push(`${e?.name ?? 'Error'}: ${e?.message ?? e}`);
  };
  process.on('uncaughtException', onUncaught);
  console.error = (...args: unknown[]) => {
    bootErrors.push(args.map((a) => String(a)).join(' '));
    realError(...(args as [unknown]));
  };

  const root = createRoot(document.getElementById('root')!);
  root.render(createElement(App));
  await sleep(150);

  process.off('uncaughtException', onUncaught);
  console.error = realError;
  check(
    'виден экран выбора ученика, ошибок в консоли нет',
    has('Кто будет учиться') && bootErrors.length === 0,
    bootErrors.length ? bootErrors[0].replace(/\s+/g, ' ').slice(0, 220) : body().slice(0, 200),
  );

  useApp.getState().createProfile('Тест', '🦊');
  await sleep(60);

  check('профиль создан, показана главная', has('Сегодня') && has('Мой путь') && !!document.querySelector('.home-hero'), body().slice(0, 200));
  check('размер урока по умолчанию короткий', useApp.getState().profiles[0].lessonSize === 'short', '');

  check(
    'тестовый предпросмотр сундука удалён перед релизом',
    !buttons().some((button) => (button.textContent ?? '').includes('· тест')) &&
      !has('Предпросмотр сцены') &&
      !has('Тестовая сцена'),
    body().slice(-220),
  );
  const profileForSchedule = useApp.getState().profiles[0];
  const scheduleCounts = (['short', 'standard', 'full'] as const).map((size) =>
    buildLesson({
      lesson: LESSONS[0],
      level: 0,
      states: profileForSchedule.words,
      reviewWords: [],
      maxCards: lessonCardLimit(size),
    }).length,
  );
  check('scheduler держит лимиты 12/16/20', scheduleCounts.every((n, i) => n <= [12, 16, 20][i]), scheduleCounts.join('/'));
  useApp.getState().setLessonSize('short');
  await sleep(40);
  check('родительский лимит короткого урока сохранён', useApp.getState().profiles[0].lessonSize === 'short', '');
  // Уровень 1 даёт первому уроку активное письмо: так smoke проверяет
  // намеренную ошибку и обязательную repair-карточку, не меняя поведение нового профиля.
  useApp.setState((state) => ({
    profiles: state.profiles.map((p) => ({
      ...p,
      lessons: { ...p.lessons, school: { ...p.lessons.school, level: 1 } },
    })),
  }));

  // Задания дня берём из плана профиля — того же источника, что и интерфейс:
  // новичку «Повтори N слов» заменяется другим заданием дня.
  const plan = dayPlan(useApp.getState().profiles[0]);
  check('на главной виден герой «Сегодня» с кнопкой старта', has('Сегодня') && !!btnText('Начать') && !!document.querySelector('.home-hero'), '');
  await openRewardsSheet();
  check(
    'три задания дня в карточке',
    plan.length === 3 && plan.every((q) => has(questTitle(q.spec, q.target))),
    plan.map((q) => questTitle(q.spec, q.target)).join(' / '),
  );
  check('сундук начинает с нулём ключей', has('Ключи: 0 из 3'), '');
  check('кристаллов пока 0', hasGem(0), gemAmounts().join(' / '));
  click(btn((b) => (b.getAttribute('aria-label') ?? '') === 'Закрыть'));
  await sleep(40);

  // ── Подсказка «Добавь приложение на экран» ─────────────────────────────────
  await runInstallHintChecks();

  const run = await playLesson();
  check('диалог «Выйти из урока?» показан, урок продолжился', run.sawDialog, '');
  check('экрана результатов достигли', run.reachedResults, `ответов с вердиктом: ${run.verdicts}`);
  check('на экране результатов виден плавающий БУК', document.querySelectorAll('.app > .mascot').length === 1, '');
  check('склонение ошибок на экране результатов («1 ошибка»)', has('1 ошибка'), body().slice(0, 220));
  check('ошибка в уроке засчитана (вердикт «Ошибка» видели)', run.madeMistake, `вердиктов: ${run.verdicts}`);
  check('задания-отработки после ошибок встречались', run.repairBadges > 0, '');
  check('на отработке счётчик уступает место пометке «ещё раз»', run.counterHiddenOnRepair, '');
  check('результаты показывают цель дня', has('цель 120') && has('Цель дня'), body().slice(0, 300));
  check('опыт показан один раз без пояснения-дубля', has('Опыт за урок') && !/Урок принёс|Тренировка дала|Прогресс есть/.test(body()), '');
  click(btnText('К урокам')!);
  await sleep(80);

  // Перед вторым запуском проверяем, что родительский режим можно сменить для следующего урока.
  useApp.getState().setLessonSize('standard');
  await sleep(40);
  check('обычный режим сохранён для следующего урока', useApp.getState().profiles[0].lessonSize === 'standard', '');

  // второй урок — задание «Пройди 2 урока» должно закрыться
  const run2 = await playLesson(true);
  check('второй урок пройден', run2.reachedResults, '');
  click(btnText('К урокам'));
  await sleep(80);

  // ── Награды ───────────────────────────────────────────────────────────────
  // Задания «6 подряд» и «повтори 5 слов» уроком целиком не закрыть (мы специально
  // ошибались) — доигрываем их через тот же API стора, что и настоящие ответы
  const st = useApp.getState();
  const kinds = dayPlan(useApp.getState().profiles[0]).map((q) => q.spec.kind);
  if (kinds.includes('review')) for (let i = 0; i < 5; i++) st.answer(WORDS[i].id, 5, true);
  if (kinds.includes('correct')) for (let i = 0; i < 12; i++) st.answer(WORDS[i].id, 5, false);
  if (kinds.includes('flawless')) for (let i = 0; i < 6; i++) st.answer(WORDS[i].id, 5, false);
  await sleep(80);

  await openRewardsSheet();
  const gemsBefore = useApp.getState().profiles[0].gems;
  let claims = 0;
  for (let i = 0; i < 8; i++) {
    const claim = btnText('Забрать');
    if (!claim) break;
    click(claim);
    await sleep(40);
    claims++;
  }
  const gemsAfter = useApp.getState().profiles[0].gems;
  check(`награда за задания забрана (${claims} шт., 💎 ${gemsBefore} → ${gemsAfter})`, gemsAfter > gemsBefore, '');
  check('тост о награде показан', has('кристалл'), '');

  check('собраны все три ключа', has('Ключи: 3 из 3'), '');
  const chest = btnText('Открыть сундук БУКа');
  check('сундук доступен после всех заданий', !!chest, '');
  if (chest) {
    const before = useApp.getState().profiles[0].gems;
    click(chest);
    await sleep(60);
    const p = useApp.getState().profiles[0];
    check(
      'сундук открылся и награда применена',
      (p.daily?.chestsTotal ?? 0) === 1 && p.gems === before + 15 && p.daily?.lastChest?.gems === 15,
      '',
    );
    check(
      'открылась сцена праздника трёх ключей с полной наградой',
      has('ПРАЗДНИК ТРЁХ КЛЮЧЕЙ') && has('Повернуть ключи!') && has('+15'),
      body().slice(-280),
    );
    check('БУК обращается к ребёнку по имени', has('Тест, жми!'), body().slice(-220));
    click(btnText('Повернуть ключи!'));
    await sleep(30);
    check('действие ребёнка запускает сцену открытия', !!document.querySelector('.chest-ceremony.is-showing'), '');
    check('кнопка открытия исчезла после фиксации награды', !btnText('Открыть сундук БУКа'), '');
    check('сохранён постоянный чек награды', has('Награда получена') && has('Посмотреть награду'), '');
    check('счётчик сундуков дня стоит', p.daily?.chestsToday === 1, '');

    // Шоу можно закончить сразу; награда уже применена и пропуск не меняет баланс.
    click(btnText('Пропустить'));
    await sleep(30);
    check('пропуск сразу показывает итог и действие', has('Сундук открыт!') && has('Здорово!'), body().slice(-220));
    click(btnText('Здорово!'));
    await sleep(40);
    const afterClose = useApp.getState().profiles[0].gems;
    check('окно закрывается, постоянный чек остаётся', !has('Сундук открыт!') && has('Награда получена'), '');
    check(
      'после закрытия фокус возвращается к кнопке чека',
      document.activeElement === btnText('Посмотреть награду'),
      document.activeElement?.textContent ?? '',
    );
    click(btnText('Посмотреть награду'));
    await sleep(30);
    check(
      'повторно открыт чек без повторного шоу',
      has('Сундук открыт!') && has('+15') && !btnText('Пропустить'),
      '',
    );
    click(btnText('Здорово!'));
    await sleep(30);
    check('повторный просмотр не дублирует награду', useApp.getState().profiles[0].gems === afterClose, '');
  }

  // ── Картинки к словам (пункт 6) ───────────────────────────────────────────
  {
    const home = buttons().find((b) => (b.textContent ?? '').includes('Уроки') && b.className.includes('tab'));
    click(home!);
    await sleep(60);
    const wordsTab = buttons().find((b) => (b.textContent ?? '').includes('Слова') && b.className.includes('tab'));
    click(wordsTab!);
    await sleep(60);
    // Миниатюры живут внутри плитки .word-chip-art (плитка держит скругление и
    // ленивую загрузку), поэтому берём именно картинки внутри неё.
    const chips = Array.from(document.querySelectorAll('.word-chip-art img')) as HTMLImageElement[];
    check('в словарике у слов с картинками показаны картинки', chips.length >= 8, `картинок: ${chips.length}`);
    check(
      'картинки собираются из public/words/*.webp',
      chips.every((c) => /words\/[a-z0-9_-]+\.webp$/.test(c.getAttribute('src') ?? '')),
      chips[0]?.getAttribute('src') ?? '—',
    );
    // открываем слово, у которого точно есть картинка
    click(document.querySelector('.word-chip-art')!.closest('.word-chip'));
    await sleep(60);
    const art = document.querySelector('.sheet .word-art');
    check('в карточке слова картинка показана крупно', !!art, '');
    check('картинка стоит на плите с безопасной зоной', !!document.querySelector('.sheet .word-art-frame'), '');
    check('до загрузки есть эмодзи-подложка', !!document.querySelector('.sheet .word-art-placeholder') && !art!.classList.contains('is-ready'), '');
    // Геометрию jsdom не считает, поэтому проверяем каркас: картинка и слово —
    // разные блоки карточки, а зазор между ними задаёт токен --wcard-gap-art
    // (пиксельные замеры — в docs/word-cards-design.md).
    const card = document.querySelector('.sheet .wcard')!;
    const kids = Array.from(card.children);
    const artFrame = kids.find((el) => el.classList.contains('word-art-frame'));
    const main = kids.find((el) => el.classList.contains('wcard-main'));
    check(
      'картинка и слово — отдельные блоки карточки (зазор задаёт токен)',
      !!artFrame && !!main && main.contains(document.querySelector('.sheet .word-big')),
      `блоков: ${kids.length}`,
    );
    // Основной вариант карточки с 2026-10-06 — B «Фотокарточка» (решение
    // пользователя): снимок растянут по ширине паспарту, слово под линией.
    check(
      'основной вариант карточки — «Фотокарточка» (B)',
      card.classList.contains('wcard-photo'),
      card.className,
    );
    check(
      'в «Фотокарточке» снимок растянут по паспарту (word-art-fill)',
      !!artFrame && artFrame.classList.contains('word-art-fill'),
      artFrame?.className ?? '—',
    );
    check(
      'размер снимка задан токеном --art-photo',
      (artFrame as HTMLElement | undefined)?.style.getPropertyValue('--art-size') === 'var(--art-photo)',
      (artFrame as HTMLElement | undefined)?.getAttribute('style') ?? '—',
    );
    // Переключатели для дизайн-ревью читаются из адреса (и из хеша — он доезжает
    // в предпросмотре песочницы, где параметры теряются).
    const hrefBefore = window.location.href;
    window.history.replaceState({}, '', '/?cards=plate');
    check('?cards=plate возвращает вариант «Плита»', resolveWordCardVariant() === 'plate', window.location.search);
    // «Полка» (картинка слева) удалена: неизвестный или старый ?cards=split
    // возвращает основной вариант, а не строку с картинкой слева.
    window.history.replaceState({}, '', '/#cards=split&art=compact');
    check(
      'хеш #cards=split (удалённый вариант) откатывается к «Фотокарточке», #art=compact читается',
      resolveWordCardVariant() === 'photo' && resolvePhotoSize() === 'compact',
      window.location.hash,
    );
    window.history.replaceState({}, '', '/?art=base');
    check('?art=base возвращает снимок во всю карточку', resolvePhotoSize() === 'base', window.location.search);
    window.history.replaceState({}, '', hrefBefore);
    check(
      'без параметров работает выбранный вариант «Фотокарточка»',
      resolveWordCardVariant() === 'photo' && resolvePhotoSize() === 'base',
      window.location.href,
    );
    check('приоритет карточки высокий, миниатюры ленивые', art!.getAttribute('fetchpriority') === 'high' && chips.every((c) => c.getAttribute('loading') === 'lazy'), '');
    art!.dispatchEvent(new window.Event('load'));
    await sleep(20);
    check('загрузка открывает картинку', art!.classList.contains('is-ready'), '');
    art!.dispatchEvent(new window.Event('error'));
    await sleep(20);
    check('ошибка картинки оставляет эмодзи', !document.querySelector('.sheet .word-art') && !!document.querySelector('.sheet .word-art-placeholder'), '');

    click(btnText('Закрыть'));
    await sleep(40);
  }

  // ── Магазин БУКа (пункт 4) ────────────────────────────────────────────────
  const shopTab = buttons().find((b) => (b.textContent ?? '').includes('БУК') && b.className.includes('tab'));
  check('во вкладках есть магазин БУКа', !!shopTab);
  click(shopTab!);
  await sleep(80);
  // 0.32.1: раздел называется «БУК», потому что внутри и витрина, и покупки.
  // Сегмент покупок — «Мои покупки» (слово «Гардероб» устарело), а внутри
  // него секции без повтора «Мои»: Наряды, Техника, Костюмы, Музыка, Звуки.
  check(
    'раздел БУКа открылся: «БУК 🎩», «Витрина», «Мои покупки»',
    (document.querySelector('.screen h1')?.textContent ?? '').includes('БУК') &&
      has('Витрина') &&
      has('Мои покупки'),
    document.querySelector('.screen h1')?.textContent ?? '--',
  );
  check(
    'сегмент покупок называется «Мои покупки», а не «Гардероб»',
    !!Array.from(document.querySelectorAll('.shop-seg button')).find((b) => (b.textContent ?? '').includes('Мои покупки')) &&
      !has('Гардероб'),
    Array.from(document.querySelectorAll('.shop-seg button')).map((b) => b.textContent).join(' | '),
  );
  check('витрина по умолчанию — полка нарядов', has('Наряды БУКа'), '');
  // 0.75.2: полки нарядов и костюмов объединены (PR #141), поэтому цену сверяем
  // отдельно в витрине нарядов и отдельно в витрине «Костюмы за кристаллы».
  const outfitShelves = shopGrids('Наряды');
  check(
    'наряды в витрине идут от меньшей цены к большей',
    pricesAscending('.shop-item', outfitShelves[0]),
    Array.from(outfitShelves[0]?.querySelectorAll('.shop-title') ?? []).map((el) => el.textContent).join(' → '),
  );
  // 0.89.0: фотосерия нарядов подключена к витрине. В нише карточки — сам
  // предмет (раньше сова в вещи на 96 px, по которой очки и брошь не узнать),
  // в листе — пара кадров с переключением по тапу (жалоба «не нашёл фото»).
  const crownCard = Array.from(document.querySelectorAll('.shop-item')).find((el) => (el.textContent ?? '').includes('Корона'));
  check(
    'наряд с фотопарой показывает в нише студийный снимок',
    !!crownCard?.querySelector('.shop-case-photo img[src*="products/crown.webp"]'),
    crownCard?.querySelector('.shop-case img')?.getAttribute('src') ?? 'нет снимка',
  );
  click(crownCard);
  await sleep(60);
  check(
    'в листе наряда — пара кадров: главный и второй ракурс',
    document.querySelectorAll('.photo-tour').length === 1 &&
      (document.querySelector('.photo-tour img')?.getAttribute('src') ?? '').includes('products/crown.webp') &&
      (document.querySelector('.photo-tour-caption')?.textContent ?? '').includes('1 / 2'),
    document.querySelector('.photo-tour-caption')?.textContent ?? 'пары нет',
  );
  click(document.querySelector('.photo-tour-stage'));
  await sleep(40);
  check(
    'тап по кадру переключает на второй ракурс пары',
    (document.querySelector('.photo-tour img')?.getAttribute('src') ?? '').includes('products/gallery/crown-alt.webp') &&
      (document.querySelector('.photo-tour-caption')?.textContent ?? '').includes('2 / 2'),
    document.querySelector('.photo-tour-caption')?.textContent ?? '--',
  );
  click(document.querySelector('.shop-sheet-veil'));
  await sleep(40);
  check('лист наряда закрывается тапом по затемнению', !document.querySelector('.photo-tour'), '');

  check(
    'полки — чипами, «Звуки» уже открыты',
    has('Костюмы') && has('Музыка') && !!Array.from(document.querySelectorAll('.shop-cats .chip')).find((c) => (c.textContent ?? '').includes('Звуки') && !c.hasAttribute('disabled')) && !has('скоро'),
    '',
  );
  check('полка «Фоны» активна', !!Array.from(document.querySelectorAll('.shop-cats .chip')).find((c) => (c.textContent ?? '').includes('Фоны') && !c.hasAttribute('disabled')), '');
  check('показан баланс кристаллов', hasGem(useApp.getState().profiles[0].gems), gemAmounts().join(' / '));

  // «Мой мир» — третий верхний раздел БУКа, доступный даже при пустой коллекции.
  click(Array.from(document.querySelectorAll('.shop-seg button')).find((b) => (b.textContent ?? '').includes('Мои покупки'))!);
  await sleep(40);
  check(
    '«Мой мир» доступен из БУКа и при пустой коллекции техники',
    (useApp.getState().profiles[0].shop?.owned ?? []).length === 0 &&
      !!Array.from(document.querySelectorAll('.shop-seg button')).find((b) => (b.textContent ?? '').includes('Мой мир')),
    `куплено вещей: ${(useApp.getState().profiles[0].shop?.owned ?? []).length}`,
  );
  click(Array.from(document.querySelectorAll('.shop-seg button')).find((b) => (b.textContent ?? '').includes('Витрина'))!);
  await sleep(40);

  const backgroundShelf = Array.from(document.querySelectorAll('.shop-cats .chip')).find((c) => (c.textContent ?? '').includes('Фоны'));
  click(backgroundShelf);
  await sleep(30);
  check(
    'в «Фонах» показаны классика, неон и три дополнительных оформления',
    document.querySelectorAll('.background-theme-card').length === THEME_STYLES.length &&
      THEME_STYLES.every((theme) => document.querySelector(`.background-theme-card[data-theme-style="${theme.id}"]`)),
    String(document.querySelectorAll('.background-theme-card').length),
  );
  const originalThemeStyle = useApp.getState().settings.themeStyle;
  const originalColorScheme = useApp.getState().settings.theme;
  const originalResolvedScheme = document.documentElement.dataset.theme;
  const applyBackground = (style: (typeof THEME_STYLES)[number]['id']) =>
    document.querySelector(`.background-theme-card[data-theme-style="${style}"] button`) as HTMLButtonElement | null;
  const spaceThemeButton = applyBackground('space');
  click(spaceThemeButton);
  await sleep(50);
  check(
    '«Космос» из «Фоны» применяется независимо от цветовой схемы',
    useApp.getState().settings.themeStyle === 'space' &&
      document.documentElement.dataset.themeStyle === 'space' &&
      useApp.getState().settings.theme === originalColorScheme &&
      document.documentElement.dataset.theme === originalResolvedScheme,
  );
  const neonThemeButton = applyBackground('neon');
  click(neonThemeButton);
  await sleep(50);
  check(
    'неоновая тема из «Фоны» переключает весь интерфейс',
    useApp.getState().settings.themeStyle === 'neon' && document.documentElement.dataset.themeStyle === 'neon',
  );
  const restoreThemeButton = applyBackground(originalThemeStyle);
  click(restoreThemeButton);
  await sleep(50);
  check(
    'выбранный фон сохраняется и возвращается через ту же полку',
    useApp.getState().settings.themeStyle === originalThemeStyle && document.documentElement.dataset.themeStyle === originalThemeStyle,
  );

  // ── Школа НААШ: школьный уголок витрины (0.74.0) ───────────────────────────
  // Раздел — не девятая полка товаров: форма БУКа за кристаллы и «полка идей»
  // с картинками серии. Цен в рублях и «заказать» здесь быть не может.
  const naashChip = Array.from(document.querySelectorAll('.shop-cats .chip')).find((c) => (c.textContent ?? '').includes('НААШ'));
  check(
    'в витрине есть школьный уголок «НААШ»',
    !!naashChip,
    Array.from(document.querySelectorAll('.shop-cats .chip')).map((c) => c.textContent).join(' | '),
  );
  if (naashChip) click(naashChip);
  await sleep(40);
  const naashTiles = () => Array.from(document.querySelectorAll('.naash-tile'));
  check('«Полка идей»: двенадцать картинок серии', naashTiles().length === 12, String(naashTiles().length));
  check(
    'форма школы на месте: значок, кепка, шарф, худи',
    ['Значок школы', 'Кепка школы', 'Шарф в триколоре', 'Худи школы'].every((title) => has(title)),
    '',
  );
  check(
    'у каждой картинки есть подпись для скринридера',
    naashTiles().every((tile) => (tile.getAttribute('aria-label') ?? '').length > 5),
    '',
  );
  check(
    'картинки полки грузятся лениво — установка не тяжелеет',
    naashTiles().every((tile) => tile.querySelector('img')?.getAttribute('loading') === 'lazy'),
    '',
  );
  check('подпись честная: это идеи, а не товар', has('Это идеи, а не товар'), '');
  check('в разделе нет рублей и предзаказов', !/₽|руб\.|предзаказ|заказать/i.test(body()), '');
  if (naashTiles()[0]) click(naashTiles()[0] as HTMLButtonElement);
  await sleep(40);
  check('тап по картинке открывает её крупно', !!document.querySelector('.naash-sheet img'), '');
  click(buttons().find((b) => (b.textContent ?? '').includes('Закрыть')));
  await sleep(30);
  check('лист картинки закрывается', !document.querySelector('.naash-sheet'), '');
  click(Array.from(document.querySelectorAll('.shop-cats .chip')).find((c) => (c.textContent ?? '').includes('Наряды')));
  await sleep(30);
  check('в «Нарядах» нет дублей формы школы', !has('Значок школы') && has('Наряды БУКа'), '');

  // ── Полка «Техника»: отдельные разделы авто, кораблей и телефонов ──────
  const toyShelf = Array.from(document.querySelectorAll('.shop-cats .chip')).find((c) => (c.textContent ?? '').includes('Техника'));
  check('в витрине есть полка «Техника»', !!toyShelf, '');
  if (toyShelf) click(toyShelf);
  await sleep(30);
  const toyTabs = () => Array.from(document.querySelectorAll('.shop-toy-cats [role="tab"]'));
  check(
    'разделы авто, кораблей и телефонов доступны отдельными вкладками',
    ['Авто', 'Самолёты', 'Корабли', 'Телефоны'].every((title) => toyTabs().some((tab) => (tab.textContent ?? '').includes(title))),
    toyTabs().map((tab) => tab.textContent).join(' | '),
  );
  // 0.75.2: питомцы, спорт и вкусняшки больше не делят полку с техникой —
  // у них собственные разделы магазина (PR #141).
  check(
    'питомцы, спорт и вкусняшки вынесены из техники в отдельные полки',
    ['Питомцы', 'Спорт', 'Вкусняшки'].every((title) => shopChip(title)) && !toyTabs().some((tab) => /Питомцы|Спорт|Вкусняшки/.test(tab.textContent ?? '')),
    toyTabs().map((tab) => tab.textContent).join(' | '),
  );
  check('«Авто» открывается первым и не смешивается с другими товарами', document.querySelectorAll('.shop-item.toy-item').length === 19 && has('Болид') && !has('Морская яхта') && !has('iPhone Air'), '');
  check('авто внутри полки идут от меньшей цены к большей', pricesAscending('.shop-item.toy-item'));
  check(
    '«Авто»: девятнадцать машин стоят на отдельной полке (0.76.0: паровоз «Огнедышащий»)',
    ['Звезда', 'Стрела', 'Кубик', 'Адмирал', 'Лорд', 'Бык', 'Молния', 'Болид', 'Скалолаз', 'Жёлтый кэб', 'Квант', 'Импульс', 'Полярник', 'Луноход', 'Огнедышащий', 'Розовая машина', 'Розовая звезда', 'Тесла', 'Розовый танк'].every((title) => has(title)),
    '',
  );
  // Каждая машина — отдельный цветной карандашный рисунок (public/cars/*.webp).
  {
    const carTitles = /Звезда|Стрела|Кубик|Адмирал|Лорд|Бык|Молния|Болид|Скалолаз|Жёлтый кэб|Квант|Импульс|Полярник|Луноход|Огнедышащий|Розовая машина|Розовая звезда|Тесла/;
    const carCards = Array.from(document.querySelectorAll('.shop-item.toy-item')).filter((el) => carTitles.test(el.textContent ?? ''));
    const carArt = carCards.map((el) => el.querySelector('img')?.getAttribute('src') ?? '');
    // 0.80.0: машины переводятся на студийные снимки партиями — рисунок
    // остаётся только у тех, кого ещё не пересняли, и это видно по адресу.
    check(
      '«Авто»: у каждой машины своя картинка, без повторов',
      carArt.length === 18 &&
        new Set(carArt).size === carArt.length &&
        carArt.every((src) => /\/(cars|products)\/car-[a-z-]+\.webp$/.test(src)),
      `уникальных: ${new Set(carArt).size}/${carArt.length}`,
    );
    check(
      '«Авто»: переснятые машины показывают студийный снимок',
      carCards.every((el) => {
        const src = el.querySelector('img')?.getAttribute('src') ?? '';
        return !src.includes('/products/') || !!el.querySelector('.shop-icon > img.product-photo');
      }),
      carArt.join(', ').slice(0, 160),
    );
    const tankCard = Array.from(document.querySelectorAll('.shop-item.toy-item')).find((el) => (el.textContent ?? '').includes('Розовый танк'));
    check(
      '«Авто»: розовый танк — либо снимок, либо рисунок, но не пустая ниша',
      !!tankCard?.querySelector('.shop-icon img') || !!tankCard?.querySelector('.shop-icon svg'),
      tankCard?.querySelector('.shop-icon')?.innerHTML.slice(0, 60) ?? 'нет карточки',
    );
  }
  check('«Авто»: витрина-бутик показывает отдельные карточки машин', document.querySelectorAll('.shop-boutique').length === 1 && !!document.querySelector('.shop-boutique-mint'), '');
  const galleryItems = TOY_ITEMS.filter((item) => (item.toy === 'phone' && item.id.startsWith('phone-')) || item.toy === 'ship' || item.toy === 'plane');
  check(
    'фотогалерея назначена всем 19 телефонам, кораблям и самолётам',
    galleryItems.length === 19 && galleryItems.every((item) => isTechTourItem(item.id)),
    `покрыто ${galleryItems.filter((item) => isTechTourItem(item.id)).length} из ${galleryItems.length}`,
  );

  const shipTab = toyTabs().find((tab) => (tab.textContent ?? '').includes('Корабли'));
  if (shipTab) click(shipTab);
  await sleep(30);
  check('«Корабли» — отдельная полка из пяти судов (0.72.0: добавлен «Титаник»)', document.querySelectorAll('.shop-item.toy-item').length === 5 && ['Морская яхта', 'Контейнеровоз', 'Супертанкер', 'Авианосец', 'Титаник'].every((title) => has(title)), '');
  check('корабли внутри полки идут от меньшей цены к большей', pricesAscending('.shop-item.toy-item'));
  {
    const shipArt = Array.from(document.querySelectorAll('.shop-item.toy-item img')).map((img) => img.getAttribute('src') ?? '');
    // 0.79.0: у всех пяти судов — фотореалистичные студийные снимки моделей.
    check(
      'у каждого судна свой фотореалистичный снимок из папки продуктов',
      shipArt.length === 5 && new Set(shipArt).size === 5 && shipArt.every((src) => /\/products\/ship-[a-z]+\.webp$/.test(src)),
      `снимков: ${shipArt.join(', ')}`,
    );
    const titanicCard = Array.from(document.querySelectorAll('.shop-item.toy-item')).find((el) => (el.textContent ?? '').includes('Титаник'));
    check(
      '«Титаник» снят с четырьмя трубами, а не нарисован схемой',
      !!titanicCard?.querySelector('.shop-icon > img.product-photo') && !titanicCard.querySelector('.shop-icon svg'),
      '',
    );
  }
  const yachtCard = Array.from(document.querySelectorAll('.shop-item.toy-item')).find((el) => (el.textContent ?? '').includes('Морская яхта'));
  if (yachtCard) click(yachtCard);
  await sleep(20);
  const yachtDetail = document.querySelector('.shop-sheet');
  const yachtGallery = yachtDetail?.querySelector('.tech-tour');
  check(
    'корабль: два согласованных фотографических кадра',
    !!yachtGallery?.querySelector('.tech-tour-photo') && yachtGallery.querySelector('.tech-tour-count')?.textContent === '1 / 2',
    yachtGallery?.textContent ?? 'галерея не открылась',
  );
  check('товарная галерея не смешивает фотографии с рисунками', !yachtGallery?.querySelector('svg, .ship-art, .airplane-art, .phone-dream, .adventure-scene'), '');
  const yachtImage = yachtDetail?.querySelector('.shop-bigart-toy img.product-photo');
  check(
    'подробная карточка судна показывает крупный снимок без подписи про карандаш',
    has('Морская яхта') &&
      !!yachtImage &&
      yachtImage.getAttribute('src') === '/products/ship-paper.webp' &&
      yachtImage.getAttribute('alt') === 'Морская яхта — морская яхта' &&
      !yachtDetail?.textContent?.includes('карандаш'),
    yachtDetail?.textContent?.slice(0, 120) ?? 'карточка не открылась',
  );
  const yachtGalleryStage = yachtGallery?.querySelector('.tech-tour-stage');
  if (yachtGalleryStage) click(yachtGalleryStage);
  await sleep(10);
  check(
    'корабль: второй кадр — студийное фото того же судна',
    yachtGallery?.querySelector('.tech-tour-alt-photo')?.getAttribute('src') === '/products/gallery/ship-paper-alt.webp' && yachtGallery.querySelector('.tech-tour-count')?.textContent === '2 / 2',
    '',
  );
  if (yachtGalleryStage) click(yachtGalleryStage);
  await sleep(10);
  check('корабль: тапом можно вернуться к общему виду', yachtGallery?.querySelector('.tech-tour-count')?.textContent === '1 / 2', '');
  const closeShipSheet = document.querySelector('.shop-sheet-veil');
  if (closeShipSheet) click(closeShipSheet);
  await sleep(20);

  const planeTab = toyTabs().find((tab) => (tab.textContent ?? '').includes('Самолёты'));
  if (planeTab) click(planeTab);
  await sleep(20);
  const planeCard = Array.from(document.querySelectorAll('.shop-item.toy-item')).find((el) => (el.textContent ?? '').includes('Стриж'));
  if (planeCard) click(planeCard);
  await sleep(20);
  const planeGallery = document.querySelector('.shop-sheet .tech-tour');
  check('самолёт: два кадра без рисованной подмены фото', !!planeGallery?.querySelector('.tech-tour-photo') && !!planeGallery.querySelector('.tech-tour-count'), '');
  const planeGalleryStage = planeGallery?.querySelector('.tech-tour-stage');
  if (planeGalleryStage) click(planeGalleryStage);
  await sleep(10);
  check(
    'самолёт: второй кадр остаётся студийной фотографией',
    planeGallery?.querySelector('.tech-tour-alt-photo')?.getAttribute('src') === '/products/gallery/plane-swift-alt.webp' && planeGallery.querySelector('.tech-tour-count')?.textContent === '2 / 2',
    '',
  );
  const closePlaneSheet = document.querySelector('.shop-sheet-veil');
  if (closePlaneSheet) click(closePlaneSheet);
  await sleep(20);

  const phoneTab = toyTabs().find((tab) => (tab.textContent ?? '').includes('Телефоны'));
  if (phoneTab) click(phoneTab);
  await sleep(30);
  const phoneCard = Array.from(document.querySelectorAll('.shop-item.toy-item')).find((el) => (el.textContent ?? '').includes('iPhone Air'));
  // 0.82.0: телефоны пересняты студийными снимками, поэтому полка считается
  // как «арт + фото = 11» и не ломается на каждой новой фотографии.
  const electronicsCards = Array.from(document.querySelectorAll('.shop-item.toy-item'));
  const expectedPhotos = TOY_ITEMS.filter((item) => item.toy === 'phone' && hasProductPhoto(item.id)).length;
  const electronicsPhotos = electronicsCards.filter((el) => !!el.querySelector('img.product-photo')).length;
  check(
    'телефоны и электроника остаются отдельным разделом',
    electronicsCards.length === 11 &&
      electronicsPhotos === expectedPhotos &&
      document.querySelectorAll('.shop-item.toy-item .electronics-art').length === 11 - electronicsPhotos,
    `карточек=${electronicsCards.length} фото=${electronicsPhotos} ожидалось=${expectedPhotos}`,
  );
  check('телефоны внутри полки идут от меньшей цены к большей', pricesAscending('.shop-item.toy-item'));
  check(
    'телефон со снимком показывает фотографию, а не 3D-арт',
    !!phoneCard?.querySelector('img.product-photo') && !phoneCard?.querySelector('.electronics-art'),
    '',
  );

  // Телефоны не имитируют 3D-поворот: в карточке доступны настоящие фото сторон.
  check(
    'телефон больше не притворяется поворотным',
    !document.querySelector('.shop-item.toy-item .phone-rotate') &&
      !document.querySelector('.shop-item.toy-item .phone-turntable'),
    '',
  );

  click(phoneCard?.querySelector('.shop-title'));
  await sleep(30);
  {
    const phoneSheet = document.querySelector('.shop-sheet');
    const phonePhoto = phoneSheet?.querySelector('.shop-bigart-toy img.product-photo');
    check(
      'подробная карточка показывает снимок телефона, а не сову',
      !!phonePhoto &&
        phonePhoto.getAttribute('src') === '/products/phone-smart.webp' &&
        !phoneSheet?.querySelector('.mascot'),
      phoneSheet?.innerHTML.slice(0, 200) ?? 'карточка не открылась',
    );
    const phoneGallery = phoneSheet?.querySelector('.tech-tour');
    check('телефон: спинка и второй студийный кадр', !!phoneGallery?.querySelector('.tech-tour-count') && !!phoneGallery.querySelector('.tech-tour-photo'), '');
    const phoneGalleryStage = phoneGallery?.querySelector('.tech-tour-stage');
    if (phoneGalleryStage) click(phoneGalleryStage);
    await sleep(10);
    check(
      'телефон: второй кадр — настоящая фотография экрана',
      phoneGallery?.querySelector('.tech-tour-alt-photo')?.getAttribute('src') === '/products/gallery/phone-smart-front.webp' && phoneGallery.querySelector('.tech-tour-count')?.textContent === '2 / 2',
      '',
    );
    check('у телефона со снимком нет подсказки про поворот', !phoneSheet?.querySelector('.art-hint'), '');
  }
  const closePhoneSheet = document.querySelector('.shop-sheet-veil');
  if (closePhoneSheet) click(closePhoneSheet);
  await sleep(20);
  check('ближайшая покупка соответствует открытому разделу', has('Ближайшая покупка') && hasGem(25), gemAmounts().join(' / '));

  // ── Отдельные полки «Питомцы», «Спорт» и «Вкусняшки» (0.75.2, PR #141) ───
  // Раньше они жили вкладками внутри «Техники»; теперь у каждой своя полка,
  // и товары не перемешиваются с авто, кораблями и телефонами.
  for (const [chipTitle, kind] of [['Питомцы', 'pet'], ['Спорт', 'sport'], ['Вкусняшки', 'food']] as const) {
    const chip = shopChip(chipTitle);
    if (chip) click(chip);
    await sleep(40);
    const expected = TOY_ITEMS.filter((item) => item.toy === kind);
    const cards = Array.from(document.querySelectorAll('.shop-item.toy-item'));
    check(
      `полка «${chipTitle}» открывается отдельным разделом`,
      !!document.querySelector(`section[aria-label="${chipTitle}"]`) && !document.querySelector('.shop-toy-cats'),
      document.querySelectorAll('.screen section').length.toString(),
    );
    check(
      `полка «${chipTitle}»: только свои товары (${expected.length})`,
      cards.length === expected.length && expected.every((item) => has(item.title)) && !has('Болид'),
      `карточек: ${cards.length}`,
    );
    check(`${chipTitle.toLowerCase()} внутри полки идут от меньшей цены к большей`, pricesAscending('.shop-item.toy-item'));
  }
  // Возвращаемся на «Технику»: следующие проверки покупают машину с полки «Авто».
  click(shopChip('Техника')!);
  await sleep(40);
  const backToCars = toyTabs().find((tab) => (tab.textContent ?? '').includes('Авто'));
  if (backToCars) click(backToCars);
  await sleep(30);

  // Покупка вещи кладёт её в слот `toy` — с 0.22.0 это «любимая вещь на
  // главном подиуме ангара»; на БУКе техника больше не рисуется.
  const gemsBeforeToy = useApp.getState().profiles[0].gems;
  const ownedBeforeToy = [...(useApp.getState().profiles[0].shop?.owned ?? [])];
  useApp.setState((s) => ({
    profiles: s.profiles.map((p) => (p.id === s.activeId ? { ...p, gems: Math.max(p.gems, 35) } : p)),
  }));
  await sleep(30);
  const toyBought = useApp.getState().buyItem('car-racer');
  await sleep(30);
  const autoTabAfterBuy = toyTabs().find((tab) => (tab.textContent ?? '').includes('Авто'));
  if (autoTabAfterBuy) click(autoTabAfterBuy);
  await sleep(30);
  check(
    'вещь покупается и занимает слот «Техника»',
    toyBought && useApp.getState().profiles[0].shop?.equipped?.toy === 'car-racer',
    JSON.stringify(useApp.getState().profiles[0].shop?.equipped),
  );
  check('купленная техника отмечена как часть «Моего мира»', has('В Моём мире ✓'), '');
  // 0.22.0: техника больше не рисуется на БУКе (ни на сцене полки, ни где
  // ещё): внутри маскота нет <image> с купленной машиной.
  check('купленная техника не рисуется на БУКе', !document.querySelector('.mascot svg image'), '');

  // Техника — область полной коллекции, а не отдельная сцена/ангар.
  const myWorldTab = Array.from(document.querySelectorAll('.shop-seg button')).find((b) => (b.textContent ?? '').includes('Мой мир'));
  check('в шапке БУКа есть единый раздел «Мой мир»', !!myWorldTab, '');
  click(myWorldTab);
  await sleep(60);
  const techRegion = Array.from(document.querySelectorAll('.collection-area')).find((area) => (area.getAttribute('aria-label') ?? '').startsWith('Техника:'));
  check('«Мой мир» объединяет технику бывшего ангара с остальной коллекцией', !!techRegion && (techRegion.textContent ?? '').includes('Болид') && !!techRegion.querySelector('.collection-map-thumb') && !document.querySelector('.hangar'), body().slice(0, 200));
  click(buttons().find((b) => (b.textContent ?? '').includes('Назад в БУК')));
  await sleep(60);
  check('возврат из «Моего мира» сохранил исходную полку «Техника»', (document.querySelector('.shop-cats .chip.on')?.textContent ?? '').includes('Техника'));

  click(Array.from(document.querySelectorAll('.shop-seg button')).find((b) => (b.textContent ?? '').includes('Мои покупки'))!);
  await sleep(40);
  click(Array.from(document.querySelectorAll('.shop-seg button')).find((b) => (b.textContent ?? '').includes('Витрина'))!);
  await sleep(40);

  // Вход с главной (0.32.0): значка 🚗 в шапке больше нет — ангар живёт
  // в гардеробе и на полке «Техника», а первый экран разгружен.
  click(buttons().find((b) => (b.textContent ?? '').includes('Уроки') && b.className.includes('tab'))!);
  await sleep(60);
  check(
    'в шапке главной больше нет значка 🚗',
    !document.querySelector('.topbar [aria-label="Ангар БУКа"]') && has('Мой путь'),
    '',
  );
  click(buttons().find((b) => (b.textContent ?? '').includes('БУК') && b.className.includes('tab'))!);
  await sleep(60);

  // Возвращаем профиль: следующие блоки считают покупки нарядов с нуля.
  useApp.setState((s) => ({
    profiles: s.profiles.map((p) =>
      p.id === s.activeId ? { ...p, gems: gemsBeforeToy, shop: { ...p.shop!, owned: ownedBeforeToy, equipped: {} } } : p,
    ),
  }));
  await sleep(30);

  // Полка музыки: весь каталог, две тематические полки, честная лицензия
  click(Array.from(document.querySelectorAll('.shop-cats .chip')).find((c) => (c.textContent ?? '').includes('Музыка'))!);
  await sleep(30);
  check('в музыкальном магазине все мелодии каталога', document.querySelectorAll('.music-item').length === MUSIC_TRACKS.length, String(document.querySelectorAll('.music-item').length));
  check('полки «Спокойный фон» и «Коллекция» разведены', has('Спокойный фон') && has('Коллекция и награды'), '');
  // Цифровые обложки (0.88.0): у трека лицо с типографикой и оборот с
  // настоящими метаданными. Эмодзи на градиенте больше нет.
  check('у каждой мелодии на витрине своя цифровая обложка', document.querySelectorAll('.music-item .digital-cover').length === MUSIC_TRACKS.length, String(document.querySelectorAll('.music-item .digital-cover').length));
  const carefreeCard = Array.from(document.querySelectorAll('.music-item')).find((card) => (card.textContent ?? '').includes('Беззаботный день'));
  check('на обложке трека — номер в серии и название', carefreeCard?.querySelector('.dc-number')?.textContent === '01' && (carefreeCard?.querySelector('.dc-title')?.textContent ?? '').includes('Беззаботный день'), carefreeCard?.querySelector('.dc-title')?.textContent ?? '');
  if (carefreeCard) click(carefreeCard);
  await sleep(40);
  const trackCover = document.querySelector('.shop-bigart .dc-frame');
  check('лист трека открывается лицевой стороной обложки', trackCover?.getAttribute('data-side') === 'front' && !!trackCover.querySelector('.dc-front'), '');
  check('лицо обложки: название и абстрактный спектр', (trackCover?.textContent ?? '').includes('Беззаботный день') && !!trackCover?.querySelector('.dc-spectrum'), '');
  check('у обложки виден счётчик сторон 1 / 2', (document.querySelector('.dc-caption')?.textContent ?? '').includes('1 / 2'), document.querySelector('.dc-caption')?.textContent ?? '');
  const coverFlip = trackCover?.querySelector('.dc-stage') as HTMLElement | null;
  if (coverFlip) click(coverFlip);
  await sleep(40);
  check('тап по обложке показывает оборот', trackCover?.getAttribute('data-side') === 'back' && !!trackCover.querySelector('.dc-back'), '');
  check(
    'оборот трека: оригинал, ISRC и лицензия',
    (trackCover?.textContent ?? '').includes('Carefree') && (trackCover?.textContent ?? '').includes('USUAN1400037') && (trackCover?.textContent ?? '').includes('CC BY 4.0'),
    trackCover?.textContent ?? '',
  );
  check('счётчик сторон переключился на 2 / 2', (document.querySelector('.dc-caption')?.textContent ?? '').includes('2 / 2'), document.querySelector('.dc-caption')?.textContent ?? '');
  document.querySelector('.shop-sheet-veil')?.click();
  await sleep(30);
  // Лицензия не загромождает полку, но доступна по запросу.
  const creditsBtn = buttons().find((b) => (b.textContent ?? '').includes('Авторы и лицензии'));
  check('лицензия скрыта за подписанной кнопкой', !!creditsBtn && !has('CC BY 4.0'), '');
  if (creditsBtn) click(creditsBtn);
  await sleep(30);
  check('магазин честно называет лицензию после раскрытия', has('CC BY 4.0') && has('Kevin MacLeod'), '');
  check(
    'раздел лицензий показывает оригинальные названия и источник',
    has('Carefree') && has('incompetech.com') && has('creativecommons.org') && has('Изменения аудио'),
    body().slice(0, 200),
  );
  check('раздел объясняет отсутствие исключительных прав', has('не даёт исключительных прав'), '');
  if (creditsBtn) click(creditsBtn);
  await sleep(30);
  const gemsBeforeMusic = useApp.getState().profiles[0].gems;
  const neonCard = Array.from(document.querySelectorAll('.music-item')).find((card) => (card.textContent ?? '').includes('Весёлый переулок'));
  const neonBuy = Array.from(neonCard?.querySelectorAll('button') ?? []).find((button) => (button.textContent ?? '').includes('Купить')) as HTMLButtonElement | undefined;
  check('музыкальный магазин предлагает платные треки', !!neonBuy, '');
  if (neonBuy && gemsBeforeMusic >= 8) {
    click(neonBuy);
    await sleep(30);
    click(btnText('Купить за 💎8'));
    await sleep(50);
    const musicBought = useApp.getState().profiles[0];
    check('покупка трека списывает кристаллы и открывает его', musicBought.gems === gemsBeforeMusic - 8 && musicBought.shop?.musicOwned?.includes('happy-alley'), '');
    check('новый трек сразу выбран для БУКа', musicBought.shop?.musicTrack === 'happy-alley', String(musicBought.shop?.musicTrack));
    // Покупка однократная: повторный вызов не списывает кристаллы снова
    const okAgain = useApp.getState().buyMusicTrack('happy-alley');
    const afterRepeat = useApp.getState().profiles[0];
    check('повторная покупка не списывает кристаллы', okAgain === false && afterRepeat.gems === gemsBeforeMusic - 8, `ok=${okAgain}, gems=${afterRepeat.gems}`);
    useApp.setState((s) => ({
      profiles: s.profiles.map((p) => (p.id === s.activeId ? { ...p, gems: gemsBeforeMusic, shop: { ...p.shop!, musicTrack: null } } : p)),
    }));
    await sleep(30);
  }

  // Регрессия «пропадает купленная музыка» (0.21.2): покупка → СРАЗУ повторная
  // синхронизация (rehydrate, как по visibilitychange/сообщению второй копии),
  // без ожидания записи. Чтение сторожа обязано стоять в очереди ПОСЛЕ записи
  // покупки: иначе merge заменял память старой записью, трек «пропадал», а
  // следующее действие закрепляло потерю в IndexedDB.
  {
    const raceTrack = MUSIC_TRACKS.find((t) => t.price > 0)!;
    const gemsBeforeRace = useApp.getState().profiles[0].gems;
    useApp.setState((s) => ({
      profiles: s.profiles.map((p) => (p.id === s.activeId ? { ...p, gems: gemsBeforeRace + raceTrack.price } : p)),
    }));
    const boughtRace = useApp.getState().buyMusicTrack(raceTrack.id);
    // Никакого sleep: rehydrate стартует, пока запись покупки ещё в очереди.
    const rehydrated = useApp.persist.rehydrate();
    await Promise.resolve(rehydrated);
    await sleep(60);
    const raced = useApp.getState().profiles[0];
    check(
      'покупка музыки переживает немедленную повторную синхронизацию',
      boughtRace && (raced.shop?.musicOwned ?? []).includes(raceTrack.id),
      `bought=${boughtRace}, musicOwned=${JSON.stringify(raced.shop?.musicOwned)}`,
    );
    check(
      'кристаллы за пережившую синхронизацию покупку списаны один раз',
      raced.gems === gemsBeforeRace,
      `ожидали ${gemsBeforeRace}, получили ${raced.gems}`,
    );
    // Следующее действие не должно затереть покупку в самом хранилище.
    useApp.getState().addXp(1);
    await sleep(80);
    const storedRace = await idbStorage.getItem(MAIN_KEY);
    check(
      'после синхронизации покупка музыки остаётся и в IndexedDB',
      !!storedRace && storedRace.includes(raceTrack.id),
      storedRace ? 'в записи нет купленного трека' : 'запись не читается',
    );
    // Возвращаем профиль: следующие блоки считают кристаллы с нуля.
    useApp.setState((s) => ({
      profiles: s.profiles.map((p) =>
        p.id === s.activeId
          ? {
              ...p,
              gems: gemsBeforeRace,
              shop: {
                ...p.shop!,
                musicOwned: (p.shop?.musicOwned ?? []).filter((x) => x !== raceTrack.id),
                musicTrack: p.shop?.musicTrack === raceTrack.id ? null : p.shop?.musicTrack,
              },
            }
          : p,
      ),
    }));
    await sleep(30);
  }

  // Полка «Звуки»: мелодии правильного ответа и ошибки
  click(Array.from(document.querySelectorAll('.shop-cats .chip')).find((c) => (c.textContent ?? '').includes('Звуки'))!);
  await sleep(30);
  check('в «Звуках» показаны все наборы', document.querySelectorAll('.sound-item').length === SOUND_PACKS.length, String(document.querySelectorAll('.sound-item').length));
  check('наборы звуков идут от меньшей цены к большей', pricesAscending('.sound-item'));
  check('у каждого набора — «послушать» верный ответ и ошибку', document.querySelectorAll('.sound-item .sound-try button').length === SOUND_PACKS.length * 2, '');
  check('у каждого набора звуков своя цифровая обложка', document.querySelectorAll('.sound-item .digital-cover').length === SOUND_PACKS.length, String(document.querySelectorAll('.sound-item .digital-cover').length));
  const classicCard = Array.from(document.querySelectorAll('.sound-item')).find((card) => (card.textContent ?? '').includes(SOUND_PACKS[0].title));
  if (classicCard) click(classicCard);
  await sleep(40);
  const packCover = document.querySelector('.shop-bigart .dc-frame');
  check('лист набора показывает обложку, а не эмодзи', !!packCover?.querySelector('.dc-front') && packCover?.getAttribute('data-kind') === 'sound', '');
  const packFlip = packCover?.querySelector('.dc-stage') as HTMLElement | null;
  if (packFlip) click(packFlip);
  await sleep(40);
  check(
    'оборот набора — партитура реальных нот: верный ответ и ошибка',
    packCover?.querySelectorAll('.dc-roll').length === 2 &&
      (packCover?.textContent ?? '').includes('Верный ответ') &&
      (packCover?.textContent ?? '').includes('Ошибка'),
    String(packCover?.querySelectorAll('.dc-roll').length),
  );
  document.querySelector('.shop-sheet-veil')?.click();
  await sleep(30);
  check('новый профиль звучит классикой', useApp.getState().profiles[0].shop?.soundPack === 'classic', String(useApp.getState().profiles[0].shop?.soundPack));
  const xyloCard = Array.from(document.querySelectorAll('.sound-item')).find((card) => (card.textContent ?? '').includes('Ксилофон'));
  const xyloPick = Array.from(xyloCard?.querySelectorAll('button') ?? []).find((b) => (b.textContent ?? '').includes('Выбрать')) as HTMLButtonElement | undefined;
  check('стартовый «Ксилофон» выбирается бесплатно', !!xyloPick, '');
  if (xyloPick) click(xyloPick);
  await sleep(30);
  check('выбранный набор звуков сохраняется в профиле', useApp.getState().profiles[0].shop?.soundPack === 'xylophone', String(useApp.getState().profiles[0].shop?.soundPack));
  const paidSound = SOUND_PACKS.find((p) => p.price > 0)!;
  const gemsBeforeSound = useApp.getState().profiles[0].gems;
  useApp.setState((s) => ({ profiles: s.profiles.map((p) => (p.id === s.activeId ? { ...p, gems: Math.max(p.gems, paidSound.price) } : p)) }));
  await sleep(30);
  const paidCard = Array.from(document.querySelectorAll('.sound-item')).find((card) => (card.textContent ?? '').includes(paidSound.title));
  const paidBuy = Array.from(paidCard?.querySelectorAll('button') ?? []).find((b) => (b.textContent ?? '').includes('Купить')) as HTMLButtonElement | undefined;
  check('платный набор звуков можно купить', !!paidBuy, '');
  if (paidBuy) {
    const gemsNow = useApp.getState().profiles[0].gems;
    click(paidBuy);
    await sleep(30);
    check('покупка звуков спрашивает подтверждение', has(`Купить звуки «${paidSound.title}»`), '');
    click(btnText(`Купить за 💎${paidSound.price}`));
    await sleep(50);
    const soundBought = useApp.getState().profiles[0];
    check(
      'покупка звуков списывает кристаллы, открывает и включает набор',
      soundBought.gems === gemsNow - paidSound.price && !!soundBought.shop?.soundOwned?.includes(paidSound.id) && soundBought.shop?.soundPack === paidSound.id,
      `gems=${soundBought.gems}, pack=${soundBought.shop?.soundPack}`,
    );
    check('повторная покупка звуков не списывает кристаллы', useApp.getState().buySoundPack(paidSound.id) === false, '');
  }
  // Возвращаем как было: остальные проверки магазина считают кристаллы
  useApp.setState((s) => ({
    profiles: s.profiles.map((p) => (p.id === s.activeId ? { ...p, gems: gemsBeforeSound, shop: { ...p.shop!, soundOwned: [...STARTER_SOUND_IDS], soundPack: 'classic' } } : p)),
  }));
  await sleep(30);

  // «Мои покупки»: примерочная и коллекция музыки (единственный вход — полка)
  click(Array.from(document.querySelectorAll('.shop-seg button')).find((b) => (b.textContent ?? '').includes('Мои покупки'))!);
  await sleep(30);
  check('покупки: примерочная с БУком', has('мой наряд'), '');
  check(
    'покупки: примерочная не дублирует состояние коллекции текстом',
    !(document.querySelector('.shop-stage')?.textContent ?? '').includes('Пока без обновок'),
    document.querySelector('.shop-stage')?.textContent ?? '',
  );
  // 0.32.1: пустые секции не рисуются — вместо четырёх «Пока пусто» у новичка
  // одно приглашение в витрину. Проверяем на честно пустом профиле: временно
  // снимаем стартовые мелодии и звуки, потом возвращаем.
  const shopBeforeEmpty = useApp.getState().profiles[0].shop!;
  useApp.setState((s) => ({
    profiles: s.profiles.map((p) => (p.id === s.activeId ? { ...p, shop: { ...p.shop!, owned: [], musicOwned: [], soundOwned: [] } } : p)),
  }));
  await sleep(60);
  check(
    'покупки новичка: одна карточка «Пока ничего не куплено» вместо стены пустоты',
    (document.querySelector('.shop-empty')?.textContent ?? '').includes('Пока ничего не куплено') &&
      Array.from(document.querySelectorAll('.screen section, .shop-empty')).filter((s) => /Пока пусто|Пока ни одного/.test(s.textContent ?? '')).length === 0,
    Array.from(document.querySelectorAll('.screen section')).map((s) => s.getAttribute('aria-label')).join(' | '),
  );
  const emptySections = Array.from(document.querySelectorAll('.screen section')).map((s) => s.getAttribute('aria-label'));
  check(
    'пустые «Наряды», «Костюмы» и «Музыка» не рисуются, «Техника» и «Звуки» на месте',
    !emptySections.includes('Наряды') && !emptySections.includes('Костюмы') && !emptySections.includes('Музыка') &&
      emptySections.includes('Техника') && emptySections.includes('Звуки'),
    emptySections.join(' | '),
  );
  check(
    'в покупках секции без повтора «Мои»',
    !has('Мои наряды') && !has('Моя техника') && !has('Мои костюмы') && !has('Моя музыка'),
    body().slice(0, 160),
  );
  const toVitrina = Array.from(document.querySelectorAll('.shop-empty button')).find((b) => (b.textContent ?? '').includes('В витрину')) as HTMLButtonElement | undefined;
  check('из пустых покупок есть кнопка «В витрину»', !!toVitrina, '');
  if (toVitrina) {
    click(toVitrina);
    await sleep(40);
    check('кнопка возвращает на витрину', !!document.querySelector('.shop-cats .chip'), '');
  }
  // Возвращаем покупки как были и снова открываем «Мои покупки» для музыки.
  useApp.setState((s) => ({
    profiles: s.profiles.map((p) => (p.id === s.activeId ? { ...p, shop: shopBeforeEmpty } : p)),
  }));
  await sleep(60);
  click(Array.from(document.querySelectorAll('.shop-seg button')).find((b) => (b.textContent ?? '').includes('Мои покупки'))!);
  await sleep(40);
  check(
    'после покупки секция появляется: «Музыка» снова видна',
    Array.from(document.querySelectorAll('.screen section')).some((s) => s.getAttribute('aria-label') === 'Музыка'),
    Array.from(document.querySelectorAll('.screen section')).map((s) => s.getAttribute('aria-label')).join(' | '),
  );
  click(Array.from(document.querySelectorAll('.shop-seg button')).find((b) => (b.textContent ?? '').includes('Витрина'))!);
  await sleep(30);
  click(Array.from(document.querySelectorAll('.shop-cats .chip')).find((c) => (c.textContent ?? '').includes('Наряды'))!);
  await sleep(30);
  check('герой-секция видна на витрине нарядов', !!document.querySelector('.shop-hero'), '');
  check('герой показывает ближайшую цель', has('Ближайшая цель'), '');

  // Мечты 🤍: сердечко добавляет товар в вишлист
  const wishItem = SHOP_ITEMS.find((i) => i.id === 'scarf')!;
  const scarfCard = Array.from(document.querySelectorAll('.shop-item')).find((c) => (c.textContent ?? '').includes(wishItem.title));
  const heartBtn = scarfCard?.querySelector('.shop-heart') as HTMLButtonElement | null;
  check('сердечко есть на карточке наряда', !!heartBtn, '');
  if (heartBtn) {
    click(heartBtn);
    await sleep(40);
    check('товар добавлен в wishlist профиля', (useApp.getState().profiles[0].shop?.wishlist ?? []).includes('scarf'), '');
    check('сердечко подсвечено', heartBtn.classList.contains('on'), '');
  }

  const gemsInShop = useApp.getState().profiles[0].gems;
  const buyBtn = Array.from(document.querySelectorAll('.shop-item:not(.music-item):not(.costume-card) button'))
    .find((button) => (button.textContent ?? '').includes('Купить')) as HTMLButtonElement | undefined;
  check('есть доступная покупка', !!buyBtn, `кристаллов: ${gemsInShop}`);
  if (buyBtn) {
    const title = buyBtn.closest('.shop-item')?.querySelector('.shop-title')?.textContent ?? '';
    click(buyBtn);
    await sleep(50);
    check('покупка спрашивает подтверждение', has('Купить «'), body().slice(0, 160));
    click(btnText('Купить за'));
    await sleep(80);
    const p = useApp.getState().profiles[0];
    check(
      `кристаллы списаны, вещь куплена (${gemsInShop} → ${p.gems}, ${title})`,
      p.gems < gemsInShop && (p.shop?.owned.length ?? 0) === 1,
      '',
    );
    check('купленная вещь сразу надета', Object.keys(p.shop?.equipped ?? {}).length === 1, '');
    check('тост о покупке показан', has('твой!'), '');
    check('кнопка стала «Надето»', has('Надето ✓'), '');
    // снимаем и надеваем обратно — проверяем, что состояние гардероба живое
    click(btnText('Надето')!);
    await sleep(50);
    check('снятие аксессуара работает', Object.keys(useApp.getState().profiles[0].shop?.equipped ?? {}).length === 0, '');
    click(btnText('Надеть')!);
    await sleep(50);
    check('надевание обратно работает', Object.keys(useApp.getState().profiles[0].shop?.equipped ?? {}).length === 1, '');
    // Купленное живёт в гардеробе, сгруппированное по слотам
    click(Array.from(document.querySelectorAll('.shop-seg button')).find((b) => (b.textContent ?? '').includes('Мои покупки'))!);
    await sleep(30);
    check('купленная вещь живёт в гардеробе по слотам', has('Головные уборы'), '');
    check('секция «Мечты 🤍» отображает отложенную вещь', has('Мечты 🤍') && has(wishItem.title) && !!document.querySelector('.wishlist-card'), '');
    click(Array.from(document.querySelectorAll('.shop-seg button')).find((b) => (b.textContent ?? '').includes('Витрина'))!);
    await sleep(30);

    // ── Тюнинг цвета купленной вещи: 1 💎 за оттенок, дальше бесплатно ────────
    // Палитра живёт в подробной карточке (sheet), а не на витрине:
    // сначала вещь — потом краски.
    // 0.89.0: у вещи с фотографией палитры нет (снимок не перекрасить).
    // Фотосерия нарядов растёт каждый релиз, поэтому вещь для проверки красок
    // выбираем по правилу, а не по id: первая вещь в каталоге, у которой есть
    // палитра и нет фото. Иначе тест ломается на каждом новом снимке.
    const tintItem = SHOP_ITEMS.find((i) => TINT_PALETTES[i.id] && !hasProductPhoto(i.id) && !hasOutfitPair(i.id));
    if (!tintItem) throw new Error('тюнинг: не осталось вещей с палитрой и без фото — проверку красок нужно переписать');
    useApp.setState((s) => ({
      profiles: s.profiles.map((p) => (p.id === s.activeId
        ? { ...p, shop: { ...p.shop!, owned: [...p.shop!.owned, tintItem.id] } }
        : p)),
    }));
    await sleep(40);
    const itemId = tintItem.id;
    const itemTitle = tintItem.title;
    const paids = () => Array.from(document.querySelectorAll('.tint-swatch')) as HTMLButtonElement[];
    const cardSvg = () =>
      Array.from(document.querySelectorAll('.shop-item'))
        .find((el) => (el.textContent ?? '').includes(itemTitle))
        ?.querySelector('.shop-icon svg')?.innerHTML ?? '';
    const vitrinaCard = (title: string) =>
      Array.from(document.querySelectorAll('.shop-item:not(.music-item):not(.costume-card)'))
        .find((el) => (el.textContent ?? '').includes(title));
    const closeSheet = () => {
      document.querySelector('.shop-sheet-veil')?.click();
    };
    // У некупленной вещи палитры нет даже в sheet: берём другую вещь с
    // палитрой и без фото, которой у профиля точно нет.
    const unownedTintItem = SHOP_ITEMS.find((i) => i !== tintItem && TINT_PALETTES[i.id] && !hasProductPhoto(i.id) && !hasOutfitPair(i.id));
    if (!unownedTintItem) throw new Error('тюнинг: нет второй вещи с палитрой и без фото для проверки «не куплено»');
    click(vitrinaCard(unownedTintItem.title)!);
    await sleep(30);
    check('тюнинг: у некупленной вещи палитры нет', !buttons().some((b) => (b.textContent ?? '').includes('🎨 Цвет')), '');
    closeSheet();
    await sleep(30);
    check('тюнинг: карточка купленной вещи открывает sheet', !!vitrinaCard(itemTitle), '');
    click(vitrinaCard(itemTitle)!);
    await sleep(30);
    check('тюнинг: в sheet купленной вещи есть «🎨 Цвет»', !!btnText('🎨 Цвет'), '');
    click(btnText('🎨 Цвет'));
    await sleep(60);
    check('тюнинг: палитра из 4 оттенков', paids().length === 4, `кружков: ${paids().length}`);
    check(
      'тюнинг: у трёх новых оттенков видна цена 💎1',
      paids().filter((s) => (s.textContent ?? '').includes('💎1')).length === 3,
      '',
    );
    const gemsBeforeTint = useApp.getState().profiles[0].gems;
    click(paids()[1]); // первый платный оттенок
    await sleep(50);
    check('тюнинг: новый оттенок спрашивает подтверждение', has('Открыть цвет'), body().slice(0, 160));
    click(btnText('Открыть за'));
    await sleep(80);
    let tuned = useApp.getState().profiles[0];
    const extraTint = TINT_PALETTES[itemId].extra[0];
    check(
      `тюнинг: за новый оттенок списан ровно 1 💎 (${gemsBeforeTint} → ${tuned.gems})`,
      tuned.gems === gemsBeforeTint - TINT_PRICE,
      '',
    );
    check(
      'тюнинг: выбранный оттенок записан в профиль',
      tuned.shop?.tuning?.current?.[itemId] === extraTint.id,
      JSON.stringify(tuned.shop?.tuning),
    );
    check(
      'тюнинг: карточка вещи перекрашена в выбранный цвет',
      cardSvg().includes(extraTint.colors[0]),
      `${extraTint.colors[0]} не найден в SVG`,
    );
    // Повторный тап по тому же оттенку — без списания (двойной тап не стоит денег)
    click(paids()[1]);
    await sleep(50);
    tuned = useApp.getState().profiles[0];
    check('тюнинг: повторный выбор того же цвета ничего не списывает', tuned.gems === gemsBeforeTint - TINT_PRICE, '');
    // База и уже открытые оттенки — бесплатны
    click(paids()[0]);
    await sleep(50);
    tuned = useApp.getState().profiles[0];
    check(
      'тюнинг: возврат к базовому цвету бесплатен и не хранится',
      tuned.gems === gemsBeforeTint - TINT_PRICE && !tuned.shop?.tuning?.current?.[itemId],
      JSON.stringify(tuned.shop?.tuning),
    );
    click(paids()[1]);
    await sleep(50);
    tuned = useApp.getState().profiles[0];
    check(
      'тюнинг: переключение на открытый оттенок бесплатно',
      tuned.gems === gemsBeforeTint - TINT_PRICE && tuned.shop?.tuning?.current?.[itemId] === extraTint.id,
      '',
    );
    // Без кристаллов краска не открывается: подсказка вместо списания
    useApp.setState((s) => ({
      profiles: s.profiles.map((p) => (p.id === s.activeId ? { ...p, gems: 0 } : p)),
    }));
    await sleep(30);
    click(paids()[2]);
    await sleep(50);
    tuned = useApp.getState().profiles[0];
    const unlockedNow = Object.values(tuned.shop?.tuning?.unlocked ?? {}).flat().length;
    check(
      'тюнинг: без кристаллов цвет не меняется и есть подсказка',
      tuned.gems === 0 && unlockedNow === 1 && has('нужен ещё 1 💎'),
      `кристаллов: ${tuned.gems}, открыто: ${unlockedNow}`,
    );
    // Возвращаем баланс как был: он нужен следующим блокам смоука
    useApp.setState((s) => ({
      profiles: s.profiles.map((p) => (p.id === s.activeId ? { ...p, gems: gemsBeforeTint } : p)),
    }));
    await sleep(30);
    click(btnText('🎨 Готово'));
    await sleep(40);
    closeSheet();
    await sleep(30);
  }

  // ── Сдача купленной вещи обратно (sell-back, 0.24.0) ────────
  // Ставки — docs/proposals/trade-in.md, вариант B: наряды 50%,
  // техника 30%. Цена сдачи строго меньше цены покупки, поэтому
  // цикл «купил → сдал» теряет кристаллы: фарм невозможен.
  {
    // Блок ангара вернул профиль к состоянию до покупки техники —
    // переключаемся на полку «Техника» и докупаем Болид, чтобы
    // было что сдать.
    click(Array.from(document.querySelectorAll('.shop-cats .chip')).find((c) => (c.textContent ?? '').includes('Техника'))!);
    await sleep(30);
    const racer = ITEM_BY_ID['car-racer'];
    useApp.setState((s) => ({
      profiles: s.profiles.map((p) => (p.id === s.activeId ? { ...p, gems: Math.max(p.gems, racer.price) } : p)),
    }));
    await sleep(30);
    check('трейд-ин: подготовка — Болид докуплен', useApp.getState().buyItem('car-racer'), '');
    // Краска вещи: при продаже открытые оттенки обнуляются
    // (допы не повышают цену сдачи — как в реальности).
    useApp.setState((s) => ({
      profiles: s.profiles.map((p) => (p.id === s.activeId
        ? { ...p, shop: { ...p.shop!, tuning: { current: { 'car-racer': 'violet' }, unlocked: { 'car-racer': ['violet'] } } } }
        : p)),
    }));
    await sleep(30);

    const carCard = Array.from(document.querySelectorAll('.shop-item.toy-item'))
      .find((el) => (el.textContent ?? '').includes('Болид'));
    if (carCard) click(carCard);
    await sleep(30);
    check('трейд-ин: в sheet купленной вещи кнопка сдачи с ценой', !!btnText('Сдать обратно · +10 💎'), body().slice(0, 120));
    document.querySelector('.shop-sheet-veil')?.click();
    await sleep(30);

    const gemsBeforeSell = useApp.getState().profiles[0].gems;
    const refund = sellPrice(racer);
    check('трейд-ин: цена сдачи строго меньше цены покупки', refund === 10 && refund < racer.price, `вернёт ${refund} 💎`);
    check('трейд-ин: сдать некупленное нельзя', !useApp.getState().sellItem('scarf'), '');
    const soldOk = useApp.getState().sellItem('car-racer');
    await sleep(30);
    const afterSell = useApp.getState().profiles[0];
    check('трейд-ин: вещь сдана, часть кристаллов вернулась', soldOk && afterSell.gems === gemsBeforeSell + refund, `${gemsBeforeSell} → ${afterSell.gems}`);
    check('трейд-ин: вещь ушла из гардероба и с подиума', !afterSell.shop?.owned.includes('car-racer') && !afterSell.shop?.equipped?.toy, JSON.stringify(afterSell.shop));
    check('трейд-ин: краски вещи обнулены', !afterSell.shop?.tuning?.current?.['car-racer'] && !afterSell.shop?.tuning?.unlocked?.['car-racer'], JSON.stringify(afterSell.shop?.tuning));
    check('трейд-ин: сдать вторично нельзя', !useApp.getState().sellItem('car-racer'), '');
    check('трейд-ин: витрина снова предлагает купить вещь', hasGem(35), gemAmounts().join(' / '));
  }
  const expensive = buttons().find((b) => (b.textContent ?? '').includes('Ещё') && b.className.includes('btn'));
  check('на дорогие вещи кнопка показывает, сколько не хватает', !!expensive, '');

  // ── Рост БУКа (пункт 5) ───────────────────────────────────────────────────
  // Ступень роста живёт в примерочной гардероба
  click(Array.from(document.querySelectorAll('.shop-seg button')).find((b) => (b.textContent ?? '').includes('Мои покупки'))!);
  await sleep(30);
  check('магазин показывает ступень роста', /Птенец|Ученик|Знаток|Магистр/.test(body()), body().slice(0, 300));
  const before = useApp.getState().profiles[0];
  const stageBefore = growthStage(masteredCount(before)).index;
  // осваиваем слова до порога первой ступени (12) — уроки доходят до s≥90
  const ids = WORDS.slice(0, 12).map((w) => w.id);
  for (const id of ids) {
    // s растёт на 15 за верный ответ без подсказки; 90 («освоено») — с 6-го раза
    for (let i = 0; i < 7; i++) useApp.getState().answer(id, 5);
  }
  await sleep(80);
  const after = useApp.getState().profiles[0];
  const stageAfter = growthStage(masteredCount(after)).index;
  check(
    `БУК растёт по освоенным словам (освоено ${masteredCount(before)} → ${masteredCount(after)}, ступень ${stageBefore} → ${stageAfter})`,
    stageAfter > stageBefore,
    '',
  );
  check('в магазине виден текст про рост', /Освоено \d+ слов/.test(body()), '');

  // ── Полоска серии дней на главной (пункт 5) ───────────────────────────────
  const homeTab = buttons().find((b) => (b.textContent ?? '').includes('Уроки') && b.className.includes('tab'));
  click(homeTab!);
  await sleep(80);
  // ── Шапка «Уроков»: три блока, два действия (0.33.0) ────────────────────
  // docs/proposals/home-menu.md. Главный счётчик — 💎: кристаллы ребёнок
  // понимает и тратит. 🔥 из шапки ушёл в меню ☰, где у него есть слова.
  // ☰ заменил 🎁: в меню не только награды, но и покупки, ангар, друг и профиль.
  check(
    'в шапке главной кристаллы — главный счётчик',
    !!document.querySelector('.topbar .topbar-stat.gems [data-icon="crystal"]'),
    document.querySelector('.topbar')?.innerHTML.slice(0, 200) ?? '',
  );
  check(
    'огня и подарка в шапке больше нет',
    !document.querySelector('.topbar [data-stat="streak"]') && !document.querySelector('.topbar .rewards-btn'),
    document.querySelector('.topbar')?.innerHTML.slice(0, 160) ?? '',
  );
  check(
    'на главной задания — полоской, а награды — за меню ☰, а не полотном',
    !!document.querySelector('[data-menu-trigger]') &&
      !!document.querySelector('[data-quest-strip]') &&
      !document.querySelector('.quest'),
    '',
  );
  const topbarButtons = Array.from(document.querySelectorAll('.topbar button'));
  check(
    'в шапке главной ровно два действия: профиль и меню',
    topbarButtons.length === 2,
    topbarButtons.map((b) => b.getAttribute('aria-label') ?? b.className).join(' | '),
  );
  const profileBtn = document.querySelector('.topbar .profile-btn') as HTMLButtonElement | null;
  check(
    'профиль в шапке — одна кнопка с аватаром и именем',
    !!profileBtn && (profileBtn.getAttribute('aria-label') ?? '').startsWith('Профиль:') && !!profileBtn.querySelector('.topbar-name'),
    profileBtn?.getAttribute('aria-label') ?? 'нет кнопки',
  );
  check(
    'кристаллы — тихий статус без рамок-пилюль',
    !!document.querySelector('.topbar [data-stat="gems"]') && !document.querySelector('.topbar .stat-pill'),
    document.querySelector('.topbar')?.innerHTML.slice(0, 120) ?? '',
  );

  // Меню ☰: один уровень; статусы названы без повторного объяснения механики.
  click(document.querySelector('[data-menu-trigger]'));
  await sleep(60);
  const menu = document.querySelector('.home-menu');
  check('☰ открывает меню', !!menu, body().slice(0, 200));
  check(
    'статус серии назван без пояснения очевидной механики',
    (menu?.textContent ?? '').includes('Серия') && !(menu?.textContent ?? '').includes('занимаешься'),
    menu?.querySelector('.menu-status')?.textContent ?? '',
  );
  check(
    'статус кристаллов назван без пояснения-дубля',
    (menu?.textContent ?? '').includes('Кристаллы') && !(menu?.textContent ?? '').includes('Тратятся в БУКе'),
    menu?.querySelector('.menu-status')?.textContent ?? '',
  );
  check(
    'в меню есть награды, покупки, «Мой мир», класс, смена ученика, поддержка и отправка ссылки',
    ['support', 'rewards', 'purchases', 'world', 'class', 'profiles', 'share'].every(
      (key) => !!menu?.querySelector(`[data-menu="${key}"]`),
    ),
    Array.from(menu?.querySelectorAll('[data-menu]') ?? []).map((n) => n.getAttribute('data-menu')).join(' | '),
  );
  check(
    'поддержка разработчика заметно выделена и помечена как добровольная для родителей',
    !!menu?.querySelector('.menu-support-row[data-menu="support"]') &&
      (menu?.querySelector('[data-menu="support"]')?.getAttribute('aria-label') ?? '').includes('Для родителей') &&
      (menu?.querySelector('[data-menu="support"]')?.textContent ?? '').includes('добровольно'),
    menu?.querySelector('[data-menu="support"]')?.textContent ?? 'нет пункта поддержки',
  );
  check(
    'поделиться приложением можно прямо из меню',
    (menu?.querySelector('[data-menu="share"]')?.textContent ?? '').includes('QR-код или ссылка'),
    menu?.querySelector('[data-menu="share"]')?.textContent ?? 'нет пункта отправки',
  );

  // Версия релиза (0.65.0) — внизу меню, чтобы ребёнок мог назвать её взрослому.
  const versionLine = menu?.querySelector('[data-menu-version]') as HTMLElement | null;
  check(
    'в меню ☰ видна версия приложения (ребёнок может назвать релиз)',
    !!versionLine &&
      /СЛОВО 2\.0 · версия \S+/.test(versionLine.textContent ?? '') &&
      (versionLine.textContent ?? '').includes(import.meta.env.VITE_APP_VERSION),
    versionLine?.textContent ?? 'нет строки версии',
  );

  // Число на наградах — не украшение, а обещание. В начале дня заданий ещё
  // нет, поэтому числа нет — и это тоже обещание: забирать нечего.
  const rewardsBadge = menu?.querySelector('.menu-count');
  check(
    'у наград число вместо точки, пусто — без числа',
    rewardsBadge ? /^([1-9]|9\+)$/.test(rewardsBadge.textContent ?? '') : true,
    rewardsBadge?.textContent ?? 'числа нет',
  );

  // Число запоминаем до перехода: в листе меню уже закрыто.
  const badgeCount = rewardsBadge ? Number(rewardsBadge.textContent) : 0;

  // Награды из меню открывают тот же лист, что раньше открывал 🎁.
  click(menu?.querySelector('[data-menu="rewards"]'));
  await sleep(60);
  const sheet = document.querySelector('.rewards-sheet')!;
  check('награды из меню открывают лист наград', !!sheet, body().slice(0, 200));
  const sheetButtons = Array.from(sheet?.querySelectorAll('button') ?? []);
  const claimCount = sheetButtons.filter((b) => (b.textContent ?? '').includes('Забрать')).length;
  const dailyChest = sheetButtons.some((b) => (b.textContent ?? '').includes('Открыть сундук БУКа')) ? 1 : 0;
  // Бонусных сундуков может ждать несколько, а кнопка в листе одна: «ещё N»
  // лист пишет словами — сверяем число в меню с суммой всех ожидающих наград.
  const bonusMatch = (sheet.textContent ?? '').match(/бонусных готово: (\d+)/);
  const sheetRewards = claimCount + dailyChest + (bonusMatch ? Number(bonusMatch[1]) : 0);
  check(
    'число у наград совпадает с числом наград, которые ждут в листе',
    sheetRewards === badgeCount,
    `в меню ${badgeCount}, в листе ${sheetRewards} (задания ${claimCount}, сундук ${dailyChest}, бонусные ${bonusMatch?.[1] ?? 0})`,
  );
  click(btn((b) => (b.getAttribute('aria-label') ?? '') === 'Закрыть'));
  await sleep(40);

  // «Мои покупки» и «Мой мир» из меню ведут в соответствующие части БУКа.
  await openHomeMenu();
  click(document.querySelector('[data-menu="purchases"]'));
  await sleep(80);
  const wardrobeTab = document.querySelector('.shop-seg button[aria-selected="true"]');
  check(
    '«Мои покупки» из меню открывают БУК на сегменте покупок',
    !!wardrobeTab && (wardrobeTab.textContent ?? '').includes('Мои покупки') && !document.querySelector('.home-menu'),
    body().slice(0, 200),
  );
  click(buttons().find((b) => (b.textContent ?? '').includes('БУК') && b.className.includes('tab')));
  await sleep(80);
  const shopTabSelect = document.querySelector('.shop-seg button[aria-selected="true"]');
  check(
    'нижняя вкладка «БУК» возвращает на витрину',
    !!shopTabSelect && (shopTabSelect.textContent ?? '').includes('Витрина'),
    body().slice(0, 160),
  );
  click(homeTab!);
  await sleep(80);
  await openHomeMenu();
  click(document.querySelector('[data-menu="world"]'));
  await sleep(80);
  check(
    '«Мой мир» из меню открывает полную карту коллекции внутри БУКа',
    !!document.querySelector('.my-world') && !!document.querySelector('.collection-map'),
    body().slice(0, 200),
  );
  click(buttons().find((b) => (b.textContent ?? '').includes('Назад в БУК')));
  await sleep(50);
  click(homeTab!);
  await sleep(80);

  // Класс (0.33.0): пилюли над героем больше нет — лист открывается из меню,
  // а на экране класс называет заголовок «Мой путь · N класс».
  check(
    'на главной нет отдельной пилюли класса',
    !document.querySelector('.class-pill') && !!document.querySelector('.home-path-class'),
    document.querySelector('.home-path-title')?.textContent ?? '',
  );
  await openHomeMenu();
  const classRow = document.querySelector('[data-menu="class"]');
  check(
    'в меню есть строка класса с названием',
    !!classRow && /\d класс/.test(classRow.textContent ?? ''),
    classRow?.textContent ?? '',
  );
  click(classRow);
  await sleep(60);
  check(
    'класс из меню открывает лист «Какой класс учим?»',
    !!document.querySelector('.class-sheet') &&
      document.querySelectorAll('.class-card').length > 1,
    body().slice(0, 160),
  );
  click(btn((b) => (b.getAttribute('aria-label') ?? '') === 'Закрыть'));
  await sleep(40);

  // Кнопки меню: приложение можно отправить ссылкой/QR, а донат остаётся за взрослым.
  await openHomeMenu();
  click(document.querySelector('[data-menu="share"]'));
  await sleep(60);
  check(
    '«Поделиться приложением» в меню открывает QR и ссылку',
    !!document.querySelector('.invite-sheet') && !!document.querySelector('.invite-qr-art') && !!document.querySelector('.invite-link'),
    body().slice(0, 180),
  );
  click(btn((b) => (b.getAttribute('aria-label') ?? '') === 'Закрыть'));
  await sleep(40);

  await openHomeMenu();
  click(document.querySelector('[data-menu="support"]'));
  await sleep(80);
  check(
    'донат из меню сразу открывает раздел для родителей с раскрытым QR',
    !document.querySelector('.home-menu') && !!document.querySelector('.parent-screen') &&
      !!document.querySelector('.support-developer[open] .support-developer-qr'),
    document.querySelector('.support-developer')?.outerHTML.slice(0, 240) ?? body().slice(0, 180),
  );
  click(buttons().find((b) => (b.textContent ?? '').includes('Уроки') && b.className.includes('tab')));
  await sleep(60);

  // «Позови друга» (0.32.1): ссылка — в один тап прямо с главной, тихой
  // строкой под героем. Раньше 🤝 прятался за кнопкой профиля, а на экране
  // профилей — ещё и под формой нового ученика: «найти сложно».
  const homeInvite = document.querySelector('.invite-cta') as HTMLButtonElement | null;
  check(
    'на главной есть «Позови друга» — один тап без меню',
    !!homeInvite && (homeInvite.textContent ?? '').includes('Позови друга'),
    document.querySelector('.home-hero')?.parentElement?.textContent?.slice(0, 120) ?? '',
  );
  if (homeInvite) {
    click(homeInvite);
    await sleep(60);
    check(
      'лист «Позови друга» открывается прямо с главной (QR и ссылка)',
      !!document.querySelector('.invite-qr-art') && !!document.querySelector('.invite-link') && !!document.querySelector('.invite-sheet'),
      body().slice(0, 200),
    );
    click(btn((b) => (b.getAttribute('aria-label') ?? '') === 'Закрыть'));
    await sleep(40);
    check('лист закрывается, главная на месте', !document.querySelector('.invite-sheet') && has('Мой путь'), '');
  }

  // Экран «Кто будет учиться?» (0.33.0): сначала выбор ученика и одна главная
  // кнопка «Продолжить ▶», а форма нового ученика — за «+ Новый ученик».
  // Раньше форма была раскрыта всегда и заканчивалась кнопкой «Начать
  // учиться»: взрослый, пришедший сменить класс, начинал заводить второго.
  click(document.querySelector('.topbar .profile-btn') as HTMLButtonElement);
  await sleep(60);
  const inviteBtn = btn((b) => (b.textContent ?? '').includes('Позови друга'));
  check('экран профилей не дублирует «Позови друга» с главной', !inviteBtn, '');
  check(
    'экран профилей открывается без формы нового ученика',
    !Array.from(document.querySelectorAll('h3')).some((h) => (h.textContent ?? '').includes('Новый ученик')),
    body().slice(0, 200),
  );
  check(
    'на экране есть одна главная кнопка «Продолжить ▶»',
    !!btn((b) => (b.textContent ?? '').includes('Продолжить ▶')),
    Array.from(document.querySelectorAll('.screen > .btn')).map((b) => (b.textContent ?? '').trim()).join(' | '),
  );
  const newStudentBtn = btn((b) => (b.textContent ?? '').includes('+ Новый ученик'));
  check('новый ученик — за кнопкой «+ Новый ученик»', !!newStudentBtn, '');
  click(newStudentBtn);
  await sleep(60);
  const newStudentForm = Array.from(document.querySelectorAll('h3')).find((h) => (h.textContent ?? '').includes('Новый ученик'));
  check('«+ Новый ученик» раскрывает форму', !!newStudentForm, body().slice(0, 200));
  check(
    'форма нового ученика не добавляет повторную кнопку приглашения',
    !btn((b) => (b.textContent ?? '').includes('Позови друга')),
    '',
  );
  check(
    'в форме нового ученика кнопка «Создать ученика», а не «Начать учиться»',
    !!btn((b) => (b.textContent ?? '').trim() === 'Создать ученика') && !has('Начать учиться'),
    body().slice(0, 240),
  );
  check(
    'пока форма открыта, главной кнопки «Продолжить» нет',
    !btn((b) => (b.textContent ?? '').includes('Продолжить ▶')),
    '',
  );
  click(btn((b) => (b.textContent ?? '').trim() === 'Отмена'));
  await sleep(60);
  // Тап по карточке и «Продолжить ▶» ведут на уроки выбранного ученика.
  const continueBtn = btn((b) => (b.textContent ?? '').includes('Продолжить ▶'));
  check(
    'после отмены форма снова закрыта',
    !Array.from(document.querySelectorAll('h3')).some((h) => (h.textContent ?? '').includes('Новый ученик')) &&
      !!continueBtn,
    body().slice(0, 200),
  );
  // Карандаш у профиля — тот самый путь «поменять класс текущему ученику».
  // Он открывает «Изменить профиль» и не предлагает создать ещё одного.
  click(document.querySelector('.profile-card .profile-card-edit'));
  await sleep(60);
  const editHeading = Array.from(document.querySelectorAll('h3')).find((h) =>
    (h.textContent ?? '').includes('Изменить профиль'),
  );
  check('карандаш открывает «Изменить профиль»', !!editHeading, body().slice(0, 200));
  check(
    'в форме редактирования выбран текущий класс',
    !!document.querySelector('.class-form-btn[aria-pressed="true"]') &&
      !!btn((b) => (b.textContent ?? '').trim() === 'Сохранить'),
    body().slice(0, 240),
  );
  check(
    'в форме редактирования нет кнопки «Создать ученика»',
    !btn((b) => (b.textContent ?? '').trim() === 'Создать ученика'),
    '',
  );
  const profilesInEdit = useApp.getState().profiles.length;
  click(btn((b) => (b.textContent ?? '').trim() === 'Сохранить'));
  await sleep(60);
  check(
    'сохранение профиля не создаёт второго ученика',
    useApp.getState().profiles.length === profilesInEdit &&
      !Array.from(document.querySelectorAll('h3')).some((h) => (h.textContent ?? '').includes('Изменить профиль')),
    `было ${profilesInEdit}, стало ${useApp.getState().profiles.length}`,
  );

  // «Продолжить ▶» — главное действие экрана: запускает уроки выбранного
  // ученика и закрывает экран, а не создаёт нового.
  const profilesBefore = useApp.getState().profiles.length;
  click(btn((b) => (b.textContent ?? '').includes('Продолжить ▶')));
  await sleep(80);
  check(
    '«Продолжить ▶» возвращает на уроки выбранного ученика',
    !has('Кто будет учиться?') && has('Мой путь') && useApp.getState().profiles.length === profilesBefore,
    body().slice(0, 160),
  );
  click(buttons().find((b) => (b.textContent ?? '').includes('Уроки') && b.className.includes('tab')));
  await sleep(60);

  // ── Настройка размера урока в разделе «Родителям» ─────────────────────────
  const parentTab = buttons().find((b) => (b.textContent ?? '').includes('Родителям') && b.className.includes('tab'));
  click(parentTab!);
  await sleep(60);
  check('раздел родителей открывается', has('Раздел для взрослых'), '');
  const equation = document.body.textContent?.match(/(\d+) × (\d+) = \?/);
  const answerInput = document.querySelector('input.input') as HTMLInputElement | null;
  if (equation && answerInput) {
    const value = String(Number(equation[1]) * Number(equation[2]));
    const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setValue?.call(answerInput, value);
    answerInput.dispatchEvent(new window.Event('input', { bubbles: true }));
    await sleep(20);
    click(btnText('Войти'));
    await sleep(60);
  }
  // Разделы разложены по вкладкам: занятия и вид — в «Настройках».
  check('родительский раздел открывается кратким прогрессом', has('Прогресс по словам') && has('освоено'), body().slice(0, 160));
  await openParentSection('Настройки');
  check('родителям видны режимы размера урока', has('Размер урока') && has('Короткий · 12') && has('Обычный · 16') && has('Полный · 20'), '');
  // Настройка «Сова БУК»: проверяем, что «не показывать» убирает плавающего БУКа
  // с главной, а «везде» возвращает (замечание 2026-10-04).
  check('родителям видна настройка «Сова БУК»', has('Сова БУК') && has('на главной') && has('не показывать'), '');
  click(btnText('не показывать'));
  await sleep(40);
  check('«не показывать» убирает БУКа с главной', document.querySelectorAll('.app > .mascot').length === 0, '');
  click(btnText('везде'));
  await sleep(40);
  check('«везде» возвращает БУКа', document.querySelectorAll('.app > .mascot').length === 1, '');
  const shortSize = btnText('Короткий · 12');
  if (shortSize) click(shortSize);
  await sleep(40);
  check('режим короткого урока меняется кнопкой', useApp.getState().profiles[0].lessonSize === 'short', '');

  // В режиме повторения карточки тоже должны уважать выбранный потолок.
  click(btnText('Уроки'));
  await sleep(50);
  const reviewStart = btnText('Пора повторить');
  if (reviewStart) {
    click(reviewStart);
    await sleep(60);
    const counter = document.querySelector('.stat-pill.tasks')?.textContent ?? '';
    const reviewLimit = Number(counter.split('/')[1]);
    check('режим повторения не превышает короткий лимит', Number.isFinite(reviewLimit) && reviewLimit <= 12, counter);
    // Замечание с айфона (2026-10-07, слово «ученик»): повторение открывалось
    // сразу заданием «напиши по памяти» со старой компактной подсказкой и
    // маленькой плитой. Теперь каждое слово встречает фотокарточка-напоминание.
    check(
      'режим повторения открывается фотокарточкой-напоминанием',
      !!document.querySelector('.task-intro .lesson-intro-card.wcard-photo') && !!btnText('Вспомнил'),
      document.querySelector('.task')?.className ?? '—',
    );
    const remembered = btnText('Вспомнил');
    if (remembered) {
      click(remembered);
      await sleep(80);
      check(
        'после напоминания — оцениваемое задание (слоги не отдельная карточка)',
        !!document.querySelector('.task-write') || !!document.querySelector('.task-fix'),
        document.querySelector('.task')?.className ?? '—',
      );
    }
  } else {
    check('режим повторения не превышает короткий лимит', true, 'повторять нечего');
  }

  // ── Церемония сундука: пропуск, фиксация чека и reduced motion ─────────────
  await runChestCeremonyChecks();
  await runChestSkinsUiChecks();
  await runParentUiChecks();
  await runListsChecks();

  // ── Задания дня: понятность и выполнимость (обратная связь 2026-09-29) ────
  await runQuestUiChecks();

  // ── Адаптация урока: интеграционные проверки (этап 2) ─────────────────────
  // Идут последними: блок сам управляет активным профилем, бюджетом и потолком,
  // поэтому не должен менять состояние под предыдущие сценарии.
  await runAdaptiveUiChecks();

  // ── Предтестовый аудит: UX, навигация, серия и обновления ─────────────────
  await runPretestAuditChecks();

  // ── Костюмные пазлы: урок → фрагмент → костюм (идея 2026-10-01) ───────────
  // Идут последними: блок создаёт собственный профиль и сеет пазлы.
  await runPuzzleUiChecks(playLesson);

  // Плавающий БУК: перетаскивание, сворачивание и тап (замечание 2026-10-04).
  await runFloatingMascotChecks();

  // Чат «Спроси БУКа» (0.87.0): дверь, чипы, память, потолок и уход в урок.
  await runBukChatChecks();

  // Помощник БУК в уроке: вопрос вместо ответа и тихое предложение помощи.
  await runBukLessonChecks();

  // Картинка в уроке: крупный резиновый снимок в знакомстве и адаптивная
  // подсказка в заданиях с клавиатурой — при сохранённом «экран не прокручивается».
  await runLessonArtChecks();

  // Пауза после ответа: отвеченная карточка остаётся на экране, полоса вердикта
  // показывает результат, награду и написание слова (замечание 2026-10-15).
  await runVerdictChecks();
  await runTypingChecks();

  // Чистота интерфейса: читаемость, тап-зоны и детские слова (0.66.0).
  runUiCleanupChecks();

  // Главная в один экран: «Дальше» и раскрывающийся путь (0.67.0).
  await runHomePathChecks();

  // Структурированный словарик: цвета по степени освоения, круговая диаграмма,
  // легенда цветов и итог по каждой колонке.
  await runDictionaryUiChecks();

  // «Передать приложение»: QR и ссылка для нового ученика (замечание 2026-10-14).
  await runShareAppChecks();

  // Тема: схема страницы, первый кадр и отличие перекраски браузера от темы.
  await runThemeChecks();

  // Диагностика запускается прямой ссылкой и читает хранилище, не раскрывая профиль.
  await runDiagnosticsRouteChecks();

  // Ручная проверка обновлений: кнопка в «Родителям» → «Приложение» и все
  // ответы сервис-воркера (есть новая / последняя / нет сети / нельзя проверить).
  await runUpdateCheckUiChecks();

  // Быстрый звук (0.29.0): тап — вкл/выкл музыки, долгое нажатие — тишина на
  // 15 минут; кнопка есть на всех экранах, кроме урока.
  await runQuickSoundChecks();

  // Классы 1–4: смена класса не сбрасывает опыт, товары и награды; путь,
  // герой и урок берутся из программы активного класса (0.27.0).
  await runClassChecks();

  // Карточка товара: крупная картинка без обрезки и этикетка под ней (0.76.0).
  await runShopCardChecks();

  // «Мой мир»: ставится только полученное, БУК в костюме стоит, а не летает.
  await runWorldUiChecks();
  await runBaseTourUiChecks();

  // Рейтинг: место игрока среди воображаемых соперников.
  await runRatingUiChecks();

  const failures = failureCount();
  console.log(failures ? `\n✗ ошибок: ${failures}` : '\n✓ все проверки пройдены');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error('тест упал:', e);
  process.exit(1);
});

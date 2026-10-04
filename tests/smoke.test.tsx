// Смоук-тест (npm run test:smoke): в jsdom проходит урок целиком «руками» —
// кликами по настоящим кнопкам — и проверяет то, что нельзя проверить сборкой:
// диалог выхода из урока, монотонную полоску прогресса, пометку отработки ошибки,
// экран результатов с целью дня, выдачу награды за задания дня и сундук.
import './setup';
import './adaptive.test';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../src/App';
import { body, btn, btnText, buttons, check, click, currentWord, failureCount, has, sleep } from './ui-helpers';
import { runAdaptiveUiChecks } from './adaptive-ui.test';
import { runQuestUiChecks } from './quests-ui.test';
import { runInstallHintChecks } from './install-hint.test';
import { runChestCeremonyChecks } from './chest-ceremony-ui.test';
import { runPretestAuditChecks } from './pretest-audit.test';
import { runPuzzleUiChecks } from './puzzles-ui.test';
import { runDiagnosticsRouteChecks } from './diagnostics-ui.test';
import { runFloatingMascotChecks } from './mascot-ui.test';
import { LESSONS, WORDS } from '../src/content/words';
import { buildLesson, lessonCardLimit } from '../src/engine/scheduler';
import { dayKey, dayPlan, useApp } from '../src/state/store';
import { questTitle } from '../src/engine/quests';
import { growthStage } from '../src/engine/shop';
import { masteredCount } from '../src/state/store';

// Общая обвязка (клики, поиск кнопок, счётчик проверок) — в tests/ui-helpers.ts:
// её же использует блок интеграционных проверок адаптации.

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
    const anyHint = btn((b) => (b.textContent ?? '').trim().startsWith('💡'));
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

  check('профиль создан, показана главная', has('Цель дня') && has('Задания дня'), body().slice(0, 200));
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
  check(
    'три задания дня в карточке',
    plan.length === 3 && plan.every((q) => has(questTitle(q.spec, q.target))),
    plan.map((q) => questTitle(q.spec, q.target)).join(' / '),
  );
  check('подсказка про ключи сундука видна', has('Собери 3 ключа'), '');
  check('сундук начинает с нулём ключей', has('Ключи: 0 из 3'), '');
  check('кристаллов пока 0', has('💎 0'), '');

  // ── Подсказка «Добавь приложение на экран» ─────────────────────────────────
  await runInstallHintChecks();

  const run = await playLesson();
  check('диалог «Выйти из урока?» показан, урок продолжился', run.sawDialog, '');
  check('экрана результатов достигли', run.reachedResults, `ответов с вердиктом: ${run.verdicts}`);
  check('на экране результатов виден плавающий БУК', document.querySelectorAll('.app > .mascot').length === 1, '');
  check('склонение слов на экране результатов («1 слово»)', has('1 слово'), body().slice(0, 220));
  check('ошибка в уроке засчитана (вердикт «Ошибка» видели)', run.madeMistake, `вердиктов: ${run.verdicts}`);
  check('задания-отработки после ошибок встречались', run.repairBadges > 0, '');
  check('на отработке счётчик уступает место пометке «ещё раз»', run.counterHiddenOnRepair, '');
  check('результаты показывают цель дня', has('цель 120') && has('Цель дня'), body().slice(0, 300));
  check('видно, что урок принёс опыт', /Урок принёс|Тренировка дала|Прогресс есть/.test(body()), '');
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
    const chips = Array.from(document.querySelectorAll('.word-chip-art')) as HTMLImageElement[];
    check('в словарике у слов с картинками показаны картинки', chips.length >= 8, `картинок: ${chips.length}`);
    check(
      'картинки собираются из public/words/*.webp',
      chips.every((c) => /words\/[a-z0-9_-]+\.webp$/.test(c.getAttribute('src') ?? '')),
      chips[0]?.getAttribute('src') ?? '—',
    );
    // открываем слово, у которого точно есть картинка
    click(document.querySelector('.word-chip-art')!.closest('.word-chip'));
    await sleep(60);
    check('в карточке слова картинка показана крупно', !!document.querySelector('.word-art'), '');
    const art = document.querySelector('.word-art')!;
    check('до загрузки есть эмодзи-подложка', !!document.querySelector('.word-art-placeholder') && !art.classList.contains('is-ready'), '');
    check('приоритет карточки высокий, миниатюры ленивые', art.getAttribute('fetchpriority') === 'high' && chips.every((c) => c.getAttribute('loading') === 'lazy'), '');
    art.dispatchEvent(new window.Event('load'));
    await sleep(20);
    check('загрузка открывает картинку', art.classList.contains('is-ready'), '');
    art.dispatchEvent(new window.Event('error'));
    await sleep(20);
    check('ошибка картинки оставляет эмодзи', !document.querySelector('.word-art') && !!document.querySelector('.word-art-placeholder'), '');

    click(btnText('Закрыть'));
    await sleep(40);
  }

  // ── Магазин БУКа (пункт 4) ────────────────────────────────────────────────
  const shopTab = buttons().find((b) => (b.textContent ?? '').includes('БУК') && b.className.includes('tab'));
  check('во вкладках есть магазин БУКа', !!shopTab);
  click(shopTab!);
  await sleep(80);
  check('магазин открылся', has('Магазин БУКа'), body().slice(0, 200));
  check('видны разделы гардероба', has('Головные уборы') && has('На шею'), '');
  check('показан баланс кристаллов', has(`💎 ${useApp.getState().profiles[0].gems}`), '');

  const gemsInShop = useApp.getState().profiles[0].gems;
  const buyBtn = btnText('Купить');
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
  }
  const expensive = buttons().find((b) => (b.textContent ?? '').includes('Ещё') && b.className.includes('btn'));
  check('на дорогие вещи кнопка показывает, сколько не хватает', !!expensive, '');

  // ── Рост БУКа (пункт 5) ───────────────────────────────────────────────────
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
  check('на главной есть серия дней', /Серия|Серия дней/.test(body()), body().slice(0, 200));
  check('полоска серии из 7 клеток', document.querySelectorAll('.streak-dot').length === 7, '');
  check(
    'сегодняшний день отмечен как сегодняшний',
    document.querySelectorAll('.streak-dot.today').length === 1,
    '',
  );
  check(
    'дни занятий закрашены',
    document.querySelectorAll('.streak-dot.on').length >= 1,
    '',
  );

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
  } else {
    check('режим повторения не превышает короткий лимит', true, 'повторять нечего');
  }

  // ── Церемония сундука: пропуск, фиксация чека и reduced motion ─────────────
  await runChestCeremonyChecks();

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

  // Диагностика запускается прямой ссылкой и читает хранилище, не раскрывая профиль.
  await runDiagnosticsRouteChecks();

  const failures = failureCount();
  console.log(failures ? `\n✗ ошибок: ${failures}` : '\n✓ все проверки пройдены');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error('тест упал:', e);
  process.exit(1);
});

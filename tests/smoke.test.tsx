// Смоук-тест (npm run test:smoke): в jsdom проходит урок целиком «руками» —
// кликами по настоящим кнопкам — и проверяет то, что нельзя проверить сборкой:
// диалог выхода из урока, монотонную полоску прогресса, пометку отработки ошибки,
// экран результатов с целью дня, выдачу награды за задания дня и сундук.
import './setup';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../src/App';
import { WORDS } from '../src/content/words';
import { dayKey, useApp } from '../src/state/store';
import { questsForDay } from '../src/engine/quests';
import { growthStage } from '../src/engine/shop';
import { masteredCount } from '../src/state/store';

const sleep = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const body = () => document.body.textContent ?? '';
const buttons = () => Array.from(document.querySelectorAll('button')) as HTMLButtonElement[];
const click = (el?: Element | null) => {
  if (!el) throw new Error('click: элемент не найден\n' + new Error().stack);
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
};
const btn = (pred: (b: HTMLButtonElement) => boolean) => buttons().find(pred);
const btnText = (t: string) => btn((b) => (b.textContent ?? '').includes(t));
const has = (t: string) => body().includes(t);

let failures = 0;
function check(name: string, cond: boolean, extra = '') {
  console.log(`${cond ? '✓' : '✗'} ${name}${cond ? '' : ' — ' + extra}`);
  if (!cond) failures++;
}

const byHint = new Map(WORDS.map((w) => [w.hint, w]));

/** Какое слово сейчас в задании — по подсказке в блоке clue. */
function currentWord() {
  const clue = document.querySelector('.clue-hint');
  if (!clue) return null;
  const txt = (clue.textContent ?? '').replace(/^💡\s*/, '').split('·')[0].trim();
  return byHint.get(txt) ?? null;
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

  const quests = questsForDay(dayKey());
  check('три задания дня в карточке', quests.every((q) => has(q.title)), quests.map((q) => q.title).join(' / '));
  check('подсказка про ключи сундука видна', has('Собери 3 ключа'), '');
  check('сундук начинает с нулём ключей', has('Ключи: 0 из 3'), '');
  check('кристаллов пока 0', has('💎 0'), '');

  const run = await playLesson();
  check('диалог «Выйти из урока?» показан, урок продолжился', run.sawDialog, '');
  check('экрана результатов достигли', run.reachedResults, `ответов с вердиктом: ${run.verdicts}`);
  check('ошибка в уроке засчитана (вердикт «Ошибка» видели)', run.madeMistake, `вердиктов: ${run.verdicts}`);
  check('задания-отработки после ошибок встречались', run.repairBadges > 0, '');
  check('на отработке счётчик уступает место пометке «ещё раз»', run.counterHiddenOnRepair, '');
  check('результаты показывают цель дня', has('цель 120') && has('Цель дня'), body().slice(0, 300));
  check('видно, что урок принёс опыт', /Урок принёс|Тренировка дала|Прогресс есть/.test(body()), '');
  click(btnText('К урокам')!);
  await sleep(80);

  // второй урок — задание «Пройди 2 урока» должно закрыться
  const run2 = await playLesson(true);
  check('второй урок пройден', run2.reachedResults, '');
  click(btnText('К урокам'));
  await sleep(80);

  // ── Награды ───────────────────────────────────────────────────────────────
  // Задания «6 подряд» и «повтори 5 слов» уроком целиком не закрыть (мы специально
  // ошибались) — доигрываем их через тот же API стора, что и настоящие ответы
  const st = useApp.getState();
  const kinds = questsForDay(dayKey()).map((q) => q.kind);
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
  check('тост о награде показан', has('кристаллов'), '');

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
    check('в окне видна полная награда', has('Сундук БУКа открыт!') && has('+15'), '');
    check('кнопка открытия исчезла', !btnText('Открыть сундук БУКа'), '');
    check('сохранён чек награды', has('Награда получена') && has('Посмотреть награду'), '');
    check('счётчик сундуков дня стоит', p.daily?.chestsToday === 1, '');

    // Закрываем окно и пробуем открыть ещё раз: награда не должна выдаваться дважды.
    click(btnText('Отлично!'));
    await sleep(40);
    const afterClose = useApp.getState().profiles[0].gems;
    check('окно награды закрывается, чек остаётся', !has('Сундук БУКа открыт!') && has('Награда получена'), '');
    click(btnText('Посмотреть награду'));
    await sleep(30);
    check('чек можно открыть повторно', has('Сундук БУКа открыт!') && has('+15'), '');
    click(btnText('Отлично!'));
    await sleep(30);
    check('повторное открытие не дублирует награду', useApp.getState().profiles[0].gems === afterClose, '');
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

  console.log(failures ? `\n✗ ошибок: ${failures}` : '\n✓ все проверки пройдены');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error('тест упал:', e);
  process.exit(1);
});

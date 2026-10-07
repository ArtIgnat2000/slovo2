// Интеграционные проверки адаптации урока (этап 2) — через настоящий UI.
//
// Юнит-правила контроллера живут в tests/adaptive.test.ts и проверяют чистые
// функции. Здесь проверяется то, что видно только в собранном приложении:
//  • что именно попадает в метрику — полная неверная сборка Build (сразу, ещё до
//    повтора) и ответ с подсказкой (в знаменатель, но не в «самостоятельные»);
//  • что выход и завершение финализируются однократно;
//  • что выход сразу, ни на что не ответив, не считается сигналом;
//  • что «Повторение» уважает эффективный бюджет, но не обучает контроллер;
//  • что бюджет переживает смену потолка (в том числе скрытый запас выше потолка)
//    и смену профиля: 14 → потолок 12 → потолок 16 снова даёт 14.
//
// Блок запускается из tests/smoke.test.tsx последним: он сам управляет активным
// профилем, бюджетом и настройками, поэтому не должен менять состояние под
// предыдущие сценарии.
import type { LessonSize, Profile, WordState } from '../src/types';
import { LESSONS, WORDS } from '../src/content/words';
import { DAY, initState } from '../src/engine/srs';
import { useApp } from '../src/state/store';
import { btn, btnText, buttons, check, click, currentWord, has, sleep } from './ui-helpers';

type Mode = 'clean' | 'hint';

const store = () => useApp.getState();

function active(): Profile {
  const s = store();
  const p = s.profiles.find((x) => x.id === s.activeId);
  if (!p) throw new Error('адаптация: нет активного профиля');
  return p;
}

function byId(id: string): Profile {
  const p = store().profiles.find((x) => x.id === id);
  if (!p) throw new Error(`адаптация: профиль ${id} потерялся`);
  return p;
}

/**
 * Настройки «как после прошлых уроков»: потолок, сохранённый бюджет и серия
 * хороших результатов. Ставим напрямую в стор — это предусловие сценария,
 * а не то, что проверяем: правила пересчитывает сам урок.
 */
function seedAdaptive(cards: number | undefined, good: number, size: LessonSize, profileId = active().id) {
  useApp.setState((s) => ({
    profiles: s.profiles.map((p) =>
      p.id === profileId ? { ...p, adaptiveCards: cards, adaptiveGood: good, lessonSize: size } : p,
    ),
  }));
}

/** Слова, которые «пора повторить»: с памятью (s>0), но с истёкшим сроком. */
function seedDueWords(count: number, profileId = active().id) {
  const p = byId(profileId);
  const current = LESSONS.find((l) => (p.lessons[l.id]?.level ?? 0) < 5);
  const busy = new Set([...Object.keys(p.words), ...(current?.wordIds ?? [])]);
  const ids = WORDS.filter((w) => !busy.has(w.id)).slice(0, count).map((w) => w.id);
  const now = Date.now();
  useApp.setState((st) => ({
    profiles: st.profiles.map((q) => {
      if (q.id !== profileId) return q;
      const words: Record<string, WordState> = { ...q.words };
      for (const id of ids) words[id] = { ...initState(now - 3 * DAY), s: 30, ok: 2, n: 2, iv: 1, due: now - DAY };
      return { ...q, words };
    }),
  }));
}

// ── Клики по настоящему интерфейсу ───────────────────────────────────────────

/** Счётчик карточек урока в шапке: «5/12» → 12. */
function counterTotal(): number {
  const pill = document.querySelector('.stat-pill.tasks')?.textContent ?? '';
  const total = Number(pill.split('/')[1]);
  return Number.isFinite(total) ? total : -1;
}

async function waitFor(pred: () => boolean, timeout = 3000): Promise<boolean> {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if (pred()) return true;
    await sleep(20);
  }
  return pred();
}

/** Быть на главной: закрыть диалог/урок, если они открыты. */
async function toHome() {
  if (has('Выйти из урока?')) {
    click(btnText('Выйти'));
    await sleep(60);
  }
  const exit = btn((b) => b.getAttribute('aria-label') === 'Выйти из урока');
  if (exit) {
    click(exit);
    await sleep(60);
    if (has('Выйти из урока?')) {
      click(btnText('Выйти'));
      await sleep(60);
    }
  }
  const home = buttons().find((b) => (b.textContent ?? '').includes('Уроки') && b.className.includes('tab'));
  if (home) click(home);
  await sleep(80);
}

/** Начать текущий урок с карты пути. */
async function startLesson(): Promise<boolean> {
  await toHome();
  const start =
    (document.querySelector('.node-btn.current') as HTMLButtonElement | null) ??
    (document.querySelector('.node-btn') as HTMLButtonElement | null);
  if (!start) return false;
  click(start);
  await sleep(80);
  return !!document.querySelector('.task');
}

/** Сменить пресет размера урока руками родителя (кнопка в разделе «Родителям»). */
async function setPresetViaUi(label: string): Promise<boolean> {
  await toHome();
  const tab = buttons().find((b) => (b.textContent ?? '').includes('Родителям') && b.className.includes('tab'));
  if (!tab) return false;
  click(tab);
  await sleep(60);
  // Замок «только для взрослых» — решаем пример, если он ещё не решён
  const equation = document.body.textContent?.match(/(\d+) × (\d+) = \?/);
  const input = document.querySelector('input.input') as HTMLInputElement | null;
  if (equation && input) {
    const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setValue?.call(input, String(Number(equation[1]) * Number(equation[2])));
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    await sleep(20);
    click(btnText('Войти'));
    await sleep(60);
  }
  const option = btnText(label);
  if (!option) return false;
  click(option);
  await sleep(50);
  return true;
}

/** Кнопка внутри текущей карточки задания (вне шапки и панели вердикта). */
function taskButton(pred: (b: HTMLButtonElement) => boolean): HTMLButtonElement | undefined {
  const task = document.querySelector('.task');
  if (!task) return undefined;
  return (Array.from(task.querySelectorAll('button')) as HTMLButtonElement[]).find(pred);
}

const isDisabled = (b: HTMLButtonElement) => !!b.disabled;

/**
 * Подсказка карточки. «👀 Ещё раз» в зрительном диктанте подсказкой не считается:
 * она лишь повторяет подсматривание, и нажимать её повторно нельзя.
 */
function cardHint(): HTMLButtonElement | undefined {
  return taskButton((b) => (b.textContent ?? '').trim().startsWith('💡'));
}

/** Правильный вариант в заданиях с вариантами: окошко (□) и «исправь робота». */
function correctOption(options: HTMLButtonElement[], word: NonNullable<ReturnType<typeof currentWord>>) {
  const visible = document.querySelector('.word-big')?.textContent ?? '';
  if (visible.includes('□')) {
    const letter = word.text[visible.indexOf('□')];
    return options.find((o) => (o.textContent ?? '').toLowerCase() === letter);
  }
  return options.find((o) => (o.textContent ?? '').trim() === word.text);
}

// Состояние «на этой карточке уже нажимали подсказку»: React пересоздаёт .task
// при смене задания (key={uid}), поэтому ссылка на узел — надёжный признак.
let seenTask: Element | null = null;
let hintClicked = false;

function syncCard() {
  const el = document.querySelector('.task');
  if (el !== seenTask) {
    seenTask = el;
    hintClicked = false;
  }
}

/** Сколько карточек-сборок в текущем прогоне решено подсказкой. */
let hintBuildCards = 0;

/** Один шаг по текущей карточке. true — что-то нажали (прогресс есть). */
function solveStep(mode: Mode): boolean {
  // 1. Проговаривание по слогам — неоцениваемое задание: просто читаем по порядку
  const syllable = taskButton((b) => b.className.includes('syllable') && !isDisabled(b));
  if (syllable) {
    click(syllable);
    return true;
  }

  // 2. Знакомство и напоминание в повторении («Запомнил» / «Вспомнил»)
  const intro = taskButton((b) => /Запомнил|Вспомнил/.test(b.textContent ?? ''));
  if (intro) {
    click(intro);
    return true;
  }

  // 3. Сборка слова
  const letters = Array.from(document.querySelectorAll('.letter')) as HTMLButtonElement[];
  if (letters.length) {
    if (mode === 'hint') {
      const h = taskButton((b) => /Подставить букву|Ещё букву/.test(b.textContent ?? ''));
      if (!h) return false;
      click(h);
      if (!hintClicked) hintBuildCards++;
      hintClicked = true;
      return true;
    }
    const word = currentWord();
    if (!word) return false;
    const filled = document.querySelectorAll('.slot.filled').length;
    // Все плитки уже стоят (идёт «неверная сборка» и сброс) — ждём, ничего не жмём
    if (filled >= word.text.length) return false;
    // Словарные слова бывают с большой буквы («Москва»), а плитки и клавиши — нет
    const need = word.text[filled].toLowerCase();
    const free = letters.find((b) => !b.className.includes('used') && (b.textContent ?? '').trim().toLowerCase() === need);
    if (!free) return false;
    click(free);
    return true;
  }

  // 4. Окошко / исправь робота
  const options = Array.from(document.querySelectorAll('.option')) as HTMLButtonElement[];
  if (options.length) {
    if (mode === 'hint' && !hintClicked) {
      const h = cardHint();
      if (h) {
        click(h);
        hintClicked = true;
        return true;
      }
    }
    const word = currentWord();
    click((word && correctOption(options, word)) ?? options[0]);
    return true;
  }

  // 5. Письмо и зрительный диктант
  const keys = Array.from(document.querySelectorAll('.key')) as HTMLButtonElement[];
  const word = currentWord();
  if (keys.length && word) {
    if (mode === 'hint' && !hintClicked) {
      const h = cardHint();
      if (h) {
        click(h);
        hintClicked = true;
        return true;
      }
    }
    const typed = (document.querySelector('.typed')?.textContent ?? '').replace('·', '').trim();
    if (typed.length < word.text.length) {
      const need = word.text[typed.length].toLowerCase();
      const k = keys.find((b) => (b.textContent ?? '').trim().toLowerCase() === need && !isDisabled(b));
      if (!k) return false;
      click(k);
      return true;
    }
    const ready = btnText('Проверить');
    if (ready && !isDisabled(ready)) {
      click(ready);
      return true;
    }
  }
  return false;
}

interface RunInfo {
  verdicts: number;
  reachedResults: boolean;
  stuck: boolean;
  /** Из verdicts — сколько пришлось на сборки, решённые подсказкой. */
  hintBuildCards: number;
  /** Текст карточки, на которой застряли — чтобы падение теста было разбираемым. */
  card?: string;
}

/**
 * Пройти урок кликами. mode='clean' — все ответы самостоятельные (качество 5),
 * mode='hint' — каждый оцениваемый ответ с подсказкой (качество 3).
 * stopAfterVerdicts>0 — остановиться, когда на экране показан вердикт (для выхода).
 */
async function playLesson(mode: Mode, stopAfterVerdicts = 0): Promise<RunInfo> {
  const info: RunInfo = { verdicts: 0, reachedResults: false, stuck: false, hintBuildCards: 0 };
  hintBuildCards = 0;
  let lastVerdict = false;
  let idle = 0;
  for (let steps = 0; steps < 2000; steps++) {
    await sleep(12);
    syncCard();

    const verdict = !!document.querySelector('.footer-bar') && !!btnText('Далее');
    if (verdict && !lastVerdict) {
      info.verdicts++;
      if (stopAfterVerdicts && info.verdicts >= stopAfterVerdicts) return info;
    }
    lastVerdict = verdict;

    if (btnText('К урокам') && has('Цель дня') && !document.querySelector('.task')) {
      info.reachedResults = true;
      return info;
    }
    if (btnText('Далее')) {
      click(btnText('Далее')!);
      idle = 0;
      continue;
    }
    const acted = solveStep(mode);
    info.hintBuildCards = hintBuildCards;
    idle = acted ? 0 : idle + 1;
    // Пауза без действий: показ слова в зрительном диктанте длится до ~4 с,
    // поэтому «застряли» объявляем только после 7 секунд тишины.
    if (idle > 600) {
      info.stuck = true;
      info.card = (document.querySelector('.task')?.textContent ?? '(нет задания)').replace(/\s+/g, ' ').slice(0, 140);
      return info;
    }
  }
  info.stuck = true;
  return info;
}

/** Собрать слово заведомо неверно: первая плитка — не та буква, что нужна слову. */
async function assembleWrongBuild(): Promise<boolean> {
  const free = () =>
    (Array.from(document.querySelectorAll('.letter')) as HTMLButtonElement[]).filter((b) => !b.className.includes('used'));
  const word = currentWord();
  if (!free().length) return false;
  const first = free().find((b) => (b.textContent ?? '').trim().toLowerCase() !== word?.text[0].toLowerCase()) ?? free()[0];
  click(first);
  await sleep(20);
  for (let guard = 0; guard < 40 && free().length; guard++) {
    click(free()[0]);
    await sleep(20);
  }
  await sleep(60);
  const wrongShown = !!document.querySelector('.slots.shake') || !!document.querySelector('.slot.bad');
  // Ждём автоматического сброса плиток — задание остаётся тем же, попытка уже зафиксирована
  await waitFor(() => !document.querySelector('.slots.shake') && !document.querySelector('.slot.bad'), 2500);
  return wrongShown;
}

/** Выйти из урока кнопкой «✕»; false — диалога не было (выход без подтверждения). */
async function exitLesson(): Promise<boolean> {
  const x = btn((b) => b.getAttribute('aria-label') === 'Выйти из урока');
  click(x);
  await sleep(60);
  const asked = has('Выйти из урока?');
  if (asked) {
    click(btnText('Выйти'));
    await sleep(80);
  }
  return asked;
}

/**
 * Дойти до сборки, не отвечая на оцениваемые задания: только знакомство и слоги.
 * false — до сборки попалось оцениваемое задание (тогда выход уже засчитается
 * как сигнал) или урок закончился.
 */
async function goToBuild(): Promise<boolean> {
  for (let steps = 0; steps < 400; steps++) {
    await sleep(12);
    syncCard();
    if (document.querySelector('.letter')) return true;
    if (btnText('Далее')) return false; // вердикт = был оцениваемый ответ
    const syllable = taskButton((b) => b.className.includes('syllable') && !isDisabled(b));
    if (syllable) {
      click(syllable);
      continue;
    }
    const intro = taskButton((b) => (b.textContent ?? '').includes('Запомнил'));
    if (intro) {
      click(intro);
      continue;
    }
    const options = Array.from(document.querySelectorAll('.option')) as HTMLButtonElement[];
    const keys = Array.from(document.querySelectorAll('.key')) as HTMLButtonElement[];
    if (options.length || keys.length) return false;
  }
  return false;
}

/**
 * Открыть урок, который начинается со сборки: в первом круге сборка бывает
 * у незнакомых слов. Уроки перебираем по порядку — новый профиль начинает путь
 * с самого первого, а у уже пройденных первый круг может быть письмом.
 */
async function openBuildLesson(maxLessons = 4): Promise<'ok' | 'answered' | 'none'> {
  await toHome();
  const count = Math.min(maxLessons, document.querySelectorAll('.node-btn').length);
  for (let i = 0; i < count; i++) {
    const node = document.querySelectorAll('.node-btn')[i] as HTMLButtonElement | undefined;
    if (!node) break;
    click(node);
    await sleep(80);
    if (!document.querySelector('.task')) continue;
    if (await goToBuild()) return 'ok';
    // Ничего не отвечали — выход должен быть без диалога и без последствий
    if (await exitLesson()) return 'answered';
    await sleep(40);
  }
  return 'none';
}

// ── Сценарий ─────────────────────────────────────────────────────────────────

export async function runAdaptiveUiChecks(): Promise<void> {
  console.log('\n── Адаптация урока: интеграционные проверки (этап 2) ──');
  await toHome();
  const kid = active();
  check('адаптация: сценарий стартует с профиля на главной', active().id === kid.id && has('Мой путь'), '');

  // 1. Смена пресета родителем сохраняет бюджет и сбрасывает серию ────────────
  seedAdaptive(14, 1, 'short');
  const switched = await setPresetViaUi('Обычный · 16');
  check(
    'адаптация: смена пресета в «Родителям» сохраняет запас выше потолка (14 при потолке 16)',
    switched && active().lessonSize === 'standard' && active().adaptiveCards === 14,
    `пресет=${active().lessonSize}, бюджет=${active().adaptiveCards}`,
  );
  check('адаптация: смена пресета сбрасывает серию хороших уроков', active().adaptiveGood === 0, String(active().adaptiveGood));
  await setPresetViaUi('Короткий · 12');
  check(
    'адаптация: возврат к короткому пресету не переписывает бюджет (14 ждёт потолок 16)',
    active().lessonSize === 'short' && active().adaptiveCards === 14,
    `пресет=${active().lessonSize}, бюджет=${active().adaptiveCards}`,
  );

  // 2. Выход сразу, ни на что не ответив, — не сигнал ────────────────────────
  seedAdaptive(16, 0, 'standard');
  check('адаптация: урок запускается с карты пути', await startLesson(), '');
  const askedEarly = await exitLesson();
  check(
    'адаптация: выход без единого ответа не спрашивает подтверждения',
    !askedEarly && !document.querySelector('.task'),
    askedEarly ? 'диалог показан' : 'остались в уроке',
  );
  check('адаптация: выход без ответов не меняет бюджет', active().adaptiveCards === 16, String(active().adaptiveCards));

  // 3. Неверная сборка фиксируется сразу, выход снижает бюджет однократно ────
  seedAdaptive(16, 0, 'standard');
  const opened = await openBuildLesson();
  check('адаптация: найден урок, начинающийся со сборки (без единого ответа)', opened === 'ok', opened);
  const wrongAssembled = opened === 'ok' ? await assembleWrongBuild() : false;
  check('адаптация: неверная сборка показала промах и вернула плитки', wrongAssembled, '');
  const askedAfterBuild = await exitLesson();
  check('адаптация: промах в сборке засчитан сразу — выход уже подтверждают', askedAfterBuild, '');
  check(
    'адаптация: выход после промаха снизил бюджет на 1 (16 → 15)',
    active().adaptiveCards === 15,
    String(active().adaptiveCards),
  );
  await sleep(300);
  check(
    'адаптация: повторной финализации нет — бюджет остаётся 15, серия 0',
    active().adaptiveCards === 15 && active().adaptiveGood === 0,
    `бюджет=${active().adaptiveCards}, серия=${active().adaptiveGood}`,
  );

  // 4. Сильный урок на потолке не копит будущие повышения ───────────────────
  seedAdaptive(14, 0, 'short'); // потолок 12, запас выше потолка — 14
  check('адаптация: урок для сильной сессии запускается', await startLesson(), '');
  check(
    'адаптация: урок не выходит за фактический потолок 12 (скрытые 14 не растягивают урок)',
    counterTotal() > 0 && counterTotal() <= 12,
    String(counterTotal()),
  );
  const strong = await playLesson('clean');
  check('адаптация: самостоятельный урок дошёл до экрана результатов', strong.reachedResults, JSON.stringify(strong));
  check(
    'адаптация: на потолке бюджет остаётся 12, серия не копится',
    active().adaptiveCards === 12 && active().adaptiveGood === 0,
    `бюджет=${active().adaptiveCards}, серия=${active().adaptiveGood}`,
  );
  click(btnText('К урокам'));
  await sleep(80);

  // 5а. Подсказки в сборках не «самостоятельный» успех: урок из 5 знакомств и
  // 5 сборок (бюджет 10 = base, второго круга нет) при подсказках везде даёт −1.
  seedAdaptive(10, 0, 'short');
  const buildOnly = await openBuildLesson();
  const buildCounter = counterTotal();
  check(
    'адаптация: найден урок из одних сборок (бюджет 10)',
    buildOnly === 'ok' && buildCounter === 10,
    `${buildOnly}, карточек ${buildCounter}`,
  );
  const hintedBuilds = await playLesson('hint');
  check(
    'адаптация: в уроке подсказки ставили буквы именно в сборках',
    hintedBuilds.hintBuildCards >= 4 && hintedBuilds.hintBuildCards === hintedBuilds.verdicts,
    JSON.stringify(hintedBuilds),
  );
  check('адаптация: урок с подсказками дошёл до экрана результатов', hintedBuilds.reachedResults, JSON.stringify(hintedBuilds));
  check(
    'адаптация: подсказки не самостоятельны (10 → 9, а не рост при потолке 12)',
    active().adaptiveCards === 9 && active().adaptiveGood === 0,
    `бюджет=${active().adaptiveCards}, серия=${active().adaptiveGood}`,
  );
  click(btnText('К урокам'));
  await sleep(80);

  // 5б. Слабый урок при скрытом запасе выше потолка: считаем от фактического
  // потолка 12, а не от 14 — иначе бюджет «вырос» бы до 13.
  seedAdaptive(14, 1, 'short');
  seedDueWords(3); // в урок попадут и карточки-повторения с вариантами
  check('адаптация: второй урок с подсказками запускается', await startLesson(), '');
  const hinted = await playLesson('hint');
  check('адаптация: второй урок с подсказками дошёл до результатов', hinted.reachedResults, JSON.stringify(hinted));
  check(
    'адаптация: подсказки не самостоятельны (12 → 11 от потолка, а не 13 от скрытых 14)',
    active().adaptiveCards === 11 && active().adaptiveGood === 0,
    `бюджет=${active().adaptiveCards}, серия=${active().adaptiveGood}`,
  );
  click(btnText('К урокам'));
  await sleep(80);

  // 6. Рост: две сильные сессии подряд, потолок 16 ──────────────────────────
  seedAdaptive(12, 1, 'standard');
  check('адаптация: урок для роста запускается', await startLesson(), '');
  const second = await playLesson('clean');
  check('адаптация: второй самостоятельный урок дошёл до результатов', second.reachedResults, JSON.stringify(second));
  check(
    'адаптация: вторая сильная сессия подряд подняла бюджет (12 → 13)',
    active().adaptiveCards === 13 && active().adaptiveGood === 0,
    `бюджет=${active().adaptiveCards}, серия=${active().adaptiveGood}`,
  );
  click(btnText('К урокам'));
  await sleep(80);

  // 7. «Повторение»: уважает эффективный бюджет, но не обучает контроллер ────
  seedAdaptive(12, 0, 'standard');
  seedDueWords(9); // слов больше, чем влезает в бюджет: длина видна и без потолка
  await toHome();
  const reviewBtn = btnText('Пора повторить');
  check('адаптация: «Пора повторить» доступно после посева слов', !!reviewBtn, '');
  if (reviewBtn) {
    click(reviewBtn);
    await sleep(80);
    const reviewCards = counterTotal();
    check(
      'адаптация: повторение уважает эффективный бюджет 12, а не потолок 16',
      reviewCards > 0 && reviewCards <= 12,
      String(reviewCards),
    );
    const reviewRun = await playLesson('clean', 1);
    check('адаптация: в повторении дан один оцениваемый ответ', reviewRun.verdicts >= 1, JSON.stringify(reviewRun));
    const askedInReview = await exitLesson();
    check('адаптация: выход из повторения подтверждают (ответ засчитан)', askedInReview, '');
    check(
      'адаптация: «Повторение» не обучает контроллер (бюджет 12 и серия 0 на месте)',
      active().adaptiveCards === 12 && active().adaptiveGood === 0,
      `бюджет=${active().adaptiveCards}, серия=${active().adaptiveGood}`,
    );
  }

  // 8. Другой профиль: своя адаптация, чужая не задевает ────────────────────
  const firstId = active().id;
  store().createProfile('Адаптация', '🐼');
  await sleep(80);
  const secondId = active().id;
  check('адаптация: создан второй профиль и он активен', secondId !== firstId, '');
  seedAdaptive(undefined, 0, 'standard', secondId);
  const openedSecond = await openBuildLesson();
  const wrongForSecond = openedSecond === 'ok' ? await assembleWrongBuild() : false;
  const askedForSecond = wrongForSecond ? await exitLesson() : false;
  check(
    `адаптация: промах второго профиля снизил только его бюджет (${openedSecond})`,
    askedForSecond && byId(secondId).adaptiveCards === 15,
    `бюджет=${byId(secondId).adaptiveCards}`,
  );
  check(
    'адаптация: бюджет и пресет первого профиля не изменились',
    byId(firstId).adaptiveCards === 12 && byId(firstId).lessonSize === 'standard',
    `бюджет=${byId(firstId).adaptiveCards}, пресет=${byId(firstId).lessonSize}`,
  );
  await sleep(300);
  check(
    'адаптация: у второго профиля тоже одна финализация (15)',
    byId(secondId).adaptiveCards === 15,
    String(byId(secondId).adaptiveCards),
  );
}

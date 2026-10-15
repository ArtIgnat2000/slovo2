// Задания дня глазами ребёнка (обратная связь 2026-09-29: «нажимаю — ничего не происходит»).
// Главная с 2026-10-15: герой «Сегодня» — единственная кнопка «Начать»; строка задания
// сама открывает урок / повторение (класс .quest-main), без второй кнопки и подписи «куда идти».
//
// Проверяем весь путь, а не только правила:
//  • на главной есть герой «Сегодня» с «Начать»;
//  • незакрытое задание — это кнопка (.quest-main), тап открывает урок / «Повторение»;
//  • блок «Пора повторить» на главной и урок повторения больше не расходятся:
//    если блок обещает N слов, урок их и показывает (раньше открывалось «Повторять нечего!»);
//  • прогресс «Повтори N слов» растёт от потренированных слов, ошибка его не «замораживает»;
//  • награду за задание можно забрать, а цель дня подстраивается под новичка.
import type { Profile, QuestPlanItem } from '../src/types';
import { LESSONS, WORDS } from '../src/content/words';
import { dayKey, useApp } from '../src/state/store';
import { CHEST_WAKE_TAPS, planOf, questsForDay, specFor } from '../src/engine/quests';
import { btn, btnText, buttons, check, click, currentWord, has, openRewardsSheet, sleep } from './ui-helpers';

const store = () => useApp.getState();
const DAY = 86_400_000;

function active(): Profile {
  const s = store();
  const p = s.profiles.find((x) => x.id === s.activeId);
  if (!p) throw new Error('задания дня: нет активного профиля');
  return p;
}

/** Свежее состояние дня: план пересоберётся под текущие слова профиля. */
function resetDay(profileId = active().id) {
  useApp.setState((s) => ({
    profiles: s.profiles.map((p) => (p.id === profileId ? { ...p, daily: undefined } : p)),
  }));
}

/**
 * Профиль «вчера учил слова»: слова пройдены (s>0), срок повторения истёк.
 * Берём слова АКТИВНОГО урока — именно на них ломался блок «Пора повторить»:
 * главная их считала, а урок повторения выкидывал и показывал «Повторять нечего!».
 */
function seedPractised(count: number, opts: { due?: boolean } = {}) {
  const id = active().id;
  const school = LESSONS[0];
  const now = Date.now();
  const ids = school.wordIds.slice(0, count).map((wordId) => WORDS.find((w) => w.id === wordId)!);
  const plan: QuestPlanItem[] = [
    { kind: 'review', target: Math.min(5, Math.max(2, count)) },
    { kind: 'lessons', target: 2 },
    { kind: 'correct', target: 12 },
  ];
  useApp.setState((s) => ({
    profiles: s.profiles.map((p) => {
      if (p.id !== id) return p;
      const words = { ...p.words };
      for (const w of ids) {
        words[w.id] = {
          s: 25,
          due: opts.due === false ? now + 3 * DAY : now - DAY,
          iv: 2,
          n: 2,
          seen: now - DAY,
          ok: 2,
          wrong: 0,
        };
      }
      return {
        ...p,
        words,
        lessons: { ...p.lessons, [school.id]: { level: 1, best: 80, doneAt: now, plays: 1 } },
        // Не зависим от того, выпал ли вид «Повтори» в сегодняшнем случайном наборе:
        // сценарий тестирует именно прогресс повторения, поэтому фиксируем его здесь.
        daily: {
          day: dayKey(),
          claimed: [],
          chestsToday: 0,
          chestsTotal: p.daily?.chestsTotal ?? 0,
          plan,
        },
      };
    }),
  }));
}

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

async function showRewards() {
  await openRewardsSheet();
}

/** Текст карточки задания, в которой встречается подстрока. */
function questCard(text: string): string {
  const card = Array.from(document.querySelectorAll('.quest')).find((q) => (q.textContent ?? '').includes(text));
  return (card?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Кнопка с любой подписью внутри карточки задания.
 *
 * Важно искать именно внутри карточки: кнопок «Забрать» на странице бывает
 * несколько (по одной у каждого закрытого задания), и поиск «первой попавшейся»
 * уводил клик в чужое задание — проверка «награда забрана» падала, хотя
 * продукт работал верно.
 */
function questAction(text: string, label: string): HTMLButtonElement | undefined {
  const card = Array.from(document.querySelectorAll('.quest')).find((q) => (q.textContent ?? '').includes(text));
  return (Array.from(card?.querySelectorAll('button') ?? []) as HTMLButtonElement[]).find((b) =>
    (b.textContent ?? '').includes(label),
  );
}

/** Кнопка запуска внутри карточки задания (строка .quest-main, без второй «Начать»). */
function questStart(text: string): HTMLButtonElement | undefined {
  const card = Array.from(document.querySelectorAll('.quest')).find((q) => (q.textContent ?? '').includes(text));
  return (card?.querySelector('.quest-main') as HTMLButtonElement | null) ?? undefined;
}

/** Пролистать неоцениваемые карточки-напоминания («Вспомнил! 👍») до задания. */
async function skipReminders(): Promise<void> {
  for (let i = 0; i < 4; i++) {
    const reminder = Array.from(document.querySelectorAll('.task button')).find((b) =>
      (b.textContent ?? '').includes('Вспомнил'),
    );
    if (!reminder) return;
    click(reminder);
    await sleep(60);
  }
}

/** Ответить на текущую карточку повторения заведомо неверно (оценка 0). */
async function answerWrong(): Promise<boolean> {
  await skipReminders();
  const task = document.querySelector('.task');
  if (!task) return false;
  const syllable = Array.from(task.querySelectorAll('button')).find(
    (b) => (b.className.includes('syllable') && !b.disabled) as boolean,
  ) as HTMLButtonElement | undefined;
  if (syllable) {
    click(syllable);
    return true;
  }
  const word = currentWord();
  const options = Array.from(document.querySelectorAll('.option')) as HTMLButtonElement[];
  if (options.length && word) {
    const bad = options.find((o) => (o.textContent ?? '').trim() !== word.text);
    click(bad ?? options[0]);
    return true;
  }
  const keys = Array.from(document.querySelectorAll('.key')) as HTMLButtonElement[];
  if (keys.length) {
    // одна неверная буква — и проверяем
    const typed = (document.querySelector('.typed')?.textContent ?? '').replace('·', '').trim();
    const need = word?.text[typed.length]?.toLowerCase() ?? '';
    const bad = keys.find((b) => (b.textContent ?? '').trim().toLowerCase() !== need && (b.textContent ?? '').trim() !== '⌫');
    if (bad) click(bad);
    await sleep(30);
    const ready = btnText('Проверить');
    if (ready && !ready.disabled) click(ready);
    return true;
  }
  const check = btnText('Проверить');
  if (check && !check.disabled) {
    click(check);
    return true;
  }
  return false;
}

/** Ответить на текущую карточку повторения верно. */
async function answerRight(): Promise<boolean> {
  await skipReminders();
  const task = document.querySelector('.task');
  if (!task) return false;
  const syllable = Array.from(task.querySelectorAll('button')).find(
    (b) => (b.className.includes('syllable') && !b.disabled) as boolean,
  ) as HTMLButtonElement | undefined;
  if (syllable) {
    click(syllable);
    return true;
  }
  const word = currentWord();
  const options = Array.from(document.querySelectorAll('.option')) as HTMLButtonElement[];
  if (options.length && word) {
    const visible = document.querySelector('.word-big')?.textContent ?? '';
    let right: HTMLButtonElement | undefined;
    if (visible.includes('□')) {
      const letter = word.text[visible.indexOf('□')];
      right = options.find((o) => (o.textContent ?? '').toLowerCase() === letter);
    } else {
      right = options.find((o) => (o.textContent ?? '').trim() === word.text);
    }
    click(right ?? options[0]);
    return true;
  }
  const keys = Array.from(document.querySelectorAll('.key')) as HTMLButtonElement[];
  if (keys.length && word) {
    const typed = (document.querySelector('.typed')?.textContent ?? '').replace('·', '').trim();
    for (const ch of word.text.slice(typed.length).toLowerCase()) {
      const k = keys.find((b) => (b.textContent ?? '').trim().toLowerCase() === ch && !b.disabled);
      if (!k) break;
      click(k);
      await sleep(10);
    }
    const ready = btnText('Проверить');
    if (ready && !ready.disabled) click(ready);
    return true;
  }
  return false;
}

/** Дождаться вердикта и нажать «Далее». */
async function nextCard() {
  for (let i = 0; i < 200; i++) {
    await sleep(20);
    const next = btnText('Далее');
    if (next) {
      click(next);
      return;
    }
  }
}

// ── Сценарий ─────────────────────────────────────────────────────────────────

export async function runQuestUiChecks(): Promise<void> {
  console.log('\n── Задания дня: понятность и выполнимость ──');
  await toHome();

  // 0. Создаём отдельный профиль: блок не должен зависеть от состояния прошлых сценариев
  store().createProfile('Задания', '🐨');
  await sleep(80);
  const daySet = questsForDay(new Date().toISOString().slice(0, 10));
  const reviewInDay = daySet.some((q) => q.kind === 'review');

  // 1. Герой «Сегодня» — главный удар; задания живут в листе 🎁
  check(
    'главная: герой «Сегодня» с кнопкой «Начать»',
    !!document.querySelector('.home-hero') && has('Сегодня') && !!btnText('Начать'),
    bodyText(),
  );
  check('главная: на доме нет карточки заданий — они за 🎁', !document.querySelector('.quest'), bodyText());
  click(document.querySelector('.home-hero'));
  await sleep(100);
  check('главная: «Начать» у героя открывает урок', !!document.querySelector('.task'), bodyText().slice(0, 120));
  await toHome();
  await showRewards();
  const cards = Array.from(document.querySelectorAll('.quest'));
  check('задания дня: три карточки в листе наград', cards.length === 3, String(cards.length));
  check(
    'задания дня: у каждого незакрытого задания строка запускает (.quest-main)',
    cards.every((c) => !!c.querySelector('.quest-main')),
    cards.map((c) => (c.textContent ?? '').replace(/\s+/g, ' ').slice(0, 40)).join(' | '),
  );

  // 2. Новичку повторять нечего — задание повторения не выдаём (иначе оно «висит» весь день)
  check(
    'задания дня: новичку «Повтори N слов» не выдаётся — вместо него другой вид дня',
    !reviewInDay || !questCard('Повтори'),
    questCard('Повтори') || 'повторения в наборе нет',
  );

  // 3. Тап по строке задания открывает урок (герой — тот же старт, проверяем строку)
  const startLessonBtn = questStart('верных ответов') ?? questStart('Пройди') ?? questStart('Повтори');
  click(startLessonBtn);
  await sleep(100);
  check('задания дня: тап по строке задания открывает урок', !!document.querySelector('.task'), bodyText().slice(0, 120));
  await toHome();
  await showRewards();

  // 4. Слова пройдены, но срок повторения ещё не истёк: задание «Повтори» в листе
  //    всё равно ведёт в тренировку (раньше блок пропадал или открывал «Повторять нечего!»)
  seedPractised(6, { due: false });
  await sleep(80);
  await showRewards();
  check(
    'задания дня: после урока повтор доступен как задание',
    questCard('Повтори') !== '',
    bodyText().slice(0, 200),
  );
  check(
    'задания дня: цель повторения подстроена под пройденные слова (5 из 6)',
    questCard('Повтори 5 слов') !== '',
    questCard('Повтори'),
  );

  const reviewStart = questStart('Повтори');
  click(reviewStart);
  await sleep(100);
  check(
    'задания дня: режим повторения показывает слова, а не «Повторять нечего!»',
    !!document.querySelector('.task') && !has('Повторять нечего'),
    bodyText().slice(0, 160),
  );
  check('задания дня: в шапке именно «Повторение»', has('Повторение'), bodyText().slice(0, 80));
  // Повторение открывается крупной карточкой-напоминанием, а не сразу заданием
  // со старой компактной подсказкой (замечание с айфона 2026-10-07).
  check(
    'задания дня: повторение открывается фотокарточкой-напоминанием',
    !!document.querySelector('.task-intro .lesson-intro-card.wcard-photo'),
    document.querySelector('.task')?.className ?? '—',
  );

  // 5. Ошибка в повторении не «замораживает» прогресс задания
  const wrongAnswered = await answerWrong();
  await nextCard();
  check('задания дня: в повторении можно ошибиться (промах засчитан)', wrongAnswered, '');
  await sleep(60);
  await toHome();
  await showRewards();
  const afterOne = questCard('Повтори');
  check(
    'задания дня: после одного слова прогресс 1 / 5, несмотря на ошибку',
    afterOne.includes('1 / 5'),
    afterOne,
  );

  // 6. Кнопка задания ведёт в повторение и оттуда можно продолжить
  click(questStart('Повтори'));
  await sleep(100);
  check('задания дня: тап по заданию повторения открывает повторение', !!document.querySelector('.task') && has('Повторение'), bodyText().slice(0, 120));
  await answerRight();
  await nextCard();
  await sleep(60);
  await toHome();
  await showRewards();
  check(
    'задания дня: прогресс вырос после верного ответа (2 / 5)',
    questCard('Повтори').includes('2 / 5'),
    questCard('Повтори'),
  );

  // 7. Добираем оставшиеся слова и забираем награду
  for (const wordId of LESSONS[0].wordIds) store().answer(wordId, 5, true);
  await sleep(80);
  await showRewards();
  const gemsBefore = active().gems;
  const claim = questStart('Повтори');
  const claimBtn = questAction('Повтори', 'Забрать');
  check(
    'задания дня: у закрытого задания кнопка «Забрать» вместо строки запуска',
    !claim && !!claimBtn,
    questCard('Повтори'),
  );
  if (claimBtn) {
    click(claimBtn);
    await sleep(80);
  }
  check(
    'задания дня: награда за задание забрана',
    active().gems > gemsBefore && questCard('Повтори').includes('Награда получена'),
    `💎 ${gemsBefore} → ${active().gems} | claimBtn=${!!claimBtn} | КАРТОЧКИ: ${Array.from(document.querySelectorAll('.quest')).map((q) => (q.textContent ?? '').replace(/\s+/g, ' ').trim()).join(' ## ')} | claimed=${JSON.stringify(active().daily?.claimed)}`,
  );

  // 8. Цель подстраивается под новичка: у профиля с двумя пройденными словами — «Повтори 2 слова»
  store().createProfile('Новичок', '🐣');
  await sleep(60);
  seedPractised(2, { due: false });
  await sleep(80);
  await showRewards();
  check(
    'задания дня: новичку с двумя словами цель — «Повтори 2 слова»',
    questCard('Повтори 2 слова') !== '' || !reviewInDay,
    questCard('Повтори') || `в наборе дня нет повторения (${specFor('review').title})`,
  );

  // 9. Каждый завершённый урок даёт отдельный бонусный сундук без суточного потолка
  store().createProfile('Бонусные сундуки', '🐣');
  await sleep(60);
  const gemsAtStart = active().gems;
  for (let i = 0; i < 3; i++) store().finishLesson(LESSONS[0].id, 100);
  await sleep(80);
  await showRewards();
  check('в наградах виден недельный прогресс', has('Награды недели') && has('1 из 7'), bodyText());
  check(
    'три урока дают три готовых бонусных сундука',
    active().days[dayKey()]?.lessons === 3 && has('бонусных готово: 3'),
    bodyText(),
  );
  for (let i = 1; i <= 3; i++) {
    const openBonus = btnText('Открыть бонусный сундук');
    check(`бонусный сундук ${i} доступен без дневного лимита`, !!openBonus, bodyText());
    if (!openBonus) break;
    click(openBonus);
    await sleep(50);
    const profile = active();
    check(
      `бонусный сундук ${i} начисляет 5 кристаллов и учитывается отдельно`,
      profile.gems === gemsAtStart + i * 5 &&
        profile.daily?.chestsToday === i &&
        profile.daily?.bonusChestsClaimed === i &&
        profile.daily?.lastChestKind === 'bonus',
      `💎 ${profile.gems}; открыто: ${profile.daily?.chestsToday}; бонусных: ${profile.daily?.bonusChestsClaimed}`,
    );
    if (i === 1) check('в бонусном сундуке написано, что это награда за урок', has('НАГРАДА ЗА УРОК'), bodyText());
    click(btnText('Пропустить'));
    await sleep(20);
    click(btnText('Здорово!'));
    await sleep(50);
  }
  check('после трёх бонусных сундуков каждый урок оплачен по одному разу', !btnText('Открыть бонусный сундук'), bodyText());

  // 10. «Разбуди сундук»: тапы по закрытому сундуку на главной дают надбавку.
  // Замечание с тестирования 2026-10-14: ребёнок тапает по сундуку, пока тот не
  // открылся, и ждёт, что это на что-то повлияет. Теперь пять тапов будят сундук.
  store().createProfile('Будим сундук', '🐣');
  await sleep(60);
  for (const item of planOf(active())) {
    if (item.kind === 'lessons') {
      for (let i = 0; i < item.target; i++) store().finishLesson(LESSONS[0].id, 100);
    } else if (item.kind === 'review') {
      for (let i = 0; i < item.target; i++) store().answer(WORDS[i].id, 5, true);
    } else {
      for (let i = 0; i < item.target; i++) store().answer(WORDS[i].id, 5, false);
    }
  }
  await sleep(80);
  await showRewards();
  check('разогрев: задания закрыты, сундук готов', has('Ключи: 3 из 3'), bodyText());

  const wakeGlyph = document.querySelector('.chest-glyph.wake') as HTMLButtonElement | null;
  check('разогрев: по сундуку на главной можно тапать', !!wakeGlyph, bodyText());
  const gemsBeforeWake = active().gems;
  for (let i = 0; i < CHEST_WAKE_TAPS; i++) {
    click(wakeGlyph);
    await sleep(20);
  }
  check(
    'разогрев: пять тапов будят сундук и обещают надбавку в кнопке',
    has('Сундук проснулся') && has('разогрет'),
    bodyText(),
  );

  click(btnText('Открыть сундук БУКа'));
  await sleep(60);
  const woken = active();
  check(
    'разогрев: разбуженный сундук даёт 15 + 2 кристалла',
    woken.gems === gemsBeforeWake + 17 && woken.daily?.lastChest?.wakeBonus === 2,
    `💎 ${gemsBeforeWake} → ${woken.gems}; чек: ${JSON.stringify(woken.daily?.lastChest)}`,
  );
  click(btnText('Пропустить'));
  await sleep(30);
  check('разогрев: в награде видно надбавку', has('разбудил сундук'), bodyText());
  click(btnText('Здорово!'));
  await sleep(40);
  check(
    'разогрев: следующий сундук начинается со «спящего» состояния',
    has('Сундук спит') && !has('Сундук проснулся!'),
    bodyText(),
  );
  resetDay();
  await sleep(40);
}

const bodyText = () => (document.body.textContent ?? '').replace(/\s+/g, ' ').slice(0, 240);

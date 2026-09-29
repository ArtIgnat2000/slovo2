// Задания дня глазами ребёнка (обратная связь 2026-09-29: «нажимаю — ничего не происходит»).
//
// Проверяем весь путь, а не только правила:
//  • у незакрытого задания есть подпись «куда идти» и кнопка «Начать ▸»;
//  • «Начать ▸» действительно открывает урок (и режим «Повторение» для задания повторения);
//  • блок «Пора повторить» на главной и урок повторения больше не расходятся:
//    если блок обещает N слов, урок их и показывает (раньше открывалось «Повторять нечего!»);
//  • прогресс «Повтори N слов» растёт от потренированных слов, ошибка его не «замораживает»;
//  • награду за задание можно забрать, а цель дня подстраивается под новичка.
import type { Profile } from '../src/types';
import { LESSONS, WORDS } from '../src/content/words';
import { useApp } from '../src/state/store';
import { questsForDay, specFor } from '../src/engine/quests';
import { btn, btnText, buttons, check, click, currentWord, has, sleep } from './ui-helpers';

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
        daily: undefined, // план дня пересобирается под новые слова
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

/** Текст карточки задания, в которой встречается подстрока. */
function questCard(text: string): string {
  const card = Array.from(document.querySelectorAll('.quest')).find((q) => (q.textContent ?? '').includes(text));
  return (card?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** Кнопка «Начать ▸» в карточке задания с указанным текстом. */
function questStart(text: string): HTMLButtonElement | undefined {
  const card = Array.from(document.querySelectorAll('.quest')).find((q) => (q.textContent ?? '').includes(text));
  return (Array.from(card?.querySelectorAll('button') ?? []) as HTMLButtonElement[]).find((b) =>
    (b.textContent ?? '').includes('Начать'),
  );
}

/** Ответить на текущую карточку повторения заведомо неверно (оценка 0). */
async function answerWrong(): Promise<boolean> {
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

  // 1. У каждого незакрытого задания есть подпись и кнопка запуска
  const cards = Array.from(document.querySelectorAll('.quest'));
  check('задания дня: три карточки на главной', cards.length === 3, String(cards.length));
  check(
    'задания дня: у каждого незакрытого задания есть кнопка «Начать ▸»',
    cards.every((c) => Array.from(c.querySelectorAll('button')).some((b) => (b.textContent ?? '').includes('Начать'))),
    cards.map((c) => (c.textContent ?? '').replace(/\s+/g, ' ').slice(0, 40)).join(' | '),
  );
  check(
    'задания дня: подпись объясняет, где выполнять задание',
    has('Верные ответы считаются в уроках') || has('Уроки ждут на карте'),
    bodyText(),
  );

  // 2. Новичку повторять нечего — задание повторения не выдаём (иначе оно «висит» весь день)
  check(
    'задания дня: новичку «Повтори N слов» не выдаётся — вместо него другой вид дня',
    !reviewInDay || !questCard('Повтори'),
    questCard('Повтори') || 'повторения в наборе нет',
  );

  // 3. «Начать ▸» у обычного задания открывает урок
  const startLessonBtn = questStart('верных ответов') ?? questStart('Пройди') ?? questStart('Повтори');
  click(startLessonBtn);
  await sleep(100);
  check('задания дня: «Начать ▸» открывает урок', !!document.querySelector('.task'), bodyText().slice(0, 120));
  await toHome();

  // 4. Слова пройдены, но срок повторения ещё не истёк: блок «Пора повторить» всё равно
  //    должен вести в тренировку (раньше блок пропадал или открывал «Повторять нечего!»)
  seedPractised(6, { due: false });
  await sleep(80);
  check('задания дня: после урока «Пора повторить» предлагает тренировку', has('Пора повторить'), bodyText().slice(0, 200));
  check(
    'задания дня: цель повторения подстроена под пройденные слова (5 из 6)',
    questCard('Повтори 5 слов') !== '',
    questCard('Повтори'),
  );

  const reviewStart = btnText('Пора повторить');
  click(reviewStart);
  await sleep(100);
  check(
    'задания дня: режим повторения показывает слова, а не «Повторять нечего!»',
    !!document.querySelector('.task') && !has('Повторять нечего'),
    bodyText().slice(0, 160),
  );
  check('задания дня: в шапке именно «Повторение»', has('Повторение'), bodyText().slice(0, 80));

  // 5. Ошибка в повторении не «замораживает» прогресс задания
  const wrongAnswered = await answerWrong();
  await nextCard();
  check('задания дня: в повторении можно ошибиться (промах засчитан)', wrongAnswered, '');
  await sleep(60);
  await toHome();
  const afterOne = questCard('Повтори');
  check(
    'задания дня: после одного слова прогресс 1 / 5, несмотря на ошибку',
    afterOne.includes('1 / 5'),
    afterOne,
  );

  // 6. Кнопка задания ведёт в повторение и оттуда можно продолжить
  click(questStart('Повтори'));
  await sleep(100);
  check('задания дня: «Начать ▸» у задания повторения открывает повторение', !!document.querySelector('.task') && has('Повторение'), bodyText().slice(0, 120));
  await answerRight();
  await nextCard();
  await sleep(60);
  await toHome();
  check(
    'задания дня: прогресс вырос после верного ответа (2 / 5)',
    questCard('Повтори').includes('2 / 5'),
    questCard('Повтори'),
  );

  // 7. Добираем оставшиеся слова и забираем награду
  for (const wordId of LESSONS[0].wordIds) store().answer(wordId, 5, true);
  await sleep(80);
  const gemsBefore = active().gems;
  const claim = questStart('Повтори');
  check('задания дня: прогресс задания считается из потренированных слов', questCard('Повтори').includes('5 / 5'), questCard('Повтори'));
  check('задания дня: у закрытого задания кнопка «Забрать» вместо «Начать»', !claim && !!btnText('Забрать'), questCard('Повтори'));
  if (btnText('Забрать')) {
    click(btnText('Забрать'));
    await sleep(80);
  }
  check(
    'задания дня: награда за задание забрана',
    active().gems > gemsBefore && questCard('Повтори').includes('Награда получена'),
    `💎 ${gemsBefore} → ${active().gems}`,
  );

  // 8. Цель подстраивается под новичка: у профиля с двумя пройденными словами — «Повтори 2 слова»
  store().createProfile('Новичок', '🐣');
  await sleep(60);
  seedPractised(2, { due: false });
  await sleep(80);
  check(
    'задания дня: новичку с двумя словами цель — «Повтори 2 слова»',
    questCard('Повтори 2 слова') !== '' || !reviewInDay,
    questCard('Повтори') || `в наборе дня нет повторения (${specFor('review').title})`,
  );
}

const bodyText = () => (document.body.textContent ?? '').replace(/\s+/g, ' ').slice(0, 240);

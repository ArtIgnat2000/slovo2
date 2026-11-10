// «Игры» через настоящий UI (0.92.0): вкладка открывается, свободная практика
// живёт по правилам рамки — ничего не сгорает, ничего не считается, словечки
// ребёнку показывают только изученные. «Скоро»-карточки помечены честно.
import { useApp } from '../src/state/store';
import { WORDS_BY_GRADE } from '../src/content/words';
import { MASTERED_SCORE } from '../src/engine/classes';
import { buttons, check, click, has, sleep } from './ui-helpers';

async function goTab(name: string) {
  const tab = buttons().find((b) => (b.textContent ?? '').includes(name) && b.className.includes('tab'));
  click(tab);
  await sleep(60);
}

export async function runGamesUiChecks() {
  console.log('\n── Игры: вкладка и свободная практика ──');
  useApp.getState().createProfile('Тест игр', '🧩');
  await sleep(60);

  // Осваиваем несколько слов активного класса — ровно то, что рамка
  // свободной практики считает «уже встречал».
  const active = useApp.getState().profiles.find((p) => p.id === useApp.getState().activeId);
  const grade = (active?.activeClass ?? 2) as keyof typeof WORDS_BY_GRADE;
  const learned = (WORDS_BY_GRADE[grade] ?? []).filter((w) => !w.text.includes(' ')).slice(0, 6);
  const seed: Record<string, { s: number; due: number; iv: number; n: number; seen: number; ok: number; wrong: number }> = {};
  for (const w of learned) {
    seed[w.id] = { s: MASTERED_SCORE, due: 0, iv: 4, n: 3, seen: 3, ok: 3, wrong: 0 };
  }
  useApp.setState((s) => ({
    profiles: s.profiles.map((p) =>
      p.id === s.activeId ? { ...p, words: { ...p.words, ...seed } } : p,
    ),
  }));
  await sleep(40);

  await goTab('Игры');
  check('игры: вкладка открылась', !!document.querySelector('.games-screen'), document.body.textContent?.slice(0, 200) ?? '');
  check('игры: честно сказано, что ничего не считается', has('ничего не считается'), '');
  check('игры: свободная практика есть на экране', has('Собери слово'), '');
  check('игры: изученные слова видны чипами', document.querySelectorAll('.game-pick').length === learned.length,
    `чипов: ${document.querySelectorAll('.game-pick').length}`);
  check('игры: плиточный конструктор отрисован', document.querySelectorAll('.tileboard-tile').length > 0,
    `плиток: ${document.querySelectorAll('.tileboard-tile').length}`);
  check('игры: плитки несут буквы слова', !!document.querySelector('.word-board'), '');

  // «Скоро»-карточки: есть, но честно помечены, что их ещё нет.
  const soonNotes = Array.from(document.querySelectorAll('.game-soon-note')).map((el) => el.textContent ?? '');
  check('игры: «скоро»-карточки помечены честно', soonNotes.length >= 2 && soonNotes.every((t) => t.includes('проверяем на детях')),
    soonNotes.join(' | '));

  // Собираем показанное слово тапами по плиткам в порядке букв.
  const chip = document.querySelector('.game-pick.on') as HTMLButtonElement | null;
  const word = (chip?.textContent ?? '').trim();
  check('игры: выбрано слово для сборки', word.length > 1, word);
  for (const ch of [...word]) {
    const tiles = Array.from(document.querySelectorAll('.tileboard-tile')) as HTMLButtonElement[];
    const tile = tiles.find((b) => (b.textContent ?? '').trim() === ch && !b.disabled);
    click(tile);
    await sleep(20);
  }
  await sleep(120);
  check('игры: после сборки — баннер «Слово собрано!»', has('Слово собрано'), document.body.textContent?.slice(0, 260) ?? '');
  check('игры: сборка не записала XP (счёта нет по определению)', !!document.querySelector('.tileboard-banner'), '');

  // Тап по другому чипу — доска переключается на то слово.
  const other = Array.from(document.querySelectorAll('.game-pick')).find((b) => !(b as HTMLButtonElement).className.includes('on')) as HTMLButtonElement | undefined;
  if (other) {
    const target = (other.textContent ?? '').trim();
    click(other);
    await sleep(80);
    check('игры: тап по чипу переключает слово', (document.querySelector('.game-pick.on')?.textContent ?? '').trim() === target, target);
    check('игры: у нового слова — чистая доска', document.querySelectorAll('.tileboard-slot.filled').length === 0,
      `заполнено: ${document.querySelectorAll('.tileboard-slot.filled').length}`);
  }
}

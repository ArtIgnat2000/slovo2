// «Бродилка БУКа» — интеграционные проверки через настоящий UI.
// Чистые правила движка — в tests/board.test.ts; здесь проверяется то, что видно
// только в сборке:
//   • карточка игры на главной открывает экран игры, маршрут нарисован целиком;
//   • кубик ведёт БУКа вперёд, станция предлагает собрать слово;
//   • буква-«шпион» не встаёт в слово и объясняет правило;
//   • собранное слово приносит станцию, кристаллы, XP и запись в SRS;
//   • привал и повторный визит платят по правилам движка;
//   • маршрут проходится до конца, награда за финиш не повторяется,
//     «заново» сохраняет открытые станции.
// Блок запускается из tests/smoke.test.tsx и сеет профиль сам.
import { WORDS } from '../src/content/words';
import {
  BOARD,
  BOARD_REWARDS,
  cellAt,
  posOfLesson,
  stationWord,
} from '../src/engine/board';
import { dayKey, useApp } from '../src/state/store';
import type { Profile } from '../src/types';
import { btnText, buttons, check, click, has, sleep } from './ui-helpers';

const store = () => useApp.getState();

function active(): Profile {
  const s = store();
  const p = s.profiles.find((x) => x.id === s.activeId);
  if (!p) throw new Error('бродилка: нет активного профиля');
  return p;
}

/** Постелить активному профилю состояние игры — предусловие сценария. */
function seedGame(patch: Partial<NonNullable<Profile['game']>>) {
  useApp.setState((s) => ({
    profiles: s.profiles.map((p) =>
      p.id === s.activeId
        ? { ...p, game: { pos: 0, claimed: [], rolls: 0, ...(p.game ?? {}), ...patch } }
        : p,
    ),
  }));
}

/** Открыть игру с главной: карточка «Бродилка БУКа» в списке экранов. */
async function openGame() {
  const card = buttons().find((b) => (b.textContent ?? '').includes('Бродилка БУКа'));
  click(card);
  await sleep(80);
}

/** Собрать слово в текущем задании «Собери» — тапами по нужным буквам.
 *  Плитки-шпионы и уже использованные пропускаем: клик по ним — не ошибка,
 *  но и слово они не собирают. */
async function assemble(word: string) {
  for (const ch of word) {
    const tile = buttons().find(
      (b) =>
        b.className.includes('letter') &&
        (b.textContent ?? '') === ch &&
        !b.className.includes('used') &&
        b.getAttribute('data-spy') !== '1',
    );
    click(tile);
    await sleep(20);
  }
  // Build откладывает onSolve на 700 мс — ждём вердикт и награду
  await sleep(1000);
}

export async function runBoardGameChecks() {
  console.log('\n── Бродилка БУКа: игра в приложении ──');

  store().createProfile('Тест игры', '🎲');
  await sleep(80);

  // ── 1. Вход в игру с главной ──────────────────────────────────────────────
  check('бродилка: карточка игры есть на главной', has('Бродилка БУКа'));
  await openGame();
  check('бродилка: экран игры открылся', has('Бросить кубик'));
  check(
    'бродилка: на маршруте столько клеток, сколько в движке',
    document.querySelectorAll('.game-cell').length === BOARD.length,
  );
  check(
    'бродилка: привалы отрисованы',
    document.querySelectorAll('.game-cell.prival').length === BOARD.filter((c) => c.kind === 'prival').length,
  );
  check('бродилка: у нового профиля станции закрыты', !has('станция открыта'));

  // ── 2. Кубик ведёт вперёд и открывает станцию ─────────────────────────────
  // С начала маршрута первые три клетки — станции, поэтому любой бросок 1..3
  // гарантированно приводит к станции: тест детерминирован без подмены кубика.
  seedGame({ pos: 0 });
  await sleep(60);
  click(btnText('Бросить кубик'));
  await sleep(1600); // раскрутка кубика + шаги БУКа
  const afterRoll = active().game!;
  check('бродилка: кубик сдвинул БУКа вперёд и не дальше трёх', afterRoll.pos >= 1 && afterRoll.pos <= 3, `pos=${afterRoll.pos}`);
  check('бродилка: бросок записан', afterRoll.rolls === 1);
  check('бродилка: станция предложила собрать слово', has('Собери слово из букв'));
  check('бродилка: видно, что проиграть нельзя', has('Ошибиться тут нельзя'));

  const lessonId = cellAt(afterRoll.pos)!.lessonId!;
  check('бродилка: станция стоит на своей клетке маршрута', posOfLesson(lessonId) === afterRoll.pos);

  // ── 3. Буква-шпион не встаёт в слово ──────────────────────────────────────
  const spyTile = document.querySelector('[data-spy="1"]') as HTMLButtonElement | null;
  check('бродилка: среди плиток есть буква-шпион', !!spyTile);
  if (spyTile) {
    const filled = document.querySelectorAll('.slot.filled').length;
    click(spyTile);
    await sleep(60);
    check('бродилка: шпион не занял место в слове', document.querySelectorAll('.slot.filled').length === filled);
    check('бродилка: про шпиона сказано ребёнку', has('буква-шпион'));
  }

  // ── 4. Собранное слово открывает станцию и идёт в прогресс ────────────────
  const expectedWord = stationWord(lessonId, WORDS, active().words)!;
  const before = active();
  await assemble(expectedWord.text);
  const after = active();
  check('бродилка: станция отмечена открытой', after.game!.claimed.includes(lessonId));
  check('бродилка: за станцию начислены кристаллы', after.gems >= before.gems + BOARD_REWARDS.station, `+${after.gems - before.gems}`);
  check('бродилка: за собранное слово начислен XP', after.xp > before.xp);
  check(
    'бродилка: слово ушло в SRS, а не только в игру',
    (after.words[expectedWord.id]?.s ?? 0) > (before.words[expectedWord.id]?.s ?? 0),
  );
  check('бродилка: день учтён, серия честная', (after.days[dayKey()]?.correct ?? 0) > 0);
  check('бродилка: после станции снова можно бросать кубик', has('Бросить кубик'));

  // ── 5. Награды: повторный визит и привал ──────────────────────────────────
  // То же правило, что вызывает экран после сборки слова: повтор платит меньше.
  const again = store().gameClaim(lessonId);
  check('бродилка: повторный визит платит меньше', !again.first && again.gems === BOARD_REWARDS.replay);
  // Свежая станция (та, что ещё не открыта): первое «взятие» платит полную награду
  const freshLesson = BOARD.find(
    (c) => c.kind === 'station' && !active().game!.claimed.includes(c.lessonId!),
  )!.lessonId!;
  const first = store().gameClaim(freshLesson);
  check('бродилка: первый заход платит полную награду', first.first && first.gems === BOARD_REWARDS.station);

  // Привал: клетка перед ним — станция, поэтому помечаем её открытой: иначе
  // игра (по замыслу) предложила бы доделать станцию прежде, чем идти дальше.
  const privalIdx = BOARD.findIndex((c) => c.kind === 'prival') + 1;
  seedGame({ pos: privalIdx - 1, claimed: [BOARD[privalIdx - 2].lessonId!] });
  await sleep(60);
  const gemsBeforePrival = active().gems;
  const privalOut = store().gameRoll(1); // ровно один шаг — на привал
  check('бродилка: привал — это клетка отдыха', privalOut.cell?.kind === 'prival');
  check('бродилка: привал начислил кристаллы', active().gems === gemsBeforePrival + BOARD_REWARDS.prival);
  check('бродилка: на привал слово не спрашивают', privalOut.cell?.lessonId === undefined);

  // ── 6. Финиш: награда один раз, «заново» сохраняет станции ───────────────
  const lastStation = [...BOARD].reverse().find((c) => c.kind === 'station')!;
  seedGame({ pos: BOARD.length - 1, claimed: [lastStation.lessonId!], finishedAt: undefined });
  await sleep(80);
  check('бродилка: на своей станции кубик свободен', !!btnText('Бросить кубик'));
  const gemsBeforeFinish = active().gems;
  click(btnText('Бросить кубик'));
  await sleep(1600);
  const finished = active();
  check('бродилка: последняя клетка бесплатна — задание не открывается', !has('Собери слово из букв'));
  check('бродилка: финиш начислил награду', finished.gems === gemsBeforeFinish + BOARD_REWARDS.finish, `+${finished.gems - gemsBeforeFinish}`);
  check('бродилка: финиш записан в профиль', !!finished.game!.finishedAt);
  check('бродилка: на финише предлагают пройти заново', has('Пройти маршрут заново'));

  const afterFinishGems = finished.gems;
  const rollsAtFinish = finished.game!.rolls;
  const idleRoll = store().gameRoll(3);
  check('бродилка: за повторный финиш награду не платят дважды', active().gems === afterFinishGems);
  check('бродилка: бросок на финише не двигает БУКа и не считается', !idleRoll.finished && active().game!.rolls === rollsAtFinish);

  click(btnText('Пройти маршрут заново'));
  await sleep(80);
  check(
    'бродилка: «заново» возвращает кубик в начало, станции остаются',
    active().game!.pos === 0 && active().game!.rolls === 0 && active().game!.claimed.includes(lastStation.lessonId!),
  );
  click(btnText('Домой'));
  await sleep(80);
  check('бродилка: выход возвращает на главную', has('Цель дня'));
}

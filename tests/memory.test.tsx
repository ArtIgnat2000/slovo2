import './setup';
import { createRoot } from 'react-dom/client';
import { buildMemory, emptyMemory, flipMemory, closeMemory, memoryWon } from '../src/engine/memory';
import { WORDS_BY_GRADE } from '../src/content/words';
import { MemoryGame } from '../src/ui/MemoryGame';
import { useApp } from '../src/state/store';
import { check, click, sleep } from './ui-helpers';

export async function runMemoryChecks() {
  console.log('\n── Мемори: пары, ходы, UI ──');
  for (const grade of [1, 2, 3, 4, 5] as const) {
    const pool = WORDS_BY_GRADE[grade];
    const board = buildMemory(pool, grade, 42)!;
    check(`мемори ${grade}: шесть однозначных пар`, board?.words.length === 6 && board.cards.length === 12, '');
    check(`мемори ${grade}: детерминированная раскладка`, JSON.stringify(board) === JSON.stringify(buildMemory(pool, grade, 42)), '');
    check(`мемори ${grade}: верный режим`, board.cards.filter(c => c.face === (grade === 5 ? 'hint' : 'image')).length === 6, '');
    const next = buildMemory(pool, grade, 43, board.nextCursor, board.words.map(w => w.id))!;
    check(`мемори ${grade}: новая партия меняет слова`, next.words.every(w => !board.words.some(old => old.id === w.id)), '');
    let state = emptyMemory();
    const first = board.cards[0];
    state = flipMemory(board, state, first.id);
    check('мемори: двойной тап игнорируется', flipMemory(board, state, first.id) === state, '');
    const wrong = board.cards.find(c => c.word.id !== first.word.id)!;
    state = flipMemory(board, state, wrong.id);
    check('мемори: третий тап заблокирован', flipMemory(board, state, board.cards[2].id) === state, '');
    state = closeMemory(state);
    for (const word of board.words) for (const card of board.cards.filter(c => c.word.id === word.id)) state = flipMemory(board, state, card.id);
    check('мемори: партия решается, найденные пары не открываются повторно', memoryWon(board, state) && flipMemory(board, state, first.id) === state, '');
  }
  const pool = WORDS_BY_GRADE[5].slice(0, 8);
  const collision = pool.map((w, i) => i < 2 ? { ...w, hint: ' Одинаковая   подсказка ' } : w);
  check('мемори: обе неоднозначные подсказки исключены', buildMemory(collision, 5, 1)!.words.every(w => w.id !== pool[0].id && w.id !== pool[1].id), '');
  check('мемори: пустой пул безопасен', buildMemory([], 5, 1) === null, '');

  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const original = useApp.getState().playGame;
  let calls = 0;
  useApp.setState({ playGame: () => { calls++; return { xp: 0, gems: 0 }; } });
  const id = useApp.getState().activeId!;
  try {
    root.render(<MemoryGame pool={pool} grade={5} profileId={id} priorityIds={[]} onGoLessons={() => {}} />);
    await sleep(60);
    const cards = () => Array.from(host.querySelectorAll<HTMLButtonElement>('.memory-card'));
    check('мемори UI: закрытые карточки не раскрывают слова диктору', cards().length === 12 && cards().every(c => /закрыта/.test(c.getAttribute('aria-label') ?? '') && !c.querySelector('.word-big')), '');
    const first = cards()[0]; click(first); click(first); await sleep(20);
    check('мемори UI: быстрый двойной тап открывает только одну', cards().filter(c => c.getAttribute('aria-pressed') === 'true').length === 1, '');
    const pairId = first.dataset.memoryId!.split(':')[0];
    const other = cards().find(c => !c.dataset.memoryId!.startsWith(pairId + ':'))!;
    click(other); await sleep(20); click(cards()[2]); await sleep(20);
    check('мемори UI: несовпадение держит две карточки', cards().filter(c => c.getAttribute('aria-pressed') === 'true').length === 2, '');
    await sleep(1050);
    check('мемори UI: несовпадение закрывается', cards().every(c => c.getAttribute('aria-pressed') === 'false'), '');
    const help = Array.from(host.querySelectorAll('button')).find(b => b.textContent?.includes('Показать пару'))!;
    click(help); await sleep(30);
    check('мемори UI: подсказка показывает пару без награды', cards().filter(c => c.getAttribute('aria-pressed') === 'true').length === 2 && calls === 0, '');
    await sleep(1850);
    const ids = [...new Set(cards().map(c => c.dataset.memoryId!.split(':')[0]))];
    for (const wordId of ids) {
      for (const card of cards().filter(c => c.dataset.memoryId!.startsWith(wordId + ':'))) click(card);
      await sleep(30);
    }
    check('мемори UI: победа и одно начисление даже при нулевой награде', !!host.querySelector('.memory-win') && calls === 1, `calls=${calls}`);
    click(cards()[0]); await sleep(20);
    check('мемори UI: найденная карточка не начисляет награду повторно', calls === 1, '');
    click(Array.from(host.querySelectorAll('button')).find(b => b.textContent?.includes('Ещё партию'))!); await sleep(40);
    check('мемори UI: новая партия чистая, награда не повторяется', !host.querySelector('.memory-win') && cards().every(c => c.getAttribute('aria-pressed') === 'false') && calls === 1, '');
    click(cards()[0]); click(cards().find(c => c.dataset.memoryId!.split(':')[0] !== cards()[0].dataset.memoryId!.split(':')[0])!);
    await sleep(20); // Unmount with an active mismatch timer; cleanup must cancel it.
  } finally { root.unmount(); host.remove(); useApp.setState({ playGame: original }); }
}

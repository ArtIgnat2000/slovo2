import './setup';
import { check } from './ui-helpers';
import { recordGridWin, recordsSnapshot, parseRecords } from '../src/platform/game-records';

export function runGameRecordsChecks() {
  const a = 'records-test-a', b = 'records-test-b';
  const read = (id = a) => parseRecords(recordsSnapshot(id));
  const key = 'slovo2-game-records:';
  window.localStorage.removeItem(key + a);
  window.localStorage.removeItem(key + b);
  check('рекорды: пустой профиль', read().search.completed === 0, '');
  recordGridWin(a, 'search', 'one', 7);
  recordGridWin(a, 'search', 'one', 7);
  check('рекорды: повторный финал не засчитан', read().search.completed === 1, '');
  recordGridWin(a, 'search', 'two', 4);
  recordGridWin(a, 'crossword', 'three', 5);
  check('рекорды: максимум, а не последний результат', read().search.best === 7 && read().search.completed === 2, '');
  check('рекорды: отдельные игры и профили', read().crossword.best === 5 && read(b).search.completed === 0, '');
  check('рекорды: читаются заново из хранилища', JSON.parse(window.localStorage.getItem(key + a)!).search.completed === 2, '');
  for (const words of [0, -1, NaN, Infinity, 1.5]) recordGridWin(a, 'search', 'invalid', words);
  check('рекорды: неверный размер не засчитывается', read().search.completed === 2, '');
  for (const raw of ['null', '[]', '{', '{"search":{"completed":-1,"best":7}}']) {
    window.localStorage.setItem(key + b, raw);
    check('рекорды: повреждённое хранилище безопасно', read(b).search.completed === 0, raw);
    check('рекорды: запись восстанавливается', recordGridWin(b, 'search', 'repair', 3), raw);
  }
  const proto = Object.getPrototypeOf(window.localStorage);
  const setItem = proto.setItem;
  try {
    proto.setItem = () => { throw new Error('quota'); };
    check('рекорды: сбой записи не прерывает игру', !recordGridWin(a, 'search', 'failed', 9), '');
    check('рекорды: не показываем несохранённый рекорд', read().search.best === 7, '');
  } finally { proto.setItem = setItem; }
  window.localStorage.removeItem(key + a);
  window.localStorage.removeItem(key + b);
}

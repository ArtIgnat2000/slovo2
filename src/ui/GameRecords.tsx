import { useMemo, useSyncExternalStore } from 'react';
import { GAME_RECORDS_EVENT, parseRecords, recordsSnapshot, type GridGame } from '../platform/game-records';

function subscribe(notify: () => void) {
  window.addEventListener(GAME_RECORDS_EVENT, notify);
  window.addEventListener('storage', notify);
  return () => {
    window.removeEventListener(GAME_RECORDS_EVENT, notify);
    window.removeEventListener('storage', notify);
  };
}
function useRecords(profileId: string) {
  const raw = useSyncExternalStore(subscribe, () => recordsSnapshot(profileId), () => '');
  return useMemo(() => parseRecords(raw), [raw]);
}
export function GameBest({ profileId, game }: { profileId: string; game: GridGame }) {
  const records = useRecords(profileId);
  return records[game].best > 0
    ? <p className="tiny muted">Лучшая сетка · слов: {records[game].best}</p> : null;
}
export function GameRecords({ profileId, detailed = false }: { profileId: string; detailed?: boolean }) {
  const records = useRecords(profileId);
  const total = records.search.completed + records.crossword.completed;
  if (!detailed) return total > 0 ? <p className="tiny muted">Завершено сеток: {total}</p> : null;
  return <section className="card" aria-label="Рекорды игр">
    <h3>Рекорды игр</h3>
    <p>Завершено сеток: {total}</p>
    {(['search', 'crossword'] as const).map(game => <p className="tiny" key={game}>
      {game === 'search' ? 'Филворд' : 'Кроссворд'}: {records[game].completed > 0
        ? `сеток — ${records[game].completed}, лучшая — ${records[game].best} слов`
        : 'пока нет завершённых сеток'}
    </p>)}
    <p className="tiny muted">Считаем с версии 0.100.0, только на этом устройстве. Рекорды не входят в резервную копию и не измеряют освоение слов.</p>
  </section>;
}

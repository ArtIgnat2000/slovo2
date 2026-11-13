/**
 * Дев-панель «все игры сразу» (0.107.0).
 *
 * Зачем. Проверять игры на телефоне и в песочнице долго: чтобы открыть
 * «Цветок слова», нужно закрыть весь план дня. Взрослый может снять шкалу
 * настройкой («Родителям → Настройки → Игры за успехи → все открыты»), но для
 * быстрой проверки нужен один тап рядом с экраном игр.
 *
 * Где видна. **Только там, где это нужно разработчику:**
 *  • `npm run dev` — всегда (импорт-мета окружение `development`);
 *  • любая сборка с `?dev=1` в адресе — так проверяют прод-бандл и песочницу.
 *
 * Почему не «всегда». Это переключатель доступа ребёнка к играм, и он не
 * должен появляться в установленном приложении на телефоне случайным тапом:
 * настройка взрослого для этого и существует. `?dev=1` всегда доступен тому,
 * кто знает адрес, — а ребёнок адрес не набирает.
 */
import { useApp } from '../../state/store';

/** Показать панель: дев-сервер или явный `?dev=1`. */
export function gamesDevPanelVisible(): boolean {
  try {
    if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) return true;
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('dev') === '1';
  } catch {
    return false;
  }
}

export function GamesDevPanel() {
  const gates = useApp((s) => s.settings.gamesGates);
  const setSettings = useApp((s) => s.setSettings);
  if (!gamesDevPanelVisible()) return null;
  const open = gates === 'open';
  return (
    <div className="card">
      <div className="games-dev">
        <button
          type="button"
          className={`btn ${open ? 'ghost' : 'primary'} sm`}
          data-games-dev={open ? 'off' : 'on'}
          onClick={() => setSettings({ gamesGates: open ? 'points' : 'open' })}
        >
          {open ? 'Вернуть шкалу доступа' : '🔓 Открыть все игры'}
        </button>
        <p className="games-dev-note">
          {open
            ? 'Сейчас открыты все игры — как увидит разработчик. Верните шкалу, чтобы проверить замки и условия.'
            : 'Для проверки: снимает шкалу доступа, все игры доступны сразу. Ребёнку это не нужно — у него работают шаги дня.'}
        </p>
      </div>
    </div>
  );
}

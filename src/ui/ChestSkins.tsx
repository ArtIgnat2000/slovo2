import { useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import type { Profile } from '../types';
import { skinStates, type ChestSkinId } from '../engine/chests';
import { Bar } from './Bits';
import { chestArtUrl } from './ChestArt';
import { sfx } from '../platform/sound';
import { haptic } from '../platform/haptics';

interface Props {
  profile: Profile;
  /** Облик, который ребёнок выбрал (подсвечиваем «Выбран») */
  active: ChestSkinId;
  /**
   * Облики, открывшиеся в этом заходе: их помечаем «новый». Приходит сверху,
   * потому что «открыт и записан» и «ребёнок ещё не видел полку» — разные вещи:
   * тост показывается один раз и запись делается сразу, а бейдж должен дожить
   * до конца захода.
   */
  fresh?: ChestSkinId[];
  onPick: (id: ChestSkinId) => void;
  onClose: () => void;
}

/**
 * «Облики сундука» — полка, где ребёнок выбирает, как сундук выглядит сегодня.
 *
 * Зачем отдельный экран, а не переключатель в карточке заданий: обликов четыре,
 * у каждого своё условие и прогресс до него. Идея «коллекция, а не настройка»
 * требует одного места, где видно всю полку целиком — что уже есть, что
 * открыто и что ещё предстоит (как витрина в магазине БУКа).
 *
 * Правила механики — в src/engine/chests.ts; здесь только представление.
 */
export function ChestSkins({ profile, active, fresh = [], onPick, onClose }: Props) {
  const states = skinStates(profile);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    onClose();
  };

  return (
    <div className="skin-sheet" role="dialog" aria-modal="true" aria-labelledby="skin-sheet-title" onKeyDown={handleKeyDown}>
      <div className="skin-sheet-inner">
        <div className="row mb">
          <div className="grow">
            <h2 id="skin-sheet-title" style={{ margin: 0 }}>
              Облики сундука 🎁
            </h2>
            <div className="tiny">
              Открывай новые за занятия. Какой выберешь — в таком сундук откроется сегодня.
            </div>
          </div>
          <button ref={closeRef} className="btn ghost sm" onClick={onClose}>
            Готово
          </button>
        </div>

        <div className="skin-grid">
          {states.map(({ skin, unlocked, done, left }) => {
            const chosen = unlocked && skin.id === active;
            return (
              <button
                key={skin.id}
                type="button"
                className={`skin-card ${chosen ? 'on' : ''} ${unlocked ? 'open' : 'locked'}`}
                aria-pressed={chosen}
                disabled={!unlocked}
                onClick={() => {
                  if (!unlocked || chosen) return;
                  sfx.tap();
                  haptic.tap();
                  onPick(skin.id);
                }}
              >
                <span className="skin-preview" aria-hidden="true">
                  <img src={chestArtUrl(skin.id, 'closed')} alt="" draggable={false} />
                  {!unlocked && <span className="skin-lock">🔒</span>}
                </span>
                <span className="skin-title">
                  {skin.title}
                  {fresh.includes(skin.id) && <span className="skin-new"> ✨ новый</span>}
                </span>
                {unlocked ? (
                  <span className={`skin-state ${chosen ? 'chosen' : ''}`}>
                    {chosen ? 'Выбран ✓' : 'Выбрать'}
                  </span>
                ) : (
                  <>
                    <span className="skin-how">{skin.how}</span>
                    <Bar value={(done / Math.max(1, skin.need)) * 100} tone="orange" />
                    <span className="skin-left">
                      {done} из {skin.need} · осталось {left}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>

        <p className="tiny center" style={{ marginTop: 14 }}>
          Облики не покупаются и не сгорают: открыл — значит навсегда, даже если серия дней прервалась.
        </p>
      </div>
    </div>
  );
}

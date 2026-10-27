import { ITEM_BY_ID, toysByShelf, type ShopItem, type ToyKind } from '../engine/shop';
import type { ShopSlot, ShopTuning } from '../types';
import { Mascot } from './Mascot';
import { ToyArt } from './ToyArt';

/**
 * Витрина техники (0.19.0).
 *
 * Сцена магазина по референсу детского бутика: слева мятный гараж с машиной
 * на комоде-подиуме, в центре лавандовая витрина с телефонами, справа голубая
 * арка с морем, пирсом и кораблём. Порядок арок повторяет полки: авто →
 * телефоны → корабли. Рядом с каждой аркой — бумажная бирка
 * с миниатюрой вещи и ценой, как в референсе. Перед арками на коврике стоит
 * БУК — хозяин магазина.
 *
 * Каждая арка — кнопка: тап открывает ту же подробную карточку, что и полка.
 * Никаких новых правил покупки сцена не добавляет.
 */

/** Тон арки/панели: гараж (авто), море (корабли), лавандовая витрина (телефоны). */
export type Tone = 'car' | 'plane' | 'ship' | 'phone';

const BAYS: { kind: ToyKind; tone: Tone; label: string; fallback: string }[] = [
  { kind: 'car', tone: 'car', label: 'Авто', fallback: 'car-bmw' },
  { kind: 'plane', tone: 'plane', label: 'Самолёты', fallback: 'plane-swift' },
  { kind: 'phone', tone: 'phone', label: 'Телефоны', fallback: 'phone-smart' },
  { kind: 'ship', tone: 'ship', label: 'Корабли', fallback: 'ship-sail' },
];

/** Пирс: настил из досок на сваях и две тумбы — как в референсе. */
function PierArt() {
  return (
    <svg className="tech-pier" viewBox="0 0 100 56" aria-hidden="true" focusable="false">
      <g fill="var(--stage-wood-2)">
        <rect x="9" y="24" width="7" height="30" rx="2.5" />
        <rect x="45" y="26" width="7" height="28" rx="2.5" />
        <rect x="81" y="24" width="7" height="30" rx="2.5" />
      </g>
      <rect x="0" y="18" width="100" height="13" rx="3" fill="var(--stage-wood)" />
      <g stroke="var(--stage-wood-2)" strokeWidth="1.6" opacity=".5">
        <path d="M22 19v11M44 19v11M66 19v11M88 19v11" />
      </g>
      <rect x="0" y="18" width="100" height="3.5" rx="1.75" fill="#ffffff" opacity=".3" />
      <g fill="var(--stage-wood-2)">
        <rect x="7" y="7" width="9" height="13" rx="3.5" />
        <rect x="84" y="7" width="9" height="13" rx="3.5" />
      </g>
      <g fill="#ffffff" opacity=".32">
        <rect x="9" y="9" width="5" height="3" rx="1.5" />
        <rect x="86" y="9" width="5" height="3" rx="1.5" />
      </g>
    </svg>
  );
}

/** Декор внутри арки: гараж, море с пирсом или полки витрины.
 *  Экспортирован для сцены «Ангар» (0.22.0) — тот же визуальный язык. */
export function BayDecor({ tone }: { tone: Tone }) {
  if (tone === 'car') {
    return (
      <>
        <span className="tech-garage" />
        <span className="tech-lamps">
          <i />
          <i />
          <i />
        </span>
      </>
    );
  }
  if (tone === 'plane') {
    return <span className="tech-runway" aria-hidden="true"><i /><i /><i /><i /></span>;
  }
  if (tone === 'ship') {
    return (
      <>
        <PierArt />
        <span className="tech-waves" />
      </>
    );
  }
  return (
    <>
      <span className="tech-shelf tech-shelf-1" />
      <span className="tech-shelf tech-shelf-2" />
    </>
  );
}

/** Дерево у левого края сцены и растение у правого — как в референсе. */
function SceneDecor() {
  return (
    <>
      <span className="tech-cloud tech-cloud-a" aria-hidden="true" />
      <span className="tech-cloud tech-cloud-b" aria-hidden="true" />
      <span className="tech-cloud tech-cloud-c" aria-hidden="true" />
      <svg className="tech-tree" width="54" height="78" viewBox="0 0 54 78" aria-hidden="true" focusable="false">
        <path d="M25 78V46l-5 12M29 78V48l5 10" stroke="var(--stage-wood-2)" strokeWidth="4" strokeLinecap="round" fill="none" />
        <circle cx="14" cy="34" r="14" fill="var(--stage-leaf-2)" />
        <circle cx="34" cy="26" r="16" fill="var(--stage-leaf)" />
        <circle cx="27" cy="44" r="14" fill="var(--stage-leaf-3)" />
      </svg>
      <svg className="tech-plant" width="38" height="56" viewBox="0 0 38 56" aria-hidden="true" focusable="false">
        <path d="M19 36C12 30 8 18 12 8c7 6 10 20 7 28Z" fill="var(--stage-leaf)" />
        <path d="M20 36c7-6 11-16 8-26-7 6-11 18-8 26Z" fill="var(--stage-leaf-2)" />
        <path d="M19 34c-8 2-14-6-13-14 7-1 12 6 13 14Z" fill="var(--stage-leaf-3)" />
        <path d="M8 36h22l-3 18H11Z" fill="var(--stage-lav-frame-2)" />
        <path d="M8 36h22l-1 5H9Z" fill="var(--stage-lav-frame)" />
      </svg>
    </>
  );
}

export function TechScene({
  onOpen,
  owned,
  look,
  tuning,
}: {
  onOpen: (item: ShopItem) => void;
  owned: string[];
  look: Partial<Record<ShopSlot, string>>;
  /** Тюнинг: машина на витрине показывает выбранный «цветной карандаш» */
  tuning?: ShopTuning;
}) {
  return (
    <div className="tech-stage" role="group" aria-label="Витрина техники БУКа">
      <SceneDecor />
      <div className="tech-bays">
        {BAYS.map(({ kind, tone, label, fallback }) => {
          // Если с полки уже что-то взято — показываем именно эту вещь:
          // витрина отражает коллекцию, а не застывший каталог.
          const shelf = toysByShelf(kind);
          const taken = shelf.filter((i) => owned.includes(i.id));
          const item = taken[taken.length - 1] ?? ITEM_BY_ID[fallback];
          if (!item) return null;
          const isOwned = owned.includes(item.id);
          return (
            <button
              type="button"
              key={kind}
              className={`tech-bay tech-bay-${tone}`}
              aria-label={`${label}: ${item.title}, ${item.price} кристаллов`}
              onClick={() => onOpen(item)}
            >
              <span className="tech-arch">
                <span className="tech-panel">
                  <BayDecor tone={tone} />
                </span>
                <span className="tech-item">
                  <ToyArt id={item.id} size={100} tuning={tuning} />
                </span>
                <span className="tech-plinth" aria-hidden="true" />
              </span>
              <span className={`tech-tag${isOwned ? ' owned' : ''}`} aria-hidden="true">
                <ToyArt id={item.id} size={24} tuning={tuning} />
                <b>{isOwned ? '✓' : `💎 ${item.price}`}</b>
              </span>
            </button>
          );
        })}
      </div>
      <span className="tech-floor" aria-hidden="true" />
      <div className="tech-buk" aria-hidden="true">
        <Mascot mood="happy" look={look} stage={2} size={88} />
      </div>
    </div>
  );
}

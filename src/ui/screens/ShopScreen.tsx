import { useState } from 'react';
import { masteredCount, useActiveProfile, useApp, useLook } from '../../state/store';
import {
  SHOP_ITEMS,
  SLOT_TITLE,
  canBuy,
  closestItem,
  growthStage,
  isOwned,
  isWearing,
  missingGems,
  wardrobeValue,
} from '../../engine/shop';
import { Mascot } from '../Mascot';
import { ConfirmDialog } from '../Bits';
import { sfx } from '../../platform/sound';
import { haptic } from '../../platform/haptics';
import type { ShopItem } from '../../engine/shop';

/**
 * Магазин БУКа (пункт 4 плана).
 *
 * Решения:
 *  • продаём «аксессуары БУКа» — трата кристаллов даёт видимую награду
 *    (наряженная сова и в уроках, и на главной);
 *  • вход — отдельная вкладка внизу (на главной уже плотно: цель, задания, путь);
 *  • покупка — через тот же ConfirmDialog, что и выход из урока: промах пальцем
 *    не должен тратить кристаллы, которые ребёнок копил несколько дней;
 *  • купленное сразу надевается: лишний тап для «надеть» не нужен.
 */
export function ShopScreen() {
  const profile = useActiveProfile();
  const look = useLook();
  const buyItem = useApp((s) => s.buyItem);
  const toggleEquip = useApp((s) => s.toggleEquip);
  const showToast = useApp((s) => s.showToast);
  const [ask, setAsk] = useState<ShopItem | null>(null);
  const [mood, setMood] = useState<'idle' | 'happy' | 'dance'>('idle');

  if (!profile) return null;

  const owned = profile.shop?.owned ?? [];
  const gems = profile.gems;
  const mastered = masteredCount(profile);
  const growth = growthStage(mastered);
  const next = closestItem(owned);
  const left = next ? missingGems(next, gems) : 0;

  const confirmBuy = () => {
    if (!ask) return;
    const ok = buyItem(ask.id);
    setAsk(null);
    if (ok) {
      sfx.reward();
      haptic.correct();
      setMood('dance');
      setTimeout(() => setMood('idle'), 1800);
      showToast({ emoji: '🎩', title: `${ask.title} — твой!`, text: 'БУК уже примерил обновку' });
    } else {
      showToast({ emoji: '💎', title: 'Не хватает кристаллов', text: `Нужно ещё ${missingGems(ask, gems)}` });
    }
  };

  const tapWear = (item: ShopItem) => {
    sfx.tap();
    haptic.tap();
    toggleEquip(item.id);
    setMood('happy');
    setTimeout(() => setMood('idle'), 1200);
  };

  return (
    <div className="screen">
      <div className="row mb">
        <h1 className="grow" style={{ margin: 0 }}>
          Магазин БУКа 🎩
        </h1>
        <div className="stat-pill gems">💎 {gems}</div>
      </div>

      <div className="card mb shop-stage">
        <button
          className="shop-mascot"
          aria-label="Погладить БУКа"
          onClick={() => {
            sfx.hint();
            haptic.tap();
            setMood('dance');
            setTimeout(() => setMood('idle'), 1600);
          }}
        >
          <Mascot mood={mood} look={look} stage={growth.index} size={132} />
        </button>
        <div className="grow center">
          <div style={{ fontWeight: 800 }}>
            {growth.title} · {owned.length ? 'наряд БУКа' : 'без обновок'}
          </div>
          <div className="tiny">{growth.desc}</div>
          <div className="tiny" style={{ marginTop: 4 }}>
            {growth.nextAt
              ? `Освоено ${mastered} слов · до ступени выше ${growth.nextAt - mastered}`
              : `Освоено ${mastered} слов — самая высокая ступень ✨`}
          </div>
          <div className="tiny" style={{ marginTop: 4 }}>
            {next
              ? left > 0
                ? `Ещё ${left} 💎 — и купишь «${next.title}»`
                : `Хватает на «${next.title}»!`
              : 'Весь гардероб собран ✨'}
            {' · '}куплено на {wardrobeValue(owned)} 💎
          </div>
        </div>
      </div>

      {(Object.keys(SLOT_TITLE) as (keyof typeof SLOT_TITLE)[]).map((slot) => {
        const items = SHOP_ITEMS.filter((i) => i.slot === slot);
        if (!items.length) return null;
        return (
          <div key={slot} className="mb">
            <h2 className="mb">{SLOT_TITLE[slot]}</h2>
            <div className="shop-grid">
              {items.map((item) => {
                const owned_ = isOwned(owned, item.id);
                const wearing = isWearing(look, item);
                const affordable = canBuy(item, gems);
                return (
                  <div key={item.id} className={`shop-item ${wearing ? 'on' : ''} ${owned_ ? 'owned' : ''}`}>
                    <div className="shop-icon">
                      <Mascot mood="idle" look={{ [item.slot]: item.id }} stage={growth.index} size={64} />
                    </div>
                    <div className="shop-title">{item.title}</div>
                    <div className="tiny shop-desc">{item.desc}</div>
                    {owned_ ? (
                      <button className={`btn sm wide ${wearing ? 'green' : 'ghost'}`} onClick={() => tapWear(item)}>
                        {wearing ? 'Надето ✓' : 'Надеть'}
                      </button>
                    ) : (
                      <button
                        className={`btn sm wide ${affordable ? 'primary' : 'ghost'}`}
                        disabled={!affordable}
                        onClick={() => {
                          sfx.tap();
                          setAsk(item);
                        }}
                      >
                        {affordable ? `Купить · 💎${item.price}` : `Ещё ${missingGems(item, gems)} 💎`}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <p className="tiny center">
        Кристаллы 💎 дают за задания дня и сундук — загляни на главную.
        <br />
        БУК растёт, когда ты осваиваешь слова: сейчас — {growth.title.toLowerCase()}.
      </p>

      {ask && (
        <ConfirmDialog
          emoji="🎩"
          title={`Купить «${ask.title}»?`}
          text={`Отдашь ${ask.price} 💎 из ${gems}. БУК сразу это примерит.`}
          stayLabel={`Купить за 💎${ask.price}`}
          leaveLabel="Не сейчас"
          onStay={confirmBuy}
          onLeave={() => setAsk(null)}
        />
      )}
    </div>
  );
}

import { useEffect } from 'react';
import { ITEM_BY_ID, TOY_SHELVES, growthStage, isOwned, toysByShelf, type ShopItem } from '../engine/shop';
import { haptic } from '../platform/haptics';
import { sfx } from '../platform/sound';
import { masteredCount, useActiveProfile, useApp, useLook } from '../state/store';
import { Mascot } from './Mascot';
import { BayDecor } from './TechScene';
import { ToyArt } from './ToyArt';

/**
 * «Ангар БУКа» (0.22.0) — сцена коллекции техники.
 *
 * Пользователь пожаловался: купленные машины и другие крупные товары не
 * следует отображать на БУКе. Решение — docs/proposals/large-items-scene.md
 * (принято пользователем 2026-10-19): ВСЯ техника (авто, телефоны, корабли)
 * больше не рисуется на маскоте (правило `showsOnBuk` в engine/shop.ts) и
 * экспонируется здесь:
 *  • любимая вещь (`equipped.toy`) — на главном подиуме со звездой;
 *  • остальная коллекция — по полкам в порядке витрины: авто → телефоны →
 *    корабли, каждая вещь на своём подиуме с бумажной биркой;
 *  • БУК стоит на коврике рядом — хозяин коллекции, а не подставка.
 *
 * Визуальный язык — тот же, что у витрины техники (TechScene, 0.19.0):
 * панели арок с гаражом, пирсом и волнами, полки, лампы, бирки, коврик;
 * поэтому ангар наследует все пять оформлений приложения (--stage-*,
 * --case-*, --tag-*).
 *
 * Тап по вещи — «на подиум» / «с подиума»: слот `equipped.toy` с 0.22.0
 * означает «любимая вещь ангара». Профиль не мигрируется: у старых профилей
 * машина в `equipped.toy` просто встаёт на подиум и уходит с совы. Краски
 * (🎨 1 💎 за оттенок) — как раньше, в подробной карточке магазина.
 */
export function HangarScene({ onClose }: { onClose: () => void }) {
  const profile = useActiveProfile();
  const look = useLook();
  const toggleEquip = useApp((s) => s.toggleEquip);
  const showToast = useApp((s) => s.showToast);

  /** Escape закрывает ангар — как любой sheet в магазине. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!profile) return null;

  const owned = profile.shop?.owned ?? [];
  const tuning = profile.shop?.tuning;
  const favoriteId = look.toy && owned.includes(look.toy) ? look.toy : null;
  const favorite = favoriteId ? ITEM_BY_ID[favoriteId] ?? null : null;
  const growth = growthStage(masteredCount(profile));
  const hasToys = TOY_SHELVES.some((shelf) => toysByShelf(shelf.id).some((item) => isOwned(owned, item.id)));

  /** Тап по вещи: ставим на главный подиум или убираем с него. */
  const tapItem = (item: ShopItem) => {
    sfx.tap();
    haptic.tap();
    const wasFavorite = favoriteId === item.id;
    toggleEquip(item.id);
    showToast(
      wasFavorite
        ? {
            emoji: item.emoji ?? '🚗',
            title: `«${item.title}» — с подиума`,
            text: 'Главный подиум свободен для другой вещи',
          }
        : {
            emoji: item.emoji ?? '🚗',
            title: `«${item.title}» — на подиуме! ★`,
            text: 'Теперь она главная в ангаре',
          },
    );
  };

  const itemAria = (item: ShopItem) =>
    favoriteId === item.id
      ? `${item.title} — на главном подиуме. Убрать с подиума`
      : `${item.title}. Поставить на главный подиум`;

  return (
    <div className="hangar-veil" role="presentation" onClick={onClose}>
      <div
        className="hangar"
        role="dialog"
        aria-modal="true"
        aria-label="Ангар БУКа"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="hangar-grab" aria-hidden="true" />
        <div className="row mb">
          <h2 className="grow" style={{ margin: 0 }}>
            🚗 Ангар БУКа
          </h2>
          <button type="button" className="lesson-exit" aria-label="Закрыть ангар" onClick={onClose}>
            ✕
          </button>
        </div>

        {!hasToys ? (
          <div className="card tiny" style={{ textAlign: 'center' }}>
            Пока пусто. Витрина ➜ полка «Техника» — там авто, телефоны и корабли.
          </div>
        ) : (
          <>
            <div className="tiny muted mb">Тапни по вещи — встанет на главный подиум ★</div>

            {/* Главный подиум: любимая вещь крупно — рисунок машины 720×480
                наконец видно целиком, а не сжатым до 17 px на крыле совы. */}
            {favorite && (
              <div className={`hangar-main hangar-tone-${favorite.toy ?? 'car'}`}>
                <span className={`hangar-panel hangar-panel-${favorite.toy ?? 'car'}`} aria-hidden="true">
                  <BayDecor tone={favorite.toy ?? 'car'} />
                </span>
                <button
                  type="button"
                  className="hangar-main-art"
                  aria-label={itemAria(favorite)}
                  onClick={() => tapItem(favorite)}
                >
                  <ToyArt id={favorite.id} size={118} tuning={tuning} />
                </button>
                <span className="hangar-plinth" aria-hidden="true" />
                <span className="hangar-tag hangar-tag-star">
                  <b>★ На подиуме</b>
                  {favorite.title}
                </span>
              </div>
            )}

            {/* Полки коллекции: порядок тот же, что на витрине техники. */}
            {TOY_SHELVES.map(({ id, title, emoji }) => {
              const items = toysByShelf(id).filter((item) => isOwned(owned, item.id));
              if (!items.length) return null;
              return (
                <section key={id} className={`hangar-zone hangar-tone-${id}`} aria-label={`${title} в ангаре`}>
                  <h3 className="music-shelf-title">
                    <span aria-hidden="true">{emoji}</span> {title}
                  </h3>
                  <div className="hangar-stage">
                    <span className={`hangar-panel hangar-panel-${id}`} aria-hidden="true">
                      <BayDecor tone={id} />
                    </span>
                    <div className="hangar-row">
                      {items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`hangar-item${favoriteId === item.id ? ' star' : ''}`}
                          aria-label={itemAria(item)}
                          onClick={() => tapItem(item)}
                        >
                          <ToyArt id={item.id} size={58} tuning={tuning} />
                          <span className="hangar-item-plinth" aria-hidden="true" />
                          <span className="hangar-tag">
                            <b>{favoriteId === item.id ? `★ ${item.title}` : item.title}</b>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </section>
              );
            })}
          </>
        )}

        {/* БУК — хозяин коллекции: стоит на коврике, техника НЕ на нём. */}
        <div className="hangar-buk" aria-hidden="true">
          <Mascot mood="happy" stage={growth.index} size={88} />
        </div>
        <div className="tiny muted hangar-note">БУК любуется коллекцией: техника стоит в ангаре, а не на нём</div>
      </div>
    </div>
  );
}

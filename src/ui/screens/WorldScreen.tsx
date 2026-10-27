import { type CSSProperties, useState } from 'react';
import { BUILDING_BY_ID, WORLD_BASES } from '../../engine/buildings';
import { growthStage, isOwned, rarityOf, RARITY_ORDER, SHOP_ITEMS, type ItemRarity, type ShopItem } from '../../engine/shop';
import { ALL_COSTUMES, type Costume } from '../../engine/puzzles';
import { normalizeWorld, WORLD_SLOTS } from '../../engine/world';
import { haptic } from '../../platform/haptics';
import { sfx } from '../../platform/sound';
import { masteredCount, useActiveProfile, useApp } from '../../state/store';
import { Mascot } from '../Mascot';
import { BayDecor } from '../TechScene';
import { ToyArt } from '../ToyArt';
import { RarityLabel } from '../RarityChip';
import { BuildingArt, buildingArtUrl } from '../BuildingArt';

type WorldThing = { id: string; title: string; rarity: ItemRarity; item?: ShopItem; costume?: Costume };

/**
 * «Мой мир»: купленная научная база задаёт пейзаж и фон вкладки, а три слота
 * остаются для выбранных ребёнком вещей. Техника стоит в своей сцене, наряды —
 * на мягком фоне. Базы и обычные вещи выбираются в одном окне настройки мира.
 */
export function WorldScreen() {
  const profile = useActiveProfile();
  const toggleWorld = useApp((s) => s.toggleWorld);
  const chooseWorldBase = useApp((s) => s.chooseWorldBase);
  const showToast = useApp((s) => s.showToast);
  const [picking, setPicking] = useState(false);

  if (!profile) return null;

  const owned = profile.shop?.owned ?? [];
  const buildingsOwned = profile.shop?.buildingsOwned ?? [];
  const puzzle = profile.puzzle;
  const ownedCostumes = [...(puzzle?.assembled ?? []), ...(profile.shop?.crystalCostumesOwned ?? [])];
  const world = normalizeWorld(profile.shop?.world, owned, ownedCostumes);
  const worldBaseId = profile.shop?.worldBase ?? null;
  const worldBase = worldBaseId ? BUILDING_BY_ID[worldBaseId] : undefined;
  const ownedBases = WORLD_BASES.filter((base) => buildingsOwned.includes(base.id));
  const tuning = profile.shop?.tuning;
  const growth = growthStage(masteredCount(profile));
  // Общий список предметов и костюмов для трёх мест мира.
  const ownedThings: WorldThing[] = [
    ...SHOP_ITEMS.filter((item) => isOwned(owned, item.id)).map((item) => ({ id: item.id, title: item.title, rarity: rarityOf(item), item })),
    ...ALL_COSTUMES.filter((costume) => ownedCostumes.includes(costume.id)).map((costume) => ({ id: costume.id, title: costume.title, rarity: costume.rarity ?? 'common' as ItemRarity, costume })),
  ];
  const thingById = new Map(ownedThings.map((thing) => [thing.id, thing]));
  const compareThings = (a: WorldThing, b: WorldThing) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity)
    || (a.item?.price ?? a.costume?.price ?? 0) - (b.item?.price ?? b.costume?.price ?? 0);
  // Типы идут по возрастанию: обычный → крутой → легендарный → ТОПОВЫЙ.
  const shown = world.map((id) => thingById.get(id)).filter((thing): thing is WorldThing => Boolean(thing)).sort(compareThings);
  ownedThings.sort(compareThings);
  const backdropStyle = worldBase
    ? ({ '--world-base-image': `url("${buildingArtUrl(worldBase.id)}")` } as CSSProperties)
    : undefined;

  const tap = (id: string) => {
    sfx.tap();
    haptic.tap();
    const result = toggleWorld(id);
    if (result === 'full') {
      showToast({ emoji: '🌍', title: 'Мест нет', text: `В «Моём мире» уже ${WORLD_SLOTS} вещи. Уберите одну` });
    } else if (result === 'locked') {
      showToast({ emoji: '🔒', title: 'Сначала купите вещь', text: 'В «Мой мир» ставим только купленное' });
    }
  };

  const setWorldBase = (id: string | null) => {
    if (!chooseWorldBase(id)) {
      showToast({ emoji: '🔒', title: 'Сначала купите базу', text: 'В фон мира можно поставить только свою базу из БУКа' });
      return;
    }
    sfx.tap();
    haptic.tap();
  };

  /** Картинка вещи: техника — ToyArt, наряд — маскот БУКа в этом наряде. */
  const art = (thing: WorldThing, size: number) => {
    if (thing.costume) return <Mascot mood="idle" costumeId={thing.costume.id} stage={growth.index} size={size} />;
    const item = thing.item!;
    return item.kind === 'toy'
      ? <ToyArt id={item.id} size={size} tuning={tuning} />
      : <Mascot mood="idle" look={{ [item.slot]: item.id }} stage={growth.index} size={size} />;
  };

  /** Категория сцены: техника по типу, наряды — отдельный мягкий фон. */
  const toneOf = (thing: WorldThing): 'car' | 'plane' | 'ship' | 'phone' | 'outfit' => thing.item?.toy ?? 'outfit';

  return (
    <div
      className={`screen world-screen${worldBase ? ' has-world-base' : ''}`}
      style={backdropStyle}
    >
      <h2 className="mb">🌍 Мой мир</h2>
      <p className="tiny muted mb">База меняет пейзаж мира, а в трёх местах можно расставить любимые вещи.</p>

      <section className={`world-base-current${worldBase ? ' selected' : ''}`} aria-label="База и фон Моего мира">
        <div className="world-base-current-art">
          {worldBase ? (
            <BuildingArt id={worldBase.id} className="world-base-preview-art" loading="eager" decorative />
          ) : (
            <span aria-hidden="true">🏗️</span>
          )}
        </div>
        <div className="world-base-current-copy">
          <span className="world-base-kicker">🌄 ОСНОВА МИРА</span>
          <b>{worldBase?.title ?? 'База пока не выбрана'}</b>
          {worldBase && <RarityLabel rarity={worldBase.rarity} className="rarity-chip-mini" />}
          <small>
            {worldBase
              ? 'Пейзаж выбранной базы теперь задаёт фон этой вкладки.'
              : 'Выбери купленную базу — и фон мира изменится вместе с ней.'}
          </small>
          <div className="world-base-actions">
            <button type="button" className="btn sm" onClick={() => setPicking(true)}>
              {worldBase ? 'Сменить базу' : 'Выбрать базу'}
            </button>
            {worldBase && (
              <button type="button" className="btn sm ghost" onClick={() => setWorldBase(null)}>
                Убрать базу
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="world-slots">
        {Array.from({ length: WORLD_SLOTS }, (_, index) => {
          const thing = shown[index];
          const id = thing?.id;
          if (!id || !thing) {
            return (
              <button
                key={`empty-${index}`}
                type="button"
                className="world-slot empty"
                aria-label={`Пустое место ${index + 1}. Выбрать вещь`}
                onClick={() => setPicking(true)}
              >
                <span className="world-slot-plus" aria-hidden="true">＋</span>
                <small>Пустое место {index + 1}</small>
              </button>
            );
          }
          const tone = toneOf(thing);
          return (
            <div key={id} className={`world-slot world-tone-${tone} tier-${thing.rarity}`}>
              <span className={`hangar-panel ${tone === 'outfit' ? 'world-panel-outfit' : `hangar-panel-${tone}`}`} aria-hidden="true">
                {tone !== 'outfit' && <BayDecor tone={tone} />}
              </span>
              <span className="world-slot-halo" aria-hidden="true" />
              <div className="world-slot-art">{art(thing, 132)}</div>
              <span className="world-slot-plinth" aria-hidden="true" />
              <div className="world-slot-foot">
                <b className="world-slot-title">{thing.title}</b>
                <RarityLabel rarity={thing.rarity} className="rarity-chip-mini" />
                <button type="button" className="btn sm ghost" onClick={() => tap(id)}>
                  Убрать
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {!picking && (
        <button type="button" className="btn sm ghost wide" onClick={() => setPicking(true)}>
          Выбрать вещи ({world.length}/{WORLD_SLOTS})
        </button>
      )}

      {picking && (
        <section className="card world-picker" aria-label="Выбор для Моего мира">
          <div className="row mb">
            <b className="grow">Настройте мир · вещей {world.length}/{WORLD_SLOTS}</b>
            <button type="button" className="btn sm" onClick={() => setPicking(false)}>
              Готово
            </button>
          </div>

          <section className="world-base-picker-group" aria-label="Выбор базы и фона мира">
            <div className="world-picker-heading">
              <b>База задаёт фон</b>
              <small>Выбери одну из купленных научных баз.</small>
            </div>
            {ownedBases.length === 0 ? (
              <p className="tiny muted">Купи базу на полке «Здания» в магазине БУКа, чтобы поставить её в «Мой мир».</p>
            ) : (
              <div className="world-base-pick-grid">
                {ownedBases.map((base) => {
                  const on = worldBase?.id === base.id;
                  return (
                    <button
                      key={base.id}
                      type="button"
                      className={`world-base-pick-item${on ? ' on' : ''}`}
                      aria-pressed={on}
                      aria-label={`${base.title}${on ? ' — фон мира выбран' : '. Поставить фоном мира'}`}
                      onClick={() => setWorldBase(base.id)}
                    >
                      <BuildingArt id={base.id} className="world-base-pick-art" decorative />
                      <span>{base.title}</span>
                      <RarityLabel rarity={base.rarity} className="rarity-chip-mini" />
                      <small>{on ? 'Фон выбран ✓' : 'Поставить фоном'}</small>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="world-items-picker-group" aria-label="Выбор вещей мира">
            <div className="world-picker-heading">
              <b>Вещи на сцене · до {WORLD_SLOTS}</b>
              <small>База не занимает одно из трёх мест.</small>
            </div>
            {ownedThings.length === 0 ? (
              <p className="tiny muted">Пока пусто. Купите вещь в БУКе, и она появится здесь.</p>
            ) : (
              <div className="world-pick">
                {ownedThings.map((thing) => {
                  const on = world.includes(thing.id);
                  const tone = toneOf(thing);
                  return (
                    <button
                      key={thing.id}
                      type="button"
                      className={`world-pick-item world-tone-${tone} tier-${thing.rarity}${on ? ' on' : ''}`}
                      aria-pressed={on}
                      aria-label={`${thing.title}${on ? ' — в Моём мире. Убрать' : '. Поставить в Мой мир'}`}
                      onClick={() => tap(thing.id)}
                    >
                      <span className="world-pick-art">{art(thing, 84)}</span>
                      <span className="world-pick-title">{thing.title}</span>
                      <RarityLabel rarity={thing.rarity} className="rarity-chip-mini" />
                      {on && <i aria-hidden="true">✓</i>}
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </section>
      )}
    </div>
  );
}

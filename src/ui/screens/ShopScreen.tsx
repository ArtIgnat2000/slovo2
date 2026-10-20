import { Children, useEffect, useState, type ReactNode } from 'react';
import { masteredCount, useActiveProfile, useApp, useLook } from '../../state/store';
import { plural } from '../../engine/quests';
import {
  ITEM_BY_ID,
  OUTFIT_ITEMS,
  SHOP_ITEMS,
  SLOT_TITLE,
  TOY_ITEMS,
  TOY_SHELVES,
  canBuy,
  growthStage,
  isOwned,
  isToy,
  isWearing,
  isWished,
  missingGems,
  resolveHero,
  SELL_RATE,
  sellPrice,
  toysByShelf,
  wardrobeValue,
  type ToyKind,
} from '../../engine/shop';
import { Mascot } from '../Mascot';
import { ToyArt } from '../ToyArt';
import { carAlt, carKind, carNote, hasCarArt } from '../CarArt';
import { hasShipArt, shipAlt, shipKind, shipNote } from '../ShipArt';
import { HangarScene } from '../HangarScene';
import {
  COSTUMES,
  OVERFLOW_GEMS,
  PUZZLE_SIZE,
  activeCostume,
  costumeProgress,
  normalizePuzzle,
  type Costume,
} from '../../engine/puzzles';
import { TINT_PRICE, type TintOption } from '../../engine/tints';
import { TintPicker } from '../TintPicker';
import { ConfirmDialog } from '../Bits';
import { previewSoundCue, sfx } from '../../platform/sound';
import { SOUND_PACKS, type SoundCue, type SoundPack } from '../../engine/sounds';
import { haptic } from '../../platform/haptics';
import type { ShopItem } from '../../engine/shop';
import { MUSIC_TRACKS, MUSIC_BY_ID, tracksByShelf, type MusicShelf, type MusicTrack } from '../../engine/music';
import { playMusic } from '../../platform/music';
import { MusicCreditsToggle } from '../Credits';
import { THEME_STYLES, type ThemeStyle } from '../../engine/theme-styles';
import { BackgroundThemeCard } from '../BackgroundThemeCard';

/**
 * Магазин БУКа (концепция 2026-10-17, docs/shop-concept.md).
 *
 * Что изменилось по сравнению с «одной лентой»:
 *  • два верхних уровня — **Витрина** (чего хочу) и **Гардероб** (что моё);
 *    раньше купленное терялось в общей ленте среди продаваемого;
 *  • витрина режется **чипами-полками**: наряды / техника / костюмы / музыка /
 *    фоны / звуки; новый раздел не требует переделки экрана;
 *  • **витрина-бутик (0.19.0):** у каждого товара своя арочная ниша с лампой и
 *    подиумом (`ShowcaseGrid`) — магазин выглядит витриной, а не списком карточек;
 *  • **техника (0.19.0 → 0.22.0):** авто, телефоны и корабли — отдельная
 *    полка с тремя подполками. Вещь живёт в слоте `toy`, но на БУКе больше
 *    не рисуется (правило `showsOnBuk`): коллекция экспонируется в сцене
 *    «Ангар» (ui/HangarScene), а слот означает «любимая вещь на главном
 *    подиуме ангара»;
 *  • «Звуки» (0.17.0) — наборы мелодий правильного ответа и ошибки
 *    (engine/sounds.ts): послушать оба отклика можно прямо на карточке;
 *  • **единый макет карточки** для всех типов товара: арт, название, статус
 *    плашкой (Твоя ✓ / В ангаре ✓ / Надето ✓ / На подиуме ✓ / Собираю 4/9 / Ещё N 💎)
 *    и ОДНО действие;
 *  • подробная карточка — **sheet снизу**: крупная примерка, цена, палитра
 *    цветов. Палитра больше не раскрывается инлайн (верстка не прыгает);
 *  • музыка — отдельная полка (была половиной экрана), примерка и строка
 *    «для взрослых» — в sheet;
 *  • костюмы: активный сбор — крупно сверху, остальные — сеткой.
 *
 * Догматы продукта не менялись: покупка — через ConfirmDialog, купленное
 * сразу надевается или встаёт рядом с БУКом, красить можно только своё, 1 💎 за
 * новый оттенок.
 */

/** Полки музыкального магазина: спокойный фон отдельно от весёлой коллекции. */
const MUSIC_SHELVES: { shelf: MusicShelf; title: string }[] = [
  { shelf: 'calm', title: '🌿 Спокойный фон' },
  { shelf: 'fun', title: '🎉 Коллекция и награды' },
];

/** Верхние уровни магазина: «чего хочу» и «что моё». */
type View = 'vitrina' | 'wardrobe';

/** Полки витрины — по типу товара, не по слоту совы. */
type Cat = 'outfits' | 'toys' | 'costumes' | 'music' | 'sounds' | 'backgrounds';

const CATS: { id: Cat; title: string; emoji: string }[] = [
  { id: 'outfits', title: 'Наряды', emoji: '🎩' },
  { id: 'toys', title: 'Техника', emoji: '🚗' },
  { id: 'costumes', title: 'Костюмы', emoji: '🧩' },
  { id: 'music', title: 'Музыка', emoji: '🎵' },
  { id: 'sounds', title: 'Звуки', emoji: '🔊' },
  { id: 'backgrounds', title: 'Фоны', emoji: '🖼️' },
];

/** Что открылось в подробной карточке (sheet снизу). */
type Detail =
  | { kind: 'item'; item: ShopItem }
  | { kind: 'costume'; costume: Costume }
  | { kind: 'track'; track: MusicTrack }
  | { kind: 'sound'; pack: SoundPack };

/** «3:25» — длительность записи на карточке. */
function fmtTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Что можно красить: аксессуар (id из SHOP_ITEMS) или костюм (id из COSTUMES). */
interface TintTarget {
  id: string;
  title: string;
}

/**
 * Единый макет карточки товара — один на все типы.
 * Состояние читается плашкой-ценником и подписью кнопки, не только цветом
 * (WCAG 1.4.1); тап по карточке открывает подробный sheet.
 */
function ShopCard(props: {
  badge?: string;
  art: ReactNode;
  title: string;
  desc?: string;
  /** Дополнительный класс карточки: on (надето), owned (куплено), current (собираем) */
  cardCls?: string;
  /** Между подписью и ценой — например, точки прогресса пазла */
  extra?: ReactNode;
  priceLabel?: string;
  afford?: boolean;
  actionLabel: string;
  actionTone: 'primary' | 'green' | 'ghost';
  actionDisabled?: boolean;
  wished?: boolean;
  onWish?: () => void;
  onOpen: () => void;
  onAction: () => void;
}) {
  return (
    <article
      className={`shop-item${props.cardCls ? ` ${props.cardCls}` : ''}`}
      role="button"
      tabIndex={0}
      aria-label={props.title}
      onClick={props.onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter') props.onOpen();
      }}
    >
      {props.badge && <span className="shop-badge">{props.badge}</span>}
      {/* Ниша витрины: лампа, вещь на подиуме (0.19.0) */}
      <div className="shop-case">
        <span className="shop-case-lamp" aria-hidden="true" />
        <div className="shop-icon">{props.art}</div>
        <span className="shop-case-podium" aria-hidden="true" />
      </div>
      <div className="shop-title">{props.title}</div>
      {props.desc && <div className="tiny shop-desc">{props.desc}</div>}
      {props.extra}
      {props.priceLabel && (
        <span className={`shop-price${props.afford ? ' afford' : ''}`}>{props.priceLabel}</span>
      )}
      <button
        className={`btn sm wide ${props.actionTone}`}
        disabled={props.actionDisabled}
        onClick={(e) => {
          e.stopPropagation();
          props.onAction();
        }}
      >
        {props.actionLabel}
      </button>
      {props.onWish && (
        <button
          type="button"
          className={`shop-heart${props.wished ? ' on' : ''}`}
          aria-label={props.wished ? `Убрать «${props.title}» из мечт` : `Добавить «${props.title}» в мечты`}
          onClick={(e) => {
            e.stopPropagation();
            props.onWish!();
          }}
        >
          {props.wished ? '💜' : '🤍'}
        </button>
      )}
    </article>
  );
}

/**
 * Витрина (0.19.0).
 *
 * Делим товары на ряды по два: каждый товар — своя арочная ниша с лампой и
 * подиумом, ряд — одна «линия» витрины. Разметка остаётся сеткой
 * `.shop-grid`, поэтому карточки и их размеры не меняются.
 *
 * Последний нечётный товар ставится по центру — пустого угла не остаётся.
 */
function ShowcaseGrid({ children, tone }: { children: ReactNode; tone?: 'mint' | 'sky' }) {
  const cells = Children.toArray(children);
  const rows: ReactNode[][] = [];
  for (let i = 0; i < cells.length; i += 2) rows.push(cells.slice(i, i + 2));
  return (
    <div className={`shop-boutique${tone ? ` shop-boutique-${tone}` : ''}`}>
      {rows.map((row, index) => (
        <div className={`shop-boutique-row shop-grid${row.length === 1 ? ' single' : ''}`} key={index}>
          {row}
        </div>
      ))}
    </div>
  );
}

/** Подробная карточка снизу: примерка крупно, цена, действие, краски. */
function Sheet(props: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="shop-sheet-veil" role="presentation" onClick={props.onClose}>
      <div
        className="shop-sheet"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shop-sheet-grab" aria-hidden="true" />
        {props.children}
      </div>
    </div>
  );
}

export function ShopScreen() {
  const profile = useActiveProfile();
  const look = useLook();
  const buyItem = useApp((s) => s.buyItem);
  const sellItem = useApp((s) => s.sellItem);
  const toggleEquip = useApp((s) => s.toggleEquip);
  const choosePuzzleCostume = useApp((s) => s.choosePuzzleCostume);
  const toggleCostume = useApp((s) => s.toggleCostume);
  const showToast = useApp((s) => s.showToast);
  const recolorItem = useApp((s) => s.recolorItem);
  const buyMusicTrack = useApp((s) => s.buyMusicTrack);
  const buySoundPack = useApp((s) => s.buySoundPack);
  const setSoundPack = useApp((s) => s.setSoundPack);
  const setMusicTrack = useApp((s) => s.setMusicTrack);
  const toggleWishlist = useApp((s) => s.toggleWishlist);
  const themeStyle = useApp((s) => s.settings.themeStyle);
  const setSettings = useApp((s) => s.setSettings);
  const [view, setView] = useState<View>('vitrina');
  const [cat, setCat] = useState<Cat>('outfits');
  const [toyShelf, setToyShelf] = useState<ToyKind>('car');
  // Подробная карточка и её палитра (палитра — только в sheet)
  const [sheet, setSheet] = useState<Detail | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [ask, setAsk] = useState<ShopItem | null>(null);
  const [askSell, setAskSell] = useState<ShopItem | null>(null);
  const [askMusic, setAskMusic] = useState<MusicTrack | null>(null);
  const [askSound, setAskSound] = useState<SoundPack | null>(null);
  const [askTint, setAskTint] = useState<{ target: TintTarget; tint: TintOption } | null>(null);
  const [previewTrack, setPreviewTrack] = useState<string | null>(null);
  const [mood, setMood] = useState<'idle' | 'happy' | 'dance'>('idle');
  // «Ангар БУКа» (0.22.0): сцена коллекции техники, открывается из гардероба
  // и с полки «Техника» (ещё один вход — значок 🚗 в шапке главной, App.tsx).
  const [hangarOpen, setHangarOpen] = useState(false);

  /** Sheet закрывается по фону, по Escape и — если играла примерка —
   *  возвратом к выбранной мелодии (примерка не остаётся «висеть»). */
  const closeSheet = () => {
    setSheet(null);
    setPaletteOpen(false);
    if (previewTrack) {
      setPreviewTrack(null);
      const selected = profile?.shop?.musicTrack ?? null;
      playMusic(selected ? MUSIC_BY_ID[selected] ?? null : null);
    }
  };

  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSheet();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // closeSheet читает profile и previewTrack — замыкает на снимке,
    // но Escape лишь закрывает sheet, свежесть данных здесь не критична.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet]);

  if (!profile) return null;

  const owned = profile.shop?.owned ?? [];
  const gems = profile.gems;
  const mastered = masteredCount(profile);
  const growth = growthStage(mastered);

  // Пазлы костюмов (engine/puzzles.ts): прогресс храним по каждому костюму,
  // поэтому смена цели сборки безопасна — ребёнок ничего не теряет.
  const pz = normalizePuzzle(profile.puzzle);
  const collecting = activeCostume(pz);
  const allCostumesDone = COSTUMES.every((c) => pz.assembled.includes(c.id));
  const musicOwned = profile.shop?.musicOwned ?? [];
  const selectedMusic = profile.shop?.musicTrack ?? null;
  const soundOwned = profile.shop?.soundOwned ?? [];
  const selectedSound = profile.shop?.soundPack ?? 'classic';
  const wishlist = profile.shop?.wishlist ?? [];
  const hero = resolveHero(owned, profile.puzzle, musicOwned);
  // Ближайшая техника — отдельная подсказка на полке «Техника»: герой нарядов
  // намеренно не уводит ребёнка на другую полку (см. engine/shop.ts).
  const toyGoal = toysByShelf(toyShelf)
    .filter((item) => !isOwned(owned, item.id))
    .reduce<ShopItem | null>((best, item) => (!best || item.price < best.price ? item : best), null);
  const ownedOutfits = OUTFIT_ITEMS.filter((item) => isOwned(owned, item.id));
  const ownedToys = TOY_ITEMS.filter((item) => isOwned(owned, item.id));

  const tapWish = (id: string, title: string) => {
    sfx.tap();
    haptic.tap();
    const added = toggleWishlist(id);
    if (added) {
      showToast({
        emoji: '🤍',
        title: `«${title}» — в мечтах!`,
        text: 'Прогресс копления виден в Гардеробе',
      });
    } else {
      showToast({
        emoji: '🤍',
        title: 'Убрали из мечт',
        text: `«${title}» больше не в списке желаний`,
      });
    }
  };

  const openSheet = (detail: Detail) => {
    sfx.tap();
    haptic.tap();
    setPaletteOpen(false);
    setSheet(detail);
  };

  const selectThemeStyle = (style: ThemeStyle) => {
    if (style === themeStyle) return;
    setSettings({ themeStyle: style });
    sfx.tap();
    haptic.tap();
    const option = THEME_STYLES.find((item) => item.id === style)!;
    showToast({ emoji: option.emoji, title: `«${option.title}» выбрана`, text: 'Оформление изменилось во всех разделах' });
  };

  const chooseMusic = (id: string | null) => {
    const track = id ? MUSIC_BY_ID[id] : null;
    playMusic(track ?? null);
    setMusicTrack(id);
    setPreviewTrack(null);
    sfx.tap();
    if (track) showToast({ emoji: track.emoji, title: `${track.title} играет!`, text: 'БУК будет слушать её и в других разделах' });
    else showToast({ emoji: '🔇', title: 'Музыка выключена' });
  };

  const togglePreview = (track: MusicTrack) => {
    if (previewTrack === track.id) {
      setPreviewTrack(null);
      playMusic(selectedMusic ? MUSIC_BY_ID[selectedMusic] ?? null : null);
    } else {
      setPreviewTrack(track.id);
      playMusic(track);
    }
  };

  const confirmMusicBuy = () => {
    if (!askMusic) return;
    const track = askMusic;
    const ok = buyMusicTrack(track.id);
    setAskMusic(null);
    if (ok) {
      setMusicTrack(track.id);
      playMusic(track);
      setPreviewTrack(null);
      sfx.reward();
      haptic.correct();
      showToast({ emoji: track.emoji, title: `«${track.title}» теперь твоя!`, text: 'БУК уже включил новую музыку' });
    } else {
      showToast({ emoji: '💎', title: 'Не хватает кристаллов', text: `Нужно ещё ${Math.max(0, track.price - gems)} 💎` });
    }
  };

  // ── «Звуки»: мелодии правильного ответа и ошибки ─────────────────────

  /** Послушать отклик набора. Выключенный у родителя звук — честная подсказка. */
  const tryCue = (pack: SoundPack, cue: SoundCue) => {
    haptic.tap();
    if (!previewSoundCue(pack.id, cue)) {
      showToast({ emoji: '🔇', title: 'Звук выключен', text: 'Включить можно в разделе для взрослых → Настройки → Звук' });
    }
  };

  const chooseSound = (pack: SoundPack) => {
    setSoundPack(pack.id);
    previewSoundCue(pack.id, 'correct');
    haptic.tap();
    showToast({ emoji: pack.emoji, title: `«${pack.title}» звучит в уроках`, text: 'Так БУК отзовётся на верный ответ и на ошибку' });
  };

  const confirmSoundBuy = () => {
    if (!askSound) return;
    const pack = askSound;
    const ok = buySoundPack(pack.id);
    setAskSound(null);
    if (ok) {
      setSoundPack(pack.id);
      previewSoundCue(pack.id, 'correct');
      haptic.correct();
      showToast({ emoji: pack.emoji, title: `«${pack.title}» теперь твои!`, text: 'Новые звуки уже включены в уроках' });
    } else {
      showToast({ emoji: '💎', title: 'Не хватает кристаллов', text: `Нужно ещё ${Math.max(0, pack.price - gems)} 💎` });
    }
  };

  const tapCostume = (id: string) => {
    sfx.tap();
    haptic.tap();
    toggleCostume(id);
    setMood('happy');
    setTimeout(() => setMood('idle'), 1200);
  };

  const tapPickCostume = (id: string) => {
    sfx.tap();
    haptic.tap();
    choosePuzzleCostume(id);
  };

  const confirmBuy = () => {
    if (!ask) return;
    const ok = buyItem(ask.id);
    setAsk(null);
    if (ok) {
      sfx.reward();
      haptic.correct();
      setMood('dance');
      setTimeout(() => setMood('idle'), 1800);
      const toy = isToy(ask);
      showToast({
        emoji: ask.emoji ?? '🎩',
        title: `${ask.title} — твой!`,
        text: toy ? 'Поставим в ангаре — зайди посмотреть!' : 'БУК уже примерил обновку',
      });
    } else {
      showToast({ emoji: '💎', title: 'Не хватает кристаллов', text: `Нужно ещё ${missingGems(ask, gems)}` });
    }
  };

  const confirmSell = () => {
    if (!askSell) return;
    const item = askSell;
    const refund = sellPrice(item);
    const ok = sellItem(item.id);
    setAskSell(null);
    if (ok) {
      sfx.tap();
      showToast({
        emoji: item.emoji ?? '🎩',
        title: `+${refund} 💎 · «${item.title}» сдана`,
        text: 'Часть стоимости вернулась; купить заново — за полную цену',
      });
    }
  };

  const tapWear = (item: ShopItem) => {
    sfx.tap();
    haptic.tap();
    toggleEquip(item.id);
    setMood('happy');
    setTimeout(() => setMood('idle'), 1200);
  };

  /** Открыть сцену «Ангар БУКа» — коллекцию техники крупным планом (0.22.0). */
  const openHangar = () => {
    sfx.tap();
    haptic.tap();
    setHangarOpen(true);
  };

  const tapTint = (target: TintTarget, tint: TintOption, unlocked: boolean) => {
    if (unlocked) {
      const outcome = recolorItem(target.id, tint.id);
      if (outcome === 'switched') {
        sfx.tap();
        haptic.tap();
        setMood('happy');
        setTimeout(() => setMood('idle'), 1200);
        showToast({ emoji: '🎨', title: `${target.title} — ${tint.title.toLowerCase()}`, text: 'Этот цвет уже открыт — меняй сколько хочешь' });
      }
      return;
    }
    if (gems < TINT_PRICE) {
      sfx.hint();
      showToast({
        emoji: '💎',
        title: `Для цвета «${tint.title.toLowerCase()}» нужен ещё 1 💎`,
        text: 'Краски открываются за кристаллы — загляни на главную',
      });
      return;
    }
    sfx.tap();
    setAskTint({ target, tint });
  };

  const confirmTint = () => {
    if (!askTint) return;
    const { target, tint } = askTint;
    const outcome = recolorItem(target.id, tint.id);
    setAskTint(null);
    if (outcome === 'opened') {
      sfx.reward();
      haptic.correct();
      setMood('dance');
      setTimeout(() => setMood('idle'), 1800);
      showToast({
        emoji: '🎨',
        title: `${target.title} — ${tint.title.toLowerCase()}!`,
        text: `Краска открыта · −${TINT_PRICE} 💎`,
      });
    } else if (outcome === 'no-gems') {
      showToast({ emoji: '💎', title: 'Не хватает кристаллов', text: 'Загляни на главную: там задания и сундук' });
    }
  };

  // ── Карточки витрины ────────────────────────────────────────────────

  const itemCard = (item: ShopItem) => {
    const owned_ = isOwned(owned, item.id);
    const wearing = isWearing(look, item);
    const affordable = canBuy(item, gems);
    const wished = isWished(wishlist, item.id);
    const toy = isToy(item);
    // 0.22.0: техника не «надета» на БУКа — она стоит в ангаре; слот `toy`
    // означает «любимая вещь на главном подиуме ангара» (HangarScene).
    const stateOn = toy ? 'На подиуме ✓' : 'Надето ✓';
    const actionOn = toy ? 'На подиум' : 'Надеть';
    return (
      <ShopCard
        key={item.id}
        art={
          toy ? (
            <ToyArt id={item.id} size={82} tuning={profile.shop?.tuning} />
          ) : (
            <Mascot mood="idle" look={{ [item.slot]: item.id }} stage={growth.index} size={64} />
          )
        }
        title={item.title}
        desc={item.desc}
        // Арт техники рисуется целиком, без совы: на полке это товар,
        // а не ещё один наряд на БУКе.
        cardCls={[wearing ? 'on' : owned_ ? 'owned' : '', toy ? 'toy-item' : ''].filter(Boolean).join(' ') || undefined}
        priceLabel={owned_ ? (toy ? 'В ангаре ✓' : 'Твоя ✓') : `💎 ${item.price}`}
        afford={affordable}
        wished={wished}
        onWish={!owned_ ? () => tapWish(item.id, item.title) : undefined}
        actionLabel={
          owned_
            ? wearing
              ? stateOn
              : actionOn
            : affordable
              ? `Купить · 💎${item.price}`
              : `Ещё ${missingGems(item, gems)} 💎`
        }
        actionTone={owned_ ? (wearing ? 'green' : 'ghost') : affordable ? 'primary' : 'ghost'}
        actionDisabled={!owned_ && !affordable}
        onOpen={() => openSheet({ kind: 'item', item })}
        onAction={() => {
          if (owned_) tapWear(item);
          else if (affordable) {
            sfx.tap();
            setAsk(item);
          } else {
            sfx.hint();
            showToast({
              emoji: '💎',
              title: `До «${item.title}» ещё ${missingGems(item, gems)} 💎`,
              text: 'Кристаллы дают за задания дня и сундук — загляни на главную',
            });
          }
        }}
      />
    );
  };

  const costumeCard = (c: Costume) => {
    const done = pz.assembled.includes(c.id);
    const prog = costumeProgress(pz, c.id);
    const isCurrent = !done && collecting === c.id;
    const wearing = pz.worn === c.id;
    const wished = isWished(wishlist, c.id);
    return (
      <ShopCard
        key={c.id}
        badge={isCurrent ? 'Собираю' : undefined}
        cardCls={`costume-card${done ? (wearing ? ' on' : ' owned') : isCurrent ? ' current' : ''}`}
        wished={wished}
        onWish={!done ? () => tapWish(c.id, c.title) : undefined}
        art={
          // Несобранный костюм помечен классом pz-locked, но рисуется В ЦВЕТЕ:
          // раньше он был серым силуэтом, и ребёнку было не выбрать «тот самый».
          <div className={done ? '' : 'pz-locked'}>
            <Mascot mood={wearing ? 'happy' : 'idle'} costumeId={c.id} size={64} stage={growth.index} />
          </div>
        }
        title={c.title}
        desc={c.desc}
        extra={
          // Доты прогресса — на карточке: видно, сколько фрагментов
          // уже есть, не открывая подробную карточку.
          done ? undefined : (
            <div className="pz-dots" role="img" aria-label={`${prog} из ${PUZZLE_SIZE} фрагментов`}>
              {Array.from({ length: PUZZLE_SIZE }, (_, i) => (
                <i key={i} className={`pz-dot${i < prog ? ' on' : ''}`} />
              ))}
            </div>
          )
        }
        priceLabel={done ? 'Собран ✓' : `${prog}/${PUZZLE_SIZE} 🧩`}
        afford={done}
        actionLabel={
          done
            ? wearing
              ? 'Надето ✓'
              : 'Надеть'
            : isCurrent
              ? `Собираю · ${prog}/${PUZZLE_SIZE}`
              : prog > 0
                ? `Продолжить · ${prog}/${PUZZLE_SIZE}`
                : 'Собирать'
        }
        actionTone={done ? (wearing ? 'green' : 'ghost') : isCurrent ? 'primary' : 'ghost'}
        onOpen={() => openSheet({ kind: 'costume', costume: c })}
        onAction={() => {
          if (done) tapCostume(c.id);
          else tapPickCostume(c.id);
        }}
      />
    );
  };

  const trackCard = (track: MusicTrack) => {
    const ownedTrack = musicOwned.includes(track.id);
    const selected = selectedMusic === track.id;
    const affordable = gems >= track.price;
    const wished = isWished(wishlist, track.id);
    return (
      <ShopCard
        key={track.id}
        wished={wished}
        onWish={!ownedTrack ? () => tapWish(track.id, track.title) : undefined}
        art={
          <div className="music-cover" aria-hidden="true">
            <span>{track.emoji}</span>
            <i>♫</i>
            {previewTrack === track.id && (
              <span className="shop-eq"><i /><i /><i /></span>
            )}
          </div>
        }
        title={track.title}
        desc={`${fmtTime(track.seconds)} · ${track.shelf === 'calm' ? 'спокойный фон' : 'награда'}`}
        cardCls={`music-item${selected ? ' on' : ownedTrack ? ' owned' : ''}`}
        priceLabel={ownedTrack ? 'Твоя ✓' : `💎 ${track.price}`}
        afford={affordable}
        actionLabel={
          ownedTrack
            ? selected
              ? 'Играет ✓'
              : 'Выбрать'
            : affordable
              ? `Купить · 💎${track.price}`
              : `Ещё ${track.price - gems} 💎`
        }
        actionTone={ownedTrack ? (selected ? 'green' : 'ghost') : affordable ? 'primary' : 'ghost'}
        actionDisabled={!ownedTrack && !affordable}
        onOpen={() => openSheet({ kind: 'track', track })}
        onAction={() => {
          if (ownedTrack) {
            chooseMusic(selected ? null : track.id);
          } else if (affordable) {
            sfx.tap();
            setAskMusic(track);
          } else {
            sfx.hint();
            showToast({
              emoji: '💎',
              title: `До «${track.title}» ещё ${track.price - gems} 💎`,
              text: 'Кристаллы дают за задания дня и сундук — загляни на главную',
            });
          }
        }}
      />
    );
  };

  /** Две кнопки «послушать»: верный ответ и ошибка — прямо на карточке. */
  const cueButtons = (pack: SoundPack, size: 'sm' | 'lg') => (
    <div className={`sound-try${size === 'lg' ? ' sound-try-lg' : ''}`}>
      <button
        type="button"
        className={`btn ${size} ghost`}
        aria-label={`Послушать «${pack.title}»: правильный ответ`}
        onClick={(e) => {
          e.stopPropagation();
          tryCue(pack, 'correct');
        }}
      >
        ▶ ✓{size === 'lg' ? ' Верно' : ''}
      </button>
      <button
        type="button"
        className={`btn ${size} ghost`}
        aria-label={`Послушать «${pack.title}»: ошибка`}
        onClick={(e) => {
          e.stopPropagation();
          tryCue(pack, 'wrong');
        }}
      >
        ▶ ✗{size === 'lg' ? ' Ошибка' : ''}
      </button>
    </div>
  );

  const soundCard = (pack: SoundPack) => {
    const ownedPack = soundOwned.includes(pack.id);
    const selected = selectedSound === pack.id;
    const affordable = gems >= pack.price;
    return (
      <ShopCard
        key={pack.id}
        art={
          <div className="music-cover sound-cover" aria-hidden="true">
            <span>{pack.emoji}</span>
            <i>♪</i>
          </div>
        }
        title={pack.title}
        desc={pack.desc}
        cardCls={`music-item sound-item${selected ? ' on' : ownedPack ? ' owned' : ''}`}
        extra={cueButtons(pack, 'sm')}
        priceLabel={ownedPack ? 'Твои ✓' : `💎 ${pack.price}`}
        afford={affordable}
        actionLabel={
          ownedPack
            ? selected
              ? 'Звучит ✓'
              : 'Выбрать'
            : affordable
              ? `Купить · 💎${pack.price}`
              : `Ещё ${pack.price - gems} 💎`
        }
        actionTone={ownedPack ? (selected ? 'green' : 'ghost') : affordable ? 'primary' : 'ghost'}
        actionDisabled={!ownedPack && !affordable}
        onOpen={() => openSheet({ kind: 'sound', pack })}
        onAction={() => {
          if (ownedPack) {
            if (!selected) chooseSound(pack);
            else tryCue(pack, 'correct');
          } else if (affordable) {
            sfx.tap();
            setAskSound(pack);
          } else {
            sfx.hint();
            showToast({
              emoji: '💎',
              title: `До «${pack.title}» ещё ${pack.price - gems} 💎`,
              text: 'Кристаллы дают за задания дня и сундук — загляни на главную',
            });
          }
        }}
      />
    );
  };

  // ── Sheet: содержимое по типу товара ──────────────────────────────────

  const sheetBody = (() => {
    if (!sheet) return null;
    if (sheet.kind === 'item') {
      const item = sheet.item;
      const owned_ = isOwned(owned, item.id);
      const wearing = isWearing(look, item);
      const affordable = canBuy(item, gems);
      const toy = isToy(item);
      // Подпись крупного рисунка: у машин и судов — вид техники, у телефонов —
      // просто название товара.
      const artAlt = hasCarArt(item.id)
        ? carAlt(item.id, item.title)
        : hasShipArt(item.id)
          ? shipAlt(item.id, item.title)
          : `${item.title} — техника БУКа`;
      return (
        <>
          <div className={`shop-bigart${toy ? ' shop-bigart-toy' : ''}`}>
            {toy ? (
              // Техника в подробной карточке — сам товар крупным планом
              // (машина/судно — карандашный лист, телефон — SVG). БУКа здесь
              // нет: ребёнок пришёл посмотреть вещь, а не примерку на сове.
              <ToyArt
                id={item.id}
                size={200}
                className="shop-bigart-toy-art"
                tuning={profile.shop?.tuning}
                alt={artAlt}
              />
            ) : (
              <Mascot mood="happy" look={{ [item.slot]: item.id }} costumeId={null} stage={growth.index} size={150} />
            )}
          </div>
          <h2 style={{ margin: '0 0 2px' }}>{item.title}</h2>
          <p className="tiny muted" style={{ marginTop: 0 }}>{item.desc}</p>
          {(carKind(item.id) || shipKind(item.id)) && (
            <p className="tiny muted">
              <b>{carKind(item.id) ?? shipKind(item.id)}</b>
              {(carNote(item.id) ?? shipNote(item.id)) && (
                <>
                  <br />
                  {carNote(item.id) ?? shipNote(item.id)}
                </>
              )}
            </p>
          )}
          {toy && (
            <p className="tiny muted">
              Встанет в ангаре БУКа — там её видно крупно и целиком.
            </p>
          )}
          <div className="row mb">
            <span className={`shop-price${affordable ? ' afford' : ''}`}>💎 {item.price}</span>
            <span className="tiny muted grow" style={{ alignSelf: 'center' }}>
              {owned_ ? (toy ? 'Уже в ангаре' : 'Уже в гардеробе') : `У тебя ${gems} 💎`}
            </span>
          </div>
          {!owned_ && (
            <p className="tiny muted mb">
              Если передумаешь — вернём {sellPrice(item)} 💎 ({SELL_RATE[item.kind ?? 'outfit'] * 100}% от цены)
            </p>
          )}
          <div className="row mb">
            {owned_ ? (
              <button
                className={`btn lg grow ${wearing ? 'green' : 'primary'}`}
                onClick={() => {
                  tapWear(item);
                  closeSheet();
                }}
              >
                {wearing ? (toy ? 'С подиума' : 'Снять') : toy ? 'На подиум' : 'Надеть'}
              </button>
            ) : (
              <button
                className="btn lg grow primary"
                disabled={!affordable}
                onClick={() => {
                  closeSheet();
                  sfx.tap();
                  setAsk(item);
                }}
              >
                {affordable ? `Купить за 💎${item.price}` : `Ещё ${missingGems(item, gems)} 💎`}
              </button>
            )}
          </div>
          {!owned_ && (
            <button
              type="button"
              className="btn lg wide ghost mb"
              onClick={() => tapWish(item.id, item.title)}
            >
              {isWished(wishlist, item.id) ? '💜 В мечтах — убрать' : '🤍 В мечты'}
            </button>
          )}
          {owned_ && (
            <>
              <button
                className="btn lg wide ghost mb"
                aria-expanded={paletteOpen}
                onClick={() => {
                  sfx.tap();
                  setPaletteOpen((o) => !o);
                }}
              >
                {paletteOpen ? '🎨 Готово' : '🎨 Цвет'}
              </button>
              {paletteOpen && (
                <TintPicker
                  caption="Цвет"
                  targetId={item.id}
                  title={item.title}
                  tuning={profile.shop?.tuning}
                  onPick={(tint, unlocked) => tapTint({ id: item.id, title: item.title }, tint, unlocked)}
                />
              )}
              <button
                type="button"
                className="btn lg wide ghost mb"
                onClick={() => {
                  sfx.tap();
                  setAskSell(item);
                }}
              >
                Сдать обратно · +{sellPrice(item)} 💎
              </button>
            </>
          )}
        </>
      );
    }
    if (sheet.kind === 'costume') {
      const c = sheet.costume;
      const done = pz.assembled.includes(c.id);
      const prog = costumeProgress(pz, c.id);
      const wearing = pz.worn === c.id;
      const isCurrent = !done && collecting === c.id;
      return (
        <>
          <div className="shop-bigart">
            <Mascot mood="happy" costumeId={c.id} size={150} stage={growth.index} />
          </div>
          <h2 style={{ margin: '0 0 2px' }}>{c.title}</h2>
          <p className="tiny muted" style={{ marginTop: 0 }}>{c.desc}</p>
          {done ? (
            <div className="row mb">
              <button
                className={`btn lg grow ${wearing ? 'green' : 'primary'}`}
                onClick={() => {
                  tapCostume(c.id);
                  closeSheet();
                }}
              >
                {wearing ? 'Снять' : 'Надеть'}
              </button>
            </div>
          ) : (
            <>
              <div className="mb">
                <div className="tiny">Фрагментов: {prog} из {PUZZLE_SIZE}</div>
                <div className="pz-dots" role="img" aria-label={`${prog} из ${PUZZLE_SIZE} фрагментов`}>
                  {Array.from({ length: PUZZLE_SIZE }, (_, i) => (
                    <i key={i} className={`pz-dot${i < prog ? ' on' : ''}`} />
                  ))}
                </div>
                <div className="shop-progress"><i style={{ width: `${(prog / PUZZLE_SIZE) * 100}%` }} /></div>
                <div className="tiny muted" style={{ marginTop: 4 }}>
                  Купить нельзя: за каждый завершённый урок — +1 🧩
                </div>
              </div>
              <div className="row mb">
                <button
                  className={`btn lg grow ${isCurrent ? 'green' : 'primary'}`}
                  onClick={() => {
                    tapPickCostume(c.id);
                    closeSheet();
                  }}
                >
                  {isCurrent ? 'Собираю ✓' : prog > 0 ? 'Продолжить сборку' : 'Собирать'}
                </button>
              </div>
              <button
                type="button"
                className="btn lg wide ghost mb"
                onClick={() => tapWish(c.id, c.title)}
              >
                {isWished(wishlist, c.id) ? '💜 В мечтах — убрать' : '🤍 В мечты'}
              </button>
            </>
          )}
          {done && (
            <>
              <button
                className="btn lg wide ghost mb"
                aria-expanded={paletteOpen}
                onClick={() => {
                  sfx.tap();
                  setPaletteOpen((o) => !o);
                }}
              >
                {paletteOpen ? '🎨 Готово' : '🎨 Акцент'}
              </button>
              {paletteOpen && (
                <TintPicker
                  caption="Акцент"
                  targetId={c.id}
                  title={c.title}
                  tuning={profile.shop?.tuning}
                  onPick={(tint, unlocked) => tapTint({ id: c.id, title: c.title }, tint, unlocked)}
                />
              )}
            </>
          )}
        </>
      );
    }
    if (sheet.kind === 'sound') {
      const pack = sheet.pack;
      const ownedPack = soundOwned.includes(pack.id);
      const selected = selectedSound === pack.id;
      const affordable = gems >= pack.price;
      return (
        <>
          <div className="shop-bigart">
            <div className="music-cover music-cover-lg sound-cover" aria-hidden="true">
              <span>{pack.emoji}</span>
              <i>♪</i>
            </div>
          </div>
          <h2 style={{ margin: '0 0 2px' }}>{pack.title}</h2>
          <p className="tiny muted" style={{ marginTop: 0 }}>{pack.desc} · звуки правильного ответа и ошибки</p>
          <div className="row mb">
            <span className={`shop-price${affordable ? ' afford' : ''}`}>💎 {pack.price}</span>
            <span className="tiny muted grow" style={{ alignSelf: 'center' }}>
              {ownedPack ? 'В коллекции' : pack.price === 0 ? 'Бесплатно' : `У тебя ${gems} 💎`}
            </span>
          </div>
          <div className="mb">{cueButtons(pack, 'lg')}</div>
          <div className="row mb">
            {ownedPack ? (
              <button
                className={`btn lg grow ${selected ? 'green' : 'primary'}`}
                disabled={selected}
                onClick={() => {
                  chooseSound(pack);
                  closeSheet();
                }}
              >
                {selected ? 'Звучит в уроках ✓' : 'Выбрать'}
              </button>
            ) : (
              <button
                className="btn lg grow primary"
                disabled={!affordable}
                onClick={() => {
                  closeSheet();
                  sfx.tap();
                  setAskSound(pack);
                }}
              >
                {affordable ? `Купить за 💎${pack.price}` : `Ещё ${pack.price - gems} 💎`}
              </button>
            )}
          </div>
          <p className="tiny muted">{pack.about}</p>
        </>
      );
    }
    // track
    const track = sheet.track;
    const ownedTrack = musicOwned.includes(track.id);
    const selected = selectedMusic === track.id;
    const previewing = previewTrack === track.id;
    const affordable = gems >= track.price;
    return (
      <>
        <div className="shop-bigart">
          <div className="music-cover music-cover-lg" aria-hidden="true">
            <span>{track.emoji}</span>
            <i>♫</i>
            {previewing && <span className="shop-eq"><i /><i /><i /></span>}
          </div>
        </div>
        <h2 style={{ margin: '0 0 2px' }}>{track.title}</h2>
        <p className="tiny muted" style={{ marginTop: 0 }}>
          «{track.originalTitle}» · {track.artist} · {fmtTime(track.seconds)}
        </p>
        <div className="row mb">
          <span className={`shop-price${affordable ? ' afford' : ''}`}>💎 {track.price}</span>
          <span className="tiny muted grow" style={{ alignSelf: 'center' }}>
            {ownedTrack ? 'В коллекции' : track.price === 0 ? 'Бесплатно' : `У тебя ${gems} 💎`}
          </span>
        </div>
        <div className="row mb">
          <button className="btn lg grow ghost" onClick={() => togglePreview(track)}>
            {previewing ? '⏸ Остановить' : '▶ Послушать'}
          </button>
          {ownedTrack ? (
            <button
              className={`btn lg grow ${selected ? 'green' : 'primary'}`}
              onClick={() => {
                chooseMusic(selected ? null : track.id);
                closeSheet();
              }}
            >
              {selected ? 'Играет ✓' : 'Выбрать'}
            </button>
          ) : (
            <button
              className="btn lg grow primary"
              disabled={!affordable}
              onClick={() => {
                closeSheet();
                sfx.tap();
                setAskMusic(track);
              }}
            >
              {track.price === 0 ? 'Забрать бесплатно' : affordable ? `Купить за 💎${track.price}` : `Ещё ${track.price - gems} 💎`}
            </button>
          )}
        </div>
        {!ownedTrack && (
          <button
            type="button"
            className="btn lg wide ghost mb"
            onClick={() => tapWish(track.id, track.title)}
          >
            {isWished(wishlist, track.id) ? '💜 В мечтах — убрать' : '🤍 В мечты'}
          </button>
        )}
        {track.about && <p className="tiny muted">{track.about}</p>}
      </>
    );
  })();

  // ── Гардероб: мои вещи ────────────────────────────────────────────────

  const wardrobeRow = (key: string, target: Detail, art: ReactNode, title: string, state: string, wearing: boolean, actionLabel: string, onAction: () => void) => (
    <div key={key} className={`shop-wear${wearing ? ' on' : ''}`} role="button" tabIndex={0} aria-label={title}
      onClick={() => openSheet(target)}
      onKeyDown={(e) => { if (e.key === 'Enter') openSheet(target); }}>
      <span className="shop-wear-icon">{art}</span>
      <span className="grow" style={{ minWidth: 0 }}>
        <span className="shop-title">{title}</span>
        <span className="tiny muted">{state}</span>
      </span>
      <button
        className={`btn sm ${wearing ? 'green' : 'ghost'}`}
        onClick={(e) => {
          e.stopPropagation();
          onAction();
        }}
      >
        {actionLabel}
      </button>
    </div>
  );

  const ownedBySlot = (slot: string) =>
    SHOP_ITEMS.filter((i) => i.slot === slot && isOwned(owned, i.id));

  return (
    <div className="screen">
      {/* ── Шапка: название и баланс — и больше ничего ─────────────────── */}
      <div className="shop-sticky">
        <div className="row mb">
          <h1 className="grow" style={{ margin: 0 }}>
            Магазин БУКа 🎩
          </h1>
          <div className="stat-pill gems">💎 {gems}</div>
        </div>
        <div className="shop-seg" role="tablist" aria-label="Витрина или гардероб">
          <button role="tab" aria-selected={view === 'vitrina'} className={view === 'vitrina' ? 'on' : ''} onClick={() => setView('vitrina')}>
            🛍️ Витрина
          </button>
          <button role="tab" aria-selected={view === 'wardrobe'} className={view === 'wardrobe' ? 'on' : ''} onClick={() => setView('wardrobe')}>
            👕 Гардероб · {owned.length + pz.assembled.length + musicOwned.length + soundOwned.length}
          </button>
        </div>
        {view === 'vitrina' && (
          <div className="shop-cats" role="tablist" aria-label="Разделы магазина">
            {CATS.map((c) => (
              <button key={c.id} role="tab" aria-selected={cat === c.id} className={`chip${cat === c.id ? ' on' : ''}`} onClick={() => setCat(c.id)}>
                {c.emoji} {c.title}
              </button>
            ))}
          </div>
        )}
      </div>

      {view === 'vitrina' && cat === 'outfits' && (
        <section className="mt" aria-label="Наряды">
          {/* ── Герой витрины: одна ближайшая цель ───────────────────────── */}
          {hero && hero.kind === 'item' && (() => {
            const affordable = canBuy(hero.item, gems);
            const missing = missingGems(hero.item, gems);
            const wished = isWished(wishlist, hero.item.id);
            return (
              <article
                className="shop-hero"
                role="button"
                tabIndex={0}
                aria-label={`Ближайшая цель: ${hero.item.title}`}
                onClick={() => openSheet({ kind: 'item', item: hero.item })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') openSheet({ kind: 'item', item: hero.item });
                }}
              >
                <button
                  type="button"
                  className={`shop-heart${wished ? ' on' : ''}`}
                  aria-label={wished ? `Убрать «${hero.item.title}» из мечт` : `Добавить «${hero.item.title}» в мечты`}
                  onClick={(e) => {
                    e.stopPropagation();
                    tapWish(hero.item.id, hero.item.title);
                  }}
                >
                  {wished ? '💜' : '🤍'}
                </button>
                <div className="shop-hero-art">
                  <Mascot mood="idle" look={{ [hero.item.slot]: hero.item.id }} stage={growth.index} size={96} />
                </div>
                <div className="shop-hero-body grow">
                  <span className="shop-badge">🎯 Ближайшая цель</span>
                  <div className="shop-hero-title">{hero.item.title}</div>
                  <div className="tiny muted">{hero.item.desc}</div>
                  <div className="tiny" style={{ marginTop: 4, fontWeight: 700 }}>
                    {affordable
                      ? `Хватает! ${hero.item.price} 💎 — и он твой`
                      : `У тебя ${gems} 💎 · ещё ${missing} 💎`}
                  </div>
                  <button
                    type="button"
                    className="btn sm primary mt"
                    style={{ marginTop: 8 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (affordable) {
                        sfx.tap();
                        setAsk(hero.item);
                      } else {
                        sfx.tap();
                        haptic.tap();
                        if (!wished) {
                          toggleWishlist(hero.item.id);
                          showToast({
                            emoji: '🤍',
                            title: 'Копим!',
                            text: `«${hero.item.title}»: ещё ${missing} 💎. В списке «Мечты» в Гардеробе`,
                          });
                        } else {
                          showToast({
                            emoji: '💎',
                            title: `До «${hero.item.title}» ещё ${missing} 💎`,
                            text: 'Кристаллы дают за задания дня и сундук — загляни на главную',
                          });
                        }
                      }
                    }}
                  >
                    {affordable ? `Купить · 💎${hero.item.price}` : `Копить — ещё ${missing} 💎`}
                  </button>
                </div>
              </article>
            );
          })()}

          {hero && hero.kind === 'costume' && (
            <article
              className="shop-hero"
              role="button"
              tabIndex={0}
              aria-label={`Следующая цель: ${hero.costume.title}`}
              onClick={() => {
                setView('vitrina');
                setCat('costumes');
                openSheet({ kind: 'costume', costume: hero.costume });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setView('vitrina');
                  setCat('costumes');
                  openSheet({ kind: 'costume', costume: hero.costume });
                }
              }}
            >
              <div className="shop-hero-art">
                <div className="pz-locked">
                  <Mascot mood="idle" costumeId={hero.costume.id} stage={growth.index} size={96} />
                </div>
              </div>
              <div className="shop-hero-body grow">
                <span className="shop-badge">🎯 Следующая цель</span>
                <div className="shop-hero-title">{hero.costume.title}</div>
                <div className="tiny muted">{hero.costume.desc}</div>
                <div className="tiny" style={{ marginTop: 4, fontWeight: 700 }}>
                  Фрагментов: {hero.progress} из {PUZZLE_SIZE} 🧩
                </div>
                <button
                  type="button"
                  className="btn sm primary mt"
                  style={{ marginTop: 8 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setView('vitrina');
                    setCat('costumes');
                    tapPickCostume(hero.costume.id);
                  }}
                >
                  Собирать костюм ➜
                </button>
              </div>
            </article>
          )}

          {hero && hero.kind === 'track' && (() => {
            const affordable = gems >= hero.track.price;
            const missing = Math.max(0, hero.track.price - gems);
            const wished = isWished(wishlist, hero.track.id);
            return (
              <article
                className="shop-hero"
                role="button"
                tabIndex={0}
                aria-label={`Следующая цель: ${hero.track.title}`}
                onClick={() => {
                  setView('vitrina');
                  setCat('music');
                  openSheet({ kind: 'track', track: hero.track });
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setView('vitrina');
                    setCat('music');
                    openSheet({ kind: 'track', track: hero.track });
                  }
                }}
              >
                <div className="shop-hero-art">
                  <div className="music-cover" style={{ width: 84, height: 84, fontSize: 36 }}>
                    <span>{hero.track.emoji}</span>
                    <i>♫</i>
                  </div>
                </div>
                <div className="shop-hero-body grow">
                  <span className="shop-badge">🎯 Следующая цель</span>
                  <div className="shop-hero-title">{hero.track.title}</div>
                  <div className="tiny muted">«{hero.track.originalTitle}» · Kevin MacLeod</div>
                  <div className="tiny" style={{ marginTop: 4, fontWeight: 700 }}>
                    {affordable
                      ? `Хватает! ${hero.track.price} 💎 — и мелодия твоя`
                      : `У тебя ${gems} 💎 · ещё ${missing} 💎`}
                  </div>
                  <button
                    type="button"
                    className="btn sm primary mt"
                    style={{ marginTop: 8 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (affordable) {
                        sfx.tap();
                        setAskMusic(hero.track);
                      } else {
                        sfx.tap();
                        haptic.tap();
                        if (!wished) {
                          toggleWishlist(hero.track.id);
                          showToast({
                            emoji: '🤍',
                            title: 'Копим!',
                            text: `«${hero.track.title}»: ещё ${missing} 💎. В списке «Мечты» в Гардеробе`,
                          });
                        } else {
                          showToast({
                            emoji: '💎',
                            title: `До «${hero.track.title}» ещё ${missing} 💎`,
                            text: 'Кристаллы дают за задания дня и сундук — загляни на главную',
                          });
                        }
                      }
                    }}
                  >
                    {affordable ? `Купить · 💎${hero.track.price}` : `Копить — ещё ${missing} 💎`}
                  </button>
                </div>
              </article>
            );
          })()}

          {!hero && (
            <div className="card tiny mb" style={{ textAlign: 'center' }}>
              ✨ Весь гардероб собран! Все наряды, костюмы и музыка у тебя.
            </div>
          )}

          <div className="mb">
            <h2 className="mb">Наряды БУКа</h2>
            <div className="tiny muted">Купленное сразу надевается · тап по карточке — подробнее</div>
          </div>
          <ShowcaseGrid>{OUTFIT_ITEMS.map(itemCard)}</ShowcaseGrid>
        </section>
      )}

      {/* ── Техника: отдельные полки авто, кораблей и телефонов ─────────── */}
      {view === 'vitrina' && cat === 'toys' && (
        <section className="mt" aria-label="Техника">
          <div className="mb">
            <h2 className="mb">Техника БУКа</h2>
            <div className="tiny muted">Авто, корабли и телефоны — каждый раздел отдельно. Купленное ждёт тебя в ангаре.</div>
          </div>
          <div className="shop-cats shop-toy-cats" role="tablist" aria-label="Разделы техники">
            {TOY_SHELVES.map(({ id, title, emoji }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={toyShelf === id}
                className={`chip${toyShelf === id ? ' on' : ''}`}
                onClick={() => setToyShelf(id)}
              >
                {emoji} {title}
              </button>
            ))}
          </div>
          {ownedToys.length > 0 && (
            <button type="button" className="btn sm ghost wide hangar-open" onClick={openHangar}>
              🚗 Мой ангар — вся твоя техника крупным планом ➜
            </button>
          )}
          {toyGoal && (
            <div className="shop-tech-goal">
              <span className="shop-tech-goal-icon" aria-hidden="true">
                {toyGoal.emoji ?? '🚗'}
              </span>
              <span className="grow">
                <b>Ближайшая покупка: {toyGoal.title}</b>
                <span className="tiny muted">
                  {gems >= toyGoal.price
                    ? `Уже хватает — ${toyGoal.price} 💎. Забирай!`
                    : `Ещё ${missingGems(toyGoal, gems)} 💎 из ${toyGoal.price}`}
                </span>
              </span>
              <button
                type="button"
                className={`btn sm ${gems >= toyGoal.price ? 'primary' : 'ghost'}`}
                onClick={() => {
                  if (gems >= toyGoal.price) {
                    sfx.tap();
                    setAsk(toyGoal);
                  } else {
                    openSheet({ kind: 'item', item: toyGoal });
                  }
                }}
              >
                {gems >= toyGoal.price ? 'Купить' : 'Посмотреть'}
              </button>
            </div>
          )}
          {TOY_SHELVES.filter(({ id }) => id === toyShelf).map(({ id, title, emoji }) => (
            <div className={`shop-case-group shop-case-${id}`} key={id}>
              <h3 className="shop-case-group-title">
                <span aria-hidden="true">{emoji}</span> {title}
              </h3>
              <ShowcaseGrid tone={id === 'car' ? 'mint' : id === 'ship' ? 'sky' : undefined}>
                {toysByShelf(id).map(itemCard)}
              </ShowcaseGrid>
            </div>
          ))}
        </section>
      )}

      {view === 'vitrina' && cat === 'costumes' && (
        <section className="mt" aria-label="Костюмы">
          <div className="mb">
            <h2 className="mb">Костюмы · пазлы</h2>
            <div className="tiny muted">
              Завершённый урок — фрагмент пазла. Собери {PUZZLE_SIZE} — БУК получит новый костюм 🧩
            </div>
          </div>
          {allCostumesDone && (
            <div className="card tiny mb" style={{ textAlign: 'center' }}>
              ✨ Вся коллекция собрана! Теперь за каждый урок — +{OVERFLOW_GEMS} 💎
            </div>
          )}
          {(() => {
            const activeId = collecting;
            const activeCostumeObj = activeId ? COSTUMES.find((c) => c.id === activeId) : null;
            const prog = activeCostumeObj ? costumeProgress(pz, activeCostumeObj.id) : 0;
            if (!activeCostumeObj) return null;
            return (
              <div className="shop-collect mb">
                <Mascot mood="idle" costumeId={activeCostumeObj.id} size={56} stage={growth.index} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <b>Собираем сейчас: {activeCostumeObj.title}</b>
                  <div className="tiny muted">{activeCostumeObj.desc}</div>
                  <div className="shop-progress"><i style={{ width: `${(prog / PUZZLE_SIZE) * 100}%` }} /></div>
                  <div className="tiny" style={{ marginTop: 4 }}>
                    Фрагментов: {prog} из {PUZZLE_SIZE} — за каждый урок
                  </div>
                </div>
              </div>
            );
          })()}
          <ShowcaseGrid>{COSTUMES.map(costumeCard)}</ShowcaseGrid>
        </section>
      )}

      {view === 'vitrina' && cat === 'music' && (
        <section className="mt" aria-label="Музыка">
          <div className="between mb">
            <div>
              <h2 style={{ margin: 0 }}>Музыка БУКа 🎵</h2>
              <div className="tiny muted">{MUSIC_TRACKS.length} мелодий Kevin MacLeod · слушай перед покупкой</div>
            </div>
          </div>
          <div className="music-store-note">
            🎧 Настоящие записи Kevin MacLeod — они работают офлайн и используются по лицензии CC BY 4.0
            (автор указан в разделе «Авторы и лицензии»).
          </div>
          <div className="mb"><MusicCreditsToggle /></div>
          {/* Полки: спокойный фон отдельно — у каждого своё место в игре */}
          {MUSIC_SHELVES.map(({ shelf, title }) => (
            <div className="music-shelf" key={shelf}>
              <h3 className="music-shelf-title">{title}</h3>
              <ShowcaseGrid>{tracksByShelf(shelf).map(trackCard)}</ShowcaseGrid>
            </div>
          ))}
        </section>
      )}

      {view === 'vitrina' && cat === 'sounds' && (
        <section className="mt" aria-label="Звуки">
          <div className="mb">
            <h2 style={{ margin: 0 }}>Звуки БУКа 🔊</h2>
            <div className="tiny muted">
              {SOUND_PACKS.length} наборов · мелодия за правильный ответ ✓ и за ошибку ✗ · слушай перед покупкой
            </div>
          </div>
          <div className="music-store-note">
            🎶 Выбранный набор звучит в уроках, заданиях и квестах. Мелодия ошибки всегда мягкая и короткая:
            это подсказка «попробуй иначе», а не наказание.
          </div>
          <ShowcaseGrid>{SOUND_PACKS.map(soundCard)}</ShowcaseGrid>
        </section>
      )}

      {view === 'vitrina' && cat === 'backgrounds' && (
        <section className="mt" aria-label="Фоны приложения">
          <div className="mb">
            <h2 className="mb">Фоны и оформление</h2>
            <p className="tiny muted">
              Выбирай настроение приложения. Каждый стиль доступен бесплатно и подходит для светлой и тёмной схемы.
            </p>
          </div>
          <div role="group" aria-label="Выбор оформления приложения">
            <ShowcaseGrid>
              {THEME_STYLES.map((style) => (
                <BackgroundThemeCard
                  key={style.id}
                  theme={style}
                  selected={themeStyle === style.id}
                  onSelect={() => selectThemeStyle(style.id)}
                />
              ))}
            </ShowcaseGrid>
          </div>
        </section>
      )}

      {view === 'wardrobe' && (
        <>
          {/* Примерочная: кто сейчас наряжен */}
          <div className="card mb shop-stage">
            <button className="shop-mascot" aria-label="БУК в твоём наряде" onClick={() => { sfx.hint(); haptic.tap(); setMood('dance'); setTimeout(() => setMood('idle'), 1800); }}>
              <Mascot mood={mood} look={look} costumeId={pz.worn} stage={growth.index} size={132} />
            </button>
            <div className="grow center">
              <div style={{ fontWeight: 800 }}>
                {growth.title} · мой наряд
              </div>
              <div className="tiny">{growth.desc}</div>
              <div className="tiny" style={{ marginTop: 4 }}>
                {growth.nextAt
                  ? `Освоено ${mastered} ${plural(mastered, 'слово', 'слова', 'слов')} · до ступени выше ${growth.nextAt - mastered}`
                  : `Освоено ${mastered} ${plural(mastered, 'слово', 'слова', 'слов')} — самая высокая ступень ✨`}
              </div>
              <div className="tiny" style={{ marginTop: 4 }}>
                {owned.length ? `Коллекция собрана на ${wardrobeValue(owned)} 💎` : 'Пока без обновок — витрина ➜'}
              </div>
            </div>
          </div>

          {/* Мои наряды: по слотам, только купленное */}
          <section className="mb" aria-label="Мои наряды">
            <h2 className="mb">Мои наряды</h2>
            {ownedOutfits.length === 0 && (
              <div className="card tiny mb" style={{ textAlign: 'center' }}>
                Пока пусто. Купленное в витрине сразу попадает сюда 🎩
              </div>
            )}
            {(['head', 'face', 'neck', 'badge'] as const).map((slot) => {
              const items = ownedBySlot(slot);
              if (!items.length) return null;
              return (
                <div key={slot} className="mb">
                  <h3 className="music-shelf-title">{SLOT_TITLE[slot]}</h3>
                  <div className="col">
                    {items.map((item) =>
                      wardrobeRow(
                        item.id,
                        { kind: 'item', item },
                        <Mascot mood="idle" look={{ [item.slot]: item.id }} stage={growth.index} size={44} />,
                        item.title,
                        item.desc,
                        isWearing(look, item),
                        isWearing(look, item) ? 'Снять' : 'Надеть',
                        () => tapWear(item),
                      ),
                    )}
                  </div>
                </div>
              );
            })}
          </section>

          {/* Моя техника: авто, телефоны и корабли (0.19.0 → 0.20.0).
              0.22.0: техника не на БУКе — коллекция в сцене «Ангар», вход здесь. */}
          <section className="mb" aria-label="Моя техника">
            <div className="row mb" style={{ alignItems: 'center' }}>
              <h2 className="grow" style={{ margin: 0 }}>
                Моя техника
              </h2>
              {ownedToys.length > 0 && (
                <button type="button" className="btn sm ghost" onClick={openHangar}>
                  Открыть ангар ➜
                </button>
              )}
            </div>
            {ownedToys.length === 0 && (
              <div className="card tiny mb" style={{ textAlign: 'center' }}>
                Пока пусто. Полка «Техника» в витрине
              </div>
            )}
            <div className="col">
              {ownedToys.map((item) =>
                wardrobeRow(
                  item.id,
                  { kind: 'item', item },
                  <ToyArt id={item.id} size={44} tuning={profile.shop?.tuning} />,
                  item.title,
                  item.desc,
                  isWearing(look, item),
                  isWearing(look, item) ? 'С подиума' : 'На подиум',
                  () => tapWear(item),
                ),
              )}
            </div>
          </section>

          {/* Мои костюмы: собранное */}
          <section className="mb" aria-label="Мои костюмы">
            <h2 className="mb">Мои костюмы</h2>
            {pz.assembled.length === 0 && (
              <div className="card tiny mb" style={{ textAlign: 'center' }}>
                Пока ни одного костюма. Каждый урок приносит фрагмент 🧩
              </div>
            )}
            <div className="col">
              {COSTUMES.filter((c) => pz.assembled.includes(c.id)).map((c) =>
                wardrobeRow(
                  c.id,
                  { kind: 'costume', costume: c },
                  <Mascot mood={pz.worn === c.id ? 'happy' : 'idle'} costumeId={c.id} size={44} stage={growth.index} />,
                  c.title,
                  c.desc,
                  pz.worn === c.id,
                  pz.worn === c.id ? 'Снять' : 'Надеть',
                  () => tapCostume(c.id),
                ),
              )}
            </div>
          </section>

          {/* Моя музыка: коллекция и выбор фона */}
          <section className="mb" aria-label="Моя музыка">
            <h2 className="mb">Моя музыка</h2>
            {selectedMusic && (
              <button className="music-choice" onClick={() => chooseMusic(null)}>
                <span className="music-emoji">🔇</span>
                <span className="grow"><b>Тишина</b><small>Выключить фоновую музыку</small></span>
              </button>
            )}
            {MUSIC_TRACKS.filter((t) => musicOwned.includes(t.id)).map((track) => (
              <button
                key={track.id}
                className={`music-choice${selectedMusic === track.id ? ' selected' : ''}`}
                onClick={() => chooseMusic(selectedMusic === track.id ? null : track.id)}
              >
                <span className="music-emoji">{track.emoji}</span>
                <span className="grow"><b>{track.title}</b><small>«{track.originalTitle}»</small></span>
                {selectedMusic === track.id && <span aria-label="Выбрано">✓</span>}
              </button>
            ))}
            {musicOwned.length === 0 && (
              <p className="tiny">Пока нет мелодий. Витрина ➜ полка «Музыка» — две стартовые бесплатно.</p>
            )}
          </section>

          {/* Мои звуки: какой набор звучит за ответы в уроках */}
          <section className="mb" aria-label="Мои звуки">
            <h2 className="mb">Мои звуки</h2>
            {SOUND_PACKS.filter((p) => soundOwned.includes(p.id)).map((pack) => (
              <button
                key={pack.id}
                className={`music-choice sound-choice${selectedSound === pack.id ? ' selected' : ''}`}
                onClick={() => (selectedSound === pack.id ? tryCue(pack, 'correct') : chooseSound(pack))}
              >
                <span className="music-emoji">{pack.emoji}</span>
                <span className="grow"><b>{pack.title}</b><small>{pack.desc}</small></span>
                {selectedSound === pack.id && <span aria-label="Выбрано">✓</span>}
              </button>
            ))}
            <p className="tiny muted">Больше наборов — витрина ➜ полка «Звуки».</p>
          </section>

          {/* Мечты 🤍: список желаний с прогрессом накопления */}
          <section className="mb" aria-label="Мечты">
            <div className="between mb">
              <div>
                <h2 style={{ margin: 0 }}>Мечты 🤍</h2>
                <div className="tiny muted">Отмечай сердцем — видно, к чему копить</div>
              </div>
            </div>
            {wishlist.length === 0 ? (
              <div className="card tiny mb" style={{ textAlign: 'center' }}>
                Пока ничего не отложено. Нажми 🤍 на карточке в витрине — и вещь появится здесь с прогрессом накопления ✨
              </div>
            ) : (
              <div className="wishlist-grid">
                {wishlist.map((id) => {
                  const item = ITEM_BY_ID[id];
                  const track = MUSIC_BY_ID[id];
                  const costume = COSTUMES.find((c) => c.id === id);

                  if (item) {
                    const left = missingGems(item, gems);
                    const canGet = left === 0;
                    const pct = Math.min(100, Math.round((gems / item.price) * 100));
                    return (
                      <div
                        key={id}
                        className={`wishlist-card${canGet ? ' afford' : ''}`}
                        role="button"
                        tabIndex={0}
                        aria-label={`${item.title} в мечтах`}
                        onClick={() => openSheet({ kind: 'item', item })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') openSheet({ kind: 'item', item });
                        }}
                      >
                        <button
                          type="button"
                          className="shop-heart on"
                          aria-label={`Убрать «${item.title}» из мечт`}
                          onClick={(e) => {
                            e.stopPropagation();
                            tapWish(item.id, item.title);
                          }}
                        >
                          💜
                        </button>
                        <div className="wishlist-card-art">
                          {isToy(item) ? (
                            <ToyArt id={item.id} size={64} tuning={profile.shop?.tuning} />
                          ) : (
                            <Mascot mood="idle" look={{ [item.slot]: item.id }} stage={growth.index} size={64} />
                          )}
                        </div>
                        <div className="shop-title">{item.title}</div>
                        <div className="shop-progress wishlist-progress-row">
                          <i style={{ width: `${pct}%` }} />
                        </div>
                        <div className="tiny muted">
                          {canGet ? 'Можно брать! ✨' : `Ещё ${left} 💎 (есть ${gems}/${item.price})`}
                        </div>
                        <button
                          type="button"
                          className={`btn sm wide ${canGet ? 'primary' : 'ghost'}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (canGet) {
                              sfx.tap();
                              setAsk(item);
                            } else {
                              openSheet({ kind: 'item', item });
                            }
                          }}
                        >
                          {canGet ? `Купить · 💎${item.price}` : `Ещё ${left} 💎`}
                        </button>
                      </div>
                    );
                  }

                  if (track) {
                    const left = Math.max(0, track.price - gems);
                    const canGet = left === 0;
                    const pct = Math.min(100, Math.round((gems / track.price) * 100));
                    return (
                      <div
                        key={id}
                        className={`wishlist-card${canGet ? ' afford' : ''}`}
                        role="button"
                        tabIndex={0}
                        aria-label={`${track.title} в мечтах`}
                        onClick={() => openSheet({ kind: 'track', track })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') openSheet({ kind: 'track', track });
                        }}
                      >
                        <button
                          type="button"
                          className="shop-heart on"
                          aria-label={`Убрать «${track.title}» из мечт`}
                          onClick={(e) => {
                            e.stopPropagation();
                            tapWish(track.id, track.title);
                          }}
                        >
                          💜
                        </button>
                        <div className="wishlist-card-art">
                          <div className="music-cover" style={{ width: 56, height: 56, fontSize: 24 }}>
                            <span>{track.emoji}</span>
                            <i>♫</i>
                          </div>
                        </div>
                        <div className="shop-title">{track.title}</div>
                        <div className="shop-progress wishlist-progress-row">
                          <i style={{ width: `${pct}%` }} />
                        </div>
                        <div className="tiny muted">
                          {canGet ? 'Можно брать! ✨' : `Ещё ${left} 💎 (есть ${gems}/${track.price})`}
                        </div>
                        <button
                          type="button"
                          className={`btn sm wide ${canGet ? 'primary' : 'ghost'}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (canGet) {
                              sfx.tap();
                              setAskMusic(track);
                            } else {
                              openSheet({ kind: 'track', track });
                            }
                          }}
                        >
                          {canGet ? `Купить · 💎${track.price}` : `Ещё ${left} 💎`}
                        </button>
                      </div>
                    );
                  }

                  if (costume) {
                    const prog = costumeProgress(pz, costume.id);
                    const pct = Math.min(100, Math.round((prog / PUZZLE_SIZE) * 100));
                    return (
                      <div
                        key={id}
                        className="wishlist-card"
                        role="button"
                        tabIndex={0}
                        aria-label={`${costume.title} в мечтах`}
                        onClick={() => openSheet({ kind: 'costume', costume })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') openSheet({ kind: 'costume', costume });
                        }}
                      >
                        <button
                          type="button"
                          className="shop-heart on"
                          aria-label={`Убрать «${costume.title}» из мечт`}
                          onClick={(e) => {
                            e.stopPropagation();
                            tapWish(costume.id, costume.title);
                          }}
                        >
                          💜
                        </button>
                        <div className="wishlist-card-art">
                          <div className="pz-locked">
                            <Mascot mood="idle" costumeId={costume.id} stage={growth.index} size={64} />
                          </div>
                        </div>
                        <div className="shop-title">{costume.title}</div>
                        <div className="shop-progress wishlist-progress-row">
                          <i style={{ width: `${pct}%` }} />
                        </div>
                        <div className="tiny muted">
                          {prog} из {PUZZLE_SIZE} 🧩 · за уроки
                        </div>
                        <button
                          type="button"
                          className="btn sm wide ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setView('vitrina');
                            setCat('costumes');
                            tapPickCostume(costume.id);
                          }}
                        >
                          К сборке
                        </button>
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            )}
          </section>
        </>
      )}

      <p className="tiny center">
        Кристаллы 💎 дают за задания дня и сундук — загляни на главную.
        <br />
        БУК растёт, когда ты осваиваешь слова: сейчас — {growth.title.toLowerCase()}.
      </p>

      {/* ── Подробная карточка (sheet снизу) ───────────────────────────── */}
      {sheet && (
        <Sheet onClose={closeSheet}>
          <h2 className="sr-only">Подробно о товаре</h2>
          {sheetBody}
        </Sheet>
      )}

      {/* ── «Ангар БУКа»: сцена коллекции техники (0.22.0) ──────────────── */}
      {hangarOpen && <HangarScene onClose={() => setHangarOpen(false)} />}

      {askMusic && (
        <ConfirmDialog
          emoji={askMusic.emoji}
          title={askMusic.price === 0 ? `Забрать «${askMusic.title}»?` : `Купить «${askMusic.title}»?`}
          text={askMusic.price === 0 ? 'Мелодия бесплатная. БУК сразу сможет её включить.' : `Отдашь ${askMusic.price} 💎 из ${gems}. БУК сразу включит новую музыку.`}
          stayLabel={askMusic.price === 0 ? 'Забрать бесплатно' : `Купить за 💎${askMusic.price}`}
          leaveLabel="Не сейчас"
          onStay={confirmMusicBuy}
          onLeave={() => setAskMusic(null)}
        />
      )}

      {askSound && (
        <ConfirmDialog
          emoji={askSound.emoji}
          title={`Купить звуки «${askSound.title}»?`}
          text={`Отдашь ${askSound.price} 💎 из ${gems}. Новые звуки сразу зазвучат в уроках.`}
          stayLabel={`Купить за 💎${askSound.price}`}
          leaveLabel="Не сейчас"
          onStay={confirmSoundBuy}
          onLeave={() => setAskSound(null)}
        />
      )}

      {ask && (
        <ConfirmDialog
          emoji={ask.emoji ?? '🎩'}
          title={`Купить «${ask.title}»?`}
          text={
            isToy(ask)
              ? `Отдашь ${ask.price} 💎 из ${gems}. Покупка сразу появится рядом с БУКом.`
              : `Отдашь ${ask.price} 💎 из ${gems}. БУК сразу это примерит.`
          }
          stayLabel={`Купить за 💎${ask.price}`}
          leaveLabel="Не сейчас"
          onStay={confirmBuy}
          onLeave={() => setAsk(null)}
        />
      )}

      {askSell && (
        <ConfirmDialog
          emoji={askSell.emoji ?? '🎩'}
          title={`Сдать «${askSell.title}» обратно?`}
          text={`Получишь ${sellPrice(askSell)} 💎 вместо ${askSell.price} — вещи дешевеют после покупки. «${askSell.title}» уйдёт из гардероба навсегда.`}
          stayLabel={`Сдать · +${sellPrice(askSell)} 💎`}
          leaveLabel="Оставить"
          onStay={confirmSell}
          onLeave={() => setAskSell(null)}
        />
      )}

      {askTint && (
        <ConfirmDialog
          emoji="🎨"
          title={`Открыть цвет «${askTint.tint.title.toLowerCase()}»?`}
          text={`Это ${TINT_PRICE} 💎 из ${gems}. Потом сможешь переключаться на него бесплатно.`}
          stayLabel={`Открыть за 💎${TINT_PRICE}`}
          leaveLabel="Не сейчас"
          onStay={confirmTint}
          onLeave={() => setAskTint(null)}
        />
      )}
    </div>
  );
}

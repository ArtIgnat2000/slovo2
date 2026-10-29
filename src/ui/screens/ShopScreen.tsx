import { useEffect, useRef, useState, type ReactNode } from 'react';
import { masteredCount, useActiveProfile, useApp, useLook } from '../../state/store';
import { plural } from '../../engine/quests';
import {
  ITEM_BY_ID,
  CATALOG_OUTFITS,
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
  rarityOf,
  type ToyKind,
} from '../../engine/shop';
import { BUILDINGS, BUILDING_BY_ID, isBuildingOwned, type BuildingItem } from '../../engine/buildings';
import { BASE_SETS, baseSetPrice, type BaseSet } from '../../engine/base-sets';
import { BuildingArt } from '../BuildingArt';
import { BaseTour, warmBaseTour } from '../BaseTour';
import { RarityChip, RarityLabel } from '../RarityChip';
import { Mascot } from '../Mascot';
import { ToyArt } from '../ToyArt';
import { CarTour, CAR_TOUR_IDS, warmCarTour } from '../CarTour';
import { hasProductPhoto, warmProductPhoto } from '../ProductPhoto';
import { carAlt, carKind, carNote, hasCarArt } from '../CarArt';
import { hasShipArt, shipAlt, shipKind, shipNote } from '../ShipArt';
import { WorldScreen } from './WorldScreen';
import {
  ALL_COSTUMES,
  CRYSTAL_COSTUMES,
  COSTUMES,
  OVERFLOW_GEMS,
  PUZZLE_SIZE,
  activeCostume,
  costumeProgress,
  normalizePuzzle,
  type Costume,
} from '../../engine/puzzles';
import { TINT_PALETTES, TINT_PRICE, type TintOption } from '../../engine/tints';
import { TintPicker } from '../TintPicker';
import { ConfirmDialog } from '../Bits';
import { previewSoundCue, sfx } from '../../platform/sound';
import { hasSoundPack, SOUND_PACKS, type SoundCue, type SoundPack } from '../../engine/sounds';
import { haptic } from '../../platform/haptics';
import type { ShopItem } from '../../engine/shop';
import { MUSIC_TRACKS, MUSIC_BY_ID, tracksByShelf, type MusicShelf, type MusicTrack } from '../../engine/music';
import { playMusic } from '../../platform/music';
import { MusicCreditsToggle } from '../Credits';
import { THEME_STYLES, type ThemeStyle } from '../../engine/theme-styles';
import { BackgroundThemeCard } from '../BackgroundThemeCard';
import { Icon, Gem } from '../Icon';
import { ShowcaseGrid } from '../ShowcaseGrid';
import { NaashPanel } from '../NaashPanel';
import { SCHOOL } from '../../engine/naash';

/**
 * Магазин БУКа (концепция 2026-10-17, docs/shop-concept.md).
 *
 * Что изменилось по сравнению с «одной лентой»:
 *  • два верхних уровня — **Витрина** (чего хочу) и **Мои покупки** (что моё);
 *    раньше купленное терялось в общей ленте среди продаваемого;
 *  • витрина режется **чипами-полками**: наряды / техника / костюмы / музыка /
 *    фоны / звуки; новый раздел не требует переделки экрана;
 *  • **витрина-бутик (0.19.0):** у каждого товара своя арочная ниша с лампой и
 *    подиумом (`ShowcaseGrid`) — магазин выглядит витриной, а не списком карточек;
 *  • **Техника:** авто, телефоны, корабли и другие предметы лежат в общей
 *    области «Техника» карты «Моего мира»; она показывает весь инвентарь,
 *    а не только выбранные для подиума вещи.
 *  • «Звуки» (0.17.0) — наборы мелодий правильного ответа и ошибки
 *    (engine/sounds.ts): послушать оба отклика можно прямо на карточке;
 *  • **единый макет карточки** для всех типов товара: арт, название, статус
 *    (есть в коллекции / надето / собираю / ещё N 💎) и одно действие;
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
type View = 'vitrina' | 'wardrobe' | 'world';

/** Полки витрины — по типу товара, не по слоту совы. */
type Cat = 'naash' | 'outfits' | 'toys' | 'buildings' | 'pets' | 'sport' | 'food' | 'sets' | 'music' | 'sounds' | 'backgrounds';

// 0.54.0: у полок магазина — те же иконки набора, что в остальном интерфейсе.
// У «Техники», «Музыки» и «Фонов» своей иконки в наборе 20 пока нет — остаются
// эмодзи до следующей партии (см. docs/proposals/ui-icons.md §6, шаг 3b).
const CATS: { id: Cat; title: string; emoji: string; icon?: 'hat' | 'puzzle' | 'speaker' }[] = [
  // 0.74.0: школьный уголок НААШ первым — своя школа, а не ещё одна полка
  // товаров (docs/proposals/naash-shop.md). Флаг SCHOOL.on убирает его целиком.
  { id: 'naash', title: 'НААШ', emoji: '🏫' },
  { id: 'outfits', title: 'Наряды', emoji: '🎩', icon: 'hat' },
  { id: 'toys', title: 'Техника', emoji: '🚗' },
  { id: 'buildings', title: 'Базы', emoji: '🏙️' },
  { id: 'pets', title: 'Питомцы', emoji: '🐾' },
  { id: 'sport', title: 'Спорт', emoji: '⚽' },
  { id: 'food', title: 'Вкусняшки', emoji: '🧁' },
  { id: 'sets', title: 'Наборы', emoji: '🎁' },
  { id: 'music', title: 'Музыка', emoji: '🎵' },
  { id: 'sounds', title: 'Звуки', emoji: '🔊', icon: 'speaker' },
  { id: 'backgrounds', title: 'Фоны', emoji: '🖼️' },
];

/** Что открылось в подробной карточке (sheet снизу). */
type Detail =
  | { kind: 'item'; item: ShopItem }
  | { kind: 'building'; building: BuildingItem }
  | { kind: 'baseSet'; set: BaseSet }
  | { kind: 'costume'; costume: Costume }
  | { kind: 'track'; track: MusicTrack }
  | { kind: 'sound'; pack: SoundPack };

/** «3:25» — длительность записи на карточке. */
/**
 * Можно ли перекрасить вещь. Фото товара — уже готовая сцена со своим фоном:
 * накладывать на него «цветной карандаш» нельзя (закрасится весь снимок),
 * поэтому у фотографий палитра не показывается. Векторные вещи красятся,
 * как раньше. Правило одно на весь магазин.
 */
function supportsTint(id: string): boolean {
  return !!TINT_PALETTES[id] && !hasProductPhoto(id);
}

/** Все витрины показывают более доступные покупки раньше дорогих. */
function byPriceAscending<T extends { price?: number }>(a: T, b: T): number {
  return (a.price ?? 0) - (b.price ?? 0);
}

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
 * Состояние читается плашкой состояния и подписью кнопки, не только цветом
 * (WCAG 1.4.1); тап по карточке открывает подробный sheet.
 *
 * 0.79.0 — жалобы «ценник занимает много места», «надпись „В Моём мире“
 * закрывает карточку» и «тёмный верх излишне мрачен»; две базовые темы
 * (токены --lux-* в tokens.css, app.css без цветов):
 *  • светлая — Rolls-Royce: жемчужный подиум, хром Pantheon, сапфировый
 *    лак, светлые промежутки витрины;
 *  • тёмная — Maybach: обсидиановая ниша, шампань-золото, лампа салона;
 *  • ценник — компактная плашка в подвале этикетки, РЯДОМ с кнопкой: цена
 *    больше не дублируется в подписи кнопки и не лежит на рисунке;
 *  • статус («В Моём мире ✓», «Твоя ✓») — отдельная строка состояния под
 *    описанием: надпись не перекрывает товар на картинке;
 *  • стык ниши и этикетки — полоса-решётка, «Купить» — лак темы, ценник
 *    гравируется, когда кристаллов хватает (`.afford`), иначе — тихий
 *    контур;
 *  • сердечко «в мечты» и плашка «Собираю» остаются на картинке — это
 *    короткие метки, а не текстовые строки;
 *  • фото/рисунок по-прежнему занимает нишу целиком, описание — максимум
 *    две строки, число колонок решает сетка (2 на телефоне, 3 на планшете).
 */
function ShopCard(props: {
  badge?: string;
  art: ReactNode;
  title: string;
  desc?: string;
  /** Дополнительный класс карточки: on (надето), owned (куплено), current (собираем) */
  cardCls?: string;
  rarity?: import('../../engine/shop').ItemRarity;
  /** Между подписью и подвалом — например, точки прогресса пазла */
  extra?: ReactNode;
  /** Компактная плашка цены — в подвале слева от кнопки, не на картинке */
  priceLabel?: ReactNode;
  /** Строка состояния («В Моём мире ✓») — под описанием, картинку не закрывает */
  statusLabel?: ReactNode;
  afford?: boolean;
  /** У товара студийное фото: снимок занимает нишу целиком */
  photo?: boolean;
  actionLabel: ReactNode;
  actionTone: 'primary' | 'green' | 'ghost';
  actionDisabled?: boolean;
  wished?: boolean;
  onWish?: () => void;
  onOpen: () => void;
  onAction: () => void;
}) {
  return (
    <article
      className={`shop-item${props.cardCls ? ` ${props.cardCls}` : ''}${props.rarity ? ` tier-${props.rarity}` : ''}`}
      role="button"
      tabIndex={0}
      aria-label={props.title}
      onClick={props.onOpen}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && e.key === 'Enter') props.onOpen();
      }}
    >
      {/* Ниша витрины: только товар и короткие метки — без текстовых строк. */}
      <div className={`shop-case${props.photo ? ' shop-case-photo' : ''}`}>
        <div className="shop-icon">{props.art}</div>
        {props.badge && <span className="shop-badge">{props.badge}</span>}
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
      </div>
      <div className="shop-body">
        <div className="shop-title-row">
          <div className="shop-title">{props.title}</div>
          {props.rarity && <RarityLabel rarity={props.rarity} className="rarity-chip-mini" />}
        </div>
        {props.desc && <div className="tiny shop-desc">{props.desc}</div>}
        {props.statusLabel && <div className="shop-status">{props.statusLabel}</div>}
        {props.extra}
        {/* Подвал этикетки: цена — компактной плашкой слева от кнопки.
            Одна цена на карточку, картинка остаётся чистой. */}
        <div className="shop-foot">
          {props.priceLabel && (
            <span className={`shop-price${props.afford ? ' afford' : ''}`}>{props.priceLabel}</span>
          )}
          <button
            className={`btn sm ${props.actionTone}`}
            disabled={props.actionDisabled}
            onClick={(e) => {
              e.stopPropagation();
              props.onAction();
            }}
          >
            {props.actionLabel}
          </button>
        </div>
      </div>
    </article>
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

/**
 * @param initialView — какой сегмент открыть: меню главной ведёт сразу
 *   в «Мои покупки», вкладка внизу — на витрину (0.33.0).
 */
export function ShopScreen({
  initialView = 'vitrina',
}: {
  initialView?: 'vitrina' | 'wardrobe' | 'world';
} = {}) {
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
  const buyBuilding = useApp((s) => s.buyBuilding);
  const buyCrystalCostume = useApp((s) => s.buyCrystalCostume);
  const buyBaseSet = useApp((s) => s.buyBaseSet);
  const themeStyle = useApp((s) => s.settings.themeStyle);
  const setSettings = useApp((s) => s.setSettings);
  const [view, setView] = useState<View>(initialView);
  const [cat, setCat] = useState<Cat>('outfits');
  const [toyShelf, setToyShelf] = useState<ToyKind>('car');
  // Подробная карточка и её палитра (палитра — только в sheet)
  const [sheet, setSheet] = useState<Detail | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [ask, setAsk] = useState<ShopItem | null>(null);
  const [askSell, setAskSell] = useState<ShopItem | null>(null);
  const [askMusic, setAskMusic] = useState<MusicTrack | null>(null);
  const [askBuilding, setAskBuilding] = useState<BuildingItem | null>(null);
  const [askCrystalCostume, setAskCrystalCostume] = useState<Costume | null>(null);
  const [askBaseSet, setAskBaseSet] = useState<BaseSet | null>(null);
  const [askSound, setAskSound] = useState<SoundPack | null>(null);
  const [askTint, setAskTint] = useState<{ target: TintTarget; tint: TintOption } | null>(null);
  const [previewTrack, setPreviewTrack] = useState<string | null>(null);
  const [mood, setMood] = useState<'idle' | 'happy' | 'dance'>('idle');
  // «Мой мир» — общий обзор всей коллекции; запоминаем место магазина,
  // чтобы по кнопке возврата восстановить его, а не сбрасывать в витрину.
  const worldReturnView = useRef<View>(initialView === 'world' ? 'vitrina' : initialView);
  const worldReturnScroll = useRef(0);
  const openMyWorld = () => {
    worldReturnView.current = view === 'world' ? 'vitrina' : view;
    worldReturnScroll.current = typeof window !== 'undefined' ? window.scrollY : 0;
    setView('world');
    if (worldReturnScroll.current > 0) {
      requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }));
    }
  };
  const closeMyWorld = () => {
    setView(worldReturnView.current);
    if (worldReturnScroll.current > 0) {
      requestAnimationFrame(() => window.scrollTo({ top: worldReturnScroll.current, behavior: 'auto' }));
    }
  };

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
  const buildingsOwned = profile.shop?.buildingsOwned ?? [];
  const crystalOwned = profile.shop?.crystalCostumesOwned ?? [];
  const allOwnedCostumes = [...pz.assembled, ...crystalOwned];
  const priceForSet = (setInfo: BaseSet) => baseSetPrice(setInfo, owned, buildingsOwned, allOwnedCostumes);
  const hero = resolveHero(owned, profile.puzzle, musicOwned);
  // Ближайшая техника — отдельная подсказка на полке «Техника»: герой нарядов
  // намеренно не уводит ребёнка на другую полку (см. engine/shop.ts).
  const toyGoal = toysByShelf(toyShelf)
    .filter((item) => !isOwned(owned, item.id))
    .reduce<ShopItem | null>((best, item) => (!best || item.price < best.price ? item : best), null);
  const ownedOutfits = OUTFIT_ITEMS.filter((item) => isOwned(owned, item.id));
  // 0.74.0: форма школы — отдельной группой в «Моих покупках»: её ищут вместе,
  // а не по слотам («кепка» рядом с короной, «худи» рядом с платьями).
  const ownedSchool = ownedOutfits.filter((item) => item.series === 'naash');
  const ownedToys = TOY_ITEMS.filter((item) => isOwned(owned, item.id));
  /**
   * Покупок ещё нет ни одной (0.32.1). Раньше «Мои покупки» у новичка
   * показывали четыре пустые карточки подряд — стена «Пока пусто»,
   * в которой тонет единственное полезное (звуки) и «Мечты».
   * Теперь пустые секции не рисуются, а вместо них — одна строка-приглашение.
   */
  const noPurchases =
    ownedOutfits.length === 0 && ownedToys.length === 0 && pz.assembled.length === 0 && musicOwned.length === 0 && buildingsOwned.length === 0 && crystalOwned.length === 0;

  const tapWish = (id: string, title: string) => {
    sfx.tap();
    haptic.tap();
    const added = toggleWishlist(id);
    if (added) {
      showToast({
        emoji: '🤍',
        title: `«${title}» — в мечтах!`,
        text: 'Прогресс копления — в «Моих покупках»',
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
    // Тёплый старт картинок листа: качаем в момент тапа, чтобы к развороту снимок,
    // ракурсы и комнаты базы уже были в кэше — по тапу они не «долго грузятся»
    // (жалоба 2026-10-29).
    if (detail.kind === 'item') {
      warmProductPhoto(detail.item.id);
      warmCarTour(detail.item.id);
    } else if (detail.kind === 'building') {
      warmBaseTour(detail.building.id);
    }
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
    const toy = isToy(ask);
    const ok = buyItem(ask.id);
    setAsk(null);
    if (ok) {
      sfx.reward();
      haptic.correct();
      setMood('dance');
      setTimeout(() => setMood('idle'), 1800);
      showToast({
        emoji: ask.emoji ?? '🎩',
        title: `${ask.title} — твой!`,
        text: toy ? 'Уже в коллекции «Моего мира» — показываю!' : 'БУК уже примерил обновку',
      });
      if (toy) {
        // Новая техника сразу открывается в общей карте коллекции, чтобы
        // ребёнок увидел покупку и не искал её по другим полкам.
        setSheet(null);
        openMyWorld();
      }
    } else {
      // Честная причина: «не хватает кристаллов» — только когда их правда мало.
      const short = missingGems(ask, gems);
      showToast(
        short > 0
          ? { emoji: '💎', title: 'Не хватает кристаллов', text: `Нужно ещё ${short}` }
          : { emoji: '🎒', title: 'Вещь уже у тебя', text: `«${ask.title}» — в твоей коллекции` },
      );
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

  const confirmBuildingBuy = () => {
    if (!askBuilding) return;
    const building = askBuilding;
    const ok = buyBuilding(building.id);
    setAskBuilding(null);
    if (ok) {
      sfx.reward();
      haptic.correct();
      showToast({ emoji: building.emoji, title: `«${building.title}» теперь твоя!`, text: 'База появилась в коллекции «Моего мира»' });
    } else {
      showToast({ emoji: '💎', title: 'Не хватает кристаллов', text: `Нужно ещё ${Math.max(0, building.price - gems)} 💎` });
    }
  };

  const confirmCrystalCostumeBuy = () => {
    if (!askCrystalCostume) return;
    const costume = askCrystalCostume;
    const ok = buyCrystalCostume(costume.id);
    setAskCrystalCostume(null);
    if (ok) {
      sfx.reward();
      haptic.correct();
      setMood('dance');
      setTimeout(() => setMood('idle'), 1800);
      showToast({ emoji: '✨', title: `«${costume.title}» — твой!`, text: 'БУК уже надел костюм своей базы' });
    } else {
      showToast({ emoji: '💎', title: 'Не хватает кристаллов', text: `Нужно ещё ${Math.max(0, (costume.price ?? 0) - gems)} 💎` });
    }
  };

  const confirmBaseSetBuy = () => {
    if (!askBaseSet) return;
    const setInfo = askBaseSet;
    const price = priceForSet(setInfo);
    const ok = buyBaseSet(setInfo.id);
    setAskBaseSet(null);
    if (ok) {
      sfx.reward();
      haptic.correct();
      showToast({ emoji: setInfo.emoji, title: `${setInfo.title} — собран!`, text: 'База, техника и костюм появились в коллекции «Моего мира»' });
    } else {
      showToast({ emoji: '💎', title: 'Не хватает кристаллов', text: `Нужно ещё ${Math.max(0, price - gems)} 💎` });
    }
  };

  // ── Карточки витрины ────────────────────────────────────────────────

  const itemCard = (item: ShopItem) => {
    const owned_ = isOwned(owned, item.id);
    const toy = isToy(item);
    const wearing = !toy && isWearing(look, item);
    const affordable = canBuy(item, gems);
    const wished = isWished(wishlist, item.id);
    const stateOn = toy ? 'В Моём мире ✓' : 'Надето ✓';
    const actionOn = toy ? 'Посмотреть' : 'Надеть';
    return (
      <ShopCard
        key={item.id}
        photo={hasProductPhoto(item.id)}
        art={
          toy ? (
            <ToyArt id={item.id} interactive size={148} tuning={profile.shop?.tuning} alt="" />
          ) : (
            <Mascot mood="idle" look={{ [item.slot]: item.id }} stage={growth.index} size={96} />
          )
        }
        title={item.title}
        rarity={rarityOf(item)}
        desc={item.desc}
        // Арт техники рисуется целиком, без совы: на полке это товар,
        // а не ещё один наряд на БУКе.
        cardCls={[wearing ? 'on' : owned_ ? 'owned' : '', toy ? 'toy-item' : ''].filter(Boolean).join(' ') || undefined}
        statusLabel={owned_ ? (toy ? 'В Моём мире ✓' : 'Твоя ✓') : undefined}
        priceLabel={owned_ ? undefined : <Gem value={item.price} size={16} />}
        afford={affordable}
        wished={wished}
        onWish={!owned_ ? () => tapWish(item.id, item.title) : undefined}
        actionLabel={
          owned_
            ? wearing
              ? stateOn
              : actionOn
            : affordable
              ? 'Купить'
              : `Ещё ${missingGems(item, gems)} 💎`
        }
        actionTone={owned_ ? (wearing ? 'green' : 'ghost') : affordable ? 'primary' : 'ghost'}
        actionDisabled={!owned_ && !affordable}
        onOpen={() => openSheet({ kind: 'item', item })}
        onAction={() => {
          if (owned_) {
            if (toy) openMyWorld();
            else tapWear(item);
          } else if (affordable) {
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
            <Mascot mood={wearing ? 'happy' : 'idle'} costumeId={c.id} size={104} stage={growth.index} />
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
        statusLabel={done ? 'Собран ✓' : undefined}
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

  const crystalCostumeCard = (c: Costume) => {
    const owned_ = crystalOwned.includes(c.id);
    const wearing = pz.worn === c.id;
    const price = c.price ?? 0;
    const affordable = gems >= price;
    const wished = isWished(wishlist, c.id);
    return (
      <ShopCard
        key={c.id}
        rarity={c.rarity}
        cardCls={`crystal-costume-card${wearing ? ' on' : owned_ ? ' owned' : ''}`}
        wished={wished}
        onWish={!owned_ ? () => tapWish(c.id, c.title) : undefined}
        art={<Mascot mood={wearing ? 'happy' : 'idle'} costumeId={c.id} size={104} stage={growth.index} />}
        title={c.title}
        desc={c.desc}
        statusLabel={owned_ ? 'Твой ✓' : undefined}
        priceLabel={owned_ ? undefined : <Gem value={price} size={16} />}
        afford={affordable}
        actionLabel={owned_ ? (wearing ? 'Надето ✓' : 'Надеть') : affordable ? 'Купить' : `Ещё ${Math.max(0, price - gems)} 💎`}
        actionTone={owned_ ? (wearing ? 'green' : 'ghost') : affordable ? 'primary' : 'ghost'}
        actionDisabled={!owned_ && !affordable}
        onOpen={() => openSheet({ kind: 'costume', costume: c })}
        onAction={() => {
          if (owned_) tapCostume(c.id);
          else if (affordable) { sfx.tap(); setAskCrystalCostume(c); }
          else showToast({ emoji: '💎', title: `До «${c.title}» ещё ${Math.max(0, price - gems)} 💎`, text: 'Кристаллы дают за задания дня и сундук' });
        }}
      />
    );
  };

  const buildingCard = (building: BuildingItem) => {
    const owned_ = isBuildingOwned(buildingsOwned, building.id);
    const affordable = gems >= building.price;
    const missing = Math.max(0, building.price - gems);
    return (
      <ShopCard
        key={building.id}
        rarity={building.rarity}
        cardCls={`building-item${owned_ ? ' owned' : ''}`}
        art={<BuildingArt id={building.id} className="building-card-art" />}
        title={building.title}
        desc={building.desc}
        statusLabel={owned_ ? 'В Моём мире ✓' : undefined}
        priceLabel={owned_ ? undefined : <Gem value={building.price} size={16} />}
        afford={affordable}
        actionLabel={owned_ ? 'Посмотреть' : affordable ? 'Купить' : `Ещё ${missing} 💎`}
        actionTone={owned_ ? 'ghost' : affordable ? 'primary' : 'ghost'}
        actionDisabled={!owned_ && !affordable}
        onOpen={() => openSheet({ kind: 'building', building })}
        onAction={() => {
          if (owned_) openMyWorld();
          else if (affordable) { sfx.tap(); setAskBuilding(building); }
          else showToast({ emoji: '💎', title: `До «${building.title}» ещё ${missing} 💎`, text: 'Кристаллы дают за задания дня и сундук' });
        }}
      />
    );
  };

  const baseSetCard = (setInfo: BaseSet) => {
    const price = priceForSet(setInfo);
    const complete = isBuildingOwned(buildingsOwned, setInfo.baseId) && isOwned(owned, setInfo.carId) && isOwned(owned, setInfo.planeId) && allOwnedCostumes.includes(setInfo.costumeId);
    const costume = CRYSTAL_COSTUMES.find((c) => c.id === setInfo.costumeId);
    const affordable = !complete && gems >= price;
    return (
      <ShopCard
        key={setInfo.id}
        rarity={setInfo.rarity}
        cardCls={`base-set-card${complete ? ' owned' : ''}`}
        art={<div className="base-set-icons"><BuildingArt id={setInfo.baseId} className="building-card-art" />{costume && <Mascot mood="idle" costumeId={costume.id} size={42} stage={growth.index} />}</div>}
        title={setInfo.title}
        desc={setInfo.desc}
        statusLabel={complete ? 'Набор собран ✓' : undefined}
        priceLabel={complete ? undefined : <Gem value={price} size={16} />}
        afford={affordable}
        actionLabel={complete ? 'Собран ✓' : affordable ? 'Купить' : `Ещё ${Math.max(0, price - gems)} 💎`}
        actionTone={complete ? 'green' : affordable ? 'primary' : 'ghost'}
        actionDisabled={complete || !affordable}
        onOpen={() => openSheet({ kind: 'baseSet', set: setInfo })}
        onAction={() => { if (!complete && affordable) { sfx.tap(); setAskBaseSet(setInfo); } }}
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
        statusLabel={ownedTrack ? 'Твоя ✓' : undefined}
        priceLabel={ownedTrack ? undefined : <Gem value={track.price} size={16} />}
        afford={affordable}
        actionLabel={
          ownedTrack
            ? selected
              ? 'Играет ✓'
              : 'Выбрать'
            : affordable
              ? 'Купить'
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
    // Бесплатный стартовый набор доступен сразу — его выбирают, а не покупают.
    const ownedPack = hasSoundPack(soundOwned, pack.id);
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
        statusLabel={ownedPack ? 'Твои ✓' : undefined}
        priceLabel={ownedPack ? undefined : <Gem value={pack.price} size={16} />}
        afford={affordable}
        actionLabel={
          ownedPack
            ? selected
              ? 'Звучит ✓'
              : 'Выбрать'
            : affordable
              ? 'Купить'
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
              // (машина/судно — карандашный лист, телефон — поворотный WebP). БУКа здесь
              // нет: ребёнок пришёл посмотреть вещь, а не примерку на сове.
              CAR_TOUR_IDS.has(item.id) ? <CarTour key={item.id} id={item.id} tuning={profile.shop?.tuning} alt={artAlt} /> : <ToyArt
                key={item.id}
                id={item.id}
                interactive
                size={200}
                className="shop-bigart-toy-art"
                tuning={profile.shop?.tuning}
                alt={artAlt}
              />
            ) : (
              <Mascot mood="happy" look={{ [item.slot]: item.id }} costumeId={null} stage={growth.index} size={150} />
            )}
          </div>
          {/* Подсказки «Нажми на машину/телефон» убраны (2026-10-29): лишний
              текст под фото; зум и поворот — стандартное поведение по тапу. */}
          {/* Лист товара: витринная иерархия вместо россыпи похожих абзацев
              (жалоба 2026-10-29: «текст дублируется, сверстан как школьник»).
              desc дублировал note («карбон и диски» дважды), к ним примешивалась
              общая строка «После покупки…», а цена, баланс и возврат шли тремя
              мелкими строками без ритма. Теперь: заголовок → строка «тип ·
              редкость» → один живой абзац (у техники note — он для листа и
              написан; desc остаётся на витринной карточке) → смета за тонкой
              линией → сноска мелким шрифтом. */}
          <h2 className="sheet-title">{item.title}</h2>
          <div className="sheet-headline">
            <RarityChip item={item} className="rarity-chip-detail" />
            {(carKind(item.id) ?? shipKind(item.id)) && (
              <span className="sheet-kind">{carKind(item.id) ?? shipKind(item.id)}</span>
            )}
          </div>
          <p className="sheet-lead">{carNote(item.id) ?? shipNote(item.id) ?? item.desc}</p>
          <div className="sheet-facts">
            <div className="row">
              <span className={`shop-price${affordable ? ' afford' : ''}`}>💎 {item.price}</span>
              <span className="sheet-balance">
                {owned_ ? (toy ? 'Уже в «Моём мире»' : 'Уже в гардеробе') : `У тебя ${gems} 💎`}
              </span>
            </div>
            {!owned_ && (
              <p className="sheet-fine">
                Если передумаешь — вернём {sellPrice(item)} 💎 ({SELL_RATE[item.kind ?? 'outfit'] * 100}% от цены)
              </p>
            )}
          </div>
          <div className="row mb">
            {owned_ ? (
              <button
                className={`btn lg grow ${wearing ? 'green' : 'primary'}`}
                onClick={() => {
                  if (toy) openMyWorld();
                  else tapWear(item);
                  closeSheet();
                }}
              >
                {toy ? 'Посмотреть в «Моём мире»' : wearing ? 'Снять' : 'Надеть'}
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
          {owned_ && supportsTint(item.id) && (
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
      const isCrystal = CRYSTAL_COSTUMES.some((x) => x.id === c.id);
      if (isCrystal) {
        const ownedC = crystalOwned.includes(c.id);
        const wearingC = pz.worn === c.id;
        const priceC = c.price ?? 0;
        const affordableC = gems >= priceC;
        return (
          <>
            <div className="shop-bigart"><Mascot mood="happy" costumeId={c.id} size={150} stage={growth.index} /></div>
            {/* Единая схема листа (2026-10-29): заголовок → редкость → один
                абзац → смета; условие покупки — сноской под сметой. */}
            <h2 className="sheet-title">{c.title}</h2>
            {c.rarity && (
              <div className="sheet-headline">
                <RarityLabel rarity={c.rarity} className="rarity-chip-detail" />
              </div>
            )}
            <p className="sheet-lead">{c.desc}</p>
            <div className="sheet-facts">
              <div className="row">
                <span className={`shop-price${affordableC ? ' afford' : ''}`}>💎 {priceC}</span>
                <span className="sheet-balance">{ownedC ? 'Уже в гардеробе' : `У тебя ${gems} 💎`}</span>
              </div>
              <p className="sheet-fine">Костюм своей научной базы: покупается за кристаллы, а не собирается из фрагментов.</p>
            </div>
            <div className="row mb">
              {ownedC ? (
                <button className={`btn lg grow ${wearingC ? 'green' : 'primary'}`} onClick={() => { tapCostume(c.id); closeSheet(); }}>{wearingC ? 'Снять' : 'Надеть'}</button>
              ) : (
                <button className="btn lg grow primary" disabled={!affordableC} onClick={() => { closeSheet(); sfx.tap(); setAskCrystalCostume(c); }}>{affordableC ? `Купить за 💎${priceC}` : `Ещё ${Math.max(0, priceC - gems)} 💎`}</button>
              )}
            </div>
          </>
        );
      }
      const done = pz.assembled.includes(c.id);
      const prog = costumeProgress(pz, c.id);
      const wearing = pz.worn === c.id;
      const isCurrent = !done && collecting === c.id;
      return (
        <>
          <div className="shop-bigart">
            <Mascot mood="happy" costumeId={c.id} size={150} stage={growth.index} />
          </div>
          <h2 className="sheet-title">{c.title}</h2>
          {c.rarity && (
            <div className="sheet-headline">
              <RarityLabel rarity={c.rarity} className="rarity-chip-detail" />
            </div>
          )}
          <p className="sheet-lead">{c.desc}</p>
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
    if (sheet.kind === 'building') {
      const building = sheet.building;
      const owned_ = isBuildingOwned(buildingsOwned, building.id);
      const affordable = gems >= building.price;
      const missing = Math.max(0, building.price - gems);
      return (
        <>
          <div className="shop-bigart building-detail-art"><BaseTour id={building.id} loading="eager" /></div>
          {/* Лист здания — та же типографская схема, что у товара (единый стиль,
              2026-10-29): заголовок → редкость → один абзац → смета. Подсказка
              «Нажми на картинку…» убрана: дублировала подпись фасада, а тап по
              кадру — стандартное поведение карусели. */}
          <h2 className="sheet-title">{building.title}</h2>
          <div className="sheet-headline">
            <RarityLabel rarity={building.rarity} className="rarity-chip-detail" />
          </div>
          <p className="sheet-lead">{building.desc}</p>
          <div className="sheet-facts">
            <div className="row">
              <span className={`shop-price${affordable ? ' afford' : ''}`}>💎 {building.price}</span>
              <span className="sheet-balance">{owned_ ? 'Уже в коллекции' : `У тебя ${gems} 💎`}</span>
            </div>
          </div>
          <div className="row mb">
            {owned_ ? (
              <button className="btn lg grow primary" onClick={() => { closeSheet(); openMyWorld(); }}>Посмотреть в «Моём мире»</button>
            ) : (
              <button className="btn lg grow primary" disabled={!affordable} onClick={() => { closeSheet(); sfx.tap(); setAskBuilding(building); }}>{affordable ? `Построить · 💎${building.price}` : `Ещё ${missing} 💎`}</button>
            )}
          </div>
        </>
      );
    }
    if (sheet.kind === 'baseSet') {
      const setInfo = sheet.set;
      const price = priceForSet(setInfo);
      const base = BUILDING_BY_ID[setInfo.baseId];
      const car = ITEM_BY_ID[setInfo.carId];
      const plane = ITEM_BY_ID[setInfo.planeId];
      const costume = CRYSTAL_COSTUMES.find((c) => c.id === setInfo.costumeId);
      const parts = [
        { title: base?.title ?? setInfo.baseId, emoji: base?.emoji ?? '🏙️', owned: isBuildingOwned(buildingsOwned, setInfo.baseId) },
        { title: car?.title ?? setInfo.carId, emoji: '🚗', owned: isOwned(owned, setInfo.carId) },
        { title: plane?.title ?? setInfo.planeId, emoji: '✈️', owned: isOwned(owned, setInfo.planeId) },
        { title: costume?.title ?? setInfo.costumeId, emoji: '✨', owned: allOwnedCostumes.includes(setInfo.costumeId) },
      ];
      const complete = parts.every((part) => part.owned);
      const affordable = !complete && gems >= price;
      return (
        <>
          <div className="shop-bigart base-set-detail-art">
            <div className="base-set-icons"><BuildingArt id={setInfo.baseId} className="building-card-art" loading="eager" /><ToyArt id={setInfo.carId} size={56} tuning={profile.shop?.tuning} /><ToyArt id={setInfo.planeId} size={56} tuning={profile.shop?.tuning} />{costume && <Mascot mood="idle" costumeId={costume.id} size={56} stage={growth.index} />}</div>
          </div>
          <h2 className="sheet-title">{setInfo.title}</h2>
          <div className="sheet-headline">
            <RarityLabel rarity={setInfo.rarity} className="rarity-chip-detail" />
          </div>
          <p className="sheet-lead">{setInfo.desc}</p>
          <div className="col mb">
            {parts.map((part) => (<div key={part.title} className="tiny">{part.owned ? '✓' : '○'} {part.emoji} {part.title}</div>))}
          </div>
          <div className="sheet-facts">
            <div className="row">
              <span className={`shop-price${affordable ? ' afford' : ''}`}>{complete ? 'Набор собран ✓' : `💎 ${price}`}</span>
              <span className="sheet-balance">{complete ? 'Всё уже у тебя' : `У тебя ${gems} 💎`}</span>
            </div>
            {!complete && <p className="sheet-fine">Цена — за недостающие части ×3.</p>}
          </div>
          {!complete && (
            <div className="row mb">
              <button className="btn lg grow primary" disabled={!affordable} onClick={() => { closeSheet(); sfx.tap(); setAskBaseSet(setInfo); }}>{affordable ? `Купить набор · 💎${price}` : `Ещё ${Math.max(0, price - gems)} 💎`}</button>
            </div>
          )}
        </>
      );
    }
    if (sheet.kind === 'sound') {
      const pack = sheet.pack;
      const ownedPack = hasSoundPack(soundOwned, pack.id);
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
          <h2 className="sheet-title">{pack.title}</h2>
          <p className="sheet-lead">{pack.desc} · звуки правильного ответа и ошибки</p>
          <div className="sheet-facts">
            <div className="row">
              <span className={`shop-price${affordable ? ' afford' : ''}`}>💎 {pack.price}</span>
              <span className="sheet-balance">
                {ownedPack ? 'В коллекции' : pack.price === 0 ? 'Бесплатно' : `У тебя ${gems} 💎`}
              </span>
            </div>
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
        <h2 className="sheet-title">{track.title}</h2>
        <p className="sheet-lead">
          «{track.originalTitle}» · {track.artist} · {fmtTime(track.seconds)}
        </p>
        <div className="sheet-facts">
          <div className="row">
            <span className={`shop-price${affordable ? ' afford' : ''}`}>💎 {track.price}</span>
            <span className="sheet-balance">
              {ownedTrack ? 'В коллекции' : track.price === 0 ? 'Бесплатно' : `У тебя ${gems} 💎`}
            </span>
          </div>
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

  // ── Мои покупки: что уже моё ──────────────────────────────────────────

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
    SHOP_ITEMS.filter((i) => i.slot === slot && isOwned(owned, i.id) && !i.series);

  return (
    // shop-screen — метка «всё внутри = витрина»: по ней app.css красит
    // активные пункты меню, лист и подтверждения покупки единым акцентом
    // --lux-cta (жалоба 2026-10-29 — см. блок «Единый акцент витрины»).
    <div className="screen shop-screen">
      {/* ── Шапка: название и баланс — и больше ничего ─────────────────── */}
      {view !== 'world' && (
        <div className="shop-sticky">
          <div className="row mb">
            <h1 className="grow" style={{ margin: 0 }}>
              БУК <Icon name="hat" size={22} />
            </h1>
            <div className="stat-pill gems">
              <Gem value={gems} size={22} />
            </div>
          </div>
          <div className="shop-seg" role="tablist" aria-label="Разделы БУКа">
            <button role="tab" aria-selected={view === 'vitrina'} className={view === 'vitrina' ? 'on' : ''} onClick={() => setView('vitrina')}>
              🛍️ Витрина
            </button>
            <button role="tab" aria-selected={view === 'wardrobe'} className={view === 'wardrobe' ? 'on' : ''} onClick={() => setView('wardrobe')}>
              🎒 Мои покупки
            </button>
            <button role="tab" aria-selected={false} onClick={openMyWorld}>
              🌍 Мой мир
            </button>
          </div>
          {view === 'vitrina' && (
            <div className="shop-cats" role="tablist" aria-label="Разделы магазина">
              {CATS.filter((c) => c.id !== 'naash' || SCHOOL.on).map((c) => (
                <button key={c.id} role="tab" aria-selected={cat === c.id} className={`chip${cat === c.id ? ' on' : ''}`} onClick={() => setCat(c.id)}>
                  {c.icon ? <Icon name={c.icon} size={16} /> : c.emoji} {c.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'world' && <WorldScreen onBack={closeMyWorld} />}

      {/* ── Школа НААШ (0.74.0): форма БУКа и полка идей ──────────────────────
          Полка живёт своим компонентом: карточки ей передаёт магазин, поэтому
          покупка, «Мечты», перекраска и сдача — те же, что на других полках. */}
      {view === 'vitrina' && cat === 'naash' && SCHOOL.on && <NaashPanel renderItem={itemCard} />}

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
                            text: `«${hero.item.title}»: ещё ${missing} 💎. Мечты — в «Моих покупках»`,
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
                setCat('outfits');
                openSheet({ kind: 'costume', costume: hero.costume });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setView('vitrina');
                  setCat('outfits');
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
                    setCat('outfits');
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
                            text: `«${hero.track.title}»: ещё ${missing} 💎. Мечты — в «Моих покупках»`,
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
          <ShowcaseGrid>{CATALOG_OUTFITS.slice().sort(byPriceAscending).map(itemCard)}</ShowcaseGrid>
        </section>
      )}

      {/* ── Техника: отдельные полки авто, кораблей и телефонов ─────────── */}
      {view === 'vitrina' && (cat === 'toys' || cat === 'pets' || cat === 'sport' || cat === 'food') && (
        <section className="mt" aria-label={cat === 'toys' ? 'Техника' : cat === 'pets' ? 'Питомцы' : cat === 'sport' ? 'Спорт' : 'Вкусняшки'}>
          <div className="mb">
            <h2 className="mb">{cat === 'toys' ? 'Техника БУКа' : cat === 'pets' ? 'Питомцы' : cat === 'sport' ? 'Спорт' : 'Вкусняшки'}</h2>
            <div className="tiny muted">Всё купленное видно в «Моём мире».</div>
          </div>
          {cat === 'toys' && <div className="shop-cats shop-toy-cats" role="tablist" aria-label="Разделы техники">
            {TOY_SHELVES.filter(({ id }) => !['pet', 'sport', 'food'].includes(id)).map(({ id, title, emoji }) => (
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
          </div>}
          {ownedToys.length > 0 && (
            <button type="button" className="btn sm ghost wide" onClick={openMyWorld}>
              🌍 Посмотреть всю коллекцию ➜
            </button>
          )}
          {cat === 'toys' && toyGoal && (
            <div className="shop-tech-goal">
              <span className="shop-tech-goal-icon" aria-hidden="true">
                <ToyArt id={toyGoal.id} size={48} tuning={profile.shop?.tuning} />
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
          {TOY_SHELVES.filter(({ id }) => id === (cat === 'pets' ? 'pet' : cat === 'sport' ? 'sport' : cat === 'food' ? 'food' : toyShelf)).map(({ id, title, emoji }) => (
            <div className={`shop-case-group shop-case-${id}`} key={id}>
              <h3 className="shop-case-group-title">
                <span aria-hidden="true">{emoji}</span> {title}
              </h3>
              <ShowcaseGrid tone={id === 'car' ? 'mint' : id === 'ship' || id === 'plane' ? 'sky' : undefined}>
                {toysByShelf(id).slice().sort(byPriceAscending).map(itemCard)}
              </ShowcaseGrid>
            </div>
          ))}
        </section>
      )}

      {view === 'vitrina' && cat === 'buildings' && (
        <section className="mt building-section" aria-label="Базы">
          <div className="mb">
            <h2 className="mb">Базы в коллекцию</h2>
            <div className="tiny muted">Купленные базы будут видны на карте «Моего мира» вместе со всеми твоими вещами.</div>
          </div>
          <ShowcaseGrid tone="sky">{BUILDINGS.slice().sort(byPriceAscending).map(buildingCard)}</ShowcaseGrid>
        </section>
      )}

      {view === 'vitrina' && cat === 'sets' && (
        <section className="mt" aria-label="Наборы баз">
          <div className="mb">
            <h2 className="mb">Наборы научных баз 🎁</h2>
            <div className="tiny muted">База, её машина, её самолёт и её костюм — одним набором. Цена — за недостающие части ×3.</div>
          </div>
          <ShowcaseGrid tone="sky">{BASE_SETS.slice().sort((a, b) => priceForSet(a) - priceForSet(b)).map(baseSetCard)}</ShowcaseGrid>
        </section>
      )}

      {view === 'vitrina' && cat === 'outfits' && (
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
          <h3 className="music-shelf-title" style={{ marginTop: 18 }}>✨ Костюмы за кристаллы</h3>
          <div className="tiny muted mb">Костюмы баз — в цвет своей базы, а ещё здесь живут особые: Леди Баг и Титан. Покупается сразу, собирать фрагменты не нужно.</div>
          <ShowcaseGrid>{CRYSTAL_COSTUMES.slice().sort(byPriceAscending).map(crystalCostumeCard)}</ShowcaseGrid>
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
              <ShowcaseGrid>{tracksByShelf(shelf).slice().sort(byPriceAscending).map(trackCard)}</ShowcaseGrid>
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
          <ShowcaseGrid>{SOUND_PACKS.slice().sort(byPriceAscending).map(soundCard)}</ShowcaseGrid>
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

          {/* Приглашение вместо стены пустых карточек: у новичка «Мои покупки»
              должны быть короткими. */}
          {noPurchases && (
            <div className="card shop-empty mb">
              <div className="shop-empty-emoji" aria-hidden="true">🛍️</div>
              <div className="shop-empty-title">Пока ничего не куплено</div>
              <div className="tiny muted">
                В витрине ждут наряды, техника, костюмы и музыка. Купленное сразу появится здесь.
              </div>
              <button type="button" className="btn primary wide mt" onClick={() => setView('vitrina')}>
                В витрину ➜
              </button>
            </div>
          )}

          {/* Наряды: по слотам, только купленное. Пустая секция не рисуется. */}
          {ownedOutfits.length > 0 && (
          <section className="mb" aria-label="Наряды">
            <h2 className="mb">Наряды</h2>
            {ownedSchool.length > 0 && (
              <div className="mb">
                <h3 className="music-shelf-title">🏫 Школа НААШ</h3>
                <div className="col">
                  {ownedSchool.map((item) =>
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
            )}
            {(['head', 'face', 'neck', 'badge', 'back', 'body', 'feet'] as const).map((slot) => {
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
          )}

          {/* Техника остаётся в своих полках магазина и полностью видна в «Моём мире». */}
          <section className="mb" aria-label="Техника">
            <div className="row mb" style={{ alignItems: 'center' }}>
              <h2 className="grow" style={{ margin: 0 }}>
                Техника
              </h2>
              {/* Вход в полную карту коллекции остаётся доступен и при пустой технике. */}
              <button type="button" className="btn sm ghost" onClick={openMyWorld}>
                Посмотреть в «Моём мире» ➜
              </button>
            </div>
            {ownedToys.length > 0 && (
            <div className="col">
              {ownedToys.map((item) =>
                wardrobeRow(
                  item.id,
                  { kind: 'item', item },
                  <ToyArt id={item.id} size={44} tuning={profile.shop?.tuning} />,
                  item.title,
                  item.desc,
                  false,
                  'Посмотреть',
                  openMyWorld,
                ),
              )}
            </div>
            )}
          </section>

          {buildingsOwned.length > 0 && (
          <section className="mb" aria-label="Базы">
            <h2 className="mb">Базы</h2>
            <div className="col">
              {BUILDINGS.filter((b) => buildingsOwned.includes(b.id)).map((building) =>
                wardrobeRow(
                  building.id,
                  { kind: 'building', building },
                  <BuildingArt id={building.id} className="building-wardrobe-art" />,
                  building.title,
                  'В твоей коллекции «Моего мира»',
                  false,
                  'Посмотреть',
                  openMyWorld,
                ),
              )}
            </div>
          </section>
          )}

          {allOwnedCostumes.length > 0 && (
          <section className="mb" aria-label="Костюмы">
            <h2 className="mb">Костюмы</h2>
            <div className="col">
              {ALL_COSTUMES.filter((c) => allOwnedCostumes.includes(c.id)).map((c) =>
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
          )}

          {musicOwned.length > 0 && (
          <section className="mb" aria-label="Музыка">
            <h2 className="mb">Музыка</h2>
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
          </section>
          )}

          {/* Звуки: какой набор звучит за ответы в уроках */}
          <section className="mb" aria-label="Звуки">
            <h2 className="mb">Звуки</h2>
            {SOUND_PACKS.filter((p) => hasSoundPack(soundOwned, p.id)).map((pack) => (
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
                            setCat('outfits');
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
          // Техника — сам товар, как на витрине (рисунок, а не эмодзи-заглушка)
          art={isToy(ask) ? <ToyArt id={ask.id} size={120} tuning={profile.shop?.tuning} /> : undefined}
          title={`Купить «${ask.title}»?`}
          text={
            isToy(ask)
              ? `Отдашь ${ask.price} 💎 из ${gems}. Вещь появится в твоей коллекции «Моего мира».`
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

      {askBuilding && (
        <ConfirmDialog
          emoji={askBuilding.emoji}
          title={`Построить «${askBuilding.title}»?`}
          text={`Отдашь ${askBuilding.price} 💎 из ${gems}. База появится в твоей коллекции «Моего мира».`}
          stayLabel={`Построить · 💎${askBuilding.price}`}
          leaveLabel="Не сейчас"
          onStay={confirmBuildingBuy}
          onLeave={() => setAskBuilding(null)}
        />
      )}

      {askCrystalCostume && (
        <ConfirmDialog
          emoji="✨"
          title={`Купить костюм «${askCrystalCostume.title}»?`}
          text={`Отдашь ${askCrystalCostume.price ?? 0} 💎 из ${gems}. Костюм сразу появится в гардеробе и будет надет на БУКа.`}
          stayLabel={`Купить за 💎${askCrystalCostume.price ?? 0}`}
          leaveLabel="Не сейчас"
          onStay={confirmCrystalCostumeBuy}
          onLeave={() => setAskCrystalCostume(null)}
        />
      )}

      {askBaseSet && (
        <ConfirmDialog
          emoji={askBaseSet.emoji}
          title={`Купить ${askBaseSet.title}?`}
          text={`Набор включает базу, машину, самолёт и костюм. Цена — ${priceForSet(askBaseSet)} 💎 за недостающие части.`}
          stayLabel={`Купить · 💎${priceForSet(askBaseSet)}`}
          leaveLabel="Не сейчас"
          onStay={confirmBaseSetBuy}
          onLeave={() => setAskBaseSet(null)}
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

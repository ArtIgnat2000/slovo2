import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/tokens.css';
import '../styles/app.css';
import { Mascot } from './Mascot';
import { TintPicker } from './TintPicker';
import { carAlt, carKind, carNote, hasCarArt } from './CarArt';
import { hasShipArt, shipAlt, shipKind, shipNote } from './ShipArt';
import { ConfirmDialog } from './Bits';
import { plural } from '../engine/quests';
import {
  OUTFIT_ITEMS,
  SHOP_ITEMS,
  TOY_ITEMS,
  TOY_SHELVES,
  canBuy,
  growthStage,
  isOwned,
  isToy,
  isWearing,
  missingGems,
  sellPrice,
  toysByShelf,
  type ShopItem,
  type ToyKind,
} from '../engine/shop';
import { ToyArt } from './ToyArt';
import { COSTUMES, PUZZLE_SIZE, costumeProgress, type Costume } from '../engine/puzzles';
import { MUSIC_TRACKS, type MusicTrack } from '../engine/music';
import { TINT_PRICE, type TintOption } from '../engine/tints';
import { THEME_STYLES, type ThemeStyle } from '../engine/theme-styles';
import { BackgroundThemeCard } from './BackgroundThemeCard';
import type { ShopSlot, ShopTuning } from '../types';

/**
 * Живой макет новой концепции магазина (витрина + гардероб).
 *
 * Витрина дизайн-ревью: настоящие компоненты (Mascot, TintPicker,
 * ConfirmDialog), настоящие каталоги (engine/shop, puzzles, music),
 * но состояние — локальное (демо-профиль), чтобы ревью шло без
 * покупки и без кристаллов. Смотри docs/shop-concept.md.
 */

// ── Демо-профиль: старт «середины пути» — видно все состояния сразу ────
const DEMO = {
  gems: 62,
  mastered: 34,
  owned: ['cap', 'phone-smart'],
  equipped: { head: 'cap', toy: 'phone-smart' } as Partial<Record<ShopSlot, string>>,
  tuning: undefined as ShopTuning | undefined,
  assembled: ['fighter-pilot'],
  worn: 'fighter-pilot' as string | null,
  collecting: 'dark-lord',
  pieces: { 'dark-lord': 4, 'snow-guard': 2 } as Record<string, number>,
  musicOwned: ['carefree', 'easy-lemon'],
  musicTrack: 'carefree' as string | null,
  wishlist: ['scarf', 'car-bmw', 'pixelland'],
};

type View = 'vitrina' | 'wardrobe';
type Cat = 'outfits' | 'toys' | 'costumes' | 'music' | 'backgrounds';

type Detail =
  | { kind: 'item'; item: ShopItem }
  | { kind: 'costume'; costume: Costume }
  | { kind: 'track'; track: MusicTrack };

interface Toast {
  emoji: string;
  title: string;
  text: string;
}

// ── Стили макета (только для витрины; в app.css не едут) ─────────────
const CSS = `
.mz-wrap { max-width: 980px; margin: 0 auto; padding-bottom: 96px; }
.mz-stage { display: flex; gap: 24px; align-items: flex-start; flex-wrap: wrap; }
.mz-phone {
  width: 402px; max-width: 100%; flex: none;
  border: 2px solid var(--line); border-radius: 36px;
  background: var(--bg); box-shadow: var(--shadow-lg);
  overflow: hidden; position: relative;
}
.mz-scroll { height: 780px; overflow-y: auto; scrollbar-width: thin; }
.mz-side { flex: 1; min-width: 300px; }
.mz-sticky {
  position: sticky; top: 0; z-index: 5;
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: blur(8px);
  padding: 10px 14px 8px; border-bottom: 1px solid var(--line);
}
.mx-seg {
  display: flex; background: var(--bg-2); border: 2px solid var(--line);
  border-radius: var(--r-pill); padding: 3px; gap: 3px;
}
.mx-seg button {
  flex: 1; border: none; background: transparent; border-radius: var(--r-pill);
  min-height: 42px; font: inherit; font-weight: 700; font-size: var(--fs-sm);
  color: var(--ink-2); cursor: pointer;
}
.mx-seg button.on { background: var(--primary); color: #fff; }
.mz-chips { display: flex; gap: 8px; overflow-x: auto; padding: 10px 14px 6px; }
.mz-chips .chip { flex: none; }
.mz-hero {
  margin: 10px 14px 0; border-radius: var(--r-lg); overflow: hidden;
  background: linear-gradient(135deg, var(--promo-glow-1), var(--promo-glow-2));
  border: 2px solid color-mix(in srgb, var(--primary) 25%, transparent);
  display: flex; gap: 12px; padding: 14px; align-items: center;
}
.mz-hero .grow { min-width: 0; }
.mz-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 10px 14px 16px; }
/* Полки — те же классы, что в приложении (app.css импортирован выше):
   макет показывает ровно ту разметку, которую потом получит ShopScreen. */
.mz-shelf { padding: 0 14px 16px; }
.mz-shelf .mz-card { padding-top: 22px; }
.mz-shelf .shop-icon { height: 92px; }
/* Макет живёт в колонке 370–470 px на широком экране, поэтому сцена
   считается от колонки, а не от vw: те же пропорции, что на телефоне. */
.mz-shelf .tech-stage { --arch: 168px; --arch-mid: 190px; --stage-pad-bottom: 62px; --stage-floor-h: 76px; }
.mz-grid .shop-shelf-hook { display: none; }
.mz-card {
  position: relative; border: 2px solid var(--line); border-radius: var(--r-md);
  background: var(--bg-2); padding: 10px; display: flex; flex-direction: column;
  align-items: center; gap: 4px; text-align: center; cursor: pointer;
  transition: transform .12s ease, box-shadow .12s ease;
}
.mz-card:active { transform: scale(.97); }
.mz-card.worn { border-color: var(--primary); background: var(--primary-soft); }
.mz-card.owned { border-color: var(--green); }
.mz-card .mz-art { height: 84px; display: grid; place-items: center; }
.mz-card .shop-title { font-size: var(--fs-sm); }
.mz-badge {
  position: absolute; top: 6px; left: 6px; font-size: 11px; font-weight: 800;
  background: var(--orange-soft); color: var(--orange-ink);
  border-radius: var(--r-pill); padding: 2px 8px;
}
.mz-badge.new { background: var(--primary-soft); color: var(--primary); }
.mz-heart {
  position: absolute; top: 4px; right: 4px; border: none; background: transparent;
  font-size: 18px; cursor: pointer; padding: 6px; border-radius: 50%; line-height: 1;
}
.mz-heart.on { filter: grayscale(0); transform: scale(1.1); }
.mz-heart:not(.on) { filter: grayscale(1); opacity: .45; }
.mz-price {
  font-weight: 800; font-size: var(--fs-sm); color: var(--ink-2);
  background: var(--bg); border: 1.5px solid var(--line);
  border-radius: var(--r-pill); padding: 2px 10px;
}
.mz-price.afford { color: var(--primary); border-color: var(--primary); }
.mz-state { font-size: var(--fs-xs); font-weight: 700; }
.mz-state.ok { color: var(--green); }
.mz-state.go { color: var(--primary); }
.mz-sec { padding: 14px 14px 0; }
.mz-sec h2 { margin: 0 0 2px; font-size: var(--fs-lg); }
.mz-sec .tiny { margin-bottom: 8px; }
.mz-sheet-veil {
  position: absolute; inset: 0; background: rgba(20, 12, 40, .45); z-index: 20;
  display: flex; align-items: flex-end; animation: fadeIn .15s ease;
}
.mz-sheet {
  width: 100%; background: var(--bg-2); border-radius: 28px 28px 0 0;
  padding: 10px 18px calc(18px + var(--safe-b)); max-height: 82%;
  overflow-y: auto; animation: mzUp .22s ease;
}
@keyframes mzUp { from { transform: translateY(40px); opacity: .4; } to { transform: none; opacity: 1; } }
.mz-grab { width: 44px; height: 5px; border-radius: 3px; background: var(--line); margin: 2px auto 10px; }
.mz-bigart {
  border-radius: var(--r-lg); background: var(--primary-soft);
  display: grid; place-items: center; padding: 12px; margin-bottom: 10px;
}
.mz-bigart .mascot { position: static; z-index: auto; animation: none; }
/* Мечты и плашка сбора: сова — картинка в потоке, а не плавающий БУК (0.21.2) */
.mz-art .mascot, .mz-collect .mascot { position: static; z-index: auto; animation: none; }
.mz-row { display: flex; gap: 8px; }
.mz-row .btn { flex: 1; }
.mz-toast {
  position: absolute; left: 50%; bottom: 18px; transform: translateX(-50%);
  background: var(--ink); color: var(--bg-2); border-radius: var(--r-md);
  padding: 10px 14px; z-index: 30; width: 86%; text-align: center;
  box-shadow: var(--shadow-lg); animation: mzUp .2s ease;
}
.mz-toast b { color: #fff; }
.mz-eq { display: inline-flex; align-items: flex-end; gap: 2px; height: 14px; }
.mz-eq i { width: 3px; background: var(--primary); border-radius: 2px; animation: mzEq .8s ease-in-out infinite; }
.mz-eq i:nth-child(2) { animation-delay: .15s; }
.mz-eq i:nth-child(3) { animation-delay: .3s; }
@keyframes mzEq { 0%, 100% { height: 4px; } 50% { height: 14px; } }
.mz-wear {
  display: flex; align-items: center; gap: 10px; padding: 8px 0;
  border-bottom: 1px dashed var(--line);
}
.mz-wear:last-child { border-bottom: none; }
.mz-dots { display: flex; gap: 4px; }
.mz-dots i { width: 10px; height: 10px; border-radius: 50%; background: var(--line); }
.mz-dots i.on { background: var(--primary); }
.mz-soon { opacity: .55; }
.mz-collect {
  border: 2px dashed color-mix(in srgb, var(--primary) 55%, transparent);
  border-radius: var(--r-md); padding: 10px 12px; margin: 0 14px 10px;
  background: color-mix(in srgb, var(--primary-soft) 55%, transparent);
}
.mz-progress { height: 8px; border-radius: 4px; background: var(--line); overflow: hidden; margin-top: 6px; }
.mz-progress i { display: block; height: 100%; background: var(--primary); border-radius: 4px; transition: width .4s ease; }
`;

/** Одна карточка товара — единый макет для всех категорий. */
function Card(props: {
  badge?: string;
  isNew?: boolean;
  state: 'buy' | 'poor' | 'owned' | 'worn' | 'collect';
  art: React.ReactNode;
  title: string;
  desc?: string;
  priceLabel?: string;
  afford?: boolean;
  wished?: boolean;
  /** Техника: другая подсветка арта и подписи в sheet */
  toy?: boolean;
  onOpen: () => void;
  onWish: () => void;
  actionLabel: string;
  onAction: () => void;
}) {
  // mz-card — стили макета (тень, отступы), shop-item — правила полки из
  // app.css. Вместе они дают ровно ту карточку, что видит ребёнок.
  const cls = `mz-card shop-item${props.state === 'worn' ? ' worn on' : ''}${props.state === 'owned' ? ' owned' : ''}${props.toy ? ' toy-item' : ''}`;
  return (
    <article className={cls} onClick={props.onOpen} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.target === e.currentTarget && e.key === 'Enter') props.onOpen(); }}
      aria-label={`${props.title}${props.priceLabel ? `, ${props.priceLabel}` : ''}`}
    >
      {props.badge && <span className="mz-badge">{props.badge}</span>}
      {props.isNew && <span className="mz-badge new">Новинка</span>}
      <div className="shop-case">
        <span className="shop-case-lamp" aria-hidden="true" />
        <div className="mz-art shop-icon">{props.art}</div>
        <span className="shop-case-podium" aria-hidden="true" />
      </div>
      <button
        className={`mz-heart${props.wished ? ' on' : ''}`}
        aria-label={props.wished ? 'Убрать из мечт' : 'В мечты'}
        aria-pressed={props.wished}
        onClick={(e) => { e.stopPropagation(); props.onWish(); }}
      >
        {props.wished ? '💜' : '🤍'}
      </button>
      <div className="shop-title">{props.title}</div>
      {props.desc && <div className="tiny shop-desc">{props.desc}</div>}
      {props.priceLabel && (
        <span className={`shop-price${props.afford ? ' afford' : ''}`}>{props.priceLabel}</span>
      )}
      <button
        className={`btn sm wide${props.state === 'worn' ? ' green' : props.state === 'buy' ? ' primary' : props.state === 'collect' ? ' primary' : ' ghost'}`}
        onClick={(e) => { e.stopPropagation(); props.onAction(); }}
      >
        {props.actionLabel}
      </button>
    </article>
  );
}

/**
 * Витрина макета: те же классы, что в приложении (`.shop-boutique`), поэтому
 * ревью видит реальную витрину, а не отдельную сетку.
 */
function ShowcaseGrid({ children, tone }: { children: React.ReactNode; tone?: 'mint' | 'sky' }) {
  const cells = React.Children.toArray(children);
  const rows: React.ReactNode[][] = [];
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

function Demo() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [themeStyle, setThemeStyle] = useState<ThemeStyle>('classic');
  const [width, setWidth] = useState(402);

  // демо-профиль
  const [gems, setGems] = useState(DEMO.gems);
  const [owned, setOwned] = useState<string[]>(DEMO.owned);
  const [equipped, setEquipped] = useState(DEMO.equipped);
  const [tuning, setTuning] = useState<ShopTuning | undefined>(DEMO.tuning);
  const [assembled, setAssembled] = useState<string[]>(DEMO.assembled);
  const [worn, setWorn] = useState<string | null>(DEMO.worn);
  const [collecting, setCollecting] = useState<string | null>(DEMO.collecting);
  const [pieces, setPieces] = useState<Record<string, number>>(DEMO.pieces);
  const [musicOwned, setMusicOwned] = useState<string[]>(DEMO.musicOwned);
  const [musicTrack, setMusicTrack] = useState<string | null>(DEMO.musicTrack);
  const [wishlist, setWishlist] = useState<string[]>(DEMO.wishlist);

  // UI
  const [view, setView] = useState<View>('vitrina');
  const [cat, setCat] = useState<Cat>('outfits');
  const [toyShelf, setToyShelf] = useState<ToyKind>('car');
  const [detail, setDetail] = useState<Detail | null>(null);
  const [ask, setAsk] = useState<{ target: Detail; price: number } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [mood, setMood] = useState<'idle' | 'happy' | 'dance'>('idle');
  const [toast, setToast] = useState<Toast | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.themeStyle = themeStyle;
  }, [theme, themeStyle]);

  const say = (t: Toast) => {
    setToast(t);
    window.setTimeout(() => setToast((cur) => (cur === t ? null : cur)), 2600);
  };
  const dance = () => {
    setMood('dance');
    window.setTimeout(() => setMood('idle'), 1800);
  };
  const mastered = DEMO.mastered;
  const growth = growthStage(mastered);

  // ── действия (те же правила, что в настоящем магазине) ────────────
  const toggleWish = (id: string) =>
    setWishlist((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]));

  const buyItem = (item: ShopItem) => {
    setAsk({ target: { kind: 'item', item }, price: item.price });
  };
  const confirmBuy = () => {
    if (!ask) return;
    if (ask.target.kind !== 'item') { setAsk(null); return; }
    const item = ask.target.item;
    setAsk(null);
    if (gems < item.price) {
      say({ emoji: '💎', title: 'Не хватает кристаллов', text: `Нужно ещё ${missingGems(item, gems)} 💎` });
      return;
    }
    setGems((g) => g - item.price);
    setOwned((o) => [...o, item.id]);
    setEquipped((e) => ({ ...e, [item.slot]: item.id }));
    dance();
    say({
      emoji: item.emoji ?? '🎩',
      title: `${item.title} — твой!`,
      text: isToy(item) ? 'Поставим в ангаре — зайди посмотреть!' : 'БУК уже примерил обновку',
    });
  };

  const buyTrack = (track: MusicTrack) => {
    setAsk({ target: { kind: 'track', track }, price: track.price });
  };
  const confirmBuyTrack = () => {
    if (!ask || ask.target.kind !== 'track') { setAsk(null); return; }
    const track = ask.target.track;
    setAsk(null);
    if (gems < track.price) {
      say({ emoji: '💎', title: 'Не хватает кристаллов', text: `Нужно ещё ${track.price - gems} 💎` });
      return;
    }
    setGems((g) => g - track.price);
    setMusicOwned((m) => [...m, track.id]);
    setMusicTrack(track.id);
    dance();
    say({ emoji: track.emoji, title: `«${track.title}» теперь твоя!`, text: 'БУК уже включил новую музыку' });
  };

  const wear = (item: ShopItem) => {
    setEquipped((e) => ({ ...e, [item.slot]: e[item.slot] === item.id ? undefined : item.id }));
    setMood('happy');
    window.setTimeout(() => setMood('idle'), 1200);
  };
  const wearCostume = (id: string) => {
    setWorn((w) => (w === id ? null : id));
    setMood('happy');
    window.setTimeout(() => setMood('idle'), 1200);
  };
  const pickCostume = (id: string) => setCollecting(id);

  const pickTint = (targetId: string, tint: TintOption, unlocked: boolean) => {
    if (unlocked) {
      setTuning((t) => ({ ...(t ?? { current: {}, unlocked: {} }), current: { ...(t?.current ?? {}), [targetId]: tint.id } }));
      say({ emoji: '🎨', title: `Цвет: ${tint.title.toLowerCase()}`, text: 'Открытый оттенок — переключай бесплатно' });
      return;
    }
    if (gems < TINT_PRICE) {
      say({ emoji: '💎', title: `Для цвета нужно ${TINT_PRICE} 💎`, text: 'Кристаллы — за задания дня' });
      return;
    }
    setGems((g) => g - TINT_PRICE);
    setTuning((t) => ({
      current: { ...(t?.current ?? {}), [targetId]: tint.id },
      unlocked: { ...(t?.unlocked ?? {}), [targetId]: [...(t?.unlocked?.[targetId] ?? []), tint.id] },
    }));
    dance();
    say({ emoji: '🎨', title: `Оттенок «${tint.title.toLowerCase()}» открыт!`, text: `−${TINT_PRICE} 💎 · переключения теперь бесплатны` });
  };

  // Сдача вещи обратно (sell-back): те же правила, что в приложении.
  const sellDemoItem = (item: ShopItem) => {
    const refund = sellPrice(item);
    setGems((g) => g + refund);
    setOwned((o) => o.filter((x) => x !== item.id));
    setEquipped((e) => (e[item.slot] === item.id ? { ...e, [item.slot]: undefined } : e));
    setDetail(null);
    say({ emoji: item.emoji ?? '🎩', title: `+${refund} 💎 · «${item.title}» сдана`, text: 'Часть стоимости вернулась' });
  };

  // ── герой витрины: ближайшая цель копления ─────────────────────────
  const unowned = OUTFIT_ITEMS.filter((i) => !owned.includes(i.id));
  const hero = unowned.length
    ? unowned.reduce((best, i) => (missingGems(i, gems) < missingGems(best, gems) ? i : best), unowned[0])
    : null;

  /** Ближайшая покупка — только из выбранного подраздела техники. */
  const toyGoal = toysByShelf(toyShelf)
    .filter((item) => !isOwned(owned, item.id))
    .reduce<ShopItem | null>((best, item) => (!best || item.price < best.price ? item : best), null);

  const itemState = (item: ShopItem): 'buy' | 'poor' | 'owned' | 'worn' => {
    if (!isOwned(owned, item.id)) return canBuy(item, gems) ? 'buy' : 'poor';
    return isWearing(equipped, item) ? 'worn' : 'owned';
  };

  const openItem = (item: ShopItem) => setDetail({ kind: 'item', item });
  const openCostume = (costume: Costume) => setDetail({ kind: 'costume', costume });
  const openTrack = (track: MusicTrack) => setDetail({ kind: 'track', track });

  const cats: { id: Cat; title: string; emoji: string }[] = [
    { id: 'outfits', title: 'Наряды', emoji: '🎩' },
    { id: 'toys', title: 'Техника', emoji: '🚗' },
    { id: 'costumes', title: 'Костюмы', emoji: '🧩' },
    { id: 'music', title: 'Музыка', emoji: '🎵' },
    { id: 'backgrounds', title: 'Фоны', emoji: '🖼️' },
  ];
  const soon = [{ title: 'Звуки', emoji: '🔊' }];

  const wornLook: Partial<Record<ShopSlot, string>> = equipped;

  return (
    <div className="mz-wrap screen" style={{ maxWidth: 1180 }}>
      <style>{CSS}</style>
      <h1>Магазин БУКа — новая концепция</h1>
      <p className="muted">
        Живой макет на настоящих компонентах и каталогах (наряды, техника, костюмы, музыка и фоны).
        Демо-профиль: 💎 {gems}, куплена кепка и смартфон, собран костюм «Пилот истребителя»,
        мечты: шарфик, гоночная машина и «Пикселяндия». Концепция — <code>docs/shop-concept.md</code>.
      </p>
      <div className="row mb" style={{ flexWrap: 'wrap' }}>
        <button className={`chip ${theme === 'light' ? 'on' : ''}`} onClick={() => setTheme('light')}>Светлая тема</button>
        <button className={`chip ${theme === 'dark' ? 'on' : ''}`} onClick={() => setTheme('dark')}>Тёмная тема</button>
        <button className={`chip ${width === 402 ? 'on' : ''}`} onClick={() => setWidth(402)}>Экран 402</button>
        <button className={`chip ${width === 320 ? 'on' : ''}`} onClick={() => setWidth(320)}>Экран 320</button>
        <button className="chip" onClick={() => {
          setGems(DEMO.gems); setOwned(DEMO.owned); setEquipped(DEMO.equipped);
          setTuning(DEMO.tuning); setAssembled(DEMO.assembled); setWorn(DEMO.worn);
          setCollecting(DEMO.collecting); setPieces(DEMO.pieces);
          setMusicOwned(DEMO.musicOwned); setMusicTrack(DEMO.musicTrack);
          setWishlist(DEMO.wishlist); setView('vitrina'); setCat('outfits'); setThemeStyle('classic'); setDetail(null);
          say({ emoji: '🔄', title: 'Демо сброшено', text: 'Стартовый профиль восстановлен' });
        }}>Сбросить демо</button>
      </div>

      <div className="mz-stage">
        <div className="mz-phone" style={{ width }}>
          <div className="mz-scroll">
            {/* ── Шапка: название и баланс — и больше ничего ─────────── */}
            <div className="mz-sticky">
              <div className="row mb">
                <h1 className="grow" style={{ margin: 0, fontSize: 'var(--fs-lg)' }}>Магазин БУКа 🎩</h1>
                <div className="stat-pill gems">💎 {gems}</div>
              </div>
              <div className="mx-seg" role="tablist" aria-label="Витрина или гардероб">
                <button role="tab" aria-selected={view === 'vitrina'} className={view === 'vitrina' ? 'on' : ''} onClick={() => setView('vitrina')}>
                  🛍️ Витрина
                </button>
                <button role="tab" aria-selected={view === 'wardrobe'} className={view === 'wardrobe' ? 'on' : ''} onClick={() => setView('wardrobe')}>
                  👕 Гардероб · {owned.length + assembled.length + musicOwned.length}
                </button>
              </div>
              {view === 'vitrina' && (
                <div className="mz-chips" role="tablist" aria-label="Разделы магазина">
                  {cats.map((c) => (
                    <button key={c.id} role="tab" aria-selected={cat === c.id}
                      className={`chip${cat === c.id ? ' on' : ''}`} onClick={() => setCat(c.id)}>
                      {c.emoji} {c.title}
                    </button>
                  ))}
                  {soon.map((s) => (
                    <button key={s.title} className="chip mz-soon" disabled title="Скоро"
                      aria-label={`${s.title} — скоро`}>
                      {s.emoji} {s.title} · скоро
                    </button>
                  ))}
                </div>
              )}
            </div>

            {view === 'vitrina' && cat === 'outfits' && (
              <>
                {/* ── Герой: одна ближайшая цель, крупно ─────────────── */}
                {hero && (
                  <div className="mz-shelf">
                    {/* Герой — та же сцена витрины, что в приложении: БУК в арке */}
                    <div
                      className="shop-hero"
                      role="button"
                      tabIndex={0}
                      onClick={() => openItem(hero)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openItem(hero); } }}
                    >
                      <div className="shop-hero-art">
                        <Mascot mood="idle" look={{ [hero.slot]: hero.id }} costumeId={null} stage={growth.index} size={104} />
                      </div>
                      <div className="shop-hero-body grow">
                        <span className="shop-badge">🎯 Ближайшая цель</span>
                        <div className="shop-hero-title">{hero.title}</div>
                        <div className="tiny muted">{hero.desc}</div>
                        <div className="tiny" style={{ marginTop: 4, fontWeight: 700 }}>
                          {gems >= hero.price
                            ? `Хватает! ${hero.price} 💎 — и он твой`
                            : `У тебя ${gems} 💎 · ещё ${missingGems(hero, gems)} 💎`}
                        </div>
                        <button
                          className="btn sm primary mt"
                          style={{ marginTop: 8 }}
                          onClick={(e) => { e.stopPropagation(); buyItem(hero); }}
                        >
                          {gems >= hero.price ? `Купить · 💎${hero.price}` : `Копить — ещё ${missingGems(hero, gems)} 💎`}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                <div className="mz-sec">
                  <h2>Головные уборы, очки и прочее</h2>
                  <div className="tiny muted">Одна карточка — один наряд. Тап — подробнее.</div>
                </div>
                <div className="mz-shelf">
                  <ShowcaseGrid>
                    {OUTFIT_ITEMS.map((item) => {
                      const st = itemState(item);
                      return (
                        <Card
                          key={item.id}
                          art={<Mascot mood="idle" look={{ [item.slot]: item.id }} costumeId={null} stage={growth.index} size={64} />}
                          title={item.title}
                          desc={item.desc}
                          state={st}
                          priceLabel={isOwned(owned, item.id) ? 'Твоя ✓' : `💎 ${item.price}`}
                          afford={canBuy(item, gems)}
                          wished={wishlist.includes(item.id)}
                          onOpen={() => openItem(item)}
                          onWish={() => toggleWish(item.id)}
                          actionLabel={
                            st === 'worn' ? 'Надето ✓' : st === 'owned' ? 'Надеть' : st === 'buy' ? `Купить · 💎${item.price}` : `Ещё ${missingGems(item, gems)} 💎`
                          }
                          onAction={() => {
                            if (st === 'owned' || st === 'worn') wear(item);
                            else if (st === 'buy') buyItem(item);
                            else say({ emoji: '💎', title: 'Копим!', text: `«${item.title}»: ещё ${missingGems(item, gems)} 💎. Поставь 🤍 в мечты` });
                          }}
                        />
                      );
                    })}
                  </ShowcaseGrid>
                </div>
              </>
            )}

            {/* ── Техника: отдельные разделы авто, кораблей и телефонов ─── */}
            {view === 'vitrina' && cat === 'toys' && (
              <section aria-label="Техника">
                <div className="mz-sec">
                  <h2>Техника БУКа</h2>
                  <div className="tiny muted">Авто, корабли и телефоны — каждый раздел отдельно. Купленное ждёт тебя в ангаре.</div>
                </div>
                <div className="shop-cats shop-toy-cats" role="tablist" aria-label="Разделы техники">
                  {TOY_SHELVES.map(({ id, title, emoji }) => (
                    <button key={id} type="button" role="tab" aria-selected={toyShelf === id} className={`chip${toyShelf === id ? ' on' : ''}`} onClick={() => setToyShelf(id)}>
                      {emoji} {title}
                    </button>
                  ))}
                </div>
                {toyGoal && (
                  <div style={{ padding: '0 14px' }}>
                    <div className="shop-tech-goal">
                      <span className="shop-tech-goal-icon" aria-hidden="true">{toyGoal.emoji ?? (toyShelf === 'ship' ? '🚢' : '🚗')}</span>
                      <span className="grow">
                        <b>Ближайшая покупка: {toyGoal.title}</b>
                        <span className="tiny muted">
                          {gems >= toyGoal.price ? `Уже хватает — ${toyGoal.price} 💎. Забирай!` : `Ещё ${missingGems(toyGoal, gems)} 💎 из ${toyGoal.price}`}
                        </span>
                      </span>
                      <button className={`btn sm ${gems >= toyGoal.price ? 'primary' : 'ghost'}`} onClick={() => (gems >= toyGoal.price ? buyItem(toyGoal) : openItem(toyGoal))}>
                        {gems >= toyGoal.price ? 'Купить' : 'Посмотреть'}
                      </button>
                    </div>
                  </div>
                )}
                {TOY_SHELVES.filter(({ id }) => id === toyShelf).map(({ id, title, emoji }) => (
                  <div key={id}>
                    <div className="mz-sec" style={{ paddingTop: 8 }}>
                      <h3 className="shop-shelf-title"><span aria-hidden="true">{emoji}</span> {title}</h3>
                    </div>
                    <div className="mz-shelf">
                      <ShowcaseGrid tone={id === 'car' ? 'mint' : id === 'ship' ? 'sky' : undefined}>
                        {toysByShelf(id).map((item) => {
                          const st = itemState(item);
                          return (
                            <Card
                              key={item.id}
                              toy
                              art={<ToyArt id={item.id} interactive size={82} tuning={tuning} />}
                              title={item.title}
                              desc={item.desc}
                              state={st}
                              priceLabel={isOwned(owned, item.id) ? 'В ангаре ✓' : `💎 ${item.price}`}
                              afford={canBuy(item, gems)}
                              wished={wishlist.includes(item.id)}
                              onOpen={() => openItem(item)}
                              onWish={() => toggleWish(item.id)}
                              actionLabel={st === 'worn' ? 'На подиуме ✓' : st === 'owned' ? 'На подиум' : st === 'buy' ? `Купить · 💎${item.price}` : `Ещё ${missingGems(item, gems)} 💎`}
                              onAction={() => {
                                if (st === 'owned' || st === 'worn') wear(item);
                                else if (st === 'buy') buyItem(item);
                                else say({ emoji: '💎', title: 'Копим!', text: `«${item.title}»: ещё ${missingGems(item, gems)} 💎. Поставь 🤍 в мечты` });
                              }}
                            />
                          );
                        })}
                      </ShowcaseGrid>
                    </div>
                  </div>
                ))}
              </section>
            )}

            {view === 'vitrina' && cat === 'costumes' && (
              <>
                {(() => {
                  const active = collecting && !assembled.includes(collecting) ? collecting : null;
                  const activeCostume = active ? COSTUMES.find((c) => c.id === active) : null;
                  const prog = activeCostume ? costumeProgress({ pieces, collecting, assembled, worn: null }, activeCostume.id) : 0;
                  return activeCostume ? (
                    <div className="mz-collect">
                      <div className="row" style={{ alignItems: 'center', gap: 12 }}>
                        <Mascot mood="idle" costumeId={activeCostume.id} size={56} stage={growth.index} />
                        <div className="grow">
                          <b>Собираем сейчас: {activeCostume.title}</b>
                          <div className="tiny muted">{activeCostume.desc}</div>
                          <div className="mz-progress"><i style={{ width: `${(prog / PUZZLE_SIZE) * 100}%` }} /></div>
                          <div className="tiny" style={{ marginTop: 4 }}>Фрагментов: {prog} из {PUZZLE_SIZE} — за каждый урок</div>
                        </div>
                      </div>
                    </div>
                  ) : null;
                })()}
                <div className="mz-sec">
                  <h2>Костюмы · пазлы</h2>
                  <div className="tiny muted">Завершённый урок — фрагмент. Собери {PUZZLE_SIZE} — костюм твой 🧩</div>
                </div>
                <div className="mz-shelf">
                  <ShowcaseGrid>
                  {COSTUMES.map((c) => {
                    const done = assembled.includes(c.id);
                    const prog = costumeProgress({ pieces, collecting, assembled, worn: null }, c.id);
                    const isCurrent = !done && collecting === c.id;
                    const state: 'worn' | 'owned' | 'collect' = done ? (worn === c.id ? 'worn' : 'owned') : 'collect';
                    return (
                      <Card
                        key={c.id}
                        isNew={!done && prog === 0}
                        badge={isCurrent ? 'Собираю' : undefined}
                        art={<div className={done ? '' : 'pz-locked'}><Mascot mood={worn === c.id ? 'happy' : 'idle'} costumeId={c.id} size={64} stage={growth.index} /></div>}
                        title={c.title}
                        desc={c.desc}
                        state={state}
                        priceLabel={done ? 'Собран ✓' : `${prog}/${PUZZLE_SIZE} 🧩`}
                        afford={done}
                        wished={wishlist.includes(c.id)}
                        onOpen={() => openCostume(c)}
                        onWish={() => toggleWish(c.id)}
                        actionLabel={done ? (worn === c.id ? 'Надето ✓' : 'Надеть') : isCurrent ? `Собираю · ${prog}/${PUZZLE_SIZE}` : prog > 0 ? `Продолжить · ${prog}/${PUZZLE_SIZE}` : 'Собирать'}
                        onAction={() => {
                          if (done) wearCostume(c.id);
                          else pickCostume(c.id);
                        }}
                      />
                    );
                  })}
                  </ShowcaseGrid>
                </div>
              </>
            )}

            {view === 'vitrina' && cat === 'music' && (
              <>
                <div className="mz-sec">
                  <h2>Музыка БУКа 🎵</h2>
                  <div className="tiny muted">Настоящие записи Kevin MacLeod · слушай перед покупкой</div>
                </div>
                <div className="mz-shelf">
                  <ShowcaseGrid>
                  {MUSIC_TRACKS.map((t) => {
                    const has = musicOwned.includes(t.id);
                    const sel = musicTrack === t.id;
                    const playing = preview === t.id;
                    const st: 'worn' | 'owned' | 'buy' | 'poor' = sel ? 'worn' : has ? 'owned' : gems >= t.price ? 'buy' : 'poor';
                    return (
                      <Card
                        key={t.id}
                        art={
                          <div className="music-cover" aria-hidden="true">
                            <span>{t.emoji}</span><i>♫</i>
                            {playing && <span className="mz-eq" style={{ position: 'absolute', bottom: 6, right: 6 }}><i /><i /><i /></span>}
                          </div>
                        }
                        title={t.title}
                        desc={`${Math.floor(t.seconds / 60)}:${String(t.seconds % 60).padStart(2, '0')} · ${t.shelf === 'calm' ? 'фон' : 'награда'}`}
                        state={st}
                        priceLabel={has ? 'Твоя ✓' : `💎 ${t.price}`}
                        afford={gems >= t.price}
                        wished={wishlist.includes(t.id)}
                        onOpen={() => openTrack(t)}
                        onWish={() => toggleWish(t.id)}
                        actionLabel={sel ? 'Играет ✓' : has ? 'Выбрать' : `Купить · 💎${t.price}`}
                        onAction={() => {
                          if (has) { setMusicTrack(sel ? null : t.id); say({ emoji: t.emoji, title: sel ? 'Музыка выключена' : `«${t.title}» играет!`, text: sel ? '' : 'БУК слушает её и в других разделах' }); }
                          else if (gems >= t.price) buyTrack(t);
                          else say({ emoji: '💎', title: 'Копим!', text: `«${t.title}»: ещё ${t.price - gems} 💎` });
                        }}
                      />
                    );
                  })}
                  </ShowcaseGrid>
                </div>
              </>
            )}

            {view === 'vitrina' && cat === 'backgrounds' && (
              <section className="mz-sec" aria-label="Фоны приложения">
                <h2>Фоны и оформление</h2>
                <div className="tiny muted">Бесплатные стили для светлой и тёмной схемы</div>
                <div className="mz-shelf" role="group" aria-label="Выбор оформления приложения">
                  <ShowcaseGrid>
                    {THEME_STYLES.map((style) => (
                      <BackgroundThemeCard
                        key={style.id}
                        theme={style}
                        selected={themeStyle === style.id}
                        onSelect={() => setThemeStyle(style.id)}
                      />
                    ))}
                  </ShowcaseGrid>
                </div>
              </section>
            )}

            {view === 'wardrobe' && (
              <>
                {/* ── Гардероб: примерочная и коллекция ────────────────── */}
                <div className="card mb shop-stage" style={{ margin: '12px 14px 0' }}>
                  <button className="shop-mascot" aria-label="БУК в твоём наряде" onClick={dance}>
                    <Mascot mood={mood} look={wornLook} costumeId={worn} stage={growth.index} size={132} />
                  </button>
                  <div className="grow center">
                    <div style={{ fontWeight: 800 }}>{growth.title} · мой наряд</div>
                    <div className="tiny">{growth.desc}</div>
                    <div className="tiny" style={{ marginTop: 4 }}>
                      Освоено {mastered} {plural(mastered, 'слово', 'слова', 'слов')}
                      {owned.length ? ` · куплено на ${owned.reduce((s, id) => s + (SHOP_ITEMS.find((i) => i.id === id)?.price ?? 0), 0)} 💎` : ''}
                    </div>
                  </div>
                </div>

                <div className="mz-sec">
                  <h2>Наряды</h2>
                  {owned.length === 0 && <p className="tiny muted">Пока пусто. Витрина ➜ — там всё купленное сразу попадает сюда.</p>}
                </div>
                <div className="mz-shelf" style={{ paddingTop: 0 }}>
                  <ShowcaseGrid>
                  {OUTFIT_ITEMS.filter((i) => owned.includes(i.id)).map((item) => (
                    <Card
                      key={item.id}
                      state={isWearing(equipped, item) ? 'worn' : 'owned'}
                      art={<Mascot mood="idle" look={{ [item.slot]: item.id }} costumeId={null} stage={growth.index} size={64} />}
                      title={item.title}
                      priceLabel={isWearing(equipped, item) ? 'Надето ✓' : 'Куплено ✓'}
                      afford
                      onOpen={() => openItem(item)}
                      onWish={() => toggleWish(item.id)}
                      wished={wishlist.includes(item.id)}
                      actionLabel={isWearing(equipped, item) ? 'Снять' : 'Надеть'}
                      onAction={() => wear(item)}
                    />
                  ))}
                  </ShowcaseGrid>
                </div>

                <div className="mz-sec">
                  <h2>Моя техника</h2>
                  {TOY_ITEMS.filter((i) => owned.includes(i.id)).length === 0 && (
                    <p className="tiny muted">Пока пусто. Техника живёт на полке «Техника»</p>
                  )}
                </div>
                <div className="mz-shelf" style={{ paddingTop: 0 }}>
                  <ShowcaseGrid>
                    {TOY_ITEMS.filter((i) => owned.includes(i.id)).map((item) => (
                      <Card
                        key={item.id}
                        toy
                        state={isWearing(equipped, item) ? 'worn' : 'owned'}
                        art={<ToyArt id={item.id} interactive size={82} tuning={tuning} />}
                        title={item.title}
                        desc={item.desc}
                        priceLabel={isWearing(equipped, item) ? 'На подиуме ✓' : 'В ангаре ✓'}
                        afford
                        onOpen={() => openItem(item)}
                        onWish={() => toggleWish(item.id)}
                        wished={wishlist.includes(item.id)}
                        actionLabel={isWearing(equipped, item) ? 'С подиума' : 'На подиум'}
                        onAction={() => wear(item)}
                      />
                    ))}
                  </ShowcaseGrid>
                </div>

                <div className="mz-sec">
                  <h2>Костюмы</h2>
                  {assembled.length === 0 && <p className="tiny muted">Пока ни одного костюма. Каждый урок приносит фрагмент 🧩</p>}
                </div>
                <div className="mz-shelf" style={{ paddingTop: 0 }}>
                  <ShowcaseGrid>
                  {COSTUMES.filter((c) => assembled.includes(c.id)).map((c) => (
                    <Card
                      key={c.id}
                      state={worn === c.id ? 'worn' : 'owned'}
                      art={<Mascot mood={worn === c.id ? 'happy' : 'idle'} costumeId={c.id} size={64} stage={growth.index} />}
                      title={c.title}
                      priceLabel={worn === c.id ? 'Надет ✓' : 'Собран ✓'}
                      afford
                      onOpen={() => openCostume(c)}
                      onWish={() => toggleWish(c.id)}
                      wished={wishlist.includes(c.id)}
                      actionLabel={worn === c.id ? 'Снять' : 'Надеть'}
                      onAction={() => wearCostume(c.id)}
                    />
                  ))}
                  </ShowcaseGrid>
                </div>

                <div className="mz-sec">
                  <h2>Моя музыка</h2>
                  {musicOwned.length === 0 && <p className="tiny muted">Пока тихо. Купленные мелодии живут здесь.</p>}
                </div>
                <div style={{ padding: '0 14px 6px' }}>
                  {MUSIC_TRACKS.filter((t) => musicOwned.includes(t.id)).map((t) => (
                    <div className="music-choice" key={t.id} style={{ cursor: 'default' }}>
                      <span className="music-emoji">{t.emoji}</span>
                      <span className="grow"><b>{t.title}</b><small>«{t.originalTitle}»</small></span>
                      {musicTrack === t.id ? (
                        <span className="mz-eq" aria-label="Играет"><i /><i /><i /></span>
                      ) : (
                        <button className="btn sm ghost" onClick={() => { setMusicTrack(t.id); say({ emoji: t.emoji, title: `«${t.title}» играет!`, text: 'БУК уже включил новую музыку' }); }}>
                          Играть
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mz-sec">
                  <h2>Мечты 🤍</h2>
                  <div className="tiny muted">Отмечаем сердцем — видно, к чему копить</div>
                </div>
                <div className="mz-grid" style={{ paddingTop: 0 }}>
                  {wishlist.map((id) => {
                    const item = SHOP_ITEMS.find((i) => i.id === id);
                    const track = MUSIC_TRACKS.find((t) => t.id === id);
                    const costume = COSTUMES.find((c) => c.id === id);
                    if (item) {
                      const left = missingGems(item, gems);
                      return (
                        <div className="mz-card" key={id} style={{ cursor: 'default' }}>
                          <div className="mz-art">
                            {isToy(item)
                              ? <ToyArt id={item.id} size={64} tuning={tuning} />
                              : <Mascot mood="idle" look={{ [item.slot]: item.id }} costumeId={null} stage={growth.index} size={64} />}
                          </div>
                          <div className="shop-title">{item.title}</div>
                          <div className="mz-progress"><i style={{ width: `${Math.min(100, (gems / item.price) * 100)}%` }} /></div>
                          <div className="mz-state go" style={{ fontSize: 'var(--fs-xs)' }}>
                            {left > 0 ? `ещё ${left} 💎` : 'можно брать!'}
                          </div>
                          <button className="btn sm wide primary" disabled={left > 0} onClick={() => buyItem(item)}>
                            {left > 0 ? `Ещё ${left} 💎` : `Купить · 💎${item.price}`}
                          </button>
                        </div>
                      );
                    }
                    if (track) {
                      const left = track.price - gems;
                      return (
                        <div className="mz-card" key={id} style={{ cursor: 'default' }}>
                          <div className="mz-art"><div className="music-cover"><span>{track.emoji}</span><i>♫</i></div></div>
                          <div className="shop-title">{track.title}</div>
                          <div className="mz-progress"><i style={{ width: `${Math.min(100, (gems / track.price) * 100)}%` }} /></div>
                          <div className="mz-state go" style={{ fontSize: 'var(--fs-xs)' }}>
                            {left > 0 ? `ещё ${left} 💎` : 'можно брать!'}
                          </div>
                          <button className="btn sm wide primary" disabled={left > 0} onClick={() => buyTrack(track)}>
                            {left > 0 ? `Ещё ${left} 💎` : `Купить · 💎${track.price}`}
                          </button>
                        </div>
                      );
                    }
                    if (costume) {
                      return (
                        <div className="mz-card" key={id} style={{ cursor: 'default' }}>
                          <div className="mz-art"><Mascot mood="idle" costumeId={costume.id} size={64} stage={growth.index} /></div>
                          <div className="shop-title">{costume.title}</div>
                          <div className="tiny shop-desc">Купить нельзя — зарабатывается уроками</div>
                          <button className="btn sm wide ghost" onClick={() => { setView('vitrina'); setCat('costumes'); }}>
                            К сборке
                          </button>
                        </div>
                      );
                    }
                    return null;
                  })}
                  {wishlist.length === 0 && <p className="tiny muted" style={{ padding: '0 2px' }}>Пока ничего не мечтаем. 🤍 на карточке витрины — и вещь здесь.</p>}
                </div>
              </>
            )}
          </div>

          {/* ── Подробная карточка (bottom sheet) ─────────────────────── */}
          {detail && (
            <div className="mz-sheet-veil" onClick={() => setDetail(null)} role="presentation">
              <div className="mz-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                <div className="mz-grab" />
                {detail.kind === 'item' && (() => {
                  const item = detail.item;
                  const has = isOwned(owned, item.id);
                  const wearing = isWearing(equipped, item);
                  return (
                    <>
                      <div className={`mz-bigart${isToy(item) ? ' shop-bigart-toy' : ''}`}>
                        {isToy(item) ? (
                          // Как и в приложении: в подробной карточке техники —
                          // сам товар крупно, без примерки на БУКе.
                          <ToyArt
                            key={item.id}
                            id={item.id}
                            interactive
                            size={200}
                            className="shop-bigart-toy-art"
                            tuning={tuning}
                            alt={
                              hasCarArt(item.id)
                                ? carAlt(item.id, item.title)
                                : hasShipArt(item.id)
                                  ? shipAlt(item.id, item.title)
                                  : `${item.title} — техника БУКа`
                            }
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
                      {isToy(item) && (
                        <p className="tiny muted">
                          Встанет в ангаре БУКа — там её видно крупно и целиком.
                        </p>
                      )}
                      <div className="row mb">
                        <span className={`mz-price${gems >= item.price ? ' afford' : ''}`}>💎 {item.price}</span>
                        <span className="tiny muted grow" style={{ alignSelf: 'center' }}>
                          {has ? (isToy(item) ? 'Уже в коллекции' : 'Уже в гардеробе') : `У тебя ${gems} 💎`}
                        </span>
                      </div>
                      {!has && (
                        <p className="tiny muted mb">
                          Если передумаешь — вернём {sellPrice(item)} 💎 ({(item.kind ?? 'outfit') === 'toy' ? 30 : 50}% от цены)
                        </p>
                      )}
                      <div className="mz-row mb">
                        {has ? (
                          <button className={`btn lg${wearing ? ' green' : ' primary'}`} onClick={() => { wear(item); setDetail(null); }}>
                            {wearing ? (isToy(item) ? 'С подиума' : 'Снять') : isToy(item) ? 'На подиум' : 'Надеть'}
                          </button>
                        ) : (
                          <button className="btn lg primary" disabled={gems < item.price} onClick={() => { setDetail(null); buyItem(item); }}>
                            {gems >= item.price ? `Купить за 💎${item.price}` : `Ещё ${missingGems(item, gems)} 💎`}
                          </button>
                        )}
                      </div>
                        {has && (
                        <>
                          <button className="btn lg wide ghost mb" aria-expanded={paletteOpen}
                            onClick={() => setPaletteOpen((o) => !o)}>
                            {paletteOpen ? '🎨 Готово' : '🎨 Цвет'}
                          </button>
                          {paletteOpen && (
                            <TintPicker caption="Цвет" targetId={item.id} title={item.title} tuning={tuning} onPick={(tint, unlocked) => pickTint(item.id, tint, unlocked)} />
                          )}
                          <button className="btn lg wide ghost mb" onClick={() => sellDemoItem(item)}>
                            Сдать обратно · +{sellPrice(item)} 💎
                          </button>
                        </>
                      )}
                      <button className="btn lg wide ghost" onClick={() => toggleWish(item.id)}>
                        {wishlist.includes(item.id) ? '💜 В мечтах — убрать' : '🤍 В мечты'}
                      </button>
                    </>
                  );
                })()}
                {detail.kind === 'costume' && (() => {
                  const c = detail.costume;
                  const done = assembled.includes(c.id);
                  const prog = costumeProgress({ pieces, collecting, assembled, worn: null }, c.id);
                  return (
                    <>
                      <div className="mz-bigart">
                        <Mascot mood="happy" costumeId={c.id} size={150} stage={growth.index} />
                      </div>
                      <h2 style={{ margin: '0 0 2px' }}>{c.title}</h2>
                      <p className="tiny muted" style={{ marginTop: 0 }}>{c.desc}</p>
                      {done ? (
                        <div className="mz-row mb">
                          <button className={`btn lg${worn === c.id ? ' green' : ' primary'}`} onClick={() => { wearCostume(c.id); setDetail(null); }}>
                            {worn === c.id ? 'Надет ✓' : 'Надеть'}
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="mb">
                            <div className="tiny">Фрагментов: {prog} из {PUZZLE_SIZE}</div>
                            <div className="mz-progress"><i style={{ width: `${(prog / PUZZLE_SIZE) * 100}%` }} /></div>
                            <div className="tiny muted" style={{ marginTop: 4 }}>Покупать нельзя: за каждый завершённый урок — +1 🧩</div>
                          </div>
                          <div className="mz-row mb">
                            <button className={`btn lg${collecting === c.id ? ' green' : ' primary'}`} onClick={() => { pickCostume(c.id); setDetail(null); }}>
                              {collecting === c.id ? 'Собираю ✓' : prog > 0 ? 'Продолжить сборку' : 'Собирать'}
                            </button>
                          </div>
                        </>
                      )}
                    </>
                  );
                })()}
                {detail.kind === 'track' && (() => {
                  const t = detail.track;
                  const has = musicOwned.includes(t.id);
                  const sel = musicTrack === t.id;
                  const playing = preview === t.id;
                  return (
                    <>
                      <div className="mz-bigart">
                        <div className="music-cover" style={{ width: 120, height: 120 }} aria-hidden="true">
                          <span style={{ fontSize: 44 }}>{t.emoji}</span><i>♫</i>
                          {playing && <span className="mz-eq" style={{ position: 'absolute', bottom: 8, right: 8 }}><i /><i /><i /></span>}
                        </div>
                      </div>
                      <h2 style={{ margin: '0 0 2px' }}>{t.title}</h2>
                      <p className="tiny muted" style={{ marginTop: 0 }}>«{t.originalTitle}» · {t.artist} · {t.seconds} сек</p>
                      <div className="row mb">
                        <span className={`mz-price${gems >= t.price ? ' afford' : ''}`}>💎 {t.price}</span>
                        <span className="tiny muted grow" style={{ alignSelf: 'center' }}>
                          {has ? 'В коллекции' : t.price === 0 ? 'Бесплатно' : `У тебя ${gems} 💎`}
                        </span>
                      </div>
                      <div className="mz-row mb">
                        <button className="btn lg ghost" onClick={() => setPreview(playing ? null : t.id)}>
                          {playing ? '⏸ Остановить' : '▶ Послушать'}
                        </button>
                        {has ? (
                          <button className={`btn lg${sel ? ' green' : ' primary'}`} onClick={() => { setMusicTrack(sel ? null : t.id); setPreview(null); setDetail(null); }}>
                            {sel ? 'Играет ✓' : 'Выбрать'}
                          </button>
                        ) : (
                          <button className="btn lg primary" disabled={gems < t.price} onClick={() => { setDetail(null); buyTrack(t); }}>
                            {t.price === 0 ? 'Забрать бесплатно' : gems >= t.price ? `Купить за 💎${t.price}` : `Ещё ${t.price - gems} 💎`}
                          </button>
                        )}
                      </div>
                      <button className="btn lg wide ghost" onClick={() => toggleWish(t.id)}>
                        {wishlist.includes(t.id) ? '💜 В мечтах — убрать' : '🤍 В мечты'}
                      </button>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* ── Подтверждение покупки: тот же диалог, что и раньше ────── */}
          {ask && ask.target.kind === 'item' && (
            <ConfirmDialog
              emoji={ask.target.item.emoji ?? '🎩'}
              title={`Купить «${ask.target.item.title}»?`}
              text={`Отдашь ${ask.target.item.price} 💎 из ${gems}. ${isToy(ask.target.item) ? 'Покупка сразу появится рядом с БУКом.' : 'БУК сразу это примерит.'}`}
              stayLabel={`Купить за 💎${ask.target.item.price}`}
              leaveLabel="Не сейчас"
              onStay={confirmBuy}
              onLeave={() => setAsk(null)}
            />
          )}
          {ask && ask.target.kind === 'track' && (
            <ConfirmDialog
              emoji={ask.target.track.emoji}
              title={`Купить «${ask.target.track.title}»?`}
              text={`Отдашь ${ask.target.track.price} 💎 из ${gems}. БУК сразу включит новую музыку.`}
              stayLabel={`Купить за 💎${ask.target.track.price}`}
              leaveLabel="Не сейчас"
              onStay={confirmBuyTrack}
              onLeave={() => setAsk(null)}
            />
          )}

          {toast && (
            <div className="mz-toast" role="status">
              <b>{toast.emoji} {toast.title}</b>
              {toast.text && <div style={{ fontSize: 'var(--fs-xs)', marginTop: 2 }}>{toast.text}</div>}
            </div>
          )}
          <div style={{ height: 24 }} />
        </div>

        {/* ── Пояснения рядом с телефоном ────────────────────────────── */}
        <div className="mz-side">
          <div className="card mb">
            <h3 style={{ marginTop: 0 }}>Что изменилось против сегодняшнего магазина</h3>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li><b>Витрина / Гардероб</b> — «хочу» и «моё» больше не смешаны в одной ленте</li>
              <li><b>Фоны и оформление</b> — пять бесплатных стилей; светлая/тёмная схема выбирается отдельно</li>
              <li><b>Чипы-полки по типу товара</b> — новый раздел (например, звуки) = новый чип, без переделки экрана</li>
              <li><b>Витрина-бутик</b> — арочные ниши с лампой и подиумом вместо плоской сетки карточек</li>
              <li><b>Сцена-витрина</b> — гараж с машиной, пирс с кораблём и витрина с телефоном, БУК на коврике, как в референсе</li>
              <li><b>Техника</b> — авто, телефоны и корабли: три подполки, стоят рядом с БУКом</li>
              <li><b>Один макет карточки</b> для всех типов: арт, название, цена/статус, одно действие</li>
              <li><b>Герой-секция</b> — одна ближайшая цель копления, а не 20 ценников сразу</li>
              <li><b>Сердце 🤍</b> — мечта без давления; прогресс копления — в Гардеробе</li>
              <li><b>Подробная карточка — снизу (sheet)</b>: примерка крупно, палитра и покупка в одном месте, верстка не прыгает</li>
              <li><b>Музыка — одна полка</b>, а не половина экрана: примерка и выбор в карточке</li>
            </ul>
          </div>
          <div className="card mb">
            <h3 style={{ marginTop: 0 }}>Попробуй в макете</h3>
            <ol style={{ margin: 0, paddingLeft: 18 }}>
              <li>Купи <b>Шарфик</b> (30 💎 — как раз хватает): подтверждение, надевание, танец</li>
              <li>Открой <b>Мечты</b> в Гардеробе — прогресс копления по шарфу и «Пикселяндии»</li>
              <li>Переключись на <b>Технику</b>: три полки, ближайшая покупка и ConfirmDialog</li>
              <li>Переключись на <b>Костюмы</b>: активный сбор крупно, остальные — сеткой</li>
              <li>Открой карточку <b>Кепки</b> → «🎨 Цвет»: палитра в sheet, 1 💎 за оттенок</li>
              <li>Тапни <b>«скоро»-чипы</b> — так выглядят разделы, которых ещё нет</li>
            </ol>
          </div>
          <p className="tiny muted">
            Макет — витрина концепции: состояние локальное, кристаллы не списываются,
            звук не играет (в приложении примерка звучит). Текстовая версия решений —
            <code> docs/shop-concept.md</code>.
          </p>
        </div>
      </div>
    </div>
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<Demo />);

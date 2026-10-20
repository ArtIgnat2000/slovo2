import { ITEM_BY_ID } from '../engine/shop';
import { TINT_PALETTES, accessoryColors, artPencilTint } from '../engine/tints';
import type { ShopTuning } from '../types';
import { CarArt, hasCarArt } from './CarArt';
import { ShipArt, hasShipArt } from './ShipArt';

/**
 * Техника БУКа: авто, морские суда и телефоны. Машины и корабли — цветные
 * карандашные рисунки на прозрачном фоне (`public/cars/*.webp`,
 * `public/ships/*.webp`), чтобы крупные детали оставались выразительными
 * и на полке, и в ангаре. Телефоны по-прежнему рисуются лёгким SVG.
 * На витрине вещь показывается отдельно — как товар на полке, а не на сове.
 */

type Colors = [string, string, string];

/**
 * Цвета деталей: явные (например, от совы) → выбранный оттенок из профиля →
 * базовая палитра. Тюнинг теперь доходит и до карточки витрины: раньше она
 * всегда рисовала базу, а ребёнок видел перекраску только в гардеробе.
 */
function colorsFor(id: string, colors?: Colors | null, tuning?: ShopTuning): Colors {
  return colors ?? accessoryColors(id, tuning) ?? TINT_PALETTES[id]?.base.colors ?? ['#3b82f6', '#1f2937', '#ffd166'];
}

/** Общая тень под вещью: «стоит на полке», а не висит в воздухе. */
function ToyShadow() {
  return <ellipse cx="50" cy="91" rx="31" ry="4.5" fill="#241f36" opacity=".14" />;
}

/** Телефоны. */
function Phone({ id, colors }: { id: string; colors: Colors }) {
  const [main, deep, accent] = colors;

  if (id === 'phone-smart') {
    return (
      <g>
        <ToyShadow />
        <rect x="29" y="5" width="42" height="87" rx="10" fill={main} stroke="#241f36" strokeOpacity=".22" strokeWidth="2" />
        <rect x="33" y="9" width="34" height="79" rx="7" fill="#ffffff" opacity=".16" />
        <rect x="36" y="18" width="28" height="56" rx="4" fill={deep} />
        <circle cx="50" cy="12.5" r="1.7" fill="#ffffff" opacity=".7" />
        {/* На экране — маленький БУК: вещь «про него», а не абстрактный гаджет */}
        <circle cx="44" cy="42" r="3.2" fill={accent} />
        <circle cx="56" cy="42" r="3.2" fill={accent} />
        <path d="M47 49 L50 53 L53 49Z" fill={accent} />
        <rect x="41" y="60" width="5" height="5" rx="1.4" fill={accent} opacity=".75" />
        <rect x="48" y="60" width="5" height="5" rx="1.4" fill={accent} opacity=".75" />
        <rect x="55" y="60" width="5" height="5" rx="1.4" fill={accent} opacity=".75" />
        <rect x="43" y="81" width="14" height="3" rx="1.5" fill="#ffffff" opacity=".55" />
        <circle cx="50" cy="88" r="2.2" fill="#ffffff" opacity=".32" />
      </g>
    );
  }

  if (id === 'phone-flip') {
    const keys = [0, 1, 2].flatMap((row) =>
      [0, 1, 2].map((col) => (
        <circle key={`${row}-${col}`} cx={38 + col * 12} cy={60 + row * 9} r="2.3" fill={deep} opacity=".85" />
      )),
    );
    return (
      <g>
        <ToyShadow />
        <rect x="28" y="4" width="44" height="43" rx="8" fill={main} stroke="#241f36" strokeOpacity=".22" strokeWidth="2" />
        <rect x="33" y="9" width="34" height="29" rx="4" fill={deep} />
        <circle cx="44" cy="22" r="3" fill={accent} />
        <circle cx="56" cy="22" r="3" fill={accent} />
        <path d="M47 28 L50 32 L53 28Z" fill={accent} />
        <rect x="44" y="44" width="12" height="4" rx="2" fill={deep} opacity=".7" />
        <rect x="28" y="47" width="44" height="48" rx="8" fill={main} stroke="#241f36" strokeOpacity=".22" strokeWidth="2" />
        <path d="M31 53 Q50 58 69 53" stroke="#ffffff" strokeWidth="2" fill="none" opacity=".22" strokeLinecap="round" />
        {keys}
        <circle cx="44" cy="86" r="4" fill={accent} />
        <circle cx="56" cy="86" r="4" fill={deep} opacity=".75" />
      </g>
    );
  }

  // Ретро-телефон с диском: самый «бабушкин» предмет на полке.
  const dialHoles = Array.from({ length: 10 }, (_, i) => {
    const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
    return (
      <circle
        key={i}
        cx={50 + Math.cos(angle) * 11}
        cy={72 + Math.sin(angle) * 11}
        r="1.9"
        fill={deep}
        opacity=".8"
      />
    );
  });
  return (
    <g>
      <ToyShadow />
      <path d="M13 90 Q10 58 26 52 L74 52 Q90 58 87 90 Z" fill={main} stroke="#241f36" strokeOpacity=".22" strokeWidth="2" />
      <path d="M20 60 Q50 54 80 60" stroke="#ffffff" strokeWidth="2.4" fill="none" opacity=".2" strokeLinecap="round" />
      <circle cx="50" cy="72" r="18" fill={accent} stroke={deep} strokeWidth="2.4" />
      {dialHoles}
      <circle cx="50" cy="72" r="4.2" fill={deep} />
      <rect x="10" y="10" width="80" height="20" rx="10" fill={main} stroke="#241f36" strokeOpacity=".22" strokeWidth="2" />
      <rect x="10" y="7" width="22" height="26" rx="9" fill={main} stroke="#241f36" strokeOpacity=".22" strokeWidth="2" />
      <rect x="68" y="7" width="22" height="26" rx="9" fill={main} stroke="#241f36" strokeOpacity=".22" strokeWidth="2" />
      <rect x="16" y="13" width="8" height="14" rx="4" fill={deep} />
      <rect x="76" y="13" width="8" height="14" rx="4" fill={deep} />
      <path d="M78 33 Q88 40 82 50" stroke={deep} strokeWidth="2.4" fill="none" strokeLinecap="round" strokeDasharray="3 3" opacity=".8" />
    </g>
  );
}

/** Корабли. */
function Ship({ id, colors }: { id: string; colors: Colors }) {
  const [main, deep, accent] = colors;

  const waves = (
    <g stroke={deep} strokeWidth="2.4" fill="none" strokeLinecap="round" opacity=".55">
      <path d="M6 92 Q17 88 28 92 T50 92 T72 92 T94 92" />
      <path d="M16 98 Q27 94 38 98 T60 98 T82 98" opacity=".65" />
    </g>
  );

  if (id === 'ship-paper') {
    return (
      <g>
        <ToyShadow />
        {waves}
        <path d="M50 9 L50 67 L15 67 Z" fill={main} stroke="#94a3b8" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M52 18 L85 67 L52 67 Z" fill={main} opacity=".82" stroke="#94a3b8" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M50 9 L50 67" stroke="#94a3b8" strokeWidth="1.2" />
        <path d="M23 58 L41 34 M61 58 L78 24" stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 3" opacity=".8" />
        <path d="M50 9 L66 13 L50 17 Z" fill={accent} />
        <path d="M11 68 L89 68 L73 87 L27 87 Z" fill={main} stroke="#94a3b8" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M16 72 L84 72" stroke={deep} strokeWidth="2" opacity=".55" strokeLinecap="round" />
        <path d="M33 80 L67 80" stroke={deep} strokeWidth="1.6" opacity=".4" strokeLinecap="round" />
      </g>
    );
  }

  if (id === 'ship-sail') {
    return (
      <g>
        <ToyShadow />
        {waves}
        <path d="M10 74 L90 74 L74 91 L26 91 Z" fill={main} stroke="#241f36" strokeOpacity=".22" strokeWidth="2" strokeLinejoin="round" />
        <path d="M14 78 L86 78" stroke={accent} strokeWidth="2.4" opacity=".85" strokeLinecap="round" />
        <circle cx="37" cy="84" r="2.4" fill={accent} opacity=".8" />
        <circle cx="50" cy="84" r="2.4" fill={accent} opacity=".8" />
        <circle cx="63" cy="84" r="2.4" fill={accent} opacity=".8" />
        <rect x="49" y="10" width="3" height="65" rx="1.5" fill={accent} />
        <path d="M45 20 L45 69 L18 69 Z" fill={deep} stroke="#94a3b8" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M56 14 L82 69 L56 69 Z" fill={deep} stroke="#94a3b8" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M52 10 L66 14 L52 18 Z" fill={accent} />
      </g>
    );
  }

  // Пароход: корпус, каюта, труба и дым.
  return (
    <g>
      <ToyShadow />
      {waves}
      <path d="M6 64 L94 64 L82 88 L18 88 Z" fill={main} stroke="#241f36" strokeOpacity=".22" strokeWidth="2" strokeLinejoin="round" />
      <path d="M10 69 L90 69" stroke={deep} strokeWidth="2" opacity=".35" strokeLinecap="round" />
      {[26, 38, 50, 62, 74].map((x) => (
        <circle key={x} cx={x} cy="78" r="3" fill={accent} stroke={deep} strokeWidth="1.2" />
      ))}
      <rect x="33" y="42" width="35" height="22" rx="3" fill={accent} stroke="#241f36" strokeOpacity=".18" strokeWidth="1.4" />
      <rect x="38" y="47" width="6" height="7" rx="1.2" fill={deep} />
      <rect x="48" y="47" width="6" height="7" rx="1.2" fill={deep} />
      <rect x="58" y="47" width="6" height="7" rx="1.2" fill={deep} />
      <rect x="57" y="21" width="12" height="21" rx="2" fill={deep} />
      <rect x="56" y="21" width="14" height="4" rx="2" fill={accent} />
      <path d="M31 31 L31 42" stroke={deep} strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="63" cy="14" r="5" fill="#94a3b8" opacity=".45" />
      <circle cx="70" cy="8" r="4" fill="#94a3b8" opacity=".35" />
      <circle cx="76" cy="4" r="3" fill="#94a3b8" opacity=".25" />
    </g>
  );
}

function ToyGlyph({ id, colors }: { id: string; colors: Colors }) {
  const item = ITEM_BY_ID[id];
  if (!item || item.kind !== 'toy') return null;
  if (item.toy === 'phone') return <Phone id={id} colors={colors} />;
  if (item.toy === 'ship') return <Ship id={id} colors={colors} />;
  return null;
}

/**
 * Товарная картинка техники для витрины, sheet и гардероба.
 *
 * Машины — растровый цветной карандашный рисунок реальной модели (`CarArt`):
 * размер и посадку на подиум задаёт контекст через CSS, как раньше делал
 * `size` у квадратного SVG. Телефоны и корабли остаются SVG и принимают `size`.
 * `colors[0]` у машины — цвет «цветного карандаша» поверх готового рисунка.
 */
export function ToyArt({
  id,
  colors,
  size = 84,
  className,
  tuning,
  alt,
}: {
  id: string;
  colors?: Colors | null;
  size?: number;
  className?: string;
  /** Тюнинг профиля: у машин — цветной карандаш, у телефонов/кораблей — палитра */
  tuning?: ShopTuning;
  /**
   * Подпись рисунка для подробного просмотра. На витрине и в гардеробе
   * карточка уже названа, поэтому по умолчанию рисунок декоративный.
   */
  alt?: string;
}) {
  if (hasCarArt(id)) {
    return <CarArt id={id} tint={artPencilTint(id, tuning)} className={className} alt={alt ?? ''} />;
  }
  if (hasShipArt(id)) {
    return <ShipArt id={id} tint={artPencilTint(id, tuning)} className={className} alt={alt ?? ''} />;
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : 'true'}
      focusable="false"
    >
      <ToyGlyph id={id} colors={colorsFor(id, colors, tuning)} />
    </svg>
  );
}

// 0.22.0: `MascotToy` (техника внутри SVG совы) удалён — машины, телефоны и
// корабли больше не рисуются на БУКе (правило `showsOnBuk` в engine/shop.ts,
// решение пользователя по docs/proposals/large-items-scene.md). Коллекция
// экспонируется крупно в сцене «Ангар» (ui/HangarScene.tsx) через тот же
// `ToyArt`: карандашный рисунок машины 720×480 наконец видно целиком.

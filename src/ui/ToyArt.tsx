import { ITEM_BY_ID } from '../engine/shop';
import { TINT_PALETTES, accessoryColors, artPencilTint } from '../engine/tints';
import type { ShopTuning } from '../types';
import { CarArt, hasCarArt } from './CarArt';
import { ShipArt, hasShipArt } from './ShipArt';
import { ElectronicsArt, hasElectronicsArt } from './ElectronicsArt';
import { AirplaneArt, hasAirplaneArt } from './AirplaneArt';
import { ProductPhoto, hasProductPhoto } from './ProductPhoto';

/**
 * Техника БУКа: авто, самолёты, морские суда и телефоны. Машины и корабли — цветные
 * карандашные рисунки на прозрачном фоне (`public/cars/*.webp`,
 * `public/ships/*.webp`), чтобы крупные детали оставались выразительными
 * и на полке, и в ангаре. Новая электроника — детальные WebP-иллюстрации,
 * телефоны показываются с одной стороны и поворачиваются по нажатию.
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

  if (id === 'ship-titanic') {
    // «Титаник»: чёрный корпус, красная ватерлиния, четыре трубы.
    return (
      <g>
        <ToyShadow />
        {waves}
        <path d="M4 62 L96 62 L84 88 L16 88 Z" fill={main} stroke="#241f36" strokeOpacity=".25" strokeWidth="2" strokeLinejoin="round" />
        <path d="M8 74 L92 74 L84 88 L16 88 Z" fill={deep} opacity=".9" />
        {[22, 36, 50, 64, 78].map((x) => (
          <circle key={x} cx={x} cy="69" r="2.6" fill={accent} stroke={deep} strokeWidth="1" />
        ))}
        <rect x="18" y="46" width="64" height="16" rx="3" fill={accent} stroke="#241f36" strokeOpacity=".18" strokeWidth="1.4" />
        {[26, 40, 54, 68].map((x) => (
          <g key={x}>
            <rect x={x} y="24" width="8" height="22" rx="2" fill={main} />
            <rect x={x - 1} y="24" width="10" height="4" rx="2" fill={deep} />
          </g>
        ))}
        <path d="M14 46 L14 30 M86 46 L86 30" stroke={deep} strokeWidth="2" strokeLinecap="round" />
        <circle cx="34" cy="14" r="4.4" fill="#94a3b8" opacity=".4" />
        <circle cx="60" cy="10" r="3.6" fill="#94a3b8" opacity=".3" />
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


/** Простые векторные рисунки новых полок 0.72.0: розовый танк, питомцы, спорт и вкусняшки. */
function Glyph({ id, colors }: { id: string; colors: Colors }) {
  const [main, shade, accent] = colors;
  switch (id) {
    case 'car-pink-tank':
      return (
        <g>
          <ToyShadow />
          <rect x="14" y="66" width="72" height="20" rx="10" fill={shade} />
          {[24, 38, 52, 66, 78].map((x) => (
            <circle key={x} cx={x} cy="76" r="5.4" fill={accent} stroke={shade} strokeWidth="1.4" />
          ))}
          <path d="M22 66 L30 48 L74 48 L82 66Z" fill={main} stroke={shade} strokeWidth="1.8" strokeLinejoin="round" />
          <rect x="38" y="32" width="26" height="16" rx="5" fill={main} stroke={shade} strokeWidth="1.8" />
          <path d="M64 38 L94 34" stroke={shade} strokeWidth="5" strokeLinecap="round" />
          <path d="M50 42 c-2.4-3.4-9-1.4-9 2.8 0 3.4 4.4 5.8 9 8.4 4.6-2.6 9-5 9-8.4 0-4.2-6.6-6.2-9-2.8Z" fill={accent} />
        </g>
      );
    case 'pet-corgi':
      return (
        <g>
          <ToyShadow />
          <ellipse cx="46" cy="66" rx="27" ry="17" fill={main} stroke={shade} strokeWidth="1.6" />
          <ellipse cx="40" cy="70" rx="12" ry="9" fill={accent} opacity=".85" />
          <path d="M24 82 L24 90 M64 82 L64 90" stroke={shade} strokeWidth="5" strokeLinecap="round" />
          <circle cx="74" cy="50" r="17" fill={main} stroke={shade} strokeWidth="1.6" />
          <path d="M63 40 L60 22 L72 32Z" fill={main} stroke={shade} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M82 38 L88 21 L90 36Z" fill={main} stroke={shade} strokeWidth="1.5" strokeLinejoin="round" />
          <ellipse cx="74" cy="56" rx="8" ry="6.4" fill={accent} />
          <circle cx="68" cy="47" r="2.3" fill="#241f36" />
          <circle cx="80" cy="47" r="2.3" fill="#241f36" />
          <circle cx="74" cy="54" r="2.4" fill="#241f36" />
          <path d="M18 60 Q8 56 12 46" stroke={shade} strokeWidth="4" fill="none" strokeLinecap="round" />
        </g>
      );
    case 'pet-cat':
      return (
        <g>
          <ToyShadow />
          <ellipse cx="50" cy="72" rx="20" ry="15" fill={main} stroke={shade} strokeWidth="1.6" />
          <path d="M68 74 Q88 70 84 52" stroke={shade} strokeWidth="4.6" fill="none" strokeLinecap="round" />
          <circle cx="50" cy="46" r="19" fill={main} stroke={shade} strokeWidth="1.6" />
          <path d="M36 34 L32 16 L46 27Z" fill={main} stroke={shade} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M64 34 L68 16 L54 27Z" fill={main} stroke={shade} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M38 31 L36 21 L43 27Z" fill={accent} />
          <path d="M62 31 L64 21 L57 27Z" fill={accent} />
          <circle cx="43" cy="45" r="2.5" fill="#241f36" />
          <circle cx="57" cy="45" r="2.5" fill="#241f36" />
          <path d="M47 52 Q50 54.6 53 52" stroke="#241f36" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <path d="M30 50 L40 51 M31 57 L40 55 M70 50 L60 51 M69 57 L60 55" stroke={shade} strokeWidth="1.4" strokeLinecap="round" />
        </g>
      );
    case 'pet-bunny':
      return (
        <g>
          <ToyShadow />
          <ellipse cx="38" cy="20" rx="6.4" ry="17" fill={main} stroke={shade} strokeWidth="1.5" transform="rotate(-9 38 20)" />
          <ellipse cx="60" cy="20" rx="6.4" ry="17" fill={main} stroke={shade} strokeWidth="1.5" transform="rotate(9 60 20)" />
          <ellipse cx="38" cy="21" rx="2.8" ry="11" fill={accent} transform="rotate(-9 38 21)" />
          <ellipse cx="60" cy="21" rx="2.8" ry="11" fill={accent} transform="rotate(9 60 21)" />
          <ellipse cx="50" cy="74" rx="21" ry="15" fill={main} stroke={shade} strokeWidth="1.6" />
          <circle cx="50" cy="48" r="17" fill={main} stroke={shade} strokeWidth="1.6" />
          <circle cx="44" cy="46" r="2.4" fill="#241f36" />
          <circle cx="56" cy="46" r="2.4" fill="#241f36" />
          <ellipse cx="50" cy="53" rx="3" ry="2.2" fill={accent} />
          <path d="M50 55 L50 58 M44 62 Q47 60 50 58 Q53 60 56 62" stroke="#241f36" strokeWidth="1.4" fill="none" strokeLinecap="round" />
          <circle cx="71" cy="78" r="6" fill={accent} stroke={shade} strokeWidth="1.2" />
        </g>
      );
    case 'pet-panda':
      return (
        <g>
          <ToyShadow />
          <circle cx="33" cy="26" r="9" fill={shade} />
          <circle cx="67" cy="26" r="9" fill={shade} />
          <ellipse cx="50" cy="74" rx="21" ry="16" fill={main} stroke={shade} strokeWidth="1.5" />
          <ellipse cx="50" cy="76" rx="11" ry="9" fill={accent} opacity=".55" />
          <circle cx="50" cy="44" r="20" fill={main} stroke={shade} strokeWidth="1.5" />
          <ellipse cx="42" cy="42" rx="4.6" ry="6" fill={shade} transform="rotate(-18 42 42)" />
          <ellipse cx="58" cy="42" rx="4.6" ry="6" fill={shade} transform="rotate(18 58 42)" />
          <circle cx="42.6" cy="41" r="1.9" fill="#fff" />
          <circle cx="57.4" cy="41" r="1.9" fill="#fff" />
          <ellipse cx="50" cy="50" rx="3.2" ry="2.3" fill={shade} />
          <path d="M45 57 Q50 60 55 57" stroke={shade} strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </g>
      );
    case 'pet-hamster': {
      return (
        <g>
          <ToyShadow />
          <ellipse cx="50" cy="68" rx="27" ry="21" fill={main} stroke={shade} strokeWidth="1.6" />
          <circle cx="31" cy="42" r="8" fill={main} stroke={shade} strokeWidth="1.4" />
          <circle cx="69" cy="42" r="8" fill={main} stroke={shade} strokeWidth="1.4" />
          <circle cx="31" cy="42" r="3.6" fill={accent} />
          <circle cx="69" cy="42" r="3.6" fill={accent} />
          <circle cx="50" cy="52" r="19" fill={main} stroke={shade} strokeWidth="1.5" />
          <ellipse cx="36" cy="62" rx="8.6" ry="7" fill={accent} opacity=".9" />
          <ellipse cx="64" cy="62" rx="8.6" ry="7" fill={accent} opacity=".9" />
          <circle cx="43" cy="50" r="2.5" fill="#241f36" />
          <circle cx="57" cy="50" r="2.5" fill="#241f36" />
          <ellipse cx="50" cy="57" rx="3.2" ry="2.4" fill={shade} />
          <path d="M46 66 Q50 63 54 66" stroke={shade} strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <ellipse cx="50" cy="72" rx="4.4" ry="3.2" fill={accent} stroke={shade} strokeWidth="1.1" />
          <path d="M50 69 L50 75 M47 71 L53 71" stroke={shade} strokeWidth="1" opacity=".7" />
        </g>
      );
    }
    case 'pet-chihuahua': {
      return (
        <g>
          <ToyShadow />
          <ellipse cx="48" cy="72" rx="18" ry="13" fill={main} stroke={shade} strokeWidth="1.5" />
          <path d="M34 82 L34 89 M62 82 L62 89" stroke={shade} strokeWidth="4" strokeLinecap="round" />
          <path d="M31 62 Q20 52 26 42" stroke={shade} strokeWidth="3.6" fill="none" strokeLinecap="round" />
          <circle cx="66" cy="52" r="16" fill={main} stroke={shade} strokeWidth="1.5" />
          <path d="M55 42 L48 18 L62 32Z" fill={main} stroke={shade} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M76 40 L82 16 L86 36Z" fill={main} stroke={shade} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M55 36 L52 24 L59 32Z" fill={accent} />
          <path d="M78 34 L82 22 L83 34Z" fill={accent} />
          <circle cx="60" cy="50" r="3" fill="#241f36" />
          <circle cx="73" cy="50" r="3" fill="#241f36" />
          <ellipse cx="66" cy="60" rx="6.6" ry="5" fill={accent} />
          <circle cx="66" cy="58" r="2.2" fill="#241f36" />
        </g>
      );
    }
    case 'pet-poodle': {
      const puffs: [number, number, number][] = [
        [38, 30, 8], [50, 24, 9], [62, 30, 8], [44, 34, 7], [57, 35, 7],
        [30, 66, 9], [70, 66, 9], [50, 88, 10],
      ];
      return (
        <g>
          <ToyShadow />
          <ellipse cx="50" cy="70" rx="21" ry="16" fill={main} stroke={shade} strokeWidth="1.5" />
          <path d="M68 66 Q86 58 82 44" stroke={shade} strokeWidth="3.6" fill="none" strokeLinecap="round" />
          <circle cx="82" cy="42" r="6.4" fill={main} stroke={shade} strokeWidth="1.3" />
          <circle cx="50" cy="46" r="16" fill={main} stroke={shade} strokeWidth="1.5" />
          {puffs.map(([cx, cy, r], i) => (
            <circle key={i} cx={cx} cy={cy} r={r} fill={main} stroke={shade} strokeWidth="1.1" />
          ))}
          <ellipse cx="50" cy="52" rx="7" ry="5.4" fill={accent} opacity=".55" />
          <circle cx="44" cy="46" r="2.3" fill="#241f36" />
          <circle cx="56" cy="46" r="2.3" fill="#241f36" />
          <circle cx="50" cy="51" r="2.2" fill="#241f36" />
          <path d="M38 82 L38 89 M62 82 L62 89" stroke={shade} strokeWidth="4.4" strokeLinecap="round" />
          <path d="M41 62 Q50 68 59 62" stroke={accent} strokeWidth="2.6" fill="none" strokeLinecap="round" />
        </g>
      );
    }
    case 'pet-elephant': {
      return (
        <g>
          <ToyShadow />
          <ellipse cx="46" cy="64" rx="29" ry="22" fill={main} stroke={shade} strokeWidth="1.7" />
          <path d="M24 84 L24 91 M40 86 L40 92 M58 86 L58 92 M70 82 L70 89" stroke={shade} strokeWidth="5" strokeLinecap="round" />
          <path d="M74 56 Q88 62 84 76" stroke={shade} strokeWidth="3.6" fill="none" strokeLinecap="round" />
          <circle cx="72" cy="46" r="19" fill={main} stroke={shade} strokeWidth="1.7" />
          <ellipse cx="60" cy="46" rx="10" ry="13" fill={accent} opacity=".75" stroke={shade} strokeWidth="1.2" />
          <path d="M84 52 Q94 66 86 80 Q82 86 78 80 Q84 68 80 56Z" fill={main} stroke={shade} strokeWidth="1.5" />
          <circle cx="74" cy="42" r="2.6" fill="#241f36" />
          <path d="M84 78 Q88 82 92 79" stroke={accent} strokeWidth="2.2" fill="none" strokeLinecap="round" />
          <path d="M56 30 Q66 24 76 28" stroke={shade} strokeWidth="1.6" fill="none" opacity=".6" strokeLinecap="round" />
        </g>
      );
    }
    case 'pet-cat-siamese': {
      return (
        <g>
          <ToyShadow />
          <ellipse cx="50" cy="72" rx="20" ry="15" fill={main} stroke={shade} strokeWidth="1.6" />
          <path d="M68 74 Q90 72 88 50" stroke={shade} strokeWidth="4.6" fill="none" strokeLinecap="round" />
          <path d="M36 84 L34 89 M64 84 L66 89" stroke={shade} strokeWidth="4.4" strokeLinecap="round" />
          <circle cx="50" cy="46" r="19" fill={main} stroke={shade} strokeWidth="1.6" />
          <path d="M36 34 L32 15 L47 26Z" fill={shade} />
          <path d="M64 34 L68 15 L53 26Z" fill={shade} />
          <ellipse cx="50" cy="53" rx="8" ry="6.6" fill={shade} />
          <circle cx="42" cy="43" r="2.9" fill={accent} stroke="#241f36" strokeWidth=".8" />
          <circle cx="58" cy="43" r="2.9" fill={accent} stroke="#241f36" strokeWidth=".8" />
          <circle cx="50" cy="50" r="2" fill="#1f1420" />
          <path d="M46 58 Q50 60 54 58" stroke="#1f1420" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        </g>
      );
    }
    case 'pet-cat-scottish': {
      return (
        <g>
          <ToyShadow />
          <ellipse cx="50" cy="73" rx="21" ry="15" fill={main} stroke={shade} strokeWidth="1.6" />
          <path d="M69 75 Q87 74 84 56" stroke={shade} strokeWidth="4.4" fill="none" strokeLinecap="round" />
          <circle cx="50" cy="47" r="20" fill={main} stroke={shade} strokeWidth="1.6" />
          <path d="M33 36 Q28 28 36 27 Q42 30 39 38Z" fill={main} stroke={shade} strokeWidth="1.4" />
          <path d="M67 36 Q72 28 64 27 Q58 30 61 38Z" fill={main} stroke={shade} strokeWidth="1.4" />
          <ellipse cx="41" cy="58" rx="5.4" ry="4" fill={accent} opacity=".45" />
          <ellipse cx="59" cy="58" rx="5.4" ry="4" fill={accent} opacity=".45" />
          <circle cx="42" cy="46" r="3" fill={accent} stroke="#241f36" strokeWidth=".9" />
          <circle cx="58" cy="46" r="3" fill={accent} stroke="#241f36" strokeWidth=".9" />
          <circle cx="42" cy="46" r="1.3" fill="#241f36" />
          <circle cx="58" cy="46" r="1.3" fill="#241f36" />
          <ellipse cx="50" cy="53" rx="2.6" ry="2" fill={shade} />
          <path d="M45 59 Q50 62 55 59" stroke="#241f36" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </g>
      );
    }
    case 'pet-cat-british': {
      return (
        <g>
          <ToyShadow />
          <ellipse cx="50" cy="73" rx="22" ry="16" fill={main} stroke={shade} strokeWidth="1.6" />
          <path d="M70 76 Q88 74 85 58" stroke={shade} strokeWidth="4.6" fill="none" strokeLinecap="round" />
          <circle cx="50" cy="47" r="21" fill={main} stroke={shade} strokeWidth="1.6" />
          <path d="M34 33 L31 17 L45 27Z" fill={main} stroke={shade} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M66 33 L69 17 L55 27Z" fill={main} stroke={shade} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M37 30 L35 21 L42 26Z" fill={accent} opacity=".8" />
          <path d="M63 30 L65 21 L58 26Z" fill={accent} opacity=".8" />
          <ellipse cx="39" cy="56" rx="6" ry="4.4" fill={accent} opacity=".35" />
          <ellipse cx="61" cy="56" rx="6" ry="4.4" fill={accent} opacity=".35" />
          <circle cx="42" cy="45" r="3.1" fill={accent} stroke="#241f36" strokeWidth=".9" />
          <circle cx="58" cy="45" r="3.1" fill={accent} stroke="#241f36" strokeWidth=".9" />
          <circle cx="42" cy="45" r="1.4" fill="#241f36" />
          <circle cx="58" cy="45" r="1.4" fill="#241f36" />
          <ellipse cx="50" cy="53" rx="2.7" ry="2.1" fill={shade} />
          <path d="M44 60 Q50 63 56 60" stroke="#241f36" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </g>
      );
    }
    case 'pet-cat-sphynx': {
      return (
        <g>
          <ToyShadow />
          <ellipse cx="50" cy="73" rx="18" ry="14" fill={main} stroke={shade} strokeWidth="1.6" />
          <path d="M66 72 Q90 66 88 44" stroke={shade} strokeWidth="3.6" fill="none" strokeLinecap="round" />
          <circle cx="50" cy="47" r="17" fill={main} stroke={shade} strokeWidth="1.6" />
          <path d="M38 36 L28 10 L46 25Z" fill={main} stroke={shade} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M62 36 L72 10 L54 25Z" fill={main} stroke={shade} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M38 31 L33 17 L43 26Z" fill={accent} opacity=".65" />
          <path d="M62 31 L67 17 L57 26Z" fill={accent} opacity=".65" />
          <path d="M38 42 Q42 40 46 42 M54 42 Q58 40 62 42 M40 62 Q50 66 60 62" stroke={shade} strokeWidth="1.2" fill="none" opacity=".75" strokeLinecap="round" />
          <ellipse cx="41" cy="48" rx="3.4" ry="2.6" fill={accent} stroke="#241f36" strokeWidth=".8" transform="rotate(-14 41 48)" />
          <ellipse cx="59" cy="48" rx="3.4" ry="2.6" fill={accent} stroke="#241f36" strokeWidth=".8" transform="rotate(14 59 48)" />
          <ellipse cx="50" cy="55" rx="2.5" ry="1.9" fill={shade} />
          <path d="M34 84 L33 89 M66 84 L67 89" stroke={shade} strokeWidth="3.8" strokeLinecap="round" />
        </g>
      );
    }
    case 'pet-cat-mainecoon': {
      const mane: [number, number, number][] = [
        [32, 34, 8], [38, 24, 9], [50, 20, 9], [62, 24, 9], [68, 34, 8],
        [30, 46, 8], [70, 46, 8], [36, 58, 7], [64, 58, 7],
      ];
      return (
        <g>
          <ToyShadow />
          <ellipse cx="50" cy="74" rx="23" ry="16" fill={main} stroke={shade} strokeWidth="1.6" />
          <path d="M70 72 Q92 62 86 40 Q98 62 84 78 Q76 84 68 80Z" fill={main} stroke={shade} strokeWidth="1.5" />
          <path d="M78 52 L90 50 M76 62 L89 62 M74 71 L86 74" stroke={shade} strokeWidth="1.6" strokeLinecap="round" opacity=".7" />
          {mane.map(([cx, cy, r], i) => (
            <circle key={i} cx={cx} cy={cy} r={r} fill={main} stroke={shade} strokeWidth="1" />
          ))}
          <circle cx="50" cy="44" r="16" fill={main} stroke={shade} strokeWidth="1.4" />
          <path d="M37 31 L30 12 L44 23Z" fill={main} stroke={shade} strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M63 31 L70 12 L56 23Z" fill={main} stroke={shade} strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M34 16 L31 6 M66 16 L69 6" stroke={shade} strokeWidth="2" strokeLinecap="round" />
          <ellipse cx="50" cy="52" rx="7.4" ry="5.6" fill={accent} opacity=".8" />
          <circle cx="43" cy="43" r="2.5" fill="#241f36" />
          <circle cx="57" cy="43" r="2.5" fill="#241f36" />
          <circle cx="50" cy="50" r="2.2" fill={shade} />
          <path d="M45 57 Q50 60 55 57" stroke="#241f36" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </g>
      );
    }
    case 'sport-ball':
      return (
        <g>
          <ToyShadow />
          <circle cx="50" cy="54" r="36" fill={main} stroke={shade} strokeWidth="2" />
          <polygon points="50,38 65,49 59,66 41,66 35,49" fill={shade} />
          <path d="M50 38 L50 20 M65 49 L82 42 M59 66 L66 84 M41 66 L34 84 M35 49 L18 42" stroke={shade} strokeWidth="2" />
          <path d="M22 74 Q30 62 35 66 M78 74 Q70 62 65 66 M28 28 Q38 34 41 38 M72 28 Q62 34 59 38" stroke={shade} strokeWidth="4" fill="none" opacity=".8" />
          <circle cx="50" cy="54" r="36" fill="none" stroke={accent} strokeWidth="1.4" strokeDasharray="4 6" opacity=".8" />
        </g>
      );
    case 'sport-skate':
      return (
        <g>
          <ToyShadow />
          <g transform="rotate(-8 50 56)">
            <rect x="12" y="48" width="76" height="11" rx="5.5" fill={main} stroke={shade} strokeWidth="1.8" />
            <path d="M20 53.5 H80" stroke={accent} strokeWidth="3" strokeLinecap="round" />
            <path d="M30 59 L30 66 M70 59 L70 66" stroke={shade} strokeWidth="3.4" />
            <circle cx="30" cy="72" r="7" fill={accent} stroke={shade} strokeWidth="1.6" />
            <circle cx="70" cy="72" r="7" fill={accent} stroke={shade} strokeWidth="1.6" />
            <circle cx="30" cy="72" r="2.4" fill={shade} />
            <circle cx="70" cy="72" r="2.4" fill={shade} />
          </g>
          <polygon points="76,22 78.4,28 84.6,28.4 79.8,32.2 81.4,38.2 76,34.8 70.6,38.2 72.2,32.2 67.4,28.4 73.6,28" fill={accent} />
        </g>
      );
    case 'sport-dumbbell':
      return (
        <g>
          <ToyShadow />
          <g transform="rotate(-16 50 52)">
            <rect x="30" y="47" width="40" height="9" rx="4.5" fill={shade} />
            <rect x="14" y="32" width="11" height="39" rx="4" fill={main} stroke={shade} strokeWidth="1.6" />
            <rect x="25" y="38" width="8" height="27" rx="3.4" fill={main} stroke={shade} strokeWidth="1.4" />
            <rect x="75" y="32" width="11" height="39" rx="4" fill={main} stroke={shade} strokeWidth="1.6" />
            <rect x="67" y="38" width="8" height="27" rx="3.4" fill={main} stroke={shade} strokeWidth="1.4" />
            <path d="M18 38 H22 M79 38 H83" stroke={accent} strokeWidth="3" strokeLinecap="round" />
          </g>
          <path d="M24 84 Q50 76 76 84" stroke={accent} strokeWidth="2.4" fill="none" strokeLinecap="round" opacity=".8" />
        </g>
      );
    case 'sport-racket':
      return (
        <g>
          <ToyShadow />
          <g transform="rotate(18 46 44)">
            <ellipse cx="46" cy="40" rx="27" ry="31" fill={accent} fillOpacity=".22" stroke={main} strokeWidth="4.4" />
            <path d="M28 22 Q46 40 64 22 M24 36 Q46 54 68 36 M26 54 Q46 70 66 54 M36 14 Q42 40 38 68 M50 12 Q48 42 52 68 M60 16 Q54 42 58 66" stroke={shade} strokeWidth="1.1" opacity=".65" fill="none" />
            <path d="M40 69 L34 88 M52 69 L58 88" stroke={main} strokeWidth="4" strokeLinecap="round" />
            <rect x="38" y="86" width="16" height="7" rx="3.4" fill={shade} transform="rotate(90 46 89)" />
          </g>
          <circle cx="78" cy="74" r="10" fill={accent} stroke={shade} strokeWidth="1.4" />
          <path d="M71 68 Q78 74 85 80 M85 68 Q78 74 71 80" stroke={shade} strokeWidth="1.2" fill="none" opacity=".7" />
        </g>
      );
    case 'food-icecream':
      return (
        <g>
          <ToyShadow />
          <path d="M36 52 L64 52 L50 90Z" fill={accent} stroke={shade} strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M41 60 L56 74 M59 60 L44 74" stroke={shade} strokeWidth="1.3" opacity=".65" />
          <circle cx="38" cy="42" r="12" fill={main} stroke={shade} strokeWidth="1.5" />
          <circle cx="56" cy="36" r="13" fill={accent} stroke={shade} strokeWidth="1.5" />
          <circle cx="62" cy="48" r="11" fill={main} stroke={shade} strokeWidth="1.5" opacity=".92" />
          <circle cx="56" cy="24" r="3.4" fill={shade} />
          <path d="M34 38 Q36 34 40 33 M52 30 Q55 27 58 27" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" opacity=".8" />
        </g>
      );
    case 'food-donut':
      return (
        <g>
          <ToyShadow />
          <circle cx="50" cy="54" r="35" fill={accent} stroke={shade} strokeWidth="2" />
          <path d="M50 22 a32 32 0 0 1 30 22 c-6 3-9-2-15 1 c-7 3-8-4-15-3 c-8 1-9 6-16 4 c-6-2-9 2-14-2 a32 32 0 0 1 30-22Z" fill={main} stroke={shade} strokeWidth="1.5" />
          <circle cx="50" cy="54" r="11.5" fill="#fffaf2" stroke={shade} strokeWidth="2" />
          <g strokeWidth="2.6" strokeLinecap="round">
            <path d="M34 34 l5 3" stroke="#38bdf8" />
            <path d="M62 30 l5 3" stroke="#fde047" />
            <path d="M72 50 l6 1" stroke="#34d399" />
            <path d="M30 58 l6-2" stroke="#fde047" />
            <path d="M44 76 l5-3" stroke="#38bdf8" />
            <path d="M64 72 l4-4" stroke="#fb7185" />
          </g>
        </g>
      );
    case 'food-kulich':
      return (
        <g>
          <ToyShadow />
          <path d="M32 42 L68 42 L64 88 L36 88Z" fill={main} stroke={shade} strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M32 50 Q50 58 68 50 L68 42 L32 42Z" fill={accent} />
          <path d="M30 40 Q32 24 50 24 Q68 24 70 40 Q60 34 50 40 Q40 34 30 40Z" fill={accent} stroke={shade} strokeWidth="1.5" />
          <g strokeWidth="2.4" strokeLinecap="round">
            <path d="M42 30 l4 2" stroke="#f43f5e" />
            <path d="M55 28 l4 2" stroke="#38bdf8" />
            <path d="M48 34 l4 2" stroke="#f59e0b" />
            <path d="M60 36 l4 1" stroke="#34d399" />
          </g>
          <path d="M38 66 H62 M39 76 H61" stroke={shade} strokeWidth="1.6" opacity=".55" strokeLinecap="round" />
        </g>
      );
    case 'food-cake':
      return (
        <g>
          <ToyShadow />
          <rect x="22" y="72" width="56" height="16" rx="4" fill={main} stroke={shade} strokeWidth="1.6" />
          <rect x="29" y="57" width="42" height="15" rx="4" fill={accent} stroke={shade} strokeWidth="1.5" />
          <rect x="36" y="43" width="28" height="14" rx="4" fill={main} stroke={shade} strokeWidth="1.5" />
          <path d="M22 76 Q30 70 38 76 T54 76 T70 76 T78 76" stroke={accent} strokeWidth="2.2" fill="none" opacity=".85" />
          {[42, 50, 58].map((x) => (
            <g key={x}>
              <rect x={x - 1.4} y="27" width="2.8" height="13" rx="1.4" fill={accent} stroke={shade} strokeWidth=".7" />
              <ellipse cx={x} cy="23" rx="2.6" ry="4" fill="#fbbf24" stroke="#f59e0b" strokeWidth=".8" />
            </g>
          ))}
          <circle cx="50" cy="40" r="3.4" fill={shade} />
        </g>
      );
    default:
      return null;
  }
}

function ToyGlyph({ id, colors }: { id: string; colors: Colors }) {
  const item = ITEM_BY_ID[id];
  if (!item || item.kind !== 'toy') return null;
  if (item.toy === 'ship') return <Ship id={id} colors={colors} />;
  // 0.72.0: розовый танк, питомцы, спорт и вкусняшки — векторные рисунки выше.
  if (item.toy === 'pet' || item.toy === 'sport' || item.toy === 'food' || id === 'car-pink-tank') {
    return <Glyph id={id} colors={colors} />;
  }
  return null;
}

/**
 * Товарная картинка техники для витрины, sheet и гардероба.
 *
 * Машины — растровый цветной карандашный рисунок реальной модели (`CarArt`):
 * размер и посадку на подиум задаёт контекст через CSS, как раньше делал
 * `size` у квадратного SVG. Электроника использует WebP; у телефонов
 * доступны две стороны и анимация поворота. SVG оставлен как запасной вид судна.
 * `colors[0]` у машины — цвет «цветного карандаша» поверх готового рисунка.
 */
export function ToyArt({
  id,
  colors,
  size = 84,
  className,
  tuning,
  interactive = false,
  alt,
}: {
  id: string;
  colors?: Colors | null;
  size?: number;
  className?: string;
  /** Тюнинг профиля: у машин — цветной карандаш, у телефонов/кораблей — палитра */
  tuning?: ShopTuning;
  /** Enable phone rotation only in non-button containers. */
  interactive?: boolean;
  /**
   * Подпись рисунка для подробного просмотра. На витрине и в гардеробе
   * карточка уже названа, поэтому по умолчанию рисунок декоративный.
   */
  alt?: string;
}) {
  // 0.76.0: у товара есть студийное фото — показываем его. Фото уже со
  // своим светом и тенью, поэтому перекраска (tuning) к нему не применяется.
  if (hasProductPhoto(id)) {
    return <ProductPhoto key={id} id={id} alt={alt} className={className} />;
  }
  if (hasAirplaneArt(id)) {
    return <AirplaneArt key={id} id={id} size={size} className={className} alt={alt} colors={accessoryColors(id, tuning)} />;
  }
  if (hasElectronicsArt(id)) {
    return <ElectronicsArt key={id} id={id} className={className} alt={alt} />;
  }
  if (hasCarArt(id)) {
    return <CarArt id={id} tint={artPencilTint(id, tuning)} className={className} alt={alt ?? ''} interactive={interactive} />;
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

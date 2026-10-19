import { ITEM_BY_ID } from '../engine/shop';
import { TINT_PALETTES } from '../engine/tints';
import { CarBody, hasCarArt } from './CarArt';

/**
 * Техника БУКа: авто, телефоны и корабли. Машины с 0.20.0 живут в CarArt.tsx —
 * здесь остаются телефоны, корабли и общий запасной силуэт машины.
 *
 * Рисуем их тем же способом, что наряды и костюмы — чистым SVG в сетке
 * 100×100 без картинок-файлов: ноль веса, работает офлайн, перекрашивается
 * тюнингом. Три цвета деталей приходят из палитры (`engine/tints.ts`):
 * [корпус, тень/стекло, акцент]. На витрине вещь показывается отдельно —
 * как товар на полке, а не надетая на сову.
 */

type Colors = [string, string, string];

function colorsFor(id: string, colors?: Colors | null): Colors {
  return colors ?? TINT_PALETTES[id]?.base.colors ?? ['#3b82f6', '#1f2937', '#ffd166'];
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

/** Машины. */
function Car({ id, colors }: { id: string; colors: Colors }) {
  const [main, deep, accent] = colors;

  if (id === 'car-racer') {
    return (
      <g>
        <ToyShadow />
        <rect x="7" y="46" width="20" height="4.5" rx="2" fill={accent} />
        <rect x="12" y="49" width="3.5" height="8" rx="1.5" fill={deep} />
        <rect x="22" y="48" width="3.5" height="7" rx="1.5" fill={deep} />
        <path
          d="M7 76 L8 61 Q9 54 21 52 L33 49 L40 37 Q44 31 54 31 L62 31 Q72 32 77 44 L90 50 Q96 53 95 63 L94 76 Z"
          fill={main}
          stroke="#241f36"
          strokeOpacity=".22"
          strokeWidth="2"
        />
        <path d="M42 47 L46 38 Q49 35 54 35 L56 35 L56 47 Z" fill={deep} />
        <path d="M60 35 L62 35 Q68 36 71 43 L72.5 47 L60 47 Z" fill={deep} />
        <path d="M8 63 L94 63 L94 68 L8 68Z" fill={accent} opacity=".9" />
        <circle cx="50" cy="65.5" r="5" fill={deep} />
        <path d="M48 62.5 L52 62.5 L52 68.5 L48 68.5 Z" fill={accent} opacity=".8" />
        <rect x="88" y="55" width="5" height="6" rx="2" fill="#fff7c2" />
        <rect x="8" y="55" width="3" height="6" rx="1.5" fill="#ff8a8a" />
        <circle cx="27" cy="76" r="13" fill={deep} />
        <circle cx="27" cy="76" r="6" fill={accent} />
        <circle cx="27" cy="76" r="2.4" fill="#ffffff" opacity=".85" />
        <circle cx="73" cy="76" r="13" fill={deep} />
        <circle cx="73" cy="76" r="6" fill={accent} />
        <circle cx="73" cy="76" r="2.4" fill="#ffffff" opacity=".85" />
      </g>
    );
  }

  if (id === 'car-jeep') {
    return (
      <g>
        <ToyShadow />
        <path d="M34 19 L78 19" stroke={deep} strokeWidth="3" strokeLinecap="round" opacity=".75" />
        <path d="M40 19 L40 24 M72 19 L72 24" stroke={deep} strokeWidth="2.4" strokeLinecap="round" opacity=".75" />
        <path
          d="M10 74 L10 48 Q10 41 19 40 L28 40 L34 27 Q37 22 45 22 L64 22 Q72 22 76 30 L82 41 L88 44 Q93 47 93 53 L93 74 Z"
          fill={main}
          stroke="#241f36"
          strokeOpacity=".22"
          strokeWidth="2"
        />
        <rect x="38" y="28" width="14" height="12" rx="2" fill={deep} />
        <rect x="55" y="28" width="14" height="12" rx="2" fill={deep} />
        <rect x="13" y="58" width="18" height="9" rx="2" fill={accent} opacity=".75" />
        <rect x="12" y="46" width="7" height="4" rx="2" fill="#fff7c2" />
        <circle cx="88" cy="55" r="8" fill={deep} stroke="#241f36" strokeOpacity=".22" strokeWidth="2" />
        <circle cx="88" cy="55" r="3.4" fill={accent} />
        <rect x="8" y="67" width="84" height="5" rx="2.5" fill={deep} opacity=".45" />
        <circle cx="28" cy="75" r="15" fill={deep} />
        <circle cx="28" cy="75" r="7" fill={accent} />
        <circle cx="28" cy="75" r="2.8" fill="#ffffff" opacity=".85" />
        <circle cx="73" cy="75" r="15" fill={deep} />
        <circle cx="73" cy="75" r="7" fill={accent} />
        <circle cx="73" cy="75" r="2.8" fill="#ffffff" opacity=".85" />
      </g>
    );
  }

  // Такси: жёлтый кузов, шашечки и фонарик на крыше.
  const checkers = Array.from({ length: 9 }, (_, i) => (
    <rect
      key={i}
      x={20 + i * 7}
      y={i % 2 === 0 ? 56 : 62}
      width="7"
      height="5"
      rx="1"
      fill={i % 2 === 0 ? '#ffffff' : accent}
      opacity=".9"
    />
  ));
  return (
    <g>
      <ToyShadow />
      <path
        d="M8 74 L8 61 Q9 55 20 53 L34 50 L41 39 Q45 35 54 35 L64 35 Q71 36 77 45 L88 51 Q94 54 94 62 L94 74 Z"
        fill={main}
        stroke="#241f36"
        strokeOpacity=".22"
        strokeWidth="2"
      />
      <path d="M43 48 L48 39 Q51 37 56 37 L63 37 Q69 38 72 46 L73 48Z" fill={deep} />
      <rect x="43" y="26" width="14" height="8" rx="3" fill={accent} />
      <rect x="47" y="28" width="6" height="4" rx="1" fill={main} opacity=".8" />
      {checkers}
      <rect x="88" y="55" width="5" height="6" rx="2" fill="#fff7c2" />
      <rect x="8" y="55" width="3" height="6" rx="1.5" fill="#ff8a8a" />
      <circle cx="27" cy="75" r="13" fill={deep} />
      <circle cx="27" cy="75" r="6" fill="#ffffff" opacity=".85" />
      <circle cx="73" cy="75" r="13" fill={deep} />
      <circle cx="73" cy="75" r="6" fill="#ffffff" opacity=".85" />
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
  // 0.20.0: у каждой машины свой подробный рисунок (ui/CarArt.tsx). Старый
  // общий Car остаётся запасным — если у вещи арта ещё нет, витрина не пустует.
  if (item.toy === 'car') return hasCarArt(id) ? <CarBody id={id} colors={colors} /> : <Car id={id} colors={colors} />;
  if (item.toy === 'ship') return <Ship id={id} colors={colors} />;
  return null;
}

/** Товарная картинка техники для витрины, sheet и гардероба. */
export function ToyArt({
  id,
  colors,
  size = 84,
  className,
}: {
  id: string;
  colors?: Colors | null;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <ToyGlyph id={id} colors={colorsFor(id, colors)} />
    </svg>
  );
}

/**
 * Техника рядом с БУКом: телефон — в правом крыле, машина — у правой лапки,
 * корабль — у левой. Координаты подобраны под viewBox совы 100×120.
 */
export function MascotToy({ id, colors }: { id: string; colors?: Colors | null }) {
  const item = ITEM_BY_ID[id];
  if (!item || item.kind !== 'toy') return null;
  const palette = colorsFor(id, colors);
  const transform =
    item.toy === 'phone'
      ? 'translate(70 61) scale(0.27)'
      : item.toy === 'car'
        ? 'translate(63 90) scale(0.3)'
        : 'translate(3 90) scale(0.3)';
  return (
    <g transform={transform}>
      {item.toy === 'car' && hasCarArt(id) ? <CarBody id={id} colors={palette} /> : <ToyGlyph id={id} colors={palette} />}
    </g>
  );
}

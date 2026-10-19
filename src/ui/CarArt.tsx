import type { ReactNode } from 'react';

/**
 * Автомобили мечты (0.20.0): BMW, Brabus, Mercedes, Lamborghini, Rolls-Royce,
 * Maybach и Bugatti.
 *
 * Рисунок — ручной SVG в сетке 100×100, как и остальная техника БУКа
 * (`ui/ToyArt.tsx`), но с настоящей проработкой: кузов с вырезанными колёсными
 * арками (маска, поэтому крыло накрывает шину, а не наоборот), кабина с
 * толстыми стойками и остеклением с бликами, фары и фонари с внутренними
 * секциями, решётки с ламелями, фирменные детали марки, диски с тормозными
 * дисками и суппортами, тени и блики лака.
 *
 * Пропорции седанов взяты автомобильные: капот ≈ 30 % длины, кабина ≈ 30 %,
 * багажник ≈ 30 %, колёса — по краям базы. Поэтому машина читается седаном,
 * а не пикапом: раньше кабина стояла слишком далеко вперёд.
 *
 * Цвета приходят из палитры тюнинга (`engine/tints.ts`):
 * [кузов, тень/стекло, хром/акцент]; всё остальное — фиксированные цвета
 * металла, резины и стёкол, чтобы тюнинг не «перекрашивал» машину целиком.
 *
 * Идентификаторы градиентов и масок уникальны для вещи (`car-bmw-ch` и т. п.):
 * арт может стоять на витрине, в гардеробе и рядом с БУКом одновременно.
 */

export type CarColors = [string, string, string];

/** Общие градиенты кузова: хром, стекло, лак, вторая краска. */
function Defs({ uid, deep, accent, paint2 }: { uid: string; deep: string; accent: string; paint2?: string }) {
  return (
    <defs>
      <linearGradient id={`${uid}-ch`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset=".34" stopColor={accent} />
        <stop offset=".7" stopColor={accent} />
        <stop offset="1" stopColor="#6b7789" />
      </linearGradient>
      {/* Диск — всегда сталь: цвет отделки кузова не должен красить спицы. */}
      <linearGradient id={`${uid}-chx`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#7c899c" />
        <stop offset=".34" stopColor="#ffffff" />
        <stop offset=".64" stopColor="#c3ccda" />
        <stop offset="1" stopColor="#6b7789" />
      </linearGradient>
      {/* Хром окантовки: светлый, но не белый сверху — иначе крыша «седеет». */}
      <linearGradient id={`${uid}-cht`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#b9c3d1" />
        <stop offset=".3" stopColor="#f1f5f9" />
        <stop offset=".62" stopColor="#aab5c4" />
        <stop offset="1" stopColor="#7d8898" />
      </linearGradient>
      <linearGradient id={`${uid}-gl`} x1=".08" y1="0" x2=".78" y2="1">
        <stop offset="0" stopColor={deep} />
        <stop offset=".42" stopColor={deep} />
        <stop offset="1" stopColor="#04060b" />
      </linearGradient>
      <linearGradient id={`${uid}-bd`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity=".46" />
        <stop offset=".18" stopColor="#ffffff" stopOpacity=".08" />
        <stop offset=".4" stopColor="#ffffff" stopOpacity="0" />
        <stop offset=".76" stopColor="#000000" stopOpacity=".12" />
        <stop offset="1" stopColor="#000000" stopOpacity=".36" />
      </linearGradient>
      {paint2 && (
        <linearGradient id={`${uid}-p2`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".5" />
          <stop offset=".26" stopColor="#ffffff" stopOpacity=".06" />
          <stop offset=".8" stopColor="#000000" stopOpacity=".06" />
          <stop offset="1" stopColor="#000000" stopOpacity=".2" />
        </linearGradient>
      )}
    </defs>
  );
}

/**
 * Маска кузова: белый силуэт минус колёсные арки. Без неё колесо рисовалось бы
 * поверх крыла и машина выглядела бы «наклеенной»; с маской крыло накрывает
 * верх шины, как на настоящем автомобиле.
 */
function BodyMask({ uid, body, arches }: { uid: string; body: string; arches: { cx: number; cy: number; r: number }[] }) {
  return (
    <mask id={`${uid}-m`} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
      <path d={body} fill="#ffffff" />
      {arches.map((a, i) => (
        <circle key={i} cx={a.cx} cy={a.cy} r={a.r} fill="#000000" />
      ))}
    </mask>
  );
}

/** Тень под машиной: контакт с полкой, а не полёт. */
function Ground({ y = 91.9 }: { y?: number }) {
  return (
    <g>
      <ellipse cx="50" cy={y} rx="43" ry="3.1" fill="#241f36" opacity=".18" />
      <ellipse cx="50" cy={y} rx="28" ry="2" fill="#241f36" opacity=".13" />
    </g>
  );
}

type SpokeStyle = 'twin' | 'turbine' | 'mesh' | 'star' | 'y' | 'solid';

/**
 * Колесо: шина, обод, тормозной диск, суппорт и рисунок диска.
 * Радиус `r` — внешний радиус шины, центр `cy` — ось.
 */
function Wheel({
  uid,
  cx,
  cy,
  r,
  accent,
  spokes = 10,
  spokeW = 1.1,
  style = 'twin',
  caliper = '#dc2626',
  cap,
  label,
  whitewall = false,
}: {
  uid: string;
  cx: number;
  cy: number;
  r: number;
  accent: string;
  spokes?: number;
  spokeW?: number;
  style?: SpokeStyle;
  caliper?: string;
  cap?: string;
  label?: string;
  /** Белая боковина шины — парадный почерк старых лимузинов. */
  whitewall?: boolean;
}) {
  const rim = r - 1.55;
  const parts: ReactNode[] = [];
  parts.push(<circle key="t" cx={cx} cy={cy} r={r} fill="#11141c" stroke="#05070b" strokeWidth=".85" />);
  parts.push(<circle key="t2" cx={cx} cy={cy} r={r - 1.05} fill="none" stroke="#39404f" strokeWidth=".75" opacity=".9" />);
  parts.push(<circle key="t3" cx={cx} cy={cy} r={r - 1.75} fill="#1a1e28" />);
  if (whitewall) {
    parts.push(<circle key="ww" cx={cx} cy={cy} r={r - 1.25} fill="none" stroke="#e8edf4" strokeWidth=".75" opacity=".92" />);
    parts.push(<circle key="ww2" cx={cx} cy={cy} r={r - 2.35} fill="none" stroke="#cbd5e1" strokeWidth=".28" opacity=".7" />);
  }
  // Протектор: короткие насечки по краю шины
  for (let i = 0; i < 16; i++) {
    parts.push(
      <rect
        key={`p${i}`}
        x={cx - 0.28}
        y={cy - r + 0.35}
        width=".56"
        height="1.1"
        rx=".2"
        fill="#2b3140"
        transform={`rotate(${i * 22.5} ${cx} ${cy})`}
      />,
    );
  }
  parts.push(
    <path
      key="sw"
      d={`M${cx - r + 1.15} ${cy + 1.4} A${r - 1.15} ${r - 1.15} 0 0 1 ${cx + r - 1.15} ${cy + 1.4}`}
      fill="none"
      stroke="#454e60"
      strokeWidth=".5"
      opacity=".6"
    />,
  );
  // Тормозной диск и суппорт — видны сквозь спицы
  parts.push(<circle key="d" cx={cx} cy={cy} r={rim - 1.1} fill="#4a5465" stroke="#2f3644" strokeWidth=".5" />);
  parts.push(<circle key="d2" cx={cx} cy={cy} r={rim - 1.6} fill="#6d7889" opacity=".38" />);
  for (let i = 0; i < 6; i++) {
    const a = (i * 60 + 12) * (Math.PI / 180);
    parts.push(
      <circle
        key={`dh${i}`}
        cx={(cx + Math.cos(a) * (rim - 1.75)).toFixed(2)}
        cy={(cy + Math.sin(a) * (rim - 1.75)).toFixed(2)}
        r=".34"
        fill="#2c3240"
      />,
    );
  }
  parts.push(
    <path
      key="cal"
      d={`M${cx - 2.8} ${cy - rim + 2.6} A${rim - 1} ${rim - 1} 0 0 1 ${cx + 3} ${cy - rim + 3.1}`}
      fill="none"
      stroke={caliper}
      strokeWidth="1.45"
      strokeLinecap="round"
    />,
  );
  // Обод
  parts.push(<circle key="r" cx={cx} cy={cy} r={rim} fill="#8e9aad" stroke="#e2e8f0" strokeWidth=".32" strokeOpacity=".45" />);
  parts.push(<circle key="r2" cx={cx} cy={cy} r={rim - 1.05} fill="#20242f" opacity=".72" />);

  if (style === 'turbine') {
    for (let i = 0; i < 18; i++) {
      parts.push(
        <rect
          key={`s${i}`}
          x={cx - 0.28}
          y={cy - rim + 0.5}
          width=".56"
          height={rim - 1.8}
          fill={`url(#${uid}-chx)`}
          transform={`rotate(${i * 20} ${cx} ${cy})`}
          opacity=".95"
        />,
      );
    }
  } else if (style === 'mesh') {
    for (let i = 0; i < 24; i++) {
      parts.push(
        <rect
          key={`s${i}`}
          x={cx - 0.24}
          y={cy - rim + 0.4}
          width=".48"
          height={rim - 1.85}
          fill={`url(#${uid}-chx)`}
          transform={`rotate(${i * 15} ${cx} ${cy})`}
          opacity=".95"
        />,
      );
    }
  } else if (style === 'y') {
    // Y-спица: ножка от ступицы и две ветви к ободу — фирменный диск Lamborghini.
    for (let i = 0; i < spokes; i++) {
      const d =
        `M${cx} ${cy - 1.5} L${cx} ${cy - rim * 0.5} ` +
        `M${cx} ${cy - rim * 0.5} L${cx - spokeW * 1.3} ${cy - rim + 1} ` +
        `M${cx} ${cy - rim * 0.5} L${cx + spokeW * 1.3} ${cy - rim + 1}`;
      parts.push(
        <g key={`s${i}`} transform={`rotate(${(360 / spokes) * i} ${cx} ${cy})`}>
          <path d={d} fill="none" stroke="#3a4152" strokeWidth={spokeW + 0.6} strokeLinecap="round" strokeLinejoin="round" />
          <path d={d} fill="none" stroke={`url(#${uid}-chx)`} strokeWidth={spokeW} strokeLinecap="round" strokeLinejoin="round" />
        </g>,
      );
    }
  } else if (style === 'solid') {
    // Стальной штампованный диск: тёмная плита, круглые окна и стальной обод.
    parts.push(<circle key="plate" cx={cx} cy={cy} r={rim - 0.7} fill="#39404f" />);
    parts.push(<circle key="plate2" cx={cx} cy={cy} r={rim - 1.5} fill="#2b323f" />);
    for (let i = 0; i < 6; i++) {
      parts.push(
        <g key={`s${i}`} transform={`rotate(${(360 / 6) * i} ${cx} ${cy})`}>
          <circle cx={cx} cy={cy - rim * 0.58} r={rim * 0.19} fill="#151922" stroke="#5b6474" strokeWidth=".22" />
        </g>,
      );
    }
    parts.push(<circle key="ring" cx={cx} cy={cy} r={rim - 1.15} fill="none" stroke="#aab4c4" strokeWidth=".7" opacity=".8" />);
  } else {
    for (let i = 0; i < spokes; i++) {
      parts.push(
        <g key={`s${i}`} transform={`rotate(${(360 / spokes) * i} ${cx} ${cy})`}>
          <rect
            x={cx - spokeW / 2}
            y={cy - rim + 0.4}
            width={spokeW}
            height={rim - 1.95}
            rx={spokeW / 2}
            fill={`url(#${uid}-chx)`}
            stroke="#3a4152"
            strokeWidth=".18"
            opacity=".97"
          />
        </g>,
      );
    }
  }
  parts.push(<circle key="acc" cx={cx} cy={cy} r={rim - 1.25} fill="none" stroke={accent} strokeWidth=".3" opacity=".28" />);
  parts.push(<circle key="h" cx={cx} cy={cy} r="2.1" fill="#aab4c4" stroke="#3a4152" strokeWidth=".4" />);
  parts.push(<circle key="h2" cx={cx} cy={cy} r=".8" fill={cap ?? '#39404f'} />);
  if (label) {
    parts.push(
      <text key="l" x={cx} y={cy + 0.6} fontFamily="Georgia, serif" fontSize="1.7" fontWeight="700" fill={cap ?? '#39404f'} textAnchor="middle">
        {label}
      </text>,
    );
  }
  return <g>{parts}</g>;
}

/** Тёмный проём арки за колесом: глубина крыла. */
function Well({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return <circle cx={cx} cy={cy} r={r + 1.3} fill="#0a0c12" />;
}

/** Хромированная окантовка арки поверх маски. */
function ArchTrim({ cx, cy, r, color, width = 0.55 }: { cx: number; cy: number; r: number; color: string; width?: number }) {
  return (
    <path
      d={`M${cx - r} ${cy + 1.6} A${r} ${r} 0 0 1 ${cx + r} ${cy + 1.6}`}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
    />
  );
}

/** Порог: тёмная полоса между арками, чтобы кузов не «висел» над дорогой. */
function Rocker({ x1, x2, y = 80.4, deep }: { x1: number; x2: number; y?: number; deep: string }) {
  return (
    <g>
      <rect x={x1} y={y - 3.6} width={x2 - x1} height="3.6" fill={deep} opacity=".5" />
      <rect x={x1} y={y - 3.6} width={x2 - x1} height=".55" fill="#ffffff" opacity=".14" />
    </g>
  );
}

/** Тонкая линия по кузову — вспомогательный элемент для бликов и стыков. */
function Line({ d, color, opacity, w }: { d: string; color: string; opacity: number; w: number }) {
  return <path d={d} fill="none" stroke={color} strokeOpacity={opacity} strokeWidth={w} />;
}

// ── Общий силуэт седана ─────────────────────────────────────────────────────
/**
 * Кузов седана и кабина. Нос справа.
 *
 * Числа подобраны по настоящим пропорциям: капот ≈ 32 % длины, кабина ≈ 34 %,
 * багажник — короткий, крыша на высоте 40 при пороге кузова 80 — иначе кабина
 * получается «будкой» и машина читается пикапом (первая версия арта так и
 * выглядела). Колёса стоят по краям базы, арки вырезаны маской, поэтому крыло
 * накрывает шину.
 */
interface SedanGeom {
  /** Высота крыши */
  roofY: number;
  /** Передний и задний край крыши */
  roofFront: number;
  roofRear: number;
  /** Основание лобового стекла и задней стойки */
  aBase: number;
  cBase: number;
  /** Верх кузова у носа и у кормы */
  noseTop: number;
  tailTop: number;
  /** Ось переднего и заднего колеса */
  frontWheel: number;
  rearWheel: number;
  /** Толщина стоек: доля, на которую стекло отступает к центру кабины */
  roofBand?: number;
}

const BASE_GEOM: SedanGeom = {
  roofY: 44.8,
  roofFront: 51.0,
  roofRear: 27.0,
  aBase: 63.8,
  cBase: 15.2,
  noseTop: 57.6,
  tailTop: 55.4,
  frontWheel: 75.4,
  rearWheel: 24.6,
};

/** Силуэт кузова целиком: от кормы по верху, через нос и низ. */
function sedanBody(g: SedanGeom): string {
  return `M4.6 80.2 L4.6 ${g.tailTop + 2.6} Q4.6 ${g.tailTop - 1} 7.6 ${g.tailTop - 1} L${g.cBase - 2} ${g.tailTop - 0.8} L${g.aBase} ${g.noseTop - 3} L${g.aBase + 7} ${g.noseTop - 2.4} Q90.6 ${g.noseTop - 2} 94.2 ${g.noseTop + 0.8} L95.4 ${g.noseTop + 1.4} L95.4 78 Q95.4 80.4 92.6 80.4 L8.2 80.4 Q4.6 80.4 4.6 80.2 Z`;
}

/**
 * Кабина: силуэт с четырьмя точками по часовой стрелке от основания лобового
 * стекла. Стекло вписывается к центру кабины, поэтому крыша, стойки и рамки
 * дверей читаются полосами краски, а не сливаются в чёрное пятно.
 */
function Cabin({
  uid,
  pts,
  paint,
  deep,
  accent,
  bar = 0.48,
  shade = 0.34,
  trimWidth = 0.7,
  roofBand = 0.14,
}: {
  uid: string;
  pts: [number, number][];
  paint: string;
  deep: string;
  accent: string;
  bar?: number;
  shade?: number;
  trimWidth?: number;
  roofBand?: number;
}) {
  const cx0 = (pts[0][0] + pts[1][0] + pts[2][0] + pts[3][0]) / 4;
  const cy0 = (pts[0][1] + pts[1][1] + pts[2][1] + pts[3][1]) / 4;
  const inset = (p: [number, number]): [number, number] => [p[0] + (cx0 - p[0]) * roofBand, p[1] + (cy0 - p[1]) * roofBand];
  const g = pts.map(inset);
  const lerp = (a: [number, number], b: [number, number], k: number): [number, number] => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  const poly = (list: [number, number][]) => list.map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' L');
  const pt = (p: [number, number]) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`;
  const pilBottom = lerp(g[0], g[3], bar);
  const pilTop = lerp(g[1], g[2], bar);
  return (
    <g>
      <path d={`M${poly(pts)} Z`} fill={paint} />
      <path d={`M${poly(pts)} Z`} fill={`url(#${uid}-bd)`} opacity=".3" />
      <path d={`M${poly(g)} Z`} fill={`url(#${uid}-gl)`} />
      <path d={`M${pt(lerp(g[0], g[1], 0.42))} L${pt(lerp(g[1], g[2], 0.28))} L${pt(lerp(g[1], g[2], 1))} L${pt(lerp(g[0], g[3], 1))} Z`} fill="#ffffff" opacity=".07" />
      {/* Блик по лобовому стеклу */}
      <path d={`M${pt(lerp(g[0], g[1], 0.24))} L${pt(lerp(g[1], g[2], 0.14))}`} stroke="#ffffff" strokeWidth=".85" strokeOpacity=".24" strokeLinecap="round" fill="none" />
      {/* Блик на крыше */}
      <path d={`M${pt(lerp(g[1], g[2], 0.08))} L${pt(lerp(g[1], g[2], 0.92))}`} stroke="#ffffff" strokeOpacity={shade * 0.5} strokeWidth=".7" strokeLinecap="round" fill="none" />
      {/* Стойка между дверями */}
      <path d={`M${pt(pilBottom)} L${pt(pilTop)}`} stroke={deep} strokeWidth="1.5" />
      {/* Хром по контуру кабины: низ (пояс) не обводим — иначе кабина
          читается отдельной «будкой» на кузове. */}
      <path d={`M${poly(pts)}`} fill="none" stroke={`url(#${uid}-cht)`} strokeWidth={trimWidth} strokeLinejoin="round" strokeLinecap="round" />
      {/* Тень от крыши на стекле */}
      <path d={`M${pt(pilTop)} L${pt([g[1][0], g[1][1] + 1.6])}`} stroke={accent} strokeOpacity=".16" strokeWidth="1.2" />
    </g>
  );
}

/** Колёса и арки по геометрии кузова. */
function Wheels({
  uid,
  g,
  accent,
  deep,
  r = 10.2,
  archR = 11.5,
  style = 'twin',
  spokeW = 1.05,
  spokes = 10,
  caliper = '#dc2626',
  cap,
  archColor = '#0b0e14',
  archWidth = 0.7,
  whitewall = false,
}: {
  uid: string;
  g: SedanGeom;
  accent: string;
  deep: string;
  r?: number;
  archR?: number;
  style?: SpokeStyle;
  spokeW?: number;
  spokes?: number;
  caliper?: string;
  cap?: string;
  archColor?: string;
  archWidth?: number;
  whitewall?: boolean;
}) {
  return (
    <g>
      <Well cx={g.rearWheel} cy={80.4} r={archR} />
      <Well cx={g.frontWheel} cy={80.4} r={archR} />
      <Wheel uid={uid} cx={g.rearWheel} cy={80.4} r={r} accent={accent} spokes={spokes} spokeW={spokeW} style={style} caliper={caliper} cap={cap} whitewall={whitewall} />
      <Wheel uid={uid} cx={g.frontWheel} cy={80.4} r={r} accent={accent} spokes={spokes} spokeW={spokeW} style={style} caliper={caliper} cap={cap} whitewall={whitewall} />
      <ArchTrim cx={g.rearWheel} cy={80.4} r={archR} color={archColor} width={archWidth} />
      <ArchTrim cx={g.frontWheel} cy={80.4} r={archR} color={archColor} width={archWidth} />
      <rect x={g.rearWheel + archR - 0.6} y={74.4} width={g.frontWheel - g.rearWheel - archR * 2 + 1.2} height="3.4" fill={deep} opacity=".45" />
    </g>
  );
}

// ── BMW 7-й серии ───────────────────────────────────────────────────────────
/** Длинный капот, «ноздри», angel eyes, излом Хофмайстера, плавник на крыше. */
function Bmw({ uid, colors }: { uid: string; colors: CarColors }) {
  const [main, deep, accent] = colors;
  // Спортивный седан: длинный капот, короткая корма, крыша ниже и сдвинута назад.
  const g: SedanGeom = {
    ...BASE_GEOM,
    roofY: 46.2,
    roofFront: 52.2,
    roofRear: 26.6,
    aBase: 66.8,
    cBase: 14.2,
    noseTop: 56.2,
    tailTop: 54.2,
    frontWheel: 77.0,
    rearWheel: 23.8,
  };
  const body = sedanBody(g);
  const arches = [
    { cx: g.rearWheel, cy: 80.4, r: 12.6 },
    { cx: g.frontWheel, cy: 80.4, r: 12.6 },
  ];
  return (
    <g>
      <Defs uid={uid} deep={deep} accent={accent} />
      <BodyMask uid={uid} body={body} arches={arches} />
      <Ground />
      <g mask={`url(#${uid}-m)`}>
        <path d={body} fill={main} />
        <path d={body} fill={`url(#${uid}-bd)`} />
        {/* Капот и багажник: подштамповки и стыки */}
        <path d={`M${g.aBase + 1} 57 L${g.aBase + 1} 79.6`} stroke="#000" strokeOpacity=".16" strokeWidth=".6" />
        <path d={`M${g.cBase - 0.4} 55.6 L${g.cBase - 0.4} 79.6`} stroke="#000" strokeOpacity=".14" strokeWidth=".55" />
        <Line d={`M${g.aBase + 2} 56.4 Q80 55.6 92 56.6`} color="#ffffff" opacity={0.2} w={0.6} />
        <Line d={`M${g.cBase + 2} 55.4 Q11 55.2 6.4 56.6`} color="#ffffff" opacity={0.16} w={0.5} />
        {/* Двери, ручки, порог */}
        <path d="M45.8 57.4 L45.8 80.2" stroke="#000" strokeOpacity=".28" strokeWidth=".75" />
        <path d="M63.6 57.2 L63.6 80.2" stroke="#000" strokeOpacity=".16" strokeWidth=".6" />
        <path d="M27.8 57.2 Q27 69 27.6 80.2" stroke="#000" strokeOpacity=".14" strokeWidth=".6" />
        <rect x="49.4" y="62.4" width="5.8" height="1.2" rx=".6" fill={`url(#${uid}-ch)`} />
        <rect x="36.6" y="62.6" width="5.8" height="1.2" rx=".6" fill={`url(#${uid}-ch)`} />
        <Line d="M31 59 Q50 57.6 94.4 58.4" color="#000000" opacity={0.14} w={0.7} />
        <Line d="M31 61.2 Q50 59.8 94.4 60.6" color="#ffffff" opacity={0.22} w={0.55} />
        <Line d="M9 70.6 Q50 69 94.6 69.8" color="#ffffff" opacity={0.13} w={0.55} />
        <Rocker x1={34} x2={65.6} deep={deep} />
        {/* Воздушный канал за передним колесом, люк, шильдик */}
        <path d="M64.8 63.4 L67.8 64 L67.2 70.2 L64.2 69.6 Z" fill={deep} opacity=".85" />
        <path d="M65.2 64.6 L67.6 65.1" stroke={accent} strokeWidth=".4" opacity=".9" />
        <circle cx="26.2" cy="66.6" r="2" fill="none" stroke="#000" strokeOpacity=".18" strokeWidth=".5" />
        {/* Кормовой фонарь, выхлоп */}
        <path d="M5.6 60.6 L10.4 61.2 L10.2 67.6 L5.6 66.8 Z" fill="#ef4444" />
        <path d="M5.9 61.9 L9.8 62.4" stroke="#fecdd3" strokeWidth=".55" opacity=".9" />
        <rect x="6" y="77.4" width="5.2" height="1.9" rx=".95" fill={`url(#${uid}-ch)`} />
        <path d="M5.4 75.6 L14.6 75.6 L14.6 77 L5.4 77 Z" fill="#0b1220" opacity=".42" />
        {/* Ноздри и бампер */}
        <rect x="88.6" y="61.2" width="2.95" height="12.6" rx="1.2" fill="#0b1220" stroke={`url(#${uid}-ch)`} strokeWidth=".75" />
        <rect x="92.1" y="61.2" width="2.95" height="12.6" rx="1.2" fill="#0b1220" stroke={`url(#${uid}-ch)`} strokeWidth=".75" />
        <g stroke="#94a3b8" strokeWidth=".32" opacity=".85">
          <path d="M89.5 62.6 V72.8 M90.6 62.6 V72.8 M93 62.6 V72.8 M94.1 62.6 V72.8" />
        </g>
        <path d="M85.2 75 L95.4 75 L95.4 78.2 Q95.4 80.4 92.2 80.4 L85.2 80.4 Z" fill={deep} opacity=".55" />
        <rect x="87.4" y="77.4" width="6.8" height="1.9" rx=".95" fill={`url(#${uid}-ch)`} />
        {/* M-обвес: сплиттер, юбка порога и ducktail на крышке багажника */}
        <path d="M84.4 79.2 L96 79.2 L96 80.6 L84.4 80.6 Z" fill="#0b1220" />
        <path d="M84.6 79.2 L95.8 79.2" stroke={accent} strokeWidth=".4" opacity=".75" />
        <path d="M34.6 79.2 L65.8 79.2 L65.8 80.6 L34.6 80.6 Z" fill="#0b1220" opacity=".85" />
        <path d="M6.2 55.6 L15.4 54.8 L15.8 55.8 L6.4 56.8 Z" fill={deep} />
        <path d="M6.6 55.9 L15 55.2" stroke={accent} strokeWidth=".35" opacity=".7" />
      </g>

      <Wheels uid={uid} g={g} accent={accent} deep={deep} r={10.6} archR={11.8} spokes={12} spokeW={1.05} caliper="#2563eb" />

      {/* Кабина: капот длинный, багажник короткий */}
      <Cabin
        uid={uid}
        pts={[
          [g.aBase, 56.8],
          [g.roofFront, g.roofY],
          [g.roofRear, g.roofY + 0.4],
          [g.cBase + 1.2, 55.8],
        ]}
        paint={main}
        deep={deep}
        accent={accent}
        bar={0.47}
      />
      {/* Излом Хофмайстера: хром в заднем углу стекла */}
      <path d="M16.6 55.4 Q14 55 12.8 52.6" fill="none" stroke={accent} strokeWidth=".8" strokeLinecap="round" opacity=".9" />
      {/* Плавник на крыше */}
      <path d={`M${g.roofRear + 9.4} ${g.roofY + 0.4} Q${g.roofRear + 7.4} ${g.roofY - 2} ${g.roofRear + 6.2} ${g.roofY + 0.3} Z`} fill={deep} />
      {/* Зеркало */}
      <path d="M61.4 55.8 L66.6 54.6 Q68 54.4 68.4 55.6 L68.8 56.8 L62.6 57.6 Z" fill={main} stroke={deep} strokeWidth=".45" />
      <path d="M62.8 56.6 L67 55.7" stroke="#ffffff" strokeWidth=".5" opacity=".55" />
      {/* Фара angel eyes */}
      <path d="M84.4 57.2 L95.2 58.8 L95.2 61.8 L84 60.2 Z" fill="#eef6ff" opacity=".96" />
      <path d="M85.4 58.7 L94.6 60" stroke="#38bdf8" strokeWidth=".95" strokeLinecap="round" />
      <circle cx="88.2" cy="59.4" r=".95" fill="none" stroke="#0284c7" strokeWidth=".5" />
      <circle cx="91.6" cy="60" r=".95" fill="none" stroke="#0284c7" strokeWidth=".5" />
      <path d="M84.4 57.2 L95.2 58.8 L95.2 61.8 L84 60.2 Z" fill="none" stroke="#ffffff" strokeWidth=".4" opacity=".8" />
      {/* Значок на капоте */}
      <circle cx="82.2" cy="61.4" r="2.5" fill="#0b1220" stroke={`url(#${uid}-ch)`} strokeWidth=".4" />
      <path d="M82.2 58.9 A2.45 2.45 0 0 1 84.65 61.4 L82.2 61.4 Z" fill="#e2e8f0" />
      <path d="M82.2 63.9 A2.45 2.45 0 0 1 79.75 61.4 L82.2 61.4 Z" fill="#e2e8f0" />
      <path d="M82.2 58.9 A2.45 2.45 0 0 0 79.75 61.4 L82.2 61.4 Z" fill="#1d4ed8" />
      <path d="M82.2 63.9 A2.45 2.45 0 0 0 84.65 61.4 L82.2 61.4 Z" fill="#1d4ed8" />
      <circle cx="82.2" cy="61.4" r="2.45" fill="none" stroke="#cbd5e1" strokeWidth=".25" />
    </g>
  );
}

// ── Mercedes-Benz S-класс ───────────────────────────────────────────────────
/** Серебристый лимузин: трёхлучевая звезда, хром по борту, мультибалковые фары. */
function Mercedes({ uid, colors }: { uid: string; colors: CarColors }) {
  const [main, deep, accent] = colors;
  // Представительский седан: ровная высокая крыша, длинный капот, низкий пояс.
  const g: SedanGeom = {
    ...BASE_GEOM,
    roofY: 45.0,
    roofFront: 49.6,
    roofRear: 25.2,
    aBase: 65.2,
    cBase: 13.2,
    noseTop: 58.0,
    tailTop: 55.2,
    frontWheel: 76.2,
    rearWheel: 24.6,
  };
  const body = sedanBody(g);
  const arches = [
    { cx: g.rearWheel, cy: 80.4, r: 11.3 },
    { cx: g.frontWheel, cy: 80.4, r: 11.3 },
  ];
  return (
    <g>
      <Defs uid={uid} deep={deep} accent={accent} />
      <BodyMask uid={uid} body={body} arches={arches} />
      <Ground />
      <g mask={`url(#${uid}-m)`}>
        <path d={body} fill={main} />
        <path d={body} fill={`url(#${uid}-bd)`} />
        <path d={`M${g.aBase + 1} 57.4 L${g.aBase + 1} 79.6`} stroke="#000" strokeOpacity=".14" strokeWidth=".55" />
        <path d={`M${g.cBase - 0.4} 55.8 L${g.cBase - 0.4} 79.6`} stroke="#000" strokeOpacity=".12" strokeWidth=".5" />
        <Line d={`M${g.aBase + 2} 56.8 Q80 56 92 57`} color="#ffffff" opacity={0.35} w={0.6} />
        <path d="M45.8 57.6 L45.8 80.2" stroke="#000" strokeOpacity=".28" strokeWidth=".75" />
        <path d="M63.8 57.4 L63.8 80.2" stroke="#000" strokeOpacity=".14" strokeWidth=".6" />
        <path d="M27.8 57.4 Q27 69 27.6 80.2" stroke="#000" strokeOpacity=".12" strokeWidth=".6" />
        <rect x="49.6" y="62.8" width="5.8" height="1.2" rx=".6" fill={`url(#${uid}-ch)`} />
        <rect x="36.8" y="63" width="5.8" height="1.2" rx=".6" fill={`url(#${uid}-ch)`} />
        {/* Хром по борту — визитная карточка S-класса */}
        <Line d="M6.8 60.6 Q50 59 94.8 59.8" color={accent} opacity={0.95} w={0.65} />
        <Line d="M6.8 62.2 Q50 60.6 94.8 61.4" color="#000000" opacity={0.12} w={0.45} />
        <Line d="M8 70.8 Q50 69.2 95 70" color="#ffffff" opacity={0.32} w={0.55} />
        <path d="M6 79.2 L95 79.2" stroke="#000" strokeOpacity=".2" strokeWidth="1.5" />
        <Rocker x1={34} x2={65.6} deep={deep} />
        <circle cx="26.2" cy="67" r="2" fill="none" stroke="#000" strokeOpacity=".16" strokeWidth=".5" />
        <path d="M5.8 60.8 L10.6 61.4 L10.4 68.2 L5.8 67.4 Z" fill="#dc2626" />
        <path d="M6.1 62.1 L9.9 62.6" stroke="#fecaca" strokeWidth=".55" opacity=".9" />
        <path d="M85.6 75.2 L95.4 75.2 L95.4 78.2 Q95.4 80.4 92.2 80.4 L85.6 80.4 Z" fill={deep} opacity=".3" />
        <rect x="87.8" y="77.4" width="6.2" height="1.8" rx=".9" fill={`url(#${uid}-ch)`} />
        {/* Хром на бамперах и крышке багажника — «представительский» почерк */}
        <path d="M5.4 76.6 L14.4 76.6 L14.4 77.8 L5.4 77.8 Z" fill={`url(#${uid}-ch)`} opacity=".9" />
        <path d="M5.6 55 L14.8 54.6 L15.2 55.6 L5.8 56.2 Z" fill="#0b1220" opacity=".45" />
        <path d="M6 55.4 L14.4 55" stroke={`url(#${uid}-ch)`} strokeWidth=".45" />
        {/* Решётка с ламелями */}
        <rect x="89.4" y="60" width="6" height="15.2" rx="1.5" fill="#111827" stroke={`url(#${uid}-ch)`} strokeWidth=".8" />
        <g stroke={`url(#${uid}-ch)`} strokeWidth=".44">
          <path d="M90.8 61.4 H94.2 M90.8 63.5 H94.2 M90.8 65.6 H94.2 M90.8 67.7 H94.2 M90.8 69.8 H94.2 M90.8 71.9 H94.2" />
        </g>
      </g>

      <Wheels uid={uid} g={g} accent={accent} deep={deep} r={10.1} archR={11.3} style="mesh" caliper="#b91c1c" archColor="#8d99ad" archWidth={0.6} />

      {/* Трёхлучевая звезда */}
      <circle cx="92.4" cy="66.4" r="4.3" fill="#0b1220" stroke={`url(#${uid}-ch)`} strokeWidth=".6" />
      <circle cx="92.4" cy="66.4" r="3.6" fill="none" stroke="#f8fafc" strokeWidth=".4" opacity=".92" />
      <g stroke="#f8fafc" strokeWidth=".7" strokeLinecap="round">
        <path d="M92.4 66.4 V63.4" />
        <path d="M92.4 66.4 L90 68.1" />
        <path d="M92.4 66.4 L94.8 68.1" />
      </g>
      <circle cx="92.4" cy="66.4" r=".55" fill="#f8fafc" />
      {/* Мультибалковые фары */}
      <path d="M84 57.2 L95.2 58.8 L95.2 61.6 L83.6 60 Z" fill="#f8fafc" opacity=".96" />
      <path d="M84.8 58.7 L94.6 60" stroke="#7dd3fc" strokeWidth=".9" strokeLinecap="round" />
      <circle cx="87" cy="59.2" r=".5" fill="#38bdf8" />
      <circle cx="89" cy="59.5" r=".5" fill="#38bdf8" />
      <circle cx="91" cy="59.8" r=".5" fill="#38bdf8" />
      <path d="M84 57.2 L95.2 58.8 L95.2 61.6 L83.6 60 Z" fill="none" stroke="#ffffff" strokeWidth=".38" opacity=".85" />

      <Cabin
        uid={uid}
        pts={[
          [g.aBase, 57],
          [g.roofFront, g.roofY],
          [g.roofRear, g.roofY + 0.4],
          [g.cBase + 1.2, 55.8],
        ]}
        paint={main}
        deep={deep}
        accent={accent}
        bar={0.47}
      />
      <path d="M61.4 56 L66.6 54.8 Q68 54.6 68.4 55.8 L68.8 57 L62.6 57.8 Z" fill={main} stroke={deep} strokeWidth=".45" />
      <path d="M62.8 56.8 L67 55.9" stroke="#ffffff" strokeWidth=".5" opacity=".6" />
    </g>
  );
}

// ── Rolls-Royce Phantom ─────────────────────────────────────────────────────
/** Длинный капот, «Парфенон», «Дух экстаза», золотая ватерлиния, задние двери. */
function Rolls({ uid, colors }: { uid: string; colors: CarColors }) {
  const [main, deep, accent] = colors;
  // Парадный лимузин: высокая плоская крыша, почти вертикальное лобовое,
  // длинный капот и высокий «Парфенон» — самый строгий силуэт в наборе.
  const g: SedanGeom = {
    ...BASE_GEOM,
    roofY: 43.4,
    roofFront: 52.6,
    roofRear: 30.6,
    aBase: 60.4,
    cBase: 18.2,
    noseTop: 60.6,
    tailTop: 56.4,
    frontWheel: 76.0,
    rearWheel: 25.8,
  };
  const body = sedanBody(g);
  const arches = [
    { cx: g.rearWheel, cy: 80.4, r: 11.2 },
    { cx: g.frontWheel, cy: 80.4, r: 11.2 },
  ];
  return (
    <g>
      <Defs uid={uid} deep={deep} accent={accent} />
      <BodyMask uid={uid} body={body} arches={arches} />
      <Ground />
      <g mask={`url(#${uid}-m)`}>
        <path d={body} fill={main} />
        <path d={body} fill={`url(#${uid}-bd)`} />
        <path d={`M${g.aBase + 1} 58 L${g.aBase + 1} 79.8`} stroke="#000" strokeOpacity=".18" strokeWidth=".6" />
        <path d={`M${g.cBase - 0.6} 55 L${g.cBase - 0.6} 79.8`} stroke="#000" strokeOpacity=".16" strokeWidth=".55" />
        {/* Золотая ватерлиния и длинный борт */}
        <Line d="M6.6 60 Q46 58.8 94.8 59.4" color={accent} opacity={0.95} w={0.55} />
        <Line d="M6.6 61.6 Q46 60.4 94.8 61" color="#000000" opacity={0.14} w={0.45} />
        <Line d="M8 69.4 Q46 68 95 68.8" color="#ffffff" opacity={0.3} w={0.55} />
        <Line d="M8 74 Q50 72.8 95 73.6" color="#ffffff" opacity={0.14} w={0.5} />
        {/* Задние «суицидальные» двери: петля у стойки, ручка впереди */}
        <path d="M38.4 56.8 L38.4 79.8" stroke="#000" strokeOpacity=".26" strokeWidth=".75" />
        <path d="M61.4 57.6 L61.4 79.8" stroke="#000" strokeOpacity=".16" strokeWidth=".6" />
        <path d="M51.2 56.6 L51.2 79.8" stroke="#000" strokeOpacity=".1" strokeWidth=".5" />
        <rect x="53.2" y="62.2" width="6" height="1.2" rx=".6" fill={`url(#${uid}-ch)`} />
        <rect x="40.4" y="62.4" width="5" height="1.2" rx=".6" fill={`url(#${uid}-ch)`} />
        <Rocker x1={36} x2={64.6} deep={deep} />
        {/* Парфенон: хромовая рама и ламели */}
        <rect x="90" y="56.8" width="6.6" height="18.4" rx="1.3" fill="#0b1220" stroke={`url(#${uid}-ch)`} strokeWidth=".95" />
        <g stroke={`url(#${uid}-ch)`} strokeWidth=".46">
          <path d="M91 58.2 V74.4 M92.1 58.2 V74.4 M93.2 58.2 V74.4 M94.3 58.2 V74.4 M95.4 58.2 V74.4" />
        </g>
        <path d="M90 57.2 Q93.4 55.8 96.6 57.2" fill="none" stroke={`url(#${uid}-ch)`} strokeWidth=".55" />
        {/* Узкие фары, фонарь, бамперы */}
        <rect x="83" y="58.8" width="7.2" height="2.6" rx=".7" fill="#f8fafc" />
        <rect x="83.8" y="59.6" width="5.6" height="1" rx=".45" fill="#bae6fd" />
        <circle cx="88.6" cy="60.1" r=".45" fill="#eff6ff" />
        <path d="M5.6 60 L9.4 60.6 L9.3 67.2 L5.6 66.6 Z" fill="#dc2626" />
        <path d="M5.9 61.3 L9 61.8" stroke="#fecaca" strokeWidth=".5" opacity=".9" />
        <path d="M86.2 76.2 L95.2 76.2 L95.2 78.4 Q95.2 80.4 92.4 80.4 L86.2 80.4 Z" fill={deep} opacity=".4" />
        <rect x="86.6" y="77.4" width="8.6" height="2.2" rx="1.1" fill={`url(#${uid}-ch)`} />
        <rect x="5.8" y="77.4" width="8" height="2.2" rx="1.1" fill={`url(#${uid}-ch)`} />
        <path d="M40 79.2 L88 79.2 L89.6 80.4 L36 80.4 Z" fill={deep} opacity=".35" />
      </g>

      <Wheels uid={uid} g={g} accent={accent} deep={deep} r={10} archR={11.3} style="mesh" caliper="#b91c1c" cap={accent} archColor="#0b0e14" archWidth={0.8} whitewall />

      {/* Высокая, почти вертикальная кабина */}
      <Cabin
        uid={uid}
        pts={[
          [g.aBase, 57],
          [g.roofFront, g.roofY],
          [g.roofRear, g.roofY + 0.4],
          [g.cBase, 55.4],
        ]}
        paint={main}
        deep={deep}
        accent={accent}
        bar={0.5}
        trimWidth={0.8}
        roofBand={0.16}
      />
      {/* Дух экстаза на капоте */}
      <path d="M90 56.2 Q91 54 92 55.4 Q93 53.8 94.2 55.8 Q93 55 92 56.8 Q91 55 90 56.2 Z" fill={accent} />
      <path d="M92 54.8 Q92.4 53.2 93 54" fill="none" stroke={accent} strokeWidth=".5" strokeLinecap="round" />
      <path d="M59 55 L64.4 53.8 Q65.8 53.6 66.2 54.8 L66.6 56 L60.2 56.8 Z" fill={main} stroke={deep} strokeWidth=".45" />
      <text x="44.4" y="66.6" fontFamily="Georgia, serif" fontSize="2.5" fontWeight="700" fill={accent} textAnchor="middle" opacity=".9">RR</text>
    </g>
  );
}

// ── Brabus ──────────────────────────────────────────────────────────────────
/** Чёрный тюнингованный седан: карбон, красная нить, «B» на решётке, сплиттер. */
function Brabus({ uid, colors }: { uid: string; colors: CarColors }) {
  const [main, deep, accent] = colors;
  // Широкий низкий седан: заниженная крыша, крупные колёса, крылья шире кузова.
  const g: SedanGeom = {
    ...BASE_GEOM,
    roofY: 47.6,
    roofFront: 51.8,
    roofRear: 26.4,
    aBase: 64.8,
    cBase: 14.0,
    noseTop: 56.2,
    tailTop: 55.0,
    frontWheel: 76.6,
    rearWheel: 23.6,
  };
  const body = sedanBody(g);
  const arches = [
    { cx: g.rearWheel, cy: 80.4, r: 12.6 },
    { cx: g.frontWheel, cy: 80.4, r: 12.6 },
  ];
  return (
    <g>
      <Defs uid={uid} deep={deep} accent={accent} />
      <BodyMask uid={uid} body={body} arches={arches} />
      <Ground y={92.1} />
      <g mask={`url(#${uid}-m)`}>
        <path d={body} fill={main} />
        <path d={body} fill={`url(#${uid}-bd)`} />
        <path d={`M${g.aBase + 1} 57 L${g.aBase + 1} 80`} stroke="#000" strokeOpacity=".3" strokeWidth=".6" />
        <path d={`M${g.cBase - 0.4} 55.4 L${g.cBase - 0.4} 80`} stroke="#000" strokeOpacity=".26" strokeWidth=".55" />
        <Line d={`M${g.aBase + 2} 56.4 Q80 55.6 92 56.6`} color="#ffffff" opacity={0.14} w={0.6} />
        <Line d="M9 70 Q50 68.4 94.6 69.2" color="#ffffff" opacity={0.14} w={0.5} />
        {/* Красная нить по борту — почерк Brabus, тонкая */}
        <Line d="M6.6 60.4 Q50 58.8 94.8 59.8" color={accent} opacity={0.95} w={0.55} />
        <Line d="M6.6 61.8 Q50 60.2 94.8 61.2" color={accent} opacity={0.38} w={0.28} />
        <path d="M45.8 57.6 L45.8 80" stroke="#000" strokeOpacity=".4" strokeWidth=".8" />
        <path d="M63.8 57.4 L63.8 80" stroke="#000" strokeOpacity=".22" strokeWidth=".6" />
        <path d="M27.8 57.4 Q27 69 27.6 80" stroke="#000" strokeOpacity=".26" strokeWidth=".6" />
        <rect x="49.6" y="62" width="5.8" height="1.2" rx=".6" fill="#9aa6b8" />
        <rect x="36.8" y="62.2" width="5.8" height="1.2" rx=".6" fill="#9aa6b8" />
        {/* Карбоновый порог и сплиттер */}
        <path d="M33.4 77 L88.6 77 L89.8 80.2 L31 80.2 Z" fill="#0c0f15" />
        <g stroke="#2b3340" strokeWidth=".3" opacity=".9">
          <path d="M35 77.6 L37 80 M40.6 77.6 L42.6 80 M46.2 77.6 L48.2 80 M51.8 77.6 L53.8 80 M57.4 77.6 L59.4 80 M63 77.6 L65 80 M68.6 77.6 L70.6 80 M74.2 77.6 L76.2 80 M79.8 77.6 L81.8 80" />
        </g>
        <path d="M33.2 77 L88.8 77" stroke={accent} strokeWidth=".5" opacity=".9" />
        <path d="M85 74.4 L95.4 74.4 L95.4 78 Q95.4 80.4 92.2 80.4 L85 80.4 Z" fill="#0c0f15" />
        <path d="M85 74.4 L95.4 74.4" stroke={accent} strokeWidth=".45" opacity=".85" />
        <path d="M5.6 74.2 L14 74.2 L14 75.6 L5.6 75.6 Z" fill="#0c0f15" opacity=".7" />
        {/* Решётка с «B» */}
        <rect x="89.4" y="60" width="6" height="15.4" rx="1.4" fill="#0b1220" stroke="#475569" strokeWidth=".6" />
        <g stroke="#475569" strokeWidth=".4">
          <path d="M90.6 61.4 H94.4 M90.6 63.6 H94.4 M90.6 65.8 H94.4 M90.6 68 H94.4 M90.6 70.2 H94.4 M90.6 72.4 H94.4" />
        </g>
        <path d="M5.8 60.4 L10.4 61 L10.2 67.4 L5.8 66.8 Z" fill="#ef4444" />
        <path d="M6.1 61.6 L9.8 62.1" stroke="#fecdd3" strokeWidth=".5" opacity=".8" />
        <rect x="6.2" y="76.6" width="4.2" height="1.8" rx=".9" fill={accent} />
        <rect x="87" y="76.6" width="4" height="1.8" rx=".9" fill={accent} />
        <rect x="91.8" y="76.6" width="3.4" height="1.8" rx=".9" fill={accent} />
      </g>

      <Wheels uid={uid} g={g} accent="#cbd5e1" deep={deep} r={11} archR={12.6} spokeW={1.15} spokes={12} caliper="#b91c1c" cap="#111827" archWidth={0.7} />

      {/* Widebody: кромка крыла шире кузова — арка читается даже на чёрном */}
      {[g.rearWheel, g.frontWheel].map((cx) => (
        <g key={`flare-${cx}`}>
          <path d={`M${cx - 13.4} 80.6 A13.4 13.4 0 0 1 ${cx + 13.4} 80.6`} fill="none" stroke="#0c0f15" strokeWidth="3.4" strokeLinecap="round" />
          <path d={`M${cx - 13.4} 80.6 A13.4 13.4 0 0 1 ${cx + 13.4} 80.6`} fill="none" stroke="#8b95a6" strokeWidth=".85" strokeLinecap="round" />
          <path d={`M${cx - 13.7} 79.6 A13.7 13.7 0 0 1 ${cx + 13.7} 79.6`} fill="none" stroke="#ffffff" strokeOpacity=".18" strokeWidth=".45" strokeLinecap="round" />
        </g>
      ))}
      {/* Жабры на переднем крыле и антикрыло-«уточка» на багажнике */}
      <g stroke="#0c0f15" strokeWidth=".55" strokeLinecap="round" opacity=".85">
        <path d="M69.6 66.6 L72.6 66.2" />
        <path d="M69.8 68.2 L72.8 67.8" />
      </g>
      <path d="M5.6 55 L17.6 54.2 L18.2 55.4 L5.8 56.4 Z" fill="#0c0f15" />
      <path d="M6 55.4 L17.2 54.6" stroke={accent} strokeWidth=".4" opacity=".85" />
      <g fill="#0c0f15" stroke="#8b95a6" strokeWidth=".28">
        <rect x="5.8" y="78.2" width="3.4" height="2" rx="1" />
        <rect x="10" y="78.2" width="3.4" height="2" rx="1" />
      </g>

      <circle cx="92.4" cy="66.6" r="3.3" fill="#0b1220" stroke={accent} strokeWidth=".55" />
      <text x="92.4" y="68.1" fontFamily="Arial, Helvetica, sans-serif" fontSize="4.2" fontWeight="700" fill={accent} textAnchor="middle">B</text>
      <path d="M83.6 56.6 L95.4 58 L95.4 60.6 L83.2 59.2 Z" fill="#f8fafc" opacity=".9" />
      <path d="M84.4 58.1 L94.6 59.2" stroke="#7dd3fc" strokeWidth=".85" strokeLinecap="round" />
      <path d="M83.6 56.6 L95.4 58 L95.4 60.6 L83.2 59.2 Z" fill="none" stroke={accent} strokeWidth=".35" opacity=".8" />

      <Cabin
        uid={uid}
        pts={[
          [g.aBase, 57],
          [g.roofFront, g.roofY],
          [g.roofRear, g.roofY + 0.4],
          [g.cBase + 1.2, 55.6],
        ]}
        paint={main}
        deep={deep}
        accent={accent}
        bar={0.47}
        shade={0.2}
      />
      <path d="M61.8 55.8 L67 54.6 Q68.4 54.4 68.8 55.6 L69.2 56.8 L63 57.6 Z" fill={main} stroke={accent} strokeWidth=".3" />
      <path d="M63.2 56.6 L67.4 55.7" stroke="#ffffff" strokeWidth=".45" opacity=".3" />
    </g>
  );
}

// ── Maybach ─────────────────────────────────────────────────────────────────
/** Двухцветный лимузин: хромовая разделительная линия, двойная M, «водопад». */
function Maybach({ uid, colors }: { uid: string; colors: CarColors }) {
  const [main, deep, accent] = colors;
  const upper = '#eef2f7';
  // Лимузин: самая длинная база, высокая ровная крыша, короткие свесы.
  const g: SedanGeom = {
    ...BASE_GEOM,
    roofY: 44.2,
    roofFront: 53.8,
    roofRear: 29.4,
    aBase: 61.2,
    cBase: 17.4,
    noseTop: 59.0,
    tailTop: 56.0,
    frontWheel: 80.4,
    rearWheel: 19.6,
  };
  const body = sedanBody(g);
  const arches = [
    { cx: g.rearWheel, cy: 80.4, r: 11.2 },
    { cx: g.frontWheel, cy: 80.4, r: 11.2 },
  ];
  // Двухцветная схема: всё выше пояса — тёмное, ниже — светлое, стык по хрому.
  const belt = 66.2;
  return (
    <g>
      <Defs uid={uid} deep={deep} accent={accent} paint2={upper} />
      <BodyMask uid={uid} body={body} arches={arches} />
      <Ground />
      <g mask={`url(#${uid}-m)`}>
        <path d={body} fill={main} />
        <path d={body} fill={`url(#${uid}-bd)`} opacity=".7" />
        <path d={`M4.6 80.2 L4.6 ${belt} Q50 ${belt - 2.4} 95.4 ${belt - 0.4} L95.4 78 Q95.4 80.4 92.6 80.4 L8.2 80.4 Q4.6 80.4 4.6 80.2 Z`} fill={upper} />
        <path d={`M4.6 80.2 L4.6 ${belt} Q50 ${belt - 2.4} 95.4 ${belt - 0.4} L95.4 78 Q95.4 80.4 92.6 80.4 L8.2 80.4 Q4.6 80.4 4.6 80.2 Z`} fill={`url(#${uid}-p2)`} />
        <Line d={`M5.2 ${belt - 1.6} Q50 ${belt - 4} 95 ${belt - 2}`} color="#000000" opacity={0.12} w={0.5} />
        <Line d={`M6 ${belt + 1.8} Q50 ${belt - 0.4} 95 ${belt + 1.6}`} color="#ffffff" opacity={0.5} w={0.6} />
        <path d={`M4.6 ${g.tailTop + 2.6} L4.6 79.8`} stroke="#000" strokeOpacity=".16" strokeWidth=".7" />
        <path d={`M${g.aBase + 1} 57.6 L${g.aBase + 1} 79.8`} stroke="#000" strokeOpacity=".14" strokeWidth=".55" />
        <path d={`M${g.cBase - 0.6} 55.4 L${g.cBase - 0.6} 79.8`} stroke="#000" strokeOpacity=".14" strokeWidth=".55" />
        <path d="M38.8 56.8 L38.8 79.8" stroke="#000" strokeOpacity=".22" strokeWidth=".75" />
        <path d="M61.6 57.8 L61.6 79.8" stroke="#000" strokeOpacity=".14" strokeWidth=".6" />
        <path d="M51.4 56.6 L51.4 79.8" stroke="#000" strokeOpacity=".1" strokeWidth=".5" />
        <rect x="53.6" y="66.6" width="6" height="1.2" rx=".6" fill={`url(#${uid}-ch)`} />
        <rect x="40.8" y="66.8" width="5" height="1.2" rx=".6" fill={`url(#${uid}-ch)`} />
        <Rocker x1={36.4} x2={64.8} deep="#94a3b8" />
        {/* Водопад */}
        <rect x="90.2" y="57.6" width="6.4" height="16.8" rx="1.3" fill="#0b1220" stroke={`url(#${uid}-ch)`} strokeWidth=".9" />
        <g stroke={`url(#${uid}-ch)`} strokeWidth=".5">
          <path d="M91.3 59 V72.8 M92.4 59 V72.8 M93.5 59 V72.8 M94.6 59 V72.8 M95.7 59 V72.8" />
        </g>
        <rect x="90.8" y="71.8" width="4.8" height="2" rx=".45" fill="#0b1220" stroke={`url(#${uid}-ch)`} strokeWidth=".35" />
        {/* Фары и фонарь */}
        <rect x="83.2" y="58.6" width="7.2" height="2.5" rx=".7" fill="#f8fafc" />
        <rect x="84" y="59.3" width="5.6" height="1" rx=".45" fill="#bae6fd" />
        <path d="M5.6 60 L9.4 60.6 L9.3 67.2 L5.6 66.6 Z" fill="#dc2626" />
        <path d="M5.9 61.3 L9 61.8" stroke="#fecaca" strokeWidth=".5" opacity=".9" />
        <rect x="86.6" y="77.4" width="8.6" height="2.2" rx="1.1" fill={`url(#${uid}-ch)`} />
        <rect x="5.8" y="77.4" width="7.6" height="2.2" rx="1.1" fill={`url(#${uid}-ch)`} />
        <path d="M40 79.4 L88.4 79.4 L90 80.4 L36 80.4 Z" fill="#94a3b8" opacity=".35" />
        <text x="17.6" y="70.2" fontFamily="Arial, Helvetica, sans-serif" fontSize="2" letterSpacing=".45" fill="#475569" opacity=".9">MAYBACH</text>
      </g>

      <Wheels uid={uid} g={g} accent={accent} deep={deep} r={10} archR={11.2} style="turbine" caliper="#a16207" cap={accent} archColor="#94a3b8" archWidth={0.55} />

      <Cabin
        uid={uid}
        pts={[
          [g.aBase, 57.2],
          [g.roofFront, g.roofY],
          [g.roofRear, g.roofY + 0.4],
          [g.cBase, 55.6],
        ]}
        paint={main}
        deep={deep}
        accent={accent}
        bar={0.5}
        trimWidth={0.8}
        roofBand={0.16}
      />
      {/* Двойная M на задней стойке */}
      <g stroke="#94a3b8" strokeWidth=".45" fill="none" strokeLinecap="round">
        <path d="M41.4 55.4 L41.4 52.8 L39.9 54.7 L38.4 52.8 L38.4 55.4" />
        <path d="M40.9 56.2 L40.9 53.6 L39.4 55.5 L37.9 53.6 L37.9 56.2" />
      </g>
      <text x="93.4" y="73.2" fontFamily="Arial, Helvetica, sans-serif" fontSize="1.1" letterSpacing=".1" fill={accent} textAnchor="middle">MAYBACH</text>
      <path d="M59.2 55.2 L64.6 54 Q66 53.8 66.4 55 L66.8 56.2 L60.4 57 Z" fill={main} stroke={deep} strokeWidth=".45" />
    </g>
  );
}

// ── Lamborghini ─────────────────────────────────────────────────────────────
/** Низкий клин: Y-образные фары, воздухозаборник, антикрыло, Y-спицы. */
function Lamborghini({ uid, colors }: { uid: string; colors: CarColors }) {
  const [main, deep, accent] = colors;
  const body =
    'M3.8 80.4 L3.8 60.4 L9.4 56.6 L21.6 53.8 Q25.2 53 28.4 50.8 L37.2 45 Q40 43.6 43.6 43.8 L54 44.4 L66.4 54.4 L76.6 56.4 L92.6 60.4 L95.8 63.4 L95.8 78.4 Q95.8 80.4 93 80.4 Z';
  const arches = [
    { cx: 23.8, cy: 80.4, r: 11.7 },
    { cx: 75.8, cy: 80.4, r: 11.7 },
  ];
  return (
    <g>
      <Defs uid={uid} deep={deep} accent={accent} />
      <BodyMask uid={uid} body={body} arches={arches} />
      <Ground y={91.9} />
      <g mask={`url(#${uid}-m)`}>
        <path d={body} fill={main} />
        <path d={body} fill={`url(#${uid}-bd)`} />
        {/* Рёбра клина */}
        <Line d="M5 58.4 L19 55 L30.4 52.2 L44 51.4 L55.6 54.2 L70 55.8 L93 59.6" color="#ffffff" opacity={0.32} w={0.7} />
        <Line d="M5.4 60.2 L19.2 56.8 L30.4 54 L44 53.2 L55.6 56 L70 57.6 L93 61.4" color="#000000" opacity={0.24} w={0.6} />
        <Line d="M7 67.6 Q40 65.2 95 68.6" color="#ffffff" opacity={0.16} w={0.55} />
        {/* Воздухозаборник с сеткой */}
        <path d="M54.4 55.4 L60 54.8 L62.6 66 L56.4 66.8 Z" fill="#0b0f16" />
        <g stroke="#3a4152" strokeWidth=".3" opacity=".9">
          <path d="M56 56.2 L57.4 66.4 M57.8 55.9 L59.2 66.2 M59.6 55.6 L60.8 66" />
          <path d="M54.9 58.2 L61.4 57.6 M55.3 60.6 L61.8 60 M55.7 63 L62.2 62.4 M56.1 65.4 L62.6 64.8" />
        </g>
        <path d="M56.2 53 L53.4 53.8" stroke={accent} strokeWidth=".85" strokeLinecap="round" />
        {/* Кормовые Y-фонари и выхлоп */}
        <path d="M4.6 60 L8 61.2 L4.8 64.4" fill="none" stroke="#ef4444" strokeWidth="1.05" strokeLinecap="round" />
        <path d="M5 61.2 L7.6 62.2" stroke="#fecaca" strokeWidth=".4" opacity=".8" />
        <rect x="6" y="76.6" width="5" height="1.9" rx=".9" fill="#151922" stroke="#475569" strokeWidth=".3" />
        <rect x="6" y="76.6" width="5" height="1.9" rx=".9" fill="none" stroke={accent} strokeWidth=".3" opacity=".8" />
        {/* Чёрный диффузор и сплиттер */}
        <path d="M4.4 77.8 L95.6 77.8 L95.6 78.8 Q95.6 80.4 92.4 80.4 L6.6 80.4 Q4.4 80.4 4.4 78.8 Z" fill="#0c0f15" />
        <path d="M4.4 77.8 L95.6 77.8" stroke={accent} strokeWidth=".5" opacity=".9" />
        <path d="M18 80.4 L22 78.2 L26 80.4 Z" fill={deep} opacity=".6" />
        <path d="M88 77.6 L95.8 77.6 L95.8 79.8 L88 80.4 Z" fill="#151922" />
      </g>

      <Wheels uid={uid} g={{ ...BASE_GEOM, rearWheel: 23.8, frontWheel: 75.8 }} accent="#c8d0dc" deep={deep} r={11} archR={11.7} style="y" spokes={5} spokeW={1.5} caliper={accent} cap="#111827" archColor="#111827" archWidth={0.9} />

      {/* Антикрыло на корме */}
      <path d="M4.4 54.2 L20.4 52.8 L20.8 54.2 L4.6 56 Z" fill={deep} />
      <path d="M4.8 54.5 L20.4 53.3" stroke="#ffffff" strokeWidth=".35" opacity=".3" />
      <path d="M8.4 55.2 L8.8 58.4 M17.4 54.6 L17.8 57.8" stroke={deep} strokeWidth=".9" strokeLinecap="round" />
      <path d="M4.8 57.8 Q8 57.4 10.2 56.2 M16.2 56 Q18.6 56.4 20.5 57.2" fill="none" stroke={deep} strokeWidth=".55" opacity=".8" />
      {/* Узкое остекление */}
      <Cabin
        uid={uid}
        pts={[
          [65.4, 53.6],
          [52.8, 44.4],
          [38.4, 44.2],
          [31, 51.4],
        ]}
        paint={main}
        deep={deep}
        accent={accent}
        bar={0.5}
        trimWidth={0.85}
        roofBand={0.2}
      />
      <path d="M39.6 44.4 Q48 42.6 55 44.6" fill="none" stroke="#ffffff" strokeOpacity=".3" strokeWidth=".85" strokeLinecap="round" />
      {/* Y-образные фары */}
      <path d="M86.6 61.4 L93 62.8 L89 64.8" fill="none" stroke="#f8fafc" strokeWidth="1.15" strokeLinecap="round" />
      <path d="M86.8 63.2 L90.6 64" stroke="#7dd3fc" strokeWidth=".9" strokeLinecap="round" />
      <circle cx="87.6" cy="62" r=".55" fill="#e0f2fe" />
    </g>
  );
}

// ── Bugatti Chiron ──────────────────────────────────────────────────────────
/** Двухцветный гиперкар: подкова решётки, C-линия, четыре точки фар, EB. */
function Bugatti({ uid, colors }: { uid: string; colors: CarColors }) {
  const [main, deep, accent] = colors;
  const silver = '#e8edf4';
  const g: SedanGeom = { ...BASE_GEOM, roofY: 47.4, roofFront: 53.8, roofRear: 30.2, aBase: 64.8, cBase: 20.2, noseTop: 58.6, tailTop: 53.6, frontWheel: 75.6, rearWheel: 24.2 };
  const body =
    'M3.8 80.4 L3.8 57.4 Q3.8 56 5.6 55.8 L20 54.4 Q24 54 26.6 51.8 L38.4 42.4 Q41.4 41 45 41.2 L56.6 42 L68.4 51.8 L78.6 54.2 L92.4 58.4 L95.8 61.4 L95.8 78.4 Q95.8 80.4 93 80.4 Z';
  const arches = [
    { cx: 24.4, cy: 80.4, r: 11.4 },
    { cx: 75.4, cy: 80.4, r: 11.4 },
  ];
  const belt = 70.6;
  return (
    <g>
      <Defs uid={uid} deep={deep} accent={accent} paint2={silver} />
      <BodyMask uid={uid} body={body} arches={arches} />
      <Ground />
      <g mask={`url(#${uid}-m)`}>
        <path d={body} fill={main} />
        <path d={body} fill={`url(#${uid}-bd)`} />
        <path d={`M3.8 80.4 L3.8 ${belt} Q30 ${belt - 2} 55.4 ${belt - 1.6} Q76 ${belt - 1.2} 95.8 ${belt + 0.8} L95.8 78.4 Q95.8 80.4 93 80.4 Z`} fill={silver} />
        <path d={`M3.8 80.4 L3.8 ${belt} Q30 ${belt - 2} 55.4 ${belt - 1.6} Q76 ${belt - 1.2} 95.8 ${belt + 0.8} L95.8 78.4 Q95.8 80.4 93 80.4 Z`} fill={`url(#${uid}-p2)`} />
        <path d={`M3.8 ${belt} Q30 ${belt - 2} 55.4 ${belt - 1.6} Q76 ${belt - 1.2} 95.8 ${belt + 0.8}`} fill="none" stroke={deep} strokeWidth=".7" opacity=".5" />
        {/* Фирменная C-линия */}
        <path d="M70 52.6 Q75.2 58.4 73.2 64.2 Q70.8 70.2 62.6 71.4 Q54.6 72.6 50.8 75.8" fill="none" stroke={deep} strokeWidth="1.35" strokeLinejoin="round" />
        <path d="M70 51.8 Q75.8 57.8 73.8 64.4 Q71.4 71 63 72.2 Q55 73.4 51.2 76.6" fill="none" stroke="#ffffff" strokeWidth=".3" opacity=".35" />
        <Line d="M6 63 Q40 60.6 94.8 64" color="#ffffff" opacity={0.18} w={0.55} />
        {/* Жабры за дверью */}
        <g stroke={deep} strokeWidth=".35" opacity=".55">
          <path d="M52.4 61.6 L57.4 61.4 M52.8 63.2 L57.8 63 M53.2 64.8 L58.2 64.6" />
        </g>
        {/* Подкова решётки */}
        <path d="M92.8 65.4 Q94.2 68.4 94.2 72 L94.2 75.4 L96 75.4 L96 72 Q96 68.2 94.8 65 Z" fill="#0b1220" stroke={`url(#${uid}-ch)`} strokeWidth=".5" />
        <path d="M93.4 66.8 Q94.4 69.2 94.4 72" fill="none" stroke="#94a3b8" strokeWidth=".3" />
        <path d="M4.4 62 L8.8 62.8 L4.8 66.4 L4.4 64.2 Z" fill="#ef4444" />
        <path d="M4.8 63.2 L7.6 63.8" stroke="#fecaca" strokeWidth=".4" opacity=".85" />
        <path d="M4.6 55.2 L14.6 54.4 L14.8 55.6 L4.8 56.4 Z" fill={deep} />
        <path d="M4.4 78.4 L95.6 78.4 L95.6 79 Q95.6 80.4 94.2 80.4 L6.4 80.4 Q4.4 80.4 4.4 79 Z" fill="#0c0f15" />
        <path d="M4.4 78.4 L95.6 78.4" stroke={accent} strokeWidth=".4" opacity=".8" />
      </g>

      <Wheels uid={uid} g={g} accent="#c8d0dc" deep={deep} r={10.8} archR={11.4} style="twin" spokes={10} spokeW={1.05} caliper="#1d4ed8" cap="#1d4ed8" archWidth={0.6} />

      {/* Воздухозаборник на крыше и рёбра заднего стекла */}
      <path d="M33 41.4 L38.8 41.6 L36.4 43 L32.2 42.8 Z" fill={deep} opacity=".85" />
      <path d="M22.6 50.6 L28.4 44.4" stroke={deep} strokeWidth=".5" opacity=".7" />
      <path d="M25.4 52.2 L31.6 45.8" stroke={deep} strokeWidth=".5" opacity=".5" />
      {/* Низкая кабина */}
      <Cabin
        uid={uid}
        pts={[
          [67, 52.4],
          [55.4, 42.4],
          [28.4, 42.2],
          [20.4, 52.4],
        ]}
        paint={main}
        deep={deep}
        accent={accent}
        bar={0.5}
        trimWidth={0.7}
        roofBand={0.2}
      />
      <path d="M41.4 43.6 Q49.4 41.8 56.4 43.8" fill="none" stroke="#ffffff" strokeOpacity=".34" strokeWidth=".85" strokeLinecap="round" />
      {/* Четыре точки фар и EB */}
      <rect x="85.8" y="59.2" width="8.4" height="3.4" rx="1" fill="#0b1220" opacity=".7" />
      <g fill="#f8fafc">
        <rect x="86.8" y="59.9" width="1.2" height="1.2" rx=".28" />
        <rect x="88.5" y="60" width="1.2" height="1.2" rx=".28" />
        <rect x="90.2" y="60.1" width="1.2" height="1.2" rx=".28" />
        <rect x="86.8" y="61.5" width="1.2" height="1.2" rx=".28" opacity=".7" />
        <rect x="88.5" y="61.6" width="1.2" height="1.2" rx=".28" opacity=".7" />
        <rect x="90.2" y="61.7" width="1.2" height="1.2" rx=".28" opacity=".7" />
      </g>
      <text x="88.8" y="58.4" fontFamily="Georgia, serif" fontSize="1.85" fontWeight="700" fill={deep} textAnchor="middle" opacity=".7">EB</text>
    </g>
  );
}

// ── Гоночная машина ─────────────────────────────────────────────────────────
/** Низкий кузов, антикрыло на стойках, номер на двери и полосы по капоту. */
function Racer({ uid, colors }: { uid: string; colors: CarColors }) {
  const [main, deep, accent] = colors;
  const g: SedanGeom = {
    ...BASE_GEOM,
    roofY: 52.4,
    roofFront: 55.4,
    roofRear: 34,
    aBase: 62.6,
    cBase: 22,
    noseTop: 63.2,
    tailTop: 55.4,
    frontWheel: 76,
    rearWheel: 24.2,
  };
  const body =
    'M4.4 80.4 L4.4 64 Q4.4 62.4 6.6 62.2 L22.4 61.6 L31 49.6 Q32 48.4 34 48.4 L52.4 48.4 Q54.4 48.4 55.4 49.8 L64.6 61.4 L90.6 61.8 Q95.2 62 95.6 66 L95.6 78.2 Q95.6 80.4 93 80.4 Z';
  const arches = [
    { cx: 24.2, cy: 80.4, r: 11.8 },
    { cx: 76, cy: 80.4, r: 11.8 },
  ];
  return (
    <g>
      <Defs uid={uid} deep={deep} accent={accent} />
      <BodyMask uid={uid} body={body} arches={arches} />
      <Ground y={92} />
      <g mask={`url(#${uid}-m)`}>
        <path d={body} fill={main} />
        <path d={body} fill={`url(#${uid}-bd)`} />
        {/* Полосы по капоту и двери */}
        <path d="M56 50.4 L64.8 61.2 L95.4 61.8 L95.4 64.4 L64.4 63.8 L55.4 52.4 Z" fill="#ffffff" opacity=".85" />
        <path d="M30.4 50 L33.4 50 L33.4 61.6 L30.4 61.6 Z" fill="#ffffff" opacity=".55" />
        {/* Ручка и шов двери */}
        <path d="M45.6 63.4 L45.6 80.2" stroke="#000" strokeOpacity=".24" strokeWidth=".7" />
        <rect x="48.4" y="66.2" width="5.4" height="1.2" rx=".6" fill={accent} />
        <Rocker x1={37} x2={63} deep={deep} y={80.4} />
        {/* Номер на двери */}
        <circle cx="39.6" cy="70" r="4.1" fill="#ffffff" opacity=".9" />
        <text x="39.6" y="71.8" fontFamily="Arial, Helvetica, sans-serif" fontSize="5" fontWeight="700" fill={deep} textAnchor="middle">7</text>
        {/* Выхлоп и фонарь */}
        <rect x="5.4" y="77.4" width="5.4" height="1.9" rx=".9" fill="#94a3b8" />
        <path d="M4.6 64.8 L8.4 65.4 L8.3 71.4 L4.6 70.8 Z" fill="#ef4444" />
        <path d="M5 66.1 L8 66.6" stroke="#fecaca" strokeWidth=".5" opacity=".9" />
        {/* Воздухозаборник на капоте и сплиттер */}
        <path d="M70 62.6 L76.6 62.8 L76 66.4 L69.6 66.2 Z" fill={deep} opacity=".8" />
        <path d="M69.8 62.7 L76.6 62.9" stroke={accent} strokeWidth=".4" opacity=".9" />
        <path d="M84 77.4 L95.4 77.4 L95.4 79.6 L84 80.4 Z" fill={deep} opacity=".6" />
      </g>

      <Wheels uid={uid} g={g} accent={accent} deep={deep} r={11} archR={11.8} spokeW={1.5} spokes={6} caliper={accent} cap="#111827" archWidth={0.9} />

      {/* Антикрыло на стойках от багажника */}
      <path d="M5 51.6 L21 50.2 L21.4 52 L5.2 53.6 Z" fill={deep} />
      <path d="M5.4 52 L21 50.8" stroke="#ffffff" strokeWidth=".35" opacity=".3" />
      <path d="M9.4 53 L9.8 57.6 M18 52.4 L18.4 57.2" stroke={deep} strokeWidth="1" strokeLinecap="round" />

      {/* Низкая кабина */}
      <Cabin
        uid={uid}
        pts={[
          [63, 60.4],
          [52.8, 50.4],
          [36, 50.2],
          [29, 59.4],
        ]}
        paint={main}
        deep={deep}
        accent={accent}
        bar={0.5}
        trimWidth={0.8}
        roofBand={0.16}
      />
      {/* Зеркало и фара */}
      <path d="M62.6 59.4 L66.8 58.4 Q68 58.2 68.3 59.2 L68.6 60.2 L63.4 60.8 Z" fill={main} stroke={deep} strokeWidth=".4" />
      <path d="M87 62.2 L95 63.4 L95 65.8 L86.6 64.8 Z" fill="#eef6ff" opacity=".95" />
      <path d="M87.8 63.5 L94.4 64.4" stroke="#7dd3fc" strokeWidth=".85" strokeLinecap="round" />
    </g>
  );
}

// ── Джип ────────────────────────────────────────────────────────────────────
/** Высокий кузов, решётка с вертикальными прорезями, багажник на крыше, запаска. */
function Jeep({ uid, colors }: { uid: string; colors: CarColors }) {
  const [main, deep, accent] = colors;
  const body =
    'M6 80.4 L6 52.6 Q6 50.6 8.6 50.4 L27.6 50.2 L32.4 39.4 Q33.2 37.8 35.2 37.8 L57.4 37.8 Q59.4 37.8 60.2 39.4 L64.6 50.2 L88.6 50.4 Q95 50.4 95.4 56 L95.4 78.2 Q95.4 80.4 92.6 80.4 Z';
  const arches = [
    { cx: 24.4, cy: 80.4, r: 12.6 },
    { cx: 77.2, cy: 80.4, r: 12.6 },
  ];
  return (
    <g>
      <Defs uid={uid} deep={deep} accent={accent} />
      <BodyMask uid={uid} body={body} arches={arches} />
      <Ground y={92.2} />
      <g mask={`url(#${uid}-m)`}>
        <path d={body} fill={main} />
        <path d={body} fill={`url(#${uid}-bd)`} />
        <path d="M6.4 78.6 L95 78.6" stroke="#000" strokeOpacity=".26" strokeWidth="1.6" />
        <Line d="M8 55.6 Q40 54.4 94.8 55.2" color="#ffffff" opacity={0.24} w={0.6} />
        <Line d="M8 58 Q40 56.8 94.8 57.6" color="#000000" opacity={0.16} w={0.7} />
        {/* Петли и ручки Jeep */}
        <path d="M50.6 52.4 L50.6 79.4" stroke="#000" strokeOpacity=".3" strokeWidth=".8" />
        <path d="M33.4 53 L33.4 79.4" stroke="#000" strokeOpacity=".22" strokeWidth=".7" />
        <rect x="54.6" y="62" width="5.6" height="1.4" rx=".7" fill={deep} />
        <rect x="37.4" y="62.2" width="5.6" height="1.4" rx=".7" fill={deep} />
        <Rocker x1={37} x2={64.4} deep={deep} y={80.4} />
        {/* Решётка радиатора с вертикальными прорезями */}
        <rect x="89.4" y="56.6" width="6" height="14" rx="1.2" fill={deep} opacity=".9" />
        <g stroke={accent} strokeWidth=".6" opacity=".9">
          <path d="M90.6 58 V69.2 M91.8 58 V69.2 M93 58 V69.2 M94.2 58 V69.2" />
        </g>
        <circle cx="86.4" cy="60" r="2.6" fill="#f8fafc" />
        <circle cx="86.4" cy="60" r="2.6" fill="none" stroke={deep} strokeWidth=".4" />
        <path d="M84.6 58.2 L88.2 61.8 M88.2 58.2 L84.6 61.8" stroke={deep} strokeWidth=".4" opacity=".8" />
        {/* Фара и фонарь */}
        <rect x="82.6" y="56.4" width="3.2" height="3.2" rx=".6" fill="#fff7d6" stroke={deep} strokeWidth=".35" />
        <rect x="6.4" y="57.2" width="3.2" height="6.4" rx=".8" fill="#ef4444" />
        <path d="M6.8 58.6 L9.2 58.6" stroke="#fecaca" strokeWidth=".5" opacity=".85" />
        {/* Бампер и порог */}
        <rect x="5" y="75.4" width="6.4" height="2.6" rx="1" fill={deep} opacity=".85" />
        <rect x="87" y="74.6" width="8.6" height="2.8" rx="1.1" fill={deep} opacity=".85" />
        <path d="M37.4 78.8 L88 78.8 L88 80.2 L37.4 80.2 Z" fill={deep} opacity=".4" />
      </g>

      <Wheels uid={uid} g={{ ...BASE_GEOM, rearWheel: 24.4, frontWheel: 77.2 }} accent="#9aa6b8" deep={deep} r={11.8} archR={12.6} style="solid" spokes={6} caliper={accent} cap="#111827" archColor={deep} archWidth={1} />

      {/* Окна: плоские, почти вертикальные стойки */}
      <path d="M29.6 49.4 L34.4 40.4 L47.4 40.4 L47.4 49.4 Z" fill={`url(#${uid}-gl)`} />
      <path d="M49.4 40.4 L56.6 40.4 L61 49.4 L49.4 49.4 Z" fill={`url(#${uid}-gl)`} />
      <path d="M30.6 48.2 L35 40.8 L46 40.8" fill="none" stroke="#ffffff" strokeWidth=".8" opacity=".2" strokeLinecap="round" />
      <rect x="47.4" y="40.3" width="2" height="9.3" fill={deep} />
      <path d="M28.8 49.6 L34 38.4 Q34.6 37.4 36.2 37.4 L56.4 37.4 Q58 37.4 58.6 38.6 L63.4 49.4" fill="none" stroke={deep} strokeWidth="1.2" />
      {/* Багажник на крыше */}
      <path d="M34.6 36.8 L57 36.8" stroke={deep} strokeWidth="1.3" strokeLinecap="round" />
      <path d="M36.6 36.8 L36.6 33.4 M46 36.8 L46 33.2 M55 36.8 L55 33.4" stroke={deep} strokeWidth=".8" />
      <path d="M35.4 33.2 L56.2 33.2" stroke={deep} strokeWidth=".9" strokeLinecap="round" />
      {/* Запаска на корме */}
      <circle cx="8.6" cy="66.4" r="5.2" fill="#14171f" stroke="#05070b" strokeWidth=".6" />
      <circle cx="8.6" cy="66.4" r="3.9" fill="#2a2f3b" />
      <circle cx="8.6" cy="66.4" r="1.6" fill="#8d99ad" />
      {/* Зеркало и шноркель */}
      <path d="M60.4 50 L65.4 49 Q66.6 48.8 66.9 49.8 L67.2 50.8 L61.4 51.6 Z" fill={main} stroke={deep} strokeWidth=".45" />
      <path d="M62.6 46 L64.4 46 L64.4 40.8 L62.8 40.8 Z" fill={deep} />
    </g>
  );
}

// ── Такси ───────────────────────────────────────────────────────────────────
/** Жёлтый седан с шашечками по борту и фонариком на крыше. */
function Taxi({ uid, colors }: { uid: string; colors: CarColors }) {
  const [main, deep, accent] = colors;
  const g = BASE_GEOM;
  const body = sedanBody(g);
  const arches = [
    { cx: g.rearWheel, cy: 80.4, r: 11.5 },
    { cx: g.frontWheel, cy: 80.4, r: 11.5 },
  ];
  const checkers = Array.from({ length: 16 }, (_, i) => (
    <rect key={i} x={24.8 + i * 2.6} y={65.2} width="2.6" height="2.5" fill={i % 2 === 0 ? '#ffffff' : '#111827'} opacity=".95" />
  ));
  return (
    <g>
      <Defs uid={uid} deep={deep} accent={accent} />
      <BodyMask uid={uid} body={body} arches={arches} />
      <Ground />
      <g mask={`url(#${uid}-m)`}>
        <path d={body} fill={main} />
        <path d={body} fill={`url(#${uid}-bd)`} />
        <path d={`M${g.aBase + 1} 57.4 L${g.aBase + 1} 79.6`} stroke="#000" strokeOpacity=".14" strokeWidth=".55" />
        <path d="M45.8 57.6 L45.8 80.2" stroke="#000" strokeOpacity=".26" strokeWidth=".75" />
        <path d="M63.8 57.4 L63.8 80.2" stroke="#000" strokeOpacity=".14" strokeWidth=".6" />
        <path d="M27.8 57.4 Q27 69 27.6 80.2" stroke="#000" strokeOpacity=".12" strokeWidth=".6" />
        <rect x="49.6" y="60.4" width="5.8" height="1.2" rx=".6" fill={accent} />
        <rect x="36.8" y="60.6" width="5.8" height="1.2" rx=".6" fill={accent} />
        {checkers}
        <Line d="M6.6 72 Q50 70.4 94.8 71.2" color="#000000" opacity={0.12} w={0.6} />
        <Rocker x1={34} x2={65.6} deep={deep} />
        <circle cx="26.2" cy="74.4" r="1.9" fill="none" stroke="#000" strokeOpacity=".14" strokeWidth=".5" />
        <path d="M5.8 60.8 L10.4 61.4 L10.2 67.8 L5.8 67.2 Z" fill="#dc2626" />
        <path d="M6.1 62.1 L9.8 62.6" stroke="#fecaca" strokeWidth=".5" opacity=".9" />
        <path d="M85.4 75.2 L95.4 75.2 L95.4 78.2 Q95.4 80.4 92.2 80.4 L85.4 80.4 Z" fill={deep} opacity=".4" />
        <rect x="87.6" y="77.4" width="6.4" height="1.8" rx=".9" fill={accent} />
        <rect x="89.6" y="60" width="5.8" height="14.4" rx="1.4" fill={deep} opacity=".9" />
        <g stroke={accent} strokeWidth=".4">
          <path d="M90.8 61.4 H94.4 M90.8 63.6 H94.4 M90.8 65.8 H94.4 M90.8 68 H94.4 M90.8 70.2 H94.4" />
        </g>
      </g>

      <Wheels uid={uid} g={g} accent={accent} deep={deep} caliper={accent} cap="#111827" archColor="#111827" archWidth={0.6} />

      {/* Фонарик «ТАКСИ» на крыше */}
      <rect x="45.4" y="36.2" width="11.6" height="4.6" rx="1.4" fill={accent} stroke={deep} strokeWidth=".5" />
      <text x="51.2" y="39.7" fontFamily="Arial, Helvetica, sans-serif" fontSize="2.4" fontWeight="700" fill={main} textAnchor="middle">TAXI</text>

      <Cabin
        uid={uid}
        pts={[
          [g.aBase, 57],
          [g.roofFront, g.roofY],
          [g.roofRear, g.roofY + 0.4],
          [g.cBase + 1.2, 55.8],
        ]}
        paint={main}
        deep={deep}
        accent={accent}
        bar={0.47}
      />
      <path d="M61.4 56 L66.6 54.8 Q68 54.6 68.4 55.8 L68.8 57 L62.6 57.8 Z" fill={main} stroke={deep} strokeWidth=".45" />
      {/* Шашечки по борту, дублируем поверх стекла двери */}
      <path d="M23.4 61.6 L66 61.6" stroke="#111827" strokeWidth=".5" opacity=".35" />
      <path d="M84.4 57.2 L95.2 58.8 L95.2 61.6 L84 60 Z" fill="#f8fafc" opacity=".95" />
      <path d="M85.2 58.7 L94.6 60" stroke="#7dd3fc" strokeWidth=".85" strokeLinecap="round" />
    </g>
  );
}

const DRAW: Record<string, (p: { uid: string; colors: CarColors }) => JSX.Element> = {
  'car-racer': Racer,
  'car-jeep': Jeep,
  'car-taxi': Taxi,
  'car-bmw': Bmw,
  'car-mercedes': Mercedes,
  'car-rolls': Rolls,
  'car-maybach': Maybach,
  'car-brabus': Brabus,
  'car-lambo': Lamborghini,
  'car-bugatti': Bugatti,
};

/** Есть ли для вещи подробный автомобильный арт. */
export function hasCarArt(id: string): boolean {
  return id in DRAW;
}

/** Рисунок автомобиля в сетке 100×100 (только группа, без <svg>). */
export function CarBody({ id, colors }: { id: string; colors: CarColors }) {
  const Draw = DRAW[id];
  if (!Draw) return null;
  return <Draw uid={id} colors={colors} />;
}

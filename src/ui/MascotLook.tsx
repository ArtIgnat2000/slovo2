import type { ShopSlot } from '../types';

/**
 * Аксессуары БУКа — чистая SVG-графика поверх той же системы координат (100×120),
 * что и сам маскот (голова: центр 50,37; шея ≈ y 64–78; глаза у 36 и 64).
 * Никаких картинок-файлов: работает офлайн, весит ноль, перекрашивается кодом.
 */
export function MascotAccessory({ id }: { id: string }) {
  switch (id) {
    case 'cap':
      return (
        <g>
          <path d="M20 26 A30 30 0 0 1 80 26 Q50 10 20 26 Z" fill="#3b82f6" />
          <path d="M18 26 Q50 34 82 26 L82 31 Q50 39 18 31 Z" fill="#2b6be0" />
          <circle cx="50" cy="13" r="3.4" fill="#ffd166" />
        </g>
      );
    case 'grad':
      return (
        <g>
          <path d="M50 4 L88 20 L50 34 L12 20 Z" fill="#241f36" />
          <path d="M36 26 L36 34 Q50 42 64 34 L64 26 Q50 33 36 26 Z" fill="#3a3352" />
          <path d="M78 22 L82 44" stroke="#f4a51a" strokeWidth="2.6" strokeLinecap="round" fill="none" />
          <circle cx="82" cy="47" r="4" fill="#f4a51a" />
        </g>
      );
    case 'glasses':
      return (
        <g>
          <circle cx="36" cy="37" r="15" fill="rgba(120,180,255,.20)" stroke="#241f36" strokeWidth="3" />
          <circle cx="64" cy="37" r="15" fill="rgba(120,180,255,.20)" stroke="#241f36" strokeWidth="3" />
          <path d="M48 36 Q50 33 52 36" stroke="#241f36" strokeWidth="3" fill="none" />
          <path d="M21 33 L12 30 M79 33 L88 30" stroke="#241f36" strokeWidth="3" strokeLinecap="round" fill="none" />
        </g>
      );
    case 'bow':
      return (
        <g>
          <path d="M50 70 L26 60 Q20 70 26 80 Z" fill="#ff6fb5" />
          <path d="M50 70 L74 60 Q80 70 74 80 Z" fill="#ff6fb5" />
          <circle cx="50" cy="70" r="5.4" fill="#ff4fa0" />
        </g>
      );
    case 'scarf':
      return (
        <g>
          <path d="M22 64 Q50 80 78 64 L80 74 Q50 90 20 74 Z" fill="#f43f5e" />
          <path d="M30 74 Q26 88 30 100 L40 98 Q36 86 40 76 Z" fill="#e03556" />
          <path d="M32 82 L39 81 M31 91 L38 90" stroke="#ffd166" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        </g>
      );
    case 'medal':
      // медаль ниже шеи: тогда она не спорит с бантом и шарфом (оба — слот «шея»)
      return (
        <g>
          <path d="M42 70 L50 84 L58 70 Z" fill="#3b82f6" />
          <circle cx="50" cy="94" r="10" fill="#f4a51a" stroke="#e8901a" strokeWidth="2" />
          <path d="M50 88.5 L52.4 92.5 L57 93.2 L53.6 96.4 L54.5 101 L50 98.6 L45.5 101 L46.4 96.4 L43 93.2 L47.6 92.5 Z" fill="#fff8ec" />
        </g>
      );
    default:
      return null;
  }
}

/** Порядок слоёв отрисовки: значки и шея ниже, головные уборы и очки — поверх. */
export const SLOT_ORDER: ShopSlot[] = ['badge', 'neck', 'head', 'face'];

// ── Костюмы (пазлы, engine/puzzles.ts) ───────────────────────────────────────
// Та же сетка 100×120. Цвета туловища/живота/крыльев для костюма задаёт палитра
// COSTUMES — здесь только «железо»: плащ (под телом), шлемы (поверх лица) и реквизит.
// Всё нарисовано кодом: ноль веса, офлайн, перекраска под тёмную тему не нужна.

import type { Costume } from '../engine/puzzles';

/** Плащ — рисуется ПЕРЕД телом, чтобы торчали только полы. */
export function CostumeCape({ c }: { c: Costume }) {
  if (!c.cape) return null;
  return <path d="M26 60 Q4 88 12 117 L88 117 Q96 88 74 60 Q50 74 26 60Z" fill={c.cape} opacity="0.96" />;
}

/** Шлемы и головные уборы — рисуем ПОСЛЕ аксессуаров, поверх мордочки. */
export function CostumeHead({ c }: { c: Costume }) {
  switch (c.helmet) {
    case 'mask': // «Стальной страж»: тёмный штурмовик — бровка-«очки», нос-трубка, щель рта
      return (
        <g>
          <path d="M20 42 A30 31 0 0 1 80 42 Q65 33 50 38 Q35 33 20 42Z" fill={c.trim} />
          <path d="M27 32 L38 37 M73 32 L62 37" stroke={c.glow} strokeWidth="2.6" strokeLinecap="round" fill="none" />
          <path d="M48.3 43 H51.7 V52 H48.3Z" fill={c.trim} />
          <path d="M43.5 55.5 H56.5" stroke={c.trim} strokeWidth="2.2" strokeLinecap="round" />
        </g>
      );
    case 'lord-mask': {
      // «Тёмный лорд»: шлем по мотивам киношного оригинала — колоколообразный купол
      // с раструбом, гребень-«мохавк», V-бровка, «черепные» скулы, серебро носа,
      // ДВА треугольных ротовых вентиля с решёткой, «клыки»-кнопки, ворот и нагрудная панель.
      const silver = '#cdd3e0';
      return (
        <g>
          {/* купол: чуть шире головы, нижний край — «юбкой» до уровня глаз */}
          <path d="M17 44 A33 34 0 0 1 83 44 L80 47 Q50 41 20 47Z" fill={c.trim} />
          {/* раструбы «колокола» по бокам */}
          <path d="M17 44 L11 52 Q17 54 24 49Z" fill={c.trim} />
          <path d="M83 44 L89 52 Q83 54 76 49Z" fill={c.trim} />
          {/* гребень на темени + центральный шов */}
          <path d="M44 13 Q50 2 56 13 Q50 9 44 13Z" fill={c.trim} />
          <path d="M50 10 V28" stroke={c.body} strokeWidth="1.6" opacity=".85" />
          {/* блик полированного металла */}
          <path d="M28 20 A23 23 0 0 1 44 11" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" fill="none" opacity=".3" />
          {/* V-бровка «впаяна» в нос: нахмуренный козырёк над глазами */}
          <path d="M21 30 L38 26 L50 33 L62 26 L79 30 L62 33 L50 40 L38 33Z" fill={c.trim} />
          <path d="M27 23 L38 27 M73 23 L62 27" stroke={c.glow} strokeWidth="2.4" strokeLinecap="round" fill="none" />
          {/* угловатые скулы — «черепной» силуэт */}
          <path d="M24 47 L37 58 L31 62 L20 52Z" fill={c.trim} />
          <path d="M76 47 L63 58 L69 62 L80 52Z" fill={c.trim} />
          {/* серебристый «нос-датчик» */}
          <path d="M46.5 42 L50 47.5 L53.5 42 Q50 44.5 46.5 42Z" fill={silver} />
          {/* верхний ротовой вентиль (больше) и нижний (меньше) — как в оригинале */}
          <path d="M39 48 L50 62 L61 48 Q50 54 39 48Z" fill={c.trim} />
          <path d="M44 52 H56 M45.5 55.5 H54.5 M47 58.5 H53" stroke={silver} strokeWidth="1.2" strokeLinecap="round" opacity=".95" />
          <path d="M45.5 63 L50 68 L54.5 63Z" fill={c.trim} />
          {/* «клыки» с круглыми концами по краям решётки */}
          <circle cx="36.5" cy="53" r="2" fill={silver} />
          <circle cx="63.5" cy="53" r="2" fill={silver} />
          {/* ворот шлема: переход к груди */}
          <path d="M37 62 Q50 69 63 62 L64 66 Q50 74 36 66Z" fill="#0d0b18" />
          {/* нагрудная панель управления с «войсковыми застёжками» */}
          <rect x="40.5" y="77" width="19" height="8" rx="2" fill="#0d0b18" />
          <rect x="43" y="79.2" width="3.2" height="3.6" rx=".6" fill="#ff3b4d" />
          <rect x="48.4" y="79.2" width="3.2" height="3.6" rx=".6" fill="#58b6ff" />
          <rect x="53.8" y="79.2" width="3.2" height="3.6" rx=".6" fill="#ffd166" />
        </g>
      );
    }
    case 'visor': // «Белый воин»: шлем клона — Т-визор под синим тонированным стеклом (глаза видно),
      // «таблетки» связи на висках и скуловые пластины
      return (
        <g>
          <path d="M20 42 A30 31 0 0 1 80 42 L80 45 Q50 40 20 45Z" fill={c.trim} />
          {/* гребень-основание антенны на темени */}
          <path d="M46 12 Q50 5 54 12 Q50 9 46 12Z" fill={c.wing} />
          {/* Т-визор: полупрозрачное стекло — фирменный силуэт клона, но БУК узнаваем */}
          <path d="M27 31 H73 L65 39 H55 L52 48 H48 L45 39 H35Z" fill={c.glow} opacity=".42" />
          <path d="M27 31 H73 L65 39 H55 L52 48 H48 L45 39 H35Z" fill="none" stroke="#1d4ed8" strokeWidth=".9" opacity=".8" />
          {/* коммуникаторы на висках */}
          <circle cx="24" cy="40" r="3.1" fill={c.wing} />
          <circle cx="76" cy="40" r="3.1" fill={c.wing} />
          {/* скуловые/челюстные пластины */}
          <path d="M29 46 L37 54 L32 57 L25 50Z" fill={c.wing} />
          <path d="M71 46 L63 54 L68 57 L75 50Z" fill={c.wing} />
        </g>
      );
    case 'hood': // «Мастер Света» / «Ученик Тьмы»: капюшон-кольцо и складки по бокам
      return (
        <g>
          <path d="M50 5 A32 32 0 0 0 18 37 L18 50 A32 32 0 0 1 82 50 L82 37 A32 32 0 0 0 50 5Z" fill={c.trim} />
          <path d="M18 52 Q14 70 20 82 L29 77 Q23 66 25 52Z" fill={c.trim} />
          <path d="M82 52 Q86 70 80 82 L71 77 Q77 66 75 52Z" fill={c.trim} />
          <path d="M25 30 Q50 12 75 30" stroke={c.glow} strokeWidth="2" fill="none" opacity="0.55" />
        </g>
      );
    case 'bubble': // «Пилот истребителя»: прозрачный купол со бликом
      return (
        <g>
          <circle cx="50" cy="38" r="31" fill="rgba(200,230,255,.18)" stroke={c.trim} strokeWidth="2.6" />
          <path d="M27 24 A27 27 0 0 1 43 11" stroke="#ffffff" strokeWidth="3" fill="none" strokeLinecap="round" opacity=".85" />
          <path d="M42 55 H58" stroke={c.trim} strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    case 'dome': // «Звёздный рейнджер»: купол с горизонтальной щелью-визором и антенной
      return (
        <g>
          <path d="M20 44 A30 30 0 0 1 80 44 L80 48 Q50 40 20 48Z" fill={c.trim} />
          {/* трапеция-щель вместо креста: «прищур» шлема между бровей */}
          <path d="M40 27 H60 L56 34 H44Z" fill={c.glow} opacity=".95" />
          <line x1="74" y1="16" x2="81" y2="5" stroke={c.glow} strokeWidth="2.2" />
          <circle cx="82.5" cy="3.6" r="2.4" fill={c.glow} />
        </g>
      );
    case 'plate': // «Храбрый дроид»: синяя шапка-купол, лицевые панели и корпус-панель
      return (
        <g>
          <path d="M21 38 A29 29 0 0 1 79 38 L79 42 H21Z" fill={c.trim} />
          <rect x="29" y="45" width="14" height="9" rx="2.5" fill={c.glow} opacity=".9" />
          <circle cx="67" cy="49" r="3.2" fill={c.glow} />
          <rect x="34" y="86" width="32" height="15" rx="3.5" fill="rgba(255,255,255,.55)" />
          <rect x="38" y="89.5" width="6.5" height="8" rx="1.5" fill={c.trim} />
          <rect x="47.5" y="89.5" width="6.5" height="8" rx="1.5" fill={c.glow} opacity=".8" />
        </g>
      );
    case 'buns': // «Командир звёзд»: пучки по бокам и диадема
      return (
        <g>
          <circle cx="16" cy="27" r="9" fill={c.trim} />
          <circle cx="84" cy="27" r="9" fill={c.trim} />
          <path d="M25 17 Q50 5 75 17" stroke={c.glow} strokeWidth="3" fill="none" strokeLinecap="round" />
          <circle cx="50" cy="9" r="3.4" fill={c.glow} />
        </g>
      );
    case 'ears': // «Лесной мудрец»: длинные уши и светлячок
      return (
        <g>
          <path d="M27 14 L19 2 L37 9Z" fill={c.wing} />
          <path d="M73 14 L81 2 L63 9Z" fill={c.wing} />
          <circle cx="91" cy="66" r="2.6" fill={c.glow} />
          <circle cx="91" cy="66" r="5" fill={c.glow} opacity=".25" />
        </g>
      );
    default:
      return null;
  }
}

/** Реквизит: светопосохи и посох-компас. Клинок цвета c.glow. */
export function CostumeProp({ c }: { c: Costume }) {
  if (c.prop === 'saber-red' || c.prop === 'saber-blue' || c.prop === 'saber-green') {
    return (
      <g transform="rotate(16 86 80)">
        <rect x="83.4" y="26" width="5.2" height="42" rx="2.6" fill={c.glow} />
        <rect x="84.7" y="28" width="2.6" height="38" fill="#ffffff" opacity=".85" />
        <rect x="82.8" y="68" width="6.4" height="18" rx="2.2" fill="#241f36" />
        <rect x="82.8" y="74" width="6.4" height="2" fill="#6b6480" />
      </g>
    );
  }
  if (c.prop === 'cane') {
    return (
      <g transform="rotate(-12 16 82)">
        <rect x="13.6" y="48" width="4.2" height="42" rx="2" fill="#8a6a3e" />
        <circle cx="15.7" cy="45.5" r="4.4" fill={c.glow} />
      </g>
    );
  }
  return null;
}

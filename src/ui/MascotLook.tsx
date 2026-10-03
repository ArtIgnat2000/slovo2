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

/**
 * Проёмы под глаза (оба — эллипсы 8.6×8.4 вокруг 36,36 и 64,36).
 *
 * Сплошной шлем-купол закрывал мордочку целиком: на иконке магазина (64 px,
 * см. ShopScreen) БУК в «Тёмном лорде» выглядел тёмным пятном без глаз. Купол
 * рисуют одним путём с fillRule="evenodd" и этими подпутями — сквозь «дырки»
 * видны глаза, нарисованные слоем ниже, то есть они остаются живыми (mood).
 */
const EYE_WINDOWS =
  'M27.4 36 A8.6 8.4 0 1 0 44.6 36 A8.6 8.4 0 1 0 27.4 36Z M55.4 36 A8.6 8.4 0 1 0 72.6 36 A8.6 8.4 0 1 0 55.4 36Z';

/** Ободок проёма — «уплотнитель» шлема вокруг глаз, чтобы дырка не выглядела вырезом. */
function EyeRim() {
  return (
    <path
      d="M27.4 36 A8.6 8.4 0 1 0 44.6 36 A8.6 8.4 0 1 0 27.4 36 M55.4 36 A8.6 8.4 0 1 0 72.6 36 A8.6 8.4 0 1 0 55.4 36"
      fill="none"
      stroke="#7e88a6"
      strokeWidth="1.2"
      opacity=".85"
    />
  );
}

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
      // Купол рисуется с проёмами под глаза: раньше сплошная заливка съедала их, и на
      // иконке магазина (64 px) вместо лица было тёмное пятно.
      const silver = '#cdd3e0';
      return (
        <g>
          {/* купол: внешняя дуга + два внутренних подпути = окна-проёмы (fillRule evenodd) */}
          <path
            fillRule="evenodd"
            d={`M17 44 A33 34 0 0 1 83 44 L80 47 Q50 41 20 47Z ${EYE_WINDOWS}`}
            fill={c.trim}
          />
          <EyeRim />
          {/* верх век тонет под краем шлема: взгляд остаётся читаемым, но не «удивлённым» */}
          <path d="M28.6 31.4 Q36 27.6 43.4 31.4" fill="none" stroke="#0d0b18" strokeWidth="2.8" opacity=".6" strokeLinecap="round" />
          <path d="M56.6 31.4 Q64 27.6 71.4 31.4" fill="none" stroke="#0d0b18" strokeWidth="2.8" opacity=".6" strokeLinecap="round" />
          {/* раструбы «колокола» по бокам */}
          <path d="M17 44 L11 52 Q17 54 24 49Z" fill={c.trim} />
          <path d="M83 44 L89 52 Q83 54 76 49Z" fill={c.trim} />
          {/* гребень на темени + центральный шов */}
          <path d="M44 13 Q50 2 56 13 Q50 9 44 13Z" fill={c.trim} />
          <path d="M50 10 V26" stroke={c.body} strokeWidth="1.6" opacity=".85" />
          {/* глянец полированного металла: мягкая широкая полоса, тонкий блик, «зайчик» */}
          <path d="M28 22 A23 23 0 0 1 45 12.5" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" fill="none" opacity=".15" />
          <path d="M30 24 A20 20 0 0 1 44 15" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" fill="none" opacity=".6" />
          <ellipse cx="62" cy="17" rx="4" ry="2.2" transform="rotate(-20 62 17)" fill="#ffffff" opacity=".28" />
          <path d="M70 21 A27 27 0 0 1 78 30" stroke={silver} strokeWidth="2.6" strokeLinecap="round" fill="none" opacity=".4" />
          {/* V-бровка: приподнята над проёмами (глаз — 28..44), центр опускается «клювом» между глазами */}
          <path d="M22 29 L38 22 L50 29.5 L62 22 L78 29 L62 26.5 L50 33.5 L38 26.5Z" fill={c.trim} />
          <path d="M23.5 28.2 L38 21.5 L50 29 L62 21.5 L76.5 28.2" stroke={silver} strokeWidth="1.1" fill="none" opacity=".45" />
          <path d="M27 24 L38 27.5 M73 24 L62 27.5" stroke={c.glow} strokeWidth="2.4" strokeLinecap="round" fill="none" />
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
    case 'hood': // «Мастер Света» / «Ученик Тьмы»: капюшон — сплошная тулья над макушкой
      // и «лопасти», падающие на плечи. Раньше это было тонкое кольцо-«ободок»,
      // и голова казалась голой; нижний край тульи — аркой строго над глазами.
      return (
        <g>
          <path d="M17 40 A33 33 0 0 1 83 40 Q70 24 50 22 Q30 24 17 40Z" fill={c.trim} />
          {/* тень под краем тульи: лицо «утоплено» в капюшоне */}
          <path d="M19 38 Q32 24.5 50 23 Q68 24.5 81 38" fill="none" stroke="#000000" strokeWidth="4" opacity=".14" strokeLinecap="round" />
          {/* складки-«лопасти» */}
          <path d="M17 40 Q7 60 13 84 L30 78 Q20 60 23 41Z" fill={c.trim} />
          <path d="M83 40 Q93 60 87 84 L70 78 Q80 60 77 41Z" fill={c.trim} />
          {/* светлая кайма по краю — держит силуэт на 64 px; она ВЫШЕ уровня глаз,
              иначе на иконке она читалась как «бровь», нарисованная поверх глаз */}
          <path d="M17 40 Q30 24 50 22 Q70 24 83 40" fill="none" stroke={c.glow} strokeWidth="1.8" opacity=".8" strokeLinecap="round" />
          <path d="M28 19 A26 26 0 0 1 42 10" stroke="#ffffff" strokeWidth="2.4" opacity=".3" fill="none" strokeLinecap="round" />
        </g>
      );
    case 'bubble': // «Пилот истребителя»: шлем — светлая шапка-тулья ПОСЛЕ стекла, поэтому
      // кольцо купола не режет уши (раньше шар выглядел обручем, надетым поверх головы),
      // а стекло остаётся прозрачным: глаза и клюв видно.
      return (
        <g>
          {/* стекло-купол: тонировка + обод */}
          <circle cx="50" cy="38" r="30" fill="rgba(200,230,255,.20)" />
          <circle cx="50" cy="38" r="30" fill="none" stroke={c.glow} strokeWidth="2.4" opacity=".9" />
          {/* блики на стекле: большой сверху и маленький снизу справа */}
          <path d="M29 25 A25 25 0 0 1 44 12" stroke="#ffffff" strokeWidth="3.4" fill="none" strokeLinecap="round" opacity=".95" />
          <path d="M66 55 A24 24 0 0 0 76 44" stroke="#ffffff" strokeWidth="2" fill="none" strokeLinecap="round" opacity=".5" />
          {/* шапка шлема: перекрывает верхнюю дугу стекла, из-под неё выходят уши */}
          <path d="M17 40 A33 33 0 0 1 83 40 Q70 26.5 50 25.5 Q30 26.5 17 40Z" fill={c.trim} />
          <path d="M17 40 Q30 26.5 50 25.5 Q70 26.5 83 40" fill="none" stroke="#9fb0cc" strokeWidth="1.4" opacity=".8" />
          {/* ремни и «уши» шлема у щеки + кислородный шланг */}
          <circle cx="21" cy="46" r="4.4" fill={c.trim} stroke="#9fb0cc" strokeWidth="1.2" />
          <circle cx="79" cy="46" r="4.4" fill={c.trim} stroke="#9fb0cc" strokeWidth="1.2" />
          <path d="M21 50 Q16 62 22 70" stroke="#9fb0cc" strokeWidth="2" fill="none" strokeLinecap="round" opacity=".85" />
          {/* намёк на гребень-антенну */}
          <path d="M46 10 Q50 3 54 10" fill={c.wing} />
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
    case 'plate': // «Храбрый дроид»: купол-шапка над глазами (раньше её плоский низ
      // резал глаза по центру — на иконке 64 px дроид был «слепым»), симметричные
      // vents-панели на щеках и панель корпуса ВЫШЕ «пёрышек» роста.
      return (
        <g>
          <path d="M20 40 A30 30 0 0 1 80 40 Q66 26 50 25 Q34 26 20 40Z" fill={c.trim} />
          <path d="M20 40 Q34 26 50 25 Q66 26 80 40" fill="none" stroke="#ffffff" strokeWidth="1.4" opacity=".35" />
          <path d="M29 21 A24 24 0 0 1 43 12" stroke="#ffffff" strokeWidth="3" fill="none" strokeLinecap="round" opacity=".6" />
          {/* «глаз-сканер» по центру лба — не задевает глаза совы */}
          <rect x="45.5" y="31" width="9" height="6" rx="2.4" fill={c.glow} opacity=".95" />
          {/* боковые панели-вентиляторы */}
          <rect x="21" y="45" width="10" height="5.5" rx="2" fill={c.glow} opacity=".8" />
          <rect x="69" y="45" width="10" height="5.5" rx="2" fill={c.glow} opacity=".8" />
          {/* панель корпуса: «пёрышки» роста занимают y 86..105, лапы — 111..121,
              поэтому панель ставим под шею, иначе она перекрывала рост БУКа */}
          <rect x="36.5" y="66" width="27" height="13" rx="3.5" fill="rgba(255,255,255,.62)" stroke={c.trim} strokeWidth="1" />
          <rect x="40" y="69.5" width="7.5" height="6.5" rx="1.5" fill={c.trim} />
          <rect x="52" y="69.5" width="7.5" height="6.5" rx="1.5" fill={c.glow} opacity=".85" />
        </g>
      );
    case 'buns': // «Командир звёзд»: пучки по бокам и ДИАДЕМА — раньше тонкая дуга
      // с горошиной терялась между ушами; теперь это корона с тремя зубцами.
      return (
        <g>
          <circle cx="16" cy="27" r="9" fill={c.trim} />
          <circle cx="84" cy="27" r="9" fill={c.trim} />
          <path d="M23 27 L27 12 L37 20 L50 5 L63 20 L73 12 L77 27 Q50 32 23 27Z" fill={c.glow} />
          <path d="M24.5 26.5 Q50 31.5 75.5 26.5" stroke="#e0a92c" strokeWidth="1.6" fill="none" />
          <circle cx="50" cy="22" r="3.2" fill="#fff8ec" />
          <circle cx="34" cy="22.6" r="1.8" fill="#fff8ec" opacity=".85" />
          <circle cx="66" cy="22.6" r="1.8" fill="#fff8ec" opacity=".85" />
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

/** Реквизит: светопосохи и посох-компас. Клинок цвета c.glow — с мягким ореолом.
 *  Размытие (filter) не используем: оно дорого для телефона на 60 fps и криво
 *  переносится растером превью; три полупрозрачных слоя дают то же свечение.
 *  Клинок сдвинут левее и наклон уменьшен (12° вместо 16°): с ореолом кончик
 *  вылезал за viewBox 0..100 и обрезался на иконке магазина. */
export function CostumeProp({ c }: { c: Costume }) {
  if (c.prop === 'saber-red' || c.prop === 'saber-blue' || c.prop === 'saber-green') {
    return (
      <g transform="rotate(12 82 80)">
        <rect x="76.6" y="22" width="10.8" height="48" rx="5.4" fill={c.glow} opacity=".14" />
        <rect x="78.2" y="24" width="7.6" height="44" rx="3.8" fill={c.glow} opacity=".28" />
        <rect x="79.2" y="25.4" width="5.6" height="41.2" rx="2.8" fill={c.glow} opacity=".55" />
        <rect x="79.4" y="26" width="5.2" height="42" rx="2.6" fill={c.glow} />
        <rect x="80.7" y="28" width="2.6" height="38" rx="1.3" fill="#ffffff" opacity=".9" />
        <ellipse cx="82" cy="67.6" rx="5.4" ry="2.8" fill={c.glow} opacity=".6" />
        <rect x="77.8" y="66.2" width="8.4" height="2.6" rx="1.3" fill="#8f9ab5" />
        <rect x="78.8" y="68" width="6.4" height="18" rx="2.2" fill="#241f36" />
        <rect x="78.8" y="74" width="6.4" height="2" fill="#6b6480" />
        <rect x="78.8" y="82" width="6.4" height="2" rx="1" fill="#8f9ab5" opacity=".8" />
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

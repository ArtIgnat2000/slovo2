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

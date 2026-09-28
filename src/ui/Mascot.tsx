import React from 'react';
import type { ShopSlot } from '../types';
import { MascotAccessory, SLOT_ORDER } from './MascotLook';

export type Mood = 'idle' | 'happy' | 'excited' | 'sad' | 'think' | 'dance';

/** Что надето на БУКа: слот → id аксессуара (магазин, пункт 4 плана). */
export type Look = Partial<Record<ShopSlot, string>>;

interface Props {
  mood: Mood;
  message?: string;
  /** Купленные и надетые аксессуары — рисуются поверх совы */
  look?: Look;
  /** Размер в пикселях (в магазине БУК крупнее — его там наряжают) */
  size?: number;
  /** Ступень роста (0 — птенец … 3 — магистр): БУК растёт по освоенным словам */
  stage?: number;
}

/** БУК — сова-помощник. Крупные глаза и округлые формы → привязанность ребёнка. */
export function Mascot({ mood, message, look, size, stage = 1 }: Props) {
  // Рост читается тремя способами сразу: размер, хвост из перьев и «перья на груди»
  const scale = 0.9 + 0.035 * stage;
  const eyes: Record<Mood, React.ReactNode> = {
    idle: (
      <>
        <circle cx="36" cy="36" r="8" fill="#fff" />
        <circle cx="64" cy="36" r="8" fill="#fff" />
        <circle cx="37" cy="37" r="4" fill="#241f36" />
        <circle cx="65" cy="37" r="4" fill="#241f36" />
      </>
    ),
    happy: (
      <>
        <ellipse cx="36" cy="38" rx="8" ry="6" fill="#fff" />
        <ellipse cx="64" cy="38" rx="8" ry="6" fill="#fff" />
        <circle cx="37" cy="39" r="4" fill="#241f36" />
        <circle cx="65" cy="39" r="4" fill="#241f36" />
      </>
    ),
    excited: (
      <>
        <circle cx="36" cy="34" r="10" fill="#fff" />
        <circle cx="64" cy="34" r="10" fill="#fff" />
        <circle cx="36" cy="34" r="5.5" fill="#241f36" />
        <circle cx="64" cy="34" r="5.5" fill="#241f36" />
        <circle cx="38" cy="31" r="2" fill="#fff" />
        <circle cx="66" cy="31" r="2" fill="#fff" />
      </>
    ),
    sad: (
      <>
        <ellipse cx="36" cy="38" rx="8" ry="5" fill="#fff" />
        <ellipse cx="64" cy="38" rx="8" ry="5" fill="#fff" />
        <circle cx="35" cy="39" r="3.5" fill="#241f36" />
        <circle cx="63" cy="39" r="3.5" fill="#241f36" />
      </>
    ),
    think: (
      <>
        <ellipse cx="36" cy="34" rx="8" ry="7" fill="#fff" />
        <ellipse cx="64" cy="34" rx="8" ry="7" fill="#fff" />
        <circle cx="39" cy="34" r="4" fill="#241f36" />
        <circle cx="67" cy="34" r="4" fill="#241f36" />
      </>
    ),
    dance: (
      <>
        <circle cx="36" cy="33" r="9.5" fill="#fff" />
        <circle cx="64" cy="33" r="9.5" fill="#fff" />
        <circle cx="35" cy="33" r="5" fill="#241f36" />
        <circle cx="63" cy="33" r="5" fill="#241f36" />
        <circle cx="33" cy="30" r="2" fill="#fff" />
        <circle cx="61" cy="30" r="2" fill="#fff" />
      </>
    ),
  };

  const mouths: Record<Mood, React.ReactNode> = {
    idle: <path d="M42 51 Q50 56 58 51" stroke="#241f36" strokeWidth="2.4" fill="none" strokeLinecap="round" />,
    happy: <path d="M37 48 Q50 63 63 48" stroke="#241f36" strokeWidth="2.8" fill="none" strokeLinecap="round" />,
    excited: <ellipse cx="50" cy="53" rx="9" ry="6" fill="#f43f5e" />,
    sad: <path d="M42 58 Q50 50 58 58" stroke="#241f36" strokeWidth="2.4" fill="none" strokeLinecap="round" />,
    think: <path d="M44 53 Q50 53 58 53" stroke="#241f36" strokeWidth="2.4" fill="none" strokeLinecap="round" />,
    dance: <ellipse cx="50" cy="53" rx="8" ry="5" fill="#f43f5e" />,
  };

  return (
    <div className={`mascot ${mood === 'dance' ? 'dance' : ''}`}>
      {message && <div className="bubble pop">{message}</div>}
      <svg
        width={(size ?? 92) * (100 / 120) * 1.09 * scale}
        height={(size ?? 110) * scale}
        viewBox="0 0 100 120"
        aria-hidden="true"
      >
        {/* хвост из перьев — признак взрослого БУКа (растёт со знанием слов) */}
        {stage >= 3 && (
          <>
            <path d="M78 96 Q98 88 100 70 Q88 84 74 88Z" fill="#e8901a" />
            <path d="M74 102 Q96 100 100 86 Q86 96 72 96Z" fill="#f4a51a" />
          </>
        )}
        {stage === 2 && <path d="M78 98 Q96 92 97 76 Q86 88 74 90Z" fill="#e8901a" />}
        <ellipse cx="50" cy="82" rx="36" ry="37" fill="#f4a51a" />
        <ellipse cx="50" cy="88" rx="24" ry="27" fill="#fcd768" />
        {mood === 'dance' ? (
          <>
            <path d="M14 68 Q0 46 12 32 Q21 54 24 68Z" fill="#e8901a" />
            <path d="M86 68 Q100 46 88 32 Q79 54 76 68Z" fill="#e8901a" />
          </>
        ) : (
          <>
            <path d="M14 74 Q2 58 12 38 Q20 58 24 74Z" fill="#e8901a" />
            <path d="M86 74 Q98 58 88 38 Q80 58 76 74Z" fill="#e8901a" />
          </>
        )}
        <ellipse cx="50" cy="37" rx="30" ry="28" fill="#f4a51a" />
        {stage === 0 ? (
          <>
            {/* птенец: вместо ушек — пух на макушке */}
            <path d="M42 12 Q46 2 50 10 Q54 1 58 12" stroke="#f4a51a" strokeWidth="3.4" fill="none" strokeLinecap="round" />
            <path d="M33 30 Q50 -2 67 30" fill="#f4a51a" opacity="0.5" />
          </>
        ) : (
          <>
            <path d="M24 18 L18 4 L31 13Z" fill="#e8901a" />
            <path d="M76 18 L82 4 L69 13Z" fill="#e8901a" />
          </>
        )}
        <circle cx="36" cy="37" r="13" fill="#fcd768" />
        <circle cx="64" cy="37" r="13" fill="#fcd768" />
        {eyes[mood]}
        <path d="M44 45 L50 53 L56 45Z" fill="#e8901a" />
        {mouths[mood]}
        {/* «перья-полоски» на груди: одна за каждую освоенную ступень */}
        {Array.from({ length: stage }).map((_, i) => (
          <path
            key={i}
            d={`M40 ${100 - i * 7} Q50 ${105 - i * 7} 60 ${100 - i * 7}`}
            stroke="#f0a92c"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
        ))}
        <ellipse cx="38" cy="116" rx="10" ry="5" fill="#e8901a" />
        <ellipse cx="62" cy="116" rx="10" ry="5" fill="#e8901a" />
        {/* аксессуары поверх совы; порядок слотов — чтобы очки легли на глаза, а шарф под голову */}
        {look &&
          SLOT_ORDER.map((slot) => {
            const id = look[slot];
            return id ? <MascotAccessory key={slot} id={id} /> : null;
          })}
      </svg>
    </div>
  );
}

import React, { useEffect, useRef } from 'react';
import type { ShopSlot } from '../types';
import { COSTUME_BY_ID } from '../engine/puzzles';
import { accessoryColors, costumeAccent } from '../engine/tints';
import { useShopTuning, useWornCostume } from '../state/store';
import { CostumeCape, CostumeHead, CostumeProp, MascotAccessory, SLOT_ORDER } from './MascotLook';
import { MascotWings } from './MascotDecor';
import { gazeToward } from './mascot-motion';

export type Mood = 'idle' | 'happy' | 'excited' | 'sad' | 'think' | 'dance';

/** Что надето на БУКа: слот → id аксессуара (магазин, пункт 4 плана). */
export type Look = Partial<Record<ShopSlot, string>>;

interface Props {
  mood: Mood;
  message?: string;
  /**
   * Костюм из пазлов (engine/puzzles.ts): undefined — надеть то, что выбрано
   * в магазине; null — без костюма (превью); id — превью конкретного костюма.
   */
  costumeId?: string | null;
  /** Купленные и надетые аксессуары — рисуются поверх совы */
  look?: Look;
  /** Размер в пикселях (в магазине БУК крупнее — его там наряжают) */
  size?: number;
  /** Ступень роста (0 — птенец … 3 — магистр): БУК растёт по освоенным словам */
  stage?: number;
  /**
   * Орган управления в углу БУКа (кнопка «свернуть» у плавающего).
   * Живёт внутри самой совы, чтобы не заводить второй элемент-обёртку:
   * `.app > .mascot` — это контракт тестов, и он должен остаться прежним.
   */
  action?: React.ReactNode;
  /**
   * Только для плавающего БУКа: включает тап (и Enter/Space с клавиатуры),
   * значение — подпись для скринридера. Без него БУК в магазине и в церемонии
   * остаётся картинкой и не перехватывает касания.
   */
  interactiveLabel?: string;
  /** Дополнительный класс состояния (свёрнут, перетаскивается) */
  className?: string;
  /** Положение плавающего БУКа: когда его сдвинули, CSS-угол больше не работает */
  style?: React.CSSProperties;
  /**
   * «Живой» БУК (0.85.0): глаза следят за указателем, веки моргают.
   * Ставит только плавающий экземпляр (и не ставит свёрнутому) — в магазине,
   * церемонии и на карточках сова остаётся спокойной картинкой.
   */
  alive?: boolean;
  /**
   * Слой поверх совы — дуга дверей навигатора БУКа. Живёт внутри `.buk-stage`:
   * контейнер центрируется по самой SVG-сове, дуге не нужны координаты страницы.
   */
  overlay?: React.ReactNode;
}

/** БУК — сова-помощник. Крупные глаза и округлые формы → привязанность ребёнка. */
export const Mascot = React.forwardRef<HTMLDivElement, Props>(function Mascot(
  { mood, message, look, size, stage = 1, costumeId, action, interactiveLabel, className, style, alive, overlay },
  ref,
) {
  // Рост читается тремя способами сразу: размер, хвост из перьев и «перья на груди»
  const scale = 0.9 + 0.035 * stage;
  // Костюм перекрашивает сову целиком (палитра из движка), а шлем/реквизит
  // дорисовывает MascotLook; превью в магазине может задать костюм явно.
  const wornId = useWornCostume();
  // Краски купленных вещей и акценты костюмов: без записи в профиле всё рисуется
  // базовыми цветами, то есть ровно как до тюнинга.
  const tuning = useShopTuning();
  const costumeKey = costumeId !== undefined ? costumeId : wornId;
  const cst = costumeKey ? COSTUME_BY_ID[costumeKey] ?? null : null;
  // акцент костюма (свечение + плащ): только он меняется тюнингом, корпус — нет
  const accent = cst ? costumeAccent(cst.id, tuning) : null;
  const cBody = cst?.body ?? '#f4a51a';
  const cBelly = cst?.belly ?? '#fcd768';
  const cWing = cst?.wing ?? '#e8901a';
  const cStripe = cst ? cst.wing : '#f0a92c';
  // Белки глаз — отдельно от зрачков (0.85.0): зрачки вынесены в свой <g>,
  // чтобы «живой» БУК двигал их одной трансформацией прямо в DOM, без
  // ре-рендера на каждое движение пальца (см. ui/mascot-motion.ts).
  const whites: Record<Mood, React.ReactNode> = {
    idle: (
      <>
        <circle cx="36" cy="36" r="8" fill="#fff" />
        <circle cx="64" cy="36" r="8" fill="#fff" />
      </>
    ),
    happy: (
      <>
        <ellipse cx="36" cy="38" rx="8" ry="6" fill="#fff" />
        <ellipse cx="64" cy="38" rx="8" ry="6" fill="#fff" />
      </>
    ),
    excited: (
      <>
        <circle cx="36" cy="34" r="10" fill="#fff" />
        <circle cx="64" cy="34" r="10" fill="#fff" />
      </>
    ),
    sad: (
      <>
        <ellipse cx="36" cy="38" rx="8" ry="5" fill="#fff" />
        <ellipse cx="64" cy="38" rx="8" ry="5" fill="#fff" />
      </>
    ),
    think: (
      <>
        <ellipse cx="36" cy="34" rx="8" ry="7" fill="#fff" />
        <ellipse cx="64" cy="34" rx="8" ry="7" fill="#fff" />
      </>
    ),
    dance: (
      <>
        <circle cx="36" cy="33" r="9.5" fill="#fff" />
        <circle cx="64" cy="33" r="9.5" fill="#fff" />
      </>
    ),
  };
  /** Зрачки и блики каждого настроения: `[x, y, r]` и смещение блика. */
  const pupils: Record<Mood, { x: number; y: number; r: number; hi?: [number, number, number] }[]> = {
    idle: [
      { x: 37, y: 37, r: 4 },
      { x: 65, y: 37, r: 4 },
    ],
    happy: [
      { x: 37, y: 39, r: 4 },
      { x: 65, y: 39, r: 4 },
    ],
    excited: [
      { x: 36, y: 34, r: 5.5, hi: [2, -3, 2] },
      { x: 64, y: 34, r: 5.5, hi: [2, -3, 2] },
    ],
    sad: [
      { x: 35, y: 39, r: 3.5 },
      { x: 63, y: 39, r: 3.5 },
    ],
    think: [
      { x: 39, y: 34, r: 4 },
      { x: 67, y: 34, r: 4 },
    ],
    dance: [
      { x: 35, y: 33, r: 5, hi: [-2, -3, 2] },
      { x: 63, y: 33, r: 5, hi: [-2, -3, 2] },
    ],
  };

  const mouths: Record<Mood, React.ReactNode> = {
    idle: <path d="M42 51 Q50 56 58 51" stroke="#241f36" strokeWidth="2.4" fill="none" strokeLinecap="round" />,
    happy: <path d="M37 48 Q50 63 63 48" stroke="#241f36" strokeWidth="2.8" fill="none" strokeLinecap="round" />,
    excited: <ellipse cx="50" cy="53" rx="9" ry="6" fill="#f43f5e" />,
    sad: <path d="M42 58 Q50 50 58 58" stroke="#241f36" strokeWidth="2.4" fill="none" strokeLinecap="round" />,
    think: <path d="M44 53 Q50 53 58 53" stroke="#241f36" strokeWidth="2.4" fill="none" strokeLinecap="round" />,
    dance: <ellipse cx="50" cy="53" rx="8" ry="5" fill="#f43f5e" />,
  };

  const svgRef = useRef<SVGSVGElement>(null);
  const pupilsRef = useRef<SVGGElement>(null);

  /**
   * Живой взгляд (0.85.0): слушатель один на всё окно, в кадре — только запись
   * transform в DOM (ре-рендером на каждое движение пальца отвечать нельзя,
   * см. бюджеты docs/perf-audit.md). При prefers-reduced-motion взгляд выключен —
   * остаётся статичная морда, как у картинки в магазине.
   */
  useEffect(() => {
    if (!alive) return;
    const reduced =
      typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    let frame = 0;
    let px = -1;
    let py = -1;
    const apply = () => {
      frame = 0;
      if (px < 0) return;
      const svg = svgRef.current;
      const group = pupilsRef.current;
      if (!svg || !group) return;
      const box = svg.getBoundingClientRect();
      const g = gazeToward(px, py, box.left + box.width / 2, box.top + box.height / 2);
      group.style.transform = `translate(${g.dx.toFixed(2)}px, ${g.dy.toFixed(2)}px)`;
      svg.style.transform = g.lean ? `rotate(${g.lean.toFixed(2)}deg)` : '';
    };
    const onMove = (e: PointerEvent) => {
      px = e.clientX;
      py = e.clientY;
      if (!frame) frame = window.requestAnimationFrame(apply);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (frame && typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(frame);
      // Глаза возвращаются в центр при сворачивании и размонтировании.
      if (pupilsRef.current) pupilsRef.current.style.transform = '';
      if (svgRef.current) svgRef.current.style.transform = '';
    };
  }, [alive]);

  return (
    <div
      ref={ref}
      style={style}
      className={`mascot ${mood === 'dance' ? 'dance' : ''} ${interactiveLabel ? 'interactive' : ''} ${className ?? ''}`.trim()}
      {...(interactiveLabel
        ? { role: 'button' as const, tabIndex: 0, 'aria-label': interactiveLabel }
        : {})}
    >
      {action}
      {message && <div className="bubble pop">{message}</div>}
      {/* `.buk-stage` — обёртка ровно по размеру совы: якорь для дуги дверей
          навигатора и место, где живой взгляд пишет transform картинки. */}
      <div className={`buk-stage${alive ? ' alive' : ''}`}>
      <svg
        ref={svgRef}
        width={(size ?? 92) * (100 / 120) * 1.09 * scale}
        height={(size ?? 110) * scale}
        viewBox="0 0 100 120"
        aria-hidden="true"
      >
        {/* хвост из перьев — признак взрослого БУКа (растёт со знанием слов) */}
        {stage >= 3 && (
          <>
            <path d="M78 96 Q98 88 100 70 Q88 84 74 88Z" fill={cWing} />
            <path d="M74 102 Q96 100 100 86 Q86 96 72 96Z" fill={cBody} />
          </>
        )}
        {stage === 2 && <path d="M78 98 Q96 92 97 76 Q86 88 74 90Z" fill={cWing} />}
        {cst && <CostumeCape c={cst} accent={accent} />}
        {/* 0.70.0: крылья — единственный слой ПОД телом (слот `back`), поэтому
            они рисуются здесь, а не в SLOT_ORDER: так они выглядывают из-за
            спины и на 44 px в гардеробе остаются узнаваемыми. */}
        {look?.back && <MascotWings id={look.back} colors={accessoryColors(look.back, tuning)} />}
        <ellipse cx="50" cy="82" rx="36" ry="37" fill={cBody} />
        <ellipse cx="50" cy="88" rx="24" ry="27" fill={cBelly} />
        {mood === 'dance' ? (
          <>
            <path d="M14 68 Q0 46 12 32 Q21 54 24 68Z" fill={cWing} />
            <path d="M86 68 Q100 46 88 32 Q79 54 76 68Z" fill={cWing} />
          </>
        ) : (
          <>
            <path d="M14 74 Q2 58 12 38 Q20 58 24 74Z" fill={cWing} />
            <path d="M86 74 Q98 58 88 38 Q80 58 76 74Z" fill={cWing} />
          </>
        )}
        <ellipse cx="50" cy="37" rx="30" ry="28" fill={cBody} />
        {stage === 0 ? (
          <>
            {/* птенец: вместо ушек — пух на макушке */}
            <path d="M42 12 Q46 2 50 10 Q54 1 58 12" stroke={cBody} strokeWidth="3.4" fill="none" strokeLinecap="round" />
            <path d="M33 30 Q50 -2 67 30" fill={cBody} opacity="0.5" />
          </>
        ) : (
          <>
            <path d="M24 18 L18 4 L31 13Z" fill={cWing} />
            <path d="M76 18 L82 4 L69 13Z" fill={cWing} />
          </>
        )}
        <circle cx="36" cy="37" r="13" fill={cBelly} />
        <circle cx="64" cy="37" r="13" fill={cBelly} />
        {whites[mood]}
        <g ref={pupilsRef} className="buk-pupils">
          {pupils[mood].map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={p.r} fill="#241f36" />
              {p.hi && <circle cx={p.x + p.hi[0]} cy={p.y + p.hi[1]} r={p.hi[2]} fill="#fff" />}
            </g>
          ))}
        </g>
        {/* Веки (0.85.0) — те же диски цвета живота, что под белками: на
            моргании закрывают глаз целиком. Рисуются только «живой» сове. */}
        {alive && (
          <>
            <circle cx="36" cy="37" r="13" fill={cBelly} className="buk-lid on" />
            <circle cx="64" cy="37" r="13" fill={cBelly} className="buk-lid on" />
          </>
        )}
        <path d="M44 45 L50 53 L56 45Z" fill={cWing} />
        {mouths[mood]}
        {/* «перья-полоски» на груди: одна за каждую освоенную ступень */}
        {Array.from({ length: stage }).map((_, i) => (
          <path
            key={i}
            d={`M40 ${100 - i * 7} Q50 ${105 - i * 7} 60 ${100 - i * 7}`}
            stroke={cStripe}
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
        ))}
        <ellipse cx="38" cy="116" rx="10" ry="5" fill={cWing} />
        <ellipse cx="62" cy="116" rx="10" ry="5" fill={cWing} />
        {/* аксессуары поверх совы; порядок слотов — чтобы очки легли на глаза, а шарф под голову */}
        {look &&
          SLOT_ORDER.map((slot) => {
            const id = look[slot];
            // рисуем готовыми цветами палитры с учётом выбранного оттенка:
            // своя логика индексов живёт в MascotLook, здесь только выбор из профиля
            return id ? <MascotAccessory key={slot} id={id} colors={accessoryColors(id, tuning)} /> : null;
          })}
        {cst && <CostumeHead c={cst} accent={accent} />}
        {cst && <CostumeProp c={cst} accent={accent} />}
        {/* Техники на БУКе больше нет (0.22.0): машины, телефоны и корабли
            экспонируются в сцене «Ангар» (ui/HangarScene.tsx, правило
            showsOnBuk в engine/shop.ts). `equipped.toy` означает «любимая
            вещь на главном подиуме ангара». */}
      </svg>
      {overlay}
      </div>
    </div>
  );
});

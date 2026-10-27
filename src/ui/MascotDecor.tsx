import { TINT_PALETTES } from '../engine/tints';

// ── Украшения и крылья (0.70.0) ─────────────────────────────────────────────
//
// Разбор интересов 2026-10-26 (docs/proposals/shop-girls-catalog.md, вариант A):
// каталог отвечал только на «люблю технику», а из украшений был один бантик.
// Здесь живёт арт новой полки. Он вынесен из MascotLook.tsx отдельным модулем,
// потому что там уже 355 строк «железа» костюмов: добавлять туда ещё тринадцать
// вещей — значит сделать файл, в котором перестаёшь видеть слои.
//
// Сетка та же, что у всей совы: viewBox 100×120, голова — круг 50,37 r≈30,
// глаза в 36 и 64 на y 37, шея ≈ y 64–78, грудь ≈ y 80–100.
//
// Ключевое отличие от аксессуаров MascotLook: крылья (слот `back`) рисуются ПОД
// телом — поэтому у них отдельный экспорт `MascotWings`, а Mascot.tsx вызывает
// его до эллипса туловища, а не через SLOT_ORDER.

type Colors = [string, string, string];

/** Цвета деталей: выбранный оттенок из профиля → база палитры. */
function colors(id: string, override?: Colors | null): Colors {
  return override ?? TINT_PALETTES[id].base.colors;
}

/** Пятиконечная звезда точками — общий примитив для заколок. */
function starPoints(cx: number, cy: number, r: number): string {
  const inner = r * 0.44;
  const points: string[] = [];
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    points.push(`${(cx + Math.cos(angle) * radius).toFixed(2)},${(cy + Math.sin(angle) * radius).toFixed(2)}`);
  }
  return points.join(' ');
}

/** Сердечко точками — «очки-сердечки». */
function heartPath(cx: number, cy: number, r: number): string {
  const k = r * 0.42;
  return [
    `M${cx} ${cy + r}`,
    `C${cx - r * 1.5} ${cy - r * 0.2} ${cx - k} ${cy - r * 1.1} ${cx} ${cy - k}`,
    `C${cx + k} ${cy - r * 1.1} ${cx + r * 1.5} ${cy - r * 0.2} ${cx} ${cy + r}`,
    'Z',
  ].join(' ');
}

/**
 * Новые украшения: головные уборы, очки, шея и значки.
 * Рисуются поверх тела, как старые аксессуары, поэтому порядок тот же — их
 * вызывает MascotAccessory через свой `default`-бранч.
 */
export function MascotDecorAccessory({ id, colors: override }: { id: string; colors?: Colors | null }) {
  switch (id) {
    case 'clips-stars': {
      const [main, shade, shine] = colors(id, override);
      return (
        <g>
          <polygon points={starPoints(29, 16, 9)} fill={main} stroke={shade} strokeWidth="1.2" strokeLinejoin="round" />
          <polygon points={starPoints(29, 16, 3.4)} fill={shine} />
          <polygon points={starPoints(70, 13, 7.4)} fill={main} stroke={shade} strokeWidth="1.2" strokeLinejoin="round" />
          <polygon points={starPoints(70, 13, 2.8)} fill={shine} />
        </g>
      );
    }
    case 'wreath': {
      const [petal, center, leaf] = colors(id, override);
      // Лепестки идут по дуге головы: ветка-основа, затем цветы поверх.
      const flowers = [20, 33, 46, 59, 72, 84].map((x) => ({
        x,
        y: 22 - Math.sin(((x - 20) / 64) * Math.PI) * 5,
      }));
      return (
        <g>
          <path d="M14 30 Q50 4 86 30" stroke={leaf} strokeWidth="4.5" fill="none" strokeLinecap="round" />
          {flowers.map((f, i) => (
            <g key={i}>
              <ellipse cx={f.x} cy={f.y - 3.4} rx="3.6" ry="3" fill={petal} />
              <ellipse cx={f.x} cy={f.y + 3.4} rx="3.6" ry="3" fill={petal} />
              <ellipse cx={f.x - 3.6} cy={f.y} rx="3" ry="3.6" fill={petal} />
              <ellipse cx={f.x + 3.6} cy={f.y} rx="3" ry="3.6" fill={petal} />
              <circle cx={f.x} cy={f.y} r="2.5" fill={center} />
            </g>
          ))}
          <path d="M24 26 Q18 20 22 14 Q28 20 26 28Z" fill={leaf} opacity=".85" />
          <path d="M76 26 Q82 20 78 14 Q72 20 74 28Z" fill={leaf} opacity=".85" />
        </g>
      );
    }
    case 'hat-ribbon': {
      const [straw, shade, ribbon] = colors(id, override);
      return (
        <g>
          {/* Поля шляпы уходят за уши — шляпа крупнее головы, так она и читается. */}
          <path d="M50 6 Q74 6 77 24 Q50 32 23 24 Q26 6 50 6Z" fill={straw} />
          <path d="M23 24 Q50 34 77 24 L84 28 Q50 41 16 28Z" fill={shade} />
          <path d="M29 18 Q50 25 71 18 L72 23 Q50 30 28 23Z" fill={ribbon} />
          <path d="M70 21 Q80 15 82 24 Q78 29 71 26Z" fill={ribbon} />
          <circle cx="76" cy="23" r="2.2" fill={shade} opacity=".55" />
          <path d="M30 11 Q44 6 58 9" stroke="#ffffff" strokeWidth="2" fill="none" opacity=".35" strokeLinecap="round" />
        </g>
      );
    }
    case 'crown': {
      const [gold, shade, gem] = colors(id, override);
      return (
        <g>
          <path
            d="M26 20 L30 4 L40 14 L50 2 L60 14 L70 4 L74 20 Q50 27 26 20Z"
            fill={gold}
            stroke={shade}
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path d="M27 20 Q50 27 73 20 L73 25 Q50 32 27 25Z" fill={shade} />
          <circle cx="50" cy="15" r="3.2" fill={gem} />
          <circle cx="34" cy="17" r="2.4" fill={gem} opacity=".9" />
          <circle cx="66" cy="17" r="2.4" fill={gem} opacity=".9" />
          <path d="M31 9 L34 14" stroke="#ffffff" strokeWidth="1.6" opacity=".45" strokeLinecap="round" />
        </g>
      );
    }
    case 'glasses-heart': {
      const [frame, arms, lens] = colors(id, override);
      return (
        <g>
          <path d={heartPath(36, 37, 15)} fill={lens} fillOpacity=".35" stroke={frame} strokeWidth="3" strokeLinejoin="round" />
          <path d={heartPath(64, 37, 15)} fill={lens} fillOpacity=".35" stroke={frame} strokeWidth="3" strokeLinejoin="round" />
          <path d="M49 33 Q50 31 51 33" stroke={frame} strokeWidth="2.6" fill="none" strokeLinecap="round" />
          <path d="M21 33 L12 30 M79 33 L88 30" stroke={arms} strokeWidth="3" strokeLinecap="round" fill="none" />
        </g>
      );
    }
    case 'glasses-round': {
      const [frame, arms, lens] = colors(id, override);
      return (
        <g>
          <circle cx="36" cy="37" r="14" fill={lens} fillOpacity=".28" stroke={frame} strokeWidth="2.2" />
          <circle cx="64" cy="37" r="14" fill={lens} fillOpacity=".28" stroke={frame} strokeWidth="2.2" />
          <path d="M50 33 L50 35" stroke={frame} strokeWidth="2.2" fill="none" strokeLinecap="round" />
          <path d="M22 34 L13 31 M78 34 L87 31" stroke={arms} strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <path d="M29 31 Q31 28 34 27" stroke="#ffffff" strokeWidth="1.8" opacity=".55" fill="none" strokeLinecap="round" />
        </g>
      );
    }
    case 'choker': {
      const [band, shade, bow] = colors(id, override);
      return (
        <g>
          {/* Лента сидит на шее — ниже клюва, между головой и грудью. */}
          <path d="M30 63 Q50 71 70 63 L71 69 Q50 77 29 69Z" fill={band} />
          <path d="M29 69 Q50 77 71 69" stroke={shade} strokeWidth="1.4" fill="none" opacity=".7" />
          <path d="M50 71 L38 66 Q34 72 38 78Z" fill={bow} />
          <path d="M50 71 L62 66 Q66 72 62 78Z" fill={bow} />
          <circle cx="50" cy="72" r="3" fill={shade} />
        </g>
      );
    }
    case 'beads': {
      const [bead, shade, clasp] = colors(id, override);
      const beads: [number, number, number][] = [
        [34, 68, 3.4],
        [40, 73, 3.8],
        [47, 76, 4],
        [54, 76, 4],
        [61, 73, 3.8],
        [67, 68, 3.4],
      ];
      return (
        <g>
          <path d="M32 65 Q50 84 68 65" stroke={shade} strokeWidth="1.6" fill="none" opacity=".75" />
          {beads.map(([cx, cy, r], i) => (
            <g key={i}>
              <circle cx={cx} cy={cy} r={r} fill={bead} />
              <circle cx={cx - r * 0.3} cy={cy - r * 0.3} r={r * 0.34} fill="#ffffff" opacity=".55" />
            </g>
          ))}
          <circle cx="50" cy="78" r="2.6" fill={clasp} stroke={shade} strokeWidth=".8" />
        </g>
      );
    }
    case 'bag': {
      const [main, shade, clasp] = colors(id, override);
      return (
        <g>
          {/* Ремешок через плечо и сумочка у лапки: видно, что она «с собой». */}
          <path d="M34 66 Q58 74 80 92" stroke={shade} strokeWidth="3" fill="none" strokeLinecap="round" />
          <rect x="70" y="88" width="21" height="16" rx="5" fill={main} stroke={shade} strokeWidth="1.6" />
          <path d="M70 94 H91" stroke={shade} strokeWidth="1.2" opacity=".65" />
          <path d="M78 88 Q80.5 82 83 88" stroke={shade} strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d={heartPath(80.5, 97, 4)} fill={clasp} />
        </g>
      );
    }
    case 'brooch-flower': {
      const [petal, shade, center] = colors(id, override);
      return (
        <g>
          {[0, 60, 120, 180, 240, 300].map((deg, i) => {
            const a = (deg * Math.PI) / 180;
            const cx = 50 + Math.cos(a) * 7;
            const cy = 92 + Math.sin(a) * 7;
            return (
              <ellipse
                key={i}
                cx={cx}
                cy={cy}
                rx="5"
                ry="4.2"
                fill={petal}
                stroke={shade}
                strokeWidth=".9"
                transform={`rotate(${deg} ${cx} ${cy})`}
              />
            );
          })}
          <circle cx="50" cy="92" r="4" fill={center} />
          <circle cx="48.8" cy="90.8" r="1.2" fill="#ffffff" opacity=".6" />
        </g>
      );
    }
    case 'badge-cat': {
      const [fur, shade, collar] = colors(id, override);
      return (
        <g>
          {/* Значок-кружок с котиком: уши, мордочка, лапка-приветствие. */}
          <circle cx="50" cy="92" r="11" fill={fur} stroke={shade} strokeWidth="1.6" />
          <path d="M42 84 L43 77 L49 82Z" fill={fur} stroke={shade} strokeWidth="1.2" />
          <path d="M58 84 L57 77 L51 82Z" fill={fur} stroke={shade} strokeWidth="1.2" />
          <circle cx="46" cy="90" r="1.5" fill={shade} />
          <circle cx="54" cy="90" r="1.5" fill={shade} />
          <path d="M48 95 Q50 97 52 95" stroke={shade} strokeWidth="1.3" fill="none" strokeLinecap="round" />
          <path
            d="M50 96 L50 99 M50 99 Q47 101 45.5 99 M50 99 Q53 101 54.5 99"
            stroke={shade}
            strokeWidth="1.1"
            fill="none"
            strokeLinecap="round"
          />
          <path d="M61 95 Q66 92 64 88" stroke={shade} strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <path d="M40 98 Q50 103 60 98" stroke={collar} strokeWidth="2.6" fill="none" strokeLinecap="round" />
        </g>
      );
    }
    // ── 0.72.0: причёски, очки «Сигма», кулоны, браслеты, сумочки ──────────
    case 'hair-buns': {
      const [hair, shade, bow] = colors(id, override);
      return (
        <g>
          <circle cx="23" cy="15" r="10" fill={hair} stroke={shade} strokeWidth="1.4" />
          <circle cx="77" cy="15" r="10" fill={hair} stroke={shade} strokeWidth="1.4" />
          <path d="M23 8 L18 2 L28 4Z" fill={bow} />
          <path d="M77 8 L82 2 L72 4Z" fill={bow} />
          <path d="M22 30 Q50 8 78 30 Q78 18 50 14 Q22 18 22 30Z" fill={hair} />
        </g>
      );
    }
    case 'hair-ponytail': {
      const [hair, shade, band] = colors(id, override);
      return (
        <g>
          <path d="M72 22 Q92 34 86 62 Q82 76 74 70 Q80 44 70 28Z" fill={hair} stroke={shade} strokeWidth="1.2" />
          <circle cx="71" cy="24" r="4.4" fill={band} />
          <path d="M22 30 Q50 8 78 30 Q78 18 50 14 Q22 18 22 30Z" fill={hair} />
        </g>
      );
    }
    case 'hair-curls': {
      const [hair, shade, shine] = colors(id, override);
      const curls = [22, 32, 42, 52, 62, 72, 80].map((x, i) => ({ x, y: 16 - Math.sin((i / 6) * Math.PI) * 5 }));
      return (
        <g>
          {curls.map((c, i) => (
            <g key={i}>
              <circle cx={c.x} cy={c.y} r="7.4" fill={hair} stroke={shade} strokeWidth="1.1" />
              <circle cx={c.x - 2} cy={c.y - 2} r="2.2" fill={shine} opacity=".7" />
            </g>
          ))}
        </g>
      );
    }
    case 'glasses-sigma': {
      const [frame, dark, lens] = colors(id, override);
      return (
        <g>
          <path d="M20 30 L52 30 L48 48 L26 48Z" fill={dark} stroke={frame} strokeWidth="2" strokeLinejoin="round" />
          <path d="M80 30 L48 30 L52 48 L74 48Z" fill={dark} stroke={frame} strokeWidth="2" strokeLinejoin="round" />
          <path d="M24 34 L44 34 L42 40 L27 40Z" fill={lens} opacity=".65" />
          <path d="M76 34 L56 34 L58 40 L73 40Z" fill={lens} opacity=".65" />
          <path d="M20 32 L12 28 M80 32 L88 28" stroke={frame} strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    }
    case 'pendant-heart': {
      const [gem, chain, shine] = colors(id, override);
      return (
        <g>
          <path d="M32 62 Q50 82 68 62" stroke={chain} strokeWidth="1.8" fill="none" />
          <path d={heartPath(50, 80, 8)} fill={gem} stroke={chain} strokeWidth="1" />
          <circle cx="47" cy="76" r="1.8" fill={shine} opacity=".8" />
        </g>
      );
    }
    case 'pendant-star': {
      const [gem, chain, shine] = colors(id, override);
      return (
        <g>
          <path d="M32 62 Q50 82 68 62" stroke={chain} strokeWidth="1.8" fill="none" />
          <polygon points={starPoints(50, 84, 9)} fill={gem} stroke={chain} strokeWidth="1" strokeLinejoin="round" />
          <polygon points={starPoints(50, 84, 3.4)} fill={shine} />
        </g>
      );
    }
    case 'bag-pink': {
      const [main, shade, clasp] = colors(id, override);
      return (
        <g>
          <path d="M32 64 Q58 72 82 90" stroke={shade} strokeWidth="3" fill="none" strokeLinecap="round" />
          <rect x="70" y="86" width="24" height="18" rx="6" fill={main} stroke={shade} strokeWidth="1.6" />
          <path d="M70 93 H94" stroke={shade} strokeWidth="1.2" opacity=".65" />
          <path d="M82 86 L74 78 Q82 74 82 80 Q82 74 90 78Z" fill={clasp} stroke={shade} strokeWidth=".8" />
        </g>
      );
    }
    case 'bracelet-beads': {
      const [a, b, c] = colors(id, override);
      const beadColors = [a, b, c, a, b];
      return (
        <g>
          {beadColors.map((fill, i) => (
            <circle key={i} cx={13 + i * 3.4} cy={66 + Math.sin(i * 1.1) * 5} r="3.1" fill={fill} stroke="#00000022" strokeWidth=".6" />
          ))}
        </g>
      );
    }
    case 'bracelet-heart': {
      const [main, shade, shine] = colors(id, override);
      return (
        <g>
          <path d="M11 62 Q20 66 22 76" stroke={shade} strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <path d={heartPath(18, 74, 5.4)} fill={main} stroke={shade} strokeWidth=".9" />
          <circle cx="16" cy="71" r="1.2" fill={shine} opacity=".85" />
        </g>
      );
    }
    // ── 0.72.0: платья (слот body) и обувь (слот feet) ──────────────────────
    case 'dress-pink':
    case 'dress-star':
    case 'dress-rainbow': {
      const [main, shade, accent] = colors(id, override);
      return (
        <g>
          <path d="M36 62 Q50 56 64 62 L78 108 Q50 118 22 108Z" fill={main} stroke={shade} strokeWidth="1.6" strokeLinejoin="round" />
          {id === 'dress-rainbow' && (
            <g opacity=".9">
              <path d="M29 84 Q50 92 71 84 L74 94 Q50 102 26 94Z" fill={shade} />
              <path d="M26 96 Q50 104 74 96 L76 104 Q50 113 24 104Z" fill={accent} />
            </g>
          )}
          {id === 'dress-star' && (
            <g fill={accent}>
              <polygon points={starPoints(40, 84, 5)} />
              <polygon points={starPoints(58, 94, 4.2)} />
              <polygon points={starPoints(50, 74, 3.4)} />
            </g>
          )}
          <path d="M40 60 Q50 66 60 60 L58 68 Q50 72 42 68Z" fill={accent} opacity={id === 'dress-star' ? '.9' : '.95'} />
          <path d="M24 106 Q50 115 76 106" stroke={shade} strokeWidth="2" fill="none" opacity=".7" />
        </g>
      );
    }
    case 'shoes-pink':
    case 'shoes-sparkle': {
      const [main, shade, shine] = colors(id, override);
      return (
        <g>
          <path d="M26 108 Q36 102 46 108 L46 114 Q36 117 26 114Z" fill={main} stroke={shade} strokeWidth="1.3" />
          <path d="M54 108 Q64 102 74 108 L74 114 Q64 117 54 114Z" fill={main} stroke={shade} strokeWidth="1.3" />
          <circle cx="36" cy="106" r="2.4" fill={shine} />
          <circle cx="64" cy="106" r="2.4" fill={shine} />
          {id === 'shoes-sparkle' && (
            <g fill={shine}>
              <polygon points={starPoints(31, 111, 2.6)} />
              <polygon points={starPoints(69, 111, 2.6)} />
            </g>
          )}
        </g>
      );
    }
    case 'skates-ice': {
      const [boot, shade, blade] = colors(id, override);
      return (
        <g>
          <path d="M27 100 L45 100 L45 110 L27 110Z" fill={boot} stroke={shade} strokeWidth="1.3" />
          <path d="M55 100 L73 100 L73 110 L55 110Z" fill={boot} stroke={shade} strokeWidth="1.3" />
          <path d="M30 104 H42 M30 107 H42 M58 104 H70 M58 107 H70" stroke={shade} strokeWidth="1" opacity=".7" />
          <path d="M25 114 H47 M53 114 H75" stroke={blade} strokeWidth="2" strokeLinecap="round" />
          <path d="M30 110 L29 114 M42 110 L43 114 M58 110 L57 114 M70 110 L71 114" stroke={blade} strokeWidth="1.4" />
        </g>
      );
    }
    default:
      return null;
  }
}

/**
 * Крылья (слот `back`). Рисуются ПОД телом совы — единственный слой ниже
 * туловища, поэтому Mascot.tsx вызывает их отдельно, до `ellipse` тела.
 * Из-за этого же крылья видны по краям силуэта и на 44 px в гардеробе:
 * контур читается, даже когда деталей не разглядеть.
 */
export function MascotWings({ id, colors: override }: { id: string; colors?: Colors | null }) {
  switch (id) {
    case 'wings-butterfly': {
      const [main, edge, dots] = colors(id, override);
      return (
        <g>
          <path d="M40 62 Q10 44 4 70 Q2 92 26 96 Q38 88 40 62Z" fill={main} stroke={edge} strokeWidth="1.8" />
          <path d="M60 62 Q90 44 96 70 Q98 92 74 96 Q62 88 60 62Z" fill={main} stroke={edge} strokeWidth="1.8" />
          <path d="M38 84 Q16 86 12 104 Q26 114 40 104 Q40 94 38 84Z" fill={main} opacity=".92" stroke={edge} strokeWidth="1.6" />
          <path d="M62 84 Q84 86 88 104 Q74 114 60 104 Q60 94 62 84Z" fill={main} opacity=".92" stroke={edge} strokeWidth="1.6" />
          <circle cx="20" cy="72" r="4.4" fill={dots} opacity=".85" />
          <circle cx="80" cy="72" r="4.4" fill={dots} opacity=".85" />
          <circle cx="26" cy="98" r="3" fill={dots} opacity=".7" />
          <circle cx="74" cy="98" r="3" fill={dots} opacity=".7" />
          <path d="M40 64 Q30 58 22 56 M60 64 Q70 58 78 56" stroke={edge} strokeWidth="1.4" fill="none" opacity=".6" />
        </g>
      );
    }
    case 'wings-dragon': {
      const [membrane, bone, spikes] = colors(id, override);
      return (
        <g>
          <path
            d="M42 60 Q16 50 4 62 Q10 78 22 84 Q14 92 20 104 Q34 100 42 90 Z"
            fill={membrane}
            stroke={bone}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M58 60 Q84 50 96 62 Q90 78 78 84 Q86 92 80 104 Q66 100 58 90 Z"
            fill={membrane}
            stroke={bone}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          {/* Костяные «пальцы» и шипы по краю — то, что отличает дракона от бабочки. */}
          <path d="M42 62 L18 68 M42 74 L14 78 M42 86 L20 94" stroke={bone} strokeWidth="1.6" strokeLinecap="round" opacity=".8" />
          <path d="M58 62 L82 68 M58 74 L86 78 M58 86 L80 94" stroke={bone} strokeWidth="1.6" strokeLinecap="round" opacity=".8" />
          <path d="M4 62 L0 54 L10 56ZM22 84 L18 92 L28 92Z" fill={spikes} />
          <path d="M96 62 L100 54 L90 56ZM78 84 L82 92 L72 92Z" fill={spikes} />
          <path d="M42 60 L50 56 L58 60" fill={bone} opacity=".9" />
        </g>
      );
    }
    default:
      return null;
  }
}

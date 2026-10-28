// Проекция для техники: 3/4-ракурс, как у продуктовых рендеров машин.
//
// Почему не классическая изометрия: у длинного объекта изометрия раздувает
// крышу, и автобус превращается в коробку. Здесь борт почти в плане, а глубина
// уходит вправо-вниз узкой полосой — так читаются и силуэт, и объём.
//
// Мир: x — вперёд (нос вправо), y — вверх, z — на зрителя.
// Камера спереди-справа-сверху. Экран: sx = x·0.98 − z·0.55,
// sy = −y + z·0.36 + x·0.05.
//
// Отсюда видимые грани: ближний борт (z = +Z), крыша (y = верх) и нос
// (x = +L). Ближний борт уходит влево-вниз, нос — вправо. Дальние колёса
// и задний торец не видны и не рисуются.

const SX = 0.98;
const DYX = 0.05;

// Глубина задаётся сценой: у наземной техники камера выше (видна крыша),
// у лайнера — ниже и острее (иначе широкие крылья «клюют» к зрителю).
let DX = -0.55;
let DY = 0.36;

export const pr = (x, y, z) => [x * SX + z * DX, -y + z * DY + x * DYX];

/** Поставить ракурс глубины на время отрисовки одной модели. */
export const setDepth = (dx, dy) => {
  DX = dx;
  DY = dy;
};

export const depth = () => ({ dx: DX, dy: DY });

const fmt = (n) => Math.round(n * 100) / 100;

const path = (pts) =>
  pts
    .map(([x, y, z], i) => {
      const [sx, sy] = pr(x, y, z);
      return `${i ? 'L' : 'M'}${fmt(sx)} ${fmt(sy)}`;
    })
    .join(' ') + ' Z';

/** Полигон из точек мира. */
export const poly = (pts, fill, extra = '') => `<path d="${path(pts)}" fill="${fill}" ${extra}/>`;

/** Линия в мире. */
export const line = (a, b, stroke, width = 1.5, extra = '') => {
  const [x1, y1] = pr(...a);
  const [x2, y2] = pr(...b);
  return `<path d="M${fmt(x1)} ${fmt(y1)} L${fmt(x2)} ${fmt(y2)}" stroke="${stroke}" stroke-width="${width}" fill="none" ${extra}/>`;
};

/** Верхняя плоскость y = const. */
export const topFace = (x0, x1, z0, z1, y, fill, extra = '') =>
  poly(
    [
      [x0, y, z0],
      [x1, y, z0],
      [x1, y, z1],
      [x0, y, z1],
    ],
    fill,
    extra,
  );

/** Борт z = const. */
export const sideFace = (z, x0, x1, y0, y1, fill, extra = '') =>
  poly(
    [
      [x0, y0, z],
      [x1, y0, z],
      [x1, y1, z],
      [x0, y1, z],
    ],
    fill,
    extra,
  );

/** Торец x = const. */
export const endFace = (x, y0, y1, z0, z1, fill, extra = '') =>
  poly(
    [
      [x, y0, z0],
      [x, y0, z1],
      [x, y1, z1],
      [x, y1, z0],
    ],
    fill,
    extra,
  );

/**
 * Круг в плоскости x–y (колесо, иллюминатор), видимый с борта z.
 * Ось x укорочена, ось y перевёрнута — поэтому эллипс, а не круг.
 */
export const discX = (x, y, z, r, fill, extra = '') => {
  const [sx, sy] = pr(x, y, z);
  return (
    `<g transform="translate(${fmt(sx)} ${fmt(sy)}) scale(${SX} 1)">` +
    `<circle r="${fmt(r)}" fill="${fill}" ${extra}/></g>`
  );
};

/** Круг в плоскости x–z (люк, диск на крыше). */
export const discY = (x, y, z, r, fill, extra = '') => {
  const [sx, sy] = pr(x, y, z);
  return (
    `<g transform="translate(${fmt(sx)} ${fmt(sy)}) matrix(${SX} 0 ${DX} ${DY} 0 0)">` +
    `<circle r="${fmt(r)}" fill="${fill}" ${extra}/></g>`
  );
};

/** Круг в плоскости z–y: торец по ходу — воздухозаборник, фара, срез. */
export const discZ = (x, y, z, r, fill, extra = '') => {
  const [sx, sy] = pr(x, y, z);
  return (
    `<g transform="translate(${fmt(sx)} ${fmt(sy)}) matrix(${fmt(-DX)} ${fmt(-DY)} 0 1 0 0)">` +
    `<circle r="${fmt(r)}" fill="${fill}" ${extra}/></g>`
  );
};

/** Тень на «полу»: эллипс в плоскости x–z с размытием. */
export const contact = (x, y, z, rx, rz, opacity = 0.16) => {
  const [sx, sy] = pr(x, y, z);
  return (
    `<g transform="translate(${fmt(sx)} ${fmt(sy)}) matrix(${SX} 0 ${DX} ${DY} 0 0)" filter="url(#blurSoft)">` +
    `<ellipse rx="${fmt(rx)}" ry="${fmt(rz)}" fill="#241B0F" opacity="${opacity}"/></g>`
  );
};

/** Верхняя половина арки колеса — как прорезь в борту. */
export const arch = (x, y, z, r, stroke, w = 10, extra = '') => {
  const [sx, sy] = pr(x, y, z);
  const rx = r * SX;
  return `<path d="M${fmt(sx + rx)} ${fmt(sy)} A${fmt(rx)} ${fmt(r)} 0 0 0 ${fmt(sx - rx)} ${fmt(sy)}" fill="none" stroke="${stroke}" stroke-width="${w}" ${extra}/>`;
};

/** Дуга колеса на любой угол: от a0 до a1 (0 — вправо, 90 — вверх). */
export const arcSpan = (x, y, z, r, stroke, w = 8, a0 = 20, a1 = 160, extra = '') => {
  const pts = [];
  const n = 22;
  for (let i = 0; i <= n; i += 1) {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    pts.push(pr(x + Math.cos(a) * r, y + Math.sin(a) * r, z));
  }
  const d = pts.map(([sx, sy], i) => `${i ? 'L' : 'M'}${fmt(sx)} ${fmt(sy)}`).join('');
  return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" ${extra}/>`;
};

export const ISO_DEFS = `
<filter id="blurSoft" x="-50%" y="-90%" width="200%" height="300%">
  <feGaussianBlur stdDeviation="10"/>
</filter>`;

export { SX, DYX };

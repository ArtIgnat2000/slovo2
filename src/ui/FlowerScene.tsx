/**
 * «Цветок слова» — сцена (0.109.0: рисунок вместо CSS-фигур).
 *
 * История правок:
 *  • 0.108.0 — цветок вырос из «ряда кружков»: CSS-лепестки, стебель в
 *    переменной `--stem`, пыльца и светлячки;
 *  • 0.109.0 — владелец попросил «уровень Pixar»: лепесток, серединка и лист
 *    теперь нарисованные 3D-ассеты (`public/flower/*.webp`, суммарно ~35 КБ),
 *    а не градиенты в CSS. Фон сцены — размытая солнечная поляна.
 *
 * Что осталось на CSS и почему: стебель, тень у корня, пыльца и светлячки.
 * Стебель обязан менять высоту по прогрессу (это и есть «рост»), а рисованный
 * стебель пришлось бы масштабировать — он бы «толстел» на длинных словах.
 * «Земля» стала мягкой тенью-пятном: горшок в поляне смотрелся бы мебелью.
 * Остальное — частицы, им рисунок не нужен.
 *
 * Офлайн и темы: ассеты лежат в бандле (precache), новых сетевых запросов нет.
 * Рисунок не зависит от темы — это нормально для «картинки природы»: сцену
 * можно ставить на любую тему, подложка приглушается до 88 % непрозрачности и
 * притемняется в тёмных темах, чтобы светлая поляна не резала глаз.
 */
import type { CSSProperties } from 'react';

export interface FlowerSceneProps {
  /** Буквы слова (без пробелов и дефисов). */
  letters: string[];
  /** Сколько букв открыто — столько лепестков распустилось. */
  opened: number;
  /** Буква только что открылась — «распуск» именно её. */
  justOpened: boolean;
  /** Только что был промах: пыльца и качание, без «порчи» цветка. */
  wrong: boolean;
  /** Слово собрано целиком. */
  done: boolean;
}

export function FlowerScene({ letters, opened, justOpened, wrong, done }: FlowerSceneProps) {
  const total = Math.max(1, letters.length);
  // Стебель: 4 буквы — 44→100 px, 5–6 — 48→112, 7 и больше — 54→126.
  // Цифры не из головы: соцветие 152 px, высокий стебель сдвинул бы его вверх
  // и лепестки упёрлись бы в край сцены, низкий — спрятал бы рост.
  const [stemLow, stemHigh] = total <= 4 ? [44, 100] : total <= 6 ? [48, 112] : [54, 126];
  const stem = Math.round(stemLow + (opened / total) * (stemHigh - stemLow));
  // Плотность лепестков по длине слова: окружность при r=46 всего ~290 px,
  // поэтому на длинных словах лепестки мельче и жмутся ближе к середине.
  const bloom = total <= 4 ? ' is-roomy' : total <= 6 ? '' : total <= 8 ? ' is-dense' : ' is-denser';
  return (
    <div
      className={`flower-scene${done ? ' is-done' : ''}${wrong ? ' is-wrong' : ''}`}
      data-flower-opened={opened}
      data-flower-done={done ? '1' : '0'}
    >
      {/* Поляна: рисованная размытая подложка + два пучка травы у земли. */}
      <div className="flower-meadow" aria-hidden="true" />
      <div className="flower-grass" aria-hidden="true" />

      <div className="flower-plant" style={{ ['--stem' as string]: `${stem}px` } as CSSProperties}>
        {/* Соцветие: лепестки по числу букв, повёрнутые вокруг серединки. */}
        <div className={`flower-bloom${bloom}`} aria-hidden="true">
          {letters.map((ch, i) => {
            const open = i < opened;
            const angle = (360 / total) * i;
            return (
              <span
                key={i}
                className={`flower-blossom${open ? ' is-open' : ''}${i === opened - 1 && justOpened ? ' is-fresh' : ''}`}
                style={{ ['--petal-angle' as string]: `${angle}deg` } as CSSProperties}
                data-flower-petal={i}
              >
                <img className="flower-petal-img" src="/flower/petal.webp" alt="" draggable={false} />
                {open && <span className="flower-petal-letter">{ch}</span>}
              </span>
            );
          })}
          <span className={`flower-core${done ? ' is-done' : ''}`}>
            <img src="/flower/center.webp" alt="" draggable={false} />
            {done && <span className="flower-core-spark">✦</span>}
          </span>
        </div>

        {/* Стебель: высота из прогресса, листья — рисованные. */}
        <div className="flower-trunk" aria-hidden="true">
          <img className="flower-leaf flower-leaf-l" src="/flower/leaf.webp" alt="" draggable={false} />
          <img className="flower-leaf flower-leaf-r" src="/flower/leaf.webp" alt="" draggable={false} />
        </div>
        <div className="flower-soil" aria-hidden="true" />

        {wrong && <span className="flower-pollen" aria-hidden="true">✳</span>}
        {done && (
          <span className="flower-sparkles" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <span key={i} className={`flower-spark flower-spark-${i}`}>
                ✦
              </span>
            ))}
          </span>
        )}
      </div>

      {/* Слово под цветком: доступная (не только визуальная) копия прогресса. */}
      <p className="flower-word" aria-live="polite" aria-label={`Открыто ${opened} из ${letters.length} букв`}>
        {letters.map((ch, i) => (
          <span key={i} className={i < opened ? 'flower-word-on' : 'flower-word-off'}>
            {i < opened ? ch : '·'}
          </span>
        ))}
      </p>
    </div>
  );
}

/**
 * «Цветок слова» — сцена (0.108.0).
 *
 * До этой версии игра выглядела как список: ряд кружков, строка-стебель, четыре
 * кнопки. Владелец: «нет никакого визуала, скучно». Поэтому визуал — не
 * украшение поверх логики, а сама обратная связь:
 *
 *  • **цветок растёт**: каждый верный шаг раскрывает лепесток и добавляет
 *    стебельку высоты, бутон поднимается — видно, что «я продвинулся»;
 *  • **ошибка = пыльца**: вместо красной плашки лепесток мягко вспыхивает
 *    пыльцой, листик качается, и тут же появляется подсказка;
 *  • **победа = цветение**: лепестки распускаются кругом, летят светлячки,
 *    слово раскрывается целиком под цветком.
 *
 * Только токены темы и CSS-переменные: никаких картинок, внешних файлов и
 * шрифтов — офлайн-PWA не тянет ничего. Все анимации ≤ 1.2 с и отключаются при
 * `prefers-reduced-motion` (правило §10 плана и `perf-audit`).
 *
 * Компонент чистый: получает буквы, число открытых и признак «только что
 * ошиблись» — и ничего не знает о движке, наградах и сторе.
 */
import type { CSSProperties } from 'react';

export interface FlowerSceneProps {
  /** Буквы слова (без пробелов и дефисов). */
  letters: string[];
  /** Сколько букв открыто — столько лепестков распустилось. */
  opened: number;
  /** Буква только что открылась — запускаем «распуск» именно её. */
  justOpened: boolean;
  /** Только что был промах: пыльца и качание, без «порчи» цветка. */
  wrong: boolean;
  /** Слово собрано целиком. */
  done: boolean;
}

export function FlowerScene({ letters, opened, justOpened, wrong, done }: FlowerSceneProps) {
  const total = Math.max(1, letters.length);
  // Высота стебля растёт с прогрессом: 64 → 132 px. Это и есть «рост».
  const stem = Math.round(64 + (opened / total) * 68);
  return (
    <div
      className={`flower-scene${done ? ' is-done' : ''}${wrong ? ' is-wrong' : ''}`}
      data-flower-opened={opened}
      data-flower-done={done ? '1' : '0'}
    >
      {/* Небо и трава: два слоя на токенах темы, без картинок. */}
      <div className="flower-sky" aria-hidden="true">
        <span className="flower-sun" />
        <span className="flower-cloud flower-cloud-a" />
        <span className="flower-cloud flower-cloud-b" />
      </div>

      <div className="flower-plant" style={{ ['--stem' as string]: `${stem}px` } as CSSProperties}>
        {/* Соцветие: лепестки по числу букв. Закрытые — маленькие бутоны у
            центра, открытые — повёрнуты наружу и подписаны буквой. */}
        <div className="flower-bloom" aria-hidden="true">
          <span className="flower-core">{done ? '✿' : opened === 0 ? '•' : '❀'}</span>
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
                <span className="flower-blossom-inner">{open ? ch : ''}</span>
              </span>
            );
          })}
        </div>

        <div className="flower-trunk" aria-hidden="true">
          <span className="flower-leaf flower-leaf-l" />
          <span className="flower-leaf flower-leaf-r" />
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

      {/* Слово под цветком: открытые буквы — крупно, закрытые — точками.
          Это доступная (не только визуальная) копия прогресса: скринридер
          читает её, и ребёнок видит слово, а не абстрактные лепестки. */}
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

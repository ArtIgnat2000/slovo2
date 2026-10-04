/**
 * БУК-помощник в уроке (2026-10-04, docs/buk-in-lesson.md).
 *
 * Задача была «чтобы БУК помогал, а не отвлекал», поэтому помощник устроен
 * наоборот к плавающему БУКу: он не летает поверх задания, а живёт в шапке урока
 * маленькой спокойной совой и появляется с репликой только тогда, когда есть
 * что сказать (вопрос по слову, показанное опасное место, строка в вердикте).
 *
 * Плавающий БУК на карточках остаётся скрытым — это контракт тестов
 * (`pretest-audit`: «во время карточек урока плавающий БУК скрыт»).
 */
import { growthStage } from '../engine/shop';
import { masteredCount, useActiveProfile, useLook } from '../state/store';
import { Mascot } from './Mascot';

/** Сова в шапке урока: тап — открыть помощь, пульс — «я рядом, если нужно». */
export function BukHelpOwl({
  open,
  nudge,
  onOpen,
}: {
  open: boolean;
  nudge: boolean;
  onOpen: () => void;
}) {
  const profile = useActiveProfile();
  const look = useLook();
  const stage = growthStage(masteredCount(profile)).index;
  return (
    <div className="buk-owl-wrap">
      <button
        type="button"
        className={`buk-owl ${nudge ? 'pulse' : ''}`}
        aria-label="Помощник БУК"
        aria-expanded={open}
        onClick={onOpen}
      >
        <Mascot mood={open ? 'think' : 'idle'} look={look} stage={stage} size={40} />
      </button>
      {nudge && (
        // Пузырь висит поверх полосы прогресса, а не сдвигает задание:
        // иначе ребёнок, целясь в ответ, попал бы пальцем мимо строки.
        <button type="button" className={`buk-nudge ${nudge ? 'pop' : ''}`} onClick={onOpen}>
          Подсказать?
        </button>
      )}
    </div>
  );
}

/**
 * Панель помощи над заданием: живёт в потоке (как баннер), поэтому не может
 * наехать на клавиатуру сборки и письма.
 */
export function BukHelpPanel({
  text,
  stage,
  onReveal,
  onDismiss,
}: {
  text: string;
  stage: 1 | 2;
  onReveal: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="buk-panel" role="region" aria-label="Помощник БУК">
      <p className="buk-panel-text">
        <b>БУК:</b> {text}
      </p>
      <div className="row">
        {stage === 1 && (
          <button type="button" className="btn ghost sm" onClick={onReveal}>
            💡 Показать букву
          </button>
        )}
        <button type="button" className="btn ghost sm" onClick={onDismiss}>
          Я сам
        </button>
      </div>
    </div>
  );
}

/** Строчка БУКа в полосе вердикта — единственное место, где он виден в уроке. */
export function BukVerdictLine({ text }: { text: string }) {
  return (
    <div className="buk-verdict">
      <b>БУК:</b> {text}
    </div>
  );
}

import { dayKey, dayPlan, useActiveProfile } from '../state/store';
import {
  bonusChestsReady,
  claimableQuests,
  dailyChestClaimed,
  dayMetrics,
  plural,
  questProgress,
} from '../engine/quests';
import { Icon } from './Icon';

/**
 * Полоска «Задания дня» на главной (0.35.0, docs/proposals/daily-quests-on-home.md).
 *
 * До 0.12.2 задания стояли на первом экране полным блоком с тремя барами,
 * кнопками «Начать» и «Забрать», сундуком и «разбуди» — и давали 6–10
 * конкурирующих тапов, а «Начать ▶» уезжало под сгиб. После 0.12.2 они жили
 * только в листе наград, и дети перестали их видеть: задания — ежедневная
 * механика, прятать её целиком неправильно (goal-gradient, эффект Зейгарник).
 *
 * Поэтому здесь — одна строка-итог и одна кнопка: сколько заданий закрыто,
 * что ждёт в конце (сундук) и что можно забрать прямо сейчас. Подробности,
 * «Забрать» и сам сундук — в прежнем листе наград, дублей действий нет.
 */
export function DailyQuestStrip({ onOpen }: { onOpen: () => void }) {
  const profile = useActiveProfile();
  if (!profile) return null;

  const day = dayKey();
  const quests = dayPlan(profile);
  const metrics = dayMetrics(profile.days[day]);
  const st = profile.daily && profile.daily.day === day ? profile.daily : null;
  const claimed = st?.claimed ?? [];
  // План дня всегда из трёх заданий; пустой — значит, считать нечего и
  // полоска только занимала бы место над героем.
  if (!quests.length) return null;
  const done = quests.filter((q) => questProgress(q.spec, q.target, metrics).done).length;
  const total = quests.length;
  const all = quests.length > 0 && quests.every((q) => questProgress(q.spec, q.target, metrics).done);
  const chestReady = all && !dailyChestClaimed(st ?? undefined);
  const bonusReady = bonusChestsReady(metrics.lessons, st?.bonusChestsClaimed ?? 0);
  const claimable = claimableQuests(quests, metrics, claimed, day).length;

  /**
   * Одна фраза вместо трёх. Порядок по срочности: сначала «забери то, что уже
   * готово», потом «открой сундук», и только потом «сколько осталось» —
   * иначе ребёнок видел бы «3 из 3» и не знал, что награду нужно забрать.
   */
  const phrase = claimable
    ? `${claimable} ${plural(claimable, 'награда ждёт', 'награды ждут', 'наград ждут')} — забери!`
    : chestReady
      ? 'Сундук готов — открой!'
      : bonusReady > 0
        ? `Бонусный ${plural(bonusReady, 'сундук', 'сундука', 'сундуков')} готов`
        : all
          ? 'На сегодня всё готово ✓'
          : `Ещё ${total - done} ${plural(total - done, 'задание', 'задания', 'заданий')} — и сундук БУКа`;

  const hot = claimable > 0 || chestReady || bonusReady > 0;

  return (
    <button
      type="button"
      className={`quest-strip${hot ? ' ready' : ''}`}
      data-quest-strip
      aria-haspopup="dialog"
      aria-label={`Задания дня: ${done} из ${total}. ${phrase}. Открыть награды`}
      onClick={onOpen}
    >
      <span className="quest-strip-icon" aria-hidden="true">
        {/* 0.54.0: сундук — иконка; смысл полоски несут текст и aria-label. */}
        <Icon name="chest" size={26} />
      </span>
      <span className="quest-strip-text">
        <span className="quest-strip-title">
          Задания дня<span className="quest-strip-count"> · {done} из {total}</span>
        </span>
        <span className="quest-strip-meta">
          <span className="quest-strip-keys" aria-hidden="true">
            {quests.map((q) => {
              const isDone = questProgress(q.spec, q.target, metrics).done;
              return (
                <span key={q.spec.kind} className={`quest-strip-key${isDone ? ' on' : ''}`}>
                  {q.spec.emoji}
                </span>
              );
            })}
          </span>
          <span className="quest-strip-phrase">{phrase}</span>
        </span>
      </span>
      <span className="quest-strip-arrow" aria-hidden="true">
        ›
      </span>
    </button>
  );
}

import { useEffect, useState } from 'react';
import { scheduleWordImages } from '../../platform/word-images';
import { LESSONS, WORDS } from '../../content/words';
import { dayKey, useActiveProfile } from '../../state/store';
import { Crowns } from '../Bits';
import { DailyQuests } from '../DailyQuests';
import { WeeklyRewards } from '../WeeklyRewards';
import { levelOf } from '../../engine/rewards';
import { pickReviewWords } from '../../engine/srs';
import {
  allQuestsDone,
  bonusChestsReady,
  claimableQuests,
  dailyChestClaimed,
  dayMetrics,
  planOf,
  plannedQuests,
  plural,
  type QuestKind,
} from '../../engine/quests';
import type { Profile } from '../../types';

interface Props {
  onStartLesson: (lessonId: string) => void;
  onOpenProfiles: () => void;
  /** «Пора повторить» — отдельный режим тренировки, id урока не нужен */
  onStartReview: () => void;
  /** 🚗 в шапке — сцена коллекции техники «Ангар БУКа» (0.22.0) */
  onOpenHangar: () => void;
}

/** Есть ли в листе наград что забрать: квест, сундук или бонусный сундук. */
function rewardsWaiting(profile: Profile): boolean {
  const day = dayKey();
  const plan = planOf(profile, day);
  const st = profile.daily && profile.daily.day === day ? profile.daily : null;
  const metrics = dayMetrics(profile.days[day]);
  if (claimableQuests(plannedQuests(plan), metrics, st?.claimed ?? [], day).length) return true;
  if (allQuestsDone(plan, metrics) && !dailyChestClaimed(st ?? undefined)) return true;
  return bonusChestsReady(metrics.lessons, st?.bonusChestsClaimed ?? 0) > 0;
}

export function HomeScreen({ onStartLesson, onOpenProfiles, onStartReview, onOpenHangar }: Props) {
  const profile = useActiveProfile();
  const [rewardsOpen, setRewardsOpen] = useState(false);
  const current = LESSONS.find((l) => (profile?.lessons[l.id]?.level ?? 0) < 5) ?? LESSONS[LESSONS.length - 1];
  useEffect(() => scheduleWordImages(WORDS.filter((w) => current.wordIds.includes(w.id))), [current]);
  useEffect(() => {
    if (!rewardsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setRewardsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rewardsOpen]);
  if (!profile) return null;

  /**
   * Запуск задания дня: «Повтори N слов» ведёт в режим повторения, остальные задания
   * выполняются в уроке — открываем текущий урок с карты пути.
   */
  const startQuest = (kind: QuestKind) => {
    setRewardsOpen(false);
    if (kind === 'review') onStartReview();
    else onStartLesson(current.id);
  };

  const lvl = levelOf(profile.xp);

  // «Пора повторить» считает слова тем же правилом, что и сам урок повторения:
  // раньше блок обещал слова, которых урок не показывал, и открывалось «Повторять нечего!».
  const review = pickReviewWords(
    WORDS,
    profile.words,
    new Set(),
    12,
    new Set(profile.days[dayKey()]?.reviewWords ?? []),
  );
  const reviews = review.words;
  const reviewDue = reviews.length > 0 && review.kind === 'due';
  const currentDone = current.wordIds.filter((id) => (profile.words[id]?.s ?? 0) > 0).length;
  const waiting = rewardsWaiting(profile);

  const startHero = () => {
    if (reviewDue) onStartReview();
    else onStartLesson(current.id);
  };

  return (
    <div className="screen">
      <div className="topbar">
        <button className="avatar" onClick={onOpenProfiles} title="Профили">
          {profile.avatar}
        </button>
        <div className="grow">
          <div className="topbar-name">{profile.name}</div>
        </div>
        <div className="stat-pill fire">🔥 {profile.streak}</div>
        <div className="stat-pill gems">💎 {profile.gems}</div>
        <button
          type="button"
          className="stat-pill hangar-btn"
          aria-label="Ангар БУКа"
          title="Ангар БУКа — твоя техника"
          onClick={onOpenHangar}
        >
          🚗
        </button>
        <button
          type="button"
          className={`stat-pill rewards-btn ${waiting ? 'wait' : ''}`}
          aria-label={waiting ? 'Награды, есть что забрать' : 'Награды'}
          aria-expanded={rewardsOpen}
          onClick={() => setRewardsOpen(true)}
        >
          🎁
          {waiting && <span className="rewards-dot" aria-hidden="true" />}
        </button>
      </div>

      <button
        type="button"
        className="home-hero mb"
        onClick={startHero}
        aria-label={reviewDue ? 'Начать: Пора повторить' : `Начать: ${current.title}`}
      >
        <div className="home-hero-kicker">Сегодня</div>
        <div className="home-hero-body">
          <span className="home-hero-emoji" aria-hidden="true">
            {reviewDue ? '🔁' : current.emoji}
          </span>
          <span className="grow">
            <span className="home-hero-title">{reviewDue ? 'Пора повторить' : current.title}</span>
            <span className="home-hero-meta">
              {reviewDue
                ? `${reviews.length} ${plural(reviews.length, 'слово готово', 'слова готовы', 'слов готовы')} забыться`
                : `${currentDone} из ${current.wordIds.length} слов · ур. ${lvl}`}
            </span>
          </span>
        </div>
        <span className="home-hero-cta">Начать ▶</span>
      </button>

      <h2 className="home-path-title">Мой путь</h2>
      <div className="path">
        {LESSONS.map((l) => {
          const st = profile.lessons[l.id];
          const level = st?.level ?? 0;
          const doneWords = l.wordIds.filter((id) => (profile.words[id]?.s ?? 0) > 0).length;
          const isCurrent = l.id === current.id;
          return (
            <div className="node" key={l.id}>
              <button
                className={`node-btn ${isCurrent ? 'current' : 'quiet'}`}
                onClick={() => onStartLesson(l.id)}
              >
                <span className="node-emoji">{l.emoji}</span>
                <span className="grow">
                  <span className="node-title">{l.title}</span>
                  <Crowns level={level} />
                  <div className="tiny">
                    {doneWords} / {l.wordIds.length} слов
                  </div>
                </span>
                <span style={{ fontSize: 22 }}>{isCurrent ? '▶' : '▸'}</span>
              </button>
            </div>
          );
        })}
      </div>

      {rewardsOpen && (
        <div className="sheet-backdrop rewards-backdrop" onClick={() => setRewardsOpen(false)}>
          <div
            className="rewards-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Награды"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row mb">
              <h2 className="grow" style={{ margin: 0 }}>
                Награды
              </h2>
              <button type="button" className="lesson-exit" aria-label="Закрыть" onClick={() => setRewardsOpen(false)}>
                ✕
              </button>
            </div>
            <DailyQuests onStart={startQuest} />
            <WeeklyRewards />
          </div>
        </div>
      )}
    </div>
  );
}

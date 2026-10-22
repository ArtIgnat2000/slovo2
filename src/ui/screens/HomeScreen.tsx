import { useEffect, useState } from 'react';
import { scheduleWordImages } from '../../platform/word-images';
import {
  CLASS_META,
  LESSONS_BY_GRADE,
  WORDS,
  availableClass,
} from '../../content/words';
import { dayKey, useActiveProfile, useApp } from '../../state/store';
import { Crowns } from '../Bits';
import { ClassPicker } from '../ClassPicker';
import { DailyQuests } from '../DailyQuests';
import { InviteFriend } from '../InviteFriend';
import { WeeklyRewards } from '../WeeklyRewards';
import { levelOf } from '../../engine/rewards';
import { classProgress, nextClass } from '../../engine/classes';
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
}

/**
 * Сколько наград ждёт в листе (0.32.0): число на кнопке 🎁 — обещание,
 * поэтому считаем ровно те действия, которые ребёнок там найдёт, —
 * «Забрать» у задания, «Открыть сундук БУКа» и «Открыть бонусный сундук».
 *
 * Недельные награды не считаем: они начисляются сами в `finishLesson`
 * (state/store.ts), в листе только показывается прогресс — забирать нечего.
 * Иначе бейдж звал бы за наградой, которой там нет.
 */
function rewardsCount(profile: Profile): number {
  const day = dayKey();
  const plan = planOf(profile, day);
  const st = profile.daily && profile.daily.day === day ? profile.daily : null;
  const metrics = dayMetrics(profile.days[day]);
  let count = claimableQuests(plannedQuests(plan), metrics, st?.claimed ?? [], day).length;
  if (allQuestsDone(plan, metrics) && !dailyChestClaimed(st ?? undefined)) count += 1;
  count += bonusChestsReady(metrics.lessons, st?.bonusChestsClaimed ?? 0);
  return count;
}

export function HomeScreen({ onStartLesson, onOpenProfiles, onStartReview }: Props) {
  const profile = useActiveProfile();
  const setActiveClass = useApp((s) => s.setActiveClass);
  const [rewardsOpen, setRewardsOpen] = useState(false);
  /** «Позови друга» — 0.32.1: ссылка должна быть в один тап с первого экрана. */
  const [inviteOpen, setInviteOpen] = useState(false);
  // Программа активного класса: «Мой путь» и герой показывают только её.
  // Класс — свойство профиля, поэтому у каждого ученика свой путь.
  const grade = availableClass(profile?.activeClass ?? 2);
  const classLessons = LESSONS_BY_GRADE[grade];
  const current =
    classLessons.find((l) => (profile?.lessons[l.id]?.level ?? 0) < 5) ??
    classLessons[classLessons.length - 1];
  // «Класс пройден» — все уроки программы закрыты (уровень 5). Следующий класс
  // берём из движка классов: там же это правило используют лист класса и отчёт.
  const classInfo = classProgress(profile, grade);
  const classDone = classInfo.complete;
  const nextGrade = nextClass(grade);
  useEffect(
    () => (current ? scheduleWordImages(WORDS.filter((w) => current.wordIds.includes(w.id))) : undefined),
    [current],
  );
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
  // Повторение — по всем изученным словам 1–4, а не только активного класса:
  // иначе при переходе 2 → 3 слова 2 класса перестают приходить в повтор,
  // а задание дня «Повтори N слов» становится невыполнимым.
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
  const rewards = rewardsCount(profile);

  const startHero = () => {
    if (reviewDue) onStartReview();
    else onStartLesson(current.id);
  };

  return (
    <div className="screen">
      {/* Шапка «четыре блока, два действия» (0.32.0, docs/proposals/home-header.md):
          профиль одной кнопкой, серия и кристаллы — тихий статус без рамок,
          награды — единственная рамка-кнопка с числом. 🤝 переехал на экран
          «Кто будет учиться?», 🚗 — в гардероб БУКа: там их и ищут. */}
      <div className="topbar">
        <button
          type="button"
          className="profile-btn"
          title="Профили"
          aria-label={`Профиль: ${profile.name}. Сменить ученика`}
          onClick={onOpenProfiles}
        >
          <span className="avatar" aria-hidden="true">
            {profile.avatar}
          </span>
          <span className="topbar-name">{profile.name}</span>
        </button>

        <div className="grow" aria-hidden="true" />

        <div
          className="topbar-stat fire"
          role="img"
          data-stat="streak"
          aria-label={`Серия: ${profile.streak} ${plural(profile.streak, 'день', 'дня', 'дней')}`}
        >
          <span aria-hidden="true">🔥 {profile.streak}</span>
        </div>
        <div
          className="topbar-stat gems"
          role="img"
          data-stat="gems"
          aria-label={`Кристаллы: ${profile.gems}`}
        >
          <span aria-hidden="true">💎 {profile.gems}</span>
        </div>

        <button
          type="button"
          className="rewards-btn"
          data-stat="rewards"
          aria-label={
            rewards > 0
              ? `Награды: ${rewards} ${plural(rewards, 'награда ждёт', 'награды ждут', 'наград ждут')}`
              : 'Награды'
          }
          aria-expanded={rewardsOpen}
          onClick={() => setRewardsOpen(true)}
        >
          <span aria-hidden="true">🎁</span>
          {rewards > 0 && (
            <span className="rewards-count" aria-hidden="true">
              {rewards > 9 ? '9+' : rewards}
            </span>
          )}
        </button>
      </div>

      <ClassPicker profile={profile} />

      {classDone && !reviewDue ? (
        <button
          type="button"
          className="home-hero mb"
          onClick={() => (nextGrade ? setActiveClass(nextGrade) : onStartReview())}
          aria-label={nextGrade ? `Перейти в ${CLASS_META[nextGrade].title}` : 'Повторить слова'}
        >
          <div className="home-hero-kicker">Класс пройден</div>
          <div className="home-hero-body">
            <span className="home-hero-emoji" aria-hidden="true">
              🎉
            </span>
            <span className="grow">
              <span className="home-hero-title">{CLASS_META[grade].title} пройден!</span>
              <span className="home-hero-meta">
                {classLessons.length} {plural(classLessons.length, 'урок', 'урока', 'уроков')} позади ·{' '}
                {classInfo.mastered} из {classInfo.words} {plural(classInfo.words, 'слово', 'слова', 'слов')} освоено
              </span>
            </span>
          </div>
          <span className="home-hero-cta">
            {nextGrade ? `${CLASS_META[nextGrade].title} ▶` : 'Повторить ▶'}
          </span>
        </button>
      ) : (
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
      )}

      {/* Ссылка на приложение — в один тап с главной (0.32.1). Раньше 🤝
          прятался за кнопкой профиля: ребёнок его не находил. Здесь это
          тихая текстовая ссылка, а не третья рамка в шапке: «Начать ▶»
          остаётся единственным крупным действием. */}
      <button
        type="button"
        className="invite-cta"
        aria-label="Позвать друга: показать QR-код или отправить ссылку"
        onClick={() => setInviteOpen(true)}
      >
        <span aria-hidden="true">🤝</span>
        <span className="invite-cta-text">Позови друга</span>
        <span className="invite-cta-arrow" aria-hidden="true">
          ➜
        </span>
      </button>

      <h2 className="home-path-title">Мой путь</h2>
      <div className="path">
        {classLessons.map((l) => {
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

      {inviteOpen && <InviteFriend onClose={() => setInviteOpen(false)} />}

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

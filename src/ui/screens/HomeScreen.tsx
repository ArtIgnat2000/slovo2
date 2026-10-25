import { useEffect, useState } from 'react';
import { scheduleWordImages } from '../../platform/word-images';
import {
  AVAILABLE_CLASSES,
  CLASS_META,
  LESSONS_BY_GRADE,
  WORDS,
  availableClass,
} from '../../content/words';
import { dayKey, useActiveProfile, useApp } from '../../state/store';
import { Crowns } from '../Bits';
import { ClassSheet } from '../ClassSheet';
import { DailyQuests } from '../DailyQuests';
import { DailyQuestStrip } from '../DailyQuestStrip';
import { drillLimit, hardWords, listStats } from '../../engine/word-lists';
import { Icon, Gem } from '../Icon';
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
  /** Меню ведёт прямо в «Мои покупки» или в «Ангар» (0.33.0) */
  onOpenShop: (view: 'vitrina' | 'wardrobe', hangar?: boolean) => void;
  /** Списки слов к контрольной (0.58.0): тренировка, полный контроль, ошибки. */
  onStartList: (listId: string, mode?: 'train' | 'check' | 'errors') => void;
}

/**
 * Сколько наград ждёт в листе (0.32.0): число у «Наград» в меню ☰ (0.33.0) —
 * обещание, поэтому считаем ровно те действия, которые ребёнок там найдёт, —
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

export function HomeScreen({ onStartLesson, onOpenProfiles, onStartReview, onOpenShop, onStartList }: Props) {
  const profile = useActiveProfile();
  const setActiveClass = useApp((s) => s.setActiveClass);
  const [rewardsOpen, setRewardsOpen] = useState(false);
  /** «Позови друга» — 0.32.1: ссылка должна быть в один тап с первого экрана. */
  const [inviteOpen, setInviteOpen] = useState(false);
  /** Меню ☰ (0.33.0) — заменяет 🎁 в шапке: награды, покупки, ангар, друг, профиль. */
  const [menuOpen, setMenuOpen] = useState(false);
  /** Лист класса (0.33.0): вход — строкой в меню, а не пилюлей над героем. */
  const [classOpen, setClassOpen] = useState(false);
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

  /** Escape закрывает меню, как любой лист в приложении. */
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const openMenuSheet = (open: () => void) => {
    setMenuOpen(false);
    open();
  };

  const startHero = () => {
    if (reviewDue) onStartReview();
    else onStartLesson(current.id);
  };

  return (
    <div className="screen">
      {/* Шапка (0.33.0): три блока и два действия. 💎 — главный и единственный
          счётчик в строке: кристаллы ребёнок видит, тратит и понимает. 🔥 из
          шапки ушёл в меню — там у огонька есть слова, а не только цифра.
          ☰ заменил 🎁: в меню не только награды, но и покупки, ангар, друг
          и смена ученика (docs/proposals/home-menu.md). */}
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
          className="topbar-stat gems"
          role="img"
          data-stat="gems"
          aria-label={`Кристаллы: ${profile.gems}`}
        >
          {/* 0.54.0: кристалл — SVG-иконка, а не эмодзи: в 16–18 px эмодзи
              «плывёт» от шрифта к устройству, а иконка наследует цвет текста. */}
          <Gem value={profile.gems} size={26} />
        </div>

        <button
          type="button"
          className="menu-btn"
          data-menu-trigger
          aria-label="Меню: награды, покупки и другое"
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
        >
          <Icon name="menu" size={22} />
        </button>
      </div>

      {/* «Задания дня» — одной строкой над героем (0.35.0). Дети видят их
          каждый день, но подробности, «Забрать» и сундук остаются в листе
          наград: на главной ноль конкурирующих кнопок, «Начать ▶» — главное
          действие. docs/proposals/daily-quests-on-home.md */}
      {/* Слова к контрольной (0.58.0): списки создаёт родитель, ребёнок видит
          их здесь — узкой карточкой с одной кнопкой. Если списков нет, блока
          тоже нет: лишних обещаний на главной не появляется. */}
      {(profile.lists ?? []).length > 0 && (
        <div className="list-cards">
          {(profile.lists ?? []).map((list) => {
            const stats = listStats(list, profile.customWords ?? {});
            const trained = list.words.filter((id) => (profile.words?.[id]?.ok ?? 0) > 0).length;
            // 0.63.0: «трудные» — по всей истории заходов, а не только по
            // последней контрольной; размер тренировки — отдельный параметр.
            const errors = hardWords(list, 20).length || (list.lastCheck?.wrong.length ?? 0);
            const perRun = drillLimit(profile, stats.total);
            // 0.62.0: два режима вместо одного. Тренировка берёт часть слов
            // (по размеру урока) и даёт подсказки; полный контроль проходит
            // ВСЕ слова по одному заданию без подсказок и с отчётом.
            return (
              <div key={list.id} className="list-card-block">
                <button
                  type="button"
                  className="list-card"
                  data-list-card={list.id}
                  aria-label={`Список «${list.title}», ${stats.total} слов. Начать тренировку`}
                  onClick={() => onStartList(list.id, 'train')}
                >
                  <span className="list-card-icon" aria-hidden="true">🏫</span>
                  <span className="list-card-text">
                    <span className="list-card-title">{list.title}</span>
                    <span className="list-card-meta">
                      {stats.total} слов
                      {trained > 0 ? ` · тренировано ${trained}` : ''}
                      {list.lastCheck ? ` · контрольная: ${list.lastCheck.correct} из ${list.lastCheck.total}` : ''}
                    </span>
                  </span>
                  <span className="list-card-go" aria-hidden="true">
                    Тренировка · {perRun}
                  </span>
                </button>
                <div className="list-card-modes">
                  <button
                    type="button"
                    className="btn ghost sm"
                    data-list-check={list.id}
                    onClick={() => onStartList(list.id, 'check')}
                  >
                    📋 Полный контроль · все {stats.total}
                  </button>
                  {errors > 0 && (
                    <button
                      type="button"
                      className="btn ghost sm"
                      data-list-errors={list.id}
                      onClick={() => onStartList(list.id, 'errors')}
                    >
                      🔁 Трудные · {Math.min(errors, perRun)}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <DailyQuestStrip onOpen={() => setRewardsOpen(true)} />

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

      {/* Класс живёт здесь, а не пилюлей над героем (0.33.0): заголовок уже
          есть, а подпись «· 2 класс» даёт ту же ориентацию за 0 px высоты. */}
      <h2 className="home-path-title">
        Мой путь
        {AVAILABLE_CLASSES.length > 1 && (
          <span className="home-path-class"> · {CLASS_META[grade].title}</span>
        )}
      </h2>
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
      {classOpen && <ClassSheet profile={profile} onClose={() => setClassOpen(false)} />}

      {/* Меню ☰: один уровень, крупные подписанные строки, только вторичные
          дела. Главное действие «Начать ▶» остаётся на экране и в меню не
          прячется. Сверху — расшифровка счётчиков: у 🔥 и 💎 должны быть слова. */}
      {menuOpen && (
        <div className="sheet-backdrop rewards-backdrop" onClick={() => setMenuOpen(false)}>
          <div
            className="home-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Меню"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row mb">
              <h2 className="grow" style={{ margin: 0 }}>
                Меню
              </h2>
              <button type="button" className="lesson-exit" aria-label="Закрыть" onClick={() => setMenuOpen(false)}>
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="menu-status">
              <div className="menu-status-row">
                <span className="menu-status-emoji" aria-hidden="true">
                  <Icon name="crystal" size={22} />
                </span>
                <div className="grow">
                  <div className="menu-status-title">Кристаллы: {profile.gems}</div>
                  <div className="tiny muted">
                    Копятся за уроки и задания. Тратятся в БУКе — на наряды, технику и музыку.
                  </div>
                </div>
              </div>
              <div className="menu-status-row">
                <span className="menu-status-emoji" aria-hidden="true">
                  <Icon name="flame" size={22} />
                </span>
                <div className="grow">
                  <div className="menu-status-title">
                    Серия: {profile.streak > 0
                      ? `${profile.streak} ${plural(profile.streak, 'день', 'дня', 'дней')} подряд`
                      : 'пока нет'}
                  </div>
                  <div className="tiny muted">
                    {profile.streak > 0
                      ? 'Столько дней подряд ты занимаешься. Пропустишь день — счёт начнётся заново.'
                      : 'Позанимайся сегодня — и серия начнётся. День за днём она растёт.'}
                  </div>
                </div>
              </div>
            </div>

            <div className="menu-list">
              <button
                type="button"
                className="menu-row"
                data-menu="rewards"
                aria-label={
                  rewards > 0
                    ? `Награды: ${rewards} ${plural(rewards, 'награда ждёт', 'награды ждут', 'наград ждут')}`
                    : 'Награды'
                }
                onClick={() => openMenuSheet(() => setRewardsOpen(true))}
              >
                <span className="menu-row-emoji" aria-hidden="true">🎁</span>
                <span className="grow">
                  <span className="menu-row-title">Награды</span>
                  <span className="tiny muted">
                    {rewards > 0
                      ? `${rewards} ${plural(rewards, 'награда ждёт', 'награды ждут', 'наград ждут')}`
                      : 'Пока всё получено'}
                  </span>
                </span>
                {rewards > 0 && (
                  <span className="menu-count" aria-hidden="true">
                    {rewards > 9 ? '9+' : rewards}
                  </span>
                )}
                <span className="menu-row-arrow" aria-hidden="true">›</span>
              </button>

              <button
                type="button"
                className="menu-row"
                data-menu="purchases"
                onClick={() => openMenuSheet(() => onOpenShop('wardrobe'))}
              >
                <span className="menu-row-emoji" aria-hidden="true">🎒</span>
                <span className="grow">
                  <span className="menu-row-title">Мои покупки</span>
                  <span className="tiny muted">Наряды, техника, костюмы и музыка</span>
                </span>
                <span className="menu-row-arrow" aria-hidden="true">›</span>
              </button>

              <button
                type="button"
                className="menu-row"
                data-menu="hangar"
                onClick={() => openMenuSheet(() => onOpenShop('wardrobe', true))}
              >
                <span className="menu-row-emoji" aria-hidden="true">🚗</span>
                <span className="grow">
                  <span className="menu-row-title">Ангар</span>
                  <span className="tiny muted">Твоя техника крупным планом</span>
                </span>
                <span className="menu-row-arrow" aria-hidden="true">›</span>
              </button>

              <button
                type="button"
                className="menu-row"
                data-menu="invite"
                onClick={() => openMenuSheet(() => setInviteOpen(true))}
              >
                <span className="menu-row-emoji" aria-hidden="true">🤝</span>
                <span className="grow">
                  <span className="menu-row-title">Позови друга</span>
                  <span className="tiny muted">QR-код и ссылка на игру</span>
                </span>
                <span className="menu-row-arrow" aria-hidden="true">›</span>
              </button>

              <div className="menu-sep" aria-hidden="true" />

              <button
                type="button"
                className="menu-row"
                data-menu="class"
                onClick={() => openMenuSheet(() => setClassOpen(true))}
              >
                <span className="menu-row-emoji" aria-hidden="true">🎓</span>
                <span className="grow">
                  <span className="menu-row-title">{CLASS_META[grade].title}</span>
                  <span className="tiny muted">
                    {classInfo.complete && nextGrade
                      ? `Пройден · можно перейти в ${CLASS_META[nextGrade].title}`
                      : `${classInfo.words} ${plural(classInfo.words, 'слово', 'слова', 'слов')} · пройдено ${classInfo.lessonsDone} из ${classInfo.lessons}`}
                  </span>
                </span>
                <span className="menu-row-arrow" aria-hidden="true">›</span>
              </button>

              <button
                type="button"
                className="menu-row"
                data-menu="profiles"
                onClick={() => openMenuSheet(onOpenProfiles)}
              >
                <span className="menu-row-emoji" aria-hidden="true">👤</span>
                <span className="grow">
                  <span className="menu-row-title">Сменить ученика</span>
                  <span className="tiny muted">Профили и новый ученик</span>
                </span>
                <span className="menu-row-arrow" aria-hidden="true">›</span>
              </button>
            </div>

            {/* Версия релиза (0.65.0): ребёнок может назвать её взрослому —
                «у меня 0.65.0», и по номеру сразу понятно, что проверять.
                Номер подставляется сборкой из package.json, руками не правим. */}
            <p className="menu-version tiny muted" data-menu-version>
              СЛОВО 2.0 · версия {import.meta.env.VITE_APP_VERSION}
            </p>
          </div>
        </div>
      )}

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

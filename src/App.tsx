import { useEffect, useState } from 'react';
import { masteredCount, useActiveProfile, useApp, useLook } from './state/store';
import { useMascot } from './state/mascot';
import { Mascot } from './ui/Mascot';
import { HomeScreen } from './ui/screens/HomeScreen';
import { WordsScreen } from './ui/screens/WordsScreen';
import { ParentScreen } from './ui/screens/ParentScreen';
import { ProfilesScreen } from './ui/screens/ProfilesScreen';
import { LessonScreen } from './ui/screens/LessonScreen';
import { ShopScreen } from './ui/screens/ShopScreen';
import { setSoundEnabled } from './platform/sound';
import { setHapticsEnabled } from './platform/haptics';
import { applyUpdate, shouldSuggestInstall, markInstallHintShown } from './platform/pwa';
import { growthStage } from './engine/shop';

type Tab = 'home' | 'words' | 'shop' | 'parent';

/**
 * Всплывающая награда («+3 кристалла», «Сундук открыт»).
 * Живёт поверх любого экрана, включая урок, чтобы награда догоняла ребёнка
 * там, где он её заработал. Исчезает сама — нажимать нечего.
 */
function Toast() {
  const toast = useApp((s) => s.toast);
  const hide = useApp((s) => s.hideToast);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(hide, 3400);
    return () => clearTimeout(t);
  }, [toast, hide]);

  if (!toast) return null;
  return (
    <div className="toast" role="status" onClick={hide}>
      <span className="toast-emoji">{toast.emoji}</span>
      <div className="grow">
        <div className="toast-title">{toast.title}</div>
        {toast.text && <div className="tiny">{toast.text}</div>}
      </div>
    </div>
  );
}

export default function App() {
  const profile = useActiveProfile();
  const settings = useApp((s) => s.settings);
  const mood = useMascot((s) => s.mood);
  const message = useMascot((s) => s.message);
  // Аксессуары, купленные в магазине: БУК носит их и в уроках, и на главной
  const look = useLook();
  // Ступень роста: считается по освоенным словам, поэтому БУК растёт вместе со знаниями
  const stage = growthStage(masteredCount(profile)).index;

  const [tab, setTab] = useState<Tab>('home');
  const [lessonId, setLessonId] = useState<string | null>(null);
  // Цель дня на момент старта урока. Экран результатов сравнивает урок с ней,
  // а не с текущей настройкой: «Родители» могут поменять цель прямо во время урока.
  const [lessonGoal, setLessonGoal] = useState(settings.dailyGoal);
  const [profilesOpen, setProfilesOpen] = useState(false);
  const [parentUnlocked, setParentUnlocked] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    const dark =
      settings.theme === 'dark' ||
      (settings.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', dark ? '#171426' : '#7C5CFF');
  }, [settings.theme]);

  useEffect(() => {
    setSoundEnabled(settings.sound);
    setHapticsEnabled(settings.haptics);
  }, [settings.sound, settings.haptics]);

  useEffect(() => {
    window.addEventListener('slovo2:update', () => setUpdateReady(true));
    return () => window.removeEventListener('slovo2:update', () => setUpdateReady(true));
  }, []);

  if (!profile) {
    return (
      <div className="app">
        <ProfilesScreen />
      </div>
    );
  }

  const startLesson = (id: string) => {
    setLessonGoal(settings.dailyGoal);
    setLessonId(id);
  };

  if (lessonId) {
    return (
      <div className="app">
        {/* key — чтобы состояние урока не переезжало в другой урок */}
        <LessonScreen
          key={lessonId}
          lessonId={lessonId}
          goal={lessonGoal}
          onExit={() => setLessonId(null)}
        />
        <Toast />
      </div>
    );
  }

  return (
    <div className="app">
      {profilesOpen ? (
        <ProfilesScreen onClose={() => setProfilesOpen(false)} />
      ) : tab === 'home' ? (
        <HomeScreen
          onStartLesson={startLesson}
          onOpenProfiles={() => setProfilesOpen(true)}
          onStartReview={() => startLesson('review')}
        />
      ) : tab === 'words' ? (
        <WordsScreen />
      ) : tab === 'shop' ? (
        <ShopScreen />
      ) : (
        <ParentScreen
          unlocked={parentUnlocked}
          onUnlock={() => setParentUnlocked(true)}
          onOpenProfiles={() => setProfilesOpen(true)}
        />
      )}

      {!profilesOpen && tab !== 'shop' && (
        <Mascot mood={mood} message={message} look={look} stage={stage} />
      )}
      <Toast />

      {updateReady && (
        <div className="footer-bar">
          <div className="footer-inner">
            <div className="grow">
              <div className="verdict">Доступно обновление</div>
              <small>Обновим, чтобы занятия стали ещё лучше</small>
            </div>
            <button className="btn primary" onClick={() => applyUpdate()}>
              Обновить
            </button>
          </div>
        </div>
      )}

      {shouldSuggestInstall() && (
        <div className="footer-bar" style={{ bottom: 'calc(64px + var(--safe-b))' }}>
          <div className="footer-inner">
            <div className="grow">
              <div className="verdict">📲 Добавь приложение на экран</div>
              <small>Будет работать без интернета</small>
            </div>
            <button className="btn primary" onClick={() => markInstallHintShown()}>
              Понятно
            </button>
          </div>
        </div>
      )}

      <nav className="tabs">
        <button className={`tab ${tab === 'home' ? 'on' : ''}`} onClick={() => setTab('home')}>
          <span className="ico">🗺️</span>
          Уроки
        </button>
        <button className={`tab ${tab === 'words' ? 'on' : ''}`} onClick={() => setTab('words')}>
          <span className="ico">📖</span>
          Слова
        </button>
        <button className={`tab ${tab === 'shop' ? 'on' : ''}`} onClick={() => setTab('shop')}>
          <span className="ico">🎩</span>
          БУК
        </button>
        <button className={`tab ${tab === 'parent' ? 'on' : ''}`} onClick={() => setTab('parent')}>
          <span className="ico">👨‍👩‍👧</span>
          Родителям
        </button>
      </nav>
    </div>
  );
}

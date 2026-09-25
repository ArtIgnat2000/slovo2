import { useEffect, useState } from 'react';
import { useActiveProfile, useApp } from './state/store';
import { useMascot } from './state/mascot';
import { Mascot } from './ui/Mascot';
import { HomeScreen } from './ui/screens/HomeScreen';
import { WordsScreen } from './ui/screens/WordsScreen';
import { ParentScreen } from './ui/screens/ParentScreen';
import { ProfilesScreen } from './ui/screens/ProfilesScreen';
import { LessonScreen } from './ui/screens/LessonScreen';
import { setSoundEnabled } from './platform/sound';
import { setHapticsEnabled } from './platform/haptics';
import { applyUpdate, shouldSuggestInstall, markInstallHintShown } from './platform/pwa';

type Tab = 'home' | 'words' | 'parent';

export default function App() {
  const profile = useActiveProfile();
  const settings = useApp((s) => s.settings);
  const mood = useMascot((s) => s.mood);
  const message = useMascot((s) => s.message);

  const [tab, setTab] = useState<Tab>('home');
  const [lessonId, setLessonId] = useState<string | null>(null);
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

  if (lessonId) {
    return (
      <div className="app">
        <LessonScreen lessonId={lessonId} onExit={() => setLessonId(null)} />
      </div>
    );
  }

  return (
    <div className="app">
      {profilesOpen ? (
        <ProfilesScreen onClose={() => setProfilesOpen(false)} />
      ) : tab === 'home' ? (
        <HomeScreen
          onStartLesson={setLessonId}
          onOpenProfiles={() => setProfilesOpen(true)}
          onStartReview={() => setLessonId('review')}
        />
      ) : tab === 'words' ? (
        <WordsScreen />
      ) : (
        <ParentScreen
          unlocked={parentUnlocked}
          onUnlock={() => setParentUnlocked(true)}
          onOpenProfiles={() => setProfilesOpen(true)}
        />
      )}

      {!profilesOpen && <Mascot mood={mood} message={message} />}

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
        <button className={`tab ${tab === 'parent' ? 'on' : ''}`} onClick={() => setTab('parent')}>
          <span className="ico">👨‍👩‍👧</span>
          Родителям
        </button>
      </nav>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useActiveProfile, useApp } from './state/store';
import { useStorageHealth } from './state/health';
import { StorageBanner, StorageScreen } from './ui/StorageScreen';
import { onExternalChange } from './platform/vault';
import { FloatingMascot } from './ui/FloatingMascot';
import { HomeScreen } from './ui/screens/HomeScreen';
import { WordsScreen } from './ui/screens/WordsScreen';
import { ParentScreen } from './ui/screens/ParentScreen';
import { ProfilesScreen } from './ui/screens/ProfilesScreen';
import { LessonScreen } from './ui/screens/LessonScreen';
import { ShopScreen } from './ui/screens/ShopScreen';
import { VlabsScreen } from './ui/screens/VlabsScreen';
import { GameScreen } from './ui/screens/GameScreen';
import { DiagnosticsScreen } from './ui/DiagnosticsScreen';
import { setSoundEnabled } from './platform/sound';
import { setHapticsEnabled } from './platform/haptics';
import { applyUpdate, shouldSuggestInstall, markInstallHintShown } from './platform/pwa';

type Tab = 'home' | 'words' | 'shop' | 'parent';

function diagnosticsRequested(): boolean {
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('diag') === '1';
}

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
  // Подписка ровно на один признак: иначе App перерисовывался бы на каждой
  // записи прогресса (а запись идёт на каждый ответ ребёнка).
  const storageBroken = useStorageHealth((s) => s.kind === 'read-error');

  const [tab, setTab] = useState<Tab>('home');
  const [lessonId, setLessonId] = useState<string | null>(null);
  // Цель дня на момент старта урока. Экран результатов сравнивает урок с ней,
  // а не с текущей настройкой: «Родители» могут поменять цель прямо во время урока.
  const [lessonGoal, setLessonGoal] = useState(settings.dailyGoal);
  const [vlabsOpen, setVlabsOpen] = useState(false);
  /** «Бродилка БУКа» — главная игра: полноэкранный режим, как урок. */
  const [gameOpen, setGameOpen] = useState(false);
  /**
   * Подсказка «добавь на экран». Читаем флаг один раз при старте и держим в состоянии:
   * раньше `markInstallHintShown()` писал в localStorage, но React об этом не знал —
   * блок оставался на экране до случайной перерисовки, и кнопка «Понятно» выглядела сломанной.
   */
  const [installHint, setInstallHint] = useState(() => shouldSuggestInstall());
  const dismissInstallHint = () => {
    markInstallHintShown();
    setInstallHint(false);
  };
  const [profilesOpen, setProfilesOpen] = useState(false);
  const [parentUnlocked, setParentUnlocked] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(diagnosticsRequested);
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
    const onUpdate = () => setUpdateReady(true);
    window.addEventListener('slovo2:update', onUpdate);
    return () => window.removeEventListener('slovo2:update', onUpdate);
  }, []);

  useEffect(() => {
    const syncDiagnosticsRoute = () => setDiagnosticsOpen(diagnosticsRequested());
    window.addEventListener('popstate', syncDiagnosticsRoute);
    return () => window.removeEventListener('popstate', syncDiagnosticsRoute);
  }, []);

  /**
   * Несколько открытых копий приложения (ярлык на экране и вкладка браузера)
   * держат в памяти своё состояние и пишут запись целиком: проснувшаяся
   * вчерашняя копия затирала свежий прогресс. Договорились так: кто записал —
   * тот сообщил остальным, а вернувшаяся в фокус копия сначала перечитывает
   * сохранение. Во время урока не трогаем ничего: там своё состояние.
   */
  const inLesson = useRef(false);
  inLesson.current = lessonId !== null;
  useEffect(() => {
    const sync = () => {
      if (inLesson.current) return;
      void Promise.resolve(useApp.persist.rehydrate()).catch(() => undefined);
    };
    const offExternal = onExternalChange(sync);
    const onVisible = () => {
      if (document.visibilityState === 'visible') sync();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      offExternal();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const closeDiagnostics = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('diag');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    setDiagnosticsOpen(false);
  };

  if (diagnosticsOpen) {
    return (
      <div className="app">
        <DiagnosticsScreen onClose={closeDiagnostics} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="app">
        {storageBroken ? <StorageScreen /> : <ProfilesScreen manage={parentUnlocked} />}
      </div>
    );
  }

  const startLesson = (id: string) => {
    setParentUnlocked(false);
    setLessonGoal(settings.dailyGoal);
    setLessonId(id);
  };

  const switchTab = (next: Tab) => {
    setProfilesOpen(false);
    if (next !== 'parent') setParentUnlocked(false);
    setTab(next);
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

  if (gameOpen) {
    return (
      <div className="app">
        <GameScreen onExit={() => setGameOpen(false)} />
        <Toast />
      </div>
    );
  }

  if (vlabsOpen) {
    return (
      <div className="app">
        <VlabsScreen onBack={() => setVlabsOpen(false)} />
        <Toast />
      </div>
    );
  }

  return (
    <div className="app">
      <StorageBanner />
      {profilesOpen ? (
        <ProfilesScreen onClose={() => setProfilesOpen(false)} manage={parentUnlocked} />
      ) : tab === 'home' ? (
        <HomeScreen
          onStartLesson={startLesson}
          onOpenProfiles={() => setProfilesOpen(true)}
          onStartReview={() => startLesson('review')}
          onOpenGame={() => {
            setParentUnlocked(false);
            setGameOpen(true);
          }}
          onOpenVlabs={() => {
            setParentUnlocked(false);
            setVlabsOpen(true);
          }}
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
          onOpenVlabs={() => {
            setParentUnlocked(false);
            setVlabsOpen(true);
          }}
        />
      )}

      {!profilesOpen &&
        tab !== 'shop' &&
        settings.mascot !== 'off' &&
        (settings.mascot !== 'home' || tab === 'home') && (
          <FloatingMascot raised={updateReady || installHint} />
        )}
      <Toast />

      {updateReady && (
        <div className="footer-bar" style={{ bottom: 'calc(64px + var(--safe-b))' }}>
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

      {!updateReady && installHint && (
        <div className="footer-bar" style={{ bottom: 'calc(64px + var(--safe-b))' }}>
          <div className="footer-inner">
            <div className="grow">
              <div className="verdict">📲 Добавь приложение на экран</div>
              <small>Будет работать без интернета</small>
            </div>
            <button className="btn primary" onClick={dismissInstallHint}>
              Понятно
            </button>
          </div>
        </div>
      )}

      <nav className="tabs">
        <button className={`tab ${!profilesOpen && tab === 'home' ? 'on' : ''}`} onClick={() => switchTab('home')}>
          <span className="ico">🗺️</span>
          Уроки
        </button>
        <button className={`tab ${!profilesOpen && tab === 'words' ? 'on' : ''}`} onClick={() => switchTab('words')}>
          <span className="ico">📖</span>
          Слова
        </button>
        <button className={`tab ${!profilesOpen && tab === 'shop' ? 'on' : ''}`} onClick={() => switchTab('shop')}>
          <span className="ico">🎩</span>
          БУК
        </button>
        <button className={`tab ${!profilesOpen && tab === 'parent' ? 'on' : ''}`} onClick={() => switchTab('parent')}>
          <span className="ico">👨‍👩‍👧</span>
          Родителям
        </button>
      </nav>
    </div>
  );
}

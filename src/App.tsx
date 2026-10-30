import { useEffect, useRef, useState } from 'react';
import { useActiveProfile, useApp } from './state/store';
import { useStorageHealth } from './state/health';
import { StorageBanner, StorageScreen } from './ui/StorageScreen';
import { ThemeBanner } from './ui/ThemeBanner';
import { onExternalChange } from './platform/vault';
import { FloatingMascot } from './ui/FloatingMascot';
import type { HubDoor } from './ui/BukHub';
import { BukChat } from './ui/BukChat';
import { nextStartAction } from './engine/next-start';
import { useHomeIntent } from './state/home-intent';
import { HomeScreen } from './ui/screens/HomeScreen';
import { WordsScreen } from './ui/screens/WordsScreen';
import { ParentScreen } from './ui/screens/ParentScreen';
import { ProfilesScreen } from './ui/screens/ProfilesScreen';
import { LessonScreen } from './ui/screens/LessonScreen';
import { ShopScreen } from './ui/screens/ShopScreen';
import type { Cat as ShopCat } from './ui/screens/ShopScreen';
import { RatingScreen } from './ui/screens/RatingScreen';
import { VlabsScreen } from './ui/screens/VlabsScreen';
import { DiagnosticsScreen } from './ui/DiagnosticsScreen';
import type { ParentTabId } from './ui/parent/ParentBits';
import { setSoundEnabled, setSoundPack } from './platform/sound';
import { MUSIC_BY_ID, MUSIC_TRACKS, STARTER_TRACK_IDS } from './engine/music';
import { playMusic, setMusicEnabled, setMusicVolume, warmTracks } from './platform/music';
import { setHapticsEnabled } from './platform/haptics';
import {
  applyUpdate,
  markInstallHintShown,
  shouldSuggestInstall,
  startUpdateWatch,
  takeAppliedVersion,
} from './platform/pwa';
import { QUIET_MS, QuickSound } from './ui/QuickSound';
import { applyTheme, applyThemeStyle, writeThemeMirror, writeThemeStyleMirror } from './platform/theme';

type Tab = 'home' | 'words' | 'shop' | 'rating' | 'parent';

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
  const setSettings = useApp((s) => s.setSettings);
  // Подписка ровно на один признак: иначе App перерисовывался бы на каждой
  // записи прогресса (а запись идёт на каждый ответ ребёнка).
  const storageBroken = useStorageHealth((s) => s.kind === 'read-error');

  const [tab, setTab] = useState<Tab>('home');
  const [lessonId, setLessonId] = useState<string | null>(null);
  /**
   * Номер запуска урока (0.62.0). Нужен для «Пройти заново»: если открыть тот же
   * id, React не пересоздаёт экран (key тот же), и ребёнок остаётся на
   * результатах. Номер входит в key — экран начинается заново.
   */
  const [lessonRun, setLessonRun] = useState(0);
  // Цель дня на момент старта урока. Экран результатов сравнивает урок с ней,
  // а не с текущей настройкой: «Родители» могут поменять цель прямо во время урока.
  const [lessonGoal, setLessonGoal] = useState(settings.dailyGoal);
  const [vlabsOpen, setVlabsOpen] = useState(false);
  /** Чат «Спроси БУКа» (0.87.0): полноэкранный оверлей, открывается дверью из хаба. */
  const [chatOpen, setChatOpen] = useState(false);
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
  // Из установленного ярлыка нет адресной строки. После проверки темы
  // возвращаем взрослого в тот же раздел, откуда он открыл диагностику.
  const [parentReturnTab, setParentReturnTab] = useState<ParentTabId>('overview');
  const [updateReady, setUpdateReady] = useState(false);
  /**
   * «Тишина на время»: до какого момента музыка молчит. Это НЕ настройка
   * профиля — после перезапуска приложение снова звучит как обычно, поэтому
   * ребёнок не останется в тишине навсегда из-за случайного долгого нажатия.
   */
  const [quietUntil, setQuietUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  /** Версия, до которой обновились автоматически: показываем плашку один раз. */
  const [justUpdated] = useState(() => takeAppliedVersion());

  // Куда откроется БУК из меню главной; состояние выше ранних return'ов,
  // чтобы число хуков не менялось между рендерами. `cat` — сразу на нужную
  // полку витрины (дверь «🎵 Музыка» навигатора, 0.85.0).
  const [shopEntry, setShopEntry] = useState<{ view: 'vitrina' | 'wardrobe' | 'world'; cat?: ShopCat }>({
    view: 'vitrina',
  });

  useEffect(() => {
    const apply = () => {
      applyTheme(settings.theme);
    };
    apply();
    // Зеркало выбора темы для следующего запуска: статичный meta уже
    // объявляет only light, инлайн-скрипт уточняет выбор до первого кадра.
    writeThemeMirror(settings.theme);
    if (settings.theme === 'auto') {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => apply();
      // Современный API + фолбэк для старых WebView
      if (typeof media.addEventListener === 'function') media.addEventListener('change', handler);
      else media.addListener(handler);
      return () => {
        if (typeof media.removeEventListener === 'function') media.removeEventListener('change', handler);
        else media.removeListener(handler);
      };
    }
  }, [settings.theme]);

  useEffect(() => {
    // Стиль интерфейса независим от светлой/тёмной схемы и тоже зеркалится,
    // чтобы неоновое оформление было готово до первого кадра после запуска.
    applyThemeStyle(settings.themeStyle);
    writeThemeStyleMirror(settings.themeStyle);
  }, [settings.themeStyle]);

  // Отсчёт «тишины на 15 минут»: один таймер на секунду, только пока она идёт.
  useEffect(() => {
    if (quietUntil === null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [quietUntil]);

  useEffect(() => {
    if (quietUntil !== null && quietUntil <= now) setQuietUntil(null);
  }, [quietUntil, now]);

  const quiet = quietUntil !== null && quietUntil > now;
  /** Итоговое состояние музыки: настройка профиля, приглушённая временной тишиной. */
  const musicOn = settings.music && !quiet;

  useEffect(() => {
    // SFX и музыка — независимые контуры: эффекты остаются даже без фона,
    // а музыку можно выключить, не потеряв отклик правильных ответов.
    setSoundEnabled(settings.sound);
    setMusicEnabled(musicOn);
    setMusicVolume(settings.musicVolume);
    setHapticsEnabled(settings.haptics);
  }, [settings.sound, musicOn, settings.musicVolume, settings.haptics]);

  // Музыка принадлежит профилю ребёнка: при смене профиля фон переключается вместе с ним.
  useEffect(() => {
    const trackId = profile?.shop?.musicTrack ?? null;
    playMusic(musicOn && trackId ? MUSIC_BY_ID[trackId] ?? null : null);
  }, [profile?.shop?.musicTrack, musicOn]);

  // «Звуки» тоже принадлежат профилю: мелодии ответа переключаются вместе с ребёнком.
  useEffect(() => {
    setSoundPack(profile?.shop?.soundPack);
  }, [profile?.shop?.soundPack]);

  // Офлайн-надёжность: стартовые и купленные треки прогреваются в кэше
  // сервис-воркера в фоне, чтобы после установки PWA музыка играла без сети.
  useEffect(() => {
    const owned = new Set([...STARTER_TRACK_IDS, ...(profile?.shop?.musicOwned ?? [])]);
    warmTracks(MUSIC_TRACKS.filter((t) => owned.has(t.id)));
  }, [profile?.shop?.musicOwned]);

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
   * сохранение. Во время урока не трогаем ничего: там своё состояние — но
   * запрос на синхронизацию ЗАПОМИНАЕМ и выполняем сразу после урока, чтобы
   * устаревшая копия не стирала чужие свежие покупки своей записью
   * (0.21.2, жалоба «пропадает купленная музыка»).
   */
  const inLesson = useRef(false);
  inLesson.current = lessonId !== null;
  const syncPending = useRef(false);
  useEffect(() => {
    const sync = () => {
      if (inLesson.current) {
        syncPending.current = true;
        return;
      }
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

  /**
   * Автообновление (0.29.0). Ярлык на телефоне может не закрываться неделями,
   * поэтому браузер переспрашиваем сами, а обновление применяем в безопасный
   * момент: не в уроке, не с открытым листом и не на экране «Родителям»
   * (там могли вводить данные). Иначе ждём следующего окна.
   */
  const canApplyUpdate = useRef<() => boolean>(() => false);
  canApplyUpdate.current = () =>
    !inLesson.current &&
    !profilesOpen &&
    !vlabsOpen &&
    // В «Родителям» могли вводить имя, PIN или выгружать прогресс — не дёргаем.
    tab !== 'parent' &&
    document.visibilityState === 'visible';

  useEffect(() => {
    // onPending: обновление уже скачано и ждёт — покажем плашку-резерв.
    return startUpdateWatch(() => canApplyUpdate.current(), () => setUpdateReady(true));
  }, []);

  // После автообновления — одна короткая плашка, чтобы не было «магии».
  const showToast = useApp((s) => s.showToast);
  useEffect(() => {
    if (!justUpdated) return;
    showToast({ emoji: '✨', title: `Обновлено до v${justUpdated}` });
  }, [justUpdated, showToast]);

  // Урок закончился — выполняем отложенную во время урока синхронизацию.
  // Чтение стоит в одной очереди с записями сторожа (platform/vault.ts),
  // поэтому собственные итоги урока оно не теряет.
  useEffect(() => {
    if (lessonId !== null || !syncPending.current) return;
    syncPending.current = false;
    void Promise.resolve(useApp.persist.rehydrate()).catch(() => undefined);
  }, [lessonId]);

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
    setLessonRun((n) => n + 1);
    setLessonId(id);
  };

  const switchTab = (next: Tab) => {
    setProfilesOpen(false);
    if (next !== 'parent') {
      setParentUnlocked(false);
      setParentReturnTab('overview');
    }
    setTab(next);
  };

  /** Быстрый вход в нужную часть БУКа из меню главной и из навигатора БУКа. */
  const openShop = (view: 'vitrina' | 'wardrobe' | 'world', cat?: ShopCat) => {
    setShopEntry(cat ? { view, cat } : { view });
    setProfilesOpen(false);
    setTab('shop');
  };

  /**
   * Навигатор БУКа (0.85.0; 0.87.0 — шестая дверь «Спроси БУКа»): двери
   * в один тап от совы, те же разделы, что в меню ☰ главной, плюс чат.
   * Порядок как в меню: сначала учёба, потом мир, задания и наряды,
   * музыка, чат последним.
   */
  const hubDoors: HubDoor[] = [
    {
      id: 'lesson',
      emoji: '📖',
      label: 'Урок',
      run: () => {
        // «Пора повторить» важнее нового урока — то же правило, что у героя
        // главной (engine/next-start, его же использует HomeScreen).
        const next = nextStartAction(profile);
        if (next.reviewDue) startLesson('review');
        else if (next.lessonId) startLesson(next.lessonId);
      },
    },
    { id: 'world', emoji: '🌍', label: 'Мой мир', run: () => openShop('world') },
    {
      id: 'quests',
      emoji: '🎁',
      label: 'Задания',
      run: () => {
        // Лист заданий живёт на главной: переключаемся и даём HomeScreen
        // разовую команду открыться (state/home-intent).
        setProfilesOpen(false);
        setTab('home');
        useHomeIntent.getState().fire('rewards');
      },
    },
    { id: 'wardrobe', emoji: '🎩', label: 'Наряды', run: () => openShop('wardrobe') },
    { id: 'music', emoji: '🎵', label: 'Музыка', run: () => openShop('vitrina', 'music') },
    {
      id: 'chat',
      emoji: '💬',
      label: 'Спроси БУКа',
      run: () => {
        // Чат — оверлей над главной: сначала домой (как у «Заданий»), чтобы
        // после урока из чата вернуться на чистую страницу.
        setProfilesOpen(false);
        setTab('home');
        setChatOpen(true);
      },
    },
  ];

  if (lessonId) {
    return (
      <div className="app">
        {/* key — чтобы состояние урока не переезжало в другой урок */}
        <LessonScreen
          key={`${lessonId}#${lessonRun}`}
          lessonId={lessonId}
          goal={lessonGoal}
          onExit={() => setLessonId(null)}
          onStartList={(listId, mode) =>
            startLesson(
              mode === 'check'
                ? `check:${listId}`
                : mode === 'errors'
                  ? `err:${listId}`
                  : `list:${listId}`,
            )
          }
        />
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
      <ThemeBanner />
      {profilesOpen ? (
        <ProfilesScreen onClose={() => setProfilesOpen(false)} manage={parentUnlocked} />
      ) : tab === 'home' ? (
        <HomeScreen
          onStartLesson={startLesson}
          onOpenProfiles={() => setProfilesOpen(true)}
          onOpenSupport={() => {
            setParentUnlocked(false);
            setParentReturnTab('overview');
            switchTab('parent');
          }}
          onStartReview={() => startLesson('review')}
          onOpenShop={openShop}
          onStartList={(listId, mode = 'train') =>
            startLesson(mode === 'check' ? `check:${listId}` : mode === 'errors' ? `err:${listId}` : `list:${listId}`)
          }
        />
      ) : tab === 'words' ? (
        <WordsScreen />
      ) : tab === 'rating' ? (
        <RatingScreen />
      ) : tab === 'shop' ? (
        <ShopScreen
          // Ключ пересоздаёт экран, когда меняется точка входа: иначе тап по
          // нижней вкладке «БУК» из «Моих покупок» не вернул бы витрину —
          // useState(initialView) читается только при монтировании.
          key={`${shopEntry.view}${shopEntry.cat ?? ''}`}
          initialView={shopEntry.view}
          initialCat={shopEntry.cat}
        />
      ) : (
        <ParentScreen
          onStartList={(listId, mode = 'train') => {
            setParentUnlocked(false);
            startLesson(mode === 'check' ? `check:${listId}` : mode === 'errors' ? `err:${listId}` : `list:${listId}`);
          }}
          unlocked={parentUnlocked}
          onUnlock={() => setParentUnlocked(true)}
          initialTab={parentReturnTab}
          onOpenDiagnostics={(section) => {
            setParentReturnTab(section);
            setDiagnosticsOpen(true);
          }}
          onOpenProfiles={() => setProfilesOpen(true)}
          onOpenVlabs={() => {
            setParentUnlocked(false);
            setVlabsOpen(true);
          }}
        />
      )}

      {!profilesOpen &&
        !chatOpen &&
        tab !== 'shop' &&
        settings.mascot !== 'off' &&
        (settings.mascot !== 'home' || tab === 'home') && (
          <FloatingMascot raised={updateReady || installHint} hub={hubDoors} />
        )}
      {/* Чат «Спроси БУКа» (0.87.0): действие «Потренироваться»/«Полетели»
          закрывает оверлей и ведёт в урок — тот же старт, что из навигатора. */}
      {chatOpen && (
        <BukChat
          onClose={() => setChatOpen(false)}
          onAction={(a) => {
            setChatOpen(false);
            if (a.mode === 'review') startLesson('review');
            else if (a.lessonId) startLesson(a.lessonId);
          }}
        />
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

      {/* Быстрый звук: тап — вкл/выкл музыки, долгое нажатие — тишина на 15 минут.
          В уроке кнопки нет: там своя тихая громкость и лишние цели мешают. */}
      <QuickSound
        music={settings.music}
        quietUntil={quietUntil}
        now={now}
        onToggle={() => {
          const next = !settings.music;
          setSettings({ music: next });
          setQuietUntil(null);
          showToast(
            next
              ? { emoji: '🔊', title: 'Музыка включена' }
              : { emoji: '🔇', title: 'Музыка выключена' },
          );
        }}
        onQuiet={() => {
          setQuietUntil(Date.now() + QUIET_MS);
          showToast({ emoji: '🌙', title: 'Тишина на 15 минут' });
        }}
        onCancelQuiet={() => {
          setQuietUntil(null);
          setNow(Date.now());
          showToast({ emoji: '🔊', title: 'Музыка включена' });
        }}
      />

      <nav className="tabs">
        <button className={`tab ${!profilesOpen && tab === 'home' ? 'on' : ''}`} onClick={() => switchTab('home')}>
          <span className="ico">🗺️</span>
          Уроки
        </button>
        <button className={`tab ${!profilesOpen && tab === 'words' ? 'on' : ''}`} onClick={() => switchTab('words')}>
          <span className="ico">📖</span>
          Слова
        </button>
        <button
          className={`tab ${!profilesOpen && tab === 'shop' ? 'on' : ''}`}
          onClick={() => {
            // Вкладка всегда открывает витрину, а не то, куда завёл меню.
            setShopEntry({ view: 'vitrina' });
            switchTab('shop');
          }}
        >
          <span className="ico">🎩</span>
          БУК
        </button>
        <button className={`tab ${!profilesOpen && tab === 'rating' ? 'on' : ''}`} onClick={() => switchTab('rating')}>
          <span className="ico">🏆</span>
          Рейтинг
        </button>
        <button className={`tab ${!profilesOpen && tab === 'parent' ? 'on' : ''}`} onClick={() => switchTab('parent')}>
          <span className="ico">👨‍👩‍👧</span>
          Родителям
        </button>
      </nav>
    </div>
  );
}

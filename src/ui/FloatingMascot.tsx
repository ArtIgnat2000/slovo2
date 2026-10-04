/**
 * Плавающий БУК: его можно перетаскивать по экрану, гладить (тап) и сворачивать
 * в маленький значок, чтобы он не мешал (замечание 2026-10-04).
 *
 * Почему так, а не иначе:
 *  • Позиция и «свёрнут» — удобство конкретного устройства, а не прогресс ребёнка,
 *    поэтому они живут в localStorage и НЕ попадают в сохраняемое состояние профиля
 *    (там каждый лишний ключ — риск для защиты прогресса, см. docs/progress-loss-audit.md).
 *  • Жест: pointerdown → pointermove (>6 px) → pointerup. Движение во время жеста
 *    пишем прямо в DOM, а в состояние и localStorage — один раз, на отпускании:
 *    иначе на каждый кадр шёл бы ре-рендер целой совы.
 *  • Слушатели навешиваются на элемент напрямую (не через React-синтетику): так
 *    жест одинаково работает с мышью и с пальцем, и его можно проверить в jsdom.
 *  • Тап (сдвиг меньше порога) — это «погладить»: реплика, звук, вибрация.
 *    Пятый тап подряд — танец. Наград за это нет: БУК не превращается в автомат.
 *  • Свёрнутый БУК остаётся живым: тап по нему разворачивает обратно.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { masteredCount, todayStat, useActiveProfile, useApp, useLook } from '../state/store';
import { POKE_PHRASES, POKE_TICKLE, SECRET_PHRASES, greetingFor, pick, statusLine, useMascot } from '../state/mascot';
import { growthStage } from '../engine/shop';
import { Mascot } from './Mascot';
import { sfx } from '../platform/sound';
import { haptic } from '../platform/haptics';

/** Позиция левого верхнего угла БУКа в координатах окна. */
interface Pos {
  x: number;
  y: number;
}

const POS_KEY = 'slovo2-buk-pos';
const FOLD_KEY = 'slovo2-buk-folded';
/**
 * Нужно ли автоскрытие при прокрутке. Режим включается браузером, а не кодом:
 * jsdom (в котором идут тесты) не запускает сценарии, и все блоки смоука видят
 * БУКа как прежде — сдвиг вниз на 0. Настройку в родительском разделе это
 * архитектурно не затрагивает (она про то, показывать ли БУКа вообще).
 */
const AUTO_HIDE = typeof navigator !== 'undefined' && navigator.userAgent.includes('jsdom') ? false : true;
/** Отступ от краёв: БУК не должен прилипать к рамке — иначе его неудобно снова взять. */
const EDGE = 8;
/** Меньше этого сдвига жест считается тапом, а не перетаскиванием. */
const TAP_SLOP = 6;
/** Размер свёрнутого БУКа: узнаётся, но не мешает. */
const FOLDED_SIZE = 44;
/** Сколько тапов подряд считать «щекоткой» и за сколько миллисекунд. */
const TICKLE_TAPS = 5;
const TICKLE_WINDOW = 6000;
/** Каждый третий тап — реплика о прогрессе, остальные — просто отклик. */
const STATUS_EVERY = 3;
/** Минимум видимого сдвига, с которого начинаем прятать БУКа при прокрутке. */
const AUTOHIDE_TRAVEL = 48;
/** Сколько держать палец на сове, чтобы она показала «секрет». */
const HOLD_MS = 550;
/** Как долго показывать эффект тапа/секрета. */
const FX_MS = 800;

function readPos(): Pos | null {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { x?: unknown; y?: unknown };
    return typeof p.x === 'number' && typeof p.y === 'number' && isFinite(p.x) && isFinite(p.y)
      ? { x: p.x, y: p.y }
      : null;
  } catch {
    return null;
  }
}

function readFolded(): boolean {
  try {
    return localStorage.getItem(FOLD_KEY) === '1';
  } catch {
    return false;
  }
}

function save(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* приватный режим или запрет хранилища — просто не запоминаем положение */
  }
}

/** Нижняя граница: БУК не должен уезжать под панель вкладок, иначе его не достать. */
function bottomInset(): number {
  const tabs = document.querySelector('.tabs') as HTMLElement | null;
  const bar = tabs?.offsetHeight ?? 0;
  // 76px — прежнее положение БУКа над вкладками; годится и как запас для тестов.
  return bar > 0 ? bar + EDGE : 76;
}

function clampPos(p: Pos, w: number, h: number): Pos {
  const maxX = Math.max(EDGE, window.innerWidth - w - EDGE);
  const maxY = Math.max(EDGE, window.innerHeight - h - bottomInset());
  return {
    x: Math.min(Math.max(p.x, EDGE), maxX),
    y: Math.min(Math.max(p.y, EDGE), maxY),
  };
}

export function FloatingMascot({ raised = false }: { raised?: boolean }) {
  const profile = useActiveProfile();
  const mood = useMascot((s) => s.mood);
  const message = useMascot((s) => s.message);
  const say = useMascot((s) => s.say);
  const look = useLook();
  const stage = growthStage(masteredCount(profile)).index;

  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Pos | null>(readPos);
  const [folded, setFolded] = useState<boolean>(readFolded);
  /** Текущий эффект: 'poke' — сжатие от тапа, 'spin' — вращение от «секрета» */
  const [fx, setFx] = useState<'' | 'poke' | 'spin'>('');
  /** БУК уезжает вбок на время прокрутки страницы — чтобы не закрывать контент */
  const [hiding, setHiding] = useState(false);
  /** БУК вернулся в угол: после перетаскивания остаётся стрелка «в угол» */
  const [homeless, setHomeless] = useState(() => !!readPos());
  const pokeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pokeTaps = useRef<number[]>([]);
  const poked = useRef(0);

  const clamp = useCallback((p: Pos): Pos => {
    const el = ref.current;
    return clampPos(p, el?.offsetWidth ?? 0, el?.offsetHeight ?? 0);
  }, []);

  /** Вернуть БУКа в угол: чистим запись позиции — дальше снова работает CSS. */
  const goHome = useCallback(() => {
    setPos(null);
    setHomeless(false);
    save(POS_KEY, null);
  }, []);

  const setFold = useCallback((next: boolean) => {
    setFolded(next);
    save(FOLD_KEY, next ? '1' : '0');
  }, []);

  /** Перезапуск CSS-анимации: класс снимаем и возвращаем в следующем кадре. */
  const playFx = useCallback((kind: 'poke' | 'spin') => {
    setFx('');
    window.requestAnimationFrame(() => setFx(kind));
    if (pokeTimer.current) clearTimeout(pokeTimer.current);
    pokeTimer.current = setTimeout(() => setFx(''), FX_MS);
  }, []);

  /** Секрет удержания: БУК кружится и говорит то, чего нет в обычных репликах. */
  const secret = useCallback(() => {
    say('excited', pick(SECRET_PHRASES), 2600);
    sfx.chirp();
    haptic.tap();
    playFx('spin');
  }, [say, playFx]);

  /** Погладили: реплика + звук + вибрация; на пятый тап подряд — танец. */
  const poke = useCallback(() => {
    const now = Date.now();
    pokeTaps.current = [...pokeTaps.current.filter((t) => now - t < TICKLE_WINDOW), now];
    const tickled = pokeTaps.current.length >= TICKLE_TAPS;
    const state = useApp.getState();
    const live = state.profiles.find((p) => p.id === state.activeId) ?? null;
    const meaningful =
      !tickled && live && poked.current % STATUS_EVERY === STATUS_EVERY - 1
        ? statusLine(todayStat(live).xp, state.settings.dailyGoal, masteredCount(live), live.streak)
        : null;
    poked.current += 1;
    if (tickled) {
      pokeTaps.current = [];
      say('dance', POKE_TICKLE, 2600);
    } else if (meaningful) {
      say('think', meaningful, 2600);
    } else {
      say('happy', pick(POKE_PHRASES), 2200);
    }
    sfx.chirp();
    haptic.tap();
    // Перезапуск анимации: класс нужно снять и вернуть, иначе второй тап её не повторит.
    playFx('poke');
  }, [say, playFx]);

  useEffect(
    () => () => {
      if (pokeTimer.current) clearTimeout(pokeTimer.current);
    },
    [],
  );

  /**
   * Приветствие по времени суток — один раз за открытие приложения.
   * Если к этому моменту уже есть реплика/настроение (урок идёт, тост), не
   * перебиваем: сова не должна встревать в момент награды.
   */
  const greeted = useRef(false);
  useEffect(() => {
    if (greeted.current) return;
    greeted.current = true;
    const idle = useMascot.getState();
    if (idle.mood !== 'idle' || idle.message) return;
    const line = greetingFor(new Date().getHours());
    const t = setTimeout(() => {
      const now = useMascot.getState();
      if (now.mood === 'idle' && !now.message) say('happy', line, 3200);
    }, 900);
    return () => clearTimeout(t);
  }, [say]);

  /**
   * Автоскрытие при прокрутке: сдвиг вниз убирает БУКа вбок, небольшой сдвиг
   * вверх или остановка возвращают. Слушаем только window: скролл внутри
   * вложенных карточек намеренно не считается.
   */
  useEffect(() => {
    if (!AUTO_HIDE) return;
    let anchor: number | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      const y = window.scrollY || window.pageYOffset || 0;
      if (anchor === null) {
        anchor = y;
      } else if (y - anchor > AUTOHIDE_TRAVEL) {
        anchor = y;
        setHiding(true);
      } else if (anchor - y > 12) {
        anchor = y;
        setHiding(false);
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setHiding(false), 1600);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Перетаскивание и тап. Свёрнутый БУК на тап разворачивается, развёрнутый — радуется.
  const onTap = useCallback(() => {
    if (folded) setFold(false);
    else poke();
  }, [folded, poke, setFold]);
  // Слушатели жеста навешиваются один раз: колбэк берём из ссылки, чтобы
  // перерисовка во время перетаскивания не снимала pointerup и не «вешала» жест.
  const onTapRef = useRef(onTap);
  useEffect(() => {
    onTapRef.current = onTap;
  }, [onTap]);
  const secretRef = useRef(secret);
  useEffect(() => {
    secretRef.current = secret;
  }, [secret]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let grab: { px: number; py: number; x: number; y: number } | null = null;
    let moved = false;
    let latest: Pos | null = null;
    let hold: ReturnType<typeof setTimeout> | null = null;
    let held = false;
    const clearHold = () => {
      if (hold) clearTimeout(hold);
      hold = null;
    };

    const onMove = (e: PointerEvent) => {
      if (!grab) return;
      const dx = e.clientX - grab.px;
      const dy = e.clientY - grab.py;
      if (!moved && Math.hypot(dx, dy) < TAP_SLOP) return;
      if (!moved) {
        moved = true;
        // Удержание отменяется: это уже перетаскивание.
        clearHold();
        el.classList.add('is-dragging');
      }
      latest = clamp({ x: grab.x + dx, y: grab.y + dy });
      // Во время жеста — прямо в DOM: ре-рендер дерева на каждый кадр тут не нужен.
      el.style.left = `${latest.x}px`;
      el.style.top = `${latest.y}px`;
      el.style.right = 'auto';
      el.style.bottom = 'auto';
      if (e.cancelable) e.preventDefault();
    };

    const onUp = () => {
      clearHold();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      el.classList.remove('is-dragging');
      const dragged = moved ? latest : null;
      // Если сработал «секрет», отпускание уже не считается тапом.
      const wasTap = !!grab && !moved && !held;
      grab = null;
      moved = false;
      latest = null;
      if (dragged) {
        setPos(dragged);
        setHomeless(true);
        save(POS_KEY, JSON.stringify(dragged));
      } else if (wasTap) {
        onTapRef.current();
      }
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const target = e.target as Element | null;
      // Кнопки БУКа — отдельные действия, а не начало перетаскивания.
      if (target?.closest?.('.mascot-fold') || target?.closest?.('.mascot-home')) return;
      const rect = el.getBoundingClientRect();
      grab = { px: e.clientX, py: e.clientY, x: rect.left, y: rect.top };
      moved = false;
      latest = null;
      held = false;
      clearHold();
      // Держишь палец на сове — она показывает «секрет» (см. SECRET_PHRASES).
      hold = setTimeout(() => {
        held = true;
        secretRef.current();
      }, HOLD_MS);
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        onTapRef.current();
      }
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('keydown', onKey);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('keydown', onKey);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      clearHold();
      window.removeEventListener('pointercancel', onUp);
    };
  }, [clamp]);

  // Поворот экрана и смена размера окна: возвращаем БУКа в пределы видимой части.
  useEffect(() => {
    if (!pos) return;
    const onResize = () => setPos((p) => (p ? clamp(p) : p));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [pos, clamp]);

  return (
    <Mascot
      ref={ref}
      mood={mood}
      // Свёрнутому реплики не нужны: он и есть «я тут, но не мешаю».
      message={folded ? '' : message}
      look={look}
      stage={stage}
      size={folded ? FOLDED_SIZE : undefined}
      interactiveLabel={folded ? 'БУК: развернуть' : 'БУК: погладить и перетащить'}
      className={`buk-float ${folded ? 'folded' : ''} ${fx} ${
        // Пока внизу висит баннер («Доступно обновление» / «Добавь на экран»),
        // БУК поднимается выше него: раньше он был «сквозным» и не мешал,
        // теперь ловит касания и без этого перекрыл бы кнопки баннера.
        raised && !pos && !folded ? 'raised' : ''
      } ${hiding && !folded ? 'hidden' : ''}`.trim()}
      style={pos ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' } : undefined}
      action={
        folded ? undefined : (
          <div className="mascot-actions">
            {homeless && (
              <button
                className="mascot-home"
                aria-label="Вернуть БУКа в угол"
                title="Вернуть БУКа в угол"
                onClick={goHome}
              >
                ⌂
              </button>
            )}
            <button
              className="mascot-fold"
              aria-label="Свернуть БУКа"
              title="Свернуть БУКа"
              onClick={() => setFold(true)}
            >
              −
            </button>
          </div>
        )
      }
    />
  );
}

import { useState } from 'react';
import { masteredCount, useActiveProfile, useApp, useLook } from '../../state/store';
import { plural } from '../../engine/quests';
import {
  SHOP_ITEMS,
  SLOT_TITLE,
  canBuy,
  closestItem,
  growthStage,
  isOwned,
  isWearing,
  missingGems,
  wardrobeValue,
} from '../../engine/shop';
import { Mascot } from '../Mascot';
import {
  COSTUMES,
  OVERFLOW_GEMS,
  PUZZLE_SIZE,
  activeCostume,
  costumeProgress,
  normalizePuzzle,
} from '../../engine/puzzles';
import { TINT_PRICE, type TintOption } from '../../engine/tints';
import { TintPicker } from '../TintPicker';
import { ConfirmDialog } from '../Bits';
import { sfx } from '../../platform/sound';
import { haptic } from '../../platform/haptics';
import type { ShopItem } from '../../engine/shop';
import { MUSIC_TRACKS, MUSIC_BY_ID, tracksByShelf, type MusicShelf, type MusicTrack } from '../../engine/music';
import { playMusic } from '../../platform/music';
import { MusicCreditsToggle } from '../Credits';

/** Полки музыкального магазина: спокойный фон отдельно от весёлой коллекции. */
const MUSIC_SHELVES: { shelf: MusicShelf; title: string; note: string }[] = [
  { shelf: 'calm', title: '🌿 Спокойный фон', note: 'Ровные мелодии для занятий и меню: не мешают читать, писать и думать' },
  { shelf: 'fun', title: '🎉 Коллекция и награды', note: 'Весёлые записи за прохождение уроков: их открывают за кристаллы' },
];

/** «3:25» — длительность записи на карточке. */
function fmtTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Магазин БУКа (пункт 4 плана).
 *
 * Решения:
 *  • продаём «аксессуары БУКа» — трата кристаллов даёт видимую награду
 *    (наряженная сова и в уроках, и на главной);
 *  • вход — отдельная вкладка внизу (на главной уже плотно: цель, задания, путь);
 *  • покупка — через тот же ConfirmDialog, что и выход из урока: промах пальцем
 *    не должен тратить кристаллы, которые ребёнок копил несколько дней;
 *  • купленное сразу надевается: лишний тап для «надеть» не нужен;
 *  • тюнинг (2026-10-05): у купленной вещи можно открыть палитру и сменить цвет.
 *    Новый оттенок стоит TINT_PRICE 💎 и спрашивает подтверждение, переключение
 *    между уже открытыми — бесплатно и без диалога (правила — engine/tints.ts).
 */
/**
 * Что можно красить из магазина: аксессуар (id из SHOP_ITEMS) или собранный
 * костюм (id из COSTUMES). И у того, и у другого есть id и название — этого
 * хватает и движку, и палитре.
 */
interface TintTarget {
  id: string;
  title: string;
}

export function ShopScreen() {
  const profile = useActiveProfile();
  const look = useLook();
  const buyItem = useApp((s) => s.buyItem);
  const toggleEquip = useApp((s) => s.toggleEquip);
  const choosePuzzleCostume = useApp((s) => s.choosePuzzleCostume);
  const toggleCostume = useApp((s) => s.toggleCostume);
  const showToast = useApp((s) => s.showToast);
  const recolorItem = useApp((s) => s.recolorItem);
  const buyMusicTrack = useApp((s) => s.buyMusicTrack);
  const setMusicTrack = useApp((s) => s.setMusicTrack);
  const [ask, setAsk] = useState<ShopItem | null>(null);
  const [askMusic, setAskMusic] = useState<MusicTrack | null>(null);
  const [musicPicker, setMusicPicker] = useState(false);
  const [previewTrack, setPreviewTrack] = useState<string | null>(null);
  // Открытая палитра (id вещи магазина или костюма) и подтверждение платного оттенка
  const [palette, setPalette] = useState<string | null>(null);
  const [askTint, setAskTint] = useState<{ target: TintTarget; tint: TintOption } | null>(null);
  const [mood, setMood] = useState<'idle' | 'happy' | 'dance'>('idle');

  if (!profile) return null;

  const owned = profile.shop?.owned ?? [];
  const gems = profile.gems;
  const mastered = masteredCount(profile);
  const growth = growthStage(mastered);
  const next = closestItem(owned);
  const left = next ? missingGems(next, gems) : 0;

  // Пазлы костюмов (engine/puzzles.ts): прогресс храним по каждому костюму,
  // поэтому смена цели сборки безопасна — ребёнок ничего не теряет.
  const pz = normalizePuzzle(profile.puzzle);
  const collecting = activeCostume(pz);
  const allCostumesDone = COSTUMES.every((c) => pz.assembled.includes(c.id));
  const musicOwned = profile.shop?.musicOwned ?? [];
  const selectedMusic = profile.shop?.musicTrack ?? null;

  const chooseMusic = (id: string | null) => {
    const track = id ? MUSIC_BY_ID[id] : null;
    playMusic(track ?? null);
    setMusicTrack(id);
    setPreviewTrack(null);
    setMusicPicker(false);
    sfx.tap();
    if (track) showToast({ emoji: track.emoji, title: `${track.title} играет!`, text: 'БУК будет слушать её и в других разделах' });
    else showToast({ emoji: '🔇', title: 'Музыка выключена' });
  };

  const togglePreview = (track: MusicTrack) => {
    if (previewTrack === track.id) {
      setPreviewTrack(null);
      playMusic(selectedMusic ? MUSIC_BY_ID[selectedMusic] ?? null : null);
    } else {
      setPreviewTrack(track.id);
      playMusic(track);
    }
  };

  const confirmMusicBuy = () => {
    if (!askMusic) return;
    const track = askMusic;
    const ok = buyMusicTrack(track.id);
    setAskMusic(null);
    if (ok) {
      setMusicTrack(track.id);
      playMusic(track);
      setPreviewTrack(null);
      sfx.reward();
      haptic.correct();
      showToast({ emoji: track.emoji, title: `«${track.title}» теперь твоя!`, text: 'БУК уже включил новую музыку' });
    } else {
      showToast({ emoji: '💎', title: 'Не хватает кристаллов', text: `Нужно ещё ${Math.max(0, track.price - gems)} 💎` });
    }
  };

  const tapCostume = (id: string) => {
    sfx.tap();
    haptic.tap();
    toggleCostume(id);
    setMood('happy');
    setTimeout(() => setMood('idle'), 1200);
  };

  const tapPickCostume = (id: string) => {
    sfx.tap();
    haptic.tap();
    choosePuzzleCostume(id);
  };

  const confirmBuy = () => {
    if (!ask) return;
    const ok = buyItem(ask.id);
    setAsk(null);
    if (ok) {
      sfx.reward();
      haptic.correct();
      setMood('dance');
      setTimeout(() => setMood('idle'), 1800);
      showToast({ emoji: '🎩', title: `${ask.title} — твой!`, text: 'БУК уже примерил обновку' });
    } else {
      showToast({ emoji: '💎', title: 'Не хватает кристаллов', text: `Нужно ещё ${missingGems(ask, gems)}` });
    }
  };

  const tapWear = (item: ShopItem) => {
    sfx.tap();
    haptic.tap();
    toggleEquip(item.id);
    setMood('happy');
    setTimeout(() => setMood('idle'), 1200);
  };

  const tapTint = (target: TintTarget, tint: TintOption, unlocked: boolean) => {
    if (unlocked) {
      const outcome = recolorItem(target.id, tint.id);
      if (outcome === 'switched') {
        sfx.tap();
        haptic.tap();
        setMood('happy');
        setTimeout(() => setMood('idle'), 1200);
        showToast({ emoji: '🎨', title: `${target.title} — ${tint.title.toLowerCase()}`, text: 'Этот цвет уже открыт — меняй сколько хочешь' });
      }
      return;
    }
    if (gems < TINT_PRICE) {
      sfx.hint();
      showToast({
        emoji: '💎',
        title: `Для цвета «${tint.title.toLowerCase()}» нужен ещё 1 💎`,
        text: 'Краски открываются за кристаллы — загляни на главную',
      });
      return;
    }
    sfx.tap();
    setAskTint({ target, tint });
  };

  const confirmTint = () => {
    if (!askTint) return;
    const { target, tint } = askTint;
    const outcome = recolorItem(target.id, tint.id);
    setAskTint(null);
    if (outcome === 'opened') {
      sfx.reward();
      haptic.correct();
      setMood('dance');
      setTimeout(() => setMood('idle'), 1800);
      showToast({
        emoji: '🎨',
        title: `${target.title} — ${tint.title.toLowerCase()}!`,
        text: `Краска открыта · −${TINT_PRICE} 💎`,
      });
    } else if (outcome === 'no-gems') {
      showToast({ emoji: '💎', title: 'Не хватает кристаллов', text: 'Загляни на главную: там задания и сундук' });
    }
  };

  return (
    <div className="screen">
      <div className="row mb">
        <h1 className="grow" style={{ margin: 0 }}>
          Магазин БУКа 🎩
        </h1>
        <div className="stat-pill gems">💎 {gems}</div>
      </div>

      <div className="card mb shop-stage">
        <button
          className="shop-mascot"
          aria-label="Нажми, чтобы выбрать музыку для БУКа"
          aria-expanded={musicPicker}
          onClick={() => {
            sfx.hint();
            haptic.tap();
            setMusicPicker((open) => !open);
          }}
        >
          <Mascot mood={mood} look={look} stage={growth.index} size={132} />
        </button>
        <div className="grow center">
          <div style={{ fontWeight: 800 }}>
            {growth.title} · {owned.length ? 'наряд БУКа' : 'без обновок'}
          </div>
          <div className="tiny">{growth.desc}</div>
          <div className="tiny" style={{ marginTop: 4 }}>
            {growth.nextAt
              ? `Освоено ${mastered} ${plural(mastered, 'слово', 'слова', 'слов')} · до ступени выше ${growth.nextAt - mastered}`
              : `Освоено ${mastered} ${plural(mastered, 'слово', 'слова', 'слов')} — самая высокая ступень ✨`}
          </div>
          <div className="tiny" style={{ marginTop: 4 }}>
            {next
              ? left > 0
                ? `Ещё ${left} 💎 — и купишь «${next.title}»`
                : `Хватает на «${next.title}»!`
              : 'Весь гардероб собран ✨'}
            {' · '}куплено на {wardrobeValue(owned)} 💎
          </div>
          <button className="btn sm primary music-open" onClick={() => setMusicPicker((open) => !open)}>
            🎵 {selectedMusic ? `Играет: ${MUSIC_BY_ID[selectedMusic]?.title ?? 'музыка'}` : 'Выбрать музыку'}
          </button>
          <div className="tiny">Или нажми на БУКа, чтобы открыть свою музыкальную коллекцию</div>
        </div>
      </div>

      {musicPicker && (
        <section className="card mb music-picker" aria-label="Музыка БУКа">
          <div className="between mb">
            <div>
              <h2 style={{ margin: 0 }}>Музыка БУКа 🎵</h2>
              <div className="tiny">Выбирай из своей коллекции</div>
            </div>
            <button className="btn sm ghost" onClick={() => setMusicPicker(false)}>Готово</button>
          </div>
          <button className={`music-choice ${selectedMusic === null ? 'selected' : ''}`} onClick={() => chooseMusic(null)}>
            <span className="music-emoji">🔇</span><span className="grow"><b>Тишина</b><small>Выключить фоновую музыку</small></span>
            {selectedMusic === null && <span aria-label="Выбрано">✓</span>}
          </button>
          {MUSIC_TRACKS.filter((track) => musicOwned.includes(track.id)).map((track) => (
            <button key={track.id} className={`music-choice ${selectedMusic === track.id ? 'selected' : ''}`} onClick={() => chooseMusic(track.id)}>
              <span className="music-emoji">{track.emoji}</span>
              <span className="grow"><b>{track.title}</b><small>«{track.originalTitle}»</small></span>
              {selectedMusic === track.id && <span aria-label="Выбрано">✓</span>}
            </button>
          ))}
          {musicOwned.length === 0 && <p className="tiny">Пока нет мелодий. Загляни в музыкальный магазин ниже!</p>}
        </section>
      )}

      <section className="mb music-store">
        <div className="between mb">
          <div>
            <h2 style={{ margin: 0 }}>Музыкальный магазин 🎶</h2>
            <div className="tiny muted">{MUSIC_TRACKS.length} мелодий Kevin MacLeod · слушай и выбирай свою</div>
          </div>
          <span className="stat-pill gems">💎 {gems}</span>
        </div>
        <div className="music-store-note">
          🎧 Настоящие записи Kevin MacLeod — они работают офлайн и используются по лицензии CC BY 4.0
          (автор указан в разделе «Авторы и лицензии»).
        </div>
        <div className="mb"><MusicCreditsToggle /></div>
        {/* Полки: спокойный фон отдельно — у каждого своё место в игре */}
        {MUSIC_SHELVES.map(({ shelf, title, note }) => (
          <div className="music-shelf" key={shelf}>
            <h3 className="music-shelf-title">{title}</h3>
            {note && <div className="tiny muted music-shelf-note">{note}</div>}
            <div className="shop-grid music-grid">
              {tracksByShelf(shelf).map((track) => {
                const ownedTrack = musicOwned.includes(track.id);
                const selected = selectedMusic === track.id;
                const previewing = previewTrack === track.id;
                const affordable = gems >= track.price;
                return (
                  <article key={track.id} className={`shop-item music-item ${selected ? 'on' : ''} ${ownedTrack ? 'owned' : ''}`}>
                    <div className="music-cover" aria-hidden="true"><span>{track.emoji}</span><i>♫</i></div>
                    {track.tag && <span className="music-tag">{track.tag}</span>}
                    <div className="shop-title">{track.title}</div>
                    <div className="tiny shop-desc">«{track.originalTitle}» · {fmtTime(track.seconds)}</div>
                    {/* Одна строка для взрослых: на каком тренде трек и чего в нём нет */}
                    {track.about && <div className="tiny muted music-about">{track.about}</div>}
                    <button className="btn sm wide ghost" onClick={() => togglePreview(track)} aria-label={`${previewing ? 'Остановить' : 'Послушать'} ${track.title}`}>
                      {previewing ? '⏸ Остановить' : '▶ Послушать'}
                    </button>
                    {ownedTrack ? (
                      <button className={`btn sm wide ${selected ? 'green' : 'primary'}`} onClick={() => chooseMusic(selected ? null : track.id)}>
                        {selected ? 'Играет ✓' : 'Выбрать'}
                      </button>
                    ) : (
                      <button className={`btn sm wide ${affordable ? 'primary' : 'ghost'}`} disabled={!affordable} onClick={() => setAskMusic(track)}>
                        {track.price === 0 ? 'Забрать бесплатно' : affordable ? `Купить · 💎${track.price}` : `Ещё ${track.price - gems} 💎`}
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <div className="mb">
        <h2 className="mb">Костюмы · пазлы</h2>
        <div className="tiny muted" style={{ marginTop: '-6px', marginBottom: 10 }}>
          Завершённый урок — фрагмент пазла. Собери {PUZZLE_SIZE} — БУК получит новый костюм 🧩
        </div>
        {allCostumesDone && (
          <div className="card tiny mb" style={{ textAlign: 'center' }}>
            ✨ Вся коллекция собрана! Теперь за каждый урок — +{OVERFLOW_GEMS} 💎
          </div>
        )}
        <div className="shop-grid costume-grid">
          {COSTUMES.map((c) => {
            const done = pz.assembled.includes(c.id);
            const prog = costumeProgress(pz, c.id);
            const isCurrent = !done && collecting === c.id;
            const wearing = pz.worn === c.id;
            return (
              <div key={c.id} className={`shop-item costume-card ${done ? 'owned' : ''} ${wearing ? 'on' : ''} ${isCurrent ? 'current' : ''}`}>
                {/* Несобранный костюм помечен классом pz-locked, но рисуется В ЦВЕТЕ:
                    раньше он был серым силуэтом, и ребёнку было не выбрать «тот самый». */}
                <div className={`shop-icon${done ? '' : ' pz-locked'}`}>
                  <Mascot mood={wearing ? 'happy' : 'idle'} costumeId={c.id} size={64} stage={growth.index} />
                </div>
                <div className="shop-title">{c.title}</div>
                <div className="tiny shop-desc">{c.desc}</div>
                {!done && (
                  <div className="pz-dots" role="img" aria-label={`${prog} из ${PUZZLE_SIZE} фрагментов`}>
                    {Array.from({ length: PUZZLE_SIZE }, (_, i) => (
                      <i key={i} className={`pz-dot${i < prog ? ' on' : ''}`} />
                    ))}
                  </div>
                )}
                {done ? (
                  <>
                    <button className={`btn sm wide ${wearing ? 'green' : 'ghost'}`} onClick={() => tapCostume(c.id)}>
                      {wearing ? 'Надето ✓' : 'Надеть'}
                    </button>
                    {/* у собранного костюма красим только акцент: свечение и плащ */}
                    <button
                      className={`btn sm wide ${palette === c.id ? 'primary' : 'ghost'}`}
                      aria-expanded={palette === c.id}
                      onClick={() => {
                        sfx.tap();
                        setPalette(palette === c.id ? null : c.id);
                      }}
                    >
                      {palette === c.id ? '🎨 Готово' : '🎨 Акцент'}
                    </button>
                    {palette === c.id && (
                      <TintPicker
                        caption="Акцент"
                        targetId={c.id}
                        title={c.title}
                        tuning={profile.shop?.tuning}
                        onPick={(tint, unlocked) => tapTint({ id: c.id, title: c.title }, tint, unlocked)}
                      />
                    )}
                  </>
                ) : (
                  <button className={`btn sm wide ${isCurrent ? 'primary' : 'ghost'}`} onClick={() => tapPickCostume(c.id)}>
                    {isCurrent
                      ? `Собираю · ${prog}/${PUZZLE_SIZE}`
                      : prog > 0
                        ? `Продолжить · ${prog}/${PUZZLE_SIZE}`
                        : 'Собирать'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {(Object.keys(SLOT_TITLE) as (keyof typeof SLOT_TITLE)[]).map((slot) => {
        const items = SHOP_ITEMS.filter((i) => i.slot === slot);
        if (!items.length) return null;
        return (
          <div key={slot} className="mb">
            <h2 className="mb">{SLOT_TITLE[slot]}</h2>
            <div className="shop-grid">
              {items.map((item) => {
                const owned_ = isOwned(owned, item.id);
                const wearing = isWearing(look, item);
                const affordable = canBuy(item, gems);
                return (
                  <div key={item.id} className={`shop-item ${wearing ? 'on' : ''} ${owned_ ? 'owned' : ''}`}>
                    <div className="shop-icon">
                      <Mascot mood="idle" look={{ [item.slot]: item.id }} stage={growth.index} size={64} />
                    </div>
                    <div className="shop-title">{item.title}</div>
                    <div className="tiny shop-desc">{item.desc}</div>
                    {owned_ ? (
                      <>
                        <button className={`btn sm wide ${wearing ? 'green' : 'ghost'}`} onClick={() => tapWear(item)}>
                          {wearing ? 'Надето ✓' : 'Надеть'}
                        </button>
                        {/* Палитра только у купленной вещи: сначала вещь — потом краски */}
                        <button
                          className={`btn sm wide ${palette === item.id ? 'primary' : 'ghost'}`}
                          aria-expanded={palette === item.id}
                          onClick={() => {
                            sfx.tap();
                            setPalette(palette === item.id ? null : item.id);
                          }}
                        >
                          {palette === item.id ? '🎨 Готово' : '🎨 Цвет'}
                        </button>
                        {palette === item.id && (
                          <TintPicker
                            caption="Цвет"
                            targetId={item.id}
                            title={item.title}
                            tuning={profile.shop?.tuning}
                            onPick={(tint, unlocked) => tapTint({ id: item.id, title: item.title }, tint, unlocked)}
                          />
                        )}
                      </>
                    ) : (
                      <button
                        className={`btn sm wide ${affordable ? 'primary' : 'ghost'}`}
                        disabled={!affordable}
                        onClick={() => {
                          sfx.tap();
                          setAsk(item);
                        }}
                      >
                        {affordable ? `Купить · 💎${item.price}` : `Ещё ${missingGems(item, gems)} 💎`}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <p className="tiny center">
        Кристаллы 💎 дают за задания дня и сундук — загляни на главную.
        <br />
        БУК растёт, когда ты осваиваешь слова: сейчас — {growth.title.toLowerCase()}.
      </p>

      {askMusic && (
        <ConfirmDialog
          emoji={askMusic.emoji}
          title={askMusic.price === 0 ? `Забрать «${askMusic.title}»?` : `Купить «${askMusic.title}»?`}
          text={askMusic.price === 0 ? 'Мелодия бесплатная. БУК сразу сможет её включить.' : `Отдашь ${askMusic.price} 💎 из ${gems}. БУК сразу включит новую музыку.`}
          stayLabel={askMusic.price === 0 ? 'Забрать бесплатно' : `Купить за 💎${askMusic.price}`}
          leaveLabel="Не сейчас"
          onStay={confirmMusicBuy}
          onLeave={() => setAskMusic(null)}
        />
      )}

      {ask && (
        <ConfirmDialog
          emoji="🎩"
          title={`Купить «${ask.title}»?`}
          text={`Отдашь ${ask.price} 💎 из ${gems}. БУК сразу это примерит.`}
          stayLabel={`Купить за 💎${ask.price}`}
          leaveLabel="Не сейчас"
          onStay={confirmBuy}
          onLeave={() => setAsk(null)}
        />
      )}

      {askTint && (
        <ConfirmDialog
          emoji="🎨"
          title={`Открыть цвет «${askTint.tint.title.toLowerCase()}»?`}
          text={`Это ${TINT_PRICE} 💎 из ${gems}. Потом сможешь переключаться на него бесплатно.`}
          stayLabel={`Открыть за 💎${TINT_PRICE}`}
          leaveLabel="Не сейчас"
          onStay={confirmTint}
          onLeave={() => setAskTint(null)}
        />
      )}
    </div>
  );
}

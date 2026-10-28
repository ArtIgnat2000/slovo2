import { useEffect, useMemo, useRef, useState } from 'react';
import { toBlob } from 'html-to-image';
import { BUILDINGS, type BuildingItem } from '../../engine/buildings';
import { ALL_COSTUMES, normalizePuzzle, type Costume } from '../../engine/puzzles';
import { SHOP_ITEMS, type ShopItem } from '../../engine/shop';
import { MUSIC_BY_ID, MUSIC_TRACKS, type MusicTrack } from '../../engine/music';
import { hasSoundPack, SOUND_PACKS, type SoundPack } from '../../engine/sounds';
import { THEME_STYLES, type ThemeStyleOption } from '../../engine/theme-styles';
import { plural } from '../../engine/quests';
import { useActiveProfile, useApp, useLook } from '../../state/store';
import { Mascot } from '../Mascot';
import { ToyArt } from '../ToyArt';
import { BuildingArt } from '../BuildingArt';
import { playMusic } from '../../platform/music';
import { previewSoundCue, sfx } from '../../platform/sound';
import type { ShopTuning } from '../../types';

type CollectionAreaId = 'looks' | 'tech' | 'bases' | 'music' | 'sounds' | 'style';
type CollectionKind = 'shop-item' | 'costume' | 'building' | 'music' | 'sound' | 'theme';

type CollectionItem = {
  id: string;
  title: string;
  kind: CollectionKind;
  item?: ShopItem;
  costume?: Costume;
  building?: BuildingItem;
  track?: MusicTrack;
  sound?: SoundPack;
  theme?: ThemeStyleOption;
};

type CollectionArea = { id: CollectionAreaId; title: string; emoji: string; items: CollectionItem[] };

function collectionPrice(entry: CollectionItem): number {
  switch (entry.kind) {
    case 'shop-item': return entry.item?.price ?? 0;
    case 'costume': return entry.costume?.price ?? 0;
    case 'building': return entry.building?.price ?? 0;
    case 'music': return entry.track?.price ?? 0;
    case 'sound': return entry.sound?.price ?? 0;
    case 'theme': return 0;
  }
}

function CollectionArt({ entry, size = 64, tuning }: { entry: CollectionItem; size?: number; tuning?: ShopTuning }) {
  if (entry.kind === 'shop-item' && entry.item) {
    if (entry.item.kind === 'toy') return <ToyArt id={entry.item.id} size={size} tuning={tuning} />;
    return <Mascot mood="idle" look={{ [entry.item.slot]: entry.item.id }} size={size} />;
  }
  if (entry.kind === 'costume' && entry.costume) return <Mascot mood="idle" costumeId={entry.costume.id} size={size} />;
  if (entry.kind === 'building' && entry.building) {
    return <BuildingArt id={entry.building.id} className="collection-building-art" decorative />;
  }
  if (entry.kind === 'theme' && entry.theme) {
    const { preview, emoji } = entry.theme;
    return (
      <span className="collection-theme-art" style={{ background: `linear-gradient(145deg, ${preview.light}, ${preview.accent})` }} aria-hidden="true">
        {emoji}
      </span>
    );
  }
  if (entry.kind === 'music' && entry.track) {
    return <span className="collection-sound-art music" aria-hidden="true">{entry.track.emoji}</span>;
  }
  if (entry.kind === 'sound' && entry.sound) {
    return <span className="collection-sound-art" aria-hidden="true">{entry.sound.emoji}</span>;
  }
  return null;
}

function collectionAreas(profile: NonNullable<ReturnType<typeof useActiveProfile>>): CollectionArea[] {
  const shop = profile.shop;
  const puzzle = normalizePuzzle(profile.puzzle);
  const costumesOwned = [...puzzle.assembled, ...(shop?.crystalCostumesOwned ?? [])];
  const ownedItems = SHOP_ITEMS.filter((item) => (shop?.owned ?? []).includes(item.id));
  const looks: CollectionItem[] = [
    ...ownedItems.filter((item) => item.kind !== 'toy').map((item) => ({ id: item.id, title: item.title, kind: 'shop-item' as const, item })),
    ...ALL_COSTUMES.filter((costume) => costumesOwned.includes(costume.id)).map((costume) => ({ id: costume.id, title: costume.title, kind: 'costume' as const, costume })),
  ];
  const tech = ownedItems.filter((item) => item.kind === 'toy').map((item) => ({ id: item.id, title: item.title, kind: 'shop-item' as const, item }));
  const bases = BUILDINGS.filter((building) => (shop?.buildingsOwned ?? []).includes(building.id)).map((building) => ({ id: building.id, title: building.title, kind: 'building' as const, building }));
  const music = MUSIC_TRACKS.filter((track) => (shop?.musicOwned ?? []).includes(track.id)).map((track) => ({ id: track.id, title: track.title, kind: 'music' as const, track }));
  const sounds = SOUND_PACKS.filter((sound) => hasSoundPack(shop?.soundOwned, sound.id)).map((sound) => ({ id: sound.id, title: sound.title, kind: 'sound' as const, sound }));
  // Оформления бесплатны, но доступны и выбираются как личные варианты; включаем
  // весь каталог в коллекцию, а отмеченное оформление остаётся видимым в деталях.
  const style = THEME_STYLES.map((theme) => ({ id: theme.id, title: theme.title, kind: 'theme' as const, theme }));
  const allAreas: CollectionArea[] = [
    { id: 'looks', title: 'Образы', emoji: '🎩', items: looks },
    { id: 'tech', title: 'Техника', emoji: '🚗', items: tech },
    { id: 'bases', title: 'Базы', emoji: '🏙️', items: bases },
    { id: 'music', title: 'Музыка', emoji: '🎵', items: music },
    { id: 'sounds', title: 'Звуки', emoji: '🔊', items: sounds },
    { id: 'style', title: 'Оформление', emoji: '🖼️', items: style },
  ];
  return allAreas
    .filter((area) => area.items.length > 0)
    .map((area) => ({ ...area, items: area.items.slice().sort((a, b) => collectionPrice(a) - collectionPrice(b)) }));
}

/** Полная визуальная коллекция: обзор областей → область → отдельная вещь. */
export function WorldScreen({ onBack }: { onBack: () => void }) {
  const profile = useActiveProfile();
  const currentLook = useLook();
  const settings = useApp((s) => s.settings);
  const setSettings = useApp((s) => s.setSettings);
  const showToast = useApp((s) => s.showToast);
  const [areaId, setAreaId] = useState<CollectionAreaId | null>(null);
  const [itemId, setItemId] = useState<string | null>(null);
  const [previewingTrack, setPreviewingTrack] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!previewingTrack) return;
    return () => {
      const selected = profile?.shop?.musicTrack ?? null;
      playMusic(selected ? MUSIC_BY_ID[selected] ?? null : null);
    };
  }, [previewingTrack, profile?.shop?.musicTrack]);

  const areas = useMemo(() => (profile ? collectionAreas(profile) : []), [profile]);
  if (!profile) return null;

  const area = areas.find((candidate) => candidate.id === areaId) ?? null;
  const entry = area?.items.find((candidate) => candidate.id === itemId) ?? null;
  const total = areas.reduce((sum, candidate) => sum + candidate.items.length, 0);
  const backOneLevel = () => {
    if (entry) setItemId(null);
    else if (area) setAreaId(null);
    else onBack();
  };

  const shareSnapshot = async () => {
    if (!mapRef.current || sharing) return;
    setSharing(true);
    try {
      const blob = await toBlob(mapRef.current, {
        pixelRatio: 2,
        backgroundColor: '#fffaf1',
        cacheBust: true,
        filter: (node) => !(node instanceof HTMLElement && node.dataset.snapshotIgnore === 'true'),
      });
      if (!blob) throw new Error('Не удалось подготовить изображение');
      const file = new File([blob], 'мой-мир.png', { type: 'image/png' });
      const shareData = { title: 'Моя коллекция', text: 'Посмотри мою коллекцию!', files: [file] };
      if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        await navigator.share(shareData);
        showToast({ emoji: '📤', title: 'Снимок отправлен' });
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'мой-мир.png';
        link.click();
        URL.revokeObjectURL(url);
        showToast({ emoji: '🖼️', title: 'Снимок сохранён', text: 'Теперь его можно отправить друзьям' });
      }
    } catch (error) {
      const name = (error as { name?: string })?.name;
      if (name !== 'AbortError') showToast({ emoji: '⚠️', title: 'Не получилось сделать снимок', text: 'Попробуй ещё раз' });
    } finally {
      setSharing(false);
    }
  };

  const chooseMusic = (track: MusicTrack) => {
    if (previewingTrack === track.id) {
      const selectedId = profile.shop?.musicTrack ?? null;
      playMusic(selectedId ? MUSIC_BY_ID[selectedId] ?? null : null);
      setPreviewingTrack(null);
    } else {
      playMusic(track);
      setPreviewingTrack(track.id);
    }
  };

  const chooseSoundPreview = (sound: SoundPack) => {
    previewSoundCue(sound.id, 'correct');
    sfx.tap();
  };

  return (
    <div className="my-world">
      <div className="my-world-toolbar">
        <button type="button" className="btn sm ghost" onClick={backOneLevel} data-snapshot-ignore="true">
          ← {entry ? 'К области' : area ? 'К карте' : 'Назад в БУК'}
        </button>
        <button type="button" className="btn sm" onClick={shareSnapshot} disabled={sharing} data-snapshot-ignore="true">
          {sharing ? 'Готовим снимок…' : '📸 Снимок'}
        </button>
      </div>

      {!area && (
        <div className="collection-map" ref={mapRef}>
          <div className="collection-map-heading">
            <span aria-hidden="true">🌍</span>
            <div>
              <h2>Мой мир</h2>
              <p>Вся твоя коллекция · {total} {plural(total, 'вещь', 'вещи', 'вещей')}</p>
            </div>
          </div>
          {areas.length === 0 ? (
            <div className="card collection-empty">
              <span aria-hidden="true">🧭</span>
              <b>Твоя коллекция пока ждёт первую находку</b>
              <p>Когда появятся покупки и награды, они будут собираться здесь.</p>
            </div>
          ) : (
            <div className="collection-map-areas">
              {areas.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  className={`collection-area area-${candidate.id}`}
                  onClick={() => { setAreaId(candidate.id); setItemId(null); }}
                  aria-label={`${candidate.title}: ${candidate.items.length}. Увеличить область`}
                >
                  <span className="sr-only">{candidate.items.map((thing) => thing.title).join(', ')}</span>
                  <span className="collection-area-head">
                    <span className="collection-area-icon" aria-hidden="true">{candidate.emoji}</span>
                    <span className="collection-area-name">{candidate.title}</span>
                    <span className="collection-area-count">{candidate.items.length}</span>
                    <span className="collection-area-zoom" aria-hidden="true">↗</span>
                  </span>
                  <span className="collection-map-thumbs" aria-hidden="true">
                    {candidate.items.map((thing) => (
                      <span className="collection-map-thumb" key={thing.id}>
                        <CollectionArt entry={thing} size={36} tuning={profile.shop?.tuning} />
                      </span>
                    ))}
                  </span>
                </button>
              ))}
            </div>
          )}
          <p className="collection-map-hint">Нажми на область, чтобы рассмотреть её крупнее.</p>
        </div>
      )}

      {area && !entry && (
        <section className="collection-zoom" ref={mapRef}>
          <div className="collection-zoom-heading">
            <span aria-hidden="true">{area.emoji}</span>
            <div>
              <h2>{area.title}</h2>
              <p>{area.items.length} {plural(area.items.length, 'предмет', 'предмета', 'предметов')} · нажми на вещь, чтобы увеличить</p>
            </div>
          </div>
          <div className="collection-items-grid">
            {area.items.map((thing) => (
              <button
                type="button"
                className="collection-item-card"
                key={thing.id}
                onClick={() => setItemId(thing.id)}
                aria-label={`Увеличить: ${thing.title}`}
              >
                <span className="collection-item-art"><CollectionArt entry={thing} size={72} tuning={profile.shop?.tuning} /></span>
                <span className="collection-item-title">{thing.title}</span>
                <span className="collection-item-zoom" aria-hidden="true">＋</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {entry && area && (
        <section className="collection-detail" ref={mapRef}>
          <div className={`collection-detail-art kind-${entry.kind}`}>
            <CollectionArt entry={entry} size={210} tuning={profile.shop?.tuning} />
          </div>
          <div className="collection-detail-copy">
            <span className="collection-detail-kicker">{area.emoji} {area.title}</span>
            <h2>{entry.title}</h2>
            {entry.kind === 'shop-item' && entry.item && <p>{entry.item.desc}</p>}
            {entry.kind === 'costume' && entry.costume && <p>{entry.costume.desc}</p>}
            {entry.kind === 'building' && entry.building && <p>{entry.building.desc}</p>}
            {entry.kind === 'music' && entry.track && <p>{entry.track.originalTitle}</p>}
            {entry.kind === 'sound' && entry.sound && <p>{entry.sound.desc}</p>}
            {entry.kind === 'theme' && entry.theme && <p>{entry.theme.description}</p>}
            <div className="collection-detail-status">Есть в твоей коллекции ✓</div>
            {entry.kind === 'shop-item' && entry.item && entry.item.kind !== 'toy' && (
              <div className="collection-detail-status">{currentLook[entry.item.slot] === entry.item.id ? 'Сейчас надето на Буке ✓' : 'Можно надеть в БУКе'}</div>
            )}
            {entry.kind === 'building' && entry.building && (
              <div className="collection-detail-status">Часть твоей коллекции ✓</div>
            )}
            {entry.kind === 'theme' && entry.theme && (
              <div className="collection-detail-status">{settings.themeStyle === entry.theme.id ? 'Сейчас выбрано ✓' : 'Твоё оформление'}</div>
            )}
            {entry.kind === 'music' && entry.track && (
              <button type="button" className="btn primary lg" onClick={() => chooseMusic(entry.track!)} data-snapshot-ignore="true">
                {previewingTrack === entry.track.id ? '⏸ Остановить' : '▶ Послушать'}
              </button>
            )}
            {entry.kind === 'sound' && entry.sound && (
              <button type="button" className="btn primary lg" onClick={() => chooseSoundPreview(entry.sound!)} data-snapshot-ignore="true">
                ▶ Послушать звук
              </button>
            )}
            {entry.kind === 'theme' && entry.theme && settings.themeStyle !== entry.theme.id && (
              <button type="button" className="btn primary lg" onClick={() => setSettings({ themeStyle: entry.theme!.id })} data-snapshot-ignore="true">
                Выбрать оформление
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

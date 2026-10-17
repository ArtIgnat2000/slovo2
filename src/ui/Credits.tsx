/**
 * Раздел «Авторы и лицензии»: честная атрибуция музыки.
 *
 * Каталог — записи Kevin MacLeod (incompetech.com) под CC BY; каждый трек
 * обязан показать оригинальное название, автора, ссылку на источник, точную
 * лицензию со ссылкой и отметку об изменениях аудио (требование CC BY).
 * Всё берётся из engine/music.ts — один источник правды для кода и текста.
 *
 * Отдельно проговариваем: открытие мелодии за кристаллы внутри игры не даёт
 * ребёнку исключительных прав на запись.
 */
import { useState } from 'react';
import { MUSIC_TRACKS, type MusicTrack } from '../engine/music';

function TrackCredit({ track }: { track: MusicTrack }) {
  return (
    <li className="credits-item">
      <div className="credits-title">
        <span aria-hidden="true">{track.emoji}</span>{' '}
        <b>«{track.originalTitle}»</b>
        <span className="tiny muted"> — {track.title}</span>
      </div>
      <div className="tiny">
        {track.artist} (incompetech.com)
        <br />
        Источник:{' '}
        <a href={track.sourceUrl} target="_blank" rel="noopener noreferrer">
          страница трека (ISRC {track.isrc})
        </a>
        <br />
        Лицензия: {track.license} —{' '}
        <a href={track.licenseUrl} target="_blank" rel="noopener noreferrer">
          {track.licenseUrl}
        </a>
        <br />
        Изменения аудио: {track.modified ?? 'без изменений'}
      </div>
    </li>
  );
}

/** Список всех использованных записей с атрибуцией. */
export function MusicCredits() {
  return (
    <div className="credits">
      <p className="tiny">
        Фоновая музыка игры — записи <b>Kevin MacLeod</b> с сайта{' '}
        <a href="https://incompetech.com/music/royalty-free/" target="_blank" rel="noopener noreferrer">
          incompetech.com
        </a>
        , распространяются по лицензии{' '}
        <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">
          Creative Commons «Attribution» 4.0 (CC BY 4.0)
        </a>
        . Список скачан с официальных страниц треков; аудиофайлы лежат в приложении и играют офлайн.
      </p>
      <p className="tiny">
        🎵 Открытие мелодии за кристаллы внутри игры — это игровая коллекция.
        Оно <b>не даёт исключительных прав</b> на запись: музыка остаётся
        произведением автора под CC BY 4.0.
      </p>
      <p className="tiny">
        🔊 Звуковые эффекты (правильный ответ, сундук, награды) — собственные:
        они синтезируются кодом и не входят в музыкальный каталог.
      </p>
      <ul className="credits-list">
        {MUSIC_TRACKS.map((track) => (
          <TrackCredit key={track.id} track={track} />
        ))}
      </ul>
    </div>
  );
}

/**
 * Кнопка + раскрывающийся раздел: одинаково работает и в родительских
 * настройках, и в музыкальном магазине (доступно из приложения в обоих местах).
 */
export function MusicCreditsToggle({ label = 'Авторы и лицензии', className = 'btn sm ghost' }: { label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={className}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? 'Скрыть авторов и лицензии' : `📄 ${label}`}
      </button>
      {open && (
        <section className="card credits-card" aria-label="Авторы и лицензии">
          <h3 className="credits-heading">Авторы и лицензии</h3>
          <MusicCredits />
        </section>
      )}
    </>
  );
}

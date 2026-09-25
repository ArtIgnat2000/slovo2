import { useState } from 'react';
import { LESSONS, WORDS } from '../../content/words';
import { useActiveProfile } from '../../state/store';
import { Sentence, WordLetters } from '../WordView';

/** Словарик: всё, что учим, с ударениями и «опасными» буквами. */
export function WordsScreen() {
  const profile = useActiveProfile();
  const [open, setOpen] = useState<string | null>(null);
  const [lessonFilter, setLessonFilter] = useState<string>('all');

  const list = WORDS.filter((w) => lessonFilter === 'all' || w.theme === lessonFilter);
  const word = open ? WORDS.find((w) => w.id === open) : null;

  return (
    <div className="screen">
      <h1 className="mb">Словарик 📖</h1>
      <div className="row mb" style={{ overflowX: 'auto', paddingBottom: 4 }}>
        <button className={`chip ${lessonFilter === 'all' ? 'on' : ''}`} onClick={() => setLessonFilter('all')}>
          Все
        </button>
        {LESSONS.map((l) => (
          <button
            key={l.id}
            className={`chip ${lessonFilter === l.id ? 'on' : ''}`}
            onClick={() => setLessonFilter(l.id)}
          >
            {l.emoji} {l.title}
          </button>
        ))}
      </div>

      <div className="wordlist">
        {list.map((w) => {
          const st = profile?.words[w.id];
          const s = st?.s ?? 0;
          const cls = s >= 90 ? 'good' : s >= 40 ? 'mid' : st && st.wrong > 0 ? 'weak' : '';
          return (
            <button key={w.id} className={`word-chip ${cls}`} onClick={() => setOpen(w.id)}>
              {w.emoji} {w.text}
            </button>
          );
        })}
      </div>

      {word && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(20,16,32,.5)', zIndex: 70, display: 'grid', placeItems: 'center', padding: 20 }}
          onClick={() => setOpen(null)}
        >
          <div className="card" style={{ width: '100%', maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="center">
              <div className="big-emoji">{word.emoji}</div>
              <WordLetters word={word} stress markDanger />
              <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                {word.syllables.map((s, i) => (
                  <span className="chip" key={i}>
                    {s}
                  </span>
                ))}
              </div>
              <div className="mt">
                <Sentence word={word} hidden={false} />
              </div>
              {word.mnemonic && (
                <div className="banner mt">💡 {word.mnemonic}</div>
              )}
              <p className="tiny mt">
                Опасная буква: <b>{word.text[word.danger[0]].toUpperCase()}</b> (
                {word.dangerKind === 'consonant' ? 'согласная' : 'гласная'})
              </p>
              {profile?.words[word.id] && (
                <p className="tiny">
                  Освоенность: {profile.words[word.id].s}% · ошибок: {profile.words[word.id].wrong}
                </p>
              )}
              <button className="btn ghost wide mt" onClick={() => setOpen(null)}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

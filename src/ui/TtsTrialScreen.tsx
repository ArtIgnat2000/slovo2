/**
 * «Проба озвучки» — живое прослушивание слов на ЭТОМ телефоне (iOS/Android).
 *
 * Зачем: раньше системный TTS озвучивал словарные слова с неправильным
 * ударением. Это не оружие против ребёнка, а инструмент для владельца/родителя:
 * услышать ВСЕ рискованные слова банка + школьные термины и отметить, где
 * синтез попадает, а где мажет. Пока сводка не собрана — озвучки в приложении
 * нет (решение — по результатам прослушивания, по умолчанию «не делаем»).
 *
 * Экран живёт за замком «Родителям» и за пунктом «Ещё → Приложение»: детям
 * он не показывается. Ничего не оценивает и никуда не записывает — только
 * отметки ✓/✗ в localStorage устройства и сводка для вставки в чат.
 */
import { useEffect, useMemo, useState } from 'react';
import { pickRiskWords, type TtsItem } from '../content/tts-trial';

const VOTES_KEY = 'slovo2.tts-trial-votes';
const STRESS_MARK = '\u0301'; // U+0301

interface VoteState {
  /** ключ голоса (voiceURI|name) → слово → +1/-1 */
  [voice: string]: { [word: string]: 1 | -1 };
}

function voteKey(voice: SpeechSynthesisVoice | null): string {
  return (voice && (voice.voiceURI || voice.name)) || 'no-voice';
}

function loadVotes(): VoteState {
  try {
    return JSON.parse(localStorage.getItem(VOTES_KEY) || '{}') as VoteState;
  } catch {
    return {};
  }
}

function saveVotes(v: VoteState) {
  try {
    localStorage.setItem(VOTES_KEY, JSON.stringify(v));
  } catch {
    /* приватный режим — отметки живут до перезагрузки, это честно */
  }
}

export function TtsTrialScreen({ onClose }: { onClose: () => void }) {
  const items = useMemo(() => pickRiskWords(), []);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [rate, setRate] = useState(0.9);
  const [onlyRu, setOnlyRu] = useState(true);
  const [stressMark, setStressMark] = useState(true);
  const [votes, setVotes] = useState<VoteState>(loadVotes);
  const [summary, setSummary] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const voicesFor = (ruOnly: boolean) => {
    const ru = voices.filter((v) => (v.lang || '').toLowerCase().startsWith('ru'));
    return ruOnly ? ru : voices;
  };

  // Список голосов приезжает асинхронно (особенно на Android).
  useEffect(() => {
    if (!supported) return;
    const refresh = () => setVoices(window.speechSynthesis.getVoices());
    refresh();
    window.speechSynthesis.onvoiceschanged = refresh;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      window.speechSynthesis.cancel();
    };
  }, [supported]);

  useEffect(() => {
    const list = voicesFor(onlyRu);
    if (!list.length) {
      setVoiceId(null);
      return;
    }
    const keep = list.find((v) => (v.voiceURI || v.name) === voiceId)
      ?? list.find((v) => v.default)
      ?? list[0];
    setVoiceId(keep.voiceURI || keep.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voices, onlyRu]);

  const list = voicesFor(onlyRu);
  const currentVoice = voices.find((v) => (v.voiceURI || v.name) === voiceId) ?? null;
  const key = voteKey(currentVoice);
  const current = votes[key] ?? {};

  const speak = (text: string) => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(stressMark ? text : text.replace(new RegExp(STRESS_MARK, 'g'), ''));
    u.voice = currentVoice;
    u.lang = currentVoice?.lang || 'ru-RU';
    u.rate = rate;
    window.speechSynthesis.speak(u);
  };

  const counts = useMemo(() => {
    let ok = 0, bad = 0;
    for (const v of Object.values(current)) v === 1 ? ok++ : bad++;
    return { ok, bad, marked: ok + bad };
  }, [current]);

  const vote = (word: TtsItem, value: 1 | -1) => {
    setVotes((prev) => {
      const next = { ...prev };
      const forVoice = { ...(next[key] ?? {}) };
      if (forVoice[word.text] === value) delete forVoice[word.text];
      else forVoice[word.text] = value;
      next[key] = forVoice;
      saveVotes(next);
      return next;
    });
  };

  const buildSummary = () => {
    const lines = [
      'СЛОВО 2.0 — проба озвучки (TTS)',
      `Дата: ${new Date().toLocaleString('ru-RU')}`,
      `Устройство: ${navigator.userAgent}`,
      `Голос: ${currentVoice ? `${currentVoice.name} · ${currentVoice.lang}` : 'нет голоса'} (rate ${rate})`,
      `Ударный знак U+0301: ${stressMark ? 'включён' : 'выключен'}`,
      `Отмечено: ${counts.marked} из ${items.length} · верно: ${counts.ok} · неверно: ${counts.bad}`,
      '',
      ...items.map((w) => `${current[w.text] === 1 ? '✓' : current[w.text] === -1 ? '✗' : '·'} ${w.text} — ${w.marked}`),
    ];
    return lines.join('\n');
  };

  const copySummary = async () => {
    const text = buildSummary();
    setSummary(text);
    setCopied(false);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      /* кнопка «Скопировать» в сводке сделает то же самое */
    }
  };

  const reset = () => {
    if (!window.confirm('Очистить отметки по этому голосу на этом устройстве?')) return;
    setVotes((prev) => {
      const next = { ...prev };
      delete next[key];
      saveVotes(next);
      return next;
    });
  };

  return (
    <div className="screen tts-screen" data-tts-trial="">
      <button type="button" className="btn ghost sm mb" onClick={onClose}>← Назад</button>

      <div className="tts-hero">
        <h1>🔊 Проба озвучки</h1>
        <p>Голоса системного синтеза этого телефона (iOS / Android / Chrome) · слова банка и школьные термины</p>
      </div>

      {!supported ? (
        <div className="card tts-plain" role="alert">
          <p className="tts-plain-title">Этот браузер не умеет speechSynthesis</p>
          <p className="tiny muted">Откройте приложение на телефоне в Safari, Chrome или Samsung Internet — там у системы есть голоса.</p>
        </div>
      ) : (
        <>
          <div className="card tts-how">
            <b>Как слушать (честно, без подсказок себе)</b>
            <ol>
              <li>Выберите голос и скорость. «Ударный знак» включён — так мог бы звучать родной движок подсказок.</li>
              <li>Нажмите «слово» или «в предложении» один раз и <u>не нажимайте второй</u> — первое впечатление важнее.</li>
              <li>✓ — ударение точно на своём месте. ✗ — не там или неразборчиво. Сомневаетесь — это ✗.</li>
              <li>Отметки хранятся на этом устройстве. В конце — «Скопировать сводку» и вставить в чат.</li>
            </ol>
          </div>

          <div className="card tts-controls">
            <div className="tts-row">
              <select value={voiceId ?? ''} onChange={(e) => setVoiceId(e.target.value)} aria-label="Голос">
                {list.length === 0 && <option value="">голоса не найдены — нажмите «🔊 слово», список подгрузится</option>}
                {list.map((v) => {
                  const id = v.voiceURI || v.name;
                  return (
                    <option key={id} value={id}>
                      {v.name} · {v.lang}{v.default ? ' · по умолчанию' : ''}
                    </option>
                  );
                })}
              </select>
              <select value={rate} onChange={(e) => setRate(Number(e.target.value))} aria-label="Скорость">
                <option value={0.75}>медленно (0.75)</option>
                <option value={0.9}>спокойно (0.9)</option>
                <option value={1}>обычно (1.0)</option>
              </select>
            </div>
            <div className="tts-toggles">
              <button type="button" className="tts-chip" aria-pressed={onlyRu} onClick={() => setOnlyRu((v) => !v)}>
                только русские голоса
              </button>
              <button type="button" className="tts-chip" aria-pressed={stressMark} onClick={() => setStressMark((v) => !v)}>
                ударный знак U+0301
              </button>
            </div>
          </div>

          <div className="tts-stats" role="status">
            <span><b>Отмечено:</b> {counts.marked} из {items.length}</span>
            <span className="tts-ok">✓ {counts.ok}</span>
            <span className="tts-bad">✗ {counts.bad}</span>
            <button type="button" className="btn ghost sm tts-reset" onClick={reset}>Сбросить</button>
          </div>

          <div className="tts-list">
            {items.map((w, i) => (
              <div className="tts-card" key={w.text}>
                <div className="tts-word-line">
                  <span className="tts-idx">{i + 1}.</span>
                  <span className="tts-term">{w.marked}</span>
                  {w.note && <span className="tts-tag">{w.note}</span>}
                </div>
                <div className="tts-meta">{w.syllables} · {w.grades.map((g) => `${g} класс`).join(', ')}</div>
                <div className="tts-actions">
                  <button type="button" className="tts-play" onClick={() => speak(w.marked)}>🔊 слово</button>
                  <button type="button" className="tts-play tts-play-phrase" onClick={() => speak(w.sentence)}>🔊 в предложении</button>
                  <div className="tts-verdict">
                    <button type="button" className={`tts-vbtn tts-v-ok ${current[w.text] === 1 ? 'on' : ''}`} aria-pressed={current[w.text] === 1} aria-label="Ударение верно" onClick={() => vote(w, 1)}>✓</button>
                    <button type="button" className={`tts-vbtn tts-v-bad ${current[w.text] === -1 ? 'on' : ''}`} aria-pressed={current[w.text] === -1} aria-label="Ударение неверно" onClick={() => vote(w, -1)}>✗</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="tts-footer">
            <button type="button" className="btn primary grow" onClick={copySummary}>Скопировать сводку</button>
          </div>

          {summary && (
            <div className="card tts-summary">
              <div className="setting-title">Сводка пробы{copied ? ' — скопирована ✓' : ''}</div>
              <textarea readOnly value={summary} rows={12} onFocus={(e) => e.target.select()} aria-label="Сводка пробы озвучки" />
              <button
                type="button"
                className="btn ghost wide mt"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(summary);
                    setCopied(true);
                  } catch {
                    /* поле выделено — скопируется вручную */
                  }
                }}
              >
                Скопировать текст
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

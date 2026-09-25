import { useMemo, useRef, useState } from 'react';
import { ACHIEVEMENTS } from '../../engine/rewards';
import { WORDS, WORD_BY_ID } from '../../content/words';
import { dayKey, masteredCount, useActiveProfile, useApp } from '../../state/store';
import { download } from '../../platform/storage';
import { isStandalone } from '../../platform/pwa';

interface Props {
  unlocked: boolean;
  onUnlock: () => void;
  onOpenProfiles: () => void;
}

export function ParentScreen({ unlocked, onUnlock, onOpenProfiles }: Props) {
  const profile = useActiveProfile();
  const { settings, setSettings, replaceAll, resetProfile } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);

  const [a, b] = useMemo(() => [2 + Math.floor(Math.random() * 8), 2 + Math.floor(Math.random() * 8)], []);
  const [answer, setAnswer] = useState('');

  if (!profile) return null;

  if (!unlocked) {
    return (
      <div className="screen center">
        <div className="big-emoji">🔐</div>
        <h1>Раздел для взрослых</h1>
        <p className="muted">Реши пример, чтобы войти:</p>
        <div style={{ fontSize: 36, fontWeight: 800, margin: '12px 0' }}>
          {a} × {b} = ?
        </div>
        <input
          className="input"
          inputMode="numeric"
          value={answer}
          onChange={(e) => setAnswer(e.target.value.replace(/\D/g, ''))}
          placeholder="ответ"
        />
        <button
          className="btn primary wide lg mt"
          disabled={!answer}
          onClick={() => {
            if (Number(answer) === a * b) onUnlock();
            else {
              setAnswer('');
              alert('Неверно, попробуй ещё раз');
            }
          }}
        >
          Войти
        </button>
      </div>
    );
  }

  const days = lastDays(7);
  const totalOk = Object.values(profile.words).reduce((s, w) => s + w.ok, 0);
  const totalWrong = Object.values(profile.words).reduce((s, w) => s + w.wrong, 0);
  const accuracy = totalOk + totalWrong > 0 ? Math.round((totalOk / (totalOk + totalWrong)) * 100) : 0;
  const weak = Object.entries(profile.errors)
    .sort((x, y) => y[1] - x[1])
    .slice(0, 10);

  const exportData = () => {
    const data = JSON.stringify({ profiles: useApp.getState().profiles, activeId: useApp.getState().activeId, settings }, null, 2);
    download(`slovo2-${dayKey()}.json`, data);
  };

  const importData = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed.profiles)) throw new Error('Нет профилей');
      if (confirm('Заменить текущий прогресс загруженным?')) replaceAll(parsed);
    } catch (e) {
      alert('Не удалось загрузить файл: ' + (e as Error).message);
    }
  };

  return (
    <div className="screen">
      <h1 className="mb">Родителям 👨‍👩‍👧</h1>

      <div className="card mb">
        <div className="row">
          <div className="avatar" style={{ cursor: 'default' }}>
            {profile.avatar}
          </div>
          <div className="grow">
            <h3 style={{ margin: 0 }}>{profile.name}</h3>
            <div className="tiny">занимается с {new Date(profile.createdAt).toLocaleDateString('ru-RU')}</div>
          </div>
          <button className="btn ghost sm" onClick={onOpenProfiles}>
            Дети
          </button>
        </div>
      </div>

      <div className="grid-3 mb">
        <Stat label="Освоено слов" value={`${masteredCount(profile)}/${WORDS.length}`} />
        <Stat label="Точность" value={`${accuracy}%`} />
        <Stat label="Серия" value={`${profile.streak} дн.`} />
      </div>

      <div className="card mb">
        <h3>Последние 7 дней</h3>
        <div className="calendar">
          {days.map((d) => {
            const st = profile.days[d.key];
            return (
              <div className="cal-day" key={d.key}>
                {d.label}
                <div className={`cal-dot ${st && st.xp > 0 ? 'on' : ''} ${d.key === dayKey() ? 'today' : ''}`} />
                <div className="tiny" style={{ marginTop: 2 }}>{st?.xp ?? 0}</div>
              </div>
            );
          })}
        </div>
        <div className="kv mt">
          <span>Всего правильно / с ошибками</span>
          <b>
            {totalOk} / {totalWrong}
          </b>
        </div>
        <div className="kv">
          <span>Кристаллы</span>
          <b>💎 {profile.gems}</b>
        </div>
        <div className="kv">
          <span>«Заморозок» серии</span>
          <b>❄️ {profile.freezes}</b>
        </div>
      </div>

      {weak.length > 0 && (
        <div className="card mb">
          <h3>Слова с ошибками</h3>
          <p className="tiny">Их стоит написать вместе в тетради или повторить вслух.</p>
          <div className="wordlist">
            {weak.map(([id, n]) => (
              <span className="word-chip weak" key={id}>
                {WORD_BY_ID[id]?.text ?? id} · {n}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="card mb">
        <h3>Достижения</h3>
        <div className="row" style={{ flexWrap: 'wrap', gap: 12 }}>
          {ACHIEVEMENTS.map((a) => {
            const has = profile.achievements.includes(a.id);
            return (
              <div key={a.id} className="center" style={{ width: 76, opacity: has ? 1 : 0.35 }}>
                <div style={{ fontSize: 30 }}>{a.emoji}</div>
                <div className="tiny">{a.title}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card mb">
        <h3>Настройки</h3>
        <div className="kv">
          <span>Звук</span>
          <button className={`chip ${settings.sound ? 'on' : ''}`} onClick={() => setSettings({ sound: !settings.sound })}>
            {settings.sound ? 'вкл' : 'выкл'}
          </button>
        </div>
        <div className="kv">
          <span>Вибрация</span>
          <button
            className={`chip ${settings.haptics ? 'on' : ''}`}
            onClick={() => setSettings({ haptics: !settings.haptics })}
          >
            {settings.haptics ? 'вкл' : 'выкл'}
          </button>
        </div>
        <div className="kv">
          <span>Тема</span>
          <div className="row">
            {(['auto', 'light', 'dark'] as const).map((t) => (
              <button key={t} className={`chip ${settings.theme === t ? 'on' : ''}`} onClick={() => setSettings({ theme: t })}>
                {t === 'auto' ? 'авто' : t === 'light' ? 'светлая' : 'тёмная'}
              </button>
            ))}
          </div>
        </div>
        <div className="kv">
          <span>Цель дня (XP)</span>
          <div className="row">
            {[60, 120, 200].map((g) => (
              <button key={g} className={`chip ${settings.dailyGoal === g ? 'on' : ''}`} onClick={() => setSettings({ dailyGoal: g })}>
                {g}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!isStandalone() && (
        <div className="banner mb">
          📲 <b>Добавить на экран телефона:</b> в браузере «Поделиться» → «На экран Домой». После этого приложение
          открывается как обычное и работает без интернета.
        </div>
      )}

      <div className="card mb">
        <h3>Прогресс</h3>
        <p className="tiny">Файл можно сохранить и перенести на другой телефон.</p>
        <div className="row">
          <button className="btn ghost grow" onClick={exportData}>
            ⬇️ Сохранить
          </button>
          <button className="btn ghost grow" onClick={() => fileRef.current?.click()}>
            ⬆️ Загрузить
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importData(f);
            e.target.value = '';
          }}
        />
        <button
          className="btn danger wide mt"
          onClick={() => {
            if (confirm(`Сбросить весь прогресс ${profile.name}?`)) resetProfile(profile.id);
          }}
        >
          Сбросить прогресс
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card tight center">
      <div style={{ fontSize: 22, fontWeight: 800 }}>{value}</div>
      <div className="tiny">{label}</div>
    </div>
  );
}

function lastDays(n: number): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    out.push({
      key: dayKey(d),
      label: d.toLocaleDateString('ru-RU', { weekday: 'short' }).slice(0, 2),
    });
  }
  return out;
}

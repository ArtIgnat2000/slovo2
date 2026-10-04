import { useMemo, useRef, useState } from 'react';
import type { Profile } from '../../types';
import { ACHIEVEMENTS } from '../../engine/rewards';
import { agoLabel, EXPORT_REMINDER_MS, LOG_LABEL } from '../../engine/vault';
import { WORDS, WORD_BY_ID } from '../../content/words';
import { dayKey, masteredCount, useActiveProfile, useApp } from '../../state/store';
import { useStorageHealth } from '../../state/health';
import { download, requestPersistence } from '../../platform/storage';
import { isStandalone } from '../../platform/pwa';
import { DEFAULT_LESSON_SIZE, LESSON_SIZE_OPTIONS } from '../../engine/scheduler';

interface Props {
  unlocked: boolean;
  onUnlock: () => void;
  onOpenProfiles: () => void;
  onOpenVlabs: () => void;
}

export function ParentScreen({ unlocked, onUnlock, onOpenProfiles, onOpenVlabs }: Props) {
  const profile = useActiveProfile();
  const { settings, setSettings, setLessonSize } = useApp();

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
        <div className="kv" style={{ alignItems: 'flex-start' }}>
          <div>
            <div>Сова БУК</div>
            <div className="tiny">Плавающий помощник: его можно и убрать</div>
          </div>
          <div className="row">
            {(
              [
                ['on', 'везде'],
                ['home', 'на главной'],
                ['off', 'не показывать'],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                className={`chip ${settings.mascot === mode ? 'on' : ''}`}
                onClick={() => setSettings({ mascot: mode })}
              >
                {label}
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
        <div className="kv" style={{ alignItems: 'flex-start' }}>
          <div>
            <div>Размер урока</div>
            <div className="tiny">Меняется со следующего запуска урока</div>
          </div>
          <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {LESSON_SIZE_OPTIONS.map((option) => (
              <button
                key={option.id}
                className={`chip ${(profile.lessonSize ?? DEFAULT_LESSON_SIZE) === option.id ? 'on' : ''}`}
                title={option.description}
                onClick={() => setLessonSize(option.id)}
              >
                {option.title} · {option.limit}
              </button>
            ))}
          </div>
        </div>
        <div className="kv">
          <span>Версия</span>
          <span className="tiny" title="SHA коммита, из которого собрана эта версия — сверяйте с git в разработке">
            v{import.meta.env.VITE_APP_VERSION} ·{' '}
            <span style={{ fontFamily: 'ui-monospace, monospace' }}>{import.meta.env.VITE_BUILD_SHA}</span>
          </span>
        </div>
      </div>

      <button className="vlabs-promo card mb wide" onClick={onOpenVlabs} style={{ textAlign: 'left', cursor: 'pointer' }}>
        <div className="row">
          <span className="vlabs-promo-icon">🧪</span>
          <div className="grow">
            <div className="vlabs-promo-title">Слово2 сделали в V-labs</div>
            <div className="tiny">Школа программирования для детей — создаём игры, а не просто играем. Про Scratch →</div>
          </div>
          <span style={{ fontSize: 22, color: 'var(--primary)', flex: 'none' }}>▸</span>
        </div>
      </button>

      {!isStandalone() && (
        <div className="banner mb">
          📲 <b>Добавить на экран телефона:</b> в браузере «Поделиться» → «На экран Домой». После этого приложение
          открывается как обычное и работает без интернета.
        </div>
      )}

      <ProgressCard profile={profile} />
    </div>
  );
}

/**
 * Сейф прогресса: сохранение, копии, корзина и журнал.
 *
 * Появился после случая «у ребёнка пропал весь прогресс»: раньше у родителя
 * не было ни способа понять, что произошло, ни возможности вернуть удалённое.
 * Всё считается локально — наружу nothing не уходит.
 */
function ProgressCard({ profile }: { profile: Profile }) {
  const settings = useApp((s) => s.settings);
  const vault = useApp((s) => s.vault);
  const { replaceAll, resetProfile, noteExport, restoreSnapshot, restoreTrashed, dropTrashed } = useApp();
  // По полю, а не всем стором: иначе карточка перерисовывалась бы на каждую запись.
  const kind = useStorageHealth((s) => s.kind);
  const lastWriteAt = useStorageHealth((s) => s.lastWriteAt);
  const persisted = useStorageHealth((s) => s.persisted);
  const patchHealth = useStorageHealth((s) => s.patch);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const exportData = () => {
    const data = JSON.stringify(
      { profiles: useApp.getState().profiles, activeId: useApp.getState().activeId, settings },
      null,
      2,
    );
    download(`slovo2-${dayKey()}.json`, data);
    noteExport();
  };

  const importData = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed.profiles)) throw new Error('Нет профилей');
      const was = useApp.getState().profiles.length;
      if (
        !confirm(
          `Заменить текущий прогресс (профилей: ${was}) загруженным (${parsed.profiles.length})? ` +
            `Нынешние профили останутся в корзине на 30 дней.`,
        )
      ) {
        return;
      }
      replaceAll(parsed);
    } catch (e) {
      alert('Не удалось загрузить файл: ' + (e as Error).message);
    }
  };

  const enablePersistence = async () => {
    const ok = await requestPersistence();
    patchHealth({ persisted: ok });
  };

  const snapshots = [...vault.snapshots].sort((a, b) => b.at - a.at);
  const trash = [...vault.trash].sort((a, b) => b.at - a.at);
  const journal = [...vault.log].slice(-12).reverse();
  const exportOverdue = !vault.lastExportAt || Date.now() - vault.lastExportAt > EXPORT_REMINDER_MS;
  const saveState = kind === 'ok' ? 'работает' : kind === 'write-error' ? 'не сохраняется' : 'не открыто';

  return (
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

      {exportOverdue && (
        <div className="banner mt">
          💾 <b>Сделайте копию прогресса.</b> Прогресс живёт только в этом телефоне: без файла
          восстановить будет нечего.
        </div>
      )}

      <div className="kv mt">
        <span>Сохранение</span>
        <b className={kind === 'ok' ? '' : 'warn'}>{saveState}</b>
      </div>
      <div className="kv">
        <span>Последняя запись</span>
        <span className="tiny">{lastWriteAt ? agoLabel(lastWriteAt) : 'ещё не было'}</span>
      </div>
      <div className="kv">
        <span>Защита от очистки</span>
        {persisted === true ? (
          <b>включена</b>
        ) : (
          <button className="btn ghost sm" onClick={() => void enablePersistence()}>
            Включить
          </button>
        )}
      </div>
      {persisted !== true && (
        <p className="tiny">
          Браузер вправе вычистить данные телефона (на iPhone — если приложение не добавлено на экран).
          Добавьте «СЛОВО» на главный экран и нажмите «Включить».
        </p>
      )}

      {snapshots.length > 0 && (
        <div className="mt">
          <h3>Вернуть как было</h3>
          {snapshots.map((s) => (
            <div className="kv" key={s.slot}>
              <span>
                {agoLabel(s.at)}
                <span className="tiny">
                  {' · '}
                  {s.profiles === null ? 'копия нечитаемой записи' : `профилей: ${s.profiles}`}
                </span>
              </span>
              <button
                className="btn ghost sm"
                disabled={busy}
                onClick={() => {
                  if (!confirm('Вернуть состояние из этой копии? Нынешнее останется в копиях.')) return;
                  setBusy(true);
                  void restoreSnapshot(s.slot).then((ok) => {
                    setBusy(false);
                    if (!ok) alert('Копия не читается');
                  });
                }}
              >
                Вернуть
              </button>
            </div>
          ))}
        </div>
      )}

      {trash.length > 0 && (
        <div className="mt">
          <h3>Удалённые профили</h3>
          <p className="tiny">30 дней их можно вернуть целиком — со словами, кристаллами и серией.</p>
          {trash.map((t) => (
            <div className="kv" key={t.at}>
              <span>
                {t.profile.avatar} {t.profile.name}
                <span className="tiny">
                  {' · '}
                  {agoLabel(t.at)} · ⚡ {t.profile.xp}
                </span>
              </span>
              <span className="row">
                <button className="btn ghost sm" onClick={() => restoreTrashed(t.at)}>
                  Вернуть
                </button>
                <button
                  className="chip"
                  aria-label="Удалить окончательно"
                  onClick={() => {
                    if (confirm(`Удалить профиль «${t.profile.name}» окончательно?`)) dropTrashed(t.at);
                  }}
                >
                  🗑
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {journal.length > 0 && (
        <details className="mt">
          <summary className="tiny">Журнал (что происходило с прогрессом)</summary>
          <div className="mt">
            {journal.map((e, i) => (
              <div className="kv" key={`${e.at}-${i}`}>
                <span className="tiny">{new Date(e.at).toLocaleString('ru-RU')}</span>
                <span className="tiny">
                  {LOG_LABEL[e.kind] ?? e.kind}
                  {e.note ? ` · ${e.note}` : ''}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}

      <button
        className="btn danger wide mt"
        onClick={() => {
          if (confirm(`Сбросить весь прогресс ${profile.name}? Прежний профиль останется в корзине на 30 дней.`)) {
            resetProfile(profile.id);
          }
        }}
      >
        Сбросить прогресс
      </button>
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

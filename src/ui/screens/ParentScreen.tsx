import { useMemo, useState } from 'react';
import { useActiveProfile } from '../../state/store';
import { OverviewTab } from '../parent/OverviewTab';
import { ProgressTab } from '../parent/ProgressTab';
import { SettingsTab } from '../parent/SettingsTab';
import { AppTab } from '../parent/AppTab';
import { SupportDeveloper } from '../SupportDeveloper';
import { ListsTab } from '../parent/ListsTab';
import { PARENT_TABS, ParentPanel, ParentTabs, type ParentTabId } from '../parent/ParentBits';

interface Props {
  unlocked: boolean;
  onUnlock: () => void;
  onOpenProfiles: () => void;
  onOpenVlabs: () => void;
  onOpenDiagnostics: (section: ParentTabId) => void;
  /** Вернуться в тот же раздел после диагностики, открытой из ярлыка. */
  initialTab?: ParentTabId;
  /** Открыть вкладку «Слова» (из обзора — «посмотреть все слова») */
  onOpenWords: () => void;
  /** Списки к контрольной (0.58.0): тренировка, контроль, ошибки. */
  onStartList: (listId: string, mode?: 'train' | 'check' | 'errors') => void;
}

/**
 * Раздел «Родителям».
 *
 * Раньше это была одна длинная простыня: профиль, статистика, календарь,
 * достижения, восемь настроек, сейф прогресса с корзиной и журналом, реклама и
 * версия — всё подряд одним столбцом. Родитель приходил с конкретным вопросом
 * («занимается ли?», «где ссылка для бабушки?», «как убрать сову?») и тонул в
 * чужом контенте.
 *
 * Четыре коротких входа, чтобы на телефоне не перегружать навигацию:
 *  📊 Обучение — состояние слов и подробный отчёт;
 *  🏫 Списки — подготовка к школьной контрольной;
 *  ⚙️ Настройки — класс, размер урока и подсказки;
 *  ⋯ Ещё — резервные копии, ссылка, установка и версия приложения.
 *
 * Замок «только для взрослых» остался (это бытовой барьер, а не защита), но
 * стал честнее: ошибка показывается на месте, ответ не стирается, Enter
 * отправляет форму.
 */
export function ParentScreen({ unlocked, onUnlock, onOpenProfiles, onOpenVlabs, onOpenDiagnostics, initialTab = 'overview', onOpenWords, onStartList }: Props) {
  const profile = useActiveProfile();
  const [tab, setTab] = useState<ParentTabId>(initialTab === 'app' || initialTab === 'progress' ? 'more' : initialTab);
  const [moreSection, setMoreSection] = useState<'progress' | 'app'>(initialTab === 'app' ? 'app' : 'progress');
  const moveMoreSection = (delta: number) => {
    const next = moreSection === 'progress'
      ? delta > 0 ? 'app' : 'progress'
      : delta < 0 ? 'progress' : 'app';
    setMoreSection(next);
    document.getElementById(`parent-more-tab-${next}`)?.focus();
  };

  if (!profile) return null;

  if (!unlocked) {
    return <UnlockGate onUnlock={onUnlock} />;
  }

  return (
    <div className="screen parent-screen">
      <div className="parent-head">
        <h1>Родителям</h1>
        <button className="btn ghost sm" onClick={onOpenProfiles}>
          👨‍👩‍👧 Дети
        </button>
      </div>

      <div className="parent-child">
        <div className="avatar" style={{ cursor: 'default' }}>
          {profile.avatar}
        </div>
        <div className="parent-child-name grow">{profile.name}</div>
      </div>

      <SupportDeveloper />

      <ParentTabs items={PARENT_TABS} value={tab} onChange={setTab} />

      {tab === 'overview' && (
        <ParentPanel id="overview">
          <OverviewTab profile={profile} onOpenWords={onOpenWords} />
        </ParentPanel>
      )}
      {tab === 'lists' && (
        <ParentPanel id="lists">
          <ListsTab profile={profile} onTrain={onStartList} />
        </ParentPanel>
      )}
      {tab === 'settings' && (
        <ParentPanel id="settings">
          <SettingsTab profile={profile} onOpenDiagnostics={() => onOpenDiagnostics('settings')} />
        </ParentPanel>
      )}
      {tab === 'more' && (
        <ParentPanel id="more">
          <div className="parent-stack">
            <div className="parent-more-tabs" role="tablist" aria-label="Дополнительные разделы">
              <button type="button" role="tab" id="parent-more-tab-progress" tabIndex={moreSection === 'progress' ? 0 : -1} aria-selected={moreSection === 'progress'} aria-controls="parent-more-panel-progress" className={`choice-item ${moreSection === 'progress' ? 'on' : ''}`} onClick={() => setMoreSection('progress')} onKeyDown={(event) => { if (event.key === 'ArrowRight') { event.preventDefault(); moveMoreSection(1); } }}>💾 Данные</button>
              <button type="button" role="tab" id="parent-more-tab-app" tabIndex={moreSection === 'app' ? 0 : -1} aria-selected={moreSection === 'app'} aria-controls="parent-more-panel-app" className={`choice-item ${moreSection === 'app' ? 'on' : ''}`} onClick={() => setMoreSection('app')} onKeyDown={(event) => { if (event.key === 'ArrowLeft') { event.preventDefault(); moveMoreSection(-1); } }}>📲 Приложение</button>
            </div>
            {moreSection === 'progress' ? (
              <section role="tabpanel" id="parent-more-panel-progress" aria-labelledby="parent-more-tab-progress">
                <ProgressTab profile={profile} />
              </section>
            ) : (
              <section role="tabpanel" id="parent-more-panel-app" aria-labelledby="parent-more-tab-app">
                <AppTab onOpenVlabs={onOpenVlabs} onOpenDiagnostics={() => onOpenDiagnostics('app')} />
              </section>
            )}
          </div>
        </ParentPanel>
      )}
    </div>
  );
}

/**
 * Замок «только для взрослых»: пример на умножение.
 *
 * Важно, чтобы барьер не превращался в наказание:
 *  • Enter отправляет ответ (родитель печатает с клавиатуры);
 *  • ошибка объясняется на месте и ответ остаётся в поле — можно поправить;
 *  • никогда не блокируем насовсем: новый пример выдаётся сразу.
 */
function UnlockGate({ onUnlock }: { onUnlock: () => void }) {
  const [a, b] = useMemo(() => [2 + Math.floor(Math.random() * 8), 2 + Math.floor(Math.random() * 8)], []);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState(false);
  const [misses, setMisses] = useState(0);

  const submit = () => {
    if (Number(answer) === a * b) {
      onUnlock();
      return;
    }
    setError(true);
    setMisses((n) => n + 1);
    setAnswer('');
  };

  return (
    <div className="screen center">
      <div className="big-emoji">🔐</div>
      <h1>Раздел для взрослых</h1>
      <p className="muted">Решите пример, чтобы войти.</p>
      <div className="unlock-task">
        {a} × {b} = ?
      </div>
      <input
        className={`input ${error ? 'input-error' : ''}`}
        inputMode="numeric"
        value={answer}
        autoFocus
        onChange={(e) => {
          setAnswer(e.target.value.replace(/\D/g, ''));
          setError(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && answer) submit();
        }}
        placeholder="ответ"
        aria-label={`Сколько будет ${a} умножить на ${b}`}
        aria-invalid={error}
      />
      {error && (
        <div className="unlock-error" role="alert">
          Неверно. Попробуйте ещё раз{misses >= 2 ? ' или посчитайте столбиком' : ''}
        </div>
      )}
      <button className="btn primary wide lg mt" disabled={!answer} onClick={submit}>
        Войти
      </button>
    </div>
  );
}

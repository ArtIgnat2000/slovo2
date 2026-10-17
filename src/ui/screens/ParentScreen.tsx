import { useMemo, useState } from 'react';
import { useActiveProfile } from '../../state/store';
import { OverviewTab } from '../parent/OverviewTab';
import { ProgressTab } from '../parent/ProgressTab';
import { SettingsTab } from '../parent/SettingsTab';
import { AppTab } from '../parent/AppTab';
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
 * Теперь это четыре раздела по вопросам, которые задают на самом деле
 * (принцип «один экран — одна работа», см. docs/parent-section-redesign.md):
 *  📊 Обзор     — как дела у ребёнка;
 *  💾 Прогресс  — файл выгрузки, копии, корзина, сброс (всё про сохранность);
 *  ⚙️ Настройки — как ребёнок занимается: цель, размер урока, подсказки, звук, вид;
 *  📲 Приложение — передать ссылку, поставить на экран, версия, V-labs.
 *
 * Замок «только для взрослых» остался (это бытовой барьер, а не защита), но
 * стал честнее: ошибка показывается на месте, ответ не стирается, Enter
 * отправляет форму.
 */
export function ParentScreen({ unlocked, onUnlock, onOpenProfiles, onOpenVlabs, onOpenDiagnostics, initialTab = 'overview', onOpenWords }: Props) {
  const profile = useActiveProfile();
  const [tab, setTab] = useState<ParentTabId>(initialTab);

  if (!profile) return null;

  if (!unlocked) {
    return <UnlockGate onUnlock={onUnlock} />;
  }

  return (
    <div className="screen parent-screen">
      <div className="parent-head">
        <div>
          <h1>Родителям</h1>
          <div className="setting-hint">Здесь всё про занятия, сохранность и настройки</div>
        </div>
        <button className="btn ghost sm" onClick={onOpenProfiles}>
          👨‍👩‍👧 Дети
        </button>
      </div>

      <div className="parent-child">
        <div className="avatar" style={{ cursor: 'default' }}>
          {profile.avatar}
        </div>
        <div className="grow">
          <div className="parent-child-name">{profile.name}</div>
          <div className="setting-hint">
            Прогресс этого профиля · с {new Date(profile.createdAt).toLocaleDateString('ru-RU')}
          </div>
        </div>
      </div>

      <ParentTabs items={PARENT_TABS} value={tab} onChange={setTab} />

      {tab === 'overview' && (
        <ParentPanel id="overview">
          <OverviewTab profile={profile} onOpenWords={onOpenWords} onOpenSection={setTab} />
        </ParentPanel>
      )}
      {tab === 'progress' && (
        <ParentPanel id="progress">
          <ProgressTab profile={profile} />
        </ParentPanel>
      )}
      {tab === 'settings' && (
        <ParentPanel id="settings">
          <SettingsTab profile={profile} onOpenDiagnostics={() => onOpenDiagnostics('settings')} />
        </ParentPanel>
      )}
      {tab === 'app' && (
        <ParentPanel id="app">
          <AppTab onOpenVlabs={onOpenVlabs} onOpenDiagnostics={() => onOpenDiagnostics('app')} />
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
      <p className="muted">Решите пример, чтобы войти: здесь настройки и данные о прогрессе.</p>
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
          Не подходит — попробуйте ещё раз{misses >= 2 ? ' (подсказка: умножьте столбиком)' : ''}
        </div>
      )}
      <button className="btn primary wide lg mt" disabled={!answer} onClick={submit}>
        Войти
      </button>
    </div>
  );
}

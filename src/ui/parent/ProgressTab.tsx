// Данные профиля: резервная копия и состояние сохранения видны сразу.
// Восстановление, журнал и сброс раскрываются только по запросу.

import { useRef, useState } from 'react';
import type { Profile } from '../../types';
import { agoLabel, EXPORT_REMINDER_MS, LOG_LABEL } from '../../engine/vault';
import { dayKey, useApp } from '../../state/store';
import { useStorageHealth } from '../../state/health';
import { download, requestPersistence } from '../../platform/storage';
import { GroupTitle } from './ParentBits';

export function ProgressTab({ profile }: { profile: Profile }) {
  const settings = useApp((state) => state.settings);
  const vault = useApp((state) => state.vault);
  const {
    replaceAll,
    resetGems,
    resetProfile,
    noteExport,
    restoreSnapshot,
    restorePurchaseArchive,
    restoreTrashed,
    dropTrashed,
  } = useApp();
  const kind = useStorageHealth((state) => state.kind);
  const lastWriteAt = useStorageHealth((state) => state.lastWriteAt);
  const persisted = useStorageHealth((state) => state.persisted);
  const patchHealth = useStorageHealth((state) => state.patch);
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
      const currentCount = useApp.getState().profiles.length;
      if (!confirm(
        `Заменить текущие профили (${currentCount}) профилями из файла (${parsed.profiles.length})? ` +
        'Текущие профили останутся в корзине на 30 дней.',
      )) return;
      replaceAll(parsed);
    } catch (error) {
      alert('Не удалось загрузить файл: ' + (error as Error).message);
    }
  };

  const enablePersistence = async () => {
    const ok = await requestPersistence();
    patchHealth({ persisted: ok });
  };

  const snapshots = [...vault.snapshots].sort((a, b) => b.at - a.at);
  const purchase = vault.purchase;
  const trash = [...vault.trash].sort((a, b) => b.at - a.at);
  const journal = [...vault.log].slice(-12).reverse();
  const exportOverdue = !vault.lastExportAt || Date.now() - vault.lastExportAt > EXPORT_REMINDER_MS;
  const saveState = kind === 'ok' ? 'работает' : kind === 'write-error' ? 'ошибка' : 'не проверено';
  const hasRecovery = !!purchase || snapshots.length > 0 || trash.length > 0 || journal.length > 0;

  return (
    <div className="parent-stack">
      <div className="card">
        <GroupTitle title="Резервная копия" />
        <div className="row">
          <button className="btn ghost grow" onClick={exportData}>⬇️ Сохранить файл</button>
          <button className="btn ghost grow" onClick={() => fileRef.current?.click()}>⬆️ Загрузить файл</button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importData(file);
            event.target.value = '';
          }}
        />
        <div className="kv mt">
          <span>Последняя копия</span>
          <span className="setting-hint">{vault.lastExportAt ? agoLabel(vault.lastExportAt) : 'не делали'}</span>
        </div>
        {exportOverdue && (
          <div className="banner mt">💾 Сохраните файл: прогресс хранится на этом устройстве.</div>
        )}
      </div>

      <div className="card">
        <GroupTitle title="Сохранение" />
        <div className="kv">
          <span>Запись прогресса</span>
          <b className={kind === 'ok' ? '' : 'warn'}>{saveState}</b>
        </div>
        <div className="kv">
          <span>Последняя запись</span>
          <span className="setting-hint">{lastWriteAt ? agoLabel(lastWriteAt) : 'ещё не было'}</span>
        </div>
        <div className="kv">
          <span>Защита от очистки</span>
          {persisted === true ? (
            <b>включена</b>
          ) : (
            <button className="btn ghost sm" onClick={() => void enablePersistence()}>Включить</button>
          )}
        </div>
        {persisted !== true && (
          <p className="setting-hint">Добавьте приложение на главный экран и включите защиту.</p>
        )}
      </div>

      <details className="card parent-data-details">
        <summary className="parent-summary">Восстановление</summary>
        <div className="parent-data-body mt">
          {!hasRecovery && <p className="setting-hint">Копии появятся после изменений и покупок.</p>}

          {purchase && (
            <div className="parent-data-group">
              <div className="setting-title">До покупки «{purchase.label}»</div>
              <div className="kv">
                <span className="setting-hint">{agoLabel(purchase.at)} · 💎 {purchase.gemsBefore} → {purchase.gemsAfter}</span>
                <button
                  className="btn ghost sm"
                  disabled={busy}
                  onClick={() => {
                    if (!confirm(
                      `Вернуть состояние до покупки «${purchase.label}»? ` +
                      `Вернутся ${purchase.gemsBefore} 💎, а покупка исчезнет.`,
                    )) return;
                    setBusy(true);
                    void restorePurchaseArchive().then((ok) => {
                      setBusy(false);
                      if (!ok) alert('Копия не читается');
                    });
                  }}
                >
                  Вернуть
                </button>
              </div>
            </div>
          )}

          {snapshots.length > 0 && (
            <div className="parent-data-group">
              <div className="setting-title">Автоматические копии</div>
              {snapshots.map((snapshot) => (
                <div className="kv" key={snapshot.slot}>
                  <span>
                    {agoLabel(snapshot.at)}
                    <span className="setting-hint">
                      {' · '}{snapshot.profiles === null ? 'не читается' : `${snapshot.profiles} проф.`}
                    </span>
                  </span>
                  <button
                    className="btn ghost sm"
                    disabled={busy}
                    onClick={() => {
                      if (!confirm('Вернуть эту копию? Текущее состояние тоже сохранится.')) return;
                      setBusy(true);
                      void restoreSnapshot(snapshot.slot).then((ok) => {
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
            <div className="parent-data-group">
              <div className="setting-title">Корзина</div>
              {trash.map((item, index) => (
                <div className="kv" key={`${item.at}-${index}`}>
                  <span>
                    {item.profile.avatar} {item.profile.name}
                    <span className="setting-hint">
                      {' · '}{agoLabel(item.at)}{item.reason === 'gems-reset' ? ' · до обнуления кристаллов' : ''}
                    </span>
                  </span>
                  <span className="row">
                    <button
                      className="btn ghost sm"
                      onClick={() => {
                        if (
                          item.reason === 'gems-reset' &&
                          !confirm(
                            `Вернуть профиль «${item.profile.name}» к состоянию до обнуления кристаллов? ` +
                            'Текущий прогресс этого профиля будет заменён.',
                          )
                        ) return;
                        restoreTrashed(item.at);
                      }}
                    >
                      Вернуть
                    </button>
                    <button
                      className="chip"
                      aria-label={`Удалить копию профиля ${item.profile.name} окончательно`}
                      onClick={() => {
                        if (confirm(`Удалить копию профиля «${item.profile.name}» окончательно?`)) dropTrashed(item.at);
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
            <details>
              <summary className="parent-summary">Журнал</summary>
              <div className="mt">
                {journal.map((entry, index) => (
                  <div className="kv" key={`${entry.at}-${index}`}>
                    <span className="setting-hint">{new Date(entry.at).toLocaleString('ru-RU')}</span>
                    <span className="setting-hint">
                      {LOG_LABEL[entry.kind] ?? entry.kind}{entry.note ? ` · ${entry.note}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </details>

      <details className="card danger-zone parent-data-details">
        <summary className="parent-summary">Сброс данных</summary>
        <div className="parent-data-body mt">
          <div className="parent-data-group">
            <div className="setting-title">Кристаллы · {profile.gems} 💎</div>
            <p className="setting-hint">слова, XP, серия и покупки сохранятся.</p>
            <button
              className="btn danger wide"
              disabled={profile.gems === 0}
              onClick={() => {
                if (confirm(
                  `Обнулить ${profile.gems} 💎 у профиля «${profile.name}»? ` +
                  'Слова, XP, серия и покупки сохранятся.',
                )) {
                  resetGems(profile.id);
                }
              }}
            >
              Обнулить кристаллы
            </button>
          </div>

          <div className="parent-data-group">
            <div className="setting-title">Начать заново</div>
            <p className="setting-hint">
              Слова, XP, кристаллы, серия и покупки обнулятся. Профиль останется в корзине 30 дней.
            </p>
            <button
              className="btn danger wide"
              onClick={() => {
                if (confirm(
                  `Сбросить весь прогресс профиля «${profile.name}», включая кристаллы и покупки? ` +
                  'Прежняя версия останется в корзине на 30 дней.',
                )) resetProfile(profile.id);
              }}
            >
              Сбросить прогресс
            </button>
          </div>
        </div>
      </details>
    </div>
  );
}

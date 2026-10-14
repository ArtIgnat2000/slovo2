// «Прогресс» — раздел про сохранность: файл выгрузки, здоровье записи, копии,
// корзина, журнал и сброс. Появился после случая «у ребёнка пропал прогресс»:
// родителю нужен не только отчёт, но и способ вернуть всё назад.
//
// Раскладка сделана так, чтобы разрушительное действие было последним и
// отдельным: «Сбросить» живёт в конце, под предупреждением, и требует
// подтверждения. Всё считается локально — наружу ничего не уходит.

import { useRef, useState } from 'react';
import type { Profile } from '../../types';
import { agoLabel, EXPORT_REMINDER_MS, LOG_LABEL } from '../../engine/vault';
import { dayKey, useApp } from '../../state/store';
import { useStorageHealth } from '../../state/health';
import { download, requestPersistence } from '../../platform/storage';
import { GroupTitle } from './ParentBits';

export function ProgressTab({ profile }: { profile: Profile }) {
  const settings = useApp((s) => s.settings);
  const vault = useApp((s) => s.vault);
  const { replaceAll, resetProfile, noteExport, restoreSnapshot, restoreTrashed, dropTrashed } = useApp();
  // Подписка на поля по отдельности: иначе карточка перерисовывалась бы на каждую запись.
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
    <div className="parent-stack">
      <div className="card">
        <GroupTitle
          title="Копия прогресса"
          hint="Файл можно сохранить и перенести на другой телефон или вернуть через него всё назад."
        />
        <div className="row">
          <button className="btn ghost grow" onClick={exportData}>
            ⬇️ Сохранить файл
          </button>
          <button className="btn ghost grow" onClick={() => fileRef.current?.click()}>
            ⬆️ Загрузить файл
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
        <div className="kv mt">
          <span>Последняя копия</span>
          <span className="setting-hint">
            {vault.lastExportAt ? agoLabel(vault.lastExportAt) : 'ни разу не делали'}
          </span>
        </div>
        {exportOverdue && (
          <div className="banner mt">
            💾 <b>Сделайте копию прогресса.</b> Прогресс живёт только в этом телефоне: без файла
            восстановить будет нечего.
          </div>
        )}
      </div>

      <div className="card">
        <GroupTitle title="Сохранность" hint="Проверяем, что запись действительно идёт, и просим браузер её не чистить." />
        <div className="kv">
          <span>Сохранение</span>
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
            <button className="btn ghost sm" onClick={() => void enablePersistence()}>
              Включить
            </button>
          )}
        </div>
        {persisted !== true && (
          <p className="setting-hint">
            Браузер вправе вычистить данные телефона (на iPhone — если приложение не добавлено на экран).
            Добавьте «СЛОВО» на главный экран и нажмите «Включить».
          </p>
        )}
      </div>

      {snapshots.length > 0 && (
        <div className="card">
          <GroupTitle title="Вернуть как было" hint="Автоматические копии: три последних состояния записи." />
          {snapshots.map((s) => (
            <div className="kv" key={s.slot}>
              <span>
                {agoLabel(s.at)}
                <span className="setting-hint">
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
        <div className="card">
          <GroupTitle title="Удалённые профили" hint="30 дней их можно вернуть целиком — со словами, кристаллами и серией." />
          {/* Ключ с индексом: два профиля могут попасть в корзину в одну миллисекунду,
              и тогда одинаковые ключи в списке ломали бы перерисовку. */}
          {trash.map((t, index) => (
            <div className="kv" key={`${t.at}-${index}`}>
              <span>
                {t.profile.avatar} {t.profile.name}
                <span className="setting-hint">
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
                  aria-label={`Удалить профиль ${t.profile.name} окончательно`}
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
        <div className="card">
          <details>
            <summary className="parent-summary">Журнал: что происходило с прогрессом</summary>
            <div className="mt">
              {journal.map((e, i) => (
                <div className="kv" key={`${e.at}-${i}`}>
                  <span className="setting-hint">{new Date(e.at).toLocaleString('ru-RU')}</span>
                  <span className="setting-hint">
                    {LOG_LABEL[e.kind] ?? e.kind}
                    {e.note ? ` · ${e.note}` : ''}
                  </span>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      <div className="card danger-zone">
        <GroupTitle
          title="Начать заново"
          hint={`Сброс прогресса ${profile.name}: слова, XP, кристаллы и серия обнулятся. Профиль останется в корзине 30 дней — его можно вернуть в разделе выше.`}
        />
        <button
          className="btn danger wide"
          onClick={() => {
            if (confirm(`Сбросить весь прогресс ${profile.name}? Прежний профиль останется в корзине на 30 дней.`)) {
              resetProfile(profile.id);
            }
          }}
        >
          Сбросить прогресс
        </button>
      </div>
    </div>
  );
}

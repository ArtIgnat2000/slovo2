/**
 * Экран «прогресс не удалось открыть» и баннер «прогресс не сохраняется».
 *
 * Раньше сбой чтения был неотличим от первого запуска: приложение молча
 * показывало «Пока нет ни одного ученика», и первое же действие ребёнка
 * затирало старую запись. Теперь чтение либо подтверждено, либо мы честно
 * говорим о проблеме и держим запись замороженной.
 */
import { useRef, useState } from 'react';
import { useApp } from '../state/store';
import { useStorageHealth } from '../state/health';
import { agoLabel } from '../engine/vault';

export function StorageScreen() {
  const message = useStorageHealth((s) => s.message);
  const { vault, restoreSnapshot, retryHydration, freshStart, replaceAll } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [confirmFresh, setConfirmFresh] = useState(false);

  const snapshots = [...vault.snapshots].sort((a, b) => b.at - a.at);

  const importFile = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed.profiles)) throw new Error('В файле нет профилей');
      replaceAll(parsed);
    } catch (e) {
      alert('Не удалось загрузить файл: ' + (e as Error).message);
    }
  };

  const retry = async () => {
    setBusy(true);
    await retryHydration();
    setBusy(false);
  };

  const restore = async (slot: number) => {
    setBusy(true);
    const ok = await restoreSnapshot(slot);
    setBusy(false);
    if (!ok) alert('Копия не читается — попробуйте другую или файл выгрузки');
  };

  return (
    <div className="screen center">
      <div className="big-emoji">💾</div>
      <h1>Прогресс не удалось открыть</h1>
      <p className="muted">
        Мы ничего не стёрли: сохранение осталось в телефоне, просто прочитать его пока не получается.
        Пока запись не открыта, приложение ничего не пишет поверх — старый прогресс не пропадёт.
      </p>

      {message && <p className="tiny muted">{message}</p>}

      <button className="btn primary wide lg mt" disabled={busy} onClick={() => void retry()}>
        Попробовать снова
      </button>

      <button className="btn ghost wide mt" onClick={() => fileRef.current?.click()}>
        ⬆️ Загрузить копию из файла
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importFile(f);
          e.target.value = '';
        }}
      />

      {snapshots.length > 0 && (
        <div className="card mt wide">
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
              <button className="btn ghost sm" disabled={busy} onClick={() => void restore(s.slot)}>
                Вернуть
              </button>
            </div>
          ))}
        </div>
      )}

      {confirmFresh ? (
        <div className="card mt wide">
          <h3>Начать заново?</h3>
          <p className="tiny">
            Нынешнее сохранение останется в копии «{agoLabel(Date.now())}» — удалить его можно будет
            позже в разделе «Родителям». Новый прогресс запишется поверх.
          </p>
          <button
            className="btn danger wide"
            onClick={() => {
              freshStart();
              setConfirmFresh(false);
            }}
          >
            Да, начать заново
          </button>
          <button className="btn ghost wide mt" onClick={() => setConfirmFresh(false)}>
            Отмена
          </button>
        </div>
      ) : (
        <button className="btn ghost wide mt" onClick={() => setConfirmFresh(true)}>
          Начать заново
        </button>
      )}
    </div>
  );
}

/**
 * Баннер о сбое записи. Показываем всегда, когда запись не проходит: иначе
 * ребёнок занимается «впустую» и теряет всё, что заработал после сбоя.
 */
export function StorageBanner() {
  const kind = useStorageHealth((s) => s.kind);
  const message = useStorageHealth((s) => s.message);
  const retrySave = useApp((s) => s.retrySave);
  if (kind !== 'write-error') return null;
  return (
    <div className="banner danger-banner">
      <b>Прогресс не сохраняется.</b> {message ?? 'Браузер отказал в записи.'}
      <button className="btn ghost sm" onClick={retrySave}>
        Попробовать снова
      </button>
    </div>
  );
}

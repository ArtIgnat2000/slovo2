import { useCallback, useEffect, useState } from 'react';
import { inspectStorage, type StorageDiagnosticReport } from '../platform/diagnostics';
import { useStorageHealth } from '../state/health';

interface Props {
  onClose: () => void;
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return 'неизвестно';
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} МБ`;
}

function formatDate(at: number | null): string {
  return at === null ? 'дата неизвестна' : new Date(at).toLocaleString('ru-RU');
}

function persistenceLabel(value: boolean | null): string {
  if (value === true) return 'включено';
  if (value === false) return 'не включено';
  return 'браузер не сообщил';
}

function recordLabel(status: StorageDiagnosticReport['record']['status']): string {
  if (status === 'present') return 'найдена и читается';
  if (status === 'missing') return 'не найдена';
  if (status === 'corrupt') return 'найдена, формат не распознан';
  return 'не удалось прочитать';
}

function reportText(report: StorageDiagnosticReport, health: string): string {
  const record = report.record;
  const snapshots = report.snapshots
    .filter((snapshot) => snapshot.present || snapshot.at !== null || snapshot.error)
    .map((snapshot) => {
      const status = snapshot.error ? `ошибка чтения: ${snapshot.error}` : snapshot.present ? 'есть' : 'запись не найдена';
      return `  копия ${snapshot.slot}: ${status}; ${formatDate(snapshot.at)}; ${formatBytes(snapshot.bytes)}; профилей: ${snapshot.profiles ?? '—'}`;
    });
  return [
    `СЛОВО 2.0 · v${import.meta.env.VITE_APP_VERSION} · ${import.meta.env.VITE_BUILD_SHA}`,
    `Проверка: ${formatDate(report.checkedAt)}`,
    `IndexedDB: ${report.indexedDbAvailable ? 'доступна' : `ошибка (${report.indexedDbError ?? 'неизвестно'})`}`,
    `Запись прогресса: ${recordLabel(record.status)}; ${formatBytes(record.bytes)}`,
    `В записи: профилей ${record.profiles ?? '—'}, слов ${record.words ?? '—'}, XP ${record.xp ?? '—'}`,
    `Постоянное хранилище: ${persistenceLabel(report.persisted)}`,
    `Состояние приложения: ${health}`,
    ...snapshots,
  ].join('\n');
}

export function DiagnosticsScreen({ onClose }: Props) {
  const [report, setReport] = useState<StorageDiagnosticReport | null>(null);
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState('');
  const [copyText, setCopyText] = useState('');
  const health = useStorageHealth((s) => s.kind);
  const lastWriteAt = useStorageHealth((s) => s.lastWriteAt);
  const hydratedAt = useStorageHealth((s) => s.hydratedAt);
  const blockedWrites = useStorageHealth((s) => s.blockedWrites);

  const refresh = useCallback(async () => {
    setChecking(true);
    setNotice('');
    try {
      setReport(await inspectStorage());
    } catch (error) {
      setNotice(`Не удалось завершить проверку: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const copySummary = async () => {
    if (!report) return;
    const text = reportText(report, health);
    setCopyText(text);
    try {
      await navigator.clipboard.writeText(text);
      setNotice('Сводка скопирована. Она не содержит имён и не отправляется автоматически.');
    } catch {
      setNotice('Автокопирование недоступно — разверните сводку ниже и скопируйте её вручную.');
    }
  };

  const visibleSnapshots = report?.snapshots.filter((snapshot) =>
    snapshot.present || snapshot.at !== null || snapshot.error,
  ) ?? [];

  return (
    <main className="screen diag-screen">
      <div className="row mb">
        <h1 className="grow" style={{ margin: 0 }}>Диагностика сохранения</h1>
        <button className="btn ghost sm" onClick={onClose}>Закрыть</button>
      </div>
      <p className="muted mb">
        Проверка только читает состояние на этом устройстве: данные не меняются и никуда не отправляются.
      </p>

      <section className="card mb" aria-label="Состояние хранилища">
        <h2>Хранилище</h2>
        {!report && checking ? <p role="status">Проверяем IndexedDB…</p> : null}
        {report && (
          <>
            <div className="kv">
              <span>IndexedDB</span>
              <b className={report.indexedDbAvailable ? 'diag-ok' : 'diag-error'}>
                {report.indexedDbAvailable ? 'доступна' : 'ошибка чтения'}
              </b>
            </div>
            {report.indexedDbError && <p className="tiny diag-error">{report.indexedDbError}</p>}
            <div className="kv">
              <span>Запись прогресса</span>
              <b>{recordLabel(report.record.status)}</b>
            </div>
            <div className="kv">
              <span>Размер записи</span>
              <b>{formatBytes(report.record.bytes)}</b>
            </div>
            {report.record.status === 'present' && (
              <div className="kv">
                <span>В записи</span>
                <b>{report.record.profiles} проф. · {report.record.words} слов · {report.record.xp} XP</b>
              </div>
            )}
            <div className="kv">
              <span>Постоянное хранилище</span>
              <b className={report.persisted === true ? 'diag-ok' : report.persisted === false ? 'diag-warn' : ''}>
                {persistenceLabel(report.persisted)}
              </b>
            </div>
            {(report.usage !== null || report.quota !== null) && (
              <div className="kv">
                <span>Занято / доступно по оценке браузера</span>
                <b>{formatBytes(report.usage)} / {formatBytes(report.quota)}</b>
              </div>
            )}
          </>
        )}
      </section>

      <section className="card mb" aria-label="Резервные копии">
        <h2>Резервные копии</h2>
        {visibleSnapshots.length === 0 ? (
          <p className="tiny">Снимков пока нет.</p>
        ) : (
          <div className="diag-snapshots">
            {visibleSnapshots.map((snapshot) => (
              <div className="diag-snapshot" key={snapshot.slot}>
                <b>Копия {snapshot.slot}</b>
                <span>{snapshot.error ? 'ошибка чтения' : snapshot.present ? 'есть' : 'запись не найдена'}</span>
                <span>{formatDate(snapshot.at)}</span>
                <span>{formatBytes(snapshot.bytes)}{snapshot.profiles === null ? '' : ` · ${snapshot.profiles} проф.`}</span>
                {snapshot.error && <span className="diag-error">{snapshot.error}</span>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card mb" aria-label="Версия приложения">
        <h2>Приложение</h2>
        <div className="kv">
          <span>Сборка</span>
          <b>v{import.meta.env.VITE_APP_VERSION} · <code>{import.meta.env.VITE_BUILD_SHA}</code></b>
        </div>
        <div className="kv">
          <span>Статус чтения при запуске</span>
          <b>{health}</b>
        </div>
        <div className="kv">
          <span>Последняя запись в этой сессии</span>
          <b>{formatDate(lastWriteAt)}</b>
        </div>
        <div className="kv">
          <span>Последнее чтение при запуске</span>
          <b>{formatDate(hydratedAt)}</b>
        </div>
        <div className="kv">
          <span>Записи, остановленные защитой</span>
          <b>{blockedWrites}</b>
        </div>
      </section>

      <button className="btn primary wide mb" onClick={() => void refresh()} disabled={checking}>
        {checking ? 'Проверяем…' : 'Перепроверить'}
      </button>
      <button className="btn ghost wide mb" onClick={() => void copySummary()} disabled={!report}>
        Скопировать сводку
      </button>
      {notice && <p className="tiny diag-notice" role="status">{notice}</p>}
      {copyText && (
        <details className="card diag-copy">
          <summary>Сводка для отправки вручную</summary>
          <pre>{copyText}</pre>
        </details>
      )}
      {report && <p className="tiny center">Проверено: {formatDate(report.checkedAt)}</p>}
    </main>
  );
}

// Ручная проверка обновлений (0.26.0).
//
// Обычно приложение само узнаёт о новой сборке при запуске и показывает плашку
// «Доступно обновление». Но установленный на телефон ярлык может неделями не
// закрываться: родитель остаётся на старой версии и не понимает, почему на
// сайте номер другой. Кнопка здесь спрашивает сервис-воркер вручную и честно
// различает «последняя версия», «есть новая», «нет сети» и «здесь проверить
// нельзя» — обещать «обновлений нет», когда проверить не удалось, нельзя.

import { useEffect, useRef, useState } from 'react';
import { applyUpdate, checkForUpdate, type UpdateCheckResult } from '../../platform/pwa';

type Phase = 'idle' | 'checking' | 'applying';

export function UpdateCheck() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<UpdateCheckResult | null>(null);
  /** Проверка идёт секунды: если родитель уже ушёл со вкладки, не пишем в размонтированный компонент. */
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const run = async () => {
    if (phase !== 'idle') return;
    setResult(null);
    setPhase('checking');
    const next = await checkForUpdate();
    if (!alive.current) return;
    setResult(next);
    setPhase('idle');
  };

  const apply = () => {
    setPhase('applying');
    applyUpdate();
  };

  const checking = phase === 'checking';
  const applying = phase === 'applying';

  return (
    <div className="update-check">
      <div className="update-actions">
        <button type="button" className="btn ghost sm" onClick={() => void run()} disabled={phase !== 'idle'}>
          {checking ? 'Проверяем…' : 'Проверить обновления'}
        </button>
      </div>
      <div className="update-status" role="status">
        {checking && <p className="setting-hint">Проверяем…</p>}
        {result && !checking && <UpdateStatus result={result} applying={applying} onApply={apply} />}
      </div>
    </div>
  );
}

function UpdateStatus({
  result,
  applying,
  onApply,
}: {
  result: UpdateCheckResult;
  applying: boolean;
  onApply: () => void;
}) {
  switch (result.status) {
    case 'current':
      return (
        <p className="setting-hint">✅ Установлена последняя версия.</p>
      );
    case 'available':
      return (
        <div className="update-available">
          <p className="setting-hint"><b>Доступно обновление.</b></p>
          <button type="button" className="btn primary sm" onClick={onApply} disabled={applying}>
            {applying ? 'Обновляем…' : 'Обновить сейчас'}
          </button>
        </div>
      );
    case 'offline':
      return (
        <p className="setting-hint">📴 Нет интернета.</p>
      );
    case 'unavailable':
      return (
        <p className="setting-hint">В этой копии проверка недоступна.</p>
      );
    case 'error':
      return (
        <p className="setting-hint">⚠️ Не удалось проверить. Попробуйте ещё раз.</p>
      );
  }
}

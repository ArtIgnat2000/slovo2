import { useEffect, useMemo, useState } from 'react';
import { qrEncode } from '../engine/qr';
import {
  appUrl,
  canNativeShare,
  copyAppLink,
  linkLabel,
  shareApp,
  type ShareOutcome,
} from '../platform/share';
import { QrImage } from './QrCode';

interface Props {
  /** Короткий вид — для экрана «Кто будет учиться?», без пошаговой инструкции */
  compact?: boolean;
}

/**
 * «Передать приложение» (обратная связь 2026-10-14: непонятно, как поделиться
 * ссылкой с новым учеником).
 *
 * Что даём взрослому: QR-код (показать с телефона — второй родитель наводит
 * камеру), кнопку системного «Поделиться» и копирование ссылки. QR рисуется
 * локально из `engine/qr.ts`: никаких сетевых картинок, работает офлайн.
 */
export function ShareApp({ compact = false }: Props) {
  const url = appUrl();
  const matrix = useMemo(() => qrEncode(url), [url]);
  const [outcome, setOutcome] = useState<ShareOutcome | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const nativeShare = canNativeShare();

  useEffect(() => {
    setOutcome(null);
  }, [url]);

  useEffect(() => {
    if (!zoomed) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setZoomed(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomed]);

  const share = async () => setOutcome(await shareApp());
  const copy = async () => setOutcome(await copyAppLink());

  return (
    <div className={`card share-app ${compact ? 'compact' : ''}`}>
      <div className="row">
        <span className="share-app-icon" aria-hidden="true">📤</span>
        <div className="grow">
          <h3 style={{ margin: 0 }}>Передать приложение</h3>
          <div className="tiny">
            Ссылка откроет СЛОВО 2.0 на другом телефоне. Прогресс у каждого ученика свой.
          </div>
        </div>
      </div>

      <div className="share-app-body">
        {matrix ? (
          <button
            type="button"
            className="share-qr"
            onClick={() => setZoomed(true)}
            aria-label="Показать QR-код крупно"
          >
            <QrImage matrix={matrix} className="share-qr-art" />
            <span className="tiny">Нажми, чтобы увеличить</span>
          </button>
        ) : (
          <div className="share-qr missing tiny">QR-код не помещается — отправь ссылку текстом</div>
        )}

        <div className="grow">
          <div className="share-link" title={url}>{linkLabel(url)}</div>
          <div className="col share-app-buttons">
            {nativeShare && (
              <button className="btn primary wide" onClick={share}>
                📤 Поделиться ссылкой
              </button>
            )}
            <button className="btn ghost wide" onClick={copy}>
              🔗 Скопировать ссылку
            </button>
          </div>

          {outcome === 'copied' && <div className="share-note">Ссылка скопирована ✓</div>}
          {outcome === 'shared' && <div className="share-note">Отправлено ✓</div>}
          {outcome === 'cancelled' && (
            <div className="share-note">Окно закрылось. Можно просто скопировать ссылку.</div>
          )}
          {outcome === 'manual' && (
            <>
              <div className="share-note">Скопируй ссылку вручную:</div>
              <input
                className="input share-manual"
                readOnly
                value={url}
                aria-label="Ссылка на приложение"
                onFocus={(event) => event.currentTarget.select()}
              />
            </>
          )}
        </div>
      </div>

      {!compact && (
        <ol className="share-steps tiny">
          <li>Наведи камеру на QR-код или отправь ссылку в мессенджере.</li>
          <li>На другом телефоне открой ссылку в браузере.</li>
          <li>Меню браузера → «Добавить на экран» — и приложение работает без интернета.</li>
        </ol>
      )}

      {zoomed && matrix && (
        <div
          className="share-zoom"
          role="dialog"
          aria-modal="true"
          aria-label="QR-код для передачи приложения"
          onClick={() => setZoomed(false)}
        >
          <div className="share-zoom-inner">
            <QrImage matrix={matrix} className="share-zoom-art" />
            <div className="share-zoom-link">{linkLabel(url)}</div>
            <button className="btn primary" onClick={() => setZoomed(false)}>
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

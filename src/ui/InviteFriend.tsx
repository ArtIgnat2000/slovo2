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
  onClose: () => void;
}

/**
 * «Позови друга» — лист для самого ребёнка с главного экрана (без родителя).
 *
 * Ребёнок показывает QR-код другу (камера его телефона откроет игру) или
 * отправляет ссылку через системное «Поделиться» / копирует её. Раздел
 * «Родителям» не нужен: это та же ссылка, но с короткими словами для ученика.
 */
export function InviteFriend({ onClose }: Props) {
  const url = appUrl();
  const matrix = useMemo(() => qrEncode(url), [url]);
  const [outcome, setOutcome] = useState<ShareOutcome | null>(null);
  const nativeShare = canNativeShare();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const share = async () => setOutcome(await shareApp());
  const copy = async () => setOutcome(await copyAppLink());

  return (
    <div className="sheet-backdrop invite-backdrop" role="presentation" onClick={onClose}>
      <div
        className="invite-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Позови друга"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="row mb">
          <h2 className="grow" style={{ margin: 0 }}>
            Позови друга 🤝
          </h2>
          <button type="button" className="lesson-exit" aria-label="Закрыть" onClick={onClose}>
            ✕
          </button>
        </div>

        <p className="invite-text">Покажи QR-код или отправь ссылку.</p>

        {matrix ? (
          <div className="invite-qr">
            <QrImage matrix={matrix} className="invite-qr-art" />
          </div>
        ) : (
          <div className="invite-qr missing tiny">QR-код не помещается — отправь ссылку текстом</div>
        )}

        <div className="share-link invite-link" title={url}>
          {linkLabel(url)}
        </div>

        <div className="col invite-buttons">
          {nativeShare && (
            <button type="button" className="btn primary wide lg" onClick={share}>
              📤 Отправить другу
            </button>
          )}
          <button type="button" className="btn ghost wide" onClick={copy}>
            🔗 Скопировать ссылку
          </button>
        </div>

        {outcome === 'copied' && <div className="share-note">Ссылка скопирована ✓</div>}
        {outcome === 'shared' && <div className="share-note">Отправлено ✓</div>}
        {outcome === 'cancelled' && <div className="share-note">Отправка отменена</div>}
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
  );
}

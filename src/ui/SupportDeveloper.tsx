// Адрес считан из предоставленного разработчиком QR-кода. Ссылка и изображение
// ведут к одному получателю; приложение не обрабатывает платёж самостоятельно.
const SUPPORT_URL = 'https://www.sberbank.com/sms/pbpn?requisiteNumber=79202544239';

/** Ненавязчивый вход для взрослого, без напоминаний и связи с занятиями. */
export function SupportDeveloper() {
  return (
    <details className="support-developer" open>
      <summary>
        <span className="support-developer-heart" aria-hidden="true">♡</span>
        <span className="support-developer-label">
          <strong>Поддержать разработчика</strong>
          <span>Добровольный перевод</span>
        </span>
        <span className="support-developer-arrow" aria-hidden="true">⌄</span>
      </summary>
      <div className="support-developer-content">
        <p>Если вам нравится «СЛОВО 2.0», вы можете поддержать труд разработчика. Сумма — на ваше усмотрение. Спасибо за ваше внимание и поддержку!</p>
        <img className="support-developer-qr" src={`${import.meta.env.BASE_URL}images/support-qr.png`} alt="QR-код для добровольного перевода разработчику" width="220" height="220" />
        <p className="support-developer-hint">Отсканируйте QR-код в банковском приложении или перейдите по ссылке на этом телефоне. Перед переводом проверьте получателя и сумму.</p>
        <a className="btn ghost support-developer-link" href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">Открыть ссылку для перевода ↗</a>
        <p className="support-developer-hint">Откроется сайт Сбера. Для перевода потребуется интернет; доступность зависит от вашего банка.</p>
      </div>
    </details>
  );
}

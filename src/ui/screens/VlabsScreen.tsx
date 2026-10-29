import { useApp } from '../../state/store';

interface Props {
  onBack: () => void;
}

const TG_URL = 'https://t.me/VLabsV';

export function VlabsScreen({ onBack }: Props) {
  const handleCopyAndOpen = async () => {
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(TG_URL);
        copied = true;
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = TG_URL;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        copied = document.execCommand('copy');
        document.body.removeChild(textarea);
      }
    } catch {
      // Ссылка всё равно откроется.
    }
    useApp.getState().showToast({
      emoji: copied ? '✅' : '🔗',
      title: copied ? 'Ссылка скопирована' : 'Открываем Telegram',
      text: '@VLabsV',
    });
    window.open(TG_URL, '_blank', 'noopener,noreferrer');
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(TG_URL);
      useApp.getState().showToast({ emoji: '✅', title: 'Ссылка скопирована' });
    } catch {
      window.prompt('Скопируйте ссылку:', TG_URL);
    }
  };

  return (
    <div className="screen">
      <button className="btn ghost sm mb" onClick={onBack}>← Назад</button>

      <div className="vlabs-hero card mb">
        <div className="vlabs-badge">Создатели СЛОВО 2.0</div>
        <h1 style={{ margin: '8px 0 6px' }}>
          <span className="vlabs-brand">V-labs</span>
          <span style={{ fontWeight: 800 }}> — программирование для детей</span>
        </h1>
        <p className="vlabs-tagline">Создаём игры, а не просто играем</p>
        <p className="muted">Онлайн-занятия в малых группах для детей от 6 лет.</p>
      </div>

      <div className="card mb vlabs-scratch">
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div className="vlabs-icon">🐱</div>
          <div className="grow">
            <div className="vlabs-kicker">Первый курс</div>
            <h2 style={{ margin: '2px 0 6px' }}>Scratch</h2>
            <p className="muted" style={{ margin: 0 }}>
              Ребёнок собирает игры из визуальных блоков и сразу видит результат.
            </p>
            <div className="vlabs-chips">
              <span className="vlabs-chip">7–12 лет</span>
              <span className="vlabs-chip">с нуля</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card mb">
        <h3>Другие направления</h3>
        <div className="vlabs-grid">
          <div className="vlabs-mini"><span className="vlabs-mini-ico">😺</span><b>Scratch Jr</b><span className="tiny">6–8 лет</span></div>
          <div className="vlabs-mini"><span className="vlabs-mini-ico">🎮</span><b>Roblox Studio</b><span className="tiny">3D-игры</span></div>
          <div className="vlabs-mini"><span className="vlabs-mini-ico">🧠</span><b>Нейросети</b><span className="tiny">ИИ на примерах</span></div>
          <div className="vlabs-mini"><span className="vlabs-mini-ico">🧩</span><b>Kodu</b><span className="tiny">3D-миры</span></div>
          <div className="vlabs-mini"><span className="vlabs-mini-ico">📐</span><b>КОМПАС-3D</b><span className="tiny">моделирование</span></div>
          <div className="vlabs-mini"><span className="vlabs-mini-ico">🕹️</span><b>Scratch-игры</b><span className="tiny">продвинутый курс</span></div>
        </div>
      </div>

      <div className="card mb vlabs-cta">
        <h3 style={{ marginBottom: 12 }}>Узнать о занятиях</h3>
        <button className="btn primary wide" onClick={handleCopyAndOpen}>
          ✈️ @VLabsV
        </button>
        <button className="btn ghost wide mt" onClick={() => void copy()}>
          Скопировать ссылку
        </button>
      </div>
    </div>
  );
}

import { useApp } from '../../state/store';

interface Props {
  onBack: () => void;
}

const TG_URL = 'https://t.me/VLabsV';

export function VlabsScreen({ onBack }: Props) {
  const handleCopyAndOpen = async () => {
    const text = TG_URL;
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        copied = true;
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        copied = document.execCommand('copy');
        document.body.removeChild(ta);
      }
    } catch {
      // clipboard may be blocked — still try to open link
    }
    try {
      useApp.getState().showToast({
        emoji: copied ? '✅' : '🔗',
        title: copied ? 'Ссылка скопирована' : 'Открываем Telegram',
        text: '@VLabsV — школа V-labs',
      });
    } catch {
      // ignore
    }
    window.open(text, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="screen">
      <button className="btn ghost sm mb" onClick={onBack} aria-label="Вернуться в Слово2">
        ← Назад в Слово2
      </button>

      {/* Hero */}
      <div className="vlabs-hero card mb">
        <div className="vlabs-badge">От создателей Слово2</div>
        <h1 style={{ margin: '8px 0 6px' }}>
          <span className="vlabs-brand">V-labs</span>
          <span style={{ fontWeight: 800 }}> — школа программирования для детей</span>
        </h1>
        <p className="vlabs-tagline">Создаём игры, а не просто играем!</p>
        <p className="muted" style={{ marginTop: 10 }}>
          <b style={{ color: 'var(--ink)' }}>Слово2 сделали в V-labs.</b> Это приложение придумал и
          собрал руководитель школы — как живой пример, чему учатся дети. Нравится Слово2? Ребёнок
          научится делать такие же игры и приложения сам — с нуля, на понятном языке.
        </p>
        <div className="vlabs-proof-row">
          <span className="vlabs-proof">💻 Онлайн · малые группы</span>
          <span className="vlabs-proof">🎮 Каждый урок — готовый проект</span>
          <span className="vlabs-proof">👨‍🏫 Ведёт руководитель школы</span>
        </div>
      </div>

      {/* Scratch — главный */}
      <div className="card mb vlabs-scratch">
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div className="vlabs-icon">🐱</div>
          <div className="grow">
            <div className="vlabs-kicker">Начинаем с главного — №1 в школе</div>
            <h2 style={{ margin: '2px 0 6px' }}>Scratch</h2>
            <p className="muted" style={{ margin: 0 }}>
              Визуальные блоки вместо кода: ребёнок сразу видит результат. Уже на первом занятии —
              своя игра. Идеально для <b>7–12 лет</b>, а после — легко перейти в Roblox и нейросети.
            </p>
            <div className="vlabs-chips">
              <span className="vlabs-chip">7–12 лет</span>
              <span className="vlabs-chip">с нуля</span>
              <span className="vlabs-chip">свой проект каждый урок</span>
            </div>
          </div>
        </div>
        <ul className="vlabs-list">
          <li>События, движение, внешность, звук — каждый тип блоков через игру</li>
          <li>Лабиринты, истории, музыкальные инструменты — учимся, делая</li>
          <li>Логика и творчество вместе: код + дизайн + сюжет</li>
        </ul>
      </div>

      {/* Остальные — чипы/плитки следом */}
      <div className="card mb">
        <h3>А дальше — куда интересно ребёнку</h3>
        <p className="tiny" style={{ marginBottom: 12 }}>
          Scratch — вход. Когда база есть, можно выбрать своё направление. Всё внутри одной школы.
        </p>
        <div className="vlabs-grid">
          <div className="vlabs-mini">
            <span className="vlabs-mini-ico">😺</span>
            <b>Scratch Jr</b>
            <span className="tiny">6–8 лет, блоки-картинки</span>
          </div>
          <div className="vlabs-mini">
            <span className="vlabs-mini-ico">🎮</span>
            <b>Roblox Studio</b>
            <span className="tiny">3D-миры и своя игра</span>
          </div>
          <div className="vlabs-mini">
            <span className="vlabs-mini-ico">🧠</span>
            <b>Нейросети</b>
            <span className="tiny">что такое ИИ на примерах</span>
          </div>
          <div className="vlabs-mini">
            <span className="vlabs-mini-ico">🕹️</span>
            <b>Scratch-игры</b>
            <span className="tiny">продвинутые 2D/3D игры</span>
          </div>
          <div className="vlabs-mini">
            <span className="vlabs-mini-ico">🧩</span>
            <b>Kodu</b>
            <span className="tiny">3D-игры от Microsoft</span>
          </div>
          <div className="vlabs-mini">
            <span className="vlabs-mini-ico">📐</span>
            <b>КОМПАС-3D</b>
            <span className="tiny">чертим и моделируем</span>
          </div>
        </div>
        <div className="vlabs-more">
          + ещё: компьютерная грамотность · дизайн проектов · истории и мультимедиа
        </div>
      </div>

      {/* Почему это полезно именно родителям Слово2 */}
      <div className="card mb">
        <h3>Почему родителям Слово2 это подходит</h3>
        <div className="vlabs-why">
          <div className="vlabs-why-item">
            <span className="vlabs-why-ico">🎯</span>
            <div>
              <b>Учим через игру, а не зубрёжку</b>
              <div className="tiny">Как в Слово2: короткие победы, видно прогресс, без стресса.</div>
            </div>
          </div>
          <div className="vlabs-why-item">
            <span className="vlabs-why-ico">👨‍👩‍👧</span>
            <div>
              <b>Родителям всё понятно</b>
              <div className="tiny">Что сделал ребёнок — видно сразу: игра или мульт, а не «строчки кода».</div>
            </div>
          </div>
          <div className="vlabs-why-item">
            <span className="vlabs-why-ico">🧒→👩‍💻</span>
            <div>
              <b>Слово2 — пример выпускной работы</b>
              <div className="tiny">Так выглядят проекты детей после Scratch: офлайн-приложение, которое реально работает.</div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="card mb vlabs-cta">
        <h3 style={{ marginBottom: 6 }}>Хочешь так же — делать игры сам?</h3>
        <p className="muted" style={{ marginBottom: 14 }}>
          Первый шаг — Scratch. Запишись, покажем как проходит урок — без давления, просто попробуете.
        </p>
        <button className="btn primary wide" onClick={handleCopyAndOpen}>
          ✈️ Написать в Telegram — @VLabsV
        </button>
        <div className="row mt" style={{ gap: 8 }}>
          <a className="btn ghost grow" href={TG_URL} target="_blank" rel="noopener noreferrer">
            Открыть ссылку
          </a>
          <button
            className="btn ghost grow"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(TG_URL);
                useApp.getState().showToast({ emoji: '✅', title: 'Скопировали', text: TG_URL });
              } catch {
                window.prompt('Скопируй ссылку:', TG_URL);
              }
            }}
          >
            Скопировать
          </button>
        </div>
        <div className="tiny center" style={{ marginTop: 10 }}>
          Ссылка откроется в новой вкладке. Вернуться в Слово2 — кнопкой ← Назад или свайпом.
          Работает и офлайн: ссылка скопируется, откроется когда появится сеть.
        </div>
      </div>

      <div className="tiny center" style={{ opacity: 0.85 }}>
        V-labs — онлайн-школа программирования для детей. Руководитель — автор Слово2. Подробнее — в
        Telegram-канале школы: <b>@VLabsV</b>
      </div>
    </div>
  );
}

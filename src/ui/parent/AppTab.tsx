// «Приложение» — всё, что про само приложение, а не про ребёнка:
// передать ссылку второму родителю, поставить на экран телефона, версия сборки
// и история про школу V-labs (рекламная карточка живёт здесь, а не посреди
// отчёта об успехах).

import { isStandalone } from '../../platform/pwa';
import { ShareApp } from '../ShareApp';
import { GroupTitle } from './ParentBits';

interface Props {
  onOpenVlabs: () => void;
  onOpenDiagnostics: () => void;
}

export function AppTab({ onOpenVlabs, onOpenDiagnostics }: Props) {
  return (
    <div className="parent-stack">
      <ShareApp />

      <div className="card">
        <GroupTitle title="На телефон" hint="Чтобы приложение открывалось как обычное и работало без интернета." />
        {isStandalone() ? (
          <p className="setting-hint">
            ✅ Приложение уже открыто с экрана «Домой» — интернет для занятий не нужен.
          </p>
        ) : (
          <p className="setting-hint">
            📲 В браузере нажмите «Поделиться» → «На экран Домой» (на Android — «Установить приложение»).
            После этого «СЛОВО» открывается без браузера и работает офлайн.
          </p>
        )}
      </div>

      <button className="vlabs-promo card wide" onClick={onOpenVlabs} style={{ textAlign: 'left', cursor: 'pointer' }}>
        <div className="row">
          <span className="vlabs-promo-icon">🧪</span>
          <div className="grow">
            <div className="vlabs-promo-title">Слово2 сделали в V-labs</div>
            <div className="setting-hint">
              Школа программирования для детей — создаём игры, а не просто играем. Про Scratch →
            </div>
          </div>
          <span style={{ fontSize: 22, color: 'var(--primary)', flex: 'none' }}>▸</span>
        </div>
      </button>

      <div className="card">
        <GroupTitle title="Версия" hint="Сверяйте с сайтом, чтобы понять, какая сборка у вас открыта." />
        <div className="kv">
          <span>Версия приложения</span>
          <b>v{import.meta.env.VITE_APP_VERSION}</b>
        </div>
        <div className="kv">
          <span>Сборка</span>
          <span className="setting-hint" style={{ fontFamily: 'ui-monospace, monospace' }}>
            {import.meta.env.VITE_BUILD_SHA}
          </span>
        </div>
        <p className="setting-hint">
          Если на сайте и в приложении разные номера — на телефоне ждёт обновление: закройте и откройте
          приложение или примите плашку «Доступно обновление».
        </p>
        <button type="button" className="btn ghost sm" onClick={onOpenDiagnostics}>
          Диагностика приложения
        </button>
      </div>
    </div>
  );
}

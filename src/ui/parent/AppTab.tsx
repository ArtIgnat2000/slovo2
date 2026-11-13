import { isStandalone } from '../../platform/pwa';
import { ShareApp } from '../ShareApp';
import { GroupTitle } from './ParentBits';
import { UpdateCheck } from './UpdateCheck';
import { GamesDevPanel } from './GamesDevPanel';

interface Props {
  onOpenVlabs: () => void;
  onOpenDiagnostics: () => void;
  onOpenTts: () => void;
}

export function AppTab({ onOpenVlabs, onOpenDiagnostics, onOpenTts }: Props) {
  return (
    <div className="parent-stack">
      <ShareApp />

      <div className="card">
        <GroupTitle title="Установка" />
        <p className="setting-hint">
          {isStandalone()
            ? '✅ Приложение установлено и работает без интернета.'
            : 'В меню браузера выберите «На экран Домой» или «Установить приложение».'}
        </p>
      </div>

      {/* Только для дев-проверки: в проде без `?dev=1` компонент не рисуется. */}
      <GamesDevPanel />

      <div className="card">
        <GroupTitle title="Обновления" hint={`Версия v${import.meta.env.VITE_APP_VERSION}`} />
        <UpdateCheck />
      </div>

      <div className="card">
        <GroupTitle title="Проба озвучки" hint="слушаем системные голоса на этом телефоне" />
        <p className="setting-hint">
          54 самых рискованных слова банка и 2 школьных термина («подлежащее», «сказуемое») — с двумя
          прослушиваниями и отметками ✓/✗. Никуда не отправляется: отметки остаются на устройстве,
          сводка копируется вручную.
        </p>
        <button type="button" className="btn ghost wide mt" onClick={onOpenTts}>🔊 Проба озвучки</button>
      </div>

      <details className="card parent-app-about">
        <summary className="parent-summary">О приложении</summary>
        <div className="kv mt">
          <span>Сборка</span>
          <span className="setting-hint" style={{ fontFamily: 'ui-monospace, monospace' }}>
            {import.meta.env.VITE_BUILD_SHA}
          </span>
        </div>
        <div className="row mt">
          <button className="btn ghost grow sm" onClick={onOpenDiagnostics}>Диагностика</button>
          <button className="btn ghost grow sm" onClick={onOpenVlabs}>О создателях</button>
        </div>
      </details>
    </div>
  );
}

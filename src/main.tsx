import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/app.css';
import { useApp } from './state/store';
import { initPWA } from './platform/pwa';
import { checkPersistence } from './platform/storage';
import { useStorageHealth } from './state/health';

async function boot() {
  // Прогресс лежит в IndexedDB — сначала дожидаемся загрузки, потом рисуем экран.
  // Ошибку чтения обрабатывает сторож (src/platform/vault.ts): он морозит запись
  // и показывает родителю экран «прогресс не удалось открыть» вместо пустого
  // «создайте первого ученика» — так старая запись не затирается.
  try {
    await useApp.persist.rehydrate();
  } catch {
    /* сторож уже разобрался */
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );

  initPWA(() => window.dispatchEvent(new Event('slovo2:update')));
  // Постоянное хранилище просим только по жесту (кнопка в «Родителям»), а здесь
  // лишь узнаём текущий статус: без него браузер вправе вычистить данные.
  void checkPersistence().then((persisted) => useStorageHealth.getState().patch({ persisted }));
}

void boot();

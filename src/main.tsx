import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/app.css';
import { useApp } from './state/store';
import { initPWA } from './platform/pwa';
import { requestPersistence } from './platform/storage';

async function boot() {
  // Прогресс лежит в IndexedDB — сначала дожидаемся загрузки, потом рисуем экран.
  try {
    await useApp.persist.rehydrate();
  } catch {
    /* первый запуск — базы ещё нет */
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );

  initPWA(() => window.dispatchEvent(new Event('slovo2:update')));
  void requestPersistence();
}

void boot();

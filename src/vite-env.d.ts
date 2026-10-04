/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Номер релиза (из version в package.json), подставляется vite-конфигурацией. */
  readonly VITE_APP_VERSION: string;
  /** Короткий SHA коммита сборки (с «-dirty», если были незакоммиченные изменения). */
  readonly VITE_BUILD_SHA: string;
  /**
   * Порог тихой паузы «застрял» для помощника БУКа в миллисекундах.
   * В приложении не задаётся (берётся NUDGE_MS = 20 с), в смоуке — короткий,
   * чтобы сценарий «застрял → предложили помощь» проходил за секунды.
   */
  readonly VITE_BUK_NUDGE_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

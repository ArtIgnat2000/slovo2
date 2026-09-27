/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Номер релиза (из version в package.json), подставляется vite-конфигурацией. */
  readonly VITE_APP_VERSION: string;
  /** Короткий SHA коммита сборки (с «-dirty», если были незакоммиченные изменения). */
  readonly VITE_BUILD_SHA: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

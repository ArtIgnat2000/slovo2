# СЛОВО 2.0 — 0.14.1

**Гигиена после 0.14.0: workflow «Fetch official music» больше не пушит в `main`,
а диагностический лог убран из репозитория.**

Слияние 0.14.0 заодно активировало workflow докачки аудио на `main` (paths-фильтер
совпал со скриптом `scripts/fetch-music.mjs`), и бот закоммитил туда служебный
`docs/music-fetch-debug.txt` (`7cd40d4`) — прямым пушем, мимо PR. Исправления:

* push-триггер workflow игнорирует `main` (аудио добывается в ветках, в `main` —
  только через PR), плюс страховка в шаге коммита по `$GITHUB_REF`;
* диагностический лог пишется и коммитится **только при сбое** загрузки;
* `docs/music-fetch-debug.txt` удалён из репозитория.

Поведение игры не меняется. Проверки: `test:release`, `release:check`, `typecheck`,
`content:check`, `test:adaptive`, `test:smoke`, `build`, `test:boot`,
`audit:storage`.

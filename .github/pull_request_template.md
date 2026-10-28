## Релиз

- **Версия:** <!-- например 0.11.8; каждый PR увеличивает версию относительно main; используйте npm version X.Y.Z --no-git-tag-version для синхронизации lock -->
- **Заголовок PR:** начинается с `v<версия> — ...`
- **Заметка о релизе:** `docs/RELEASE-<версия>.md` <!-- обязательная ссылка -->
- **Проверка на сайте:** `?diag=1` должна показать `v<версия> · <короткий SHA>` после деплоя

## Что изменено

<!-- 1–3 предложения: что и зачем -->

## Проверки

- [ ] `npm run test:release`
- [ ] `git fetch origin main` и `PR_TITLE="v<версия> — ..." npm run release:check -- origin/main` (проверены версия > main, lock, заметка **и заголовок**; без `PR_TITLE` заголовок не проверяется)

- [ ] `npm run typecheck`
- [ ] `npm run content:check`
- [ ] `npm run test:adaptive`
- [ ] `npm run test:smoke`
- [ ] `npm run build`
- [ ] `npm run test:boot`
- [ ] `npm run audit:storage`

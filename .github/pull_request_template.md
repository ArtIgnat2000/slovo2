## Релиз

- **Версия:** <!-- например 0.11.8; каждый PR увеличивает версию относительно main -->
- **Заголовок PR:** начинается с `v<версия> — ...`
- **Заметка о релизе:** `docs/RELEASE-<версия>.md` <!-- обязательная ссылка -->
- **Проверка на сайте:** `?diag=1` должна показать `v<версия> · <короткий SHA>` после деплоя

## Что изменено

<!-- 1–3 предложения: что и зачем -->

## Проверки

- [ ] `npm run test:release`
- [ ] `npm run release:check` (свежий `origin/main`; в CI проверяется и заголовок PR)

- [ ] `npm run typecheck`
- [ ] `npm run content:check`
- [ ] `npm run test:adaptive`
- [ ] `npm run test:smoke`
- [ ] `npm run build`
- [ ] `npm run test:boot`
- [ ] `npm run audit:storage`

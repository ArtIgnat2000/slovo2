# 0.71.1 — «Мой мир»: только полученное, БУК стоит на месте

## Что изменено

- **Неполученное нельзя поставить в «Мой мир».** Правило закреплено на всех уровнях: список выбора во вкладке строится только из полученного через единый `isWorldPlaceable` (купленная вещь, собранный пазловый костюм, купленный костюм базы); движок на чужой id отвечает `locked`; сохранённый выбор при каждом чтении и при любом нажатии очищается от неполученного — сданная обратно вещь или запись из чужого файла не показывается и не занимает одно из трёх мест.
- **БУК в костюмах больше не «летает» во вкладке «Мой мир».** У совы внутри слотов и выбора мира сняты базовые `position: fixed`, сдвиги `right/bottom`, `z-index: 25` и вечная анимация `float` (правило `.world-slot-art .mascot, .world-pick-art .mascot` — `position: static; animation: none`, как в иконках магазина): БУК стоит на подиуме сцены.

## Проверки

- Новые `tests/world.test.ts` (движок + CSS-правило) в `npm run test:adaptive` и `tests/world-ui.test.tsx` (настоящий UI) в `npm run test:smoke`.
- `npm run test:release`, `npm run release:check`
- `npm run typecheck`, `npm run content:check`, `npm run test:adaptive`
- `npm run test:smoke` (все проверки, включая блок «Мой мир»), `npm run test:guard`
- `npm run build`, `npm run test:boot`, `npm run test:icons`

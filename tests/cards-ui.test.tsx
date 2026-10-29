// Карточка товара: крупная картинка, ничего не обрезано, этикетка под ней.
//
// 0.79.0: витрина собрана в духе «тяжёлого люкса» и живёт на ДВУХ базовых
// темах (токены --lux-*): светлая — Rolls-Royce (жемчужная ниша, хром
// Pantheon, сапфировый лак, светлые промежутки), тёмная — Maybach (обсидиан,
// шампань). Ценник — компактная табличка в подвале этикетки (`.shop-foot`),
// рядом с кнопкой: он не лежит на снимке и не дублируется в подписи кнопки.
// Статусы («В Моём мире ✓») — строкой `.shop-status`.
// Здесь проверки того, что видно только в собранном UI, плюс стражи от
// отката в CSS и страж двух тем в tokens.css.
import { existsSync, readFileSync } from 'node:fs';
import { TOY_ITEMS } from '../src/engine/shop';
import { BUILDING_BY_ID } from '../src/engine/buildings';
import { PRODUCT_PHOTOS, hasProductPhoto, productPhotoUrl } from '../src/ui/ProductPhoto';
import { useApp } from '../src/state/store';
import { body, buttons, check, click, has, sleep } from './ui-helpers';

const css = () => readFileSync('src/styles/app.css', 'utf8');

async function goBuk() {
  const tab = buttons().find((b) => (b.textContent ?? '').includes('БУК') && b.className.includes('tab'));
  click(tab);
  await sleep(80);
}

/** Кнопка-чип полки магазина по названию. */
function shelf(title: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll('.shop-cats .chip')).find((chip) =>
    (chip.textContent ?? '').includes(title),
  ) as HTMLButtonElement | undefined;
}

export async function runShopCardChecks() {
  console.log('\n── Карточка товара: крупная картинка и этикетка под ней ──');

  // Каждому фото в списке соответствует файл: иначе на витрине будет пустая
  // ниша, а сборка об этом молча промолчит.
  const missing = PRODUCT_PHOTOS.filter((id) => !existsSync(`public/products/${id}.webp`));
  check('фото товаров: у каждого id из списка есть файл в public/products', missing.length === 0, missing.join(', '));
  check(
    'фото товаров: адрес картинки собирается с учётом базы сборки',
    productPhotoUrl('pet-cat').endsWith('/products/pet-cat.webp'),
    productPhotoUrl('pet-cat'),
  );
  // В списке фото обязаны быть только настоящие товары каталога: техника
  // (`TOY_ITEMS`) и базы (`BUILDING_BY_ID`). Опечатка в id иначе дала бы
  // снимок, который никто никогда не увидит.
  const photographed = PRODUCT_PHOTOS.filter((id) => TOY_ITEMS.some((item) => item.id === id) || id in BUILDING_BY_ID);
  check(
    'фото товаров: в списке фото только настоящие товары магазина',
    photographed.length === PRODUCT_PHOTOS.length,
    `${photographed.length} из ${PRODUCT_PHOTOS.length}`,
  );

  // Фото проверяем на каждой полке, где они уже есть: перевод идёт полками,
  // поэтому «снимок вместо рисунка» — свойство товара, а не всей витрины.
  const shelves: [string, string][] = [
    ['Питомцы', 'pet'],
    ['Спорт', 'sport'],
    ['Вкусняшки', 'food'],
    ['Самолёты', 'plane'],
    ['Корабли', 'ship'],
  ];
  let photoCards: (Element | undefined)[] = [];
  for (const [title, kind] of shelves) {
    await goBuk();
    // Самолёты, корабли и телефоны живут вкладками внутри полки «Техника»,
    // а питомцы/спорт/вкусняшки — отдельными полками. Открываем и так, и так.
    if (!shelf(title)) {
      click(shelf('Техника')!);
      await sleep(60);
      const tab = Array.from(document.querySelectorAll('.shop-toy-cats [role="tab"]')).find((el) =>
        (el.textContent ?? '').includes(title),
      ) as HTMLButtonElement | undefined;
      click(tab);
    } else {
      click(shelf(title)!);
    }
    await sleep(60);
    const cards = Array.from(document.querySelectorAll('.shop-item.toy-item'));
    const inShelf = PRODUCT_PHOTOS.filter((id) => TOY_ITEMS.find((item) => item.id === id)?.toy === kind);
    const withPhoto = cards.filter((card) => !!card.querySelector('img.product-photo'));
    check(
      `карточка: на полке «${title}» каждый товар из списка фото показан снимком`,
      withPhoto.length === inShelf.length && inShelf.length > 0,
      `карточек ${cards.length}, из них с фото ${withPhoto.length}, по списку ${inShelf.length}`,
    );
    check(
      `карточка: на полке «${title}» в нише снимка нет векторного рисунка поверх`,
      withPhoto.every((card) => !card.querySelector('.shop-icon > svg')),
      withPhoto.map((card) => card.querySelector('.shop-icon')?.innerHTML.slice(0, 30)).join(' | ').slice(0, 140),
    );
    photoCards = photoCards.concat(withPhoto);
  }
  // Перевод на фото идёт полками, и это видно в тесте: список ожидания
  // сокращается с каждой партией. Если кто-то вернёт рисунок вместо готового
  // снимка, проверка упадёт и напомнит, что полка уже переехала в студию.
  const stillDrawn = TOY_ITEMS.filter(
    (item) => ['pet', 'sport', 'food', 'plane', 'ship'].includes(item.toy ?? '') && !hasProductPhoto(item.id),
  ).map((item) => item.id);
  check(
    'фото товаров: у всех зверей, спорта, вкусняшек, самолётов и кораблей есть снимок',
    stillDrawn.join(',') === '',
    stillDrawn.join(', ') || 'ни одного',
  );

  // ── Базы: у каждой фотореалистичный рендер, и он же — фасад экскурсии ────
  await goBuk();
  click(shelf('Базы')!);
  await sleep(60);
  const baseCards = Array.from(document.querySelectorAll('.building-item'));
  check(
    'базы: на полке пять баз, у каждой рендер вместо иллюстрации',
    baseCards.length === 5 && baseCards.every((card) => !!card.querySelector('img.product-photo')),
    `карточек ${baseCards.length}, с фото ${baseCards.filter((card) => card.querySelector('img.product-photo')).length}`,
  );
  check(
    'базы: рендер берётся из папки продуктов, а не из старых иллюстраций',
    baseCards.every((card) => (card.querySelector('img.product-photo')?.getAttribute('src') ?? '').includes('/products/')),
    baseCards.map((card) => card.querySelector('img')?.getAttribute('src')).join(', ').slice(0, 140),
  );
  const baseNiche = baseCards[0]?.querySelector('.shop-case');
  check(
    'базы: у базы та же ниша 4:3, что у остальных товаров',
    !!baseNiche?.classList.contains('shop-case-photo'),
    baseNiche?.className ?? 'нет ниши',
  );
  check(
    'карточка: у снимка адрес из папки продуктов',
    photoCards.every((card) => (card?.querySelector('img.product-photo')?.getAttribute('src') ?? '').includes('/products/')),
    photoCards.map((card) => card?.querySelector('img.product-photo')?.getAttribute('src')).join(', ').slice(0, 160),
  );
  const photoRule = css().match(/\.shop-case \.shop-icon img\s*\{[^}]*\}/)?.[0] ?? '';
  check(
    'карточка: стили вписывают картинку целиком и не режут её',
    /object-fit:\s*contain/.test(photoRule) && /width:\s*100%/.test(photoRule) && /height:\s*100%/.test(photoRule),
    photoRule.replace(/\s+/g, ' ').trim() || 'правило .shop-case .shop-icon img не найдено',
  );
  const caseRule = css().match(/\n\.shop-case\s*\{[^}]*\}/)?.[0] ?? '';
  check(
    'карточка: ниша товара больше не фиксированной высоты 126 px',
    /aspect-ratio:/.test(caseRule) && !/height:\s*126px/.test(caseRule),
    caseRule.replace(/\s+/g, ' ').trim() || 'правило .shop-case не найдено',
  );

  const firstCard = photoCards[0];
  check(
    'карточка: ценник — компактная плашка в подвале, картинка свободна',
    !!firstCard?.querySelector('.shop-foot > .shop-price') && !firstCard.querySelector('.shop-case > .shop-price'),
    firstCard?.querySelector('.shop-foot')?.innerHTML.slice(0, 120) ?? '',
  );
  check(
    'карточка: сердечко «в мечты» — на картинке',
    !!firstCard?.querySelector('.shop-case > .shop-heart'),
    '',
  );
  check(
    'карточка: название, описание, кнопка и ценник собраны в этикетку',
    !!firstCard?.querySelector('.shop-body > .shop-title-row > .shop-title') &&
      !!firstCard?.querySelector('.shop-body > .shop-desc') &&
      !!firstCard?.querySelector('.shop-foot > button.btn'),
    firstCard?.querySelector('.shop-body')?.innerHTML.slice(0, 120) ?? 'нет .shop-body',
  );
  const descRule = css().match(/\n\.shop-desc\s*\{[^}]*\}/)?.[0] ?? '';
  check(
    'карточка: описание ограничено двумя строками — карточки в ряду одной высоты',
    /-webkit-line-clamp:\s*2/.test(descRule),
    descRule.replace(/\s+/g, ' ').trim() || 'правило .shop-desc не найдено',
  );
  const gridRule = css().match(/\n\.shop-grid\s*\{[^}]*\}/)?.[0] ?? '';
  check(
    'карточка: сколько колонок — решает сетка, а не разметка',
    /grid-template-columns/.test(gridRule) && /@media \(min-width: 480px\)\s*\{\s*\.shop-grid\s*\{[^}]*repeat\(3/.test(css().replace(/\n\s*/g, ' ').replace(/\{ /g, '{').replace(/ \}/g, '}')) ||
      /repeat\(3/.test(css().match(/@media \(min-width: 480px\)\s*\{[^}]*\}/)?.[0] ?? ''),
    (gridRule + ' ' + (css().match(/@media \(min-width: 480px\)\s*\{\s*\.shop-grid[^}]*\}/)?.[0] ?? '')).replace(/\s+/g, ' ').trim(),
  );
  check(
    'карточка: сетка витрины больше не нарезается по две карточки в разметке',
    document.querySelectorAll('.shop-boutique .shop-boutique-row').length === 1,
    String(document.querySelectorAll('.shop-boutique .shop-boutique-row').length),
  );

  // ── Две базовые темы витрины (0.79.0) ─────────────────────────────────────
  // Материал задаёт только tokens.css: светлая — Rolls-Royce (в промежутках
  // светлый показочный зал, тёмного фона нет), тёмная — Maybach (обсидиан).
  // Страж ловит три отката: пропущенный ключ в одной из тем, «тёмные
  // промежутки» в светлой теме и зашитый в app.css цвет вместо var(--lux-*).
  const tokensSrc = readFileSync('src/styles/tokens.css', 'utf8');
  // Комментарии вырезаем обязательно: в пояснении к токенам встречается
  // литерал «[data-theme='dark']» — без очистки индекс упал бы в комментарий.
  const tokensClean = tokensSrc.replace(/\/\*[\s\S]*?\*\//g, '');
  const darkAt = tokensClean.indexOf("[data-theme='dark']");
  const lightTokens = tokensClean.slice(0, darkAt);
  const darkTokens = tokensClean.slice(darkAt);
  const luxKeys = [...new Set((css().match(/var\(--lux-[a-z0-9-]+\)/g) ?? []).map((v) => v.slice(4, -1)))];
  const missingKeys = luxKeys.filter((k) => !lightTokens.includes(`${k}:`) || !darkTokens.includes(`${k}:`));
  check(
    'витрина: обе темы задают все --lux-* ключи, которыми пользуется app.css',
    darkAt > 0 && luxKeys.length > 0 && missingKeys.length === 0,
    missingKeys.join(', ') || `ключей: ${luxKeys.length}`,
  );
  /** Сумма RGB-каналов цвета: < 250 — явный обсидиан, > 400 — явный светлый. */
  const panelSum = (src: string): number => {
    const hex = src.match(/--lux-panel:\s*#([0-9a-f]{6})/i)?.[1] ?? '';
    return hex ? [0, 2, 4].reduce((s, i) => s + parseInt(hex.slice(i, i + 2), 16), 0) : -1;
  };
  check(
    'витрина: в светлой теме промежутки светлые — тёмного фона нет (Rolls-Royce)',
    panelSum(lightTokens) > 400,
    String(panelSum(lightTokens)),
  );
  check(
    'витрина: в тёмной теме витрина обсидиановая (Maybach)',
    panelSum(darkTokens) >= 0 && panelSum(darkTokens) < 250,
    String(panelSum(darkTokens)),
  );
  check(
    'витрина: материал в app.css — только через var(--lux-*), без зашитых цветов',
    /\.shop-boutique\s*\{[^}]*var\(--lux-panel\)/.test(css()) && !/\.shop-boutique\s*\{[^}]*background[^;]*#[0-9a-f]{3,6}/i.test(css().match(/\.shop-boutique\s*\{[^}]*\}/)?.[0] ?? ''),
    (css().match(/\.shop-boutique\s*\{[^}]*\}/)?.[0] ?? '').replace(/\s+/g, ' ').slice(0, 140) || 'правило .shop-boutique не найдено',
  );

  // Фото — уже готовый снимок со своим фоном: перекраска «цветным карандашом»
  // к нему не применяется, поэтому и палитра у такого товара не показывается.
  const pet = TOY_ITEMS.find((entry) => entry.toy === 'pet');
  if (!pet) throw new Error('карточки: в каталоге нет питомцев');
  useApp.setState((s) => ({
    profiles: s.profiles.map((p) => (p.id === s.activeId ? { ...p, gems: Math.max(p.gems, pet.price) } : p)),
  }));
  await sleep(30);
  check('карточка: питомца можно купить для проверки подробной карточки', useApp.getState().buyItem(pet.id), '');
  await sleep(60);
  const petCard = Array.from(document.querySelectorAll('.shop-item.toy-item')).find((card) =>
    (card.textContent ?? '').includes(pet.title),
  );
  if (petCard) click(petCard);
  await sleep(60);
  check(
    'карточка: у фототовара нет кнопки перекраски — её некуда применить',
    !has('🎨 Цвет'),
    body().slice(0, 160),
  );
  // Возвращаем профиль: следующие блоки смоука считают покупки с нуля.
  useApp.setState((s) => ({
    profiles: s.profiles.map((p) => (p.id === s.activeId ? { ...p, shop: { ...p.shop!, owned: p.shop?.owned.filter((id) => id !== pet.id) ?? [] } } : p)),
  }));
  document.querySelector('.shop-sheet-veil')?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(40);
}

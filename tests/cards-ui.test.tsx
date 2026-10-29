// Карточка товара: крупная картинка, ничего не обрезано, этикетка под ней.
//
// 0.76.0: вёрстку витрины переделали — фото товара занимает всю ширину
// карточки, ценник и сердечко лежат на снимке, а название, описание и кнопка
// собраны в этикетку. Здесь проверки того, что видно только в собранном UI,
// плюс стражи от отката в CSS.
import { existsSync, readFileSync } from 'node:fs';
import { TOY_ITEMS } from '../src/engine/shop';
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
  // Пока фото переведены не для всех полок (0.76.0 — питомцы), проверяем
  // правило: товар с фото рисуется снимком, товар без фото — прежним артом.
  const photographed = TOY_ITEMS.filter((item) => hasProductPhoto(item.id));
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
    (item) => ['pet', 'sport', 'food'].includes(item.toy ?? '') && !hasProductPhoto(item.id),
  ).map((item) => item.id);
  check(
    'фото товаров: без снимков остались только запланированные товары',
    stillDrawn.join(',') === '',
    stillDrawn.join(', ') || 'ни одного',
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
    'карточка: ценник лежит на картинке, а не отдельной строкой',
    !!firstCard?.querySelector('.shop-case > .shop-price') && !firstCard.querySelector('.shop-body > .shop-price'),
    firstCard?.querySelector('.shop-case')?.innerHTML.slice(0, 120) ?? '',
  );
  check(
    'карточка: сердечко «в мечты» тоже на картинке',
    !!firstCard?.querySelector('.shop-case > .shop-heart'),
    '',
  );
  check(
    'карточка: название, описание и кнопка собраны в этикетку',
    !!firstCard?.querySelector('.shop-body > .shop-title-row > .shop-title') &&
      !!firstCard?.querySelector('.shop-body > .shop-desc') &&
      !!firstCard?.querySelector('.shop-body > button.btn'),
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

// Облики сундука глазами ребёнка: полка, выбор, прогресс и что видно в сцене.
//
// Движковые правила проверяет tests/chest-skins.test.ts, а здесь — путь по
// интерфейсу, на котором они ломались бы незаметно:
//  • у новичка всё открыто понятно: один облик есть, остальные — с условием и шкалой;
//  • запертый облик нельзя выбрать (карточка не нажимается);
//  • выбранный облик сразу видно в карточке заданий (мини-сундук меняет цвета);
//  • сцена открытия показывает тот же облик, что выбран на полке;
//  • «новый сундук открылся» говорится один раз и запоминается в профиле.
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { CHEST_SKINS, skinById } from '../src/engine/chests';
import { ChestGlyph } from '../src/ui/ChestArt';
import { LESSONS } from '../src/content/words';
import { dayKey, useApp } from '../src/state/store';
import { btnText, buttons, check, click, has, openRewardsSheet, sleep } from './ui-helpers';
import type { Profile } from '../src/types';

const store = () => useApp.getState();

function active(): Profile {
  const s = store();
  const p = s.profiles.find((x) => x.id === s.activeId);
  if (!p) throw new Error('облики сундука: нет активного профиля');
  return p;
}

/** Сундуков открыто за всё время — по этому счётчику открывается «Небесный». */
function setChestsOpened(total: number) {
  const id = active().id;
  useApp.setState((s) => ({
    profiles: s.profiles.map((p) =>
      p.id === id
        ? {
            ...p,
            daily: {
              day: dayKey(),
              claimed: [],
              chestsToday: 0,
              bonusChestsClaimed: 0,
              chestsTotal: total,
              ...(p.daily?.plan ? { plan: p.daily.plan } : {}),
            },
          }
        : p,
    ),
  }));
}

/** Текст карточки облика по названию — чтобы читать ровно то, что видит ребёнок. */
function skinCard(title: string): string {
  const card = Array.from(document.querySelectorAll('.skin-card')).find((c) =>
    (c.textContent ?? '').includes(title),
  );
  return (card?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** Вернуться на главную: прошлые сценарии могли оставить нас в уроке. */
async function toHome() {
  if (has('Выйти из урока?')) {
    click(btnText('Выйти'));
    await sleep(60);
  }
  const exit = buttons().find((b) => b.getAttribute('aria-label') === 'Выйти из урока');
  if (exit) {
    click(exit);
    await sleep(60);
    if (has('Выйти из урока?')) {
      click(btnText('Выйти'));
      await sleep(60);
    }
  }
  const home = buttons().find((b) => (b.textContent ?? '').includes('Уроки') && b.className.includes('tab'));
  if (home) click(home);
  await sleep(80);
}

export async function runChestSkinsUiChecks(): Promise<void> {
  console.log('\n── Облики сундука: полка, выбор и награда ──');
  await toHome();
  store().createProfile('Облики', '🎨');
  await sleep(80);
  await openRewardsSheet();

  // Полка доступна из листа наград и у новичка полна смысла.
  check(
    'у сундука в наградах есть вход в облики с названием текущего',
    has('Облик:') && has('Сундук путника'),
    document.body.textContent?.slice(0, 200) ?? '',
  );
  click(btnText('Облик:'));
  await sleep(40);
  const cards = Array.from(document.querySelectorAll('.skin-card'));
  check(
    'полка обликов открывается и показывает все облики',
    cards.length === CHEST_SKINS.length,
    `карточек: ${cards.length}`,
  );
  check(
    'у новичка открыт только базовый облик, остальные — с условием',
    cards.filter((c) => c.className.includes('open')).length === 1 &&
      cards.some((c) => (c.textContent ?? '').includes('Открой 5 сундуков')) &&
      document.querySelectorAll('.skin-card.locked .skin-lock').length === CHEST_SKINS.length - 1,
    cards.map((c) => (c.textContent ?? '').replace(/\s+/g, ' ').trim()).join(' | ').slice(0, 240),
  );
  check(
    'запертый облик показывает, сколько осталось',
    skinCard('Небесный сундук').includes('0 из 5') && skinCard('Небесный сундук').includes('осталось 5'),
    skinCard('Небесный сундук'),
  );
  check(
    'выбранный облик отмечен, а не «нажимается заново»',
    skinCard('Сундук путника').includes('Выбран') &&
      (document.querySelector('.skin-card.on') as HTMLButtonElement | null)?.disabled === false,
    skinCard('Сундук путника'),
  );

  // Запертую карточку нельзя выбрать: кнопка честно disabled.
  const lockedCard = document.querySelector('.skin-card.locked') as HTMLButtonElement | null;
  check('запертый облик нельзя выбрать', !!lockedCard && lockedCard.disabled === true, String(!!lockedCard));
  click(lockedCard);
  await sleep(30);
  check('тап по запертому облику ничего не меняет', !active().chestSkin, String(active().chestSkin));

  // Пять открытых сундуков — небесный облик открыт, тост один раз, запись в профиле.
  setChestsOpened(5);
  await sleep(80);
  check(
    'новый облик объявляется один раз и записывается в профиль',
    has('Новый сундук: Небесный сундук') && (active().chestSkins ?? []).includes('sky'),
    `тост: ${has('Новый сундук')}; запись: ${JSON.stringify(active().chestSkins)}`,
  );
  click(btnText('Облик:'));
  await sleep(40);
  check(
    'открытый облик помечен как новый и его можно выбрать',
    skinCard('Небесный сундук').includes('новый') && skinCard('Небесный сундук').includes('Выбрать'),
    skinCard('Небесный сундук'),
  );
  const skyCard = Array.from(document.querySelectorAll('.skin-card')).find((c) =>
    (c.textContent ?? '').includes('Небесный сундук'),
  ) as HTMLButtonElement | undefined;
  click(skyCard);
  await sleep(60);
  check(
    'выбор облика сохраняется в профиле',
    active().chestSkin === 'sky' && skinCard('Небесный сундук').includes('Выбран'),
    `профиль: ${String(active().chestSkin)}; карточка: ${skinCard('Небесный сундук')}`,
  );
  click(btnText('Готово'));
  await sleep(40);

  // Мини-сундук (карточка заданий и кнопка открытия) носит цвета облика:
  // проверяем на готовом сундуке — закрытый рисуется «замком» без палитры.
  {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    root.render(createElement(ChestGlyph, { state: 'ready', skin: skinById('sky') }));
    await sleep(20);
    const fills = Array.from(host.querySelectorAll('path, rect')).map((el) => el.getAttribute('fill') ?? '');
    check(
      'мини-сундук носит цвета выбранного облика',
      fills.includes(skinById('sky').palette.lid) && fills.includes(skinById('sky').palette.body),
      fills.join(','),
    );
    root.unmount();
    host.remove();
  }
  check(
    'на главной видно, какой облик выбран сейчас',
    has('Облик:') && has('Небесный сундук'),
    document.body.textContent?.slice(0, 200) ?? '',
  );

  // Сцена открытия — тот же облик: закрываем бонусный сундук за урок.
  store().finishLesson(LESSONS[0].id, 100);
  await sleep(80);
  click(btnText('Открыть бонусный сундук'));
  await sleep(60);
  const ceremonySources = Array.from(document.querySelectorAll<HTMLImageElement>('.chest-art-image')).map(
    (img) => img.getAttribute('src') ?? '',
  );
  check(
    'сцена открытия показывает выбранный ребёнком облик',
    ceremonySources.some((src) => src.includes('/illustrations/chests/sky-closed.webp')) &&
      ceremonySources.some((src) => src.includes('/illustrations/chests/sky-open.webp')),
    ceremonySources.join(', '),
  );
  click(btnText('Пропустить'));
  await sleep(30);
  check(
    'в чеке награды видно, какой облик открыт и что ждёт дальше',
    has('Небесный сундук') && has('до «Ледяной сундук»'),
    document.querySelector('.chest-ceremony-result')?.textContent ?? '',
  );
  click(btnText('Здорово!'));
  await sleep(40);

  // Базовая проверка полки после награды: облик остался выбранным, не сбросился.
  check(
    'после награды облик остаётся выбранным',
    active().chestSkin === 'sky' && has('Облик:') ,
    document.body.textContent?.slice(0, 200) ?? '',
  );
  const closeTab = buttons().find((b) => (b.textContent ?? '').includes('Уроки'));
  click(closeTab);
  await sleep(40);
}

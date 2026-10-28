// «Мой мир» через настоящий UI (0.71.1): неполученное не ставится, БУК стоит.
// Чистые правила — tests/world.test.ts; здесь — что видит ребёнок:
// список выбора содержит только полученное, клик по полученному ставит его
// на сцену, а прямая попытка поставить неполученное через стор — 'locked'.
import type { Profile } from '../src/types';
import { useApp } from '../src/state/store';
import { btnText, buttons, check, click, has, sleep } from './ui-helpers';

const store = () => useApp.getState();

function active(): Profile {
  const s = store();
  const p = s.profiles.find((x) => x.id === s.activeId);
  if (!p) throw new Error('мир: нет активного профиля');
  return p;
}

async function goTab(name: string) {
  const tab = buttons().find((b) => (b.textContent ?? '').includes(name) && b.className.includes('tab'));
  click(tab);
  await sleep(60);
}

export async function runWorldUiChecks() {
  console.log('\n── «Мой мир»: только полученное, БУК стоит ──');

  store().createProfile('Тест мира', '🌍');
  await sleep(60);

  // Получено: машина «Болид» и собранный костюм «Тёмный лорд».
  // Не получено: «Молния», костюм «Белый воин» — и устаревшая запись мира,
  // будто вещь уже сдали обратно (мир хранит 'car-bugatti').
  useApp.setState((s) => ({
    profiles: s.profiles.map((p) =>
      p.id === s.activeId
        ? {
            ...p,
            shop: {
              ...p.shop!,
              owned: ['car-racer'],
              crystalCostumesOwned: [],
              world: ['car-bugatti'],
              buildingsOwned: [],
              worldBase: null,
              activeBuilding: null,
            },
            puzzle: { pieces: {}, collecting: null, assembled: ['dark-lord'], worn: null },
          }
        : p,
    ),
  }));
  await sleep(60);

  // Прямая попытка поставить неполученное — отказ, мир не меняется.
  check('мир: стор не ставит некупленную машину', store().toggleWorld('car-bugatti') === 'locked');
  check('мир: стор не ставит несобранный костюм', store().toggleWorld('snow-guard') === 'locked');

  await goTab('БУК');
  click(buttons().find((b) => b.getAttribute('aria-label') === 'Открыть Мой мир'));
  await sleep(60);
  check('мир: вкладка открылась', has('Мой мир') && !!document.querySelector('.world-screen'), document.body.textContent?.slice(0, 160) ?? '');
  check('мир: устаревшее неполученное не показывается на сцене', !document.querySelector('.world-slot .world-slot-title')?.textContent?.includes('Молния'));

  click(btnText('Выбрать вещи'));
  await sleep(60);
  const picker = document.querySelector('.world-picker')?.textContent ?? '';
  check('мир: в выборе есть купленная машина', picker.includes('Болид'), picker.slice(0, 200));
  check('мир: в выборе есть собранный костюм', picker.includes('Тёмный лорд'), picker.slice(0, 200));
  check('мир: в выборе нет некупленной машины', !picker.includes('Молния'));
  check('мир: в выборе нет несобранного костюма', !picker.includes('Белый воин'));
  check('мир: в выборе нет баз (они — фон, а не вещь)', !picker.includes('Ядерная база'));

  // Ставим купленное — оно появляется на сцене.
  const pick = buttons().find((b) => (b.textContent ?? '').includes('Болид') && b.className.includes('world-pick-item'));
  click(pick);
  await sleep(60);
  check('мир: купленное встало на сцену', (active().shop?.world ?? []).includes('car-racer'), JSON.stringify(active().shop?.world));
  check('мир: сцена показывает поставленное', (document.querySelector('.world-slot-title')?.textContent ?? '').includes('Болид'));

  // БУК в костюме на сцене — обычный элемент потока, без плавающей анимации:
  // класс .mascot внутри мира глушится правилом position:static/animation:none
  // (само правило сверяет tests/world.test.ts по CSS; здесь — что сова в DOM сцены).
  const costumePick = buttons().find((b) => (b.textContent ?? '').includes('Тёмный лорд') && b.className.includes('world-pick-item'));
  click(costumePick);
  await sleep(60);
  const slotMascot = document.querySelector('.world-slot-art .mascot');
  check('мир: БУК в костюме стоит на сцене мира', !!slotMascot);
}

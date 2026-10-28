// «Мой мир»: вся коллекция, три уровня увеличения, снимок и возврат в прежнюю полку.
import { MUSIC_TRACKS } from '../src/engine/music';
import { SHOP_ITEMS } from '../src/engine/shop';
import { SOUND_PACKS } from '../src/engine/sounds';
import type { Profile } from '../src/types';
import { useApp } from '../src/state/store';
import { buttons, check, click, has, sleep } from './ui-helpers';

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
  console.log('\n── «Мой мир»: полная коллекция, обзор и увеличение ──');
  store().createProfile('Тест мира', '🌍');
  await sleep(60);

  const toy = SHOP_ITEMS.find((item) => item.id === 'car-racer');
  const outfit = SHOP_ITEMS.find((item) => item.kind !== 'toy');
  const music = MUSIC_TRACKS.find((track) => track.price > 0) ?? MUSIC_TRACKS[0];
  const sound = SOUND_PACKS.find((pack) => pack.price > 0) ?? SOUND_PACKS[0];
  if (!toy || !outfit || !music || !sound) throw new Error('мир: не найдены тестовые предметы каталога');

  // Делаем профиль с вещами из всех типов коллекции. Старая настройка сцены
  // остаётся в данных, но больше не ограничивает то, что видно в «Моём мире».
  useApp.setState((s) => ({
    profiles: s.profiles.map((p) => p.id === s.activeId
      ? {
          ...p,
          shop: {
            ...p.shop!,
            owned: [toy.id, outfit.id],
            musicOwned: [music.id],
            soundOwned: [sound.id],
            buildingsOwned: ['atomic-base'],
            world: [],
            worldBase: null,
            activeBuilding: null,
          },
          puzzle: { pieces: {}, collecting: null, assembled: ['dark-lord'], worn: null },
        }
      : p),
  }));
  await sleep(60);

  await goTab('БУК');
  click(buttons().find((b) => b.className.includes('chip') && (b.textContent ?? '').includes('Техника')));
  await sleep(30);
  click(buttons().find((b) => b.getAttribute('role') === 'tab' && (b.textContent ?? '').includes('Мой мир')));
  await sleep(60);

  check('мир: открылся внутри БУКа, не отдельным пунктом нижнего меню', !!document.querySelector('.my-world') && !Array.from(document.querySelectorAll('.tabs .tab')).some((b) => (b.textContent ?? '').includes('Мой мир')));
  check('мир: карта показывает все приобретённые области', ['Образы', 'Техника', 'Базы', 'Музыка', 'Звуки', 'Оформление'].every((name) => Array.from(document.querySelectorAll('.collection-area')).some((area) => (area.textContent ?? '').includes(name))), document.querySelector('.collection-map')?.textContent?.slice(0, 250) ?? '');
  check('мир: бывший ангар стал областью «Техника»', Array.from(document.querySelectorAll('.collection-area')).some((area) => (area.getAttribute('aria-label') ?? '').startsWith('Техника:')));
  check('мир: есть снимок для показа друзьям', !!buttons().find((b) => (b.textContent ?? '').includes('Снимок')));

  const techArea = buttons().find((b) => (b.getAttribute('aria-label') ?? '').startsWith('Техника:'));
  click(techArea);
  await sleep(30);
  check('мир: увеличение области показывает купленную технику', (document.querySelector('.collection-zoom')?.textContent ?? '').includes(toy.title));

  click(buttons().find((b) => (b.getAttribute('aria-label') ?? '').includes(`Увеличить: ${toy.title}`)));
  await sleep(30);
  check('мир: отдельная покупка открывается крупно', (document.querySelector('.collection-detail')?.textContent ?? '').includes(toy.title));
  click(buttons().find((b) => (b.textContent ?? '').includes('К области')));
  await sleep(20);
  click(buttons().find((b) => (b.textContent ?? '').includes('К карте')));
  await sleep(20);
  click(buttons().find((b) => (b.textContent ?? '').includes('Назад в БУК')));
  await sleep(60);
  check('мир: явный возврат вернул в БУК на прежнюю полку «Техника»', !!document.querySelector('.shop-cats .chip.on') && (document.querySelector('.shop-cats .chip.on')?.textContent ?? '').includes('Техника'));
}

// Защита накоплений (0.36.0): «кристаллы списались, а товара нет».
//
// Проверяем не намерение, а последствия — на настоящем сторе с настоящим
// IndexedDB (fake-indexeddb):
//  1) перед списанием снимается копия записи, в которой кристаллы ещё целы;
//  2) покупка и копия ложатся в базу, повторная проверка ничего не откатывает;
//  3) если запись о покупке НЕ легла (квота/приватный режим/вторая копия
//     приложения) — состояние возвращается к копии, кристаллы на месте,
//     ребёнок видит честное сообщение, а не «твой!» без вещи;
//  4) родитель может вернуть копию «до покупки» руками.
import './setup';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../src/App';
import { useApp } from '../src/state/store';
import { idbStorage } from '../src/platform/storage';
import { MAIN_KEY, PURCHASE_KEY, readPurchaseArchive } from '../src/platform/vault';
import { btn, check, click, failureCount, has, sleep } from './ui-helpers';
import { runGemResetGuardChecks } from './gem-reset-guard.test';

const store = () => useApp.getState();
const active = () => {
  const s = store();
  const p = s.profiles.find((x) => x.id === s.activeId);
  if (!p) throw new Error('защита покупок: нет активного профиля');
  return p;
};

function archiveProfile(raw: string | null) {
  const parsed = JSON.parse(raw ?? '{}') as {
    state?: { profiles?: Array<{ id: string; gems: number; shop?: { owned?: string[] } }> };
  };
  return parsed.state?.profiles?.[0] ?? null;
}

export async function runPurchaseGuardChecks(): Promise<void> {
  // Как в main.tsx: сначала читаем сохранённое, потом работаем — иначе
  // фоновая гидратация затрёт только что созданный профиль.
  await Promise.resolve(useApp.persist.rehydrate()).catch(() => undefined);
  await sleep(60);

  // Чистый стенд: один профиль, 200 кристаллов, пустая коллекция.
  store().createProfile('Защита', '🦊');
  await sleep(40);
  const id = store().activeId!;
  useApp.setState((s) => ({
    profiles: s.profiles.map((p) =>
      p.id === id ? { ...p, gems: 200, shop: { ...p.shop!, owned: [], equipped: {} } } : p,
    ),
  }));
  await sleep(60);

  // ── 1. Копия «до списания» ────────────────────────────────────────────────
  const bought = store().buyItem('laptop-air');
  await sleep(200);
  const archive = archiveProfile(await readPurchaseArchive());
  const meta = store().vault.purchase;
  const afterBuy = active();

  check('ноутбук куплен', bought && (afterBuy.shop?.owned ?? []).includes('laptop-air'), `bought=${bought}`);
  check('кристаллы списаны ровно на цену', afterBuy.gems === 90, `гемов: ${afterBuy.gems}`);
  check(
    'копия перед покупкой снята ДО списания',
    !!archive && archive.gems === 200 && !(archive.shop?.owned ?? []).includes('laptop-air'),
    JSON.stringify(archive?.gems) + ' / ' + JSON.stringify(archive?.shop?.owned),
  );
  check(
    'в сейфе есть метка покупки',
    !!meta && meta.label === 'Невесомый Air' && meta.gemsBefore === 200 && meta.gemsAfter === 90,
    JSON.stringify(meta),
  );
  const recordAfterBuy = (await idbStorage.getItem(MAIN_KEY)) ?? '';
  check('покупка правда в базе', recordAfterBuy.includes('laptop-air'), '');
  check('отката не было', store().toast?.title !== 'Покупка не сохранилась', JSON.stringify(store().toast));

  // ── 2. Запись не удалась → покупка отменяется, кристаллы возвращаются ─────
  // Ломаем запись основной записи на время покупки — как квота или приватный
  // режим: в памяти всё происходит, в базу не ложится ничего.
  const realSetItem = idbStorage.setItem.bind(idbStorage);
  let storageBroken = true;
  idbStorage.setItem = async (name: string, value: string) => {
    if (name === MAIN_KEY && storageBroken) {
      throw new Error('QuotaExceededError: диск переполнен');
    }
    return realSetItem(name, value);
  };

  const gemsBeforeFail = active().gems;
  const boughtWithFailure = store().buyItem('phone-smart');
  await sleep(50);
  check(
    'покупка применилась в памяти (ребёнок видит вещь сразу)',
    boughtWithFailure && (active().shop?.owned ?? []).includes('phone-smart'),
    '',
  );
  await sleep(900); // проверка записи + повторная попытка через 400 мс
  storageBroken = false;
  idbStorage.setItem = realSetItem;

  const afterFail = active();
  check(
    'сбой записи: кристаллы вернулись',
    afterFail.gems === gemsBeforeFail,
    `${gemsBeforeFail} → ${afterFail.gems}`,
  );
  check(
    'сбой записи: вещи нет в коллекции',
    !(afterFail.shop?.owned ?? []).includes('phone-smart'),
    JSON.stringify(afterFail.shop?.owned),
  );
  check(
    'ребёнок увидел честное сообщение, а не «твой!»',
    store().toast?.title === 'Покупка не сохранилась',
    JSON.stringify(store().toast),
  );
  check(
    'сбой записан в журнал сейфа',
    store().vault.log.some((e) => e.kind === 'purchase-failed'),
    store().vault.log.map((e) => e.kind).join(','),
  );

  // ── 3. Возврат копии «до покупки» руками ──────────────────────────────────
  // Копия — состояние перед неудавшейся покупкой: ноутбук на месте, телефона нет.
  const restored = await store().restorePurchaseArchive();
  await sleep(120);
  const afterRestore = active();
  check('родитель вернул копию «до покупки»', restored, '');
  check(
    'после возврата: ноутбук цел, телефон не куплен',
    (afterRestore.shop?.owned ?? []).includes('laptop-air') && !(afterRestore.shop?.owned ?? []).includes('phone-smart'),
    JSON.stringify(afterRestore.shop?.owned),
  );
  check(
    'возврат отмечен в журнале',
    store().vault.log.some((e) => e.kind === 'purchase-restore'),
    store().vault.log.map((e) => e.kind).join(','),
  );

  // Ключ копии живёт отдельно: иначе откат затирал бы сам себя.
  const archiveRaw = await idbStorage.getItem(PURCHASE_KEY);
  check('копия хранится отдельным ключом', !!archiveRaw && archiveRaw.length > 0, '');

  // ── 4. Экран: купленная техника сразу видна там, где она живёт ────────────
  // Именно этой части не хватало: техника не рисуется на БУКе, а диалог
  // обещал, что покупка «появится рядом с БУКом». Ребёнок покупал ноутбук,
  // смотрел на БУКа и не находил вещь.
  document.body.innerHTML = '<div id="root"></div>';
  const root = createRoot(document.getElementById('root')!);
  root.render(createElement(App));
  await sleep(200);

  click(btn((b) => (b.textContent ?? '').includes('БУК') && b.className.includes('tab')));
  await sleep(80);
  click(btn((b) => (b.textContent ?? '').includes('Техника') && b.className.includes('chip')));
  await sleep(80);
  click(btn((b) => (b.textContent ?? '').includes('Телефоны')));
  await sleep(80);

  const phoneCard = Array.from(document.querySelectorAll('.shop-item')).find((c) =>
    (c.textContent ?? '').includes('iPhone Air'),
  );
  const phoneBuy = Array.from(phoneCard?.querySelectorAll('button') ?? []).find((b) =>
    (b.textContent ?? '').includes('Купить'),
  );
  click(phoneBuy);
  await sleep(80);
  check(
    'диалог не обещает вещь «рядом с БУКом»',
    !has('рядом с БУКом') && has('Мой мир'),
    document.body.textContent?.slice(0, 200) ?? '',
  );
  click(btn((b) => (b.textContent ?? '').includes('Купить за')));
  await sleep(200);
  check('после покупки техники открылась карта «Моего мира»', !!document.querySelector('.my-world'), '');
  check(
    'купленный телефон сразу виден в области техники',
    Array.from(document.querySelectorAll('.collection-area')).some((area) => (area.textContent ?? '').includes('iPhone Air')),
    document.querySelector('.collection-map')?.textContent?.slice(0, 160) ?? '',
  );
  root.unmount();
  await runGemResetGuardChecks();

  const failures = failureCount();
  console.log(failures ? `\n✗ ошибок: ${failures}` : '\n✓ защита покупок: все проверки пройдены');
}

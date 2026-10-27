// Регрессии обнуления: чтение, начатое до сброса, и поздний откат покупки
// не должны возвращать кристаллы. Используется реальный стор и fake IndexedDB.
import { useApp } from '../src/state/store';
import { idbStorage } from '../src/platform/storage';
import { MAIN_KEY } from '../src/platform/vault';
import { check, sleep } from './ui-helpers';

const state = () => useApp.getState();
const current = (id: string) => state().profiles.find((p) => p.id === id)!;

async function savedProfile(id: string) {
  const raw = await idbStorage.getItem(MAIN_KEY);
  const data = JSON.parse(raw ?? '{}') as { state?: { profiles?: Array<{ id: string; gems: number; xp: number }> } };
  return data.state?.profiles?.find((p) => p.id === id);
}

export async function runGemResetGuardChecks(): Promise<void> {
  console.log('\n── Сброс кристаллов: синхронизация и проверка покупок ──');
  state().createProfile('Сброс', '🦊');
  const id = state().activeId!;
  state().addGems(200);
  state().addXp(500);
  await sleep(150);

  // Возврат из фона уже начал чтение старой записи; сброс происходит, пока
  // оно ещё в очереди. До исправления и память, и IndexedDB снова получали 200.
  const fullSync = useApp.persist.rehydrate();
  state().resetProfile(id);
  await fullSync;
  await sleep(150);
  const fullSaved = await savedProfile(id);
  check('полный сброс не отменяется чтением, начатым до сброса',
    current(id).gems === 0 && current(id).xp === 0 && fullSaved?.gems === 0 && fullSaved.xp === 0,
    `в памяти: ${current(id).gems}, на диске: ${fullSaved?.gems}`);

  state().addGems(123);
  state().addXp(300);
  await sleep(150);
  const gemsSync = useApp.persist.rehydrate();
  state().resetGems(id);
  await gemsSync;
  await sleep(150);
  const gemsSaved = await savedProfile(id);
  check('отдельный сброс не отменяется чтением, начатым до сброса',
    current(id).gems === 0 && current(id).xp === 300 && gemsSaved?.gems === 0 && gemsSaved.xp === 300,
    `в памяти: ${current(id).gems}, на диске: ${gemsSaved?.gems}`);

  const trashCount = state().vault.trash.length;
  state().resetGems(id);
  state().resetGems('нет-такого-профиля');
  check('повторный сброс нулевого баланса и неизвестный профиль не создают копий',
    current(id).gems === 0 && state().vault.trash.length === trashCount);

  // Чтение, начатое уже после сброса, должно стоять в очереди за записью.
  state().addGems(40);
  await sleep(100);
  state().resetGems(id);
  await useApp.persist.rehydrate();
  await sleep(100);
  check('синхронизация сразу после сброса читает новый баланс',
    current(id).gems === 0 && (await savedProfile(id))?.gems === 0);

  const realSetItem = idbStorage.setItem.bind(idbStorage);
  let blockMainWrites = false;
  idbStorage.setItem = async (name, value) => {
    if (name === MAIN_KEY && blockMainWrites) throw new Error('временный сбой записи');
    return realSetItem(name, value);
  };
  try {
    // Покупка не записалась, а затем родитель полностью сбросил профиль.
    // Повторная проверка покупки через 400 мс не должна воскресить старый баланс.
    state().resetProfile(id);
    state().addGems(200);
    useApp.setState({ toast: null });
    await sleep(150);
    const failedBefore = state().vault.log.filter((e) => e.kind === 'purchase-failed').length;
    blockMainWrites = true;
    const boughtBeforeFull = state().buyItem('laptop-air');
    await sleep(100);
    blockMainWrites = false;
    state().resetProfile(id);
    await useApp.persist.rehydrate(); // метка сброса должна сохраниться и после чтения
    await sleep(800);
    const savedAfterFull = await savedProfile(id);
    check('поздний откат несохранённой покупки не отменяет полный сброс',
      boughtBeforeFull && current(id).gems === 0 && current(id).shop?.owned.length === 0 &&
        savedAfterFull?.gems === 0 && state().vault.log.filter((e) => e.kind === 'purchase-failed').length === failedBefore,
      `в памяти: ${current(id).gems}, на диске: ${savedAfterFull?.gems}`);

    // Другая вкладка записала сброс, но сообщение о нём ещё не доставлено.
    // Проверка покупки должна увидеть метку в базе и сама перечитать профиль.
    for (const kind of ['full', 'gems'] as const) {
      state().resetProfile(id);
      state().addGems(200);
      state().addXp(300);
      await sleep(150);
      blockMainWrites = true;
      const bought = state().buyItem('laptop-air');
      await sleep(100);
      const raw = JSON.parse((await idbStorage.getItem(MAIN_KEY)) ?? '{}');
      const remote = raw.state.profiles.find((p: { id: string }) => p.id === id);
      const remoteResetId = `other-tab-${kind}`;
      remote.gems = 0;
      remote.gemsResetId = remoteResetId;
      if (kind === 'full') {
        remote.xp = 0;
        remote.progressResetId = remoteResetId;
      }
      blockMainWrites = false;
      await realSetItem(MAIN_KEY, JSON.stringify(raw));
      await sleep(800);
      const disk = await savedProfile(id);
      check(`откат покупки не затирает ${kind === 'full' ? 'полный сброс' : 'сброс кристаллов'} из другой вкладки`,
        bought && current(id).gems === 0 && current(id).xp === (kind === 'full' ? 0 : 300) &&
          current(id).gemsResetId === remoteResetId && !current(id).shop?.owned.includes('laptop-air') && disk?.gems === 0,
        `в памяти: ${current(id).gems}, на диске: ${disk?.gems}`);
    }

    // При сбросе только баланса неудавшаяся покупка всё же отменяется, но
    // обнуление и заработанные после него кристаллы должны остаться нетронуты.
    state().resetProfile(id);
    state().addGems(200);
    state().addXp(300);
    useApp.setState({ toast: null });
    await sleep(150);
    blockMainWrites = true;
    const boughtBeforeGems = state().buyItem('laptop-air');
    await sleep(100);
    state().resetGems(id);
    state().addGems(7);
    await sleep(800);
    check('откат покупки после сброса сохраняет новый баланс и отменяет товар',
      boughtBeforeGems && current(id).gems === 7 && current(id).xp === 300 &&
        !current(id).shop?.owned.includes('laptop-air') &&
        state().toast?.text?.includes('Баланс после обнуления не изменился') === true,
      `баланс: ${current(id).gems}, покупки: ${current(id).shop?.owned.join(',')}`);
    blockMainWrites = false;
    state().retrySave();
    await sleep(180);
    await useApp.persist.rehydrate();
    await sleep(100);
    check('баланс после сброса и исправленного сбоя сохраняется на диск',
      current(id).gems === 7 && (await savedProfile(id))?.gems === 7);
  } finally {
    blockMainWrites = false;
    idbStorage.setItem = realSetItem;
  }
}

// Кнопки сброса в родительском разделе: подтверждение, изоляция профилей,
// сохранение в IndexedDB и возможность вернуть копию профиля.
import { useApp } from '../src/state/store';
import { idbStorage } from '../src/platform/storage';
import { MAIN_KEY } from '../src/platform/vault';
import { body, btnText, buttons, check, click, has, sleep } from './ui-helpers';

const state = () => useApp.getState();
const profile = (id: string) => state().profiles.find((p) => p.id === id);

async function savedProfile(id: string) {
  const raw = await idbStorage.getItem(MAIN_KEY);
  const record = JSON.parse(raw ?? '{}') as { state?: { profiles?: Array<{ id: string; gems: number; xp: number }> } };
  return record.state?.profiles?.find((p) => p.id === id);
}

/** Вызывается, когда уже открыт раздел «Родителям → Ещё → Данные». */
export async function runGemResetUiChecks(reopenParentData: () => Promise<void>): Promise<void> {
  const saved = { profiles: state().profiles, activeId: state().activeId, vault: state().vault };
  const id = saved.activeId;
  const previous = saved.profiles.find((p) => p.id === id);
  if (!id || !previous) throw new Error('сброс кристаллов: нет активного профиля');

  const otherId = 'gem-reset-other-profile';
  const originalConfirm = globalThis.confirm;
  const originalWindowConfirm = window.confirm;
  let confirmed = false;
  const prompts: string[] = [];
  const confirmStub = (message?: string) => {
    prompts.push(message ?? '');
    return confirmed;
  };
  globalThis.confirm = confirmStub;
  window.confirm = confirmStub;

  try {
    useApp.setState((s) => ({
      profiles: [
        ...s.profiles.map((p) => p.id === id
          ? { ...p, gems: 123, xp: 450, streak: 4, shop: { ...p.shop!, owned: ['laptop-air'], equipped: {} } }
          : p),
        { ...previous, id: otherId, name: 'Другой ребёнок', gems: 77 },
      ],
    }));
    await sleep(120);
    const before = profile(id)!;
    const otherBefore = profile(otherId)!;
    const trashBefore = state().vault.trash.length;
    const resetButton = btnText('Обнулить кристаллы');
    check('отдельная кнопка сброса кристаллов показывает баланс и последствия',
      !!resetButton && !resetButton.disabled && has('123 💎') && has('слова, XP, серия и покупки сохранятся'),
      body().slice(-400));
    if (!resetButton) return;

    click(resetButton);
    await sleep(40);
    check('отмена сброса кристаллов ничего не меняет',
      profile(id)?.gems === 123 && state().vault.trash.length === trashBefore &&
        prompts.at(-1)?.includes('123 💎') === true && prompts.at(-1)?.includes('покупки сохранятся') === true);

    confirmed = true;
    click(resetButton);
    await sleep(100);
    const after = profile(id)!;
    check('обнуление меняет только баланс выбранного профиля',
      after.gems === 0 &&
        JSON.stringify({ ...after, gems: before.gems, gemsResetId: before.gemsResetId }) === JSON.stringify(before) &&
        JSON.stringify(profile(otherId)) === JSON.stringify(otherBefore),
      `балансы: ${after.gems}, ${profile(otherId)?.gems}`);
    check('при нулевом балансе кнопка недоступна и показан новый баланс',
      btnText('Обнулить кристаллы')?.disabled === true && has('0 💎'));
    check('перед обнулением создана подписанная копия профиля',
      state().vault.trash.some((t) => t.reason === 'gems-reset' && t.profile.id === id && t.profile.gems === 123) &&
        state().vault.log.some((entry) => entry.kind === 'gems-reset') && has('до обнуления кристаллов'));

    await useApp.persist.rehydrate();
    await sleep(100);
    const stored = await savedProfile(id);
    check('нулевой баланс переживает сохранение и повторное чтение',
      profile(id)?.gems === 0 && profile(id)?.xp === 450 && stored?.gems === 0 && stored.xp === 450 &&
        profile(id)?.shop?.owned.includes('laptop-air') === true && profile(otherId)?.gems === 77,
      `в памяти: ${profile(id)?.gems}, на диске: ${stored?.gems}`);

    const homeTab = buttons().find((button) =>
      (button.textContent ?? '').includes('Уроки') && button.className.includes('tab'),
    );
    if (homeTab) {
      click(homeTab);
      await sleep(80);
      check('на главной ребёнок сразу видит нулевой баланс',
        !!document.querySelector('.topbar-stat.gems[aria-label="Кристаллы: 0"]'));
      await reopenParentData();
    } else {
      check('на главной ребёнок сразу видит нулевой баланс', false, 'вкладка уроков не найдена');
    }

    const backupRow = Array.from(document.querySelectorAll('.kv')).find((row) =>
      (row.textContent ?? '').includes('до обнуления кристаллов'),
    );
    const restore = backupRow?.querySelector('button');
    check('копию до сброса можно найти в корзине', !!restore);
    if (restore) {
      confirmed = false;
      click(restore);
      await sleep(30);
      check('возврат копии предупреждает о замене всего профиля и допускает отмену',
        profile(id)?.gems === 0 && prompts.at(-1)?.includes('Текущий прогресс') === true);
      confirmed = true;
      click(restore);
      await sleep(100);
      check('из копии восстанавливаются прежние кристаллы и покупки',
        profile(id)?.gems === 123 && profile(id)?.xp === 450 && profile(id)?.shop?.owned.includes('laptop-air') === true);
    }

    const fullReset = btnText('Сбросить прогресс');
    check('полный сброс доступен отдельно', !!fullReset);
    if (fullReset) {
      confirmed = false;
      click(fullReset);
      await sleep(30);
      check('отмена полного сброса сохраняет кристаллы',
        profile(id)?.gems === 123 && prompts.at(-1)?.includes('кристаллы и покупки') === true);
      confirmed = true;
      click(fullReset);
      await sleep(100);
      await useApp.persist.rehydrate();
      await sleep(100);
      const fresh = profile(id);
      const persisted = await savedProfile(id);
      check('полный сброс обнуляет и кристаллы, и прогресс после перезапуска',
        fresh?.gems === 0 && fresh.xp === 0 && fresh.streak === 0 && Object.keys(fresh.words).length === 0 &&
          fresh.shop?.owned.length === 0 && persisted?.gems === 0 && persisted.xp === 0 && profile(otherId)?.gems === 77,
        `в памяти: ${fresh?.gems}, на диске: ${persisted?.gems}`);
    }
  } finally {
    globalThis.confirm = originalConfirm;
    window.confirm = originalWindowConfirm;
    // Остальные смоук-сценарии продолжают работать с исходным профилем.
    useApp.setState(saved);
    await sleep(100);
  }
}

import { prevDay } from '../src/engine/day';
import { dayKey, useApp } from '../src/state/store';
import { body, btn, btnText, buttons, check, click, has, sleep } from './ui-helpers';

export async function runPretestAuditChecks(): Promise<void> {
  console.log('\n── Предтестовый аудит: UX, навигация, серия и обновления ──');

  // Сбрасываем в предсказуемое состояние с одним профилем на главной
  const tabHome = buttons().find((b) => (b.textContent ?? '').includes('Уроки') && b.className.includes('tab'));
  if (tabHome) {
    click(tabHome);
    await sleep(40);
  }

  // 1. БУК виден на главных вкладках
  check(
    'аудит: БУК виден на главной вкладке',
    document.querySelectorAll('.app > .mascot').length === 1,
    `mascot: ${document.querySelectorAll('.app > .mascot').length}`,
  );

  // 2. Открытие экрана профилей и выход через нижние вкладки + защита удаления ConfirmDialog
  const avatarBtn = document.querySelector('.topbar .avatar')?.closest('button');
  click(avatarBtn);
  await sleep(40);
  check('аудит: открыт экран выбора ученика', has('Кто будет учиться?'), body().slice(0, 140));

  const deleteBtn = btn((b) => (b.textContent ?? '').trim() === '🗑');
  click(deleteBtn);
  await sleep(40);
  check(
    'аудит: удаление профиля защищено ConfirmDialog («Оставить профиль»)',
    has('Удалить профиль') && has('Оставить профиль'),
    body().slice(-200),
  );
  click(btnText('Оставить профиль'));
  await sleep(40);
  check(
    'аудит: отмена удаления сохраняет профиль',
    useApp.getState().profiles.length >= 1 && !has('Оставить профиль'),
    '',
  );

  // Тап по нижней вкладке закрывает экран профилей
  const tabWords = buttons().find((b) => (b.textContent ?? '').includes('Слова') && b.className.includes('tab'));
  click(tabWords);
  await sleep(40);
  check(
    'аудит: нижние вкладки закрывают экран профилей',
    !has('Кто будет учиться?') && has('Словарик'),
    body().slice(0, 140),
  );

  // 3. Раздел «Родителям» автоматически блокируется при уходе на другую вкладку
  const tabParent = buttons().find((b) => (b.textContent ?? '').includes('Родителям') && b.className.includes('tab'));
  click(tabParent);
  await sleep(40);
  const equation = document.body.textContent?.match(/(\d+) × (\d+) = \?/);
  const answerInput = document.querySelector('input.input') as HTMLInputElement | null;
  if (equation && answerInput) {
    const value = String(Number(equation[1]) * Number(equation[2]));
    const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setValue?.call(answerInput, value);
    answerInput.dispatchEvent(new window.Event('input', { bubbles: true }));
    await sleep(20);
    click(btnText('Войти'));
    await sleep(40);
  }
  check('аудит: раздел родителей разблокирован', has('Размер урока'), '');
  click(tabHome);
  await sleep(40);
  click(tabParent);
  await sleep(40);
  check(
    'аудит: после ухода со вкладки раздел родителей снова заблокирован',
    has('Раздел для взрослых') && !has('Размер урока'),
    body().slice(0, 160),
  );
  click(tabHome);
  await sleep(40);

  // 4. Вход в урок и мгновенный выход (✕) без единого ответа не тратит день/серию,
  //    а первое действие в уроке обновляет серию и начисляет +1 💎 за кратность 3 дням.
  const today = dayKey();
  const yesterday = prevDay(today);
  const activeId = useApp.getState().activeId!;
  useApp.setState((s) => ({
    profiles: s.profiles.map((p) =>
      p.id === activeId ? { ...p, lastDay: yesterday, streak: 2, gems: 10, freezes: 1 } : p,
    ),
  }));
  await sleep(30);

  const startBtn =
    (document.querySelector('.node-btn.current') as HTMLButtonElement | null) ??
    (document.querySelector('.node-btn') as HTMLButtonElement | null);
  click(startBtn);
  await sleep(50);

  check(
    'аудит: во время карточек урока плавающий БУК скрыт',
    document.querySelectorAll('.app > .mascot').length === 0,
    '',
  );

  // Мгновенный выход без единого ответа
  const exitBtn = document.querySelector('.lesson-exit');
  click(exitBtn);
  await sleep(40);
  const afterQuickExit = useApp.getState().profiles.find((p) => p.id === activeId)!;
  check(
    'аудит: мгновенный выход из урока не меняет lastDay, серию и кристаллы',
    afterQuickExit.lastDay === yesterday && afterQuickExit.streak === 2 && afterQuickExit.gems === 10,
    `${afterQuickExit.lastDay} / streak=${afterQuickExit.streak} / gems=${afterQuickExit.gems}`,
  );

  // Теперь снова открываем урок и делаем первое действие — серия становится 3, начисляется +1 💎
  const startBtn2 =
    (document.querySelector('.node-btn.current') as HTMLButtonElement | null) ??
    (document.querySelector('.node-btn') as HTMLButtonElement | null);
  click(startBtn2);
  await sleep(50);
  const firstAction =
    btnText('Запомнил') ??
    (document.querySelector('.syllable') as HTMLButtonElement | null) ??
    (document.querySelector('.option') as HTMLButtonElement | null) ??
    (document.querySelector('.letter') as HTMLButtonElement | null);
  if (firstAction) {
    click(firstAction);
    await sleep(40);
  }
  const afterFirstAction = useApp.getState().profiles.find((p) => p.id === activeId)!;
  check(
    'аудит: первое действие в уроке обновляет серию (2 → 3) и даёт +1 💎 за 3 дня подряд',
    afterFirstAction.lastDay === today && afterFirstAction.streak === 3 && afterFirstAction.gems === 11,
    `${afterFirstAction.lastDay} / streak=${afterFirstAction.streak} / gems=${afterFirstAction.gems}`,
  );

  // Выходим из урока на главную
  const exitBtn2 = document.querySelector('.lesson-exit');
  click(exitBtn2);
  await sleep(40);
  const leaveConfirm = btnText('Выйти');
  if (leaveConfirm) {
    click(leaveConfirm);
    await sleep(40);
  }

  // 5. Баннер обновления PWA («Доступно обновление») между уроками над нижней панелью вкладок
  window.dispatchEvent(new window.Event('slovo2:update'));
  await sleep(40);
  const updateBanner = Array.from(document.querySelectorAll('.footer-bar')).find((el) =>
    (el.textContent ?? '').includes('Доступно обновление'),
  ) as HTMLElement | undefined;
  check(
    'аудит: баннер «Доступно обновление» показан над нижней навигацией',
    !!updateBanner && updateBanner.style.bottom.includes('64px'),
    updateBanner?.style.bottom ?? 'нет баннера',
  );

  // 6. Санитизация импорта в replaceAll
  const snapshot = useApp.getState();
  const savedProfiles = snapshot.profiles;
  const savedActive = snapshot.activeId;
  const savedSettings = snapshot.settings;

  useApp.getState().replaceAll({
    profiles: [{ id: 'p_imported', name: 'Маша', avatar: '🐱', xp: -10, gems: 5 } as never],
    activeId: 'non_existent_id',
    settings: { dailyGoal: -50, theme: 'invalid' as never, sound: true, haptics: false },
  });
  const importedState = useApp.getState();
  const imp = importedState.profiles[0];
  check(
    'аудит: replaceAll нормализует некорректный импорт и выбирает существующий профиль',
    importedState.activeId === 'p_imported' &&
      imp.xp === 0 &&
      imp.gems === 5 &&
      typeof imp.words === 'object' &&
      Array.isArray(imp.shop?.owned) &&
      importedState.settings.dailyGoal === 120 &&
      importedState.settings.theme === 'auto' &&
      importedState.toast === null,
    JSON.stringify({ activeId: importedState.activeId, xp: imp?.xp, settings: importedState.settings }),
  );

  // Восстанавливаем исходный стейт
  useApp.setState({ profiles: savedProfiles, activeId: savedActive, settings: savedSettings, toast: null });
  await sleep(20);
}

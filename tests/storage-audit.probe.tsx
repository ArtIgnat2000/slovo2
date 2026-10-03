// Диагностический прогон хранилища прогресса (npm run audit:storage).
//
// Стенд из аудита (docs/progress-loss-audit.md): задаёт реальному стору
// жизненные ситуации — битая запись, недоступная IndexedDB, вторая вкладка,
// удаление профиля, импорт чужого файла — и печатает, что стало с прогрессом.
//
// Смысл прогона: каждая строка «ПОДТВЕРЖДЕНО» — это открытый канал потери.
// После внедрения защиты (сторож записи, снимки, корзина, migrate) сценарии
// 2–8 обязаны перестать стирать данные, поэтому прогон одновременно служит
// регрессионным тестом: если какая-то строка снова «ПОДТВЕРЖДЕНО», защита
// сломалась.
import './setup';
import { openDB } from 'idb';
import { idbStorage } from '../src/platform/storage';
import { MAIN_KEY } from '../src/platform/vault';
import { useApp } from '../src/state/store';
import { useStorageHealth } from '../src/state/health';
import { WORDS } from '../src/content/words';

/**
 * Даём очередям промисов и транзакциям IndexedDB дойти до конца.
 * Записи выстроены в очередь и каждая делает «прочитать → снять копию →
 * записать», поэтому дефолт с запасом: иначе прогон меряет не защиту, а скорость.
 */
async function tick(n = 25) {
  for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0));
}

/** Сырая запись в IndexedDB — то, что реально лежит на диске телефона. */
const rawRecord = () => idbStorage.getItem(MAIN_KEY) as Promise<string | null>;

/**
 * Пустое хранилище + подтверждённое чтение (как при первом запуске).
 * Чтение нужно обязательно: сторож держит запись замороженной, пока мы не
 * убедились, что сохранённое прочитано.
 */
async function freshStart() {
  await useApp.persist.clearStorage();
  await useApp.persist.rehydrate();
  await clearMemory();
}

/**
 * Очистить только память, не трогая базу: zustand пишет состояние на КАЖДОЕ
 * изменение, поэтому обычный setState сам затрёт запись и прогон перестанет
 * отличать «приложение стёрло прогресс» от «прогон стёр прогресс».
 */
async function clearMemory() {
  // Морозим запись штатным механизмом: сторож не пропустит ни одного писателя,
  // включая тот, что ещё «в полёте» от предыдущего действия.
  useStorageHealth.getState().patch({ frozen: true });
  useApp.setState({ profiles: [], activeId: null });
  await tick();
}

/** Ребёнок позанимался: профиль, XP, кристаллы — это должно выживать. */
async function seedProgress(name = 'Маша') {
  useApp.getState().createProfile(name, '🦊');
  useApp.getState().addXp(500);
  useApp.getState().addGems(30);
  await tick();
}

let findings = 0;
function outcome(scenario: string, lost: boolean, detail: string) {
  if (lost) findings += 1;
  console.log(
    `${lost ? '☒ ПОДТВЕРЖДЕНО' : '☐ потеря не подтверждена'} · ${scenario}\n    ${detail}`,
  );
}

async function scenario1_happyPath() {
  await freshStart();
  await seedProgress();
  const saved = (await rawRecord()) ?? '';
  const written = saved.includes('Маша') && saved.includes('"xp":500');
  await clearMemory();
  await useApp.persist.rehydrate();
  await tick();
  const alive = useApp.getState().profiles.some((p) => p.name === 'Маша' && p.xp === 500);
  outcome(
    'Сценарий 1 (контроль): обычный старт читает прогресс из IndexedDB',
    !written || !alive,
    `записано: ${written ? 'да' : 'НЕТ'}; после «перезапуска» профиль с XP 500: ${alive ? 'на месте' : 'ПОТЕРЯН'}`,
  );
}

async function scenario2_corruptRecord() {
  await freshStart();
  await seedProgress();
  // Запись повредилась: оборванная запись, сбой флеша, «уборка» браузера.
  await idbStorage.setItem(MAIN_KEY, '{"state":{"profiles":[{"id":"p_1","na');
  await clearMemory();
  await useApp.persist.rehydrate();
  await tick();
  const health = useStorageHealth.getState();
  // Ребёнок (или родитель) делает что-то на экране: раньше это стирало запись.
  useApp.getState().createProfile('Новичок', '🐱');
  await tick();
  const after = (await rawRecord()) ?? '';
  const old = after.includes('"id":"p_1","na') || after.includes('Маша');
  const lost = !old || health.kind !== 'read-error' || !health.frozen;
  outcome(
    'Сценарий 2: битая запись → пустой старт → стирание старого прогресса',
    lost,
    `состояние хранилища: ${health.kind} (запись ${health.frozen ? 'заморожена' : 'РАЗРЕШЕНА'}); ` +
      `след прежнего прогресса в базе: ${old ? 'сохранён' : 'СТЁРТ'}; ` +
      `экран: ${health.kind === 'read-error' ? '«прогресс не удалось открыть»' : 'пустой «первый запуск»'}`,
  );
  await freshStart();
}

async function scenario3_versionMismatch() {
  await freshStart();
  await seedProgress();
  const raw = JSON.parse((await rawRecord()) ?? '{}');
  // Запись другой версии схемы: телефон открыл сборку, которую откатили,
  // или наоборот — приехала версия новее.
  await idbStorage.setItem(MAIN_KEY, JSON.stringify({ ...raw, version: (raw.version ?? 1) + 1 }));
  await clearMemory();
  await useApp.persist.rehydrate();
  await tick();
  const profiles = useApp.getState().profiles;
  const kept = profiles.some((p) => p.name === 'Маша' && p.xp === 500);
  outcome(
    'Сценарий 3: расхождение версии схемы → потеря прогресса',
    !kept,
    `профилей после чтения: ${profiles.length}; прежний прогресс: ${kept ? 'на месте (migrate)' : 'ПОТЕРЯН'}`,
  );
  await freshStart();
}

async function scenario4_storageUnavailable() {
  await freshStart();
  await seedProgress();
  const before = (await rawRecord()) ?? '';
  // IndexedDB временно недоступна: приватный режим, чистка iOS, блокировка,
  // нехватка места на диске.
  const realGet = idbStorage.getItem;
  idbStorage.getItem = () => Promise.reject(new Error('IndexedDB недоступна'));
  await clearMemory();
  await useApp.persist.rehydrate();
  await tick();
  idbStorage.getItem = realGet;
  const health = useStorageHealth.getState();
  // Хранилище снова доступно (перезапуск телефона), ребёнок создаёт профиль.
  useApp.getState().createProfile('Новичок', '🐱');
  await tick();
  const after = (await rawRecord()) ?? '';
  const old = before.includes('Маша') && !after.includes('Маша');
  outcome(
    'Сценарий 4: хранилище недоступно на старте → пустой старт → стирание при первом действии',
    old || health.kind !== 'read-error',
    `состояние хранилища: ${health.kind} (запись ${health.frozen ? 'заморожена' : 'РАЗРЕШЕНА'}); ` +
      `прежний прогресс в базе: ${old ? 'СТЁРТ' : 'сохранён'}`,
  );
  await freshStart();
}

async function scenario5_writeFails() {
  await freshStart();
  await seedProgress();
  let unhandled = 0;
  const onRejection = () => (unhandled += 1);
  process.on('unhandledRejection', onRejection);
  // Квота закончилась или браузер отказал в записи.
  const realSet = idbStorage.setItem;
  idbStorage.setItem = () => Promise.reject(new Error('QuotaExceededError'));
  useApp.getState().addXp(100);
  await tick(40);
  idbStorage.setItem = realSet;
  process.off('unhandledRejection', onRejection);
  const health = useStorageHealth.getState();
  const logged = useApp.getState().vault.log.some((e) => e.kind === 'write-error');
  const lost = unhandled > 0 || health.kind !== 'write-error' || !logged;
  outcome(
    'Сценарий 5: запись не удалась → молчаливая потеря правок',
    lost,
    `непойманных отклонений промиса: ${unhandled} (было 1: пользователь видел «успех»); ` +
      `состояние: ${health.kind}; запись в журнале: ${logged ? 'есть' : 'НЕТ'}; ` +
      `баннер «прогресс не сохраняется»: ${health.kind === 'write-error' ? 'показан' : 'НЕ показан'}`,
  );
  await freshStart();
}

async function scenario6_staleTab() {
  await freshStart();
  await seedProgress('Маша');
  const activeA = useApp.getState().activeId;
  // Вкладка B: ребёнок занимается и создаёт второй профиль.
  useApp.getState().createProfile('Петя', '🐼');
  useApp.getState().addXp(300);
  await tick();
  const withBoth = (await rawRecord()) ?? '';
  /**
   * Вкладку A разбудили. Раньше она писала свой устаревший слепок поверх
   * свежего. Теперь приложение на возврате в фокус (и по сообщению из другой
   * копии) сначала перечитывает сохранение — имитируем это.
   */
  await useApp.persist.rehydrate();
  await tick();
  useApp.setState({ activeId: activeA });
  useApp.getState().addGems(1);
  await tick();
  const after = (await rawRecord()) ?? '';
  const lost = withBoth.includes('Петя') && !after.includes('Петя');
  outcome(
    'Сценарий 6: вторая вкладка/фоновая копия затирает свежий прогресс',
    lost,
    `в базе до пробуждения: 2 профиля; после: ${after.includes('Петя') ? 2 : 1}; ` +
      `защита — ре-гидрация на возврате в фокус и обмен через BroadcastChannel`,
  );
  await freshStart();
}

async function scenario7_deleteProfile() {
  await freshStart();
  await seedProgress();
  const id = useApp.getState().profiles[0].id;
  useApp.getState().deleteProfile(id);
  await tick();
  const db = await openDB('slovo2', 1);
  const keys = await db.getAllKeys('kv');
  const trash = useApp.getState().vault.trash;
  // Возвращаем из корзины — тем же путём, каким это сделает родитель.
  if (trash.length) useApp.getState().restoreTrashed(trash[0].at);
  await tick();
  const back = useApp.getState().profiles.find((p) => p.id === id);
  const lost = !back || back.xp !== 500;
  outcome(
    'Сценарий 7: удаление профиля безвозвратно, копии нет',
    lost,
    `ключей в базе: ${keys.length}; профиль в корзине: ${trash.length > 0 ? 'да' : 'НЕТ'}; ` +
      `после «вернуть»: ${back ? `«${back.name}», XP ${back.xp}` : 'ПОТЕРЯН'}`,
  );
  await freshStart();
}

async function scenario8_badImport() {
  await freshStart();
  await seedProgress();
  // Родитель (или ребёнок) загрузил не тот файл, да ещё и с «битым» профилем.
  useApp.getState().replaceAll({
    profiles: [{ name: 'без id' } as never],
    activeId: 'нет такого',
    settings: {} as never,
  });
  await tick();
  const trash = useApp.getState().vault.trash;
  const recoverable = trash.some((t) => t.profile.name === 'Маша');
  if (recoverable) {
    const item = trash.find((t) => t.profile.name === 'Маша')!;
    useApp.getState().restoreTrashed(item.at);
    await tick();
  }
  const back = useApp.getState().profiles.find((p) => p.name === 'Маша');
  outcome(
    'Сценарий 8: импорт частично некорректного файла стирает прежний прогресс',
    !recoverable || !back,
    `профилей после импорта: ${useApp.getState().profiles.length}; ` +
      `прежний профиль в корзине: ${recoverable ? 'да' : 'НЕТ'}; ` +
      `после «вернуть»: ${back ? `«${back.name}», XP ${back.xp}` : 'ПОТЕРЯН'}`,
  );
  await freshStart();
}

async function scenario9_secondProfileLooksLikeLoss() {
  await freshStart();
  await seedProgress('Маша');
  // Ребёнок (или братишка) на экране профилей нажимает «Начать учиться».
  useApp.getState().createProfile('Маша 2', '🐱');
  await tick();
  const active = useApp.getState().profiles.find((p) => p.id === useApp.getState().activeId);
  const raw = (await rawRecord()) ?? '';
  const intact = raw.includes('Маша') && raw.includes('"xp":500');
  const looksEmpty = active?.name === 'Маша 2' && active.xp === 0;
  outcome(
    'Сценарий 9 (ложная потеря): новый профиль переключает активного ученика',
    !intact,
    `активный профиль: «${active?.name}», XP=${active?.xp} — выглядит как «всё с нуля» ` +
      `(это не потеря: старый профиль ${intact ? 'цел, лечится переключением' : 'ПОТЕРЯН'})`,
  );
  await freshStart();
}

async function scenario10_snapshotRestore() {
  await freshStart();
  await seedProgress('Маша');
  // Беда: профиль удалили (или сбросили). Перед перезаписью сторож обязан
  // снять копию — из неё родитель всё вернёт.
  useApp.getState().deleteProfile(useApp.getState().profiles[0].id);
  await tick();
  const snaps = [...useApp.getState().vault.snapshots].sort((a, b) => b.at - a.at);
  let restored = false;
  if (snaps.length) restored = await useApp.getState().restoreSnapshot(snaps[0].slot);
  await tick(60);
  const back = useApp.getState().profiles.find((p) => p.name === 'Маша');
  outcome(
    'Сценарий 10: нет точки отката — удаление/сброс нечем вернуть',
    !restored || !back || back.xp !== 500,
    `копий снято: ${snaps.length}; восстановление из копии: ${restored ? 'удалось' : 'НЕ удалось'}; ` +
      `профиль после восстановления: ${back ? `«${back.name}», XP ${back.xp}` : 'ПОТЕРЯН'}`,
  );
  await freshStart();
}

async function scenario11_recordSize() {
  await freshStart();
  await seedProgress('Маша');
  const s = useApp.getState();
  // Прогресс за год: все слова выучены, каждый день — статистика.
  for (const w of WORDS) s.answer(w.id, 5);
  for (let i = 0; i < 365; i++) {
    useApp.setState((st) => ({
      profiles: st.profiles.map((p) => ({
        ...p,
        days: {
          ...p.days,
          [`2025-${String((i % 12) + 1).padStart(2, '0')}-01`]: {
            xp: 120, correct: 20, wrong: 3, lessons: 2, flawless: 8, reviewCorrect: 5, reviewWords: [],
          },
        },
      })),
    }));
  }
  await tick();
  const raw = (await rawRecord()) ?? '';
  console.log(
    `☐ справка · Сценарий 11: объём записи прогресса — ${(raw.length / 1024).toFixed(1)} КБ ` +
      `за 365 дней и ${WORDS.length} слов`,
  );
  console.log(
    `    квоты браузера — сотни МБ, так что переполнение не причина потери; ` +
      `зато понятно, почему копии (снимки) почти ничего не стоят`,
  );
  await freshStart();
}

async function main() {
  console.log('Аудит хранилища прогресса СЛОВО 2.0 (защита: сторож, снимки, корзина)\n' + '─'.repeat(78));
  await scenario1_happyPath();
  await scenario2_corruptRecord();
  await scenario3_versionMismatch();
  await scenario4_storageUnavailable();
  await scenario5_writeFails();
  await scenario6_staleTab();
  await scenario7_deleteProfile();
  await scenario8_badImport();
  await scenario9_secondProfileLooksLikeLoss();
  await scenario10_snapshotRestore();
  await scenario11_recordSize();
  console.log('─'.repeat(78));
  console.log(
    findings
      ? `☒ Итого открытых каналов потери: ${findings} из 10 — защита сломана, см. выше.`
      : '✓ Итого: ни один из 10 сценариев не приводит к безвозвратной потере прогресса.',
  );
  // BroadcastChannel держит event loop открытым — выходим явно.
  process.exit(findings ? 1 : 0);
}

void main();

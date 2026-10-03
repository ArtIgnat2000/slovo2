// Диагностический прогон хранилища прогресса (npm run audit:storage).
//
// Это не тест с проверками «должно быть зелёным», а измерительный стенд: он
// задаёт хранилищу реальные жизненные ситуации (битая запись, недоступная
// IndexedDB, вторая вкладка, удаление профиля, импорт чужого файла) и печатает,
// что происходит с прогрессом. Нужен был как доказательная база аудита:
// «пропавший прогресс» нельзя разбирать по догадкам, пока не видно, какой из
// каналов потери реально открыт в коде.
//
// После внедрения защиты (снапшоты, мягкое удаление, запрет записи пустого
// поверх полного) сценарии 2–8 должны перестать стирать данные — тогда этот
// прогон превращается в обычный регрессионный тест: меняем printOutcome на
// check() и подключаем к CI.
import './setup';
import { openDB } from 'idb';
import { idbStorage } from '../src/platform/storage';
import { useApp } from '../src/state/store';
import { WORDS } from '../src/content/words';

const KEY = 'slovo2';

/** Даём очередям промисов и транзакциям IndexedDB дойти до конца. */
async function tick(n = 6) {
  for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0));
}

/** Сырая запись в IndexedDB — то, что реально лежит на диске телефона. */
const rawRecord = () => idbStorage.getItem(KEY);

async function freshStart() {
  await useApp.persist.clearStorage();
  await clearMemory();
}

/**
 * Очистить только память, не трогая базу. Важно: zustand пишет состояние на
 * КАЖДОЕ изменение, поэтому обычный setState({profiles: []}) сам по себе
 * затирает запись — прогон перестал бы отличать «приложение стёрло прогресс»
 * от «прогон стёр прогресс». Эмуляция перезапуска обязана быть «молчаливой».
 */
async function clearMemory() {
  const realSet = idbStorage.setItem;
  idbStorage.setItem = () => Promise.resolve();
  useApp.setState({ profiles: [], activeId: null });
  await tick();
  idbStorage.setItem = realSet;
}

/** Ребёнок позанимался: профиль, XP, кристаллы — всё это должно выживать. */
async function seedProgress(name = 'Маша') {
  useApp.getState().createProfile(name, '🦊');
  useApp.getState().addXp(500);
  useApp.getState().addGems(30);
  await tick();
}

let findings = 0;
function outcome(scenario: string, confirmed: boolean, detail: string) {
  if (confirmed) findings += 1;
  console.log(
    `${confirmed ? '☒ ПОДТВЕРЖДЕНО' : '☐ не подтверждено'} · ${scenario}\n    ${detail}`,
  );
}

async function scenario1_happyPath() {
  await freshStart();
  await seedProgress();
  const saved = (await rawRecord()) ?? '';
  const back = saved.includes('Маша') && saved.includes('"xp":500');
  // Как при старте приложения: память пустая, читаем из базы.
  await clearMemory();
  await useApp.persist.rehydrate();
  await tick();
  const alive = useApp.getState().profiles.some((p) => p.name === 'Маша' && p.xp === 500);
  outcome(
    'Сценарий 1 (контроль): обычный старт читает прогресс из IndexedDB',
    !back || !alive,
    `записано: ${back ? 'да' : 'нет'}; после перезапуска профиль с XP 500: ${alive ? 'на месте' : 'ПОТЕРЯН'} — ` +
      `если контроль ломается, остальные сценарии неинформативны`,
  );
}

async function scenario2_corruptRecord() {
  await freshStart();
  await seedProgress();
  // Запись повредилась (оборванная запись, сбой флеша, «уборка» браузера).
  await idbStorage.setItem(KEY, '{"state":{"profiles":[{"id":"p_1","na');
  await clearMemory();
  let threw = false;
  try {
    await useApp.persist.rehydrate();
  } catch {
    threw = true;
  }
  await tick();
  const emptyBoot = useApp.getState().profiles.length === 0;
  // Ребёнок видит «Пока нет ни одного ученика» и создаёт профиль — как и любой
  // на этом экране. С этого момента старая запись перезаписана навсегда.
  useApp.getState().createProfile('Новичок', '🐱');
  await tick();
  const after = (await rawRecord()) ?? '';
  const destroyed = !after.includes('Маша');
  outcome(
    'Сценарий 2: битая запись → тихий пустой старт → стирание старого прогресса',
    emptyBoot && destroyed,
    `rehydrate бросил исключение: ${threw ? 'да' : 'НЕТ (ошибка проглочена — приложение ничего не узнало)'}; ` +
      `профилей после старта: ${useApp.getState().profiles.length - 1} (был 1); ` +
      `след от прежнего прогресса в базе: ${destroyed ? 'СТЁРТ' : 'сохранён'}`,
  );
  await freshStart();
}

async function scenario3_versionMismatch() {
  await freshStart();
  await seedProgress();
  const raw = JSON.parse((await rawRecord()) ?? '{}');
  // Запись будущей версии: например, телефон открыл сборку, которую уже
  // откатили, или наоборот — приехала версия с version: 2.
  await idbStorage.setItem(KEY, JSON.stringify({ ...raw, version: (raw.version ?? 1) + 1 }));
  const errors: unknown[] = [];
  const origError = console.error;
  console.error = (...a: unknown[]) => errors.push(a[0]);
  await clearMemory();
  let threw = false;
  try {
    await useApp.persist.rehydrate();
  } catch {
    threw = true;
  }
  await tick();
  console.error = origError;
  const emptyBoot = useApp.getState().profiles.length === 0;
  useApp.getState().createProfile('Новичок', '🐱');
  await tick();
  const after = (await rawRecord()) ?? '';
  const destroyed = !after.includes('Маша');
  outcome(
    'Сценарий 3: расхождение версии схемы без migrate() → пустой старт → стирание',
    emptyBoot && destroyed,
    `rehydrate бросил исключение: ${threw ? 'да' : 'НЕТ (тихо)'}; ` +
      `в консоль: ${errors.length ? String(errors[0]).slice(0, 60) + '…' : 'ничего'}; ` +
      `прежний прогресс в базе: ${destroyed ? 'СТЁРТ' : 'сохранён'}`,
  );
  await freshStart();
}

async function scenario4_storageUnavailable() {
  await freshStart();
  await seedProgress();
  const before = (await rawRecord()) ?? '';
  // IndexedDB временно недоступна: приватный режим, «чистка» iOS, блокировка
  // после обновления системы, нехватка места на диске.
  const realGet = idbStorage.getItem;
  idbStorage.getItem = () => Promise.reject(new Error('IndexedDB недоступна'));
  await clearMemory();
  let threw = false;
  try {
    await useApp.persist.rehydrate();
  } catch {
    threw = true;
  }
  await tick();
  idbStorage.getItem = realGet;
  const emptyBoot = useApp.getState().profiles.length === 0;
  // Хранилище снова доступно (перезапуск телефона), ребёнок создаёт профиль.
  useApp.getState().createProfile('Новичок', '🐱');
  await tick();
  const after = (await rawRecord()) ?? '';
  const destroyed = before.includes('Маша') && !after.includes('Маша');
  outcome(
    'Сценарий 4: хранилище недоступно на старте → пустой старт → стирание при первом действии',
    emptyBoot && destroyed,
    `rehydrate бросил исключение: ${threw ? 'да' : 'НЕТ (main.tsx свой try/catch не применит: ошибки нет)'}; ` +
      `прежний прогресс в базе: ${destroyed ? 'СТЁРТ' : 'сохранён'}`,
  );
  await freshStart();
}

async function scenario5_writeFails() {
  await freshStart();
  await seedProgress();
  const saved = (await rawRecord()) ?? '';
  const rejections: unknown[] = [];
  const onRejection = (e: unknown) => rejections.push(e);
  process.on('unhandledRejection', onRejection);
  // Квота закончилась или браузер отказал в записи.
  const realSet = idbStorage.setItem;
  idbStorage.setItem = () => Promise.reject(new Error('QuotaExceededError'));
  useApp.getState().addXp(100);
  await tick(20);
  idbStorage.setItem = realSet;
  process.off('unhandledRejection', onRejection);
  const after = (await rawRecord()) ?? '';
  const inMemory = useApp.getState().profiles[0]?.xp ?? 0;
  const lost = saved.includes('"xp":500') && after.includes('"xp":500');
  outcome(
    'Сценарий 5: запись не удалась → непойманное отклонение промиса, молчаливая потеря правок',
    lost && rejections.length > 0,
    `в памяти XP=${inMemory} (пользователь видит успех), в базе осталось ${after.includes('"xp":500') ? '500 (правка потеряна)' : 'обновление'}; ` +
      `непойманных отклонений: ${rejections.length} — на экране об этом не сообщается ничего`,
  );
  await freshStart();
}

async function scenario6_staleTab() {
  await freshStart();
  await seedProgress('Маша');
  // Вкладка A (например, вчерашняя, ушла в фон) держит в памяти это состояние.
  const tabA = useApp.getState().profiles;
  const activeA = useApp.getState().activeId;
  // Вкладка B: ребёнок занимается уже сегодня и создаёт второй профиль.
  useApp.getState().createProfile('Петя', '🐼');
  useApp.getState().addXp(300);
  await tick();
  const withBoth = (await rawRecord()) ?? '';
  // Вкладку A разбудили: любое её изменение (вход в урок, тост, настройка)
  // записывает ВЕСЬ её слепок состояния поверх свежего.
  useApp.setState({ profiles: tabA, activeId: activeA });
  useApp.getState().addGems(1);
  await tick();
  const after = (await rawRecord()) ?? '';
  const wiped = withBoth.includes('Петя') && !after.includes('Петя');
  outcome(
    'Сценарий 6: вторая вкладка/фоновая копия приложения затирает свежий прогресс',
    wiped,
    `до пробуждения в базе было профилей: 2; после: ${after.includes('Петя') ? 2 : 1} — ` +
      `синхронизации между вкладками нет, пишется всегда полный слепок`,
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
  const after = (await rawRecord()) ?? '';
  const gone = !after.includes('Маша') && keys.length === 1 && keys[0] === KEY;
  outcome(
    'Сценарий 7: удаление профиля — безвозвратно, копии нет (бэкап не ведётся автоматически)',
    gone,
    `ключей в базе: ${keys.length} (${keys.join(', ')}) — хранится одна запись, ` +
      `снимков/корзины нет; путь для ребёнка: аватар в шапке → 🗑 → «Удалить профиль» (без родительского гейта)`,
  );
  await freshStart();
}

async function scenario8_badImport() {
  await freshStart();
  await seedProgress();
  // Родитель (или ребёнок, решивший пример) загрузил не тот файл.
  useApp.getState().replaceAll({
    profiles: [{ name: 'без id' } as never],
    activeId: 'нет такого',
    settings: {} as never,
  });
  await tick();
  const after = (await rawRecord()) ?? '';
  const gone = !after.includes('Маша');
  const kept = useApp.getState().profiles.length;
  outcome(
    'Сценарий 8: импорт частично некорректного файла → профили отброшены молча, старые затёрты',
    gone,
    `профилей после импорта: ${kept} (невалидные отброшены без сообщения), ` +
      `прежний прогресс в базе: ${gone ? 'СТЁРТ немедленно' : 'сохранён'}`,
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
    'Сценарий 9 (ложная потеря): новый профиль переключает активного ученика — данные целы, но «всё с нуля»',
    intact && looksEmpty,
    `активный профиль: «${active?.name}», XP=${active?.xp}, освоено 0 — выглядит как полная потеря; ` +
      `при этом старый профиль в базе: ${intact ? 'цел' : 'ПОТЕРЯН'} (лечится переключением обратно)`,
  );
  await freshStart();
}

async function scenario10_recordSize() {
  await freshStart();
  await seedProgress('Маша');
  const s = useApp.getState();
  // Прогресс за год: все слова выучены, каждый день — статистика.
  for (const w of WORDS) s.answer(w.id, 5);
  for (let i = 0; i < 365; i++) {
    useApp.setState((st) => ({
      profiles: st.profiles.map((p) => ({
        ...p,
        days: { ...p.days, [`2025-${String((i % 12) + 1).padStart(2, '0')}-01`]: { xp: 120, correct: 20, wrong: 3, lessons: 2, flawless: 8, reviewCorrect: 5, reviewWords: [] } },
      })),
    }));
  }
  await tick();
  const raw = (await rawRecord()) ?? '';
  const kb = (raw.length / 1024).toFixed(1);
  console.log(
    `☐ справка · Сценарий 10: объём записи прогресса — ${kb} КБ за 365 дней и ${WORDS.length} слов`,
  );
  console.log(
    `    квоты браузера — сотни МБ; переполнение как причина потери практически исключено,` +
      ` зато он же объясняет, почему запись целиком перезаписывается на каждое изменение`,
  );
  await freshStart();
}

async function main() {
  console.log('Аудит хранилища прогресса СЛОВО 2.0\n' + '─'.repeat(78));
  await scenario1_happyPath();
  await scenario2_corruptRecord();
  await scenario3_versionMismatch();
  await scenario4_storageUnavailable();
  await scenario5_writeFails();
  await scenario6_staleTab();
  await scenario7_deleteProfile();
  await scenario8_badImport();
  await scenario9_secondProfileLooksLikeLoss();
  await scenario10_recordSize();
  console.log('─'.repeat(78));
  console.log(`Итого подтверждённых каналов потери: ${findings} из 9 (сценарий 1 — контроль, 9 — ложная потеря, 10 — справка).`);
}

void main();

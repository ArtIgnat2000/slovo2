// Правила обликов сундука: когда открывается, что выбирается, что показываем.
//
// Задача (2026-10-14): «одного дизайна сундука недостаточно». Здесь стережём
// вещи, из-за которых коллекция обликов ломается как механика:
//  1) у нового профиля облик есть сразу (сундук не «пустой»);
//  2) условия не пересекаются так, что всё открывается в один день (разные механики);
//  3) запертый облик нельзя выбрать — и «чужой» выбор из файла не ломает активный;
//  4) прогресс до следующего облика считается и виден заранее;
//  5) «открылся» объявляется один раз, а не при каждом заходе на главную.
import assert from 'node:assert/strict';
import {
  BASE_SKIN,
  CHEST_SKINS,
  activeChestSkin,
  chestsOpened,
  nextSkinState,
  skinById,
  skinState,
  skinStates,
  newlyUnlockedSkins,
  skinUnlockMessage,
  unlockedSkinIds,
  wordsMastered,
} from '../src/engine/chests';
import { WORDS } from '../src/content/words';
import type { Profile, WordState } from '../src/types';

const NOW = Date.UTC(2026, 9, 14, 12, 0, 0);

/** Профиль-пустышка: ничего не пройдено, серия ноль, сундуков не открыто. */
function freshProfile(patch: Partial<Profile> = {}): Profile {
  return {
    id: 'test',
    name: 'Тест',
    avatar: '🐨',
    createdAt: NOW - 86_400_000,
    xp: 0,
    gems: 0,
    streak: 0,
    lastDay: '2026-10-14',
    freezes: 0,
    words: {},
    lessons: {},
    errors: {},
    days: {},
    achievements: [],
    ...patch,
  };
}

/** Профиль с N освоенными словами (SRS ≥ 90 — то же правило, что в магазине). */
function withMastered(count: number): Profile {
  const words: Record<string, WordState> = {};
  for (const word of WORDS.slice(0, count)) {
    words[word.id] = { s: 95, due: NOW, iv: 5, n: 5, seen: NOW, ok: 5, wrong: 0 };
  }
  return freshProfile({ words });
}

// 1. Базовый облик доступен всем и всегда, а чаще одного облика — уже коллекция.
assert.ok(CHEST_SKINS.length >= 3, 'обликов должно быть несколько');
assert.equal(skinById('нет-такого-облика').id, BASE_SKIN, 'неизвестный id падает на базовый');
{
  const p = freshProfile();
  assert.deepEqual(unlockedSkinIds(p), [BASE_SKIN]);
  assert.equal(activeChestSkin(p), BASE_SKIN);
  assert.equal(skinStates(p).length, CHEST_SKINS.length, 'в полке видны все облики, включая закрытые');
  assert.equal(nextSkinState(p)?.skin.id, 'sky', 'новичку ближе всего небесный (5 сундуков)');
  assert.equal(nextSkinState(p)?.left, 5, 'и до него ровно 5 сундуков');
}

// 2. Условия открытия считаются от разных механик: сундуки, серия, слова.
{
  const p = freshProfile({ daily: { day: '2026-10-14', claimed: [], chestsToday: 0, chestsTotal: 5 } });
  assert.equal(chestsOpened(p), 5);
  assert.ok(unlockedSkinIds(p).includes('sky'), 'пять открытых сундуков открывают небесный');
  assert.ok(!unlockedSkinIds(p).includes('ice'), 'серия не подменяется сундуками');

  const ice = freshProfile({ streak: 6 });
  assert.ok(!unlockedSkinIds(ice).includes('ice'), 'на шестом дне ледяной ещё закрыт');
  assert.equal(skinState(skinById('ice'), ice).left, 1, 'до ледяного остаётся один день');
  assert.ok(unlockedSkinIds({ ...ice, streak: 7 }).includes('ice'), 'семь дней подряд открывают ледяной');

  const star = withMastered(29);
  assert.equal(wordsMastered(star), 29);
  assert.ok(!unlockedSkinIds(star).includes('star'), '29 слов мало для звёздного');
  assert.ok(unlockedSkinIds(withMastered(30)).includes('star'), '30 освоенных слов открывают звёздный');
}

// 3. Серия прервалась — открытое не отбираем (облик не «сгорает», как и обещано в полке).
{
  const wasSeven = freshProfile({ streak: 7 });
  const broken = { ...wasSeven, streak: 0 };
  assert.ok(unlockedSkinIds(wasSeven).includes('ice'), 'на седьмой день ледяной открыт по условию');
  // Условие — не единственный источник: как только облик записан (приложение
  // делает это в момент открытия), серия больше ничего не решает.
  const recorded = { ...broken, chestSkins: ['travel', 'ice'] };
  assert.ok(unlockedSkinIds(recorded).includes('ice'), 'записанный облик остаётся открытым при серии 0');
  assert.equal(activeChestSkin({ ...recorded, chestSkin: 'ice' }), 'ice', 'и его можно выбрать');
}

// 4. Выбор: открытый выбирается, закрытый игнорируется, «чужой» не ломает вид сундука.
{
  const p = freshProfile();
  assert.equal(activeChestSkin({ ...p, chestSkin: 'ice' }), BASE_SKIN, 'запертый облик не показываем');
  const withSky = freshProfile({ daily: { day: '2026-10-14', claimed: [], chestsToday: 0, chestsTotal: 9 } });
  assert.equal(activeChestSkin({ ...withSky, chestSkin: 'sky' }), 'sky', 'открытый облик выбирается');
  assert.equal(activeChestSkin({ ...withSky, chestSkin: 'star' }), BASE_SKIN, 'запертый выбор откатывается к базовому');
}

// 5. «Что дальше» показывает ближайший незакрытый облик, а не первый в списке.
{
  const almostIce = freshProfile({ streak: 6, daily: { day: '2026-10-14', claimed: [], chestsToday: 0, chestsTotal: 1 } });
  assert.equal(nextSkinState(almostIce)?.skin.id, 'ice');
  assert.equal(nextSkinState(almostIce)?.left, 1);
  const everything = freshProfile({
    streak: 30,
    words: withMastered(30).words,
    daily: { day: '2026-10-14', claimed: [], chestsToday: 0, chestsTotal: 30 },
  });
  assert.equal(nextSkinState(everything), null, 'когда полка собрана, «дальше» пустое');
  assert.equal(unlockedSkinIds(everything).length, CHEST_SKINS.length);
}

// 6. Новый облик объявляем один раз: список открытых лежит в профиле.
{
  const p = freshProfile({ daily: { day: '2026-10-14', claimed: [], chestsToday: 0, chestsTotal: 6 } });
  assert.deepEqual(
    newlyUnlockedSkins(p),
    [BASE_SKIN, 'sky'],
    'новому профилю объявляем и базовый, и честно заработанный',
  );
  assert.deepEqual(newlyUnlockedSkins({ ...p, chestSkins: [BASE_SKIN, 'sky'] }), [], 'второй раз не повторяем');
  assert.equal(skinState(skinById('sky'), { ...p, chestSkins: [BASE_SKIN, 'sky'] }).fresh, false, 'и бейдж «новый» снят');
  assert.equal(skinUnlockMessage([]), null);
  assert.equal(skinUnlockMessage(['sky'])?.title, 'Новый сундук: Небесный сундук');
  assert.match(skinUnlockMessage(['sky', 'ice'])?.text ?? '', /Небесный/);
  assert.match(skinUnlockMessage(['sky', 'ice'])?.text ?? '', /Ледяной/);
}

// 7. Палитры и названия пригодны для интерфейса (полка рисует превью каждого облика).
for (const skin of CHEST_SKINS) {
  assert.ok(skin.title.length > 3, `${skin.id}: у облика есть название`);
  assert.ok(skin.how.length > 5, `${skin.id}: у облика есть условие словами`);
  assert.match(skin.palette.body, /^#[0-9a-f]{6}$/i, `${skin.id}: цвет корпуса — hex`);
  assert.match(skin.palette.aura, /^rgba\(/, `${skin.id}: свечение — rgba (без color-mix)`);
  assert.equal(new Set(CHEST_SKINS.map((s) => s.id)).size, CHEST_SKINS.length, 'id обликов уникальны');
  assert.equal(new Set(CHEST_SKINS.map((s) => s.title)).size, CHEST_SKINS.length, 'названия не повторяются');
}

console.log('✓ облики сундука: условия, выбор, «что дальше» и одноразовое объявление');

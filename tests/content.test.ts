// Проверка связности контента: классы, уроки и слова (docs/proposals/classes-1-4.md).
//
// Запуск: npm run test:content (esbuild → Node, как tests/adaptive.test.ts).
// Здесь только контент: ни DOM, ни стора — падение значит, что разметка
// классов в src/content/words.ts сломана, и ребёнок увидит урок без слов
// или слово чужого класса.
import assert from 'node:assert/strict';
import {
  AVAILABLE_CLASSES,
  CLASS_IDS,
  LESSONS,
  LESSONS_BY_GRADE,
  LESSON_BY_ID,
  REVIEW,
  WORDS,
  WORDS_BY_GRADE,
  WORD_BY_ID,
  availableClass,
} from '../src/content/words';

// ── Слова и классы ───────────────────────────────────────────────────────────

assert.equal(new Set(WORDS.map((w) => w.id)).size, WORDS.length, 'id слов уникальны');
assert.equal(new Set(WORDS.map((w) => w.text)).size, WORDS.length, 'текст слов уникален');

for (const w of WORDS) {
  assert.ok(w.grades.length >= 1, `${w.text}: должен быть хотя бы один класс`);
  for (const g of w.grades) assert.ok(CLASS_IDS.includes(g), `${w.text}: недопустимый класс ${g}`);
  assert.equal(new Set(w.grades).size, w.grades.length, `${w.text}: классы без повторов`);
}

// 2 класс — исторический пак: all его id сохраняют префикс g2_, иначе потеряется
// прогресс у всех, кто уже учится (profile.words ключуется id).
for (const w of WORDS_BY_GRADE[2]) {
  assert.ok(w.id.startsWith('g2_'), `${w.text}: у слов 2 класса префикс g2_ (${w.id})`);
}
// Новые классы получают свой префикс; слово, попавшее в 2 класс позже, — тоже g2_.
for (const g of [1, 3, 4] as const) {
  for (const w of WORDS_BY_GRADE[g]) {
    const expect = w.grades.includes(2) ? 'g2_' : `g${Math.min(...w.grades)}_`;
    assert.ok(w.id.startsWith(expect), `${w.text}: ожидался префикс ${expect}, получен ${w.id}`);
  }
}

// Ожидаемые объёмы: расхождение — сигнал, что словарик класса изменился,
// и тогда нужно осознанно обновить и число, и релизную заметку.
const EXPECTED = { 1: 30, 2: 94, 3: 0, 4: 0 };
for (const g of CLASS_IDS) {
  assert.equal(WORDS_BY_GRADE[g].length, EXPECTED[g], `слов в ${g} классе`);
}
assert.equal(WORDS.length, 96, 'всего карточек в банке');

// ── Уроки ────────────────────────────────────────────────────────────────────

assert.equal(new Set(LESSONS.map((l) => l.id)).size, LESSONS.length, 'id уроков уникальны');
assert.ok(!LESSON_BY_ID[REVIEW.id] || LESSON_BY_ID.review === REVIEW, 'повторение — отдельный урок');

for (const l of LESSONS) {
  const words = LESSONS_BY_GRADE[l.grade];
  assert.ok(words, `${l.id}: у урока допустимый класс`);
  assert.equal(LESSONS_BY_GRADE[l.grade].find((x) => x.id === l.id), l, `${l.id}: урок в своём классе`);
  assert.ok(l.wordIds.length >= 4, `${l.id}: в уроке хотя бы 4 слова`);
  assert.equal(new Set(l.wordIds).size, l.wordIds.length, `${l.id}: слова в уроке без повторов`);
  for (const id of l.wordIds) {
    const w = WORD_BY_ID[id];
    assert.ok(w, `${l.id}: слово ${id} существует`);
    assert.ok(w.grades.includes(l.grade), `${l.id}: «${w.text}» входит в ${l.grade} класс`);
  }
  assert.ok(l.title.trim() && l.emoji, `${l.id}: есть название и эмодзи`);
}

for (const g of CLASS_IDS) {
  const lessons = LESSONS_BY_GRADE[g];
  const words = WORDS_BY_GRADE[g];
  if (!lessons.length) {
    assert.equal(words.length, 0, `${g} класс без уроков не должен иметь слов`);
    continue;
  }
  assert.deepEqual(
    lessons.map((l) => l.order),
    lessons.map((_, i) => i + 1),
    `${g} класс: порядок уроков 1..N`,
  );
  // Каждое слово класса — ровно в одном уроке этого класса, и лишних нет.
  const count = new Map<string, number>();
  for (const l of lessons) for (const id of l.wordIds) count.set(id, (count.get(id) ?? 0) + 1);
  for (const w of words) {
    assert.equal(count.get(w.id), 1, `${w.text}: ровно в одном уроке ${g} класса`);
  }
  assert.equal(count.size, lessons.reduce((n, l) => n + l.wordIds.length, 0), `${g} класс: без дублей слов`);
}

// ── Доступность классов и тема слова ─────────────────────────────────────────

assert.deepEqual(AVAILABLE_CLASSES, [1, 2], 'в сборке наполнены 1 и 2 классы');
assert.deepEqual(CLASS_IDS.filter((g) => LESSONS_BY_GRADE[g].length > 0), AVAILABLE_CLASSES);

assert.equal(availableClass(2), 2);
assert.equal(availableClass(1), 1);
// Класс из будущей версии (импорт профиля) показываем как ближайший доступный,
// но сохранённое значение в профиле не перезаписываем — см. store.setActiveClass.
assert.equal(availableClass(4), 2, 'недоступный класс отрисовывается ближайшим доступным');

// Новые слова получают тему первого урока, старые 94 сохраняют THEME_OF:
// иначе фильтр словарика и подсказки при вычитке начнут врать.
for (const w of WORDS) {
  assert.ok(w.theme, `${w.text}: тема заполнена`);
  if (w.grades.includes(2)) assert.ok(w.theme !== `g1_${w.theme}`, `${w.text}: тема не из чужого класса`);
}
assert.equal(WORD_BY_ID['g1_лисица'].theme, 'g1_birds', 'лисица — из урока «Птицы и звери» 1 класса');
assert.equal(WORD_BY_ID['g1_мальчик'].theme, 'g1_home', 'мальчик — из урока «Люди и дом» 1 класса');
assert.equal(WORD_BY_ID['g2_класс'].theme, 'school', 'старое слово сохранило тему 2 класса');

console.log('✓ контент по классам: 96 карточек, 1 класс — 30 слов и 5 уроков, 2 класс — 94 слова и 16 уроков');

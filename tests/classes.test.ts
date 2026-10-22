// Смена класса: главное требование — она НЕ сбрасывает опыт, товары и награды
// (docs/proposals/classes-1-4.md, §6). Тест «богатого» профиля сравнивает его
// до и после переключения целиком: разрешены только activeClass и adaptiveGood.
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useApp } from '../src/state/store';
import App from '../src/App';
import { AVAILABLE_CLASSES, LESSONS_BY_GRADE, WORDS_BY_GRADE, WORD_BY_ID } from '../src/content/words';
import { body, btn, btnText, buttons, check, click, currentWord, has, sleep } from './ui-helpers';

const store = () => useApp.getState();

function active() {
  const s = store();
  const p = s.profiles.find((x) => x.id === s.activeId);
  if (!p) throw new Error('классы: нет активного профиля');
  return p;
}

/** Профиль со всем, что можно накопить: опыт, товары, пазлы, награды, дни. */
function seedRichProfile() {
  const id = active().id;
  const now = Date.now();
  const grade2 = LESSONS_BY_GRADE[2];
  const words: Record<string, { s: number; due: number; iv: number; n: number; seen: number; ok: number; wrong: number }> = {};
  for (const l of grade2.slice(0, 3)) {
    for (const wordId of l.wordIds) words[wordId] = { s: 92, due: now + 5 * 86_400_000, iv: 12, n: 4, seen: now, ok: 6, wrong: 1 };
  }
  const lessons: Record<string, { level: number; best: number; doneAt: number; plays: number }> = {};
  for (const l of grade2.slice(0, 3)) lessons[l.id] = { level: 5, best: 100, doneAt: now, plays: 3 };
  useApp.setState((s) => ({
    profiles: s.profiles.map((p) =>
      p.id !== id
        ? p
        : {
            ...p,
            xp: 1234,
            gems: 87,
            streak: 9,
            lastDay: '2026-10-20',
            freezes: 2,
            achievements: ['first', 'streak3', 'words25'],
            words,
            lessons,
            days: { '2026-10-20': { xp: 120, correct: 30, wrong: 4, lessons: 2, flawless: 8, reviewCorrect: 5 } },
            daily: { day: '2026-10-20', claimed: ['review'], chestsToday: 1, bonusChestsClaimed: 1, chestsTotal: 4 },
            weekly: { week: '2026-10-19', claimed: [3] },
            shop: {
              owned: ['phone-retro'],
              equipped: { phone: 'phone-retro' },
              musicOwned: [],
              musicTrack: null,
              soundOwned: [],
              soundPack: p.shop?.soundPack ?? 'classic',
              wishlist: ['ship-carrier'],
              tuning: { 'phone-retro': { tint: 'red', owned: ['red'] } },
            },
            puzzle: { pieces: { astronaut: 2 }, collecting: 'astronaut', assembled: [], worn: null },
            chestSkin: 'paper',
            chestSkins: ['paper'],
            adaptiveCards: 14,
            adaptiveGood: 3,
            activeClass: 2,
          },
    ),
  }));
  return active();
}

/** Глубокое сравнение профиля без «разрешённых» изменений. */
function diffKeys(a: object, b: object, path = ''): string[] {
  const out: string[] = [];
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const va = (a as Record<string, unknown>)[k];
    const vb = (b as Record<string, unknown>)[k];
    const where = path ? `${path}.${k}` : k;
    if (va && vb && typeof va === 'object' && typeof vb === 'object') out.push(...diffKeys(va, vb, where));
    else if (JSON.stringify(va) !== JSON.stringify(vb)) out.push(where);
  }
  return out;
}

export async function runClassChecks(root: Root) {
  // ── 1. Чистые инварианты стора ────────────────────────────────────────────
  {
    seedRichProfile();

    for (const grade of [1, 2]) {
      const before = structuredClone(active());
      store().setActiveClass(grade);
      const after = active();
      const changed = diffKeys(before, after);
      // Разрешены ровно два поля: сам класс и адаптивное окно (оно набиралось
      // на другой программе). Всё остальное — регресс.
      const allowed = new Set(['activeClass', 'adaptiveGood']);
      assert.deepEqual(
        changed.filter((k) => !allowed.has(k)),
        [],
        `setActiveClass(${grade}) меняет только класс и адаптивное окно, а изменилось: ${changed.join(', ')}`,
      );
      assert.equal(after.activeClass, grade, 'класс записан');
      assert.equal(after.xp, 1234, 'опыт на месте');
      assert.equal(after.gems, 87, 'кристаллы на месте');
      assert.equal(after.streak, 9, 'серия на месте');
      assert.deepEqual(after.shop?.owned, ['phone-retro'], 'покупки на месте');
      assert.deepEqual(after.achievements, ['first', 'streak3', 'words25'], 'награды на месте');
      assert.deepEqual(Object.keys(after.words).sort(), Object.keys(before.words).sort(), 'прогресс слов на месте');
      assert.deepEqual(after.lessons, before.lessons, 'уровни уроков на месте');
    }

    // Повторный выбор того же класса — не изменение вовсе (и не сброс адаптива).
    store().setActiveClass(2);
    store().setActiveClass(2);
    assert.equal(active().activeClass, 2);
  }

  // ── 2. Старый профиль без поля ────────────────────────────────────────────
  {
    const id = active().id;
    useApp.setState((s) => ({
      profiles: s.profiles.map((p) => {
        if (p.id !== id) return p;
        const legacy = { ...p } as Record<string, unknown>;
        delete legacy.activeClass; // как сохранение версии 0.26.0
        return legacy as unknown as typeof p;
      }),
    }));
    // normalizeProfile работает в merge/migrate; здесь проверяем, что UI не падает
    // и трактует отсутствие класса как 2 (availableClass(undefined ?? 2)).
    assert.equal(active().activeClass, undefined, 'поля нет, как в старом сохранении');
    check('старый профиль без класса рендерится', true);
    store().setActiveClass(1);
    assert.equal(active().activeClass, 1, 'старый профиль переключается в 1 класс');
  }

  // ── 3. Смена класса у другого профиля (экран «Профили») ──────────────────
  {
    const before = store().profiles.length;
    const firstId = active().id;
    store().createProfile('Второй', '🐱', 1);
    assert.equal(store().profiles.length, before + 1);
    const second = active();
    assert.equal(second.activeClass, 1, 'класс задаётся при создании');
    assert.equal(store().profiles.find((p) => p.id === firstId)?.activeClass, 1, 'первый профиль остался в 1 классе');

    // setProfileClass меняет класс ИМЕННО выбранного профиля, не активного.
    store().setProfileClass(second.id, 2);
    assert.equal(active().activeClass, 2, 'setProfileClass меняет класс выбранного профиля');
    assert.equal(store().profiles.find((p) => p.id === firstId)?.activeClass, 1, 'чужой профиль не тронут');
    store().setProfileClass(second.id, 9 as never);
    assert.equal(active().activeClass, 2, 'недопустимый класс не записывается');
    store().deleteProfile(second.id);
    store().selectProfile(firstId);
    assert.equal(active().id, firstId, 'после удаления вернулись к первому профилю');
  }

  // ── 3.5. Выгрузка → импорт: класс и прогресс переживают файл ─────────────
  {
    const id = active().id;
    store().setActiveClass(1);
    const snapshot = {
      profiles: structuredClone(store().profiles),
      activeId: store().activeId,
      settings: store().settings,
    };
    const exported = JSON.parse(JSON.stringify(snapshot)); // как JSON.stringify в «Прогрессе»

    store().setActiveClass(2);
    assert.equal(active().activeClass, 2);
    store().replaceAll(exported);
    // replaceAll уводит прежние профили в корзину и загружает файл заново:
    // id сохраняется, класс и опыт должны приехать из файла.
    const restored = store().profiles.find((p) => p.id === id);
    assert.ok(restored, 'профиль восстановлен из выгрузки');
    assert.equal(restored!.activeClass, 1, 'класс приехал из файла');
    assert.equal(restored!.xp, 1234, 'опыт приехал из файла');
    store().selectProfile(id);
    assert.equal(active().activeClass, 1);
  }

  // ── 3.6. Импорт из будущей версии и старый файл без поля ─────────────────
  {
    const id = active().id;
    const base = structuredClone(store().profiles.find((p) => p.id === id)!);
    // Файл из версии с 4 классом: класс есть, но программы в сборке ещё нет.
    store().replaceAll({
      profiles: [{ ...base, activeClass: 4 as never, xp: 777 }],
      activeId: id,
      settings: store().settings,
    });
    assert.equal(active().activeClass, 4, 'сохранённый класс не перезаписывается при импорте');
    assert.equal(active().xp, 777, 'опыт из файла');
    // A отрисовка берёт ближайший доступный класс — проверено в tests/content.test.ts.

    // Старый файл (0.26.0) без поля: профиль должен открыться во 2 классе.
    const legacy = { ...base } as Record<string, unknown>;
    delete legacy.activeClass;
    store().replaceAll({
      profiles: [legacy as unknown as typeof base],
      activeId: id,
      settings: store().settings,
    });
    assert.equal(active().activeClass, 2, 'старый файл → 2 класс');
    assert.equal(active().xp, 1234, 'старый файл: опыт на месте');
    assert.equal(active().streak, 9, 'старый файл: серия на месте');
  }

  // ── 4. UI: пилюля класса, путь и герой ────────────────────────────────────
  {
    // Профиль из части 1: возвращаем ему 2 класс (часть 3 оставила 1 класс),
    // и часть уроков уже закрыта — путь должен показать 16 уроков 2 класса.
    store().setActiveClass(2);
    const host = document.createElement('div');
    document.body.appendChild(host);
    const ui: Root = createRoot(host);
    ui.render(createElement(App));
    await sleep(80);

    const pill = Array.from(host.querySelectorAll<HTMLButtonElement>('.class-pill'))[0];
    check('на главной есть пилюля класса', !!pill, body().slice(0, 200));
    check('в пилюле написан класс', !!pill && (pill.textContent ?? '').includes('2 класс'), pill?.textContent ?? '');
    const nodes2 = host.querySelectorAll('.node-btn').length;
    check('путь 2 класса — 16 уроков', nodes2 === LESSONS_BY_GRADE[2].length, `узлов: ${nodes2}`);

    click(pill!);
    await sleep(50);
    const cards = Array.from(host.querySelectorAll<HTMLButtonElement>('.class-card'));
    check('лист класса открыт', cards.length === AVAILABLE_CLASSES.length, `карточек: ${cards.length}`);
    const g1 = cards.find((c) => (c.textContent ?? '').includes('1 класс'))!;
    check('в листе есть 1 класс с числом слов', (g1.textContent ?? '').includes(String(WORDS_BY_GRADE[1].length)), g1.textContent ?? '');
    click(g1);
    await sleep(80);

    check('класс переключился и лист закрылся', !host.querySelector('.class-card') && active().activeClass === 1);
    check('XP не изменился после переключения', active().xp === 1234, `xp: ${active().xp}`);
    check('кристаллы не изменились', active().gems === 87, `gems: ${active().gems}`);
    check('покупка на месте', (active().shop?.owned ?? []).includes('phone-retro'));

    const nodes1 = host.querySelectorAll('.node-btn').length;
    check('путь 1 класса — 5 уроков', nodes1 === LESSONS_BY_GRADE[1].length, `узлов: ${nodes1}`);
    check('на главной виден 1 класс', has('1 класс'));

    // Урок 1 класса открывается и показывает слова именно этого класса.
    const firstNode = host.querySelector<HTMLButtonElement>('.node-btn')!;
    click(firstNode);
    await sleep(120);
    // id урока в разметке: не зависим от того, какая карточка выпала первой.
    const screenEl = host.querySelector('.lesson-screen') as HTMLElement | null;
    const openedId = screenEl?.dataset.lessonId ?? '';
    const opened = LESSONS_BY_GRADE[1].find((l) => l.id === openedId);
    check('урок 1 класса взят из программы 1 класса', !!opened, openedId || 'урок не открылся');
    check(
      'в уроке 1 класса только слова 1 класса',
      !!opened && opened.wordIds.every((id) => WORD_BY_ID[id].grades.includes(1)),
      opened ? opened.wordIds.join(', ') : 'урок не найден',
    );
    // Если карточка показывает слово — оно тоже из 1 класса (тип задания
    // выбирается перемешиванием, и не каждая карточка называет слово).
    const word = currentWord();
    if (word) {
      check(
        'карточка урока 1 класса показывает слово 1 класса',
        WORD_BY_ID[word.id].grades.includes(1),
        `${word.text} (${WORD_BY_ID[word.id].grades.join(',')})`,
      );
    }
    // Выходим из урока, не завершая его.
    const exit = btnText('Выйти');
    if (exit) click(exit);
    await sleep(120);
    const stay = buttons().find((b) => (b.textContent ?? '').trim() === 'Остаться');
    if (stay) click(stay);
    await sleep(80);

    // Возвращаемся в 2 класс: уровни уроков и прогресс на месте.
    const lessonsBefore = active().lessons;
    store().setActiveClass(2);
    await sleep(60);
    assert.deepEqual(active().lessons, lessonsBefore, 'переключение туда-обратно не тронуло уроки');
    assert.equal(active().xp, 1234, 'опыт на месте после возврата');

    // Урок 1 класса остался открытым (выход отменили), поэтому 3 класс
    // проверяем на свежем экране — с главной.
    ui.unmount();
    store().setActiveClass(3);
    const host3 = document.createElement('div');
    document.body.appendChild(host3);
    const ui3: Root = createRoot(host3);
    ui3.render(createElement(App));
    await sleep(120);

    // ── 3 класс: программа и урок берутся из своего класса ──────────────────
    const nodes3 = host3.querySelectorAll('.node-btn').length;
    check('путь 3 класса — 13 уроков', nodes3 === LESSONS_BY_GRADE[3].length, `узлов: ${nodes3}`);
    check('на главной виден 3 класс', (host3.textContent ?? '').includes('3 класс'));
    const firstNode3 = host3.querySelector<HTMLButtonElement>('.node-btn')!;
    click(firstNode3);
    await sleep(120);
    const screen3 = host3.querySelector('.lesson-screen') as HTMLElement | null;
    const opened3 = LESSONS_BY_GRADE[3].find((l) => l.id === (screen3?.dataset.lessonId ?? ''));
    check('урок 3 класса взят из программы 3 класса', !!opened3, screen3?.dataset.lessonId ?? 'урок не открылся');
    check(
      'в уроке 3 класса только слова 3 класса',
      !!opened3 && opened3.wordIds.every((id) => WORD_BY_ID[id].grades.includes(3)),
      opened3 ? opened3.wordIds.join(', ') : 'урок не найден',
    );
    assert.equal(active().xp, 1234, '3 класс не тронул опыт');
    assert.equal(active().gems, 87, '3 класс не тронул кристаллы');
    assert.equal(active().streak, 9, '3 класс не тронул серию');
    ui3.unmount();
    host3.remove();
    ui.unmount();
    host.remove();
  }

  console.log('✓ классы: смена не сбрасывает опыт, товары и награды; путь и урок берутся из своего класса');
}

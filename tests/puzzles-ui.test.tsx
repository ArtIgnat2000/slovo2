// Костюмные пазлы — интеграционные проверки через настоящий UI.
// Чистые правила движка — в tests/puzzles.test.ts; здесь видно то, что только в сборке:
//  • реальный завершённый урок приносит фрагмент (строка на экране результатов);
//  • 9-й фрагмент собирает костюм: праздничный блок, костюм надет, сборка
//    продолжается следующим костюмом;
//  • магазин: сетка из 10 карточек, точки прогресса, «Собирать» меняет цель,
//    «Надеть»/«Надето ✓» переключают костюм, несобранные — помечены замком, но
//    рисуются в полном цвете (обесцвечивание убрали 2026-10-03);
//  • перелив: вся коллекция собрана → кристаллы вместо фрагмента;
//  • «Повторение» фрагментов не даёт (проверка привязки в LessonScreen).
// Блок запускается из tests/smoke.test.tsx последним: сам сеет профиль и пазлы.
import { readFileSync } from 'node:fs';
import type { Profile, PuzzleState } from '../src/types';
import { COSTUMES, PUZZLE_SIZE } from '../src/engine/puzzles';
import { useApp } from '../src/state/store';
import { btnText, buttons, check, click, has, sleep } from './ui-helpers';

const store = () => useApp.getState();

function active(): Profile {
  const s = store();
  const p = s.profiles.find((x) => x.id === s.activeId);
  if (!p) throw new Error('пазлы: нет активного профиля');
  return p;
}

/** Постелить нужное состояние пазла активному профилю — предусловие сценария. */
function seedPuzzle(patch: Partial<PuzzleState>) {
  useApp.setState((s) => ({
    profiles: s.profiles.map((p) =>
      p.id === s.activeId ? { ...p, puzzle: { ...normalizeSeed(p), ...patch } } : p,
    ),
  }));
}
function normalizeSeed(p: Profile): PuzzleState {
  return p.puzzle ?? { pieces: {}, collecting: null, assembled: [], worn: null };
}

async function goTab(name: string) {
  const tab = buttons().find((b) => (b.textContent ?? '').includes(name) && b.className.includes('tab'));
  click(tab);
  await sleep(60);
}

export async function runPuzzleUiChecks(playLesson: (second?: boolean) => Promise<void>) {
  console.log('\n── Костюмные пазлы: урок → фрагмент → костюм ──');

  // Чистый профиль: у нового ребёнка уже есть «текущий» костюм — первый несобранный
  store().createProfile('Тест пазлов', '🦉');
  await sleep(60);
  await goTab('Уроки');
  check('пазлы: у нового профиля пустая коллекция', (active().puzzle?.assembled.length ?? -1) === 0);

  // 8 фрагментов первого костюма — следующий завершённый урок его собирает
  seedPuzzle({ pieces: { [COSTUMES[0].id]: PUZZLE_SIZE - 1 }, collecting: COSTUMES[0].id, assembled: [], worn: null });
  await playLesson(true);
  await sleep(80);

  check(
    'пазлы: экран результатов показывает собранный пазл',
    has('Пазл собран') && has(COSTUMES[0].title),
    document.querySelector('.screen')?.textContent?.slice(0, 220) ?? '',
  );
  let p = active();
  check(
    'пазлы: 9-й фрагмент разблокирует костюм и надевает его',
    p.puzzle?.assembled.includes(COSTUMES[0].id) === true && p.puzzle.worn === COSTUMES[0].id,
    JSON.stringify(p.puzzle ?? null),
  );
  check(
    'пазлы: сборка продолжается следующим несобранным костюмом',
    p.puzzle?.collecting === COSTUMES[1].id && (p.puzzle.pieces[COSTUMES[1].id] ?? 0) === 0,
    JSON.stringify(p.puzzle?.collecting ?? null),
  );
  check('пазлы: праздничный блок с БУКом в костюме виден', !!document.querySelector('.puzzle-win .mascot'));
  click(btnText('Здорово!'));
  await sleep(40);
  check('пазлы: «Здорово!» закрывает праздничный блок', !document.querySelector('.puzzle-win'));

  // Ещё один урок — первый фрагмент следующего костюма и честный счётчик
  click(btnText('К урокам'));
  await sleep(40);
  await playLesson(true);
  await sleep(80);
  check('пазлы: новый фрагмент показан как 1 из 9', has('1 из 9'), document.querySelector('.card')?.textContent ?? '');
  p = active();
  check('пазлы: кристаллы за обычные фрагменты не начисляются', p.gems === 0, String(p.gems));
  click(btnText('К урокам'));
  await sleep(40);

  // Магазин БУКа: сетка костюмов, прогресс и примерка
  await goTab('БУК');
  const cards = () => Array.from(document.querySelectorAll('.costume-card'));
  check('пазлы: в магазине 10 карточек костюмов', cards().length === 10, String(cards().length));
  const snowCard = cards().find((el) => (el.textContent ?? '').includes(COSTUMES[1].title));
  check(
    'пазлы: на карточке видно 1 собранный фрагмент из 9',
    !!snowCard && snowCard.querySelectorAll('.pz-dot.on').length === 1,
    snowCard?.querySelector('.pz-dots')?.textContent ?? 'нет карточки',
  );
  const lordCard = cards().find((el) => (el.textContent ?? '').includes(COSTUMES[0].title));
  check('пазлы: собранный костюм помечен надетым', !!lordCard?.textContent?.includes('Надето ✓'));
  // Несобранный костюм помечен, но РИСУНОК В ЦВЕТЕ: обесцвеченные карточки
  // («grayscale + opacity», было до 2026-10-03) мешали ребёнку выбрать цель.
  const lockedArt = snowCard?.querySelector('.pz-locked svg');
  check(
    'пазлы: несобранный костюм помечен замком, но показан в полном цвете',
    !!snowCard?.querySelector('.pz-locked') && (lockedArt?.innerHTML ?? '').includes(`fill="${COSTUMES[1].body}"`),
    lockedArt ? `нет цвета ${COSTUMES[1].body} в карточке` : 'в .pz-locked нет svg',
  );
  check(
    'пазлы: текущая цель подсвечена, а не приглушена',
    !!snowCard?.className.includes('current') && !lordCard?.className.includes('current'),
    snowCard?.className ?? 'нет карточки',
  );
  // Страж от отката прямо в стилях: правило .pz-locked не имеет права глушить цвет.
  const lockedRule = readFileSync('src/styles/app.css', 'utf8').match(/\.pz-locked\s*\{[^}]*\}/)?.[0] ?? '';
  check(
    'пазлы: стили не обесцвечивают несобранные костюмы',
    lockedRule.length > 0 && !/grayscale|saturate|opacity/.test(lockedRule),
    lockedRule.replace(/\s+/g, ' ').trim() || 'правило .pz-locked не найдено',
  );

  // Сменить цель можно тапом — прогресс прежней цели не сгорит
  const thirdBtn = cards()
    .find((el) => (el.textContent ?? '').includes(COSTUMES[2].title))
    ?.querySelector('button') as HTMLButtonElement | undefined;
  click(thirdBtn);
  await sleep(40);
  p = active();
  check('пазлы: «Собирать» переключает цель', p.puzzle?.collecting === COSTUMES[2].id, String(p.puzzle?.collecting));
  const snowBtn = snowCard?.querySelector('button') as HTMLButtonElement | undefined;
  check('пазлы: прежняя цель предлагается продолжить', (snowBtn?.textContent ?? '').includes(`Продолжить · 1/${PUZZLE_SIZE}`), snowBtn?.textContent ?? '');

  // Снять и снова надеть костюм (кнопки перечитываем: после перерисовки висячие ссылки опасны)
  const wearBtn = (title: string) =>
    (Array.from(document.querySelectorAll('.costume-card'))
      .find((el) => (el.textContent ?? '').includes(title))
      ?.querySelector('button') as HTMLButtonElement | undefined);
  click(wearBtn(COSTUMES[0].title));
  await sleep(60);
  check('пазлы: тап по «Надето ✓» снимает костюм', active().puzzle?.worn === null, String(active().puzzle?.worn));
  click(wearBtn(COSTUMES[0].title));
  await sleep(60);
  check('пазлы: «Надеть» возвращает костюм', active().puzzle?.worn === COSTUMES[0].id, String(active().puzzle?.worn));

  // Перелив: вся коллекция собрана — урок даёт кристаллы вместо фрагментов
  const gemsBefore = active().gems;
  seedPuzzle({
    assembled: COSTUMES.map((c) => c.id),
    collecting: null,
    worn: null,
    pieces: Object.fromEntries(COSTUMES.map((c) => [c.id, PUZZLE_SIZE])),
  });
  await goTab('Уроки');
  await playLesson(true);
  await sleep(80);
  check('пазлы: после коллекции показан перелив кристаллами', has('Коллекция собрана'), document.querySelector('.card')?.textContent ?? '');
  p = active();
  check('пазлы: перелив начислил ровно +2 💎', p.gems === gemsBefore + 2, `${gemsBefore} → ${p.gems}`);

  // «Повторение» фрагментов не даёт: выдача вызывается только в ветке non-review
  const src = readFileSync('src/ui/screens/LessonScreen.tsx', 'utf8');
  check(
    'пазлы: выдача привязана к завершению настоящего урока, не повторения',
    /if \(lessonId !== REVIEW\.id\) \{[\s\S]*?finishPuzzleLesson\(\)/.test(src),
    'нет guard-а в LessonScreen',
  );
}

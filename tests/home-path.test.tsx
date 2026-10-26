// Главная в один экран (0.67.0) — вариант B из аудита интерфейса.
//
// До 0.67.0 под героем лежали все 13–16 уроков класса: это два с лишним экрана
// прокрутки, и «сегодня» терялось среди одинаковых строк. Теперь главная
// показывает «Дальше» — три ближайших урока, а весь путь раскрывается кнопкой.
//
// Что сторожим:
//  • свёрнуто — не больше трёх уроков, все они из класса ребёнка;
//  • первый из них — текущий (`.node-btn.current`), его видно сразу;
//  • кнопка «Весь путь · N уроков» раскрывает РОВНО все уроки класса;
//  • повторный тап сворачивает обратно, `aria-expanded` честный;
//  • «Позови друга» осталось на главной в один тап, но ниже пути.
// Разбор — docs/proposals/ui-cleanliness.md §3, вариант B.
import './setup';
import { LESSONS_BY_GRADE, availableClass } from '../src/content/words';
import { useApp } from '../src/state/store';
import { body, btn, btnText, buttons, check, click, expandPath, sleep } from './ui-helpers';

/** Сколько уроков видно в свёрнутом виде. */
const PREVIEW = 3;

async function toHome(): Promise<void> {
  const exit = buttons().find((b) => b.getAttribute('aria-label') === 'Выйти из урока');
  if (exit) {
    click(exit);
    await sleep(60);
    if ((document.body.textContent ?? '').includes('Выйти из урока?')) {
      click(btnText('Выйти'));
      await sleep(80);
    }
  }
  const home = buttons().find((b) => (b.textContent ?? '').includes('Уроки') && b.className.includes('tab'));
  if (home) {
    click(home);
    await sleep(80);
  }
}

const nodes = () => Array.from(document.querySelectorAll('.node-btn')) as HTMLButtonElement[];

export async function runHomePathChecks(): Promise<void> {
  console.log('\n── Главная: «Дальше» и раскрывающийся путь ──');
  await toHome();

  // Профиль читаем из стора напрямую: тест — не компонент, хуки здесь нельзя.
  const store = useApp.getState();
  const profile = store.profiles.find((p) => p.id === store.activeId) ?? null;
  const grade = availableClass(profile?.activeClass ?? 2);
  const lessons = LESSONS_BY_GRADE[grade];

  const toggle = document.querySelector('[data-path-toggle]') as HTMLButtonElement | null;
  check('путь: на главной есть кнопка «Весь путь · N уроков»', !!toggle, body().slice(0, 160));
  check(
    'путь: кнопка говорит, сколько уроков в программе класса',
    !!toggle && (toggle.textContent ?? '').includes(String(lessons.length)),
    toggle?.textContent ?? '—',
  );
  check(
    'путь: свёрнут по умолчанию (aria-expanded="false")',
    toggle?.getAttribute('aria-expanded') === 'false',
    toggle?.getAttribute('aria-expanded') ?? 'нет атрибута',
  );

  const folded = nodes();
  check(
    `путь: свёрнуто — не больше ${PREVIEW} уроков`,
    folded.length > 0 && folded.length <= PREVIEW,
    `уроков: ${folded.length}`,
  );
  check(
    'путь: первый видимый урок — текущий (его и открывает «Начать ▶»)',
    !!document.querySelector('.node-btn.current') && folded[0]?.classList.contains('current'),
    folded.map((n) => n.className).join(' | '),
  );
  check(
    'путь: свёрнутый список короче всей программы (иначе экономии нет)',
    folded.length < lessons.length,
    `${folded.length} из ${lessons.length}`,
  );

  // Раскрываем: путь обязан показать РОВНО все уроки класса, без дублей.
  await expandPath();
  const opened = nodes();
  const expandedAttr = document.querySelector('[data-path-toggle]')?.getAttribute('aria-expanded');
  check('путь: раскрытие показывает все уроки класса', opened.length === lessons.length, `уроков: ${opened.length}, ждали ${lessons.length}`);
  check('путь: после раскрытия aria-expanded="true"', expandedAttr === 'true', expandedAttr ?? '—');
  check(
    'путь: в раскрытом виде кнопка предлагает свернуть',
    (document.querySelector('[data-path-toggle]')?.textContent ?? '').includes('Свернуть'),
    document.querySelector('[data-path-toggle]')?.textContent ?? '—',
  );
  const ids = opened.map((n) => (n.textContent ?? '').trim()).join('|');
  check('путь: уроки не дублируются', new Set(ids.split('|')).size === opened.length, ids.slice(0, 120));

  // Сворачиваем обратно: кнопка обязана работать в обе стороны.
  click(document.querySelector('[data-path-toggle]'));
  await sleep(60);
  const refolded = nodes();
  check('путь: повторный тап сворачивает обратно', refolded.length === folded.length, `уроков: ${refolded.length}`);
  check(
    'путь: состояние кнопки вернулось в «свёрнуто»',
    document.querySelector('[data-path-toggle]')?.getAttribute('aria-expanded') === 'false',
    document.querySelector('[data-path-toggle]')?.getAttribute('aria-expanded') ?? '—',
  );

  // Приглашение друга осталось доступным в один тап, но ушло ниже пути:
  // это не ежедневное действие, рядом с «Начать ▶» оно спорило за внимание.
  const invite = document.querySelector('.invite-cta') as HTMLElement | null;
  const path = document.querySelector('[data-path-toggle]') as HTMLElement | null;
  check('путь: «Позови друга» осталось на главной', !!invite, body().slice(0, 160));
  check(
    'путь: «Позови друга» стоит ниже пути, а не перед ним',
    !!invite &&
      !!path &&
      (path.compareDocumentPosition(invite) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
    'порядок блоков не тот',
  );

  // Никакой ломки данных: раскрытие пути — только вид, профиль не менялся.
  check(
    'путь: раскрытие не трогает профиль',
    useApp.getState().activeId === profile?.id,
    'сменился активный профиль',
  );

  // Возвращаем главную в короткое состояние для следующих блоков смоука.
  await expandPath();
  click(document.querySelector('[data-path-toggle]'));
  await sleep(60);
  const btnReset = btn((b) => (b.textContent ?? '').includes('Весь путь'));
  check('путь: главная снова свёрнута — следующие проверки видят короткий экран', !!btnReset, '');
}

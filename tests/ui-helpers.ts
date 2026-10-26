// Общая обвязка смоук-тестов: клики по настоящим кнопкам, поиск по тексту и
// единый счётчик проверок. Вынесена из tests/smoke.test.tsx, потому что тестов
// теперь два файла (smoke.test.tsx и adaptive-ui.test.tsx), а правила должны быть
// одни и те же: «✗» печатает любой из них, а итог считает смоук-раннер.
import { WORDS } from '../src/content/words';

export const sleep = (ms = 0) => new Promise((r) => setTimeout(r, ms));
export const body = () => document.body.textContent ?? '';
export const buttons = () => Array.from(document.querySelectorAll('button')) as HTMLButtonElement[];
export const click = (el?: Element | null) => {
  if (!el) throw new Error('click: элемент не найден\n' + new Error().stack);
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
};
export const btn = (pred: (b: HTMLButtonElement) => boolean) => buttons().find(pred);
export const btnText = (t: string) => btn((b) => (b.textContent ?? '').includes(t));
export const has = (t: string) => body().includes(t);

/**
 * Раскрыть «весь путь» на главной (0.67.0).
 *
 * С 0.67.0 главная показывает только «Дальше» — три ближайших урока, а весь
 * путь раскрывается кнопкой. Тестам, которые считают уроки класса или ищут
 * урок по счёту, нужно сначала раскрыть путь. Идемпотентно: если путь уже
 * раскрыт (`aria-expanded="true"`), ничего не делает.
 */
export async function expandPath(): Promise<void> {
  const toggle = document.querySelector('[data-path-toggle]') as HTMLButtonElement | null;
  if (toggle && toggle.getAttribute('aria-expanded') !== 'true') {
    click(toggle);
    await sleep(60);
  }
}

/** Меню ☰ на главной (0.33.0). Идемпотентно, если уже открыто. */
export async function openHomeMenu(): Promise<void> {
  if (document.querySelector('.home-menu')) return;
  const trigger = document.querySelector('[data-menu-trigger]');
  if (trigger) {
    click(trigger);
    await sleep(60);
  }
}

/** Лист наград на главной: квесты, сундук, неделя. Идемпотентно, если уже открыт.
 *  С 0.33.0 🎁 в шапке нет — награды живут первой строкой меню ☰. */
export async function openRewardsSheet(): Promise<void> {
  if (document.querySelector('.rewards-sheet')) return;
  await openHomeMenu();
  const row = document.querySelector('[data-menu="rewards"]');
  if (row) {
    click(row);
    await sleep(60);
  }
}

/**
 * Кристалл и число в интерфейсе (0.54.0): эмодзи 💎 заменён компонентом
 * `<Gem>` — SVG-иконка с `aria-hidden` плюс число. Текста «💎 128» больше нет,
 * поэтому ищем по классу и сравниваем число.
 */
export const gemAmounts = () =>
  Array.from(document.querySelectorAll('.gem-amount')).map((el) => (el.textContent ?? '').trim());

/** Есть ли где-то на экране счётчик/цена с этим числом кристаллов. */
export const hasGem = (n: number | string) => gemAmounts().includes(String(n));

/** Кнопка подсказки в задании: 0.54.0 — иконка вместо «💡 Подсказка». */
export const hintButton = () => document.querySelector('[data-hint]') as HTMLButtonElement | null;

let failures = 0;

export function check(name: string, cond: boolean, extra = '') {
  console.log(`${cond ? '✓' : '✗'} ${name}${cond ? '' : ' — ' + extra}`);
  if (!cond) failures++;
}

/** Сколько проверок упало — смоук-раннер по этому числу выбирает код выхода. */
export const failureCount = () => failures;

export const byHint = new Map(WORDS.map((w) => [w.hint, w]));

/**
 * Переключить раздел в «Родителям».
 *
 * Раздел переделан в четыре раздела-вкладки (обзор, прогресс, настройки,
 * приложение), поэтому тестам нужно сначала открыть нужный — иначе проверка
 * «родителям видно…» ловила бы контент соседней вкладки.
 */
export async function openParentSection(title: string): Promise<HTMLButtonElement | undefined> {
  const tab = buttons().find(
    (b) => b.getAttribute('role') === 'tab' && (b.textContent ?? '').includes(title),
  );
  if (tab) {
    click(tab);
    await sleep(50);
  }
  return tab;
}

/** Какое слово сейчас в задании — по подсказке в блоке clue. */
export function currentWord() {
  const clue = document.querySelector('.clue-hint');
  if (clue) {
    const txt = (clue.textContent ?? '').replace(/^💡\s*/, '').split('·')[0].trim();
    const fromClue = byHint.get(txt);
    if (fromClue) return fromClue;
  }
  // «Окошко» не показывает clue-hint: восстанавливаем слово по видимым буквам
  // и □, чтобы намеренная ошибка в smoke всегда была действительно ошибкой.
  const spans = Array.from(document.querySelectorAll('.word-big > span'));
  const pattern = spans.map((s) => (s.textContent ?? '').trim()).join('');
  // Карточка «Запомни слово» (визуальный диктант) показывает слово целиком,
  // без пропусков. Раньше helper возвращал null, и тест БУКа падал с
  // «слово не определилось» — хотя слово на экране было. 0.63.0.
  if (pattern && !pattern.includes('□')) {
    return WORDS.find((w) => w.text.toLowerCase() === pattern.toLowerCase()) ?? null;
  }
  if (!pattern.includes('□')) return null;
  return (
    WORDS.find(
      (w) =>
        w.text.length === pattern.length &&
        [...pattern].every((ch, i) => ch === '□' || ch === w.text[i]),
    ) ?? null
  );
}

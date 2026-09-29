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

let failures = 0;

export function check(name: string, cond: boolean, extra = '') {
  console.log(`${cond ? '✓' : '✗'} ${name}${cond ? '' : ' — ' + extra}`);
  if (!cond) failures++;
}

/** Сколько проверок упало — смоук-раннер по этому числу выбирает код выхода. */
export const failureCount = () => failures;

export const byHint = new Map(WORDS.map((w) => [w.hint, w]));

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
  if (!pattern.includes('□')) return null;
  return (
    WORDS.find(
      (w) =>
        w.text.length === pattern.length &&
        [...pattern].every((ch, i) => ch === '□' || ch === w.text[i]),
    ) ?? null
  );
}

// Факты о слове, которые нужны и движку, и интерфейсу — без React и DOM.
//
// Раньше `dangerSummary` и `plural` жили в `ui/WordView.tsx`. Когда их
// понадобилось использовать правилам помощи БУКа (`state/bukHelp.ts`),
// вынести их в `engine/` оказалось честнее: слой состояния не должен тянуть
// за собой UI-модуль с картинками и компонентами.
import type { Word } from '../types';

const VOWELS = 'аеёиоуыэюя';

export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/** Человеческое описание «опасных» букв — по самим буквам, а не по общему типу слова. */
export function dangerSummary(word: Word): string {
  if (!word.danger.length) return 'Опасных букв нет — слово пишется так, как слышится';
  const letters = [...new Set(word.danger.map((i) => word.text[i].toUpperCase()))];
  const vowels = word.danger.filter((i) => VOWELS.includes(word.text[i])).length;
  const kind =
    vowels === word.danger.length
      ? plural(word.danger.length, 'безударная гласная', 'безударные гласные', 'безударные гласные')
      : vowels === 0
        ? plural(word.danger.length, 'согласная', 'согласные', 'согласные')
        : 'буквы, которые нужно запомнить';
  return `${word.danger.length > 1 ? 'Опасные буквы' : 'Опасная буква'}: ${letters.join(', ')} (${kind})`;
}

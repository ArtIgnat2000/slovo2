// Отбор слов для пробы озвучки: по риску ошибки TTS, детерминированно.
// Экспортирует массив карточек-строк для docs/tts/tts-trial.html.
import { WORDS } from '../../src/content/words';
import { KNOWN_STRESS } from '../../src/content/stress-dict';

export interface TtsItem {
  /** Слово как в банке (может быть фразой); из школьного списка — помечено. */
  text: string;
  /** То же с комбинируемым ударным знаком U+0301 после ударной буквы. */
  marked: string;
  /** Слоги через дефис (как в банке), для служебных слов может быть пусто. */
  syllables: string;
  /** Предложение с подставленным словом (режим «в предложении»). */
  sentence: string;
  grades: number[];
  note?: string;
}

const ACUTE = '́';

export function markStress(text: string, stress: number): string {
  // «ё» всегда ударная — знак ей не нужен и лишний символ может сбить синтез.
  if (/[ёЁ]/.test(text[stress] ?? '')) return text;
  return text.slice(0, stress + 1) + ACUTE + text.slice(stress + 1);
}

export function pickRiskWords(): TtsItem[] {
  const lowerKey = (s: string) => s.trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
  const knownInBank = new Set<number>();
  for (const [i, w] of WORDS.entries()) {
    if (KNOWN_STRESS[lowerKey(w.text)] !== undefined) knownInBank.add(i);
  }
  const picked = new Set<number>();
  for (const [i, w] of WORDS.entries()) {
    const hasCaps = w.text !== w.text.toLowerCase();
    const hasYo = /ё/i.test(w.text);
    const isLong = w.text.replace(/\s+/g, '').length >= 11;
    if (hasCaps || hasYo || isLong || knownInBank.has(i)) picked.add(i);
  }
  const items = [...picked].map((i) => WORDS[i]);
  // Сортировка: класс → длина → слово (стабильно между генерациями)
  items.sort((a, b) => Math.min(...a.grades) - Math.min(...b.grades) || b.text.length - a.text.length || a.text.localeCompare(b.text, 'ru'));
  const bankItems: TtsItem[] = items.map((w) => ({
    text: w.text,
    marked: markStress(w.text, w.stress),
    syllables: w.syllables.join('-'),
    sentence: (w.sentence ?? '').replace('____', markStress(w.text, w.stress)),
    grades: [...w.grades],
  }));
  // Школьные термины (не банк, а учительский список) — звучали с неверным
  // ударением в ранних пробах, полезно услышать и их. Ударения — из
  // KNOWN_STRESS (проверены по словарям).
  const manual: TtsItem[] = [
    {
      text: 'подлежащее',
      marked: markStress('подлежащее', KNOWN_STRESS['подлежащее']),
      syllables: 'под-ле-жа-ще-е',
      sentence: markStress('Подлежащее', KNOWN_STRESS['подлежащее']) + ' — главный член предложения.',
      grades: [3, 4, 5],
      note: 'школьный список',
    },
    {
      text: 'сказуемое',
      marked: markStress('сказуемое', KNOWN_STRESS['сказуемое']),
      syllables: 'ска-зу-е-мо-е',
      sentence: markStress('Сказуемое', KNOWN_STRESS['сказуемое']) + ' — главный член предложения.',
      grades: [3, 4, 5],
      note: 'школьный список',
    },
  ];
  return [...bankItems, ...manual];
}

// ── Работа с «днём» ──────────────────────────────────────────────────────────
// Живёт в engine/, а не в store, чтобы чистая логика (задания дня, SRS)
// могла считать даты, не создавая циклический импорт со стором.

/** Ключ дня по локальному времени: 2026-09-27. Именно так режется вся статистика. */
export function dayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function prevDay(key: string): string {
  const [y, m, dd] = key.split('-').map(Number);
  const d = new Date(y, m - 1, dd);
  d.setDate(d.getDate() - 1);
  return dayKey(d);
}

/** Последние n дней (включая сегодня) — для календарей серии. */
export function lastDays(n: number, today: string = dayKey()): string[] {
  const [y, m, dd] = today.split('-').map(Number);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(y, m - 1, dd - i);
    out.push(dayKey(d));
  }
  return out;
}

/**
 * Приветствие по времени суток — один источник для плавающего БУКа и чата
 * «Спроси БУКа» (0.87.0: раньше жило в state/mascot, движку нужен был свой
 * без импорта в обратную сторону). Намеренно без «поздно, пора спать»:
 * режим дня — решение взрослого, а не совы (docs/mascot-interactivity.md).
 */
export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 11) return 'Доброе утро! ☀️';
  if (hour >= 11 && hour < 18) return 'Привет! 👋';
  if (hour >= 18 && hour < 22) return 'Добрый вечер! 🌆';
  return 'Тсс, все спят… 🤫';
}

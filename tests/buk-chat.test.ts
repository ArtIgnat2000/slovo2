// Чат «Спроси БУКа» (0.87.0; docs/buk-companion-3d.md §5, идеи 2–3) — без DOM.
// Свойства, которые легко сломать правкой фразы:
//  • каждая реплика ≤ 70 знаков (спека: влезает в пузырь чата);
//  • корневые чипы отвечают по-разному — без повторов;
//  • фолбэк на неизвестное не называет слов из пака (без утечки «правильного»);
//  • потолок подхода: после MAX_BUK_LINES реплик — только предложение сделать дело;
//  • никаких наград: у ответа нет полей кроме lines/chips/action/facts;
//  • память — только whitelist-факты, шаблоны отсылок ≤ 70 знаков и
//    детерминированы внутри дня (нет Math.random).
// Файл подключается из tests/adaptive.test.ts, поэтому идёт и в test:adaptive,
// и в смоук.
import assert from 'node:assert/strict';
import { WORDS } from '../src/content/words';
import {
  LINE_LIMIT,
  MAX_BUK_LINES,
  MEMORY_POOLS,
  chatRespond,
  memoryLine,
  normalizeBukFacts,
  openChat,
  sessionStart,
  stressedText,
  type ChatChip,
  type ChatReply,
} from '../src/engine/buk-chat';
import { greetingFor } from '../src/engine/day';
import { nextStartAction } from '../src/engine/next-start';
import type { BukFacts, Profile, WordState } from '../src/types';

const DAY = 86_400_000;

function profileWith(practised = 0): Profile {
  const now = Date.now();
  const words: Record<string, WordState> = {};
  WORDS.slice(0, practised).forEach((w, i) => {
    words[w.id] = { s: 20 + i, due: now + 3 * DAY, iv: 2, n: 2, seen: now - DAY, ok: 2, wrong: 0 };
  });
  return {
    id: 'p_chat',
    name: 'Тест',
    avatar: '🦊',
    createdAt: now,
    xp: 0,
    gems: 0,
    streak: 0,
    lastDay: '',
    freezes: 0,
    words,
    lessons: {},
    errors: {},
    days: {},
    achievements: [],
  };
}

const ctx = (profile: Profile = profileWith(), hour = 12, goal = 10) => ({ profile, hour, goal });

/** Собирает все строки ответа: и проверяет контракт полей, и копит для лимита. */
const collected: string[] = [];
function remember(reply: ChatReply, label: string): ChatReply {
  for (const key of Object.keys(reply)) {
    assert.ok(
      ['lines', 'chips', 'action', 'facts'].includes(key),
      `${label}: лишнее поле ответа «${key}» — в чате нет места для наград`,
    );
  }
  assert.ok(reply.lines.length > 0, `${label}: пустой ответ`);
  for (const line of reply.lines) {
    assert.ok(line.length > 0 && /[.!?🎉!?:…]/.test(line), `${label}: «${line}» — должна быть реплика`);
    collected.push(line);
  }
  if (reply.action) {
    assert.ok(reply.action.label.length <= LINE_LIMIT, `${label}: подпись действия длиннее лимита`);
    collected.push(reply.action.label);
  }
  for (const chip of reply.chips ?? []) {
    assert.ok(chip.label.length <= 20, `${label}: чип «${chip.label}» длиннее 20 знаков`);
    collected.push(chip.label);
  }
  return reply;
}

// ── Приветствие: по времени, чипы корня на месте ─────────────────────────────
for (const hour of [0, 3, 5, 10, 11, 17, 18, 21, 22, 23]) {
  const { reply, session } = openChat(ctx(profileWith(), hour));
  remember(reply, `open@${hour}`);
  assert.equal(reply.lines[0], greetingFor(hour), `open@${hour}: приветствие должно совпадать с маскотом`);
  assert.equal(reply.chips?.length, 5, 'open: пять корневых чипов');
  assert.equal(session.lines, reply.lines.length, 'open: сессия считает реплики');
}
{
  const { reply } = openChat(ctx());
  const ids = (reply.chips ?? []).map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, 'корневые чипы без дублей id');
}

// ── У каждого корневого чипа свой старт — без повторов ───────────────────────
{
  const starts = new Map<string, string[]>();
  for (const chipId of ['today', 'spelling', 'rule', 'tell', 'play']) {
    const { reply } = chatRespond({ chipId }, ctx(profileWith(12)), sessionStart());
    remember(reply, chipId);
    starts.set(chipId, reply.lines);
  }
  const firsts = [...starts.values()].map((l) => l[0]);
  assert.equal(new Set(firsts).size, firsts.length, 'у корневых чипов разные первые реплики');
}

// ── Вопрос про слово: ответ из word-facts для ВСЕХ слов пака ─────────────────
for (const word of WORDS) {
  const { reply } = chatRespond({ chipId: `word:${word.id}` }, ctx(profileWith(12)), sessionStart());
  remember(reply, `word:${word.id}`);
  assert.ok(
    reply.lines[0].includes(word.syllables.join('-')),
    `word:${word.id}: первая реплика должна показывать слоги ${word.syllables.join('-')}`,
  );
  assert.ok(
    reply.lines[0].toLowerCase().includes('ударение'),
    `word:${word.id}: без ударения — половинный ответ`,
  );
}
{
  const w = WORDS[0];
  const { reply } = chatRespond({ text: w.text }, ctx(), sessionStart());
  remember(reply, 'typed-word');
  assert.ok(reply.lines[0].includes(w.syllables.join('-')), 'печать известного слова — ответ из фактов');
  assert.equal(reply.action?.label, 'Потренироваться', 'после слова — кнопка «Потренироваться»');
  assert.ok(reply.action?.lessonId, 'кнопка ведёт в конкретный урок');
}
{
  // Ударение — тот же, что в слове: острый знак сразу после гласной.
  for (const w of WORDS.slice(0, 40)) {
    const s = stressedText(w);
    assert.equal(s.length, w.text.length + 1, 'stressedText: ровно один знак-акцент');
    assert.ok(s.includes('\u0301'), 'stressedText: акцент на месте');
  }
}

// ── Фолбэк не называет слов пака: вопрос не подсказывает ответ ───────────────
{
  const { reply } = chatRespond({ text: 'какой-то случайный текст' }, ctx(), sessionStart());
  remember(reply, 'fallback');
  const low = reply.lines[0].toLowerCase();
  for (const w of WORDS) {
    assert.ok(!low.includes(w.text.toLowerCase()), `фолбэк содержит слово пака «${w.text}»`);
  }
  const { reply: greet } = chatRespond({ text: 'привет!' }, ctx(), sessionStart());
  remember(greet, 'greet');
  assert.ok(greet.lines[0].toLowerCase().includes('привет'), 'печатное приветствие — приветствие в ответ');
}

// ── Сцена «Расскажу о себе»: только whitelist-факты, всё по шагам ────────────
{
  let s = sessionStart();
  const c = ctx();
  const steps: { chipId?: string; text?: string; fact?: keyof BukFacts }[] = [
    { chipId: 'tell', fact: undefined },
    { chipId: 'fact:animal:кот', fact: 'animal' },
    { chipId: 'fact:color:синий', fact: 'color' },
    { text: 'Мурзик', fact: 'petName' },
  ];
  const seenFacts: string[] = [];
  for (const step of steps) {
    const out = chatRespond({ chipId: step.chipId, text: step.text }, c, s);
    remember(out.reply, `scene:${step.chipId ?? step.text}`);
    s = out.session;
    if (out.reply.facts) {
      for (const key of Object.keys(out.reply.facts)) {
        assert.ok(
          ['animal', 'color', 'petName'].includes(key),
          `сцена записала «${key}» — это не whitelist-факт`,
        );
        seenFacts.push(key);
      }
    }
    if (step.fact) {
      assert.ok(out.reply.facts && step.fact in out.reply.facts, `шаг «${step.fact}» должен запомнить факт`);
    }
  }
  assert.deepEqual(
    [...new Set(seenFacts)].sort(),
    ['animal', 'color', 'petName'],
    'за сцену запомнили ровно три факта из белого списка',
  );
  assert.equal(s.scene, 'idle', 'сцена закрывается и возвращает корневые чипы');
  const skipped = chatRespond({ chipId: 'fact:pet:skip' }, ctx(), sessionStart());
  remember(skipped.reply, 'pet-skip');
  assert.equal(skipped.reply.facts, undefined, '«Не скажу» — без фактов');
  assert.deepEqual(skipped.session.scene, 'idle');
}

// ── Whitelist-санитайзер для профиля и бэкапа ────────────────────────────────
{
  const dirty = normalizeBukFacts({
    animal: '  кот\u0000 и ёж  ',
    petName: 'ШарикШарикШарикШарикШарикШарик',
    color: '',
    evil: 'внешний ключ',
    toldAt: 'вчера',
  });
  assert.ok(dirty, 'санитайзер собрал факты');
  assert.equal(dirty!.animal, 'кот и ёж', 'мусор вычищен, пробелы сжаты');
  assert.ok((dirty!.petName ?? '').length <= 24, 'значение усечено до 24 знаков');
  assert.equal(dirty!.color, undefined, 'пустое значение выпало');
  assert.equal('evil' in dirty!, false, 'чужой ключ не проходит');
  assert.equal(dirty!.toldAt, undefined, 'нес число — выпало');
  assert.equal(normalizeBukFacts('строка'), undefined, 'строка — не факты');
  assert.equal(normalizeBukFacts([1, 2]), undefined, 'массив — не факты');
  assert.equal(normalizeBukFacts(undefined), undefined, 'нет данных — нет фактов');
}

// ── Память: отсылки через неделю, детерминизм дня, 10 шаблонов ≤ 70 ──────────
{
  const now = Date.now();
  const facts: BukFacts = { animal: 'кот', color: 'синий', petName: 'Мурзик', toldAt: now };
  assert.equal(memoryLine(facts, now), null, 'свежий факт не напоминают');
  assert.equal(memoryLine(undefined, now - 30 * DAY), null, 'без фактов отсылки нет');
  const late = memoryLine({ ...facts, toldAt: now - 8 * DAY }, now);
  assert.ok(late && late.includes('Мурзик'), 'через неделю БУК спрашивает про питомца');
  assert.equal(late, memoryLine({ ...facts, toldAt: now - 8 * DAY }, now), 'выбор по дню детерминирован');
  const onlyAnimal = memoryLine({ animal: 'попугай', toldAt: now - 9 * DAY }, now);
  assert.ok(onlyAnimal && onlyAnimal.includes('попугай'), 'отсылка по одному животному');
  const onlyColor = memoryLine({ color: 'зелёный', toldAt: now - 10 * DAY }, now);
  assert.ok(onlyColor && onlyColor.includes('зелёный'), 'отсылка по одному цвету');
}
{
  // Все шаблоны пулов — с самыми длинными допустимыми значениями.
  const max = 'ШарикШарикШарикШарик'; // 21 знак — в пределах whitelist
  const values: Record<string, string> = { name: max, kind: max, animal: max, color: max };
  let total = 0;
  for (const pool of MEMORY_POOLS) {
    for (const tpl of pool) {
      total += 1;
      const line = tpl.replace(/\{(name|kind|animal|color)\}/g, (_, k: string) => values[k]);
      assert.ok(line.length <= LINE_LIMIT, `шаблон «${tpl}» → ${line.length} знаков`);
    }
  }
  assert.ok(total >= 10 && total <= 20, `спека просит 10–20 шаблонов отсылок, есть ${total}`);
}

// ── Потолок подхода: после 5–7 реплик только предложение сделать дело ────────
{
  const c = ctx(profileWith(12));
  let s = sessionStart();
  let sawCap = false;
  for (let i = 0; i < 12; i += 1) {
    const out = chatRespond({ chipId: 'today' }, c, s);
    remember(out.reply, `cap:${i}`);
    s = out.session;
    assert.ok(s.lines <= MAX_BUK_LINES + 1, `счёт реплик ушёл за потолок: ${s.lines}`);
    if (sawCap) {
      assert.equal(out.reply.chips, undefined, 'за потолком чипов нет — только дело');
      assert.ok(out.reply.action, 'за потолком БУК зовёт в урок');
      assert.equal(out.reply.lines.length, 1, 'за потолком одна строка — без болтовни');
    }
    if (!out.reply.chips && out.reply.action) sawCap = true;
  }
  assert.ok(sawCap, 'подход обязан закрыться предложением сделать дело');
}

// ── Действия ведут в настоящие уроки ─────────────────────────────────────────
{
  const next = nextStartAction(profileWith(0));
  const { reply } = chatRespond({ chipId: 'play' }, ctx(), sessionStart());
  remember(reply, 'play');
  assert.equal(reply.chips, undefined, '«Поиграем?» сразу ведёт в дело');
  if (next.reviewDue) assert.equal(reply.action?.mode, 'review', 'повторение важнее нового урока');
  else assert.equal(reply.action?.lessonId, next.lessonId, 'действие = ближайший урок');
}

// ── Итог: ВСЕ реплики подходов укладываются в лимит ──────────────────────────
for (const line of collected) {
  assert.ok(line.length <= LINE_LIMIT, `реплика длиннее ${LINE_LIMIT} знаков (${line.length}): ${line}`);
}
assert.ok(collected.length > 50, 'прогон должен быть содержательным');

// ── Наград за чат нет: ни xp, ни кристаллов в репликах ───────────────────────
for (const line of collected) {
  const low = line.toLowerCase();
  assert.ok(!low.includes('кристалл'), `в реплике есть слово о награде: ${line}`);
  assert.ok(!/\d+\s*(xp|гемов|gems)/i.test(line), `в реплике есть счёт награды: ${line}`);
}

export {};
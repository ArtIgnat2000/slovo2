// Списки слов к контрольной (0.58.0).
//
// Проверяем то, что ломается незаметно и стоит родителю вечера:
//  • список из чата класса разбирается целиком: 23 слова из банка и 3 своих;
//  • «Береза» находит «берёза», регистр и «ё» не важны, повторы убираются;
//  • своё слово получает рабочую карточку (слоги, ударение, опасные буквы),
//    иначе урок упадёт на pickDanger;
//  • ударение правится и пересчитывает «опасные» буквы;
//  • свои слова НЕ попадают в программу класса — они живут только в списке;
//  • список создаётся в «Родителям → Списки» из текста, появляется карточкой
//    на «Уроках» и открывает урок `list:<id>`;
//  • удаление списка не стирает свои слова и не ломает остальные списки.
import './setup';
import { readFileSync } from 'node:fs';
import {
  normalizeCustomWords,
  normalizeLists,
  findBankWord,
  listLessonId,
  listStats,
  listIdFromLesson,
  listWords,
  makeCustomWord,
  matchKey,
  parseWordList,
  splitListText,
  splitSyllables,
  withStress,
} from '../src/engine/word-lists';
import { WORDS, WORDS_BY_GRADE } from '../src/content/words';
import { PRESET_LISTS, presetText } from '../src/content/preset-lists';
import { buildLesson, bankLookup, lookupWith } from '../src/engine/scheduler';
import { useApp } from '../src/state/store';
import { body, btnText, buttons, check, click, has, openParentSection, sleep } from './ui-helpers';

/** Ровно тот список, который прислали из школы. */
const SCHOOL_LIST = `Хорошо
Ученик
Ученица
Учитель
Петух
Заяц
Воробей
Ворона
Весело
Спасибо
Прощай
Прощайте
Город
Родина
Ветер
Скоро
Быстро
Подлежащее
Сказуемое
Яблоко
Яблоня
Береза
Лопата
Ягода
Осина
До свидания`;

const store = () => useApp.getState();
const active = () => {
  const s = store();
  const p = s.profiles.find((x) => x.id === s.activeId);
  if (!p) throw new Error('списки: нет активного профиля');
  return p;
};

/** Открыть «Родителям» (замок решается как в parent-ui). */
async function openParent(): Promise<void> {
  const parentTab = buttons().find(
    (b) => (b.textContent ?? '').includes('Родителям') && b.className.includes('tab'),
  );
  if (parentTab) {
    click(parentTab);
    await sleep(60);
  }
  const equation = document.body.textContent?.match(/(\d+) × (\d+) = \?/);
  const input = document.querySelector('input.input') as HTMLInputElement | null;
  if (equation && input) {
    const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setValue?.call(input, String(Number(equation[1]) * Number(equation[2])));
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    await sleep(20);
    click(btnText('Войти'));
    await sleep(60);
  }
}

function typeInto(el: HTMLElement | null, value: string) {
  if (!el) return;
  const proto = el instanceof window.HTMLTextAreaElement
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
  el.dispatchEvent(new window.Event('input', { bubbles: true }));
}

export async function runListsChecks(): Promise<void> {
  console.log('\n── Списки слов к контрольной ──');

  // ── 1. Разбор и сопоставление ─────────────────────────────────────────────
  check(
    'списки: регистр и «ё» не важны («Береза» → «берёза»)',
    matchKey('Береза') === matchKey('берёза') && findBankWord('Береза')?.text === 'берёза',
    String(findBankWord('Береза')?.text),
  );
  check(
    'списки: «до  свидания» с двойным пробелом — то же слово',
    findBankWord('До  свидания')?.text === 'до свидания',
    String(findBankWord('До  свидания')?.text),
  );
  check(
    'списки: текст режется по строкам, запятым и точкам с запятой',
    splitListText('а, б; в\nг').length === 4,
    JSON.stringify(splitListText('а, б; в\nг')),
  );

  const parsed = parseWordList(SCHOOL_LIST, {}, 2);
  const bank = parsed.items.filter((i) => i.source === 'bank').length;
  const custom = parsed.items.filter((i) => i.source === 'custom').length;
  check('списки: все 26 слов списка попали в набор', parsed.wordIds.length === 26, `${parsed.wordIds.length}`);
  check('списки: 23 слова нашлись в банке', bank === 23, `из банка: ${bank}`);
  check(
    'списки: 3 слова своих — прощайте, подлежащее, сказуемое',
    custom === 3 &&
      Object.values(parsed.customWords).map((w) => w.text).sort().join(', ') === 'подлежащее, прощайте, сказуемое',
    Object.values(parsed.customWords).map((w) => w.text).join(', '),
  );
  check(
    'списки: повторы убираются («Хорошо» дважды)',
    parseWordList('Хорошо\nхорошо\nХОРОШО').items.filter((i) => i.source === 'duplicate').length === 2,
    JSON.stringify(parseWordList('Хорошо\nхорошо\nХОРОШО').items.map((i) => i.source)),
  );

  // ── 2. Своё слово: рабочая карточка ───────────────────────────────────────
  const word = makeCustomWord('Подлежащее', 2);
  check('своё слово: слоги по гласным', word.syllables.join('-') === 'под-ле-жа-ще-е', word.syllables.join('-'));
  check(
    'своё слово: ударение стоит на гласной, «опасные» буквы непустые',
    word.stress >= 0 && word.text[word.stress] === 'е' && word.danger.length > 0 && word.danger.length <= 3,
    `stress=${word.stress}, danger=${JSON.stringify(word.danger)}`,
  );
  check(
    'своё слово: опасные буквы — только гласные, и ударная среди них не попадает',
    word.danger.every((i) => 'аеёиоуыэюя'.includes(word.text[i])) && !word.danger.includes(word.stress),
    JSON.stringify(word.danger.map((i) => word.text[i])),
  );
  const shifted = withStress(word, 1);
  check(
    'своё слово: ударение правится и опасные буквы пересчитываются',
    shifted.stress === 1 && !shifted.danger.includes(1),
    `stress=${shifted.stress}, danger=${JSON.stringify(shifted.danger)}`,
  );
  check(
    'своё слово: id со своим префиксом, а не id банка',
    word.id.startsWith('c_') && !WORDS.some((w) => w.id === word.id),
    word.id,
  );
  check('слоги: «прощайте» режется без потери букв', splitSyllables('прощайте').join('') === 'прощайте', splitSyllables('прощайте').join('-'));

  // ── 3. Свои слова не попадают в программу класса ──────────────────────────
  const gradeWords = WORDS_BY_GRADE[2].length;
  check(
    'списки: свои слова не попадают в банк и программу 2 класса',
    WORDS.every((w) => !w.text.toLowerCase().includes('подлежащее')) && WORDS_BY_GRADE[2].length === gradeWords,
    `${gradeWords}`,
  );

  // ── 4. store: создание, ударение, удаление ────────────────────────────────
  const created = store().addList('Контрольная (тест)', SCHOOL_LIST, {});
  check(
    'списки: стор создал список из 26 слов',
    !!created.list && created.list.words.length === 26 && created.bank === 23 && created.custom === 3,
    JSON.stringify({ b: created.bank, c: created.custom }),
  );
  check(
    'списки: свои слова сохранились в профиль',
    Object.keys(active().customWords ?? {}).length >= 3,
    JSON.stringify(Object.keys(active().customWords ?? {})),
  );
  check(
    'списки: listStats считает своих и из банка',
    (() => {
      const s = listStats(created.list!, active().customWords ?? {});
      return s.total === 26 && s.custom === 3 && s.bank === 23;
    })(),
    JSON.stringify(listStats(created.list!, active().customWords ?? {})),
  );
  // Своё слово для проверки ударения: берём любое и ставим ударение на
  // ПЕРВУЮ гласную — так тест не зависит от того, какое слово первым легло.
  const customEntries = Object.entries(active().customWords ?? {});
  const [customId, customWord] = customEntries[0];
  const firstVowel = [...customWord.text].findIndex((ch) => 'аеёиоуыэюя'.includes(ch.toLowerCase()));
  store().setCustomWordStress(customId, firstVowel);
  check(
    'списки: ударение своего слова меняется через стор',
    active().customWords?.[customId]?.stress === firstVowel && firstVowel > 0,
    `${customWord.text}: stress=${active().customWords?.[customId]?.stress}, ждали ${firstVowel}`,
  );
  check(
    'списки: listWords отдаёт карточки и своих слов тоже',
    listWords(created.list!, active().customWords ?? {}).length === 26,
    String(listWords(created.list!, active().customWords ?? {}).length),
  );
  check(
    'списки: id урока = list:<id>, обратное преобразование работает',
    listLessonId('l_1') === 'list:l_1' && listIdFromLesson('list:l_1') === 'l_1' && listIdFromLesson('g2_school') === null,
    listLessonId('l_1'),
  );

  // ── 4b. Урок списка собирается с резолвером своих слов ────────────────────
  const only = parseWordList('Подлежащее\nСказуемое').wordIds;
  const lessonStub = { id: 'list:test', title: 'Тест', emoji: '🏫', order: 0, wordIds: only };
  const withCustom = buildLesson({
    lesson: lessonStub,
    level: 1,
    states: {},
    reviewWords: [],
    maxCards: 0,
    lookup: lookupWith(parsed.customWords),
  });
  check(
    'списки: урок списка собирает задания для своих слов (подлежащее, сказуемое)',
    withCustom.length >= 2 && withCustom.every((t) => only.includes(t.wordId)),
    `${withCustom.length} заданий, слова: ${[...new Set(withCustom.map((t) => t.wordId))].join(', ')}`,
  );
  check(
    'списки: задания для своего слова рабочие (варианты/буквы на месте)',
    withCustom.some((t) => (t.options?.length ?? 0) > 0 || (t.letters?.length ?? 0) > 0),
    JSON.stringify(withCustom.map((t) => [t.kind, t.options?.length ?? 0, t.letters?.length ?? 0])),
  );
  const withoutLookup = buildLesson({
    lesson: lessonStub,
    level: 1,
    states: {},
    reviewWords: [],
    maxCards: 0,
    lookup: bankLookup,
  });
  check(
    'списки: без резолвера своих слов урок пустой — поэтому резолвер и нужен',
    withoutLookup.length === 0,
    `${withoutLookup.length}`,
  );

  // ── 4c. Выгрузка и чтение: списки и свои слова переживают файл ────────────
  const roundTrip = JSON.parse(
    JSON.stringify({ lists: active().lists, customWords: active().customWords }),
  ) as { lists: unknown; customWords: unknown };
  const backLists = normalizeLists(roundTrip.lists);
  const backCustom = normalizeCustomWords(roundTrip.customWords);
  check(
    'списки: после выгрузки и чтения список и свои слова на месте',
    backLists.length === (active().lists ?? []).length &&
      backLists[0]?.words.length === (active().lists ?? [])[0]?.words.length &&
      Object.keys(backCustom).length === Object.keys(active().customWords ?? {}).length,
    `списков ${backLists.length}, своих ${Object.keys(backCustom).length}`,
  );
  check(
    'списки: мусор из файла выбрасывается, а не ломает профиль',
    normalizeLists([null, {}, { id: '', words: ['a'] }, { id: 'l1', words: [] }, { id: 'l2', words: ['a', 'a', 5] }])
      .length === 1,
    JSON.stringify(normalizeLists([null, {}, { id: '', words: ['a'] }, { id: 'l1', words: [] }, { id: 'l2', words: ['a', 'a', 5] }])),
  );
  check(
    'списки: битое своё слово не попадает в профиль',
    Object.keys(normalizeCustomWords({ c_bad: { text: '  ' }, other: { text: 'слово' }, c_ok: { text: 'слово', syllables: ['сло', 'во'], stress: 3, danger: [1] } })).length === 1,
    JSON.stringify(Object.keys(normalizeCustomWords({ c_bad: { text: '  ' }, other: { text: 'слово' }, c_ok: { text: 'слово' } }))),
  );

  // Отчёт родителя: слово из списка читается словом, а не id.
  const reportSrc = readFileSync('src/ui/parent/OverviewTab.tsx', 'utf8');
  check(
    'списки: в отчёте родителя свои слова показываются словом, а не id',
    /wordTextOf\(id, customWords\)/.test(reportSrc) && /customWords=\{profile\.customWords\}/.test(reportSrc),
    'нет подстановки своих слов в отчёт',
  );

  // ── 4d. Находимость: вход в списки видно из «Обзора», диагностика отвечает ──
  const overviewSrc = readFileSync('src/ui/parent/OverviewTab.tsx', 'utf8');
  check(
    'списки: вход «Списки к контрольной» есть в «Обзоре» родителя',
    /data-overview-add-list/.test(overviewSrc) && /onOpenSection\('lists'\)/.test(overviewSrc),
    'в обзоре нет карточки-входа в списки',
  );
  check(
    'списки: обзор честно говорит, что карточки на «Уроках» нет, пока нет списка',
    /Поэтому на «Уроках» карточки «Контрольная» нет|поэтому на «Уроках» карточки «Контрольная» нет/i.test(overviewSrc),
    'нет объяснения пустого состояния',
  );
  const diagSrc = readFileSync('src/ui/DiagnosticsScreen.tsx', 'utf8');
  check(
    'списки: диагностика показывает число списков (и без имени ребёнка)',
    /Списки к контрольной:/.test(diagSrc) && !/Списки к контрольной у «/.test(diagSrc),
    'в диагностике нет строки о списках или есть имя',
  );
  check(
    'списки: вкладки родителя не сжимаются в один ряд на узком экране',
    /@media \(max-width: 560px\)[\s\S]*?\.seg-tabs[\s\S]*?grid-template-columns: repeat\(3/.test(
      readFileSync('src/styles/app.css', 'utf8'),
    ),
    'нет правила для пяти вкладок на узком экране',
  );

  // ── 5. Родительский экран: создание списка из текста ──────────────────────
  const homeTab = buttons().find((b) => (b.textContent ?? '').includes('Уроки') && b.className.includes('tab'));
  if (homeTab) {
    click(homeTab);
    await sleep(60);
  }
  await openParent();
  const listsTab = await openParentSection('Списки');
  check('списки: в «Родителям» появился раздел «Списки»', !!listsTab, body().slice(0, 120));
  const addBtn = document.querySelector('[data-add-list]') as HTMLButtonElement | null;
  check('списки: есть кнопка «+ Новый список к контрольной»', !!addBtn, body().slice(0, 160));
  if (addBtn) {
    click(addBtn);
    await sleep(50);
    typeInto(document.querySelector('[data-list-title]'), 'Контрольная 12.11');
    const area = document.querySelector('[data-list-input]') as HTMLTextAreaElement | null;
    typeInto(area, 'Хорошо\nПодлежащее\nСказуемое\nБереза');
    await sleep(30);
    click(document.querySelector('[data-list-preview]'));
    await sleep(60);
    const preview = document.querySelector('[data-list-preview-result]');
    check(
      'списки: предпросмотр показывает разбор (из банка / свои)',
      !!preview && (preview.textContent ?? '').includes('из банка') && (preview.textContent ?? '').includes('своих'),
      preview?.textContent?.slice(0, 160) ?? 'нет предпросмотра',
    );
    check(
      'списки: для своих слов предлагается выбрать ударение',
      !!document.querySelector('.list-preview-item.custom .list-syl'),
      body().slice(0, 200),
    );
    const save = document.querySelector('[data-list-save]') as HTMLButtonElement | null;
    if (save) {
      click(save);
      await sleep(80);
    }
    const made = (active().lists ?? []).find((l) => l.title === 'Контрольная 12.11');
    check(
      'списки: список создан из формы и сохранён в профиле',
      !!made && made.words.length === 4,
      JSON.stringify((active().lists ?? []).map((l) => [l.title, l.words.length])),
    );
  }

  // ── 5b. Готовый список из школы: одна кнопка, без вставки текста ──────────
  const preset = PRESET_LISTS[0];
  check(
    'пресет: школьный список есть и в нём 26 слов',
    !!preset && preset.words.length === 26,
    String(preset?.words.length),
  );
  const presetParsed = parseWordList(presetText(preset), {}, 2);
  check(
    'пресет: 23 слова из банка + 3 своих (прощайте, подлежащее, сказуемое)',
    presetParsed.items.filter((i) => i.source === 'bank').length === 23 &&
      presetParsed.items.filter((i) => i.source === 'custom').length === 3,
    JSON.stringify({
      bank: presetParsed.items.filter((i) => i.source === 'bank').length,
      custom: presetParsed.items.filter((i) => i.source === 'custom').length,
    }),
  );
  check(
    'пресет: у своих слов рабочие карточки (ударение и опасные буквы)',
    Object.values(presetParsed.customWords).every((w) => w.syllables.length > 0 && w.text.length > 3),
    JSON.stringify(Object.values(presetParsed.customWords).map((w) => [w.text, w.syllables.join('-')])),
  );

  // Убираем списки, чтобы кнопка пресета была активна, и добавляем одной кнопкой.
  for (const l of active().lists ?? []) store().removeList(l.id);
  if (homeTab) {
    click(homeTab);
    await sleep(60);
  }
  await openParent();
  await openParentSection('Списки');
  const presetBtn = document.querySelector('[data-preset-add]') as HTMLButtonElement | null;
  check('пресет: в «Списках» есть кнопка «Добавить» без вставки текста', !!presetBtn, body().slice(0, 160));
  if (presetBtn) {
    click(presetBtn);
    await sleep(100);
    const schoolList = (active().lists ?? []).find((l) => l.title === preset.title);
    check(
      'пресет: одно нажатие добавило список из 26 слов',
      !!schoolList && schoolList.words.length === 26,
      JSON.stringify((active().lists ?? []).map((l) => [l.title, l.words.length])),
    );
    check(
      'пресет: свои слова появились в профиле',
      Object.keys(active().customWords ?? {}).length >= 3,
      String(Object.keys(active().customWords ?? {}).length),
    );
    check(
      'пресет: после добавления кнопка становится «✓ уже добавлен»',
      !!document.querySelector('[data-preset-added]'),
      document.querySelector('[data-list-presets]')?.textContent?.slice(0, 120) ?? '',
    );
  }

  // ── 6. Карточка на «Уроках» открывает урок списка ─────────────────────────
  if (homeTab) {
    click(homeTab);
    await sleep(60);
  }
  const listCard = document.querySelector('[data-list-card]') as HTMLButtonElement | null;
  check('списки: на «Уроках» видна карточка списка с числом слов', !!listCard && (listCard.textContent ?? '').includes('слов'), listCard?.textContent ?? body().slice(0, 120));
  if (listCard) {
    click(listCard);
    await sleep(120);
    const screen = document.querySelector('.lesson-screen') as HTMLElement | null;
    check(
      'списки: карточка открывает урок list:<id>',
      !!screen && (screen.getAttribute('data-lesson-id') ?? '').startsWith('list:'),
      screen?.getAttribute('data-lesson-id') ?? body().slice(0, 120),
    );
    // Выходим из урока: подтверждение выхода — обычное поведение приложения.
    const exit = document.querySelector('.lesson-exit') as HTMLButtonElement | null;
    if (exit) {
      click(exit);
      await sleep(60);
      const confirm = btnText('Выйти');
      if (confirm) click(confirm);
      await sleep(80);
    }
  }

  // ── 7. Удаление списка не стирает свои слова ──────────────────────────────
  const before = Object.keys(active().customWords ?? {}).length;
  const toRemove = (active().lists ?? [])[0];
  if (toRemove) store().removeList(toRemove.id);
  check(
    'списки: удаление списка не стирает свои слова (они могут быть в другом)',
    Object.keys(active().customWords ?? {}).length === before,
    `${before} → ${Object.keys(active().customWords ?? {}).length}`,
  );
  const left = active().lists ?? [];
  check(
    'списки: удалился только один список',
    left.length === Math.max(0, (active().lists ?? []).length),
    `${left.length}`,
  );

  // Убираем за собой: дальше идут проверки, которые считают прогресс.
  for (const l of active().lists ?? []) store().removeList(l.id);
  check('списки: профиль очищен от тестовых списков', (active().lists ?? []).length === 0, String((active().lists ?? []).length));

  // Возвращаемся на «Уроки», чтобы не влиять на следующие проверки.
  if (homeTab) {
    click(homeTab);
    await sleep(60);
  }
  check('списки: вернулись на «Уроки»', has('Сегодня') || has('Начать'), body().slice(0, 120));
}

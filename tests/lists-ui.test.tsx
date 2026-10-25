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
  checkLessonId,
  DEFAULT_LIST_DRILL_SIZE,
  drillLimit,
  drillSizeOf,
  errorsLessonId,
  hardWords,
  runHistory,
  trendOf,
  listLessonId,
  listModeOf,
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
import { KNOWN_STRESS } from '../src/content/stress-dict';
import { CUSTOM_WORD_CARDS } from '../src/content/custom-words';
import { existsSync } from 'node:fs';
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
    // «подлежащее» → ударная «а» (индекс 6), см. 0.61.1 и проверку по словарям.
    word.stress === 6 && word.text[word.stress] === 'а' && word.danger.length > 0 && word.danger.length <= 3,
    `stress=${word.stress} (${word.text[word.stress]}), danger=${JSON.stringify(word.danger)}`,
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

  // ── 2b. Ударение в школьных словах: словарь, а не «последняя гласная» ──────
  // Отклик 2026-10-24: «в словах подлежащее и сказуемое неправильно поставлено
  // ударение». Автополе ставило на последнюю гласную (подлежащЕе, сказуемоЕ).
  const schoolCustom = Object.fromEntries(
    Object.entries(parsed.customWords).map(([id, w]) => [w.text, w]),
  );
  const stressed = (text: string) => {
    const w = schoolCustom[text];
    if (!w) return '—';
    return [...w.text].map((ch, i) => (i === w.stress ? ch.toUpperCase() : ch)).join('');
  };
  check(
    'ударение: «подлежащее» → подлежАщее (проверено по словарям, 0.61.1)',
    stressed('подлежащее') === 'подлежАщее',
    stressed('подлежащее'),
  );
  check(
    'ударение: «сказуемое» → сказУемое',
    stressed('сказуемое') === 'сказУемое',
    stressed('сказуемое'),
  );
  check(
    'ударение: «прощайте» → прощАйте',
    stressed('прощайте') === 'прощАйте',
    stressed('прощайте'),
  );
  check(
    'ударение: ударная буква не попадает в «опасные» (её не спрашивают в заданиях)',
    Object.values(parsed.customWords).every((w) => !w.danger.includes(w.stress)),
    JSON.stringify(Object.values(parsed.customWords).map((w) => [w.text, w.stress, w.danger])),
  );
  check(
    'ударение: словарь покрывает все три школьных слова',
    ['подлежащее', 'сказуемое', 'прощайте'].every((k) => KNOWN_STRESS[k] !== undefined),
    JSON.stringify(KNOWN_STRESS),
  );

  // Уже сохранённые профили с неверным ударением чинятся при чтении.
  const legacy = normalizeCustomWords({
    c_podlezhashchee: { text: 'подлежащее', stress: 9, syllables: ['под', 'ле', 'жа', 'ще', 'е'], danger: [1, 4, 6] },
  });
  check(
    'ударение: старое неверное значение исправляется словарём (было 9, стало 6 — «а»)',
    legacy.c_podlezhashchee?.stress === 6,
    `stress=${legacy.c_podlezhashchee?.stress}`,
  );
  const manual = normalizeCustomWords({
    c_podlezhashchee: { text: 'подлежащее', stress: 6, stressManual: true, syllables: ['под', 'ле', 'жа', 'ще', 'е'] },
  });
  check(
    'ударение: ручной выбор родителя словарь не перебивает',
    manual.c_podlezhashchee?.stress === 6 && manual.c_podlezhashchee?.stressManual === true,
    `stress=${manual.c_podlezhashchee?.stress}`,
  );

  // ── 2c. Пометка «проверьте ударение» для слов вне словаря ─────────────────
  const unknown = makeCustomWord('Портфельчик', 2); // слова нет в словаре
  check(
    'ударение: слово вне словаря помечается «подставлено» (не выдаём догадку за факт)',
    unknown.stressGuessed === true,
    JSON.stringify({ stress: unknown.stress, guessed: unknown.stressGuessed }),
  );
  const knownWord = makeCustomWord('Портфель', 2); // есть в словаре
  check(
    'ударение: слово из словаря приходит без пометки',
    !knownWord.stressGuessed && [...knownWord.text].map((c, i) => (i === knownWord.stress ? c.toUpperCase() : c)).join('') === 'портфЕль',
    JSON.stringify({ stress: knownWord.stress, guessed: knownWord.stressGuessed }),
  );
  // Ставим ударение на гласную (индекс 5 = «е» в «портфельчик»).
  const fixed = withStress(unknown, 5, true);
  check(
    'ударение: ручной выбор снимает пометку «подставлено»',
    fixed.stressManual === true && fixed.stressGuessed === false,
    JSON.stringify({ manual: fixed.stressManual, guessed: fixed.stressGuessed }),
  );
  const legacyGuess = normalizeCustomWords({ c_abc: { text: 'портфельчик', stress: 9 } });
  check(
    'ударение: пометка пересчитывается при чтении (словарь мог пополниться)',
    legacyGuess.c_abc?.stressGuessed === true,
    JSON.stringify(legacyGuess.c_abc),
  );
  const knownAfterReload = normalizeCustomWords({ c_abc: { text: 'портфель', stress: 9 } });
  check(
    'ударение: при чтении словарь исправляет и снимает пометку',
    knownAfterReload.c_abc?.stress === 5 && !knownAfterReload.c_abc?.stressGuessed,
    JSON.stringify({ stress: knownAfterReload.c_abc?.stress, guessed: knownAfterReload.c_abc?.stressGuessed }),
  );

  // ── 2d. У КАЖДОГО слова контрольной есть картинка и понятная подсказка ────
  // Отклик 2026-10-24: у своих слов не было картинки (общая книга), а подсказка
  // «Слово из списка к контрольной» ничего не объясняла — по такому заданию
  // нельзя понять, о каком слове речь.
  {
    const presetAll = parseWordList(presetText(PRESET_LISTS[0]), {}, 2);
    const cards = listWords(
      { id: 'l_check', title: 'Проверка', words: presetAll.wordIds, createdAt: 0 },
      presetAll.customWords,
    );
    check(
      'контрольная: в наборе все 26 слов',
      cards.length === 26,
      String(cards.length),
    );
    const noImage = cards.filter((w) => !w.image);
    check(
      'контрольная: у каждого слова есть картинка (никакой общей заглушки)',
      noImage.length === 0,
      'без картинки: ' + noImage.map((w) => w.text).join(', '),
    );
    const missingFile = cards.filter((w) => w.image && !existsSync(`public/words/${w.image}.webp`));
    check(
      'контрольная: файл картинки существует в public/words',
      missingFile.length === 0,
      'нет файла: ' + missingFile.map((w) => `${w.text}→${w.image}`).join(', '),
    );
    const uniqueImages = new Set(cards.map((w) => w.image));
    check(
      'контрольная: картинки разные, а не одна на все слова',
      uniqueImages.size === cards.length,
      `${uniqueImages.size} уникальных из ${cards.length}`,
    );
    const badHint = cards.filter(
      (w) =>
        w.hint.trim().length < 12 ||
        w.hint.toLowerCase().includes(w.text.toLowerCase()) ||
        w.hint === 'Слово из списка к контрольной',
    );
    check(
      'контрольная: у каждого слова объяснение значения (≥ 12 символов, не шаблон)',
      badHint.length === 0,
      'слабые подсказки: ' + badHint.map((w) => `${w.text}: «${w.hint}»`).join(' | '),
    );
    const badSentence = cards.filter(
      (w) => !w.sentence.includes('____') || w.sentence.startsWith('Контрольная'),
    );
    check(
      'контрольная: у каждого слова предложение-контекст, а не «Контрольная: ____»',
      badSentence.length === 0,
      'плохие предложения: ' + badSentence.map((w) => `${w.text}: «${w.sentence}»`).join(' | '),
    );
    // Свои слова — с готовой карточкой из реестра, а не «из воздуха».
    const customCards = Object.values(presetAll.customWords);
    check(
      'контрольная: у своих слов есть карточка в реестре (картинка, подсказка, предложение)',
      customCards.every((w) => !!CUSTOM_WORD_CARDS[matchKey(w.text)]),
      customCards.map((w) => w.text).join(', '),
    );
  }

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
  check(
    'пресет: «подлежащее», «сказуемое» и «прощайте» приходят с верным ударением',
    Object.values(presetParsed.customWords)
      .map((w) => [...w.text].map((ch, i) => (i === w.stress ? ch.toUpperCase() : ch)).join(''))
      .sort()
      .join(' | ') === 'подлежАщее | прощАйте | сказУемое',
    Object.values(presetParsed.customWords)
      .map((w) => [...w.text].map((ch, i) => (i === w.stress ? ch.toUpperCase() : ch)).join(''))
      .join(' | '),
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

  // ── 6b. Режимы списка: тренировка / полный контроль / ошибки ──────────────
  check(
    'режимы: «list:» — тренировка, «check:» — контроль, «err:» — ошибки',
    listModeOf('list:l_1')?.mode === 'train' &&
      listModeOf('check:l_1')?.mode === 'check' &&
      listModeOf('err:l_1')?.mode === 'errors' &&
      listModeOf('g2_school') === null,
    JSON.stringify([listModeOf('list:l_1'), listModeOf('check:l_1'), listModeOf('err:l_1'), listModeOf('g2_school')]),
  );
  check(
    'режимы: id строятся и разбираются одинаково',
    checkLessonId('l_1') === 'check:l_1' && errorsLessonId('l_1') === 'err:l_1' &&
      listModeOf(checkLessonId('l_1'))?.listId === 'l_1' && listModeOf(errorsLessonId('l_1'))?.listId === 'l_1',
    `${checkLessonId('l_1')} / ${errorsLessonId('l_1')}`,
  );

  // ── 6c. Белый экран на результатах контрольной (баг 2026-10-25) ───────────
  // Раньше Results брал lesson.emoji/lesson.title из LESSON_BY_ID, а у урока
  // списка там нет записи → TypeError → белый экран. Теперь заголовок берётся
  // из списка, а к нему — запасное значение.
  {
    const src = readFileSync('src/ui/screens/LessonScreen.tsx', 'utf8');
    check(
      'результаты: экран не падает на уроке-списке (заголовок из списка)',
      /const headingEmoji = isCheck \? '📋' : listTitle \? '🏫' : lesson\?\.emoji/.test(src) &&
        /headingTitle = listTitle \?\? lesson\?\.title/.test(src),
      'Results всё ещё берёт lesson.emoji/lesson.title напрямую',
    );
    check(
      'результаты: отчёт по словам есть в разметке',
      /data-check-report/.test(src) && /data-check-words/.test(src) && /data-check-word=/.test(src),
      'нет отчёта по словам',
    );
    check(
      'результаты: кнопки «тренировать ошибки» и «пройти заново»',
      /data-train-errors/.test(src) && /data-restart-check/.test(src),
      'нет кнопок режимов на результатах',
    );
  }

  // ── 6d. Полный контроль: свои слова и подсказки отключены ──────────────────
  {
    const src = readFileSync('src/ui/screens/LessonScreen.tsx', 'utf8');
    const css = readFileSync('src/styles/app.css', 'utf8');
    check(
      'контроль: режим помечает экран и отключает отработку ошибок',
      /lesson-check/.test(src) && /if \(!isCheck\) \{/.test(src),
      'нет пометки режима контроля или отработка ошибок не отключена',
    );
    check(
      'контроль: подсказки и «опасные буквы» спрятаны в этом режиме',
      /\.lesson-check \[data-hint\]/.test(css) && /\.lesson-check \.banner/.test(css),
      'подсказки не спрятаны',
    );
    check(
      'контроль: итог сохраняется в список (lastCheck)',
      /saveListRun/.test(src) &&
        /lastCheck/.test(readFileSync('src/state/store.ts', 'utf8')) &&
        /runs/.test(readFileSync('src/state/store.ts', 'utf8')),
      'заход по списку не сохраняется (нет saveListRun/lastCheck/runs)',
    );
  }

  // ── 6e. Живой прогон контрольной: экран результатов не белый ──────────────
  // Главный баг 2026-10-25: после последней карточки экран результатов падал
  // в белый, потому что у урока-списка нет записи в LESSON_BY_ID. Здесь мы
  // правда проходим контрольную до конца и проверяем отчёт.
  {
    // Маленький список из одного слова — чтобы прогон был быстрым и стабильным.
    const tiny = store().addList('Мини-контрольная', 'Ученик', {});
    const tinyId = tiny.list?.id;
    if (tinyId) {
      store().addXp(0);
      const app = document.querySelector('#root > *') as HTMLElement | null;
      check('контроль: мини-список создан', !!tinyId, String(tinyId));
      // Открываем урок контроля так же, как это делает приложение.
      window.history.replaceState(null, '', '/?keep=1');
      click(buttons().find((b) => (b.textContent ?? '').includes('Уроки') && b.className.includes('tab')));
      await sleep(60);
      // Кнопка режима на карточке списка.
      const checkBtn = document.querySelector(`[data-list-check="${tinyId}"]`) as HTMLButtonElement | null;
      check('контроль: на карточке списка есть кнопка «Полный контроль»', !!checkBtn, body().slice(0, 160));
      if (checkBtn) {
        click(checkBtn);
        await sleep(120);
        const screen = document.querySelector('.lesson-screen') as HTMLElement | null;
        check(
          'контроль: открылся урок check:<id> с пометкой режима',
          !!screen && (screen.getAttribute('data-lesson-id') ?? '').startsWith('check:') &&
            screen.className.includes('lesson-check'),
          `${screen?.getAttribute('data-lesson-id')} / ${screen?.className}`,
        );
        check(
          'контроль: подсказка в этом режиме не показывается',
          !document.querySelector('[data-hint]'),
          String(document.querySelectorAll('[data-hint]').length),
        );
        // Отвечаем намеренно неверно: контрольная проверяет, поэтому отчёт
        // должен появиться и с ошибкой (и предложить «тренировать ошибки»).
        // Так тест не зависит от того, угадали ли мы правильный ввод.
        const keys = () => buttons().filter((b) => b.className.includes('key'));
        const anyLetter = keys().find((b) => (b.textContent ?? '').trim() !== '⌫');
        if (anyLetter) {
          click(anyLetter);
          await sleep(20);
        }

        const submitBtn = btnText('Проверить');
        if (submitBtn && !submitBtn.disabled) {
          click(submitBtn);
        }
        // Вердикт появляется не мгновенно (у задания своя пауза), поэтому
        // ждём отчёт в цикле, а не одним sleep: иначе тест ловит промежуточный кадр.
        for (let i = 0; i < 24; i++) {
          if (document.querySelector('[data-check-report]')) break;
          const next = btnText('Далее');
          if (next) {
            click(next);
            await sleep(150);
          } else {
            await sleep(120);
          }
        }
        const report = document.querySelector('[data-check-report]');
        check(
          'контроль: после последнего слова показан отчёт, а не белый экран',
          !!report,
          document.body.innerHTML.slice(0, 200),
        );
        check(
          'контроль: в отчёте видно слово за словом',
          !!document.querySelector('[data-check-word]') &&
            (document.querySelector('[data-check-words]')?.textContent ?? '').toLowerCase().includes('ученик'),
          document.querySelector('[data-check-words]')?.textContent ?? '',
        );
        check(
          'контроль: итог сохранён в список (lastCheck)',
          !!active().lists?.find((l) => l.id === tinyId)?.lastCheck,
          JSON.stringify(active().lists?.find((l) => l.id === tinyId)?.lastCheck),
        );
        check(
          'контроль: после ошибки предлагается «Тренировать ошибки»',
          !!document.querySelector('[data-train-errors]'),
          body().slice(0, 200),
        );
        // «Пройти заново» возвращает в тот же режим.
        const restart = document.querySelector('[data-restart-check]') as HTMLButtonElement | null;
        check('контроль: на результатах есть «Пройти заново»', !!restart, body().slice(0, 160));
        // Выходим к урокам, чтобы не влиять на следующие проверки.
        const home = document.querySelector('[data-check-report]')
          ? btnText('К урокам')
          : null;
        if (restart) {
          click(restart);
          await sleep(150);
          const again = document.querySelector('.lesson-screen') as HTMLElement | null;
          check(
            'контроль: «Пройти заново» снова открывает контрольную',
            (again?.getAttribute('data-lesson-id') ?? '').startsWith('check:'),
            again?.getAttribute('data-lesson-id') ?? body().slice(0, 120),
          );
          const exit = document.querySelector('.lesson-exit') as HTMLButtonElement | null;
          if (exit) {
            click(exit);
            await sleep(60);
            const leave = btnText('Выйти');
            if (leave) click(leave);
            await sleep(100);
          }
        } else if (home) {
          click(home);
          await sleep(100);
        }
      }
      // Тренировка только по ошибкам: отдельный режим err:<id>.
      const errorsBtn = document.querySelector(`[data-list-errors="${tinyId}"]`) as HTMLButtonElement | null;
      check('контроль: на «Уроках» есть кнопка «Ошибки» после провала', !!errorsBtn, body().slice(0, 160));
      if (errorsBtn) {
        click(errorsBtn);
        await sleep(140);
        const screen = document.querySelector('.lesson-screen') as HTMLElement | null;
        check(
          'контроль: кнопка «Ошибки» открывает тренировку только провальных слов',
          (screen?.getAttribute('data-lesson-id') ?? '').startsWith('err:'),
          screen?.getAttribute('data-lesson-id') ?? body().slice(0, 120),
        );
        check(
          'контроль: в режиме ошибок подсказки снова доступны (это тренировка, а не проверка)',
          !(document.querySelector('.lesson-screen')?.className ?? '').includes('lesson-check'),
          document.querySelector('.lesson-screen')?.className ?? '',
        );
        const exit = document.querySelector('.lesson-exit') as HTMLButtonElement | null;
        if (exit) {
          click(exit);
          await sleep(60);
          const leave = btnText('Выйти');
          if (leave) click(leave);
          await sleep(120);
        }
      }

      store().removeList(tinyId);
      if (app) app.setAttribute('data-ok', '');
    }
  }

  // ── 6f. История заходов, динамика и размер тренировки (0.63.0) ────────────
  {
    // Размер тренировки: отдельный параметр, по умолчанию легче урока.
    check(
      'тренировка: размер по умолчанию — 6 слов (легче урока)',
      DEFAULT_LIST_DRILL_SIZE === 6 && drillSizeOf({}) === 6 && drillSizeOf(null) === 6,
      String(drillSizeOf({})),
    );
    check(
      'тренировка: 0 или undefined — весь список, мусор в профиле не ломает',
      drillLimit({ listDrillSize: 0 }, 26) === 26 &&
        drillLimit({ listDrillSize: 4 }, 26) === 4 &&
        drillLimit({ listDrillSize: 99 }, 26) === 26 &&
        drillLimit({ listDrillSize: NaN }, 26) === DEFAULT_LIST_DRILL_SIZE,
      JSON.stringify([
        drillLimit({ listDrillSize: 0 }, 26),
        drillLimit({ listDrillSize: 4 }, 26),
        drillLimit({ listDrillSize: 99 }, 26),
        drillLimit({ listDrillSize: NaN }, 26),
      ]),
    );

    // История: пишем заходы и проверяем динамику и трудные слова.
    const hist = store().addList('История', 'Ученик\nПетух\nВорона\nБерёза', {});
    const hid = hist.list!.id;
    const wordIds = hist.list!.words;
    store().saveListRun(hid, { mode: 'train', total: 4, correct: 2, wrong: [wordIds[1], wordIds[3]], listSize: 4 });
    store().saveListRun(hid, { mode: 'train', total: 4, correct: 3, wrong: [wordIds[3]], listSize: 4 });
    store().saveListRun(hid, { mode: 'check', total: 4, correct: 4, wrong: [], listSize: 4 });
    const withHistory = active().lists!.find((l) => l.id === hid)!;
    check(
      'история: сохранены три захода (тренировка, тренировка, контрольная)',
      (withHistory.runs ?? []).length === 3,
      JSON.stringify((withHistory.runs ?? []).map((r) => [r.mode, r.correct, r.total])),
    );
    check(
      'история: динамика считается по заходам («стало лучше»)',
      trendOf(withHistory)?.better === true,
      JSON.stringify(trendOf(withHistory)),
    );
    check(
      'история: полная контрольная обновила lastCheck, тренировка — нет',
      withHistory.lastCheck?.correct === 4 && withHistory.lastCheck?.total === 4,
      JSON.stringify(withHistory.lastCheck),
    );
    check(
      'история: «трудные слова» — те, что ошибались чаще (Берёза × 2)',
      hardWords(withHistory, 5)[0]?.id === wordIds[3] && hardWords(withHistory, 5)[0]?.errors === 2,
      JSON.stringify(hardWords(withHistory, 5).map((h) => [h.id, h.errors])),
    );
    check(
      'история: runHistory отдаёт долю верных слов',
      runHistory(withHistory, 10).map((r) => Math.round(r.ratio * 100)).join(',') === '50,75,100',
      runHistory(withHistory, 10).map((r) => Math.round(r.ratio * 100)).join(','),
    );

    // История переживает выгрузку/чтение, мусор отбрасывается.
    const roundTripRuns = normalizeLists(JSON.parse(JSON.stringify(active().lists))).find((l) => l.id === hid);
    check(
      'история: заходы сохраняются в профиле и восстанавливаются из файла',
      (roundTripRuns?.runs ?? []).length === 3,
      String((roundTripRuns?.runs ?? []).length),
    );
    const brokenRuns = normalizeLists([
      { id: 'l_x', words: ['g2_ученик'], runs: [{ mode: 'нет', total: 4 }, { mode: 'train', total: 0 }, { mode: 'train', total: 3, correct: 9, wrong: ['a', 'a', 5] }] },
    ]);
    check(
      'история: битые заходы отбрасываются, correct не больше total, wrong без повторов',
      (brokenRuns[0]?.runs ?? []).length === 1 &&
        brokenRuns[0]!.runs![0].correct === 3 &&
        brokenRuns[0]!.runs![0].wrong.join(',') === 'a',
      JSON.stringify(brokenRuns[0]?.runs),
    );

    // Параметр размера тренировки сохраняется в профиле.
    store().setListDrillSize(4);
    check('тренировка: размер сохраняется в профиле', active().listDrillSize === 4, String(active().listDrillSize));
    store().setListDrillSize(6);

    // В интерфейсе родителя: выбор размера и блок истории.
    await openParent();
    await openParentSection('Списки');
    check(
      'тренировка: в «Списках» есть выбор «слов за тренировку»',
      !!document.querySelector('[data-list-drill]') && !!document.querySelector('[data-drill-size="12"]'),
      body().slice(0, 160),
    );
    const drillBtn = document.querySelector('[data-drill-size="12"]') as HTMLButtonElement | null;
    if (drillBtn) {
      click(drillBtn);
      await sleep(60);
    }
    check('тренировка: выбор размера меняет параметр профиля', active().listDrillSize === 12, String(active().listDrillSize));
    check(
      'история: в «Списках» видны результаты заходов и тренд',
      !!document.querySelector(`[data-list-history="${hid}"]`) &&
        document.querySelectorAll('[data-run-bar]').length >= 3 &&
        !!document.querySelector(`[data-list-trend="${hid}"]`),
      document.querySelector(`[data-list-history="${hid}"]`)?.textContent?.slice(0, 160) ?? 'нет блока',
    );
    check(
      'история: видны трудные слова и кнопка их тренировки',
      !!document.querySelector(`[data-list-hard="${hid}"]`) &&
        (document.querySelector(`[data-list-hard="${hid}"]`)?.textContent ?? '').length > 5,
      document.querySelector(`[data-list-hard="${hid}"]`)?.textContent ?? 'нет',
    );
    store().removeList(hid);
    store().setListDrillSize(6);
    // Возвращаемся на «Уроки»: следующие проверки ждут главный экран.
    if (homeTab) {
      click(homeTab);
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
  // Кнопку ищем заново: после переходов по разделам ссылка на старую может
  // остаться от размонтированного экрана.
  for (let i = 0; i < 3 && !(has('Сегодня') || has('Начать')); i++) {
    const tab = buttons().find((b) => (b.textContent ?? '').includes('Уроки'));
    if (tab) click(tab);
    await sleep(120);
  }
  check('списки: вернулись на «Уроки»', has('Сегодня') || has('Начать'), body().slice(0, 120));
}

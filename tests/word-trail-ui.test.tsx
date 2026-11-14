/**
 * «Тропа слов» (0.110.0) через настоящий UI.
 *
 * Проверяем не движок, а дорогу глазами ребёнка: баннер над витриной,
 * продолжение с сохранённого слова, починку буквы, шаг по плитам, открытку
 * остановки, мост из слогов и возврат к витрине без потери прогресса.
 */
import { useApp } from '../src/state/store';
import { trailStops } from '../src/engine/word-trail';
import { WORD_BY_ID } from '../src/content/words';
import { btnText, buttons, check, click, sleep } from './ui-helpers';

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector(sel) as T | null;
const $$ = (sel: string) => Array.from(document.querySelectorAll(sel)) as HTMLElement[];

async function goGamesTab(): Promise<void> {
  const tab = buttons().find(
    (b) => (b.textContent ?? '').includes('Игры') && b.className.includes('tab'),
  );
  if (tab) {
    click(tab);
    await sleep(70);
  }
}

/** Нажать верную букву и пройти по всем плитам слова. */
async function playLetters(): Promise<boolean> {
  const answer = $('[data-trail-answer]')?.getAttribute('data-trail-answer');
  if (!answer) return false;
  const option = $$('.tl-option').find(
    (b) => (b as HTMLElement).dataset.tlLetter === answer,
  ) as HTMLButtonElement | undefined;
  if (!option) return false;
  click(option);
  await sleep(50);

  const count = $$('.trail-seg').length;
  if (!count) return false;
  for (let i = 0; i < count; i++) {
    const segment = document.querySelector(
      `button.trail-seg[data-trail-seg="${i}"]`,
    ) as HTMLButtonElement | null;
    if (!segment) return false;
    click(segment);
    await sleep(18);
  }
  await sleep(90);
  return true;
}

export async function runWordTrailUiChecks(): Promise<void> {
  console.log('\n── Тропа слов: экран и прохождение ──');

  useApp.getState().createProfile('Тест тропы', '🗺️', 2);
  await sleep(70);
  const profileId = useApp.getState().activeId;
  check('тропа: профиль создан', !!profileId, String(profileId));

  const stops = trailStops(2);
  check('тропа: две остановки 2 класса', stops.length === 2, stops.map((s) => s.title).join(', '));
  const school = stops[0];
  const birds = stops[1];

  // Продолжаем с третьего слова: два уже пройдены. Так проверяется и resume,
  // и экран «слово пройдено», и открытка, не проходя всю остановку заново.
  useApp.getState().setTrail({ v: 1, stop: 0, words: school.wordIds.slice(0, 2), cards: [] });
  await sleep(60);

  await goGamesTab();
  const banner = $('[data-trail-banner]') as HTMLButtonElement | null;
  check(
    'тропа: баннер «Тропа слов» стоит над витриной',
    !!banner && (banner.textContent ?? '').includes('Тропа слов'),
    banner?.textContent ?? 'баннера нет',
  );
  check(
    'тропа: баннер не стал девятой карточкой',
    !!banner && !banner.closest('.games-cards') && $$('[data-game-card="trail"]').length === 0,
    `карточек в группе: ${$$('.games-card').length}`,
  );
  check(
    'тропа: баннер знает про текущую остановку',
    (banner?.textContent ?? '').includes('Школа') && (banner?.textContent ?? '').includes('0 из 2'),
    banner?.textContent ?? '',
  );

  if (banner) click(banner);
  await sleep(90);
  check('тропа: экран открылся', !!$('.trail-screen'), document.body.textContent?.slice(0, 160) ?? '');
  check('тропа: сцена и дорога на месте', !!$('.trail-scene') && $$('.trail-seg').length >= 5,
    `плит: ${$$('.trail-seg').length}`);
  check(
    'тропа: продолжила с третьего слова остановки',
    $('.trail-screen')?.getAttribute('data-trail-word') === WORD_BY_ID[school.wordIds[2]].text,
    `${$('.trail-screen')?.getAttribute('data-trail-word')} ≠ ${WORD_BY_ID[school.wordIds[2]].text}`,
  );
  check(
    'тропа: закрытая плита показана вопросом',
    $$('.trail-seg-hidden').length === 1 && ($('.trail-seg-hidden')?.textContent ?? '').includes('?'),
    $('.trail-seg-hidden')?.textContent ?? 'нет',
  );

  const firstPlayed = await playLetters();
  check('тропа: первое слово сыграно', firstPlayed, '');
  check(
    'тропа: появился экран «слово пройдено»',
    !!$('.trail-done') && ($('.trail-done')?.textContent ?? '').includes('Слово на дороге!'),
    $('.trail-done')?.textContent ?? 'нет',
  );
  const savedAfterFirst = useApp.getState().profiles.find((p) => p.id === profileId)?.trail;
  check(
    'тропа: слово сохранено в профиль сразу',
    savedAfterFirst?.words.includes(school.wordIds[2]) ?? false,
    JSON.stringify(savedAfterFirst),
  );
  const gemsAfterFirst = useApp.getState().profiles.find((p) => p.id === profileId)?.gems ?? -1;
  check('тропа: кристаллов за слово не даёт', gemsAfterFirst === 0, `💎: ${gemsAfterFirst}`);

  const more = btnText('Дальше');
  check('тропа: есть кнопка «Дальше»', !!more, '');
  if (more) click(more);
  await sleep(80);
  check(
    'тропа: следующее слово остановки',
    $('.trail-screen')?.getAttribute('data-trail-word') === WORD_BY_ID[school.wordIds[3]].text,
    $('.trail-screen')?.getAttribute('data-trail-word') ?? 'нет',
  );

  const lastPlayed = await playLetters();
  check('тропа: последнее слово остановки сыграно', lastPlayed, '');
  const postcard = $('[data-trail-postcard]');
  check(
    'тропа: открытка остановки «Школа»',
    !!postcard && (postcard.textContent ?? '').includes('Школа') && (postcard.textContent ?? '').includes('пройдена'),
    postcard?.textContent ?? 'нет',
  );
  const closed = useApp.getState().profiles.find((p) => p.id === profileId)?.trail;
  check(
    'тропа: остановка закрыта и открытка сохранена',
    !!closed && closed.words.length === 4 && closed.cards.includes(school.id),
    JSON.stringify(closed),
  );

  const nextStop = btnText('Следующая остановка');
  check('тропа: есть кнопка следующей остановки', !!nextStop, '');
  if (nextStop) click(nextStop);
  await sleep(100);
  check(
    'тропа: вторая остановка — «Птицы»',
    ($('.trail-sub')?.textContent ?? '').includes('Птицы'),
    $('.trail-sub')?.textContent ?? 'нет',
  );
  const moved = useApp.getState().profiles.find((p) => p.id === profileId)?.trail;
  check('тропа: переход сохранён в профиль', moved?.stop === 1, JSON.stringify(moved));

  // Первое слово «Птиц» — буквенное, второе — слоговое: проверяем обе механики.
  const birdPlayed = await playLetters();
  check('тропа: первое слово «Птиц» сыграно', birdPlayed, '');
  const birdNext = btnText('Дальше');
  if (birdNext) click(birdNext);
  await sleep(90);
  const tray = $('[data-trail-slots]');
  check(
    'тропа: второе слово — мост из слогов',
    !!tray && (tray.getAttribute('data-trail-slots') ?? '').includes('|'),
    tray?.getAttribute('data-trail-slots') ?? 'нет',
  );
  const order = (tray?.getAttribute('data-trail-slots') ?? '').split('|').filter(Boolean);
  const expectedSyllables = WORD_BY_ID[birds.wordIds[1]].syllables.filter((s) => s.trim().length > 0);
  check(
    'тропа: слоги на мосту совпадают со словом',
    order.join('|') === expectedSyllables.join('|'),
    `${order.join('|')} ≠ ${expectedSyllables.join('|')}`,
  );
  check('тропа: на мосту есть пустые плиты', $$('.trail-seg-empty').length === order.length,
    `пустых: ${$$('.trail-seg-empty').length}`);

  for (const text of order) {
    const tile = $$('.trail-syllable').find(
      (b) => (b as HTMLElement).dataset.trailTile === text && !(b as HTMLButtonElement).disabled,
    ) as HTMLButtonElement | undefined;
    check(`тропа: слог «${text}» есть в лотке`, !!tile, '');
    if (tile) click(tile);
    await sleep(45);
  }
  await sleep(750);
  check(
    'тропа: слоговое слово пройдено',
    !!$('.trail-done') && ($('.trail-done')?.textContent ?? '').includes(WORD_BY_ID[birds.wordIds[1]].text),
    $('.trail-done')?.textContent ?? 'нет',
  );

  const afterBird = btnText('Дальше');
  if (afterBird) click(afterBird);
  await sleep(90);
  check(
    'тропа: дальше — следующее слово остановки',
    $('.trail-screen')?.getAttribute('data-trail-word') === WORD_BY_ID[birds.wordIds[2]].text,
    $('.trail-screen')?.getAttribute('data-trail-word') ?? 'нет',
  );

  // Уходим и возвращаемся: тропа должна продолжиться с того же слова.
  const back = buttons().find(
    (b) => b.getAttribute('aria-label') === 'Вернуться к играм',
  );
  check('тропа: кнопка возврата на месте', !!back, '');
  if (back) click(back);
  await sleep(90);
  check('тропа: вернулись к витрине', !!$('.games-cards'), '');
  const backBanner = $('[data-trail-banner]');
  check(
    'тропа: баннер показывает 1 из 2 остановок',
    (backBanner?.textContent ?? '').includes('1 из 2'),
    backBanner?.textContent ?? 'нет',
  );

  if (backBanner) click(backBanner);
  await sleep(90);
  check(
    'тропа: после возврата — то же слово',
    $('.trail-screen')?.getAttribute('data-trail-word') === WORD_BY_ID[birds.wordIds[2]].text,
    $('.trail-screen')?.getAttribute('data-trail-word') ?? 'нет',
  );
  check(
    'тропа: после возврата — та же остановка',
    ($('.trail-sub')?.textContent ?? '').includes('Птицы'),
    $('.trail-sub')?.textContent ?? 'нет',
  );
}

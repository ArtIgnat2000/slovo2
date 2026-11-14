/**
 * «Тропа слов» (0.111.0) через настоящий UI.
 *
 * Проверяем дорогу глазами ребёнка: баннер над витриной, продолжение с
 * сохранённого слова, цикл «пройти → найти → слоги», починку буквы,
 * открытку остановки, альбом-карту 16 остановок, возврат к витрине без
 * потери прогресса и честное отсутствие тропы у 5 класса.
 */
import { useApp } from '../src/state/store';
import { trailStopsFor } from '../src/engine/word-trail';
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

/** Пройти все плиты открытого слова. */
async function walkAll(): Promise<boolean> {
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
  await sleep(120);
  return true;
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
  return walkAll();
}

/** Слово, которое просто проходим: без ремонта, сразу по плитам. */
async function playWalk(): Promise<boolean> {
  if ($('[data-trail-answer]')) return false;
  return walkAll();
}

/** Найти картинку: сначала ошибка (она не отнимает), потом верная. */
async function playFind(): Promise<boolean> {
  const target = $('[data-trail-find-target]')?.getAttribute('data-trail-find-target');
  if (!target) return false;
  const cards = $$('[data-trail-find]');
  const wrong = cards.find((card) => card.dataset.trailFind !== target);
  if (!wrong) return false;
  click(wrong);
  await sleep(40);
  if (!wrong.classList.contains('rejected')) return false;
  const right = document.querySelector(
    `[data-trail-find="${target}"]`,
  ) as HTMLButtonElement | null;
  if (!right) return false;
  click(right);
  await sleep(50);
  return walkAll();
}

/** Выложить мост из слогов по порядку из `data-trail-slots`. */
async function playSyllables(): Promise<boolean> {
  const tray = $('[data-trail-slots]');
  const order = (tray?.getAttribute('data-trail-slots') ?? '').split('|').filter(Boolean);
  if (!order.length) return false;
  for (const text of order) {
    const tile = $$('.trail-syllable').find(
      (b) => (b as HTMLElement).dataset.trailTile === text && !(b as HTMLButtonElement).disabled,
    ) as HTMLButtonElement | undefined;
    if (!tile) return false;
    click(tile);
    await sleep(45);
  }
  await sleep(750);
  return true;
}

export async function runWordTrailUiChecks(): Promise<void> {
  console.log('\n── Тропа слов: экран и прохождение ──');

  useApp.getState().createProfile('Тест тропы', '🗺️', 2);
  await sleep(70);
  const profileId = useApp.getState().activeId;
  check('тропа: профиль создан', !!profileId, String(profileId));

  const stops = trailStopsFor(2);
  check('тропа: 16 остановок 2 класса', stops.length === 16, String(stops.length));
  const school = stops[0];
  const nextStop = stops[1];

  // Продолжаем со второго слова: «алфавит» уже пройден. Так проверяются и
  // resume, и все действия цикла, не проходя слово-ремонт заново.
  useApp.getState().setTrail({
    v: 2,
    grade: 2,
    stop: 0,
    words: school.wordIds.slice(0, 1),
    cards: [],
  });
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
    (banner?.textContent ?? '').includes('Школа') && (banner?.textContent ?? '').includes('0 из 16'),
    banner?.textContent ?? '',
  );

  if (banner) click(banner);
  await sleep(90);
  check('тропа: экран открылся', !!$('.trail-screen'), document.body.textContent?.slice(0, 160) ?? '');
  check(
    'тропа: сцена и дорога на месте',
    !!$('.trail-scene') && $$('.trail-seg').length >= 5 && !!$('.trail-hero-svg'),
    `плит: ${$$('.trail-seg').length}, герой: ${!!$('.trail-hero-svg')}`,
  );
  check(
    'тропа: продолжила со второго слова остановки',
    $('.trail-screen')?.getAttribute('data-trail-word') === WORD_BY_ID[school.wordIds[1]].text,
    `${$('.trail-screen')?.getAttribute('data-trail-word')} ≠ ${WORD_BY_ID[school.wordIds[1]].text}`,
  );
  check(
    'тропа: второе слово — просто дорога, без ремонта',
    !$('[data-trail-answer]') && !!$('.trail-walk') && $$('button.trail-seg').length >= 5,
    $('.trail-walk')?.textContent ?? 'нет',
  );

  check(
    'тропа: на дороге герой шагает',
    !!$('.trail-hero-svg.is-walk'),
    $('.trail-hero-svg')?.getAttribute('class') ?? 'героя нет',
  );
  const walked = await playWalk();
  check('тропа: слово «класс» пройдено по плитам', walked, '');
  check(
    'тропа: появился экран «слово пройдено»',
    !!$('.trail-done') && ($('.trail-done')?.textContent ?? '').includes('Слово на дороге!'),
    $('.trail-done')?.textContent ?? 'нет',
  );
  check(
    'тропа: на «слово пройдено» герой радуется',
    !!$('.trail-hero-svg.is-cheer'),
    $('.trail-done .trail-hero-svg')?.getAttribute('class') ?? 'героя нет',
  );
  const savedAfterWalk = useApp.getState().profiles.find((p) => p.id === profileId)?.trail;
  check(
    'тропа: слово сохранено в профиль сразу',
    savedAfterWalk?.words.includes(school.wordIds[1]) ?? false,
    JSON.stringify(savedAfterWalk),
  );
  const gemsAfterWalk = useApp.getState().profiles.find((p) => p.id === profileId)?.gems ?? -1;
  check('тропа: кристаллов за слово не даёт', gemsAfterWalk === 0, `💎: ${gemsAfterWalk}`);

  const more = btnText('Дальше');
  check('тропа: есть кнопка «Дальше»', !!more, '');
  if (more) click(more);
  await sleep(80);
  check(
    'тропа: дальше — поиск картинки',
    $('.trail-screen')?.getAttribute('data-trail-word') === WORD_BY_ID[school.wordIds[2]].text &&
      !!$('[data-trail-find-target]'),
    `${$('.trail-screen')?.getAttribute('data-trail-word')}, карточки: ${$$('[data-trail-find]').length}`,
  );
  check(
    'тропа: четыре разные картинки',
    $$('[data-trail-find]').length === 4 &&
      new Set($$('[data-trail-find]').map((card) => card.dataset.trailFind)).size === 4,
    $$('[data-trail-find]').map((card) => card.dataset.trailFind).join(', '),
  );
  check(
    'тропа: задание «найти» не прячет букву',
    $$('.trail-seg-hidden').length === 0 && !!$('.trail-find'),
    $('.trail-find')?.textContent ?? 'нет',
  );

  const found = await playFind();
  check('тропа: картинка найдена, слово пройдено', found, '');
  check(
    'тропа: после поиска — экран «слово пройдено»',
    !!$('.trail-done') && ($('.trail-done')?.textContent ?? '').includes('Слово на дороге!'),
    $('.trail-done')?.textContent ?? 'нет',
  );

  const next = btnText('Дальше');
  if (next) click(next);
  await sleep(80);
  const tray = $('[data-trail-slots]');
  const pencil = WORD_BY_ID['g2_карандаш'];
  check(
    'тропа: последнее слово — мост из слогов',
    !!tray && (tray.getAttribute('data-trail-slots') ?? '') === pencil.syllables.join('|'),
    tray?.getAttribute('data-trail-slots') ?? 'нет',
  );
  check(
    'тропа: на мосту есть пустые плиты',
    $$('.trail-seg-empty').length === pencil.syllables.length,
    `пустых: ${$$('.trail-seg-empty').length}`,
  );

  const syllables = await playSyllables();
  check('тропа: слоговое слово пройдено', syllables, '');
  const postcard = $('[data-trail-postcard]');
  check(
    'тропа: открытка остановки «Школа»',
    !!postcard && (postcard.textContent ?? '').includes('Школа') && (postcard.textContent ?? '').includes('пройдена'),
    postcard?.textContent ?? 'нет',
  );
  check(
    'тропа: после последнего слова сразу открытка, без лишнего «Дальше»',
    !btnText('Дальше') && !!btnText('Следующая остановка'),
    postcard?.textContent ?? 'нет',
  );
  const closed = useApp.getState().profiles.find((p) => p.id === profileId)?.trail;
  check(
    'тропа: остановка закрыта и открытка сохранена',
    !!closed && closed.words.length === 4 && closed.cards.includes(school.id),
    JSON.stringify(closed),
  );

  // Альбом — карта всех 16 остановок, а не отдельный список.
  const albumButton = $('[data-trail-album-open]') as HTMLButtonElement | null;
  check('тропа: в шапке есть кнопка альбома', !!albumButton, '');
  if (albumButton) click(albumButton);
  await sleep(80);
  check('тропа: альбом открылся', !!$('[data-trail-album]'), '');
  check(
    'тропа: в альбоме 16 открыток',
    $$('[data-trail-card]').length === 16,
    `карточек: ${$$('[data-trail-card]').length}`,
  );
  check(
    'тропа: открытка «Школы» отмечена, следующая — нет',
    $('[data-trail-card="school"]')?.getAttribute('data-trail-earned') === '1' &&
      $('[data-trail-card="schoolpeople"]')?.getAttribute('data-trail-earned') === '0',
    `school: ${$('[data-trail-card="school"]')?.getAttribute('data-trail-earned')}, ` +
      `schoolpeople: ${$('[data-trail-card="schoolpeople"]')?.getAttribute('data-trail-earned')}`,
  );
  const backToTrail = btnText('К тропе');
  check('тропа: из альбома можно вернуться', !!backToTrail, '');
  if (backToTrail) click(backToTrail);
  await sleep(80);
  check('тропа: вернулись к открытке остановки', !!$('[data-trail-postcard]'), '');

  const nextStopButton = btnText('Следующая остановка');
  check('тропа: есть кнопка следующей остановки', !!nextStopButton, '');
  if (nextStopButton) click(nextStopButton);
  await sleep(100);
  check(
    'тропа: вторая остановка — «В школе»',
    ($('.trail-sub')?.textContent ?? '').includes('В школе'),
    $('.trail-sub')?.textContent ?? 'нет',
  );
  const moved = useApp.getState().profiles.find((p) => p.id === profileId)?.trail;
  check('тропа: переход сохранён в профиль', moved?.stop === 1, JSON.stringify(moved));
  check(
    'тропа: первое слово второй остановки ждёт ремонта буквы',
    $('.trail-screen')?.getAttribute('data-trail-word') === WORD_BY_ID[nextStop.wordIds[0]].text &&
      !!$('[data-trail-answer]') &&
      $$('.trail-seg-hidden').length === 1,
    `${$('.trail-screen')?.getAttribute('data-trail-word')}, вопросов: ${$$('.trail-seg-hidden').length}`,
  );

  // Уходим до прохождения слова и возвращаемся: resume должен вернуть туда же.
  const back = buttons().find(
    (b) => b.getAttribute('aria-label') === 'Вернуться к играм',
  );
  check('тропа: кнопка возврата на месте', !!back, '');
  if (back) click(back);
  await sleep(90);
  check('тропа: вернулись к витрине', !!$('.games-cards'), '');
  const backBanner = $('[data-trail-banner]');
  check(
    'тропа: баннер показывает 1 из 16 остановок',
    (backBanner?.textContent ?? '').includes('1 из 16'),
    backBanner?.textContent ?? 'нет',
  );

  if (backBanner) click(backBanner as HTMLButtonElement);
  await sleep(90);
  check(
    'тропа: после возврата — то же слово',
    $('.trail-screen')?.getAttribute('data-trail-word') === WORD_BY_ID[nextStop.wordIds[0]].text,
    $('.trail-screen')?.getAttribute('data-trail-word') ?? 'нет',
  );
  check(
    'тропа: после возврата — та же остановка',
    ($('.trail-sub')?.textContent ?? '').includes('В школе'),
    $('.trail-sub')?.textContent ?? 'нет',
  );

  const letters = await playLetters();
  check('тропа: буква починена, слово пройдено', letters, '');
  const afterLetters = useApp.getState().profiles.find((p) => p.id === profileId)?.trail;
  check(
    'тропа: слово второй остановки сохранено',
    afterLetters?.words.includes(nextStop.wordIds[0]) ?? false,
    JSON.stringify(afterLetters),
  );

  // 5 класс: картинок у слов почти нет, поэтому тропа не обещается.
  // Смену класса делаем на том же профиле: так проверяется и сброс книги
  // 2 класса при переходе в 3-й, и отсутствие баннера в 5-м.
  const backToGames = buttons().find(
    (b) => b.getAttribute('aria-label') === 'Вернуться к играм',
  );
  if (backToGames) click(backToGames);
  await sleep(80);

  useApp.getState().setActiveClass(3);
  await sleep(90);
  const thirdBanner = $('[data-trail-banner]');
  check(
    'тропа: прогресс 2 класса не виден в 3-м',
    !!thirdBanner &&
      (thirdBanner.textContent ?? '').includes('0 из 2') &&
      !(thirdBanner.textContent ?? '').includes('Школа'),
    thirdBanner?.textContent ?? 'баннера нет',
  );

  useApp.getState().setActiveClass(5);
  await sleep(90);
  check(
    'тропа: 5 классу баннер не показывается',
    !$('[data-trail-banner]'),
    document.querySelector('.games-screen')?.textContent?.slice(0, 120) ?? 'нет экрана',
  );

}

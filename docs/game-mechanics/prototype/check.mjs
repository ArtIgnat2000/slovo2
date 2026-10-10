// Проверка прототипа: прогоняет все пять механик в jsdom (npm run proto:check).
// Живёт отдельно от основного контура app-тестов: это страница-демонстрация,
// её поломка не должна блокировать релиз приложения, но и молча гнить не должна.
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(here, 'index.html');
const store = new Map();
const dom = new JSDOM(fs.readFileSync(file, 'utf8'), {
  runScripts: 'dangerously',
  resources: 'usable',
  url: 'file://' + file,
  pretendToBeVisual: true,
  beforeParse(window) {
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
      },
    });
  },
});
const { window } = dom;
const doc = window.document;
const $ = (s) => doc.querySelector(s);
const $$ = (s) => [...doc.querySelectorAll(s)];
const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms));
/** Вернуться на хаб из любого экрана/шторки. */
const backGame = () => {
  const sheet = doc.getElementById('sheet');
  if (sheet && !sheet.hidden) sheet.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const b = doc.querySelector('.back');
  if (b) b.click();
};
/** Все правильные написания из контент-пака: кривое слово не должно случайно
    совпасть с настоящим словом (иначе «ошибка» неотличима от нормы).
    data.js читаем напрямую — так проверка не зависит от порядка загрузки скриптов. */
const dataSrc = fs.readFileSync(path.join(here, 'data.js'), 'utf8');
const { WORDS } = new Function(dataSrc + '; return { WORDS, LESSONS };')();
const CORRECT = new Set(WORDS.map((w) => w.text.toLowerCase()));
const fails = [];
const ok = (cond, label) => { console.log((cond ? '✓' : '✗') + ' ' + label); if (!cond) fails.push(label); };

await new Promise((r) => window.addEventListener('load', r));
await wait(60);

// 1. Хаб
ok($('#app').textContent.includes('Слово-квест'), 'хаб отрисован');
ok($$('.menu-card').length === 8, 'в меню 8 карточек: 3 игры + 5 механик');
ok($$('.menu-card.game').length === 3, 'блок «Игры» на месте');
ok($('#app').textContent.includes('/94 наклеек'), 'демо-прогресс насыпан (чипы видно)');
ok(!!$('svg.buk'), 'БУК нарисован');

// 2. Путешествие
$('#menu-journey').click();
await wait(20);
ok($$('.station').length === 16, 'на карте 16 станций');
const doneCount = $$('.station.done').length;
ok(doneCount === 4, 'демо-прогресс: 4 станции пройдены (а сейчас ' + doneCount + ')');
const current = $('.station.current');
ok(!!current, 'есть текущая станция');
ok($$('.prival').length >= 1, 'на карте виден привал после 4-й станции');
current.click();
await wait(20);
ok(!!$('#sheet .assembler'), 'станция открывает сборку слова');
const tiles = $$('#sheet .tile');
ok(tiles.length > 3, 'плитки букв на месте (' + tiles.length + ')');
// шпион: кликаем плитки по индексу (после каждого клика DOM перерисовывается)
let spyFound = false;
for (let i = 0; i < tiles.length; i++) {
  const t = $$('#sheet .tile')[i];
  if (!t) break;
  t.click();
  await wait(5);
  const note = $('#sheet .assembler-note');
  if (note && note.textContent.includes('шпион')) { spyFound = true; break; }
}
ok(spyFound, 'буква-шпион не встаёт на место и объясняется');
// полное решение станции: чистим слоты, затем ставим буквы по порядку
const target = $('#sheet .assembler').dataset.word;
for (let guard = 0; guard < 30; guard++) {
  const filled = $('#sheet .slot.filled');
  if (!filled) break;
  filled.click();
  await wait(5);
}
const before = JSON.parse(store.get('slovo2-proto-mechanics-v1') || '{}');
for (let slot = 0; slot < target.length; slot++) {
  const need = target[slot];
  const list = $$('#sheet .tile');
  const t = list.find((el) => el.textContent === need && !el.classList.contains('used'));
  if (!t) break;
  t.click();
  await wait(6);
}
await wait(60);
const after = JSON.parse(store.get('slovo2-proto-mechanics-v1') || '{}');
ok($('#sheet').textContent.includes('открыта'), 'станция закрыта: показан экран успеха');
ok((after.stations || []).length === 5, 'станция добавлена в прогресс (' + (after.stations || []).length + ')');
ok((after.unlocked || []).length > (before.unlocked || []).length, 'слово вклеено в книгу слов');

// 3. Книга слов
$('#sheet') && doc.getElementById('sheet').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
$('#app') && doc.querySelectorAll('.back').forEach((b) => b.click());
await wait(10);
$('#menu-album').click();
await wait(20);
const stickers = $$('.sticker').length;
ok(stickers > 0, 'страница книги слов отрисована (' + stickers + ' мест)');
ok($$('.sticker.locked').length > 0, 'есть закрытые места с «?»');
const open = $('.sticker:not(.locked)');
if (open) { open.click(); await wait(10); }
ok(!!$('#sheet .wcard'), 'наклейка открывает карточку слова');
ok($('#sheet .letters').textContent.replace(/\s/g, '').length > 1, 'в карточке слово по буквам');
doc.getElementById('sheet').dispatchEvent(new window.MouseEvent('click', { bubbles: true, target: doc.getElementById('sheet') }));
await wait(10);

// 4. Мастерская
const back = () => { const b = $('.back'); if (b) b.click(); };
back(); await wait(10);
$('#menu-workshop').click();
await wait(20);
ok(!!$('.assembler'), 'мастерская открылась');
for (let i = 0; i < $$('.tile').length; i++) {
  const t = $$('.tile')[i];
  if (t) t.click();
  await wait(5);
  if ($$('.slot.filled').length >= 1) break;
}
ok($$('.slot.filled').length === 1, 'буква встала в слот');

// 5. Барабан
back(); await wait(10);
$('#menu-drum').click();
await wait(20);
ok($$('.pad').length >= 2, 'плиты-слоги на месте');
const syl = ($('#drum-title').textContent.split(':')[1] || '').trim().split('·');
$$('.pad')[0].click();
await wait(5);
ok($$('.pad.hit').length === 1, 'удар по слогу принят');
for (let i = 0; i < syl.length; i++) {
  const list = $$('.pad');
  const t = list.find((el) => el.textContent === syl[i]);
  if (t) { t.click(); await wait(6); }
}
await wait(40);
ok($('#drum-title').textContent.includes('перепутались'), 'после ритма слоги спрятались');
const s2 = JSON.parse(store.get('slovo2-proto-mechanics-v1') || '{}');
const beforeDrum = s2.unlocked.length;
for (let i = 0; i < syl.length; i++) {
  const list = $$('.pad');
  const t = list.find((el) => el.textContent === syl[i] && !el.classList.contains('hit'));
  if (t) { t.click(); await wait(8); }
}
await wait(40);
ok($('#drum-title').textContent.includes('собрано'), 'слово собрано из слогов');
ok($$('.card .letters .l.danger').length >= 1, 'после сборки показано опасное место');

// 6. Записка
back(); await wait(10);
$('#menu-note').click();
await wait(20);
ok(!!$('.note'), 'письмо БУКа открылось');
const notesBefore = JSON.parse(store.get('slovo2-proto-mechanics-v1') || '{}').notes;
const bugWord = $('.note [data-bug]');
ok(!!bugWord, 'в письме есть слово с ошибкой (' + (bugWord && bugWord.textContent) + ')');
bugWord.click();
await wait(10);
ok(!!$('#sheet [data-opt]'), 'предложены варианты исправления');
const opts = $$('#sheet [data-opt]');
const bugKey = $$('.note [data-bug]')[0].dataset.bug;
const right = opts.find((o) => o.dataset.opt === bugKey);
right.click();
await wait(20);
ok($('.note .word.fixed') !== null, 'слово исправлено и отмечено');
ok($('#note-progress').textContent.includes('1'), 'счётчик нашёл 1 ошибку');
await wait(700);
ok($('#sheet').textContent.includes('сыщик') || $('#sheet').textContent.includes('Прочитать'), 'письмо завершено финальной сценой');
const s4 = JSON.parse(store.get('slovo2-proto-mechanics-v1') || '{}');
ok(s4.notes > notesBefore, 'номер письма сохранён (' + notesBefore + ' → ' + s4.notes + ')');

/* ══ ИГРЫ ══════════════════════════════════════════════════════════════════ */
const game = window.__protoGame;
ok(!!game && typeof game.state === 'function', 'отладочные хуки прототипа доступны');

// ── Игра 1. Бродилка БУКа
backGame(); await wait(10);
$('#game-brd').click();
await wait(20);
ok($$('.brd-cell').length === 16, 'бродилка: 16 клеток маршрута');
ok(!!$('.brd-token'), 'бродилка: БУК стоит на маршруте');
ok($('#roll') !== null, 'бродилка: кубик есть');
const startPos = game.brd.pos;
await game.brd.roll(3);
await wait(60);
ok(game.brd.pos === startPos + 3 || game.brd.pos === 16, 'бродилка: кубик сдвинул БУКа на 3 (' + game.brd.pos + ')');
ok($$('.brd-cell.passed').length >= 3, 'бродилка: пройденные клетки отмечены');
// идём до первой станции: привал задание не открывает — это и проверяем
for (let i = 0; i < 6 && $('#sheet').hidden && game.brd.pos < 16; i++) {
  await game.brd.roll(3);
  await wait(60);
}
ok(!$('#sheet').hidden, 'бродилка: станция открыла задание, а привал — нет');
ok($$('.brd-cell.prival-cell').length === 4, 'бродилка: четыре привала на маршруте');
let brdTarget = $('#sheet .assembler') ? $('#sheet .assembler').dataset.word : null;
if (brdTarget) {
  for (let slot = 0; slot < brdTarget.length; slot++) {
    const t = $$('#sheet .tile').find((el) => el.textContent === brdTarget[slot] && !el.classList.contains('used'));
    if (t) { t.click(); await wait(6); }
  }
  await wait(60);
  const st = JSON.parse(store.get('slovo2-proto-mechanics-v1') || '{}');
  ok($('#sheet').textContent.includes('взята'), 'бродилка: станция взята за собранное слово');
  ok((st.brd.claimed || []).length >= 1, 'бродилка: станция записана в прогресс');
}
// доходим до финиша: тянем кубик и закрываем появляющиеся станции
for (let i = 0; i < 40 && !$('#sheet').textContent.includes('Маршрут пройден'); i++) {
  if (!$('#sheet').hidden) {
    $('#sheet').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await wait(10);
  }
  if (game.brd.pos >= 16) break;
  await game.brd.roll(3);
  await wait(50);
  if ($('#sheet').textContent.includes('Маршрут пройден')) break;
}
await wait(60);
ok($('#sheet').textContent.includes('Маршрут пройден') || game.brd.pos >= 16, 'бродилка: финиш маршрута достижим (+10 💎)');

// ── Игра 2. Буквоед
backGame(); await wait(10);
$('#game-snake').click();
await wait(20);
ok($$('.scell').length === 63, 'буквоед: поле 7×9 нарисовано');
let snake = game.snake.state();
ok(snake.eaten === 0, 'буквоед: съедено 0 букв');
ok(snake.foods.filter((f) => !f.spy).length === 1, 'буквоед: на поле ровно одна нужная буква');
ok(snake.foods.filter((f) => f.spy).length === 2, 'буквоед: на поле два шпиона');
ok($$('.words-strip .l').length === snake.word.length, 'буквоед: полоска слова совпадает с длиной');
// шпион: не съедается как буква и не двигает слово
const spy = snake.foods.find((f) => f.spy);
game.snake.place(spy.x === 0 ? 6 : spy.x - 1, spy.y);
game.snake.setDir('right');
game.snake.tick();
await wait(20);
snake = game.snake.state();
ok(snake.eaten === 0, 'буквоед: шпион не засчитан как буква');
ok($('#snake-note').textContent.includes('Шпион'), 'буквоед: про шпиона сказано ребёнку');
// съедаем слово целиком
for (let guard = 0; guard < 40 && game.snake.state().eaten < snake.word.length; guard++) {
  const st = game.snake.state();
  const letter = st.foods.find((f) => !f.spy);
  if (!letter) break;
  game.snake.place(letter.x === 0 ? 6 : letter.x - 1, letter.y);
  game.snake.setDir('right');
  game.snake.tick();
  await wait(12);
}
await wait(500);
ok(game.snake.state().eaten === snake.word.length, 'буквоед: слово съедено целиком');
ok($('#sheet').textContent.includes('Слово съедено'), 'буквоед: экран победы показан');

// ── Игра 3. Сыщик слов
backGame(); await wait(10);
$('#game-hunt').click();
await wait(20);
const HUNT_CFG = [{ words: 6, wrong: 2 }, { words: 8, wrong: 3 }, { words: 8, wrong: 3 }];
const huntRound = game.state().hunt.rounds % 3;
const huntCfg = HUNT_CFG[huntRound];
ok($$('.plaque').length === huntCfg.words, 'сыщик: ' + huntCfg.words + ' слов в раунде ' + (huntRound + 1));
let hunt = game.hunt.state();
ok(hunt.items.filter((i) => i.wrong).length === huntCfg.wrong, 'сыщик: ' + huntCfg.wrong + ' слова с ошибкой загаданы');
ok(hunt.items.filter((i) => i.wrong).every((i) => i.text !== i.word_text), 'сыщик: «ошибки» отличаются от правильного написания');
ok(hunt.items.filter((i) => i.wrong).every((i) => !CORRECT.has(i.text.toLowerCase())), 'сыщик: кривое слово не совпадает с настоящим словом');
ok(hunt.items.every((i) => typeof i.text === 'string' && i.text.length > 0), 'сыщик: у каждого слова есть текст на табличке');
// ложная тревога не наказывает
const good = hunt.items.find((i) => !i.wrong);
const goodIdx = hunt.items.indexOf(good);
$$('.plaque')[goodIdx].click();
await wait(10);
ok($$('.plaque.checked').length === 1, 'сыщик: верное слово помечено «написано верно»');
ok($('#hunt-note').textContent.includes('всё верно'), 'сыщик: ребёнку сказано, что тут ошибки нет');
// находим все ошибки
for (const it of hunt.items.filter((i) => i.wrong)) {
  const arr = game.hunt.state().items;
  const idx = arr.findIndex((x) => x.text === it.text);
  if (idx >= 0) { $$('.plaque')[idx].click(); await wait(15); }
}
await wait(500);
hunt = game.hunt.state();
ok(hunt.found === huntCfg.wrong, 'сыщик: все ошибки найдены (' + hunt.found + ')');
ok($('#sheet').textContent.includes('Смена закрыта'), 'сыщик: раунд закрыт экраном победы');
ok($('#sheet').textContent.includes('⭐'), 'сыщик: звёзды выданы');
const stHunt = JSON.parse(store.get('slovo2-proto-mechanics-v1') || '{}');
ok(stHunt.hunt.rounds === huntRound + 1, 'сыщик: раунд записан в прогресс (' + stHunt.hunt.rounds + ')');
ok(stHunt.hunt.false >= 1, 'сыщик: ложная тревога посчитана (звёзды честные)');
// следующий раунд сложнее
const nextBtn = [...$('#sheet').querySelectorAll('button')].find((b) => /раунд/i.test(b.textContent));
if (nextBtn) { nextBtn.click(); await wait(30); }
ok(game.state().hunt.rounds === huntRound + 1, "сыщик: следующий раунд открылся и записан");
ok($$('.plaque').length >= huntCfg.words, 'сыщик: в новом раунде слов не меньше, чем в прошлом');

console.log('\n' + (fails.length ? 'ПРОВАЛЫ: ' + fails.join(' | ') : 'все проверки прототипа прошли'));
process.exit(fails.length ? 1 : 0);

/**
 * Прототип сцены «Цветок слова» (0.109.0) без приложения.
 *
 * Запуск: node scripts/proto-flower.mjs  →  preview/flower/index.html
 * Открывается любым статическим сервером: `npm run preview:show`
 * (http://localhost:8080/flower/).
 *
 * Зачем: в песочнице нет браузера, а владельцу нужно **потрогать** сцену —
 * нажимать буквы, видеть распуск, промах с пыльцой и цветение. Скрипт не
 * копирует стили «на глаз», а склеивает те же файлы, что и приложение:
 * `src/styles/tokens.css` + `src/styles/app.css` + `public/flower/*.webp`,
 * поэтому прототип врёт только в одном — вокруг нет остального приложения.
 *
 * Ассеты копируются, а не ссылаются через `..`, чтобы страница жила в
 * `preview/` (эта папка уже в .gitignore — в репозиторий прототип не попадёт).
 */
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'preview/flower');

mkdirSync(path.join(outDir, 'flower'), { recursive: true });
// Кладём картинки РЯДОМ со страницей: `app.css` ссылается на них абсолютным
// путём `/flower/*.webp`, поэтому при раздаче `preview/` как корня всё сходится.
for (const name of ['petal', 'center', 'leaf', 'backplate']) {
  cpSync(path.join(root, `public/flower/${name}.webp`), path.join(outDir, 'flower', `${name}.webp`));
}

const tokens = readFileSync(path.join(root, 'src/styles/tokens.css'), 'utf8');
const app = readFileSync(path.join(root, 'src/styles/app.css'), 'utf8');

// Минимальная обвязка приложения: без неё `#root`-стили и `--font` не работают.
const shell = `
.shell { max-width: 460px; margin: 0 auto; padding: 12px 12px 28px; }
.proto-bar { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 0 0 10px; }
.proto-bar .chip { cursor: pointer; }
.proto-title { margin: 0 0 4px; font-size: 18px; }
.proto-hint { margin: 0 0 10px; font-size: 12px; color: var(--ink-2); }
.proto-log { margin: 10px 0 0; padding: 8px 10px; border-radius: 12px; border: 1px dashed var(--line); font-size: 12px; color: var(--ink-2); min-height: 34px; }
.proto-narrow { max-width: 340px; margin: 0 auto; }
`;

const html = `<!doctype html>
<html lang="ru" data-theme="light" data-theme-style="classic">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>Цветок слова — прототип 0.109.0</title>
<style>
${tokens}
${app}
${shell}
</style>
</head>
<body>
<div class="shell">
  <h1 class="proto-title">Цветок слова — прототип</h1>
  <p class="proto-hint">Настоящие стили и картинки из ветки 0.109.0. Жми буквы: верная распускает лепесток, неверная даёт пыльцу и качание.</p>

  <div class="proto-bar" id="bar">
    <button type="button" class="chip on" data-word="КОТ">КОТ · 3</button>
    <button type="button" class="chip" data-word="ЦВЕТОК">ЦВЕТОК · 6</button>
    <button type="button" class="chip" data-word="ЗЕМЛЯНИКА">ЗЕМЛЯНИКА · 9</button>
    <button type="button" class="chip" data-word="ПУТЕШЕСТВИЕ">ПУТЕШЕСТВИЕ · 10</button>
    <button type="button" class="chip" id="theme">🌙 тема</button>
    <button type="button" class="chip" id="narrow">📱 340 px</button>
    <button type="button" class="chip" id="reset">↺ заново</button>
  </div>

  <section class="flower-card" aria-label="Цветок слова" id="card">
    <div class="ring-bar">
      <strong class="grow" id="progress">Открыто букв: 0 из 3</strong>
      <button type="button" class="btn ghost sm" id="other">🔄 Другое слово</button>
    </div>

    <div class="flower-scene" id="scene">
      <div class="flower-meadow" aria-hidden="true"></div>
      <div class="flower-grass" aria-hidden="true"></div>
      <div class="flower-plant" id="plant">
        <div class="flower-bloom" id="bloom" aria-hidden="true"></div>
        <div class="flower-trunk" aria-hidden="true">
          <img class="flower-leaf flower-leaf-l" src="/flower/leaf.webp" alt="" draggable="false" />
          <img class="flower-leaf flower-leaf-r" src="/flower/leaf.webp" alt="" draggable="false" />
        </div>
        <div class="flower-soil" aria-hidden="true"></div>
        <span class="flower-sparkles" aria-hidden="true" id="sparks" hidden></span>
      </div>
      <p class="flower-word" aria-live="polite" id="word"></p>
    </div>

    <div class="ring-clue">
      <div class="ring-clue-body">
        <p class="clue-hint" id="clue">💡 Мягкая лапа, любит рыбу.</p>
      </div>
    </div>

    <div class="tl-options" role="group" aria-label="Выбери следующую букву" id="options"></div>

    <p class="tiny muted tl-note">Ошибка ничего не отнимает: цветок не увянет, а подсказка станет подробнее.</p>
  </section>

  <p class="proto-log" id="log">Готово. Выбери слово вверху.</p>
</div>

<script>
const WORDS = {
  'КОТ': { hint: 'Мягкая лапа, любит рыбу.', choices: { 'К': ['Г','Т','Х'], 'О': ['А','У','Ё'], 'Т': ['Д','П','К'] } },
  'ЦВЕТОК': { hint: 'Растёт из семечка и пахнет.', choices: { 'Ц': ['Ч','С','Ш'], 'В': ['Ф','Б','М'], 'Е': ['И','Я','Э'], 'Т': ['Д','П','К'], 'О': ['А','У','Ё'], 'К': ['Г','Х','Т'] } },
  'ЗЕМЛЯНИКА': { hint: 'Красная ягода с точками.', choices: { 'З': ['С','Ж','Ц'], 'Е': ['И','Я','Э'], 'М': ['Н','Л','В'], 'Л': ['Р','М','Й'], 'Я': ['Е','И','А'], 'Н': ['М','Л','П'], 'И': ['Е','Ы','Я'], 'К': ['Г','Х','Т'], 'А': ['О','Я','У'] } },
  'ПУТЕШЕСТВИЕ': { hint: 'Дорога в далёкие места.', choices: { 'П': ['Б','Ф','Т'], 'У': ['Ю','О','Ы'], 'Т': ['Д','П','К'], 'Е': ['И','Я','Э'], 'Ш': ['Ж','Щ','С'], 'Е': ['И','Я','Э'], 'С': ['З','Ш','Ц'], 'Т': ['Д','П','К'], 'В': ['Ф','Б','М'], 'И': ['Е','Ы','Я'] } },
};

const $ = (id) => document.getElementById(id);
let word = 'КОТ';
let opened = 0;
let wrong = 0;
let tried = [];
// Промах живёт 0.52 с. Держим его в состоянии, а не только классом: render
// переписывает className целиком, и класс, навешенный снаружи, тут же стирался.
let puffing = false;

function stems(n) {
  if (n <= 4) return [44, 100];
  if (n <= 6) return [48, 112];
  return [54, 126];
}

function render() {
  const letters = [...word];
  const total = letters.length;
  const done = opened >= total;
  const bloomKind = total <= 4 ? ' is-roomy' : total <= 6 ? '' : total <= 8 ? ' is-dense' : ' is-denser';
  const [low, high] = stems(total);
  const stem = Math.round(low + (opened / total) * (high - low));

  $('scene').className = 'flower-scene' + (done ? ' is-done' : '') + (puffing ? ' is-wrong' : '');
  $('scene').dataset.flowerDone = done ? '1' : '0';
  $('plant').style.setProperty('--stem', stem + 'px');
  $('progress').textContent = 'Открыто букв: ' + opened + ' из ' + total;

  // Соцветие: лепестки по числу букв.
  const bloom = $('bloom');
  bloom.className = 'flower-bloom' + bloomKind;
  bloom.innerHTML = '';
  letters.forEach((ch, i) => {
    const open = i < opened;
    const span = document.createElement('span');
    span.className = 'flower-blossom' + (open ? ' is-open' : '');
    span.style.setProperty('--petal-angle', (360 / total) * i + 'deg');
    span.dataset.flowerPetal = String(i);
    span.innerHTML = '<img class="flower-petal-img" src="/flower/petal.webp" alt="" draggable="false" />' +
      (open ? '<span class="flower-petal-letter">' + ch + '</span>' : '');
    bloom.appendChild(span);
  });
  const core = document.createElement('span');
  core.className = 'flower-core' + (done ? ' is-done' : '');
  core.innerHTML = '<img src="/flower/center.webp" alt="" draggable="false" />' + (done ? '<span class="flower-core-spark">✦</span>' : '');
  bloom.appendChild(core);

  // Пыльца при промахе и светлячки на победе — как в сцене игры.
  const plant = $('plant');
  const stale = plant.querySelector('.flower-pollen');
  if (stale) stale.remove();
  if (puffing) {
    const puff = document.createElement('span');
    puff.className = 'flower-pollen';
    puff.textContent = '✳';
    plant.appendChild(puff);
  }
  const sparks = $('sparks');
  sparks.hidden = !done;
  if (done) {
    sparks.innerHTML = [0, 1, 2, 3, 4, 5].map((i) => '<span class="flower-spark flower-spark-' + i + '">✦</span>').join('');
  } else {
    sparks.innerHTML = '';
  }

  // Слово под цветком — как в игре: открытые буквы, остальные точками.
  $('word').innerHTML = letters.map((ch, i) =>
    '<span class="' + (i < opened ? 'flower-word-on' : 'flower-word-off') + '">' + (i < opened ? ch : '·') + '</span>').join('');
  $('word').setAttribute('aria-label', 'Открыто ' + opened + ' из ' + total + ' букв');

  // Карточки-буквы: верная + три соседки, перемешаны.
  const box = $('options');
  if (done && box) {
    box.outerHTML = '<div class="flower-win" role="status" id="win">' +
      '<p class="flower-win-title">Цветок распустился!</p>' +
      '<p class="flower-win-word">' + word + '</p>' +
      '<p class="tiny"><b>+2 ⚡</b> <span class="muted">· засчитано в задания дня</span></p>' +
      '<p class="tiny muted">Ещё пару слов сегодня — и задания дня закрыты.</p>' +
      '<button type="button" class="btn primary" onclick="nextWord()">Новое слово →</button></div>';
  } else if (!box && !done) {
    // Победа была — возвращаем сетку карточек (иначе перерисовывать некуда).
    const win = $('win');
    if (win) win.outerHTML = '<div class="tl-options" role="group" aria-label="Выбери следующую букву" id="options"></div>';
    return render();
  } else if (box) {
    const answer = letters[opened];
    const wrongs = (WORDS[word].choices[answer] || ['А','Б','В']).slice(0, 3);
    const cards = [answer, ...wrongs].sort(() => Math.random() - 0.5);
    box.innerHTML = cards.map((letter) => {
      const gone = tried.includes(letter) && letter !== answer;
      return '<button type="button" class="tl-option' + (gone ? ' tl-option-gone' : '') + '" data-l="' + letter + '">' + letter + '</button>';
    }).join('');
  }
}

function pick(letter) {
  const letters = [...word];
  if (opened >= letters.length) return;
  const answer = letters[opened];
  if (letter === answer) {
    puffing = false;
    opened += 1;
    tried = [];
    const petals = document.querySelectorAll('.flower-blossom');
    if (petals[opened - 1]) petals[opened - 1].classList.add('is-fresh');
    setTimeout(render, 640);
    log('✓ «' + letter + '» — лепесток распустился, стебель подрос.');
  } else {
    wrong += 1;
    tried.push(letter);
    const scene = $('scene');
    puffing = true;
    setTimeout(() => { puffing = false; render(); }, 520);
    if (wrong === 1) $('clue').textContent = '💡 ' + WORDS[word].hint + ' (подсказка мягче не станет — просто пробуй дальше)';
    if (wrong >= 2) $('clue').textContent = '💡 Следующая буква — ' + answer + '. Выбери её из карточек.';
    log('× «' + letter + '» — пыльца и качание. Цветок не пострадал, открыто всё ещё ' + opened + '.');
  }
  render();
}

function log(text) { $('log').textContent = text; }

function useWord(next) {
  word = next;
  opened = 0; wrong = 0; tried = [];
  const win = $('win');
  if (win) {
    win.outerHTML = '<div class="tl-options" role="group" aria-label="Выбери следующую букву" id="options"></div>';
  }
  $('clue').textContent = '💡 ' + WORDS[next].hint;
  document.querySelectorAll('#bar .chip[data-word]').forEach((c) => c.classList.toggle('on', c.dataset.word === next));
  log('Слово «' + next + '», ' + [...next].length + ' букв — смотрим, как цветок растёт.');
  render();
}

function nextWord() {
  const keys = Object.keys(WORDS);
  useWord(keys[(keys.indexOf(word) + 1) % keys.length]);
}

document.getElementById('bar').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  if (chip.dataset.word) useWord(chip.dataset.word);
  if (chip.id === 'reset') useWord(word);
  if (chip.id === 'theme') {
    const root = document.documentElement;
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    const styles = ['classic', 'neon', 'space', 'forest', 'ocean', 'bedroom', 'fairygarden', 'sunset'];
    const now = styles.indexOf(root.dataset.themeStyle || 'classic');
    root.dataset.themeStyle = styles[(now + 1) % styles.length];
    log('Тема: ' + root.dataset.theme + ' / ' + root.dataset.themeStyle +
      (root.dataset.theme === 'dark' ? ' — поляна притемнена, как в приложении' : ' — светлая схема'));
  }
  if (chip.id === 'narrow') {
    const card = $('card');
    card.classList.toggle('proto-narrow');
    log('Ширина карточки: ' + (card.classList.contains('proto-narrow') ? '340 px (узкий телефон)' : 'полная'));
  }
});

// Делегирование от карточки, а не от сетки: после победы сетка карточек
// пересоздаётся (outerHTML), и слушатель на ней пропал бы.
document.getElementById('card').addEventListener('click', (e) => {
  if (e.target.closest('#other')) { nextWord(); return; }
  const b = e.target.closest('.tl-option');
  if (b && !b.classList.contains('tl-option-gone')) pick(b.dataset.l);
});

render();
</script>
</body>
</html>
`;

writeFileSync(path.join(outDir, 'index.html'), html);
console.log(`✓ preview/flower/index.html — ${(html.length / 1024).toFixed(0)} КБ (стили и картинки из рабочего дерева)`);
console.log('  открыть: python3 scripts/preview_server.py --port 8080 --bind 0.0.0.0 --directory preview');

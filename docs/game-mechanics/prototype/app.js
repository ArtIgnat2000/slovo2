/* Прототип игровых механик «Слово 2.0».
   Ванильный JS, без зависимостей и без сети. Данные — data.js (сгенерирован из
   src/content/words.ts). Прогресс прототипа живёт в своём ключе localStorage
   и не имеет отношения к профилю приложения. */
'use strict';

const LS_KEY = 'slovo2-proto-mechanics-v1';
const ART = (name) => `../../../public/words/${name}.webp`;

const ALL_WORDS = typeof WORDS !== 'undefined' ? WORDS : [];
const ALL_LESSONS = (typeof LESSONS !== 'undefined' ? LESSONS : [])
  .filter((l) => l.order > 0)
  .sort((a, b) => a.order - b.order);

const WORD_BY_ID = Object.fromEntries(ALL_WORDS.map((w) => [w.id, w]));
const LESSON_BY_ID = Object.fromEntries(ALL_LESSONS.map((l) => [l.id, l]));

/* ── Состояние прототипа ─────────────────────────────────────────────────── */
function blank() {
  return {
    unlocked: [], stations: [], prival: {}, notes: 0, built: 0, gems: 0,
    // игры: бродилка, буквоед, сыщик слов
    brd: { pos: 0, claimed: [], gems: 0 },
    snake: { games: 0 },
    hunt: { rounds: 0, best: 0, false: 0 },
  };
}
function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return Object.assign(blank(), JSON.parse(raw));
  } catch (err) { /* приватный режим — просто играем без сохранения */ }
  return blank();
}
let S = loadState();
function save() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (err) { /* ignore */ }
}
function isUnlocked(id) { return S.unlocked.includes(id); }
function unlock(id) {
  if (!isUnlocked(id)) { S.unlocked.push(id); S.gems += 1; save(); }
}
function themeWords(theme) { return ALL_WORDS.filter((w) => w.theme === theme); }
function lessonsDone() { return S.stations.length; }
function currentLessonIndex() {
  return ALL_LESSONS.findIndex((l) => !S.stations.includes(l.id));
}

/* ── Утилиты интерфейса ──────────────────────────────────────────────────── */
const app = document.getElementById('app');
const toastEl = document.getElementById('toast');
const sheetEl = document.getElementById('sheet');
const sheetCard = document.getElementById('sheet-card');
const confettiEl = document.getElementById('confetti');

let toastTimer = null;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2200);
}
function buzz(pattern) {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (err) { /* ignore */ }
}
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function plural(n, one, few, many) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
function confetti() {
  const colors = ['#7c5cff', '#ff9f0a', '#22c55e', '#ff6fb5', '#3b82f6'];
  for (let i = 0; i < 26; i++) {
    const bit = document.createElement('i');
    bit.style.left = Math.random() * 100 + 'vw';
    bit.style.background = pick(colors);
    bit.style.animationDelay = Math.random() * 0.35 + 's';
    confettiEl.appendChild(bit);
    setTimeout(() => bit.remove(), 2200);
  }
}
let sheetOnClose = null;
function openSheet(html, mount, onClose) {
  sheetCard.innerHTML = html;
  sheetEl.hidden = false;
  sheetOnClose = onClose || null;
  if (mount) mount(sheetCard);
}
function closeSheet() {
  const cb = sheetOnClose;
  sheetOnClose = null;
  sheetEl.hidden = true;
  sheetCard.innerHTML = '';
  if (cb) cb();
}
sheetEl.addEventListener('click', (e) => { if (e.target === sheetEl) closeSheet(); });

/* ── БУК ─────────────────────────────────────────────────────────────────── */
const MOOD_EYES = {
  idle: `<circle cx="46" cy="56" r="12" fill="#fff"/><circle cx="74" cy="56" r="12" fill="#fff"/>
         <circle cx="47" cy="57" r="5" fill="#241f36"/><circle cx="75" cy="57" r="5" fill="#241f36"/>`,
  happy: `<ellipse cx="46" cy="57" rx="12" ry="9" fill="#fff"/><ellipse cx="74" cy="57" rx="12" ry="9" fill="#fff"/>
          <circle cx="47" cy="58" r="5" fill="#241f36"/><circle cx="75" cy="58" r="5" fill="#241f36"/>`,
  excited: `<circle cx="46" cy="54" r="14" fill="#fff"/><circle cx="74" cy="54" r="14" fill="#fff"/>
            <circle cx="46" cy="54" r="7" fill="#241f36"/><circle cx="74" cy="54" r="7" fill="#241f36"/>
            <circle cx="49" cy="50" r="2.6" fill="#fff"/><circle cx="77" cy="50" r="2.6" fill="#fff"/>`,
  sad: `<ellipse cx="46" cy="58" rx="12" ry="8" fill="#fff"/><ellipse cx="74" cy="58" rx="12" ry="8" fill="#fff"/>
        <circle cx="44" cy="60" r="4" fill="#241f36"/><circle cx="72" cy="60" r="4" fill="#241f36"/>`,
  think: `<ellipse cx="46" cy="56" rx="12" ry="11" fill="#fff"/><ellipse cx="74" cy="56" rx="12" ry="11" fill="#fff"/>
          <circle cx="49" cy="55" r="5" fill="#241f36"/><circle cx="77" cy="55" r="5" fill="#241f36"/>`,
};
function buk(size = 96, mood = 'idle') {
  const eyes = MOOD_EYES[mood] || MOOD_EYES.idle;
  return `<svg class="buk" width="${size}" height="${size}" viewBox="0 0 120 120" role="img" aria-label="БУК">
    <path d="M40 30 L30 8 L54 22 Z" fill="#e8901a"/>
    <path d="M80 30 L90 8 L66 22 Z" fill="#e8901a"/>
    <ellipse cx="60" cy="68" rx="41" ry="40" fill="#f4a51a"/>
    <ellipse cx="19" cy="70" rx="10" ry="24" fill="#e8901a" transform="rotate(-10 19 70)"/>
    <ellipse cx="101" cy="70" rx="10" ry="24" fill="#e8901a" transform="rotate(10 101 70)"/>
    <ellipse cx="60" cy="76" rx="27" ry="31" fill="#fcd768"/>
    <path d="M60 68 L69 78 L51 78 Z" fill="#ff9f0a"/>
    ${eyes}
    <path d="M46 108 q0 8 8 8" stroke="#e8901a" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M74 108 q0 8 -8 8" stroke="#e8901a" stroke-width="5" fill="none" stroke-linecap="round"/>
  </svg>`;
}
function bukBubble(mood, text) {
  return `<div class="buk-bubble">${buk(66, mood)}<div class="txt"><b>БУК</b>${text}</div></div>`;
}

/* ── Карточка слова ──────────────────────────────────────────────────────── */
function lettersHTML(word) {
  return `<div class="letters">${[...word.text].map((ch, i) => {
    if (ch === ' ') return '<span class="l">&nbsp;</span>';
    const cls = word.danger.includes(i) ? 'l danger' : i === word.stress ? 'l stress' : 'l';
    return `<span class="${cls}">${esc(ch)}</span>`;
  }).join('')}</div>`;
}
function wordCardHTML(word) {
  const example = esc(word.sentence).replace('____', `<b>${esc(word.text)}</b>`);
  return `<div class="wcard">
    <div class="row spread">
      <span class="chip">${LESSON_BY_ID[word.theme] ? esc(LESSON_BY_ID[word.theme].emoji + ' ' + LESSON_BY_ID[word.theme].title) : 'слово'}</span>
      <span class="chip gem">💎 +1 за наклейку</span>
    </div>
    <div class="art"><img src="${ART(word.image)}" alt="${esc(word.text)}" onerror="this.replaceWith(Object.assign(document.createElement('div'),{textContent:'${esc(word.emoji)}',style:'font-size:64px'}))"/></div>
    ${lettersHTML(word)}
    <div class="syl">${word.syllables.map((s) => `<span>${esc(s)}</span>`).join('')}</div>
    <div class="example">${example}</div>
    <div class="mnemonic">${word.mnemonic ? '💡 ' + esc(word.mnemonic) : '📌 ' + esc(word.hint)}</div>
    <p class="small center">Красным подчёркнуто «опасное место» — буква, которую нужно запомнить;
    синим — ударная гласная.</p>
  </div>`;
}
function openWordCard(word) {
  openSheet(wordCardHTML(word), (host) => {
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.style.width = '100%';
    btn.textContent = 'Понятно';
    btn.addEventListener('click', closeSheet);
    host.appendChild(btn);
  });
}

/* ── Сборка слова с буквами-шпионами (М5) ────────────────────────────────── */
const CONFUSION = { vowel: 'аоеия', consonant: 'сзтдкн', other: 'аосеиб' };
function pickSpies(word, count) {
  const target = [...word.text.toLowerCase()];
  const pool = (CONFUSION[word.dangerKind || word.kind] || 'аоеи').split('');
  const spies = [];
  for (const ch of shuffle(pool)) {
    if (spies.length >= count) break;
    if (!target.includes(ch) && !spies.includes(ch)) spies.push(ch);
  }
  return spies;
}
function assemblerWords() {
  return ALL_WORDS.filter((w) => !w.text.includes(' ') && w.text.length >= 3 && w.text.length <= 8);
}

/** Сборщик: правильные буквы ставятся куда угодно, шпион ставиться не может. */
function makeAssembler(host, word, onDone) {
  const target = [...word.text];
  const spies = pickSpies(word, target.length <= 5 ? 1 : 2);
  const tiles = shuffle([
    ...target.map((ch, i) => ({ ch, spy: false, id: 't' + i })),
    ...spies.map((ch, i) => ({ ch, spy: true, id: 's' + i })),
  ]);
  const placed = new Array(target.length).fill(null);
  let finished = false;
  // подпись для отладки/автопроверки прототипа: какое слово собираем
  host.dataset.word = word.text;

  const slotsEl = host.querySelector('.slots');
  const tilesEl = host.querySelector('.tiles');
  const noteEl = host.querySelector('.assembler-note');

  function say(text) { if (noteEl) noteEl.textContent = text; }

  function draw() {
    slotsEl.innerHTML = placed
      .map((t, i) => `<button class="slot${t ? ' filled' : ''}" data-slot="${i}">${t ? esc(t.ch) : ''}</button>`)
      .join('');
    tilesEl.innerHTML = tiles
      .map((t) => `<button class="tile${t.used ? ' used' : ''}" data-tile="${t.id}">${esc(t.ch)}</button>`)
      .join('');
  }
  function check() {
    if (finished || placed.some((p) => !p)) return;
    const got = placed.map((p) => p.ch).join('');
    if (got === word.text) {
      finished = true;
      slotsEl.querySelectorAll('.slot').forEach((el) => el.classList.add('ok'));
      buzz([18, 40, 18]);
      onDone(word);
    } else {
      const bad = placed.findIndex((p, i) => p.ch !== target[i]);
      const el = slotsEl.querySelector(`[data-slot="${bad}"]`);
      if (el) el.classList.add('shake');
      buzz(60);
      setTimeout(() => el && el.classList.remove('shake'), 420);
      say('Почти! Посмотри на ' + (bad + 1) + '-ю букву — там что-то не так. Можно переставить.');
    }
  }
  host.addEventListener('click', (e) => {
    const slot = e.target.closest('[data-slot]');
    if (slot && placed[+slot.dataset.slot]) {
      const t = placed[+slot.dataset.slot];
      placed[+slot.dataset.slot] = null;
      const tile = tiles.find((x) => x.id === t.id);
      if (tile) tile.used = false;
      say('');
      draw();
      return;
    }
    const tileEl = e.target.closest('[data-tile]');
    if (!tileEl) return;
    const tile = tiles.find((x) => x.id === tileEl.dataset.tile);
    if (!tile || tile.used) return;
    if (tile.spy) {
      tileEl.classList.add('shake');
      buzz([0, 30, 60]);
      setTimeout(() => tileEl.classList.remove('shake'), 420);
      say('Это буква-шпион: в слове «' + word.text + '» её нет. Поставь другую.');
      return;
    }
    const free = placed.indexOf(null);
    if (free === -1) return;
    placed[free] = tile;
    tile.used = true;
    buzz(12);
    say('');
    draw();
    check();
  });
  draw();
}
function assemblerHTML(word, hintText) {
  return `<div class="assembler">
    <div class="art" style="background:var(--artifact);border:1px solid var(--line);border-radius:var(--r-md);padding:12px;display:grid;place-items:center">
      <img src="${ART(word.image)}" alt="${esc(word.hint)}" style="width:min(210px,64vw);aspect-ratio:1;object-fit:contain"
           onerror="this.replaceWith(Object.assign(document.createElement('div'),{textContent:'${esc(word.emoji)}',style:'font-size:56px'}))"/>
    </div>
    <p class="muted center">Собери слово-подпись к картинке. Лишние буквы — шпионы, они не встают на место.</p>
    <div class="slots"></div>
    <div class="tiles"></div>
    <p class="small center assembler-note">${esc(hintText || '')}</p>
  </div>`;
}

/* ── Экран: хаб ──────────────────────────────────────────────────────────── */
const MENU = [
  { id: 'journey', emoji: '🗺️', title: 'Путешествие БУКа', sub: 'Карта 16 станций: тема = станция (М1 + М5)' },
  { id: 'album', emoji: '📖', title: 'Книга слов', sub: 'Альбом наклеек: слово освоено — вклеено (М2)' },
  { id: 'workshop', emoji: '🔨', title: 'Мастерская слова', sub: 'Свободная сборка: буквы-шпионы, без оценки (М5)' },
  { id: 'drum', emoji: '🥁', title: 'Слоговый барабан', sub: 'Постучи по слогам, потом собери слово (М6)' },
  { id: 'note', emoji: '✉️', title: 'Записка БУКа', sub: 'Найди и почини ошибки робота в письме (М8)' },
];
function screenHub() {
  app.innerHTML = `
    <div class="hero">
      ${buk(112, S.unlocked.length ? 'happy' : 'idle')}
      <div class="hero-text">
        <h1>Слово-квест</h1>
        <p class="muted">Три настоящие игры и пять механик-разборов — на словах
        и картинках приложения. Потыкай и скажи, что берём в работу.</p>
      </div>
    </div>
    <div class="stat-row">
      <span class="chip">🎲 ${S.brd.pos}/16 в бродилке</span>
      <span class="chip">🐛 ${S.snake.games} ${plural(S.snake.games, 'слово', 'слова', 'слов')} съедено</span>
      <span class="chip">🕵️ ${S.hunt.rounds} ${plural(S.hunt.rounds, 'раунд', 'раунда', 'раундов')}</span>
      <span class="chip ok">📖 ${S.unlocked.length}/94 наклеек</span>
      <span class="chip gem">💎 ${S.gems}</span>
    </div>
    <h2>🎮 Игры</h2>
    <div class="menu">
      ${GAMES.map((m) => `<button class="menu-card game" id="game-${m.id}" data-game="${m.id}">
        <span class="emoji">${m.emoji}</span>
        <span class="grow"><b>${m.title}</b><span>${m.sub}</span></span>
        <span class="go">›</span>
      </button>`).join('')}
    </div>
    <h2 style="margin-top:24px">🧩 Механики: разбор</h2>
    <div class="menu">
      ${MENU.map((m) => `<button class="menu-card" id="menu-${m.id}" data-mech="${m.id}">
        <span class="emoji">${m.emoji}</span>
        <span class="grow"><b>${m.title}</b><span>${m.sub}</span></span>
        <span class="go">›</span>
      </button>`).join('')}
    </div>
    <div class="card" style="margin-top:20px">
      <h3>Это прототип, а не приложение</h3>
      <p class="muted">Данные — из настоящего контент-пака (94 слова, 16 тем, картинки
      <code>public/words/</code>). Прогресс хранится отдельно от профиля ребёнка.</p>
      <div class="row row-wrap">
        <button class="btn small soft" id="demo">Насыпать демо-прогресс</button>
        <button class="btn small ghost" id="reset">Сбросить</button>
      </div>
    </div>`;
  MENU.forEach((m) => {
    document.getElementById('menu-' + m.id).addEventListener('click', () => go(m.id));
  });
  GAMES.forEach((m) => {
    document.getElementById('game-' + m.id).addEventListener('click', () => go(m.id));
  });
  document.getElementById('demo').addEventListener('click', () => {
    seedDemo();
    toast('Готово: часть слов открыта, 4 станции пройдены');
    render();
  });
  document.getElementById('reset').addEventListener('click', () => {
    S = blank();
    save();
    toast('Прототип сброшен');
    render();
  });
}

/* ── Экран: путешествие (М1) ─────────────────────────────────────────────── */
function screenJourney() {
  const idx = currentLessonIndex();
  app.innerHTML = `
    <button class="back" data-back>‹ В меню</button>
    <h1>Путешествие БУКа</h1>
    <p class="muted">Станция — это урок. Открывает её собранное слово темы.
    После каждой четвёртой станции — привал.</p>
    <div class="map-wrap">
      <div class="map" id="map">
        ${ALL_LESSONS.map((lesson, i) => {
          const done = S.stations.includes(lesson.id);
          const unlocked = i === 0 || S.stations.includes(ALL_LESSONS[i - 1].id);
          const current = !done && unlocked;
          const count = themeWords(lesson.id).filter((w) => isUnlocked(w.id)).length;
          const privalAfter = (i + 1) % 4 === 0;
          return `${privalAfter && done ? `<div class="prival">🏕️ Привал: ${esc(privalTitle(i))}</div>` : ''}
          <button class="station${done ? ' done' : ''}${current ? ' current' : ''}${!unlocked ? ' locked' : ''}"
                  data-station="${lesson.id}" data-index="${i}">
            <span class="pin">${done ? '⭐' : unlocked ? lesson.emoji : '☁️'}</span>
            <span class="grow">
              <b>${esc(lesson.title)}</b>
              <span>${done ? `собрано ${count} ${plural(count, 'слово', 'слова', 'слов')}` : unlocked ? 'станцию можно открыть' : 'облако, придёт время'}</span>
            </span>
          </button>`;
        }).join('')}
      </div>
    </div>`;
  const cur = app.querySelector('.station.current');
  if (cur) {
    const walker = document.createElement('div');
    walker.className = 'buk-walk';
    walker.innerHTML = buk(48, 'idle');
    app.querySelector('.map-wrap').appendChild(walker);
    const top = cur.offsetTop + 6;
    walker.style.top = top + 'px';
  }
  app.querySelector('[data-back]').addEventListener('click', () => go('hub'));
  app.querySelectorAll('[data-station]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const lesson = LESSON_BY_ID[btn.dataset.station];
      const i = +btn.dataset.index;
      if (S.stations.includes(lesson.id)) { go('album', lesson.id); return; }
      if (i > 0 && !S.stations.includes(ALL_LESSONS[i - 1].id)) {
        toast('Сначала пройди предыдущую станцию');
        return;
      }
      startStation(lesson, i);
    });
  });
}
function privalTitle(i) {
  return ['у ручья', 'на опушке', 'у старой мельницы', 'на вершине'][Math.floor(i / 4)] || 'привал';
}
function startStation(lesson, i) {
  const words = themeWords(lesson.id);
  const candidates = words.filter((w) => !isUnlocked(w.id) && !w.text.includes(' ') && w.text.length <= 8);
  const word = pick(candidates.length ? candidates : words.filter((w) => !w.text.includes(' ') && w.text.length <= 8)) || words[0];
  openSheet(`
    <div class="row spread">
      <span class="chip">${lesson.emoji} Станция «${esc(lesson.title)}»</span>
      <span class="chip gem">💎 +5</span>
    </div>
    ${bukBubble('think', 'Собери слово — и станция твоя.')}
    ${assemblerHTML(word, 'Подсказку можно не брать — ошибиться тут нельзя.')}`,
    (host) => {
      makeAssembler(host.querySelector('.assembler'), word, () => {
        if (!S.stations.includes(lesson.id)) S.stations.push(lesson.id);
        unlock(word.id);
        save();
        confetti();
        const prival = (i + 1) % 4 === 0;
        openSheet(`
          <div class="center">${buk(120, 'excited')}</div>
          <h2 class="center">Станция «${esc(lesson.title)}» открыта!</h2>
          <p class="center muted">Слово «${esc(word.text)}» вклеено в книгу слов.
          ${prival ? 'А впереди — привал.' : 'БУК идёт дальше.'}</p>
          ${prival ? privalHTML(i) : ''}`,
          (h) => {
            h.appendChild(makeButton('Дальше', 'btn', () => { closeSheet(); render(); }));
            if (prival) {
              h.querySelectorAll('[data-prival]').forEach((b) => b.addEventListener('click', () => {
                S.prival[i] = b.dataset.prival;
                save();
                toast(b.dataset.prival === 'river' ? 'Палатка у воды: слышно, как журчит ручей' : 'Костёр на пригорке: видно всю долину');
                closeSheet();
                render();
              }));
            }
          });
      });
    });
}
function privalHTML(i) {
  const title = privalTitle(i);
  return `<div class="card" style="box-shadow:none;background:var(--orange-soft)">
    <h3>🏕️ Привал ${esc(title)}</h3>
    <p class="muted">Куда поставим лагерь?</p>
    <div class="stack">
      <button class="btn soft" data-prival="river">У реки — будем слушать воду</button>
      <button class="btn soft" data-prival="hill">На холме — видно всю долину</button>
    </div>
  </div>`;
}
function makeButton(text, cls, onClick) {
  const b = document.createElement('button');
  b.className = cls;
  b.style.width = '100%';
  b.textContent = text;
  b.addEventListener('click', onClick);
  return b;
}

/* ── Экран: книга слов (М2) ──────────────────────────────────────────────── */
let albumTheme = ALL_LESSONS[0].id;
function screenAlbum(themeId) {
  if (themeId) albumTheme = themeId;
  const lesson = LESSON_BY_ID[albumTheme] || ALL_LESSONS[0];
  const words = themeWords(lesson.id);
  const done = words.filter((w) => isUnlocked(w.id)).length;
  app.innerHTML = `
    <button class="back" data-back>‹ В меню</button>
    <h1>Книга слов</h1>
    <p class="muted">Страница — тема урока. Наклейка появляется, когда слово собрано
    в путешествии, мастерской или письме. Обратно наклейка не отклеивается.</p>
    <div class="tabs">
      ${ALL_LESSONS.map((l) => `<button class="tab${l.id === lesson.id ? ' active' : ''}" data-tab="${l.id}">
        ${l.emoji} ${esc(l.title)} ${themeWords(l.id).filter((w) => isUnlocked(w.id)).length ? '·' : ''}</button>`).join('')}
    </div>
    <div class="row spread" style="margin-bottom:12px">
      <b>${esc(lesson.title)}</b>
      <span class="chip ok">${done}/${words.length} ${plural(words.length, 'слово', 'слова', 'слов')}</span>
    </div>
    <div class="album">
      ${words.map((w) => isUnlocked(w.id)
        ? `<button class="sticker" data-open="${w.id}" title="${esc(w.text)}">
             <img src="${ART(w.image)}" alt="${esc(w.text)}" onerror="this.replaceWith(Object.assign(document.createElement('div'),{textContent:'${esc(w.emoji)}',style:'font-size:34px'}))"/>
             <span class="w">${esc(w.text)}</span>
           </button>`
        : `<button class="sticker locked" data-locked="${w.id}">
             <span class="q">?</span><span class="small">собери</span>
           </button>`).join('')}
    </div>`;
  app.querySelector('[data-back]').addEventListener('click', () => go('hub'));
  app.querySelectorAll('[data-tab]').forEach((t) => t.addEventListener('click', () => {
    albumTheme = t.dataset.tab;
    render();
  }));
  app.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => openWordCard(WORD_BY_ID[b.dataset.open])));
  app.querySelectorAll('[data-locked]').forEach((b) => b.addEventListener('click', () => {
    const w = WORD_BY_ID[b.dataset.locked];
    toast('Слово «' + w.text + '» откроется, когда соберёшь его: ' + w.hint);
  }));
}

/* ── Экран: мастерская (М5, свободная игра) ──────────────────────────────── */
let workshopWord = null;
function nextWorkshopWord() {
  const pool = assemblerWords().filter((w) => !isUnlocked(w.id));
  workshopWord = pick(pool.length ? pool : assemblerWords());
}
function screenWorkshop() {
  if (!workshopWord) nextWorkshopWord();
  const word = workshopWord;
  app.innerHTML = `
    <button class="back" data-back>‹ В меню</button>
    <h1>Мастерская слова</h1>
    <p class="muted">Здесь нельзя проиграть: ошибка — это просто буква, которая не встала
    на место. Собранные слова уходят в книгу слов.</p>
    ${bukBubble('idle', 'Собери слово-подпись к картинке.')}
    ${assemblerHTML(word, 'Собранных в мастерской: ' + S.built)}`;
  app.querySelector('[data-back]').addEventListener('click', () => go('hub'));
  const host = app.querySelector('.assembler');
  makeAssembler(host, word, () => {
    unlock(word.id);
    S.built += 1;
    save();
    confetti();
    const again = document.createElement('div');
    again.className = 'stack';
    again.style.marginTop = '16px';
    again.innerHTML = `<div class="mnemonic">${word.mnemonic ? '💡 ' + esc(word.mnemonic) : '📌 ' + esc(word.hint)}</div>`;
    again.appendChild(makeButton('Ещё слово', 'btn', () => { nextWorkshopWord(); render(); }));
    host.appendChild(again);
    host.querySelector('.assembler-note').textContent = 'Слово «' + word.text + '» вклеено в книгу 📖';
  });
}

/* ── Экран: слоговый барабан (М6) ────────────────────────────────────────── */
function drumWords() {
  return ALL_WORDS.filter((w) => !w.text.includes(' ') && w.syllables.length >= 2 && w.text.length <= 9);
}
function screenDrum() {
  const word = pick(drumWords());
  let phase = 'rhythm';
  let step = 0;
  let timer = null;
  let chipOrder = [];

  app.innerHTML = `
    <button class="back" data-back>‹ В меню</button>
    <h1>Слоговый барабан</h1>
    <p class="muted">Слово проговаривают по слогам. Стучи в такт по плитам — потом слоги
    спрячутся, и надо собрать слово.</p>
    <div class="card">
      <div class="metronome" id="metro"></div>
      <h2 class="center" id="drum-title">Постучи по слогам: ${esc(word.syllables.join('·'))}</h2>
      <div class="pads" id="pads">
        ${word.syllables.map((s, i) => `<button class="pad" data-pad="${i}">${esc(s)}</button>`).join('')}
      </div>
      <p class="small center" id="drum-note">Слушай пульс и стучи по порядку: слева направо.</p>
    </div>`;

  const pads = [...app.querySelectorAll('.pad')];
  const metro = app.querySelector('#metro');
  const title = app.querySelector('#drum-title');
  const note = app.querySelector('#drum-note');

  function stopBeat() { clearInterval(timer); timer = null; }
  function beatCycle() {
    if (phase !== 'rhythm') return;
    pads.forEach((p, i) => p.classList.toggle('beat', i === step));
    metro.classList.add('tick');
    setTimeout(() => metro.classList.remove('tick'), 120);
  }
  beatCycle();
  timer = setInterval(beatCycle, 700);

  pads.forEach((pad) => pad.addEventListener('click', () => {
    const i = +pad.dataset.pad;
    if (phase === 'rhythm') {
      if (i === step) {
        pad.classList.add('hit');
        pad.classList.remove('beat');
        buzz(18);
        step += 1;
        if (step >= pads.length) {
          stopBeat();
          phase = 'build';
          buzz([20, 50, 20]);
          phase2();
        } else {
          note.textContent = 'Есть! Дальше — «' + word.syllables[step] + '».';
        }
      } else {
        pad.classList.add('wrong');
        buzz([0, 30, 50]);
        note.textContent = 'Не спеши: стучим слева направо, по очереди.';
        setTimeout(() => pad.classList.remove('wrong'), 420);
      }
      return;
    }
    // Фаза 2: сборка слова из слогов
    const chip = chipOrder[i];
    if (!chip) return;
    if (word.syllables[step] === chip) {
      pad.classList.add('hit');
      pad.textContent = chip;
      buzz(18);
      step += 1;
      if (step >= word.syllables.length) {
        unlock(word.id);
        save();
        confetti();
        title.innerHTML = 'Слово собрано!';
        note.innerHTML = 'Теперь посмотри на опасное место: <b style="color:var(--red)">' + esc(displayDanger(word)) + '</b>';
        const wrap = document.createElement('div');
        wrap.className = 'stack';
        wrap.style.marginTop = '12px';
        wrap.innerHTML = `${lettersHTML(word)}
          <div class="mnemonic">${word.mnemonic ? '💡 ' + esc(word.mnemonic) : '📌 ' + esc(word.hint)}</div>`;
        wrap.appendChild(makeButton('Ещё слово', 'btn', () => render()));
        app.querySelector('.card').appendChild(wrap);
      }
      return;
    }
    pad.classList.add('wrong');
    buzz(50);
    setTimeout(() => pad.classList.remove('wrong'), 420);
    note.textContent = 'Первым шёл «' + word.syllables[0] + '», посмотри внимательно.';
  }));

  function phase2() {
    chipOrder = shuffle(word.syllables);
    title.textContent = 'Слоги перепутались — собери слово';
    note.textContent = 'Нажимай слоги в правильном порядке.';
    pads.forEach((p, i) => {
      p.classList.remove('hit', 'beat', 'wrong');
      p.textContent = chipOrder[i];
    });
    step = 0;
  }
  function displayDanger(w) {
    return [...w.text].filter((ch, i) => w.danger.includes(i)).join(' ');
  }
  app.querySelector('[data-back]').addEventListener('click', () => { stopBeat(); go('hub'); });
}

/* ── Экран: записка БУКа (М8) ────────────────────────────────────────────── */
const NOTES = [
  {
    id: 'n1',
    title: 'Письмо 1. На лугу',
    parts: [
      { t: 'Привет, дружище! Утром я видел, как ' },
      { bug: { wrong: 'карова', right: 'корова', why: 'корОва — два О', opts: ['карова', 'корова', 'карово'] } },
      { t: ' паслась на лугу. Она дала молоко к завтраку.' },
    ],
  },
  {
    id: 'n2',
    title: 'Письмо 2. Собираюсь в школу',
    parts: [
      { t: 'Я сложил в портфель тетрадь, пенал и учебник ' },
      { bug: { wrong: 'руского', right: 'русского', why: 'рУсский — две С', opts: ['руского', 'русского', 'русскова'] } },
      { t: ' языка. Проверь меня, пожалуйста!' },
    ],
  },
  {
    id: 'n3',
    title: 'Письмо 3. Планы на выходные',
    parts: [
      { t: 'Завтра у нас ' },
      { bug: { wrong: 'субота', right: 'суббота', why: 'суббОта — две Б', opts: ['субота', 'суббота', 'суботаа'] } },
      { t: ', а потом я поеду в ' },
      { bug: { wrong: 'Маскву', right: 'Москву', why: 'МосквА — пишем О', opts: ['Маскву', 'Москву', 'Маскво'] } },
      { t: ' к бабушке. Там меня ждёт настоящий ' },
      { bug: { wrong: 'каньки', right: 'коньки', why: 'кОньки — пишем О', opts: ['каньки', 'коньки', 'конька'] } },
      { t: ' и горка!' },
    ],
  },
];
function screenNote() {
  const note = NOTES[Math.min(S.notes, NOTES.length - 1)];
  const openBugs = new Set();
  let fixed = 0;
  app.innerHTML = `
    <button class="back" data-back>‹ В меню</button>
    <h1>Записка БУКа</h1>
    <p class="muted">БУК пишет письма и ошибается. Найди слово с ошибкой и почини его —
    каждое найденное слово отправляется в книгу слов.</p>
    ${bukBubble('think', 'Кажется, я что-то перепутал… Проверишь?')}
    <div class="row spread" style="margin-bottom:12px">
      <b>${esc(note.title)}</b>
      <span class="chip ok" id="note-progress">найдено: 0</span>
    </div>
    <div class="note" id="note-text"></div>`;

  const noteEl = app.querySelector('#note-text');
  const progressEl = app.querySelector('#note-progress');
  const bugsTotal = note.parts.filter((p) => p.bug).length;

  function draw() {
    noteEl.innerHTML = note.parts.map((p) => {
      if (p.t) return esc(p.t);
      const done = openBugs.has(p.bug.right);
      return `<button class="word${done ? ' fixed' : ''}" data-bug="${esc(p.bug.right)}">${esc(done ? p.bug.right : p.bug.wrong)}</button>`;
    }).join('');
    progressEl.textContent = 'найдено: ' + fixed;
    noteEl.querySelectorAll('[data-bug]').forEach((b) => b.addEventListener('click', () => {
      const part = note.parts.find((p) => p.bug && p.bug.right === b.dataset.bug);
      if (openBugs.has(part.bug.right)) return;
      b.classList.add('found');
      openFix(part.bug);
    }));
  }
  function openFix(bug) {
    openSheet(`<h2 class="center">Как правильно?</h2>
      <p class="center muted">БУК написал «${esc(bug.wrong)}».</p>
      <div class="stack">
        ${shuffle(bug.opts).map((o) => `<button class="btn soft" data-opt="${esc(o)}">${esc(o)}</button>`).join('')}
      </div>`,
      (host) => {
        host.querySelectorAll('[data-opt]').forEach((b) => b.addEventListener('click', () => {
          if (b.dataset.opt !== bug.right) {
            b.classList.add('shake');
            buzz([0, 30, 50]);
            toast('Почти: ' + bug.why);
            return;
          }
          closeSheet();
          openBugs.add(bug.right);
          fixed += 1;
          const word = ALL_WORDS.find((w) => w.text.toLowerCase() === bug.right.toLowerCase());
          if (word) unlock(word.id);
          buzz(20);
          draw();
          if (fixed >= bugsTotal) finish();
        }));
      });
  }
  function finish() {
    S.notes = Math.max(S.notes, NOTES.indexOf(note) + 1);
    save();
    confetti();
    setTimeout(() => {
      openSheet(`<div class="center">${buk(120, 'excited')}</div>
        <h2 class="center">Спасибо, сыщик!</h2>
        <p class="center muted">БУК исправил все слова, а исправленные поселились в книге слов.</p>`,
        (h) => {
          h.appendChild(makeButton(S.notes < NOTES.length ? 'Прочитать следующее письмо' : 'В меню', 'btn', () => { closeSheet(); render(); }));
        });
    }, 500);
  }
  app.querySelector('[data-back]').addEventListener('click', () => go('hub'));
  draw();
}

/* ══ ИГРЫ ═══════════════════════════════════════════════════════════════════
   Три настоящих игры: кубик-бродилка, змейка-буквоед и охота за ошибками.
   Общие правила серии:
     • проиграть нельзя: нет жизней, нет провала, нет таймера на реакцию;
     • ошибка стоит попытку, а не прогресс (сказали «попробуй ещё» — и играем);
     • слова, картинки и «опасные места» — из настоящего контент-пака;
     • всё офлайн, без аудио и без сети;
     • у каждой игры есть цель, счёт и экран победы с кнопкой «ещё раз».
   win() каждой игры вклеивает слово в «Книгу слов» — игры и учёба связаны. */

const GAMES = [
  { id: 'brd', emoji: '🎲', title: 'Бродилка БУКа', sub: 'Кубик, 16 станций и привалы: дойди до конца маршрута' },
  { id: 'snake', emoji: '🐛', title: 'Буквоед', sub: 'Съешь буквы слова по порядку и не тронь шпионов' },
  { id: 'hunt', emoji: '🕵️', title: 'Сыщик слов', sub: 'На доске робота найди все слова с ошибкой' },
];

/** Отладочные хуки: ими пользуется npm run proto:check, чтобы играть без ожиданий. */
const protoGames = { state: () => S };
if (typeof window !== 'undefined') window.__protoGame = protoGames;

/* ── Игра 1. Бродилка БУКа (кубик + 16 станций) ───────────────────────────── */
function screenBrd() {
  const cells = ALL_LESSONS.map((l, i) => ({ lesson: l, prival: (i + 1) % 4 === 0 }));
  const pos = Math.min(S.brd.pos, cells.length);
  const finished = pos >= cells.length;

  app.innerHTML = `
    <button class="back" data-back>‹ К играм</button>
    <h1>🎲 Бродилка БУКа</h1>
    <p class="muted">Бросай кубик, шагай по станциям и собирай их. Проиграть нельзя:
    кубик всегда ведёт вперёд, а станция ждёт, сколько нужно.</p>
    <div class="card brd-panel">
      <div class="row spread">
        <span class="chip">🚩 ${pos}/${cells.length} пройдено</span>
        <span class="chip gem">💎 ${S.brd.gems}</span>
      </div>
      <div class="brd-dice-row">
        <div class="dice" id="dice" aria-label="кубик"><div class="pip"></div><div class="pip"></div><div class="pip"></div><div class="pip"></div><div class="pip"></div><div class="pip"></div><div class="pip"></div><div class="pip"></div><div class="pip"></div></div>
        <button class="btn" id="roll" ${finished ? 'disabled' : ''}>${finished ? 'Маршрут пройден' : 'Бросить кубик'}</button>
      </div>
      <p class="small center" id="brd-note">${finished ? 'Ты дошёл до конца карты!' : 'Кубик даёт 1–3 шага. На привале — отдых и кристаллы.'}</p>
    </div>
    <div class="brd-board" id="brd-board">
      ${cells.map((c, i) => `<div class="brd-cell${i < pos ? ' passed' : ''}${c.prival ? ' prival-cell' : ''}" data-cell="${i}">
        <span class="idx">${i + 1}</span>
        <span class="emoji">${c.prival ? '🏕️' : c.lesson.emoji}</span>
        <span class="grow"><b>${c.prival ? 'Привал ' + esc(privalTitle(i)) : esc(c.lesson.title)}</b>
        <span>${c.prival ? 'отдых и +2 💎' : S.brd.claimed.includes(c.lesson.id) ? 'станция твоя' : 'станция ждёт'}</span></span>
        ${S.brd.claimed.includes(c.lesson.id) ? '<span class="chip ok">✔</span>' : ''}
      </div>`).join('')}
      <div class="brd-token" id="brd-token">${buk(40, 'idle')}</div>
    </div>`;

  const board = app.querySelector('#brd-board');
  const token = app.querySelector('#brd-token');
  const dice = app.querySelector('#dice');
  const pips = [...dice.querySelectorAll('.pip')];
  const note = app.querySelector('#brd-note');
  const rollBtn = app.querySelector('#roll');

  function placeToken(i) {
    const cell = board.querySelector(`[data-cell="${Math.min(i, cells.length - 1)}"]`);
    if (cell) token.style.top = (cell.offsetTop + 6) + 'px';
  }
  placeToken(pos);

  const DICE_PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8] };
  function showDice(v) {
    pips.forEach((p, i) => p.classList.toggle('on', DICE_PIPS[v].includes(i)));
  }
  showDice(3);

  app.querySelector('[data-back]').addEventListener('click', () => go('hub'));

  function hop(from, to, fast, done) {
    if (from >= to) { done(); return; }
    const step = () => {
      S.brd.pos = from + 1;
      placeToken(S.brd.pos);
      if (from + 1 >= to) { save(); done(); return; }
      setTimeout(() => hop(from + 1, to, fast, done), fast ? 0 : 200);
    };
    step();
  }

  function resolve() {
    const i = S.brd.pos - 1;
    const cell = cells[i];
    if (!cell) { win(); return; }
    if (cell.prival) {
      S.brd.gems += 2;
      S.gems += 2;
      save();
      note.textContent = '🏕️ Привал ' + privalTitle(i) + ': отдохнули, +2 💎. Бросай кубик дальше!';
      rollBtn.disabled = false;
      toast('Привал: +2 💎');
      return;
    }
    if (S.brd.claimed.includes(cell.lesson.id)) {
      S.brd.gems += 1;
      S.gems += 1;
      save();
      note.textContent = 'Станция «' + cell.lesson.title + '» уже твоя: +1 💎 за визит.';
      rollBtn.disabled = false;
      return;
    }
    openStation(cell.lesson, () => {
      note.textContent = 'Станция взята! Бросай кубик дальше.';
      rollBtn.disabled = false;
    });
  }

  async function roll(forced) {
    if (rollBtn.disabled) return;
    rollBtn.disabled = true;
    const fast = !!forced;
    const value = forced || (1 + Math.floor(Math.random() * 3));
    for (let f = 0; f < 6; f++) {
      showDice(1 + Math.floor(Math.random() * 3));
      if (!fast) await new Promise((r) => setTimeout(r, 90));
    }
    showDice(value);
    note.textContent = value + ' — шагаем! Пусть будет ' + value + ' ' + plural(value, 'шаг', 'шага', 'шагов') + '.';
    const from = S.brd.pos;
    const to = Math.min(from + value, cells.length);
    hop(from, to, fast, () => {
      if (S.brd.pos >= cells.length) win();
      else resolve();
    });
  }

  function win() {
    confetti();
    S.brd.gems += 10;
    S.gems += 10;
    save();
    openSheet(`
      <div class="center">${buk(120, 'dance')}</div>
      <h2 class="center">Маршрут пройден!</h2>
      <p class="center muted">Ты дошёл до последней станции, собрал
      ${S.brd.claimed.length} ${plural(S.brd.claimed.length, 'станцию', 'станции', 'станций')}
      и ${S.brd.gems} 💎 за дорогу (включая +10 за финиш).</p>`,
      (h) => {
        h.appendChild(makeButton('Пройти маршрут заново', 'btn', () => {
          S.brd.pos = 0;
          S.brd.claimed = [];
          save();
          closeSheet();
          render();
        }));
      });
  }

  rollBtn.addEventListener('click', () => roll());
  protoGames.brd = { roll: (n) => roll(n), get pos() { return S.brd.pos; } };
}

/** Станция: собрать слово темы (та же механика, что в «Мастерской»). */
function openStation(lesson, done) {
  const words = themeWords(lesson.id);
  const fresh = words.filter((w) => !isUnlocked(w.id) && !w.text.includes(' ') && w.text.length <= 8);
  const ok = words.filter((w) => !w.text.includes(' ') && w.text.length <= 8);
  const word = pick(fresh.length ? fresh : ok) || words[0];
  openSheet(`
    <div class="row spread">
      <span class="chip">${lesson.emoji} Станция «${esc(lesson.title)}»</span>
      <span class="chip gem">💎 +5</span>
    </div>
    ${bukBubble('think', 'Собери слово — и станция твоя.')}
    ${assemblerHTML(word, 'Ошибиться нельзя: буквы просто ищут своё место.')}`,
    (host) => {
      makeAssembler(host.querySelector('.assembler'), word, () => {
        if (!S.brd.claimed.includes(lesson.id)) S.brd.claimed.push(lesson.id);
        S.brd.gems += 5;
        S.gems += 5;
        unlock(word.id);
        save();
        confetti();
        openSheet(`<div class="center">${buk(110, 'excited')}</div>
          <h2 class="center">Станция «${esc(lesson.title)}» взята!</h2>
          <p class="center muted">Слово «${esc(word.text)}» вклеено в книгу слов и принесло +5 💎.</p>`,
          (h) => h.appendChild(makeButton('К кубику', 'btn', () => { closeSheet(); render(); })),
          () => { if (done) done(); });
      });
    },
    // закрыл шторку, не собрав слово — это не тупик: кубик снова доступен
    () => { if (done) done(); });
}

/* ── Игра 2. Буквоед (змейка, буквы по порядку) ───────────────────────────── */
const SNAKE_COLS = 7;
const SNAKE_ROWS = 9;
function snakePool() {
  return assemblerWords().filter((w) => [...w.text].every((c) => c.length === 1));
}
function screenSnake() {
  const fresh = snakePool().filter((w) => !isUnlocked(w.id));
  const word = pick(fresh.length ? fresh : snakePool());
  const target = [...word.text];
  const mid = Math.floor(SNAKE_ROWS / 2);

  let dir = { x: 1, y: 0 };
  let snake = [{ x: 2, y: mid }, { x: 1, y: mid }];
  let eaten = 0;
  let foods = [];
  let timer = null;
  let over = false;

  app.innerHTML = `
    <button class="back" data-back>‹ К играм</button>
    <h1>🐛 Буквоед</h1>
    <p class="muted">Буквоед растёт, когда ест буквы слова <b>по порядку</b>. Шпионы
    (лишние буквы) ему не нравятся — они только пшикают. Проиграть нельзя.</p>
    <div class="card">
      <div class="row spread" style="margin-bottom:8px">
        <span class="chip" id="snake-target">ищи: ${esc(target[0])}</span>
        <span class="chip ok" id="snake-score">съедено: 0/${target.length}</span>
        <span class="chip">🐛 ${S.snake.games} ${plural(S.snake.games, 'слово', 'слова', 'слов')}</span>
      </div>
      <div class="words-strip" id="snake-word">${stripHTML('', target)}</div>
      <div class="snake-board" id="snake-board"></div>
      <div class="dpad">
        <button class="dbtn up" data-dir="up">▲</button>
        <button class="dbtn left" data-dir="left">◀</button>
        <button class="dbtn down" data-dir="down">▼</button>
        <button class="dbtn right" data-dir="right">▶</button>
      </div>
      <p class="small center" id="snake-note">Можно рулить кнопками, стрелками на клавиатуре или свайпом по полю.</p>
    </div>`;

  const board = app.querySelector('#snake-board');
  const note = app.querySelector('#snake-note');
  const cells = [];
  for (let y = 0; y < SNAKE_ROWS; y++) {
    for (let x = 0; x < SNAKE_COLS; x++) {
      const cell = document.createElement('div');
      cell.className = 'scell';
      cell.dataset.x = x;
      cell.dataset.y = y;
      board.appendChild(cell);
      cells[y * SNAKE_COLS + x] = cell;
    }
  }

  function freeCell() {
    const taken = new Set([...snake.map((c) => c.x + ',' + c.y), ...foods.map((f) => f.x + ',' + f.y)]);
    const free = [];
    for (let y = 0; y < SNAKE_ROWS; y++) {
      for (let x = 0; x < SNAKE_COLS; x++) if (!taken.has(x + ',' + y)) free.push({ x, y });
    }
    return free.length ? pick(free) : { x: 0, y: 0 };
  }
  function spyCount() { return Math.min(4, 2 + Math.floor(eaten / 2)); }
  function spawnLetter() {
    const cell = freeCell();
    foods.push({ ...cell, ch: target[eaten], spy: false });
  }
  function ensureSpies() {
    const spies = foods.filter((f) => f.spy);
    const need = spyCount() - spies.length;
    const forbidden = new Set(target.map((c) => c.toLowerCase()));
    for (let i = 0; i < need; i++) {
      const pool = pickSpies(word, 4).filter((c) => !forbidden.has(c.toLowerCase()));
      const ch = pool.length ? pick(pool) : pick(['а', 'о', 'е', 'с']);
      foods.push({ ...freeCell(), ch, spy: true });
    }
  }
  function draw() {
    cells.forEach((c) => { c.className = 'scell'; c.textContent = ''; });
    foods.forEach((f) => {
      const c = cells[f.y * SNAKE_COLS + f.x];
      if (c) { c.classList.add('food'); c.textContent = f.ch; }
    });
    snake.forEach((s, i) => {
      const c = cells[s.y * SNAKE_COLS + s.x];
      if (c) { c.classList.add('snake'); if (i === 0) c.classList.add('head'); }
    });
  }
  function strip() {
    app.querySelector('#snake-word').innerHTML = stripHTML(target.slice(0, eaten).join(''), target, word);
    app.querySelector('#snake-target').textContent = eaten < target.length ? 'ищи: ' + target[eaten] : 'слово собрано!';
    app.querySelector('#snake-score').textContent = `съедено: ${eaten}/${target.length}`;
  }
  function setDir(d) {
    const map = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
    const nd = map[d];
    if (!nd) return;
    if (nd.x === -dir.x && nd.y === -dir.y) return; // назад нельзя: змейка не кусает себя
    dir = nd;
  }
  function tick() {
    if (over) return;
    const head = snake[0];
    const nx = (head.x + dir.x + SNAKE_COLS) % SNAKE_COLS;
    const ny = (head.y + dir.y + SNAKE_ROWS) % SNAKE_ROWS;
    const fi = foods.findIndex((f) => f.x === nx && f.y === ny);
    let grow = false;
    if (fi >= 0) {
      const f = foods[fi];
      if (!f.spy && f.ch === target[eaten]) {
        eaten += 1;
        grow = true;
        buzz(18);
        foods.splice(fi, 1);
        if (eaten < target.length) spawnLetter();
        ensureSpies();
        strip();
        note.textContent = eaten < target.length
          ? 'Есть! Теперь ищи «' + target[eaten] + '». Ты стал длиннее на одну букву.'
          : 'Все буквы на месте!';
        if (eaten >= target.length) { draw(); return win(); }
      } else {
        buzz([0, 30, 50]);
        foods.splice(fi, 1);
        foods.push({ ...freeCell(), ch: f.ch, spy: f.spy });
        note.textContent = f.spy
          ? 'Шпион! Буквы «' + f.ch + '» в слове «' + word.text + '» нет — она убежала на другое место.'
          : 'Это буква из другого места слова. Нужна «' + target[eaten] + '».';
      }
    }
    snake.unshift({ x: nx, y: ny });
    if (!grow) snake.pop();
    draw();
  }
  function win() {
    over = true;
    clearInterval(timer);
    unlock(word.id);
    S.snake.games += 1;
    S.gems += 5;
    save();
    confetti();
    setTimeout(() => openSheet(`
      <div class="center">${buk(110, 'happy')}</div>
      <h2 class="center">Слово съедено целиком!</h2>
      ${lettersHTML(word)}
      <div class="mnemonic" style="margin-top:12px">${word.mnemonic ? '💡 ' + esc(word.mnemonic) : '📌 ' + esc(word.hint)}</div>
      <p class="center small" style="margin-top:8px">+5 💎, а слово ушло в книгу слов.</p>`,
      (h) => h.appendChild(makeButton('Ещё слово', 'btn', () => { closeSheet(); render(); }))), 400);
  }

  spawnLetter();
  ensureSpies();
  draw();
  strip();
  timer = setInterval(tick, 420);
  onCleanup(() => clearInterval(timer));

  app.querySelectorAll('[data-dir]').forEach((b) => b.addEventListener('click', () => setDir(b.dataset.dir)));
  const onKey = (e) => {
    const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    if (map[e.key]) { setDir(map[e.key]); e.preventDefault(); }
  };
  window.addEventListener('keydown', onKey);
  onCleanup(() => window.removeEventListener('keydown', onKey));

  let touch = null;
  board.addEventListener('touchstart', (e) => { touch = e.touches[0]; }, { passive: true });
  board.addEventListener('touchend', (e) => {
    if (!touch) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.clientX;
    const dy = t.clientY - touch.clientY;
    if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? 'right' : 'left');
    else setDir(dy > 0 ? 'down' : 'up');
    touch = null;
  });
  app.querySelector('[data-back]').addEventListener('click', () => go('hub'));

  protoGames.snake = {
    tick,
    setDir,
    place(x, y) { snake = [{ x, y }, { x: Math.max(0, x - 1), y }]; draw(); },
    state() { return { eaten, word: word.text, foods: foods.map((f) => ({ ...f })), head: { ...snake[0] } }; },
  };
}
function stripHTML(shown, target, word) {
  return [...target].map((ch, i) => {
    const isDanger = word ? word.danger.includes(i) : false;
    const cls = i < shown.length ? (isDanger ? 'l danger' : 'l') : 'l empty';
    return `<span class="${cls}">${i < shown.length ? esc(ch) : '·'}</span>`;
  }).join('');
}

/* ── Игра 3. Сыщик слов (найди все ошибки робота) ─────────────────────────── */
const HUNT_ROUNDS = [
  { words: 6, wrong: 2, variant: 0 },
  { words: 8, wrong: 3, variant: 0 },
  { words: 8, wrong: 3, variant: 1 },
];
const VOWEL_SWAP = { а: 'о', о: 'а', е: 'и', и: 'е', я: 'е', ё: 'о', ю: 'у', э: 'и', ы: 'и' };
const CONSONANTS = 'бвгджзклмнпрстфхцчшщ';
function swapCase(orig, ch) {
  return orig !== orig.toLowerCase() ? ch.toUpperCase() : ch;
}
/** Правдоподобная ошибка: подмена опасной гласной, лишняя двойная, потерянный «ь». */
function makeWrong(word, variant = 0) {
  const text = word.text;
  const lower = text.toLowerCase();
  const tries = [];
  word.danger.forEach((i) => {
    const ch = lower[i];
    if (VOWEL_SWAP[ch]) tries.push(text.slice(0, i) + swapCase(text[i], VOWEL_SWAP[ch]) + text.slice(i + 1));
  });
  for (let i = 0; i + 1 < lower.length; i++) {
    if (lower[i] === lower[i + 1] && CONSONANTS.includes(lower[i])) {
      tries.push(text.slice(0, i) + text.slice(i + 1));
    }
  }
  const soft = lower.indexOf('ь');
  if (soft > 0) tries.push(text.slice(0, soft) + text.slice(soft + 1));
  for (let i = 0; i < lower.length; i++) {
    if (VOWEL_SWAP[lower[i]] && i !== word.stress) {
      tries.push(text.slice(0, i) + swapCase(text[i], VOWEL_SWAP[lower[i]]) + text.slice(i + 1));
    }
  }
  const real = new Set(ALL_WORDS.map((w) => w.text.toLowerCase()));
  const good = tries.filter((t) => t.toLowerCase() !== lower && !real.has(t.toLowerCase()));
  if (!good.length) return null;
  return good[variant % good.length];
}
function wrongReason(word) {
  if (word.mnemonic) return word.mnemonic;
  const i = word.danger[0];
  const ch = (word.text[i] || '').toLowerCase();
  if (VOWEL_SWAP[ch]) return `в этом слове пишем «${ch}» — это «опасное место»`;
  return 'звук не слышится, а буква пишется — это «опасное место»';
}
function screenHunt() {
  const roundIdx = S.hunt.rounds % HUNT_ROUNDS.length;
  const cfg = HUNT_ROUNDS[roundIdx];
  const theme = ALL_LESSONS[S.hunt.rounds % ALL_LESSONS.length];
  let pool = shuffle(themeWords(theme.id).filter((w) => makeWrong(w, cfg.variant)));
  if (pool.length < cfg.words) {
    pool = pool.concat(shuffle(assemblerWords().filter((w) => makeWrong(w, cfg.variant) && !pool.includes(w))));
  }
  pool = pool.slice(0, cfg.words);
  const wrongIds = new Set(shuffle(pool.map((w) => w.id)).slice(0, Math.min(cfg.wrong, pool.length)));
  const items = pool.map((w) => {
    const isWrong = wrongIds.has(w.id);
    return { word: w, wrong: isWrong, text: isWrong ? makeWrong(w, cfg.variant) : w.text, found: false, checked: false };
  });

  let found = 0;
  let falseAlarms = 0;
  const totalWrong = items.filter((i) => i.wrong).length;

  app.innerHTML = `
    <button class="back" data-back>‹ К играм</button>
    <h1>🕵️ Сыщик слов</h1>
    <p class="muted">Робот-двоечник писал слова и наделал ошибок. Найди и нажми все
    неправильные слова. Ошибиться можно: скажем «тут всё верно» и играем дальше.</p>
    ${bukBubble('think', 'Я проверил, но не всё заметил. Поможешь?')}
    <div class="card">
      <div class="row spread" style="margin-bottom:12px">
        <span class="chip">раунд ${roundIdx + 1}/3 · тема «${esc(theme.title)}»</span>
        <span class="chip ok" id="hunt-progress">ошибок найдено 0/${totalWrong}</span>
      </div>
      <div class="hunt-board" id="hunt-board">
        ${items.map((it, i) => `<button class="plaque" data-item="${i}">${esc(it.text)}</button>`).join('')}
      </div>
      <p class="small center" id="hunt-note">Всего слов: ${items.length}. Ошибок: ${totalWrong}. Нажимай на подозрительные.</p>
    </div>`;

  const board = app.querySelector('#hunt-board');
  const note = app.querySelector('#hunt-note');

  function draw() {
    board.innerHTML = items.map((it, i) => {
      if (it.found) return `<div class="plaque fixed" data-fixed="${i}"><span class="ok-mark">✔</span> ${esc(it.word.text)}
        <span class="why">${esc(wrongReason(it.word))}</span></div>`;
      if (it.checked) return `<div class="plaque checked">${esc(it.text)}<span class="why">написано верно</span></div>`;
      return `<button class="plaque" data-item="${i}">${esc(it.text)}</button>`;
    }).join('') + `
      <div class="hunt-why-box" id="hunt-why">${falseAlarms ? 'Ложных тревог: ' + falseAlarms : 'Ложных тревог пока нет — так держать!'}</div>`;
    app.querySelector('#hunt-progress').textContent = `ошибок найдено ${found}/${totalWrong}`;
    board.querySelectorAll('[data-item]').forEach((b) => b.addEventListener('click', () => tap(+b.dataset.item)));
  }

  function tap(i) {
    const it = items[i];
    if (!it || it.found || it.checked) return;
    if (!it.wrong) {
      it.checked = true;
      falseAlarms += 1;
      buzz([0, 25]);
      note.textContent = 'Здесь всё верно: «' + it.word.text + '» написано правильно. Ищем дальше!';
      draw();
      return;
    }
    it.found = true;
    found += 1;
    buzz(20);
    unlock(it.word.id);
    S.gems += 1;
    note.textContent = 'Поймал! Правильно — «' + it.word.text + '». ' + wrongReason(it.word);
    draw();
    if (found >= totalWrong) finish();
  }

  function finish() {
    const stars = falseAlarms === 0 ? 3 : falseAlarms <= 2 ? 2 : 1;
    S.hunt.rounds += 1;
    S.hunt.false += falseAlarms;
    S.gems += 3 + found;
    const bestKey = stars;
    S.hunt.best = Math.max(S.hunt.best, bestKey);
    save();
    confetti();
    setTimeout(() => openSheet(`
      <div class="center">${buk(110, stars === 3 ? 'dance' : 'happy')}</div>
      <h2 class="center">Смена закрыта: все ошибки найдены!</h2>
      <p class="center" style="font-size:26px">${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}</p>
      <p class="center muted">Нашёл ${found} ${plural(found, 'ошибку', 'ошибки', 'ошибок')},
      ложных тревог — ${falseAlarms}. Награда: ${3 + found} 💎 и ${found}
      ${plural(found, 'наклейка', 'наклейки', 'наклеек')} в книгу слов.</p>`,
      (h) => {
        const again = makeButton(S.hunt.rounds % HUNT_ROUNDS.length === 0 ? 'Новая смена (с раунда 1)' : 'Следующий раунд', 'btn', () => { closeSheet(); render(); });
        h.appendChild(again);
      }), 420);
  }

  app.querySelector('[data-back]').addEventListener('click', () => go('hub'));
  draw();
  protoGames.hunt = {
    state() { return { items: items.map((i) => ({ text: i.text, wrong: i.wrong, found: i.found })), found, falseAlarms }; },
  };
}

/* ── Демо-прогресс и запуск ──────────────────────────────────────────────── */
function seedDemo() {
  const byTheme = {};
  ALL_WORDS.forEach((w) => { (byTheme[w.theme] = byTheme[w.theme] || []).push(w); });
  ALL_LESSONS.slice(0, 4).forEach((l) => {
    if (!S.stations.includes(l.id)) S.stations.push(l.id);
    (byTheme[l.id] || []).slice(0, 4).forEach((w) => { if (!isUnlocked(w.id)) S.unlocked.push(w.id); });
  });
  ALL_WORDS.slice(20, 28).forEach((w) => { if (!isUnlocked(w.id)) S.unlocked.push(w.id); });
  S.notes = Math.max(S.notes, 1);
  S.gems = Math.max(S.gems, 34);
  S.built = Math.max(S.built, 6);
  S.brd.pos = Math.max(S.brd.pos, 5);
  S.brd.claimed = Array.from(new Set([...S.brd.claimed, ...ALL_LESSONS.slice(0, 2).map((l) => l.id)]));
  S.brd.gems = Math.max(S.brd.gems, 14);
  S.snake.games = Math.max(S.snake.games, 3);
  S.hunt.rounds = Math.max(S.hunt.rounds, 1);
  save();
}

let currentScreen = 'hub';
let pendingAlbumTheme = null;
let cleanups = [];
/** Регистрация уборки экрана: таймеры и слушатели не должны жить после ухода. */
function onCleanup(fn) { cleanups.push(fn); }
function go(target, themeId) {
  currentScreen = target;
  if (target === 'album') pendingAlbumTheme = themeId || null;
  render();
}
function render() {
  closeSheet();
  cleanups.forEach((fn) => { try { fn(); } catch (err) { /* ignore */ } });
  cleanups = [];
  if (currentScreen === 'brd') screenBrd();
  else if (currentScreen === 'snake') screenSnake();
  else if (currentScreen === 'hunt') screenHunt();
  else if (currentScreen === 'hub') screenHub();
  else if (currentScreen === 'journey') screenJourney();
  else if (currentScreen === 'album') { screenAlbum(pendingAlbumTheme); pendingAlbumTheme = null; }
  else if (currentScreen === 'workshop') screenWorkshop();
  else if (currentScreen === 'drum') screenDrum();
  else if (currentScreen === 'note') screenNote();
  else { currentScreen = 'hub'; screenHub(); }
  window.scrollTo(0, 0);
}

// стартовое состояние: пустой прототип выглядит сломанным, поэтому показываем
// демо-прогресс (сбросить можно кнопкой в хабе)
if (!S.unlocked.length && !S.stations.length) { seedDemo(); }
render();

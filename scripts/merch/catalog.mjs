// Каталог мерча: единственный источник правды — и для рендеров, и для страницы.
// У каждой позиции: id (имя файла), раздел, название, польза, выкраски, арт.

import { C, mark, lockupV, lockupH, seal, text } from './brand.mjs';
import { tee, hoodie, longSleeve, sweatshirt, polo, cap, beanie, scarf, socks, tote, shade } from './garments.mjs';
import {
  notebook,
  pen,
  pencils,
  bottle,
  mug,
  tumbler,
  backpack,
  umbrella,
  stickerSheet,
  pins,
  patch,
  lanyard,
  phoneCase,
  sleeve,
  deskmat,
  powerbank,
  mouse,
  lunchbox,
  magnet,
} from './objects.mjs';
import { airliner, bus, tram, raceCar, scooter, bike } from './vehicles.mjs';
import { pMark, pLockupV, pLockupH, pSeal, pWord, pCity } from './prints.mjs';

export const SECTIONS = [
  {
    id: 'wear',
    title: 'Одежда',
    lead: 'Один знак, четыре выкраски, печать без радуги: вещь, которую носят не только 1 сентября.',
  },
  {
    id: 'paper',
    title: 'Канцелярия',
    lead: 'То, что стирается за год, но живёт в пенале каждый день.',
  },
  {
    id: 'home',
    title: 'Дом и школа',
    lead: 'Посуда, сумка, зонт: вещи, которые берут в лагерь и на экскурсию.',
  },
  {
    id: 'tech',
    title: 'Техника',
    lead: 'Аксессуары к тому, что уже есть в рюкзаке: чехол, коврик, пауэрбанк.',
  },
  {
    id: 'transport',
    title: 'Техника в ливрее',
    lead: 'Большая идея серии: не наклейка на борту, а полная ливрея — как у авиакомпаний.',
  },
  {
    id: 'textile',
    title: 'Ткани и упаковка',
    lead: 'Узор, упаковка, лента: мерч начинается с пакета, в котором его несут домой.',
  },
];

export const ITEMS = [
  // ───────────────────────────────────────────────────────────── одежда ──
  {
    id: 'tee-classic',
    section: 'wear',
    name: 'Футболка «Классика»',
    sub: 'Знак 22 см на груди, хлопок 190 г/м²',
    tag: 'основа',
    palette: [C.cream, C.white, C.navy, C.graphite],
    art: tee({
      body: C.cream,
      print: (s) => pMark(s, { color: true }),
      printW: 0.4,
      printY: 0.37,
    }),
  },
  {
    id: 'tee-lockup',
    section: 'wear',
    name: 'Футболка «Замок»',
    sub: 'Название школы в одну строку — видно в толпе',
    tag: 'парадная',
    palette: [C.navy, C.white, C.cream],
    art: tee({
      body: C.navy,
      print: (s) => pLockupH(s, { color: C.cream }),
      printW: 0.6,
      printY: 0.34,
    }),
  },
  {
    id: 'tee-back',
    section: 'wear',
    name: 'Футболка «Спина»',
    sub: 'Маленький знак на груди, большая печать на спине',
    palette: [C.white, C.cream, C.blue],
    art: tee({
      body: C.white,
      neck: 'back',
      print: (s) => pLockupV(s, { color: C.navy }),
      printW: 0.3,
      printY: 0.36,
    }),
  },
  {
    id: 'long-1995',
    section: 'wear',
    name: 'Лонгслив «1995»',
    sub: 'Год основания на рукаве, знак на груди',
    palette: [C.white, C.bone, C.navy],
    art: longSleeve({
      body: C.white,
      print: (s) => pMark(s, { color: true }),
      printW: 0.32,
      printY: 0.33,
    }),
  },
  {
    id: 'hoodie-roof',
    section: 'wear',
    name: 'Худи «Крыша»',
    sub: 'Футер 320 г/м², вышивка вместо печати',
    tag: 'вышивка',
    palette: [C.navy, C.graphite, C.cream],
    art: hoodie({
      body: C.navy,
      print: (s) => pMark(s, { color: false, mono: C.cream }),
      printW: 0.26,
      printY: 0.33,
    }),
  },
  {
    id: 'sweatshirt-school',
    section: 'wear',
    name: 'Свитшот «Школа»',
    sub: 'Знак и название, мягкая резинка, унисекс',
    palette: [C.bone, C.cream, C.blue],
    art: sweatshirt({
      body: C.bone,
      print: (s) => pLockupV(s, { color: C.navy }),
      printW: 0.26,
      printY: 0.34,
    }),
  },
  {
    id: 'polo-staff',
    section: 'wear',
    name: 'Поло «Учитель»',
    sub: 'Пике, вышитый знак, воротник-стойка',
    tag: 'для взрослых',
    palette: [C.blue, C.navy, C.white],
    art: polo({
      body: C.blue,
      print: (s) => pMark(s, { color: false, mono: C.cream }),
      printW: 0.13,
    }),
  },
  {
    id: 'cap-roof',
    section: 'wear',
    name: 'Кепка «Крыша»',
    sub: 'Вышивка на шесть панелей, регулируемый ремешок',
    palette: [C.navy, C.cream, C.blue],
    art: cap({
      body: C.navy,
      print: (s) => pMark(s, { color: false, mono: C.cream }),
    }),
  },
  {
    id: 'beanie-winter',
    section: 'wear',
    name: 'Шапка «Зима»',
    sub: 'Двойной акрил, нашивка спереди',
    palette: [C.red, C.navy, C.cream],
    art: beanie({
      body: C.red,
      print: (s) => pMark(s, { color: false, mono: C.cream }),
    }),
  },
  {
    id: 'scarf-stripes',
    section: 'wear',
    name: 'Шарф «Полоса»',
    sub: 'Полоса в цветах букв, бахрома',
    palette: [C.blue, C.red, C.navy],
    art: scarf({
      body: C.blue,
      print: (s) => pMark(s, { color: false, mono: C.cream, rule: false }),
    }),
  },
  {
    id: 'socks-pair',
    section: 'wear',
    name: 'Носки «Пара»',
    sub: 'Две пары в наборе: с полосой и со знаком',
    palette: [C.white, C.cream],
    art: socks({ body: C.white, accent: C.blue }),
  },
  {
    id: 'tote-canvas',
    section: 'wear',
    name: 'Шоппер «Холст»',
    sub: 'Плотный хлопок, внутренний карман, печать на всю сторону',
    tag: 'основа',
    palette: [C.cream, C.navy, C.bone],
    art: tote({
      body: C.cream,
      print: (s) => pLockupV(s, { color: C.navy }),
    }),
  },

  // ───────────────────────────────────────────────────────── канцелярия ──
  {
    id: 'notebook-a5',
    section: 'paper',
    name: 'Блокнот A5',
    sub: 'Твёрдая обложка, резинка, 96 страниц в точку',
    tag: 'основа',
    palette: [C.navy, C.blue, C.red],
    art: notebook({
      body: C.navy,
      print: (s) => pMark(s, { color: false, mono: C.cream }),
    }),
  },
  {
    id: 'pen-gel',
    section: 'paper',
    name: 'Ручка «Синяя»',
    sub: 'Гелевая, 0,5 мм, гравировка на корпусе',
    palette: [C.navy, C.blue, C.graphite],
    art: pen({
      body: C.navy,
      accent: C.amber,
      print: (s) => pMark(s, { color: false, mono: C.cream, rule: false }),
    }),
  },
  {
    id: 'pencils-set',
    section: 'paper',
    name: 'Карандаши «Четыре»',
    sub: 'Набор в цветах букв, точилка в комплекте',
    palette: [C.red, C.amber, C.green, C.blue],
    art: pencils({
      print: (s) => pMark(s, { color: false, mono: '#ffffff', rule: false }),
    }),
  },
  {
    id: 'stickers',
    section: 'paper',
    name: 'Лист наклеек',
    sub: 'Шесть наклеек на ноутбук, пенал и дневник',
    palette: [C.white],
    art: stickerSheet(),
  },
  {
    id: 'pins-enamel',
    section: 'paper',
    name: 'Значки «Три»',
    sub: 'Эмаль с золотой окантовкой: знак, крыша, 1995',
    tag: 'мелкий формат',
    palette: [C.blue, C.amber],
    art: pins(),
  },
  {
    id: 'patch-chevron',
    section: 'paper',
    name: 'Нашивка «Шеврон»',
    sub: 'Тканая, пришивается на рюкзак или куртку',
    palette: [C.navy, C.cream],
    art: patch({
      body: C.navy,
      print: (s) => pMark(s, { color: true }),
    }),
  },
  {
    id: 'lanyard-card',
    section: 'paper',
    name: 'Ланъярд с пропуском',
    sub: 'Для экскурсий: карточка с именем и классом',
    palette: [C.blue, C.red],
    art: lanyard(),
  },
  {
    id: 'magnet-home',
    section: 'paper',
    name: 'Магнит «Дом»',
    sub: 'На холодильник — знак и город',
    palette: [C.cream],
    art: magnet({ print: (s) => pMark(s, { color: true }) }),
  },

  // ─────────────────────────────────────────────────────── дом и школа ──
  {
    id: 'bottle-steel',
    section: 'home',
    name: 'Бутылка «Сталь»',
    sub: '500 мл, лазерная гравировка, не держит запах',
    tag: 'без пластика',
    palette: [C.blue, C.cream, C.graphite],
    art: bottle({
      body: C.blue,
      cap: C.cream,
      print: (s) => pMark(s, { color: false, mono: C.cream }),
    }),
  },
  {
    id: 'mug-home',
    section: 'home',
    name: 'Кружка «Утро»',
    sub: 'Керамика 330 мл, печать под глазурью',
    palette: [C.cream, C.navy],
    art: mug({
      body: C.cream,
      inner: C.blue,
      print: (s) => pMark(s, { color: true }),
    }),
  },
  {
    id: 'tumbler-travel',
    section: 'home',
    name: 'Термокружка',
    sub: '350 мл, держит тепло 4 часа — для дороги на олимпиаду',
    palette: ['#C9CED6', C.navy],
    art: tumbler({
      print: (s) => pMark(s, { color: false, mono: C.navy, rule: false }),
    }),
  },
  {
    id: 'lunchbox',
    section: 'home',
    name: 'Ланч-бокс',
    sub: 'Два отделения, крышка-тарелка, ручка',
    palette: [C.clay, C.navy],
    art: lunchbox({
      body: C.clay,
      print: (s) => pMark(s, { color: false, mono: C.cream }),
    }),
  },
  {
    id: 'umbrella-panels',
    section: 'home',
    name: 'Зонт «Восемь клиньев»',
    sub: 'Ветрозащитный каркас, чехол в тон',
    palette: [C.navy, C.cream],
    art: umbrella({
      colors: [C.navy, C.cream],
      print: (s) => pMark(s, { color: true }),
    }),
  },
  {
    id: 'backpack-school',
    section: 'home',
    name: 'Рюкзак «Школа»',
    sub: 'Ортопедическая спинка, светоотражатели, 18 л',
    tag: '1–4 класс',
    palette: [C.navy, C.blue],
    art: backpack({
      body: C.navy,
      accent: C.amber,
      print: (s) => pMark(s, { color: true }),
    }),
  },

  // ───────────────────────────────────────────────────────────── техника ──
  {
    id: 'phone-case',
    section: 'tech',
    name: 'Чехол для телефона',
    sub: 'Мягкий TPU, печать по всей спинке',
    palette: [C.navy, C.cream, C.blue],
    art: phoneCase({
      body: C.navy,
      print: (s) => pMark(s, { color: false, mono: C.cream }),
    }),
  },
  {
    id: 'laptop-sleeve',
    section: 'tech',
    name: 'Чехол для ноутбука',
    sub: '13–14″, фетр с резинкой, для информатики',
    palette: [C.stone, C.graphite],
    art: sleeve({
      body: C.stone,
      band: C.navy,
      print: (s) => pMark(s, { color: false, mono: C.navy, rule: false }),
    }),
  },
  {
    id: 'deskmat',
    section: 'tech',
    name: 'Коврик на стол',
    sub: 'Ткань + нескользящая основа, 60×30 см',
    palette: [C.navy, C.graphite],
    art: deskmat({
      body: C.navy,
      print: (s) => pMark(s, { color: false, mono: C.cream, rule: false }),
    }),
  },
  {
    id: 'powerbank',
    section: 'tech',
    name: 'Пауэрбанк 10 000',
    sub: 'Два выхода, индикатор, гравировка',
    palette: [C.graphite, C.navy],
    art: powerbank({
      body: C.graphite,
      print: (s) => pMark(s, { color: false, mono: C.cream, rule: false }),
    }),
  },
  {
    id: 'mouse-wireless',
    section: 'tech',
    name: 'Мышь беспроводная',
    sub: 'Тихие кнопки, один аккумулятор на полгода',
    palette: [C.cream, C.graphite],
    art: mouse({
      body: C.cream,
      print: (s) => pMark(s, { color: true, rule: false }),
    }),
  },

  // ─────────────────────────────────────────────────── техника в ливрее ──
  {
    id: 'plane-livery',
    section: 'transport',
    name: 'Лайнер «НААШ Эйр»',
    sub: 'Полная ливрея: тёмный хвост, триколор, знак на киле',
    tag: 'серия ливреи',
    palette: [C.navy, C.cream],
    art: airliner({ w: 760 }),
  },
  {
    id: 'bus-city',
    section: 'transport',
    name: 'Автобус «Школьный»',
    sub: 'Ливрея городского маршрута, номер рейса — класс',
    palette: [C.navy, C.cream],
    art: bus({ w: 660 }),
  },
  {
    id: 'tram-nn',
    section: 'transport',
    name: 'Трамвай «Нижний»',
    sub: 'Ретро-трамвай в цветах школы — для фото у входа',
    palette: [C.cream, C.blue],
    art: tram({ w: 660 }),
  },
  {
    id: 'race-car',
    section: 'transport',
    name: 'Болид «Ретро-07»',
    sub: 'Классическая формула в ливрее школы',
    palette: [C.navy, C.cream],
    art: raceCar({ w: 660 }),
  },
  {
    id: 'scooter',
    section: 'transport',
    name: 'Самокат «До школы»',
    sub: 'Складной, для последнего километра',
    palette: [C.graphite, C.navy],
    art: scooter(),
  },
  {
    id: 'bike-frame',
    section: 'transport',
    name: 'Велосипед «Синий»',
    sub: 'Рама в цвет знака, знак на подседельной трубе',
    palette: [C.blue],
    art: bike(),
  },
];

export const getItem = (id) => ITEMS.find((it) => it.id === id);

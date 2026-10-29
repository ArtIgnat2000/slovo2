// Чат «Спроси БУКа» (0.87.0; итерация 2, docs/buk-companion-3d.md §5, идеи 2–3):
// дверь в хабе → оверлей с чипами → маршрутизация по фактам слова → потолок
// подхода → уход в урок → сцена памяти (whitelist-факты в профиле, без наград).
// Идёт сразу после блока плавающего БУКа: главная, живая сова, открыта ничего.
// Файл подключается из tests/smoke.test.tsx.
import { useApp } from '../src/state/store';
import { btn, btnText, check, click, sleep } from './ui-helpers';

function setInputValue(el: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new window.Event('input', { bubbles: true }));
}

export async function runBukChatChecks(): Promise<void> {
  console.log('\n── Чат «Спроси БУКа»: дверь, чипы, потолок, память, урок ──');

  const owl = () => document.querySelector('.app > .mascot') as HTMLElement | null;
  const overlay = () => document.querySelector('.buk-chat');
  const bukMsgs = () => document.querySelectorAll('.chat-msg.chat-buk').length;
  const chips = () => Array.from(document.querySelectorAll('.chat-chip')) as HTMLButtonElement[];
  const chip = (label: string) => chips().find((c) => (c.textContent ?? '').trim() === label);
  const lastBuk = () => {
    const all = document.querySelectorAll('.chat-msg.chat-buk .chat-text');
    return (all[all.length - 1]?.textContent ?? '').trim();
  };
  const logHas = (needle: string) =>
    Array.from(document.querySelectorAll('.chat-msg.chat-buk .chat-text')).some((el) =>
      (el.textContent ?? '').includes(needle),
    );
  const lastAction = () => {
    const all = Array.from(document.querySelectorAll('.chat-action')) as HTMLButtonElement[];
    return all[all.length - 1];
  };
  const openHub = async () => {
    const hubBtn = document.querySelector('.app > .mascot .mascot-hub') as HTMLButtonElement | null;
    check('Чат: кнопка навигатора на месте', !!hubBtn, 'нет .mascot-hub');
    if (hubBtn) click(hubBtn);
    await sleep(40);
  };
  const openChat = async () => {
    await openHub();
    const door = Array.from(document.querySelectorAll('.buk-door')).find((d) =>
      (d.textContent ?? '').includes('Спроси БУКа'),
    );
    check('Чат: дверь «Спроси БУКа» есть в дуге', !!door, '');
    if (door) click(door);
    await sleep(60);
  };
  const send = async (text: string) => {
    const input = document.querySelector('.buk-chat-input') as HTMLInputElement | null;
    check('Чат: поле печати есть (печать — по желанию)', !!input, 'нет .buk-chat-input');
    if (!input) return;
    setInputValue(input, text);
    const sendBtn = btn((b) => b.getAttribute('aria-label') === 'Отправить');
    check('Чат: кнопка отправки на месте', !!sendBtn, '');
    if (sendBtn) click(sendBtn);
    await sleep(40);
  };

  // ── Дверь: в дуге шесть дверей, чат открывается из хаба ─────────────────────
  await openHub();
  const doorCount = document.querySelectorAll('.buk-door').length;
  check('Чат: в дуге шесть дверей (0.87.0 — дверь чата)', doorCount === 6, `дверей: ${doorCount}`);
  const chatDoor = Array.from(document.querySelectorAll('.buk-door')).find((d) =>
    (d.textContent ?? '').includes('Спроси БУКа'),
  );
  check('Чат: дверь «Спроси БУКа» есть', !!chatDoor, '');
  if (chatDoor) click(chatDoor);
  await sleep(60);

  // ── Оверлей: своя сова в шапке, плавающая скрыта (контракт mascot-ui) ──────
  check('Чат: дверь открыла полноэкранный оверлей', !!overlay(), 'нет .buk-chat');
  check('Чат: пока чат открыт, плавающего БУКа в доме нет', !owl(), 'маскот не скрыт');
  check(
    'Чат: сова шапки не ребёнок .app — в доме ни одной совы',
    document.querySelectorAll('.app > .mascot').length === 0,
    String(document.querySelectorAll('.app > .mascot').length),
  );
  check('Чат: БУК здоровается первой репликой', bukMsgs() >= 1, `реплик: ${bukMsgs()}`);
  check('Чат: пять корневых чипов-вопросов', chips().length === 5, `чипов: ${chips().length}`);

  // Escape закрывает чат и возвращает плавающего БУКа.
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
  await sleep(40);
  check('Чат: Escape закрывает оверлей', !overlay(), 'чат остался');
  check('Чат: после закрытия плавающий БУК вернулся', !!owl(), 'маскот не вернулся');

  // ── Подход 1: печать → известное слово → потолок → уход в урок ────────────
  await openChat();
  check('Чат: переоткрытие даёт чистый оверлей с приветствием', !!overlay() && bukMsgs() >= 1, '');

  await send('что-то совсем непонятное');
  check('Чат: на неизвестное — мягкий фолбэк с чипами', lastBuk().includes('Назови слово') && chips().length > 0, lastBuk());
  await send('лисица');
  check('Чат: печать известного слова отвечает фактами (слоги)', logHas('ли-си'), lastBuk());
  // Кнопки-действия копятся у реплик — ищем нужную по тексту.
  const practice = btn((b) => (b.textContent ?? '').trim() === 'Потренироваться');
  check('Чат: под ответом — кнопка «Потренироваться»', !!practice, 'нет кнопки');

  const before = bukMsgs();
  const today = chip('Что сегодня?');
  check('Чат: чип «Что сегодня?» показан', !!today, '');
  if (today) click(today);
  await sleep(40);
  check('Чат: ответ по чипу пришёл', bukMsgs() > before, `${before} → ${bukMsgs()}`);
  check('Чат: ответ про день — про урок или цель', /урок|цель|повтор/i.test(lastBuk()), lastBuk());

  // Потолок: чипов больше нет, последняя реплика зовёт в дело.
  check('Чат: подход закрылся — чипов больше нет', chips().length === 0, `чипов: ${chips().length}`);
  const action1 = lastAction();
  check('Чат: за потолком висит кнопка-дело', !!action1 && (action1.textContent ?? '').includes('Полетели'), action1?.textContent ?? '');
  check('Чат: последняя реплика зовёт в дело', lastBuk().includes('Полетели'), lastBuk());

  // Уход в урок: чат закрывается сам, экран урока чистый.
  if (action1) click(action1);
  await sleep(80);
  check('Чат: действие увело в урок, оверлей закрыт', !overlay() && !!document.querySelector('.lesson-screen'), 'нет .lesson-screen');

  // Выход из урока — как в остальных блоках: подтверждение и на главную.
  const exit = btn((b) => b.getAttribute('aria-label') === 'Выйти из урока');
  if (exit) {
    click(exit);
    await sleep(60);
    if ((document.body.textContent ?? '').includes('Выйти из урока?')) {
      const yes = btnText('Выйти');
      if (yes) click(yes);
      await sleep(80);
    }
  }
  check('Чат: после урока вернулись на главную — БУК дома', !!owl(), 'маскот не виден');
  check('Чат: оверлей чата не «прилип» к уроку', !overlay() && !document.querySelector('.lesson-screen'), '');

  // ── Подход 2: сцена памяти — только whitelist-факты, без наград ────────────
  await openChat();
  check('Чат: после урока дверь открывает чат заново', !!overlay() && bukMsgs() >= 1, '');
  const st0 = useApp.getState();
  const prof0 = st0.profiles.find((p) => p.id === st0.activeId);
  const xp0 = prof0?.xp ?? -1;
  const gems0 = prof0?.gems ?? -1;

  const tell = chip('Расскажу о себе');
  check('Чат: чип «Расскажу о себе» показан', !!tell, '');
  if (tell) click(tell);
  await sleep(40);
  check('Чат: сцена спрашивает животное', lastBuk().includes('животное'), lastBuk());
  const cat = chip('Кот');
  check('Чат: чипы-животные показаны', !!cat, '');
  if (cat) click(cat);
  await sleep(40);
  check('Чат: следующий шаг — любимый цвет', lastBuk().includes('цвет'), lastBuk());
  const blue = chip('Синий');
  check('Чат: чипы-цвета показаны', !!blue, '');
  if (blue) click(blue);
  await sleep(40);
  check('Чат: следующий шаг — имя питомца', lastBuk().includes('питомец'), lastBuk());
  await send('Мурзик');
  check('Чат: имя запомнено в реплике', logHas('Запомнил: Мурзик'), lastBuk());
  // После сцены корневые чипы снова на месте — подход живёт дальше.
  check('Чат: после сцены корневые чипы вернулись', chips().length >= 4, `чипов: ${chips().length}`);

  const st = useApp.getState();
  const prof = st.profiles.find((p) => p.id === st.activeId);
  const facts = prof?.bukFacts;
  check(
    'Чат: в профиле ровно whitelist-факты из сцены',
    !!facts && facts.animal === 'кот' && facts.color === 'синий' && facts.petName === 'Мурзик' &&
      Object.keys(facts).every((k) => ['animal', 'color', 'petName', 'toldAt'].includes(k)),
    JSON.stringify(facts),
  );
  check('Чат: у фактов есть отметка времени (напоминание через неделю)', typeof facts?.toldAt === 'number', String(facts?.toldAt));
  check(
    'Чат: за разговор не начислили ни опыта, ни кристаллов',
    !!prof && prof.xp === xp0 && prof.gems === gems0,
    `было xp=${xp0} gems=${gems0}, стало xp=${prof?.xp} gems=${prof?.gems}`,
  );

  // ── Финал: крестик закрывает чат, БУК возвращается ─────────────────────────
  const close = btn((b) => b.getAttribute('aria-label') === 'Закрыть чат');
  check('Чат: у оверлея есть крестик', !!close, '');
  if (close) click(close);
  await sleep(40);
  check('Чат: крестик закрывает чат и возвращает БУКа', !overlay() && !!owl(), '');
}

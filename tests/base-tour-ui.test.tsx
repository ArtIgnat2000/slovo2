// Экскурсия по базе в интерфейсе (0.76.0): тап по картинке ведёт в следующую
// комнату, после последней кольцо возвращается к фасаду, а не упирается в конец.
//
// Данные и файлы проверяет tests/base-tours.test.ts; здесь — то, что видно
// только в сборке: кольцо, подписи комнат, счётчик и задание «найди».
// 2026-10-29: точки-прыжки и подсказки под кадром убраны («лишние кружочки») —
// идентичность кадра держим на aria-label сцены, комнаты — на подписи под
// кадром (в ней же счётчик · N/5), вход на фасаде — на отсутствии .base-tour-photo.
import { BASE_TOUR_BY_ID } from '../src/engine/base-tours';
import type { Profile } from '../src/types';
import { useApp } from '../src/state/store';
import { buttons, check, click, sleep } from './ui-helpers';

const store = () => useApp.getState();

function active(): Profile {
  const s = store();
  const p = s.profiles.find((x) => x.id === s.activeId);
  if (!p) throw new Error('экскурсия: нет активного профиля');
  return p;
}

/** Кнопка-кадр экскурсии (сцена): подпись кадра — в её aria-label. */
const stage = () => document.querySelector('.base-tour-stage') as HTMLButtonElement | null;
const stageLabel = () => stage()?.getAttribute('aria-label') ?? '';
const copy = () => document.querySelector('.base-tour-copy')?.textContent ?? '';
const roomPhoto = () => document.querySelector('.base-tour-photo');

export async function runBaseTourUiChecks() {
  console.log('\n── Экскурсия по базам: комнаты по тапу, кольцо и задания ──');
  // Профиль не создаём, если он уже есть: смоук гоняет этот блок посреди
  // общего прохода, и новый активный профиль сломал бы проверки пазлов,
  // которые идут следом. Меняем только коллекцию баз.
  if (!active()) {
    store().createProfile('Тест экскурсий', '🚂');
    await sleep(60);
  }
  useApp.setState((s) => ({
    profiles: s.profiles.map((p) => (p.id === s.activeId
      ? { ...p, shop: { ...p.shop!, buildingsOwned: ['atomic-base', 'steam-base'] } }
      : p)),
  }));
  await sleep(40);

  // ── Магазин: карточка базы открывается экскурсией ────────────────────────
  const bukTab = buttons().find((b) => (b.textContent ?? '').includes('БУК') && b.className.includes('tab'));
  click(bukTab);
  await sleep(60);
  click(buttons().find((b) => b.className.includes('chip') && (b.textContent ?? '').includes('Базы')));
  await sleep(60);
  check('базы: полка показывает все пять баз', document.querySelectorAll('.building-item').length === 5, String(document.querySelectorAll('.building-item').length));
  check('базы: в витрине есть «База паровозов»', (document.body.textContent ?? '').includes('База паровозов'));

  const atomicCard = Array.from(document.querySelectorAll('.building-item')).find((el) => (el.textContent ?? '').includes('Ядерная база'));
  click(atomicCard as Element);
  await sleep(60);
  check('базы: в подробной карточке стоит экскурсия, а не одна картинка', !!stage(), '');

  // ── Кольцо: фасад → 5 комнат → снова фасад ───────────────────────────────
  const tour = BASE_TOUR_BY_ID['atomic-base'];
  check('экскурсия: начинается с фасада', !roomPhoto() && stageLabel() === 'Войти внутрь базы', stageLabel());
  check('экскурсия: на фасаде нет подсказок под кадром', !document.querySelector('.base-tour-copy'), document.querySelector('.base-tour-copy')?.textContent ?? 'нет подписи');

  for (let index = 0; index < tour.stops.length; index++) {
    click(stage());
    await sleep(30);
    const stop = tour.stops[index];
    check(
      `экскурсия: тап ${index + 1} открывает «${stop.title}»`,
      copy().includes(stop.title) && !!roomPhoto(),
      copy().slice(0, 80),
    );
    check(
      `экскурсия: у «${stop.title}» есть факт и задание «найди»`,
      copy().includes(stop.fact.slice(0, 30)) && copy().includes(stop.find.slice(0, 20)),
      copy().slice(0, 80),
    );
    check(
      `экскурсия: в подписи «${stop.title}» есть счётчик ${index + 1}/${tour.stops.length}`,
      copy().includes(`· ${index + 1}/${tour.stops.length}`),
      copy().slice(0, 80),
    );
  }

  // Шестой тап — и снова фасад: кольцо не заканчивается.
  click(stage());
  await sleep(30);
  check('экскурсия: после последней комнаты кольцо возвращает к фасаду', !roomPhoto() && stageLabel() === 'Войти внутрь базы', stageLabel());

  // Точки-прыжки убраны (2026-10-29): до нужной комнаты — тапами по сцене.
  click(stage());
  await sleep(30);
  click(stage());
  await sleep(30);
  click(stage());
  await sleep(30);
  check('экскурсия: картинка комнаты лежит в public/base-tours', (roomPhoto() as HTMLImageElement | null)?.getAttribute('src') === '/base-tours/atomic-base-3.webp', (roomPhoto() as HTMLImageElement | null)?.getAttribute('src') ?? '');

  // Закрываем лист и возвращаемся в витрину.
  const close = buttons().find((b) => (b.getAttribute('aria-label') ?? '').includes('Закрыть') || (b.textContent ?? '').includes('Закрыть'));
  if (close) { click(close); await sleep(40); }

  // ── «Мой мир»: у купленной базы тоже есть экскурсия ─────────────────────
  click(buttons().find((b) => b.className.includes('chip') && (b.textContent ?? '').includes('Техника')));
  await sleep(40);
  click(buttons().find((b) => b.getAttribute('role') === 'tab' && (b.textContent ?? '').includes('Мой мир')));
  await sleep(60);
  click(buttons().find((b) => (b.getAttribute('aria-label') ?? '').startsWith('Базы:')));
  await sleep(40);
  click(buttons().find((b) => (b.getAttribute('aria-label') ?? '').includes('Увеличить: База паровозов')));
  await sleep(40);
  check('мир: база открывается экскурсией, а не одной картинкой', !!stage(), '');
  click(stage());
  await sleep(30);
  const steam = BASE_TOUR_BY_ID['steam-base'];
  check('мир: у базы паровозов внутри машинный зал с котлом', copy().includes(steam.stops[0].title) && copy().includes('паровой двигатель'), copy().slice(0, 80));

  // Возвращаемся в БУК: следующие проверки смоука начинают с магазина.
  click(buttons().find((b) => (b.textContent ?? '').includes('К области')));
  await sleep(20);
  click(buttons().find((b) => (b.textContent ?? '').includes('К карте')));
  await sleep(20);
  const back = buttons().find((b) => (b.textContent ?? '').includes('Назад в БУК'));
  if (back) { click(back); await sleep(40); }
  check('экскурсия: возврат в БУК оставляет магазин на месте', !!document.querySelector('.shop-cats'), '');
}

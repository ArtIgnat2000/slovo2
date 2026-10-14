import './setup';
import { createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ChestCelebration } from '../src/ui/ChestCelebration';
import { CHEST_WAKE_TAPS, chestPreview, chestWakeBonus, countWakeTap } from '../src/engine/quests';
import { check, click, has, sleep } from './ui-helpers';

/**
 * Обвязка «Разбуди сундук»: состоянием тапов владеет карточка заданий, поэтому
 * в тесте её заменяет маленький хост — он же считает награду, как это делает стор.
 */
function WakeHost({ available = true }: { available?: boolean }) {
  const [taps, setTaps] = useState(0);
  const bonus = chestWakeBonus('daily');
  const awake = taps >= CHEST_WAKE_TAPS;
  const gems = chestPreview('daily', awake).gems;
  return createElement(ChestCelebration, {
    reward: { gems, xp: 0, freezes: 0, ...(awake ? { wakeBonus: bonus } : {}) },
    balance: 35 + (awake ? bonus : 0),
    look: {},
    stage: 1,
    celebrate: true,
    onClose: () => {},
    wake: {
      taps,
      target: CHEST_WAKE_TAPS,
      bonus,
      available,
      onTap: () => setTaps((current) => countWakeTap(current)),
    },
  });
}

const reward = { gems: 15, xp: 0, freezes: 0 };

export async function runChestCeremonyChecks() {
  console.log('\n── Церемония открытия сундука БУКа ──');
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  let closed = false;

  root.render(
    createElement(ChestCelebration, {
      reward,
      balance: 35,
      look: {},
      stage: 1,
      celebrate: true,
      onClose: () => { closed = true; },
    }),
  );
  await sleep(30);

  check(
    'церемония начинается с действия ребёнка и доступного пропуска',
    !!host.querySelector('.chest-ceremony.is-waiting') &&
      !!host.querySelector('.chest-ceremony-open') &&
      !!host.querySelector('.chest-ceremony-skip'),
    host.textContent ?? '',
  );
  check(
    'итог не раскрывается до сцены открытия',
    !!host.querySelector('.chest-ceremony-result.waiting[aria-hidden="true"]'),
    host.querySelector('.chest-ceremony-result')?.className ?? '',
  );
  const chestImageSources = Array.from(host.querySelectorAll<HTMLImageElement>('.chest-art-image'))
    .map((image) => image.getAttribute('src') ?? '');
  check(
    'для закрытия и открытия используются локальные WebP-арты, а задания представлены тремя ключами',
    chestImageSources.length === 2 &&
      chestImageSources.some((source) => source.endsWith('/illustrations/chests/travel-closed.webp')) &&
      chestImageSources.some((source) => source.endsWith('/illustrations/chests/travel-open.webp')) &&
      host.querySelectorAll('.scene-key').length === 3,
    `${chestImageSources.join(', ')}; ключей: ${host.querySelectorAll('.scene-key').length}`,
  );
  const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  host.querySelector('[role="dialog"]')?.dispatchEvent(tabEvent);
  check(
    'Tab переводит фокус к пропуску, не выходя из сцены',
    tabEvent.defaultPrevented && document.activeElement === host.querySelector('.chest-ceremony-skip'),
    document.activeElement?.outerHTML ?? '',
  );
  const reverseTabEvent = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
  host.querySelector('[role="dialog"]')?.dispatchEvent(reverseTabEvent);
  check(
    'Shift+Tab возвращает фокус к действию поворота ключей',
    reverseTabEvent.defaultPrevented && document.activeElement === host.querySelector('.chest-ceremony-open'),
    document.activeElement?.outerHTML ?? '',
  );

  click(host.querySelector('.chest-ceremony-skip'));
  await sleep(20);
  check(
    'пропуск мгновенно показывает тот же чек и баланс',
    !!host.querySelector('.chest-ceremony.is-final') &&
      !!host.querySelector('.chest-ceremony-result.revealed') &&
      host.querySelector('.chest-ceremony-balance strong')?.textContent === '35',
    host.textContent ?? '',
  );
  click(Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.includes('Здорово!')));
  check('кнопка завершения закрывает сцену', closed, '');
  closed = false;
  root.render(
    createElement(ChestCelebration, {
      reward,
      balance: 35,
      look: {},
      stage: 1,
      celebrate: false,
      onClose: () => { closed = true; },
    }),
  );
  await sleep(20);
  const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  host.querySelector('[role="dialog"]')?.dispatchEvent(escapeEvent);
  check('Escape закрывает уже показанный чек', escapeEvent.defaultPrevented && closed, '');
  root.unmount();
  host.remove();

  const revealHost = document.createElement('div');
  document.body.appendChild(revealHost);
  const revealRoot = createRoot(revealHost);
  revealRoot.render(
    createElement(ChestCelebration, {
      reward,
      balance: 35,
      look: {},
      stage: 1,
      celebrate: true,
      onClose: () => {},
    }),
  );
  await sleep(30);
  click(revealHost.querySelector('.chest-ceremony-open'));
  await sleep(3_250);
  check(
    'после поворота ключей сцена раскрывает +15 и досчитывает баланс, но не закрывается',
    !!revealHost.querySelector('.chest-ceremony-result.revealed') &&
      revealHost.querySelector('.chest-ceremony-balance strong')?.textContent === '35' &&
      !!revealHost.querySelector('.chest-ceremony-skip'),
    revealHost.textContent ?? '',
  );
  revealRoot.unmount();
  revealHost.remove();

  const originalMatchMedia = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;

  const reducedHost = document.createElement('div');
  document.body.appendChild(reducedHost);
  const reducedRoot = createRoot(reducedHost);
  reducedRoot.render(
    createElement(ChestCelebration, {
      reward,
      balance: 35,
      look: {},
      stage: 1,
      celebrate: true,
      onClose: () => {},
    }),
  );
  await sleep(30);
  check(
    'уменьшение движения сразу показывает статичную награду',
    !!reducedHost.querySelector('.chest-ceremony.is-final') &&
      !reducedHost.querySelector('.chest-ceremony-skip') &&
      !!reducedHost.querySelector('.chest-ceremony-done'),
    reducedHost.textContent ?? '',
  );
  reducedRoot.unmount();
  reducedHost.remove();
  window.matchMedia = originalMatchMedia;

  const bonusHost = document.createElement('div');
  document.body.appendChild(bonusHost);
  const bonusRoot = createRoot(bonusHost);
  bonusRoot.render(
    createElement(ChestCelebration, {
      reward: { gems: 5, xp: 0, freezes: 0 },
      kind: 'bonus',
      balance: 40,
      look: {},
      stage: 1,
      celebrate: true,
      onClose: () => {},
    }),
  );
  await sleep(30);
  check(
    'бонусный сундук показывает отдельную награду за урок и кнопку без ключей',
    bonusHost.querySelector('.chest-ceremony-kicker')?.textContent?.includes('НАГРАДА ЗА УРОК') === true &&
      bonusHost.textContent?.includes('+5') === true &&
      Array.from(bonusHost.querySelectorAll('button')).some((button) => button.textContent?.includes('Открыть сундук!')),
    bonusHost.textContent ?? '',
  );
  bonusRoot.unmount();
  bonusHost.remove();

  // ── «Разбуди сундук»: тапы по закрытому сундуку (обратная связь 2026-10-14) ──
  {
    const wakeHost = document.createElement('div');
    document.body.appendChild(wakeHost);
    const wakeRoot = createRoot(wakeHost);
    wakeRoot.render(createElement(WakeHost, {}));
    await sleep(30);

    const wakeButton = (): HTMLButtonElement | null => wakeHost.querySelector('.chest-wake-tap');
    check(
      'сундук можно будить: по закрытому сундуку есть кнопка-тап',
      !!wakeButton() && (wakeButton()?.getAttribute('aria-label') ?? '').includes('Разбудить сундук'),
      wakeHost.textContent ?? '',
    );
    check(
      'до тапов сундук спит и обещает надбавку',
      has('Тапни по сундуку 5 раз') && wakeHost.querySelectorAll('.chest-wake-dot.on').length === 0,
      wakeHost.querySelector('.chest-wake-caption')?.textContent ?? '',
    );

    click(wakeButton());
    await sleep(20);
    click(wakeButton());
    await sleep(20);
    click(wakeButton());
    await sleep(20);
    check(
      'тапы видно: три из пяти зажглись в счётчике',
      wakeHost.querySelectorAll('.chest-wake-dot.on').length === 3 &&
        has('3 из 5'),
      wakeHost.querySelector('.chest-wake-caption')?.textContent ?? '',
    );
    check(
      'до пятого тапа сундук ещё не разбужен: надбавка не начислена',
      !wakeHost.querySelector('.chest-wake-panel.awake') && !has('+17'),
      wakeHost.textContent ?? '',
    );

    click(wakeButton());
    await sleep(20);
    click(wakeButton());
    await sleep(20);
    check(
      'пять тапов будят сундук: он светится и говорит про надбавку',
      !!wakeHost.querySelector('.chest-ceremony.is-awake') &&
        !!wakeHost.querySelector('.chest-wake-panel.awake') &&
        has('Сундук проснулся') &&
        has('+2'),
      wakeHost.querySelector('.chest-wake-caption')?.textContent ?? '',
    );
    check(
      'разбуженный сундук больше не просит тапов',
      !wakeButton(),
      wakeHost.textContent ?? '',
    );

    click(wakeHost.querySelector('.chest-ceremony-open'));
    await sleep(20);
    click(wakeHost.querySelector('.chest-ceremony-skip'));
    await sleep(20);
    check(
      'в награде видно и надбавку за разогрев: +17 и подпись',
      has('+17') && has('разбудил сундук'),
      wakeHost.querySelector('.chest-ceremony-result')?.textContent ?? '',
    );
    wakeRoot.unmount();
    wakeHost.remove();

    // Если надбавку за этот сундук уже платили, будить нечего: кнопки-тапа нет.
    const paidHost = document.createElement('div');
    document.body.appendChild(paidHost);
    const paidRoot = createRoot(paidHost);
    paidRoot.render(createElement(WakeHost, { available: false }));
    await sleep(30);
    check(
      'оплаченный разогрев не предлагают второй раз',
      !paidHost.querySelector('.chest-wake-tap'),
      paidHost.textContent ?? '',
    );
    paidRoot.unmount();
    paidHost.remove();
  }
}

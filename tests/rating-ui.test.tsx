// Рейтинг через настоящий UI (0.73.0): вкладка открывается, игрок видит своё
// место, соперников и честную подпись, что соперники воображаемые.
import { useApp } from '../src/state/store';
import { buttons, check, click, has, sleep } from './ui-helpers';

async function goTab(name: string) {
  const tab = buttons().find((b) => (b.textContent ?? '').includes(name) && b.className.includes('tab'));
  click(tab);
  await sleep(60);
}

export async function runRatingUiChecks() {
  console.log('\n── Рейтинг: воображаемые соперники ──');
  useApp.getState().createProfile('Тест рейтинга', '🏆');
  await sleep(60);
  useApp.setState((s) => ({
    profiles: s.profiles.map((p) => (p.id === s.activeId ? { ...p, xp: 450 } : p)),
  }));
  await sleep(30);

  await goTab('Рейтинг');
  check('рейтинг: вкладка открылась', has('Рейтинг') && !!document.querySelector('.rating-screen'), document.body.textContent?.slice(0, 160) ?? '');
  check('рейтинг: честно сказано, что соперники выдуманы', has('Соперники выдуманы'), '');
  check('рейтинг: игрок видит своё место', has('место') && has('Тест рейтинга'), document.body.textContent?.slice(0, 200) ?? '');
  check('рейтинг: в таблице игрок и десять соперников', document.querySelectorAll('.rating-row').length === 11, `строк: ${document.querySelectorAll('.rating-row').length}`);
  check('рейтинг: строка игрока подсвечена', !!document.querySelector('.rating-row.is-player'), '');
  check('рейтинг: видны имена соперников', has('Мия') && has('Щенок Рекс'), '');
}

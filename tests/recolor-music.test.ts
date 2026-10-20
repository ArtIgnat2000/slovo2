// Регрессия: смена цвета купленной вещи («Болид» → синий) не должна трогать
// музыку, звуки и мечты. Раньше recolorItem подменял весь shop объектом из
// recolor(), и musicTrack пропадал: миграция считала выбор «не сделан» и
// включала первую мелодию — ребёнок видел «музыка сама заиграла».
import assert from 'node:assert/strict';
import { useApp } from '../src/state/store';
import type { Profile } from '../src/types';

function profileWith(musicTrack: string | null): Profile {
  return {
    id: 'recolor-test',
    name: 'Тест',
    avatar: 'a',
    createdAt: 1,
    xp: 0,
    gems: 60,
    streak: 0,
    lastDay: '',
    freezes: 0,
    words: {},
    lessons: {},
    errors: {},
    days: {},
    studySessions: [],
    achievements: [],
    lessonSize: 'standard',
    daily: { day: '2026-10-20', claimed: [], chestsToday: 0, bonusChestsClaimed: 0, chestsTotal: 0 },
    weekly: { week: '2026-10-19', claimed: [] },
    shop: {
      owned: ['car-racer'],
      equipped: {},
      musicOwned: ['carefree', 'easy-lemon'],
      musicTrack,
      soundOwned: ['classic'],
      soundPack: 'classic',
      wishlist: ['car-jeep'],
    },
    puzzle: { pieces: {}, collecting: null, assembled: [], worn: null },
  };
}

const saved = useApp.getState();
const savedProfiles = saved.profiles;
const savedActive = saved.activeId;

for (const [label, track] of [
  ['тишина (музыка выключена)', null],
  ['выбрана мелодия', 'carefree'],
] as const) {
  useApp.setState({ profiles: [profileWith(track)], activeId: 'recolor-test' });
  const outcome = useApp.getState().recolorItem('car-racer', 'blue');
  assert.equal(outcome, 'opened', `${label}: оттенок открывается за кристаллы`);
  const shop = useApp.getState().profiles[0].shop!;
  assert.equal(shop.musicTrack, track, `${label}: выбор мелодии сохраняется, а не сбрасывается`);
  assert.deepEqual(shop.musicOwned, ['carefree', 'easy-lemon'], `${label}: купленные мелодии на месте`);
  assert.ok(shop.soundOwned?.includes('classic'), `${label}: купленные звуки на месте`);
  assert.equal(shop.soundPack, 'classic', `${label}: выбранный звуковой набор сохраняется`);
  assert.deepEqual(shop.wishlist, ['car-jeep'], `${label}: мечты на месте`);
  assert.equal(shop.tuning?.current?.['car-racer'], 'blue', `${label}: новый цвет применён`);
}

useApp.setState({ profiles: savedProfiles, activeId: savedActive });

console.log('✓ смена цвета не трогает музыку, звуки и мечты');

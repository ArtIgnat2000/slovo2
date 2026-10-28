import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const catalog = readFileSync(new URL('../src/engine/shop.ts', import.meta.url), 'utf8');
const gallery = readFileSync(new URL('../src/ui/CarTour.tsx', import.meta.url), 'utf8');
const art = readFileSync(new URL('../src/ui/CarArt.tsx', import.meta.url), 'utf8');
const ids = [...catalog.matchAll(/id: '(car-[^']+)', slot: 'toy'/g)].map((match) => match[1]);
const registered = [...gallery.matchAll(/'car-[^']+'/g)].map((match) => match[0].slice(1, -1));

test('every catalog car has its own exterior, cabin, dashboard and tour', () => {
  assert.equal(ids.length, new Set(ids).size);
  assert.deepEqual(new Set(registered), new Set(ids));
  for (const id of ids) {
    assert.match(art, new RegExp(`'${id}'`));
    for (const view of ['', '-interior', '-dashboard']) {
      assert.ok(existsSync(new URL(`../public/cars/${id}${view}.webp`, import.meta.url)), `${id}${view} missing`);
    }
  }
});

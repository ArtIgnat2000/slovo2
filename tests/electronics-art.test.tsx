import { strict as assert } from 'node:assert';
import { existsSync, statSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { ELECTRONICS_ART, ElectronicsArt, hasElectronicsArt } from '../src/ui/ElectronicsArt';
import { ToyArt } from '../src/ui/ToyArt';
import { ITEM_BY_ID, toysByShelf } from '../src/engine/shop';

const shelf = toysByShelf('phone');
for (const [id, file] of Object.entries(ELECTRONICS_ART)) {
  assert.equal(ITEM_BY_ID[id]?.toy, 'phone');
  assert.ok(shelf.some(item => item.id === id));
  assert.ok(ITEM_BY_ID[id].price > 0);
  const path = `public/electronics/${file}.webp`;
  assert.ok(existsSync(path), path);
  assert.ok(statSync(path).size < 400_000, 'Illustrations stay small for offline use');
  const markup = renderToStaticMarkup(<ToyArt id={id} className="test-art" />);
  assert.ok(markup.includes('electronics-art test-art'));
  assert.ok(markup.includes(`${import.meta.env.BASE_URL}electronics/${file}.webp`));
  assert.ok(!markup.includes('<svg'), 'New electronics must not fall back to retro phone SVG');
}
for (const id of ['phone-smart', 'phone-flip', 'phone-retro']) {
  assert.ok(shelf.some(item => item.id === id), 'Existing purchases remain valid');
  assert.ok(renderToStaticMarkup(<ToyArt id={id} />).includes('phone-face-back'));
  const interactive = renderToStaticMarkup(<ToyArt id={id} interactive />);
  assert.ok(interactive.includes('aria-pressed="false"'));
  assert.ok(interactive.includes('phone-front.webp'));
  assert.ok(existsSync('public/electronics/phone-front.webp'));
}
assert.equal(hasElectronicsArt('toString'), false);
assert.equal(renderToStaticMarkup(<ElectronicsArt id="missing" />), '');
console.log('Electronics: catalog, assets, base URL, shared rendering and legacy phones OK');

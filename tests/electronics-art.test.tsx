import { strict as assert } from 'node:assert';
import { existsSync, statSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { ELECTRONICS_ART, ElectronicsArt, hasElectronicsArt } from '../src/ui/ElectronicsArt';
import { hasProductPhoto } from '../src/ui/ProductPhoto';
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
  if (hasProductPhoto(id)) {
    // 0.83.0: весь раздел снят студийными фотографиями — показываем снимок,
    // 3D-арт лежит в public/electronics запасным вариантом на случай отката.
    assert.ok(markup.includes('product-photo test-art'), `${id}: снимок вместо 3D-арта`);
    assert.ok(markup.includes(`${import.meta.env.BASE_URL}products/${id}.webp`));
    assert.ok(existsSync(`public/products/${id}.webp`), `public/products/${id}.webp`);
    continue;
  }
  assert.ok(markup.includes('electronics-art test-art'));
  assert.ok(markup.includes(`${import.meta.env.BASE_URL}electronics/${file}.webp`));
  assert.ok(!markup.includes('<svg'), 'New electronics must not fall back to retro phone SVG');
}
// У каждой позиции раздела есть снимок: фотореализм раздела закрыт целиком.
const electronicsWithoutPhoto = Object.keys(ELECTRONICS_ART).filter(id => !hasProductPhoto(id));
assert.deepEqual(electronicsWithoutPhoto, [], 'у электроники не осталось 3D-арта в витрине');
// 0.83.0: поворота телефонов больше нет — кадр один, крутить нечего.
assert.ok(!Object.keys(ELECTRONICS_ART).some(id => renderToStaticMarkup(<ToyArt id={id} />).includes('phone-rotate')));
for (const id of ['phone-smart', 'phone-flip', 'phone-retro']) {
  assert.ok(shelf.some(item => item.id === id), 'Existing purchases remain valid');
  assert.ok(renderToStaticMarkup(<ToyArt id={id} />).includes('product-photo'), id);
}
assert.equal(existsSync('public/electronics/phone-front.webp'), false, 'экран для поворота больше не нужен');
assert.equal(hasElectronicsArt('toString'), false);
assert.equal(renderToStaticMarkup(<ElectronicsArt id="missing" />), '');
console.log('Electronics: catalog, assets, base URL, shared rendering and photos OK');

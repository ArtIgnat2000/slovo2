import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';
const svg = fs.readFileSync('public/icons/icon.svg', 'utf8');
function render(size, out, pad = 0, bg = null) {
  let s = svg;
  if (pad) {
    // уменьшаем содержимое, оставляя безопасную зону (maskable)
    const scale = (1 - pad * 2).toFixed(3);
    s = svg.replace('<svg ', `<svg style="background:${bg}" `)
      .replace('viewBox="0 0 512 512"', `viewBox="${-pad * 512} ${-pad * 512} ${512 * (1 + pad * 2)} ${512 * (1 + pad * 2)}"`);
  }
  const r = new Resvg(s, { fitTo: { mode: 'width', value: size } });
  fs.writeFileSync(out, r.render().asPng());
  console.log('ok', out);
}
render(192, 'public/icons/icon-192.png');
render(512, 'public/icons/icon-512.png');
render(180, 'public/icons/apple-touch-icon.png');
render(512, 'public/icons/maskable-512.png', 0.12, '#6d47ff');

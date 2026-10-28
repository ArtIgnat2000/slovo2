// Печатные блоки: каждая функция получает ЦЕЛЕВУЮ ШИРИНУ печати в px и
// возвращает разметку, центрированную относительно (0,0). Благодаря этому
// вещь ставит печать в точку кроя, а не «на глаз» по масштабу.

import { C, mark, lockupH, lockupV, seal, text, MARK_BOX, font, esc } from './brand.mjs';

const BLOCK = 134; // ширина блока букв знака в единицах капители
// Габариты замков посчитаны по фактической отрисовке (brand.mjs): ширина
// считается по габариту знака с вылетом крыши, а не по блоку букв, — иначе
// печать вылезает за ткань.
// Замерено по фактической отрисовке (bbox SVG-рендера), а не «на глаз»:
// вертикальный замок: ширина = 1,254 габарита знака, высота = 1,358 ширины;
// горизонтальный: 5,65 и 2,02 капители.
const LOCK_V_W = 1.254;
const LOCK_V_H = 1.358;
const LOCK_H_W = 5.69;
const LOCK_H_H = 1.94;

/** Знак целиком, шириной width. */
export function pMark(width, { mono = null, color = true, rule = true } = {}) {
  const s = width / MARK_BOX.w;
  const h = MARK_BOX.h * s;
  // Центрируем по фактическому габариту знака: он начинается не с нуля —
  // крыша выступает за блок букв (MARK_BOX.x < 0).
  return `<g transform="translate(${-(MARK_BOX.x * s + width / 2)} ${-(MARK_BOX.y * s + h / 2)})">${mark({ scale: s, color, mono, rule })}</g>`;
}

/** Вертикальный замок (знак + четыре строки) шириной width. */
export function pLockupV(width, { color = C.navy, colorMark = true } = {}) {
  const s = width / (LOCK_V_W * MARK_BOX.w);
  const h = 100 * s;
  return `<g transform="translate(${-width / 2} ${(-width * LOCK_V_H) / 2})">${lockupV({ h, color, colorMark })}</g>`;
}

/** Горизонтальный замок шириной width. */
export function pLockupH(width, { color = C.navy, colorMark = true } = {}) {
  const h = width / LOCK_H_W;
  const height = h * LOCK_H_H;
  return `<g transform="translate(${-width / 2} ${-height / 2})">${lockupH({ h, color, colorMark })}</g>`;
}

/** Круглая печать диаметром width. */
export function pSeal(width, { color = C.blue, id = 'ps' } = {}) {
  return `<g transform="translate(${-width / 2} ${-width / 2})">${seal({ r: width / 2, color, id })}</g>`;
}

/** Слово вразрядку, центрированное по ширине. */
export function pWord(word, width, { color = C.navy, weight = 900, size = null, spacing = 0.14 } = {}) {
  const fs = size ?? width / (word.length * (0.62 + spacing));
  const track = fs * spacing;
  const textW = word.length * (fs * 0.62 + track);
  return (
    `<g transform="translate(${-textW / 2} ${fs * 0.36})">` +
    `<text x="0" y="0" ${font(weight)} font-size="${fs}" letter-spacing="${track}" fill="${color}">${esc(word)}</text>` +
    `</g>`
  );
}

/** Две строки: «НИЖНИЙ НОВГОРОД · 1995». */
export function pCity(width, { color = C.navy, sub = '1995' } = {}) {
  const fs = width / 20;
  return (
    `<g transform="translate(${-width / 2} ${-fs})">` +
    `<text x="0" y="${fs * 0.9}" ${font(700)} font-size="${fs}" letter-spacing="${fs * 0.12}" fill="${color}">НИЖНИЙ НОВГОРОД</text>` +
    `<text x="0" y="${fs * 2.2}" ${font(500)} font-size="${fs * 0.8}" letter-spacing="${fs * 0.3}" fill="${color}" opacity="0.7">${esc(sub)}</text>` +
    `</g>`
  );
}

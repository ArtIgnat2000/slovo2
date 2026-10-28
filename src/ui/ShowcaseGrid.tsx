import { Children, type ReactNode } from 'react';

/**
 * Сетка витрины-бутика: карточки товаров на общей сцене витрины
 * (`ui/ShowcaseGrid.tsx`, стили `.shop-boutique` в app.css).
 *
 * Вынесена из экрана магазина в 0.74.0, когда появилась вторая полка со своими
 * карточками — школьный уголок (`ui/NaashPanel.tsx`): одна сетка на весь
 * магазин, чтобы школьная полка не завела свою вёрстку и не разъехалась с
 * остальными при следующей правке витрины.
 *
 * 0.76.0: ряды больше не нарезаются в разметке по две карточки. Сколько
 * карточек в ряду, решает CSS (2 на телефоне, 3 на широком экране) — на
 * планшете больше не остаётся пустой половины витрины, а карточки в ряду
 * автоматически одной высоты.
 */
export function ShowcaseGrid({ children, tone }: { children: ReactNode; tone?: 'mint' | 'sky' }) {
  return (
    <div className={`shop-boutique${tone ? ` shop-boutique-${tone}` : ''}`}>
      <div className="shop-boutique-row shop-grid">{Children.toArray(children)}</div>
    </div>
  );
}

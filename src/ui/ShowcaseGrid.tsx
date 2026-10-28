import { Children, type ReactNode } from 'react';

/**
 * Сетка витрины-бутика (0.19.0): карточки идут по две в ряд, у каждой своя
 * арка-ниша с лампой и подиумом (стили `.shop-boutique` в app.css).
 *
 * Вынесена из экрана магазина в 0.74.0, когда появилась вторая полка со своими
 * карточками — школьный уголок (`ui/NaashPanel.tsx`): одна сетка на весь
 * магазин, чтобы школьная полка не завела свою вёрстку и не разъехалась с
 * остальными при следующей правке витрины.
 */
export function ShowcaseGrid({ children, tone }: { children: ReactNode; tone?: 'mint' | 'sky' }) {
  const cells = Children.toArray(children);
  const rows: ReactNode[][] = [];
  for (let i = 0; i < cells.length; i += 2) rows.push(cells.slice(i, i + 2));
  return (
    <div className={`shop-boutique${tone ? ` shop-boutique-${tone}` : ''}`}>
      {rows.map((row, index) => (
        <div className={`shop-boutique-row shop-grid${row.length === 1 ? ' single' : ''}`} key={index}>
          {row}
        </div>
      ))}
    </div>
  );
}

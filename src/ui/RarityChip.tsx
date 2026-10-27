import { RARITY_LABEL, rarityOf, type ItemRarity, type ShopItem } from '../engine/shop';

/**
 * Бейдж типа вещи: обычный, крутой, легендарный, ТОПОВЫЙ.
 * Цвет задаётся классом rarity-<тип> в app.css, текст — из RARITY_LABEL.
 */
export function RarityChip({ item, className }: { item: ShopItem; className?: string }) {
  return <RarityLabel rarity={rarityOf(item)} className={className} />;
}

export function RarityLabel({ rarity, className }: { rarity: ItemRarity; className?: string }) {
  return (
    <span className={`rarity-chip rarity-${rarity}${className ? ` ${className}` : ''}`} data-rarity={rarity}>
      {RARITY_LABEL[rarity]}
    </span>
  );
}

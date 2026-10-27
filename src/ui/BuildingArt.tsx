import { BUILDING_BY_ID } from '../engine/buildings';

interface BuildingArtProps {
  id: string;
  className?: string;
  loading?: 'eager' | 'lazy';
  decorative?: boolean;
}

export function buildingArtUrl(id: string): string {
  return `${import.meta.env.BASE_URL}buildings/${id}.webp`;
}

/**
 * Детализированные иллюстрации городков лежат в public/buildings/ в WebP.
 * URL учитывает базовый путь GitHub Pages, а формат картинок добавлен в
 * precache PWA для работы витрины без сети.
 */
export function BuildingArt({ id, className, loading = 'lazy', decorative = false }: BuildingArtProps) {
  const building = BUILDING_BY_ID[id];
  if (!building) return null;

  return (
    <img
      className={`building-art${className ? ` ${className}` : ''}`}
      data-building-id={id}
      src={buildingArtUrl(id)}
      alt={decorative ? '' : building.title}
      aria-hidden={decorative || undefined}
      loading={loading}
      decoding="async"
      draggable={false}
    />
  );
}

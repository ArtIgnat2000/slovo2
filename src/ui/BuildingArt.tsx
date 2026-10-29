import { BUILDING_BY_ID } from '../engine/buildings';
import { hasProductPhoto, productPhotoUrl } from './ProductPhoto';

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
 *
 * 0.79.0: у базы есть фотореалистичный рендер (`public/products/<id>.webp`),
 * и он важнее иллюстрации. Один компонент обслуживает и витрину, и первую
 * точку экскурсии, и плитки «Моего мира», поэтому база выглядит одинаково
 * везде — и в каталоге, и снаружи, и внутри.
 */
export function BuildingArt({ id, className, loading = 'lazy', decorative = false }: BuildingArtProps) {
  const building = BUILDING_BY_ID[id];
  if (!building) return null;

  return (
    <img
      className={`building-art${hasProductPhoto(id) ? ' product-photo' : ''}${className ? ` ${className}` : ''}`}
      data-building-id={id}
      src={hasProductPhoto(id) ? productPhotoUrl(id) : buildingArtUrl(id)}
      alt={decorative ? '' : building.title}
      aria-hidden={decorative || undefined}
      loading={loading}
      decoding="async"
      draggable={false}
    />
  );
}

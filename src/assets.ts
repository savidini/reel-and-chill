import type { Catalog } from './types.ts';

/** Resolve public files under Vite's deployment base, keeping external URLs intact. */
export function publicAsset(path: string, base = import.meta.env?.BASE_URL ?? '/'): string {
  if (!path || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(path)) return path;
  const prefix = '/' + base.replace(/^\/+|\/+$/g, '') + '/';
  const normalizedBase = prefix === '//' ? '/' : prefix;
  if (path.startsWith(normalizedBase)) return path;
  return normalizedBase + path.replace(/^\/+/, '');
}

/** Adapt the committed schema at the loading boundary; leave the snapshot untouched. */
export function resolveCatalogAssets(catalog: Catalog, base?: string): Catalog {
  const images = <T extends { image: string | null }>(rows: T[]): T[] => rows.map(row => ({
    ...row, image: row.image ? publicAsset(row.image, base) : row.image,
  }));
  return {
    ...catalog,
    fish: images(catalog.fish),
    locations: images(catalog.locations),
    areas: images(catalog.areas),
    equipment: images(catalog.equipment),
    achievements: images(catalog.achievements),
    cosmetics: images(catalog.cosmetics),
    timeIcons: Object.fromEntries(Object.entries(catalog.timeIcons).map(([time, path]) =>
      [time, publicAsset(path, base)])) as Catalog['timeIcons'],
  };
}

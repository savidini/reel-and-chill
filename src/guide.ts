import type { Achievement, Article, Catalog, Condition, Equipment, Filters, Fish, Named, Size } from './types.ts';
import { achievementNotes } from './content/achievements.ts';
import { publicAsset } from './assets.ts';

export const times = ['dawn', 'day', 'dusk', 'night'] as const;
export const sizeOrder: Size[] = ['s', 'm', 'l', 'xl', 'xxl', 'xxxl'];
export const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replaceAll('-', ' ');
export const nameOf = (list: Named[], id?: string | null) => list.find(x => x.id === id)?.name ?? (id ? titleCase(id) : 'None specified');
export const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
export const matchesText = (text: string, query = '') => normalize(query).split(' ').every(word => normalize(text).includes(word));
export const fishLabel = (f: Fish) => f.name + (f.variant === 'ice' ? ' (Ice)' : '');
export const fishSearchText = (f: Fish) => [f.name, f.id, f.speciesId, f.legendName, ...f.aliases, f.variant === 'ice' ? 'ice frozen' : ''].join(' ');

export function matchingConditions(fish: Fish, filters: Filters): Condition[] {
  return fish.conditions.filter(c =>
    (!filters.water || c.locationId === filters.water) &&
    (!filters.time || (filters.time === 'unknown' ? c.timeStatus === 'unknown' : c.timeStatus !== 'unknown' && c.times.includes(filters.time as typeof times[number]))) &&
    (!filters.size || c.sizes.includes(filters.size as Size)) &&
    (!filters.encounter || (filters.encounter === 'trophy' ? c.trophyPossible : c.encounter === filters.encounter))
  );
}
export function filterFish(fish: Fish[], filters: Filters): Fish[] {
  const result = fish.filter(f => matchesText(fishSearchText(f), filters.q) &&
    (!filters.rarity || f.rarity === filters.rarity) &&
    (!filters.variant || f.variant === filters.variant) &&
    (!filters.lure || f.preferredLures.includes(filters.lure)) &&
    matchingConditions(f, filters).length > 0);
  if (filters.sort === 'name') result.sort((a, b) => fishLabel(a).localeCompare(fishLabel(b)));
  if (filters.sort === 'weight') result.sort((a, b) => b.weight.max - a.weight.max);
  return result;
}
export function timeLabel(c: Pick<Condition, 'timeStatus' | 'times'>) {
  if (c.timeStatus === 'unknown') return 'Time unconfirmed';
  if (c.timeStatus === 'unrestricted') return 'Any time';
  return c.times.map(titleCase).join(' · ');
}
export const coins = (n: number) => n.toLocaleString('en-US') + ' coins';
export function weight(n: number, unit: string = 'lb') {
  if (unit === 'kg') return (n * 0.45359237).toLocaleString('en-US', { maximumFractionDigits: n < 2 ? 2 : 1 }) + ' kg';
  const ounces = Math.round(n * 16);
  const lb = Math.floor(ounces / 16), oz = ounces % 16;
  return [lb ? `${lb.toLocaleString('en-US')} lb` : '', oz ? `${oz} oz` : ''].filter(Boolean).join(' ') || '0 lb';
}
export function suggestedTackle(catalog: Catalog, fish: Fish, size: Size) {
  const rods = catalog.equipment.filter(e => e.kind === 'rod' && e.sizes.includes(size) && e.environment === fish.variant)
    .sort((a, b) => Number(b.lineType === fish.preferredLine) - Number(a.lineType === fish.preferredLine) || a.cost - b.cost);
  const lures = catalog.equipment.filter(e => e.kind === 'lure' && e.sizes.includes(size) && fish.preferredLures.includes(e.lureType ?? '') && !fish.ignoredLures.includes(e.lureType ?? ''))
    .sort((a, b) => Number(b.bonuses?.includes(fish.id)) - Number(a.bonuses?.includes(fish.id)) || a.cost - b.cost);
  return { rods, lures };
}
export function fishForEquipment(catalog: Catalog, item: Equipment) {
  if (item.kind === 'boat') return [];
  return catalog.fish.filter(f => item.sizes.some(s => f.sizes.includes(s)) &&
    (item.kind === 'rod' ? item.environment === f.variant : f.preferredLures.includes(item.lureType ?? '')));
}
export type SearchResult = { title: string; subtitle: string; href: string; image?: string | null };
export const achievementCategory = (a: Achievement) => a.kind === 'CatchTrophy' ? 'legendary' : a.bundles.includes('cabin') ? 'cabin' : 'general';
export const achievementCategories = [
  { id: 'general', name: 'Fishing & exploration' },
  { id: 'legendary', name: 'Legendary fish' },
  { id: 'cabin', name: 'Cabin & pond' },
];
export function achievementSearchText(a: Achievement, catalog: Catalog) {
  const note = achievementNotes[a.id];
  const fish = catalog.fish.filter(f => a.fish?.id === f.id || note?.fishIds?.includes(f.id));
  const locations = catalog.locations.filter(l => note?.locationIds?.includes(l.id) || fish.some(f => f.conditions.some(c => c.locationId === l.id && c.encounter === 'legendary')));
  return [a.name, a.description, note?.tip, ...fish.map(fishSearchText), ...locations.map(l => `${l.name} ${nameOf(catalog.areas, l.areaId)}`)].join(' ');
}
export function filterAchievements(catalog: Catalog, query = '', kind = '') {
  return catalog.achievements.filter(a => (!kind || achievementCategory(a) === kind) && matchesText(achievementSearchText(a, catalog), query));
}
export function searchGuide(catalog: Catalog, articles: Article[], query: string): SearchResult[] {
  if (!normalize(query)) return [];
  return [
    ...catalog.fish.filter(f => matchesText(fishSearchText(f), query)).map(f => ({ title: fishLabel(f), subtitle: f.legendName ? `Fish Atlas · ${f.legendName}` : 'Fish Atlas', href: `#/fish/${f.id}`, image: f.image })),
    ...catalog.locations.filter(x => matchesText(`${x.name} ${nameOf(catalog.areas, x.areaId)}`, query)).map(x => ({ title: x.name, subtitle: 'Waters & regions', href: `#/waters/${x.id}` })),
    ...catalog.equipment.filter(x => matchesText(`${x.name} ${x.kind} ${x.lureType} ${x.description}`, query)).map(x => ({ title: x.name, subtitle: `Tackle · ${titleCase(x.kind)}`, href: `#/tackle/${x.id}`, image: x.image })),
    ...articles.filter(x => matchesText(`${x.title} ${x.summary} ${x.keywords.join(' ')} ${x.sections.flatMap(s => s.paragraphs).join(' ')}`, query)).map(x => ({ title: x.title, subtitle: 'Handbook · ' + titleCase(x.category), href: `#/handbook/${x.id}` })),
    ...filterAchievements(catalog, query).map(x => ({ title: x.name, subtitle: 'Achievements', href: `#/achievements?q=${encodeURIComponent(x.name)}`, image: x.image })),
    ...catalog.cosmetics.filter(x => matchesText(`${x.name} ${x.kind}`, query)).map(x => ({ title: x.name, subtitle: 'Companions & wardrobe', href: `#/wardrobe?q=${encodeURIComponent(x.name)}`, image: x.image })),
  ];
}
export const sceneFor = (id: string) => {
  const exact: Record<string, string> = { 'river1-spot1': 'fork', 'river1-spot2': 'fork', 'river1-spot3': 'mistwood', 'river2-spot1': 'rapids', 'river2-spot2': 'eagles', 'lake1-spot1': 'meadow', 'lake1-spot2': 'meadow', 'lake1-spot3': 'meadow', 'lake2-spot1': 'autumn', 'lake2-spot2': 'autumn', 'ocean1-spot1': 'ocean', 'ocean1-spot2': 'ocean', 'ocean1-spot3': 'ocean', 'ocean2-spot1': 'deep', 'ocean2-spot2': 'deep', 'ice1-spot1': 'ice', 'cabin1': 'cabin' };
  return publicAsset('/game-assets/scenes/' + (exact[id] ?? id) + '.webp');
};

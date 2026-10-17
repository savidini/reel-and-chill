import { useEffect, useState } from 'react';
import type { Article, Catalog, Fish } from '../types';
import { fishLabel, nameOf, sizeOrder, timeLabel } from '../guide';

export type Route = { chapter: string; id?: string; params: URLSearchParams };
export type ViewProps = { catalog: Catalog; articles: Article[]; route: Route; unit: string; onOriginal: () => void };

function readRoute(): Route {
  const [path, query] = (location.hash.slice(1) || '/home').split('?');
  const [chapter, rawId] = path.replace(/^\//, '').split('/');
  let id = rawId;
  try { if (id) id = decodeURIComponent(id); } catch { /* Unknown IDs fall back to the index. */ }
  return { chapter: chapter || 'home', id, params: new URLSearchParams(query) };
}
export function useRoute() {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const change = () => setRoute(readRoute());
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  return route;
}
export function useUnits() {
  const [unit, setUnit] = useState(() => { try { return localStorage.getItem('cast-guide-unit') === 'kg' ? 'kg' : 'lb'; } catch { return 'lb'; } });
  useEffect(() => { try { localStorage.setItem('cast-guide-unit', unit); } catch { /* Preferences also work in memory. */ } }, [unit]);
  return [unit, setUnit] as const;
}
export const href = (chapter: string, id?: string) => `#/${chapter}${id ? '/' + encodeURIComponent(id) : ''}`;
export function Glyph({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    arrow: <path d="M4 12h15m-6-6 6 6-6 6"/>,
    back: <path d="M20 12H5m6-6-6 6 6 6"/>,
    search: <><circle cx="10" cy="10" r="6.5"/><path d="m15 15 5.5 5.5"/></>,
    fish: <><path d="M3 12c5-9 12-9 16 0-4 9-11 9-16 0Zm16 0 3-5v10l-3-5Z"/><circle cx="7" cy="11" r=".6"/><path d="M10 6v12"/></>,
    map: <><path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16"/></>,
    book: <><path d="M12 5C9 3 5 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Zm0 0v15"/></>,
    star: <path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z"/>,
    pin: <><path d="M19 9c0 6-7 12-7 12S5 15 5 9a7 7 0 0 1 14 0Z"/><circle cx="12" cy="9" r="2.5"/></>,
    check: <path d="m5 12 4 4L20 5"/>,
    close: <path d="m5 5 14 14M5 19 19 5"/>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/></>,
    hook: <path d="M16 2v13a6 6 0 0 1-12 0v-4l4 4M16 6h4"/>,
    waves: <path d="M2 7q3-4 6 0t6 0 6 0M2 13q3-4 6 0t6 0 6 0M2 19q3-4 6 0t6 0 6 0"/>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.fish}</svg>;
}
export function Sprite({ fish, className = '' }: { fish: { image: string | null; name: string }; className?: string }) {
  return fish.image ? <img className={`alt-sprite ${className}`} src={fish.image} alt=""/> : <Glyph name="fish" size={64}/>;
}
export function windowsFor(fish: Fish, catalog: Catalog, legendary = false) {
  // Magazine/album summaries combine identical place/time windows across habitats.
  // Keep different time windows separate so combining sizes never invents a catch.
  const groups = new Map<string, { locationId: string; time: string; sizes: Set<string> }>();
  for (const c of fish.conditions.filter(c => c.encounter === (legendary ? 'legendary' : 'ordinary'))) {
    const time = timeLabel(c);
    const key = `${c.locationId}/${c.timeStatus}/${time}`;
    const group = groups.get(key) || { locationId: c.locationId, time, sizes: new Set<string>() };
    c.sizes.forEach(size => group.sizes.add(size));
    groups.set(key, group);
  }
  return [...groups.values()].map(g => ({ place: nameOf(catalog.locations, g.locationId), locationId: g.locationId,
    time: g.time, sizes: sizeOrder.filter(size => g.sizes.has(size)).join(' · ').toUpperCase() }));
}
export function titleFor(route: Route, catalog: Catalog, articles: Article[]) {
  if (route.chapter === 'achievements') return 'Achievements';
  if (route.chapter === 'fish' && route.id) return fishLabel(catalog.fish.find(f => f.id === route.id) || catalog.fish[0]);
  if (route.chapter === 'waters' && route.id) return nameOf(catalog.locations, route.id);
  if (route.chapter === 'handbook' && route.id) return articles.find(a => a.id === route.id)?.title || 'Field notes';
  return route.chapter === 'home' ? '' : ({ fish: 'Species', legends: 'Legends', waters: 'Waters', tackle: 'Equipment', handbook: 'Field notes', cabin: 'Old Moose Cabin' }[route.chapter] || 'Field Guide');
}
export function SkipLink() {
  return <a className="skip-link" href="#alternative-content" onClick={e => { e.preventDefault(); document.getElementById('alternative-content')?.focus(); }}>Skip to content</a>;
}
export function SourceFootnote({ catalog }: { catalog: Catalog }) {
  return <details className="alt-source"><summary>About these records</summary><p>Reel &amp; Chill · Your Cast n Chill companion. Game catalog version {catalog.meta.gameVersion}. Weights are approximate. Ice and open-water variants have separate records.</p></details>;
}

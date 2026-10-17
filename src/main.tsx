import React, { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Article, Catalog, Condition, Filters, Fish, Size, Source, Time, Upgrade } from './types';
import { coins, filterFish, fishForEquipment, fishLabel, matchingConditions, matchesText, nameOf, sceneFor, searchGuide, sizeOrder, suggestedTackle, timeLabel, times, titleCase, weight } from './guide';
import articleData from './content/articles.json';
import { publicAsset, resolveCatalogAssets } from './assets';
import { AsciiScene } from './components/AsciiScene';
import { Icon } from './components/Icon';
import { GuidePreferences, HeaderControls } from './components/GuidePreferences';
import { useUnits } from './designs/shared';
import { useTheme } from './useTheme';
import { useDesign } from './useDesign';
import { AlternativeGuide } from './designs/AlternativeGuide';
import { AchievementBrowser } from './components/AchievementBrowser';
import { achievementSource } from './content/achievements';
import './styles.css';
import './styles/cover.css';
import './styles/atlas.css';
import './styles/chapters.css';
import './styles/navigation.css';
import './styles/details.css';
import './styles/designs.css';
import './styles/header-controls.css';

const articles: Article[] = articleData;
const GuideContext = createContext<{ catalog: Catalog; unit: string }>({} as { catalog: Catalog; unit: string });
const useGuide = () => useContext(GuideContext);
const noun = (count: number, singular: string, plural = singular + 's') => count === 1 ? singular : plural;
const chapters = [
  ['fish', 'Fish Atlas'], ['legends', 'Legends & Trophies'],
  ['waters', 'Waters & Regions'], ['tackle', 'Tackle'],
  ['handbook', 'Fieldcraft'], ['cabin', 'Old Moose Cabin'],
  ['achievements', 'Achievements'], ['wardrobe', 'Companions & Wardrobe'],
  ['sources', 'Sources & Version'],
] as const;
const chapterDescriptions: Record<string, string> = {
  fish: 'Species, catch conditions, and compatible tackle. Filter to plan your next cast.',
  legends: 'Legendary locations, catch windows, and trophy thresholds.',
  waters: 'Fishing spots, region licences, and unlock requirements.',
  tackle: 'Compare rods, lures, boats, and upgrades for open water and ice.',
  handbook: 'Fishing techniques, progression, and practical advice.',
  cabin: 'Restoration, pond stocking, and your lakeside retreat.',
  achievements: 'Requirements, practical tips, and catch windows for every milestone.',
  wardrobe: 'Companions, outfits, hats, and boat colors.',
};

function getRoute() {
  const [path, query = ''] = (window.location.hash.slice(1) || '/home').split('?');
  const [chapter = 'home', id] = path.replace(/^\//, '').split('/');
  return { chapter: chapter || 'home', id, params: new URLSearchParams(query) };
}
function routeHref(chapter: string, id?: string, params?: URLSearchParams) {
  return `#/${chapter}${id ? '/' + encodeURIComponent(id) : ''}${params?.size ? '?' + params.toString() : ''}`;
}
function setParam(key: string, value: string) {
  const route = getRoute();
  if (value) route.params.set(key, value); else route.params.delete(key);
  history.replaceState(history.state, '', routeHref(route.chapter, route.id, route.params));
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}
function clearParams() {
  const route = getRoute();
  history.replaceState(history.state, '', routeHref(route.chapter, route.id));
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}
function TimeIcon({ time }: { time?: Time }) {
  const { catalog } = useGuide();
  return time ? <img className="time-icon" src={catalog.timeIcons[time]} width="18" height="14" alt="" aria-hidden="true"/> : <Icon name="clock" size={16}/>;
}
function Badge({ children, type = '' }: { children: React.ReactNode; type?: string }) {
  return <span className={`badge ${type}`}>{children}</span>;
}
function Sizes({ values, active }: { values: string[]; active?: string }) {
  return <span className="sizes" aria-label={`Sizes: ${values.join(', ').toUpperCase()}`}>{values.map(s => <span className={s === active ? 'selected' : ''} key={s}>{s.toUpperCase()}</span>)}</span>;
}
function Artwork({ image, name, className = '', eager = false }: { image: string | null; name: string; className?: string; eager?: boolean }) {
  return image ? <img src={image} alt={name} loading={eager ? 'eager' : 'lazy'} className={`pixel-art ${className}`} /> : <span className="art-fallback"><Icon name="fish" size={36}/></span>;
}
function Hero({ scene, eyebrow, title }: { scene: string; eyebrow?: string; title: string }) {
  const chapterIndex = chapters.findIndex(([, label]) => label === title);
  const description = chapterIndex >= 0 ? chapterDescriptions[chapters[chapterIndex][0]] : undefined;
  const overline = eyebrow || (chapterIndex >= 0 ? `Chapter ${String(chapterIndex + 1).padStart(2, '0')}` : undefined);
  return <div className="chapter-hero"><img src={sceneFor(scene)} alt=""/><div className="hero-copy">{overline && <span className="eyebrow">{overline}</span>}<h1>{title}</h1>{description && <p className="chapter-description">{description}</p>}</div></div>;
}
function SectionTitle({ title, aside, id }: { title: string; aside?: React.ReactNode; id?: string }) {
  return <div className="section-title"><h2 id={id} tabIndex={id ? -1 : undefined}>{title}</h2>{aside}</div>;
}
function SectionNav({ sections }: { sections: { id: string; label: string }[] }) {
  return <nav className="entry-nav" aria-label="On this page"><span>Jump to</span>{sections.map(section => <button key={section.id} onClick={() => {
    const target = document.getElementById(section.id);
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: 'start' });
  }}>{section.label}</button>)}</nav>;
}
function Sources({ sources, imported = false }: { sources?: Source[]; imported?: boolean }) {
  const { catalog } = useGuide();
  return <details className="source-note"><summary>Sources</summary>{imported && <p>Game {catalog.meta.gameVersion}. Weights are approximate.</p>}{!!sources?.length && <ul>{sources.map(s => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.title} ↗</a></li>)}</ul>}</details>;
}
function EmptyState({ title = 'No matches', text, reset = true }: { title?: string; text?: string; reset?: boolean }) {
  return <div className="empty-state"><h2>{title}</h2>{text && <p>{text}</p>}{reset && <button className="button" onClick={clearParams}>Clear filters</button>}</div>;
}
function SelectField({ label, field, value, options, all = 'All' }: { label: string; field: string; value: string; options: { id: string; name: string }[]; all?: string }) {
  return <label className="filter-label">{label}<select aria-label={label} value={value} onChange={e => setParam(field, e.target.value)}><option value="">{all}</option>{options.map(o => <option value={o.id} key={o.id}>{o.name}</option>)}</select></label>;
}
function FilterBar({ params, legends = false }: { params: URLSearchParams; legends?: boolean }) {
  const { catalog } = useGuide();
  const [expanded, setExpanded] = useState(false);
  const get = (key: string) => params.get(key) || '';
  const fields = [
    { label: 'Fishing spot', field: 'water', all: 'All waters', options: catalog.locations.filter(l => l.kind !== 'pond') },
    { label: 'Time of day', field: 'time', all: 'Any period', options: times.map(t => ({ id: t, name: titleCase(t) })) },
    { label: 'Lure family', field: 'lure', all: 'All lures', options: catalog.lureTypes },
    { label: 'Fish size', field: 'size', all: 'All sizes', options: sizeOrder.filter(size => catalog.fish.some(f => f.sizes.includes(size))).map(size => ({ id: size, name: size.toUpperCase() })) },
    { label: 'Rarity', field: 'rarity', all: 'All rarities', options: catalog.rarities },
    ...(!legends ? [{ label: 'Encounter', field: 'encounter', all: 'All encounters', options: [{ id: 'ordinary', name: 'Ordinary' }, { id: 'legendary', name: 'Legendary' }, { id: 'trophy', name: 'Trophy possible' }] }] : []),
    { label: 'Fishing mode', field: 'variant', all: 'Open water & ice', options: [{ id: 'open-water', name: 'Open water' }, { id: 'ice', name: 'Ice fishing' }] },
  ];
  const selected = fields.filter(f => get(f.field));
  return <div className="filter-panel">
    <div className="filter-search-row">
      <label className="inline-search"><Icon name="search" size={16}/><input aria-label="Search fish" placeholder={legends ? 'Search legends…' : 'Search fish…'} type="search" value={get('q')} onChange={e => setParam('q', e.target.value)}/></label>
      <button className="filter-toggle" aria-expanded={expanded} aria-controls="fish-filters" onClick={() => setExpanded(!expanded)}><Icon name="filters" size={16}/>Filters{selected.length > 0 && <span>{selected.length}</span>}</button>
      {params.size > 0 && <button className="reset-button" onClick={clearParams}>Reset</button>}
    </div>
    <div className={`filters ${expanded ? 'is-open' : ''}`} id="fish-filters">{fields.map(field => <SelectField key={field.field} {...field} value={get(field.field)}/>)}</div>
    {selected.length > 0 && <div className="active-filters" aria-label="Active filters">{selected.map(field => <button key={field.field} onClick={() => setParam(field.field, '')} aria-label={`Remove ${field.label.toLowerCase()} filter: ${field.options.find(o => o.id === get(field.field))?.name || get(field.field)}`}><span>{field.options.find(o => o.id === get(field.field))?.name || get(field.field)}</span><Icon name="close" size={12}/></button>)}</div>}
  </div>;
}
function FishCard({ fish, params, legends = false }: { fish: Fish; params?: URLSearchParams; legends?: boolean }) {
  const { catalog } = useGuide();
  const filters = Object.fromEntries(params ?? []) as Filters;
  const showing = matchingConditions(fish, { ...filters, ...(legends ? { encounter: 'legendary' } : {}) });
  const labels = [...new Set(showing.map(timeLabel))];
  const time = labels.length === 1 ? labels[0] : 'See catch windows';
  const iconTime = labels.length === 1 && showing[0]?.timeStatus === 'restricted' && showing[0].times.length === 1 ? showing[0].times[0] : undefined;
  const sizes = sizeOrder.filter(size => showing.some(c => c.sizes.includes(size)));
  const locations = [...new Set(showing.map(c => nameOf(catalog.locations, c.locationId)))];
  const entryParams = new URLSearchParams(params);
  if (legends) entryParams.set('from', 'legends');
  return <a className={`fish-card ${legends ? 'legend-card' : ''}`} href={routeHref('fish', fish.id, entryParams)}>
    <div className="specimen">{fish.variant === 'ice' && <span className="ice-mark">ICE</span>}<Artwork image={fish.image} name=""/><span className="specimen-rule"/></div>
    <div className="fish-card-copy">
      <div className="card-overline">{legends ? <span className="legend-label"><Icon name="legends" size={16}/>{fish.legendName}</span> : <span>{nameOf(catalog.rarities, fish.rarity)}{fish.legendary && <><Icon name="legends" size={12}/><span className="sr-only"> · Legendary encounter</span></>}</span>}<Icon name="arrow" size={16}/></div>
      <h3>{fish.name}{fish.variant === 'ice' && <small>Ice</small>}</h3>
      <p className="fish-location">{locations.join(' · ')}</p>
      <div className="fish-card-meta"><span>{fish.preferredLures.map(id => nameOf(catalog.lureTypes, id)).join(' · ')}</span><Sizes values={sizes}/></div>
      <p className="condition-caption"><TimeIcon time={iconTime}/>{time}</p>
    </div>
  </a>;
}
function Home({ onSearch }: { onSearch: () => void }) {
  const { catalog } = useGuide();
  const counts: Record<string, string> = {
    fish: `${catalog.meta.speciesCount} species`,
    legends: `${catalog.fish.filter(f => f.legendary).length} encounters`,
    waters: `${catalog.locations.length} locations`,
    tackle: `${catalog.equipment.length} items`,
    handbook: `${articles.filter(a => a.category !== 'cabin').length} topics`,
    cabin: `${articles.filter(a => a.category === 'cabin').length} topics`,
    achievements: `${catalog.achievements.length} achievements`,
    wardrobe: `${catalog.cosmetics.length} entries`,
    sources: `v${catalog.meta.gameVersion.split('(')[0]}`,
  };
  const coverScenes: Record<string, string> = { fish: 'fork', legends: 'night', waters: 'meadow' };
  return <div className="home-page">
    <div className="welcome-cover">
      <header className="welcome-heading">
        <span className="eyebrow">Your Cast n Chill companion.</span>
        <h1>Reel <span>&amp;</span> Chill</h1>
        <p>Find species, catch conditions,<br/>and the tackle to match.</p>
        <button className="home-search-button" onClick={onSearch}><Icon name="search" size={20}/><span>Search fish, waters, tackle…</span><kbd>Ctrl K</kbd></button>
        <a className="button primary welcome-atlas" href="#/fish">Open Fish Atlas <Icon name="arrow" size={16}/></a>
        <dl className="guide-stats"><div><dt>Species</dt><dd>{catalog.meta.speciesCount}</dd></div><div><dt>Waters</dt><dd>{catalog.locations.length}</dd></div><div><dt>Legends</dt><dd>{catalog.fish.filter(f => f.legendary).length}</dd></div></dl>
      </header>
      <section className="welcome-scene" aria-label="Aurora over the fjord"><AsciiScene scene="aurora-fjord"/></section>
    </div>
    <section className="chapter-index" aria-labelledby="chapter-index-title">
      <div className="chapter-index-heading"><h2 id="chapter-index-title">Explore the guide</h2><span>{chapters.length} chapters</span></div>
      <div className="chapter-grid">{chapters.map(([key, label], i) => <a className={`chapter-card ${coverScenes[key] ? 'illustrated' : ''}`} key={key} href={routeHref(key)}>
        {coverScenes[key] ? <img className="chapter-card-scene" src={sceneFor(coverScenes[key])} alt="" loading="lazy"/> : <span className="chapter-card-icon"><Icon name={key} size={24}/></span>}
        <div className="chapter-card-copy"><span className="chapter-card-number">{String(i + 1).padStart(2, '0')}</span><h3>{label}</h3><span className="chapter-card-count">{counts[key]}</span></div><Icon name="arrow" size={16}/>
      </a>)}</div>
    </section>
  </div>;
}
function Atlas({ params, legends = false }: { params: URLSearchParams; legends?: boolean }) {
  const { catalog } = useGuide();
  const [view, setView] = useState<'cards' | 'list'>(() => {
    try { return localStorage.getItem('cast-guide-fish-view') === 'list' ? 'list' : 'cards'; }
    catch { return 'cards'; }
  });
  const changeView = (next: 'cards' | 'list') => {
    setView(next);
    try { localStorage.setItem('cast-guide-fish-view', next); } catch { /* Keep the current view without storage. */ }
  };
  const filters = { ...Object.fromEntries(params), ...(legends ? { encounter: 'legendary' } : {}) } as Filters;
  const fish = filterFish(catalog.fish, filters);
  return <>
    <Hero scene={legends ? 'night' : 'fork'} title={legends ? 'Legends & Trophies' : 'Fish Atlas'}/>
    <div className="page-body">
      {legends && <details className="legend-introduction"><summary>Rusty’s legendary introduction</summary><Unlocks ids={["legendary-intro"]}/><p className="small-print">Whether this gates every legendary spawn is unconfirmed. Trophy weights are separate from size records.</p></details>}
      <FilterBar params={params} legends={legends}/>
      <div className="results-toolbar">
        <p role="status" aria-live="polite"><strong>{fish.length}</strong> {legends ? noun(fish.length, 'legendary encounter') : noun(fish.length, 'fish entry', 'fish entries')}</p>
        <div className="results-actions"><label><span className="sort-label">Sort</span><select aria-label="Sort fish" value={params.get('sort') || ''} onChange={e => setParam('sort', e.target.value)}><option value="">Default</option><option value="name">Name, A–Z</option><option value="weight">Maximum weight</option></select></label>
          <div className="view-switch" role="group" aria-label="Fish display"><button aria-label="Show fish as cards" aria-pressed={view === 'cards'} title="Card view" onClick={() => changeView('cards')}><Icon name="grid" size={18}/></button><button aria-label="Show fish as list" aria-pressed={view === 'list'} title="List view" onClick={() => changeView('list')}><Icon name="list" size={18}/></button></div>
        </div>
      </div>
      {fish.length ? <div className={`fish-grid ${view === 'list' ? 'fish-list' : ''}`}>{fish.map(f => <FishCard key={f.id} fish={f} params={params} legends={legends}/>)}</div> : <EmptyState text="Try a different name or remove a filter to broaden your search."/>}
    </div>
  </>;
}
function EntityLink({ id }: { id: string }) {
  const { catalog } = useGuide();
  const f = catalog.fish.find(x => x.id === id);
  const e = catalog.equipment.find(x => x.id === id);
  const l = catalog.locations.find(x => x.id === id);
  const a = catalog.areas.find(x => x.id === id);
  if (f) return <a href={`#/fish/${id}`}>{fishLabel(f)}</a>;
  if (e) return <a href={`#/tackle/${id}`}>{e.name}</a>;
  if (l) return <a href={`#/waters/${id}`}>{l.name}</a>;
  if (a) return <a href={`#/waters?region=${id}`}>{a.name}</a>;
  return <span>{titleCase(id)}</span>;
}
function LinkedList({ ids }: { ids: string[] }) {
  return <>{ids.map((id, i) => <React.Fragment key={id}>{i > 0 ? ', ' : ''}<EntityLink id={id}/></React.Fragment>)}</>;
}
function Unlocks({ ids, fallback = 'No additional unlock requirement.' }: { ids: string[]; fallback?: string }) {
  const { catalog } = useGuide();
  const keys = [...new Set(ids)].map(id => catalog.unlocks.find(k => k.id === id)).filter(x => !!x);
  if (!keys.length) return <p className="muted">{fallback}</p>;
  return <ul className="requirements">{keys.map(k => <li key={k.id}>
    {k.kind === 'CatchAllFish' ? 'Catch each of: ' : k.kind === 'CatchAnyFish' ? 'Catch any one of: ' : k.kind === 'DiscoverAllFish' ? 'Discover each of: ' : k.kind === 'DiscoverAnyFish' ? 'Discover any one of: ' : k.kind === 'VisitLocation' ? 'Visit any one of: ' : 'Unlock: '}
    {k.fishIds.length > 0 && <LinkedList ids={k.fishIds}/>}{k.locationIds.length > 0 && <>{k.fishIds.length > 0 ? '. Location requirement: ' : ''}<LinkedList ids={k.locationIds}/></>}{k.requiredItemIds.length > 0 && <LinkedList ids={k.requiredItemIds}/>}
    {!k.autoUnlock && <span className="requirement-tail"> · Then speak with Rusty.</span>}
  </li>)}</ul>;
}
function Breadcrumb({ chapter, title, params }: { chapter: string; title: string; params?: URLSearchParams }) {
  const filters = new URLSearchParams(params);
  filters.delete('from');
  return <div className="breadcrumb"><a href={routeHref(chapter, undefined, filters)}>← {chapters.find(c => c[0] === chapter)?.[1] ?? titleCase(chapter)}</a><span>/</span><span>{title}</span></div>;
}
function ConditionsTable({ fish, conditions }: { fish: Fish; conditions: Condition[] }) {
  const { unit } = useGuide();
  // Equivalent rows share a location, encounter, size band, and period. Collapse
  // only for display, retaining distinct exact ranges in the imported catalog.
  const groups = new Map<string, Condition[]>();
  conditions.forEach(c => { const key = [c.locationId, c.encounter, c.timeStatus, c.times.join(), c.sizes.join(), c.trophyPossible].join('|'); groups.set(key, [...(groups.get(key) ?? []), c]); });
  return <div className="table-scroll"><table className="conditions-table" role="table"><caption className="sr-only">Catch conditions for {fishLabel(fish)}</caption><thead><tr><th scope="col">Location</th><th scope="col">Time</th><th scope="col">Size & weight</th><th scope="col">Encounter</th></tr></thead><tbody>{[...groups.values()].map((group, i) => {
    const c = group[0];
    return <tr key={i}><td><span className="condition-label" aria-hidden="true">Location</span><EntityLink id={c.locationId}/></td><td><span className="condition-label" aria-hidden="true">Time</span><span className="time-cell"><TimeIcon time={c.timeStatus === 'restricted' && c.times.length === 1 ? c.times[0] : undefined}/>{timeLabel(c)}</span></td><td><span className="condition-label" aria-hidden="true">Size & weight</span><Sizes values={c.sizes}/><details className="weight-details"><summary>Approx. weight bands</summary>{group.map((g, n) => <span key={n}>{weight(g.weightRange[0], unit)} – {weight(g.weightRange[1], unit)}</span>)}</details></td><td><span className="condition-label" aria-hidden="true">Encounter</span><Badge type={c.encounter === 'legendary' ? 'gold' : ''}>{titleCase(c.encounter)}</Badge>{c.trophyPossible && <small className="trophy-note">Trophy possible</small>}</td></tr>;
  })}</tbody></table></div>;
}
function TackleSuggestion({ fish, initialSize }: { fish: Fish; initialSize?: Size }) {
  const { catalog, unit } = useGuide();
  const [size, setSize] = useState<Size>(initialSize && fish.sizes.includes(initialSize) ? initialSize : fish.sizes[fish.sizes.length - 1]);
  const { rods, lures } = suggestedTackle(catalog, fish, size);
  return <section className="tackle-suggestion" aria-labelledby="compatible-tackle"><SectionTitle id="compatible-tackle" title="Compatible tackle" aside={<label className="size-choice">Target size<select aria-label="Target tackle size" value={size} onChange={e => setSize(e.target.value as Size)}>{fish.sizes.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}</select></label>}/>
    <div className="setup-columns">{[{ label: 'Rods', items: rods }, { label: 'Preferred lures', items: lures }].map(group => <div key={group.label}><h3>{group.label}</h3>{group.items.length ? group.items.map(e => <a href={`#/tackle/${e.id}`} className="setup-item" key={e.id}><Artwork image={e.image} name=""/><div><strong>{e.name}</strong><small>{coins(e.cost)}{e.kind === 'rod' ? ` · ${nameOf(catalog.lineTypes, e.lineType)}` : e.bonuses?.includes(fish.id) ? ' · Species bonus' : ` · ${nameOf(catalog.lureTypes, e.lureType)}`}</small>{e.kind === 'rod' && <small>Strength: {weight(e.strength?.[0]?.weight ?? 0, unit)} → {weight(e.strength?.at(-1)?.weight ?? 0, unit)}</small>}</div><Icon name="arrow" size={16}/></a>) : <p>No matching equipment recorded.</p>}</div>)}</div>
    {fish.preferredLine && <p className="small-print">Preferred line: {nameOf(catalog.lineTypes, fish.preferredLine)}. Matching rods appear first.</p>}
  </section>;
}
function FishDetail({ id, params }: { id: string; params: URLSearchParams }) {
  const { catalog, unit } = useGuide();
  const fish = catalog.fish.find(f => f.id === id);
  if (!fish) return <NotFound/>;
  const legendary = fish.conditions.filter(c => c.encounter === 'legendary');
  const variants = catalog.fish.filter(f => f.speciesId === fish.speciesId && f.id !== fish.id);
  const locationIds = [...new Set(fish.conditions.map(c => c.locationId))];
  const areas = [...new Set(locationIds.map(id => catalog.locations.find(l => l.id === id)?.areaId))];
  return <div className="page-body detail-body"><Breadcrumb chapter={params.get('from') === 'legends' ? 'legends' : 'fish'} title={fishLabel(fish)} params={params}/>
    <div className="fish-feature">
      <header className="entry-heading"><span className="eyebrow">{fish.variant === 'ice' ? 'Ice fishing' : 'Open water'}</span><h1>{fish.name}</h1><div className="tag-line"><Badge>{nameOf(catalog.rarities, fish.rarity)}</Badge>{variants.map(v => <a className="variant-link" key={v.id} href={routeHref('fish', v.id, params)}>{v.variant === 'ice' ? 'Ice' : 'Open-water'} variant ↗</a>)}</div></header>
      <div className="specimen specimen-large"><Artwork image={fish.image} name={fishLabel(fish)} eager/><span className="specimen-rule"/></div>
      <dl className="fish-facts"><div><dt>Preferred lure</dt><dd>{fish.preferredLures.map(x => nameOf(catalog.lureTypes, x)).join(', ')}</dd></div><div><dt>Available sizes</dt><dd><Sizes values={fish.sizes}/></dd></div><div><dt>Weight range</dt><dd>{weight(fish.weight.min, unit)} – {weight(fish.weight.max, unit)}</dd></div><div><dt>Sale value</dt><dd>{coins(fish.value.min)} – {coins(fish.value.max)}</dd></div><div className="trophy-fact"><dt>Trophy threshold</dt><dd>≈ {weight(fish.trophyWeight, unit)}<small>{fish.trophyPercent}% on the species size scale</small></dd></div></dl>
    </div>
    <SectionNav sections={[{ id: 'catch-conditions', label: 'Conditions' }, { id: 'compatible-tackle', label: 'Tackle' }, { id: 'field-notes', label: 'Field notes' }]}/>
    <section className="detail-section" aria-labelledby="catch-conditions"><SectionTitle id="catch-conditions" title="Catch conditions"/>
      {legendary.length > 0 && <div className="legend-callout"><Icon name="legends" size={24}/><div><span className="eyebrow">Legendary encounter</span><h3>{fish.legendName}</h3>{legendary.map((c, index) => <p key={index}><EntityLink id={c.locationId}/> · <strong>{timeLabel(c)}</strong> · <Sizes values={c.sizes}/></p>)}{fish.id === 'walleye' && <p>The installed build allows any time; community guides sometimes list Day only. Rusty’s tip jar and wall mount introduce this challenge.</p>}</div></div>}
      <ConditionsTable fish={fish} conditions={fish.conditions}/>
      <p className="small-print">Weights are approximate. Time windows do not guarantee a spawn.</p>
    </section>
    <TackleSuggestion key={fish.id} fish={fish} initialSize={params.get('size') as Size | undefined}/>
    <section className="detail-section" aria-labelledby="field-notes"><SectionTitle id="field-notes" title="Field notes"/><div className="detail-columns"><section><h3>Unlocks</h3>{areas.map(id => { const a = catalog.areas.find(a => a.id === id); return a && <div key={id} className="access-note"><h4>{a.name}</h4><p>{a.cost ? `${a.requiresDeed ? 'Deed' : 'Licence'}: ${coins(a.cost)}.` : 'No licence fee.'}</p>{a.unlockIds.length > 0 && <Unlocks ids={a.unlockIds}/>}</div>; })}{locationIds.map(id => { const l = catalog.locations.find(l => l.id === id)!; return l.unlockIds.length > 0 && <div className="access-note" key={id}><h4><EntityLink id={id}/></h4><Unlocks ids={l.unlockIds}/></div>; })}</section>
      <section><h3>Behavior</h3>{fish.ignoredLures.length > 0 && <p>Ignores: {fish.ignoredLures.map(x => nameOf(catalog.lureTypes, x)).join(', ')}.</p>}<dl className="traits">{[['Stamina', fish.stamina], ['Speed', fish.speed], ['Vision', fish.vision], ['Hearing', fish.hearing]].map(([label, n]) => <div key={label}><dt>{label}</dt><dd>{n}<span className="trait-dots" aria-hidden="true">{'●'.repeat(Number(n))}</span></dd></div>)}</dl><p className="small-print">Higher ratings mean a stronger trait.</p></section></div></section>
    <Sources imported sources={[{ title: 'Community fish reference', url: fish.source }]}/>
  </div>;
}
function Waters({ params }: { params: URLSearchParams }) {
  const { catalog } = useGuide();
  const region = params.get('region') || '';
  return <><Hero scene="meadow" title="Waters & Regions"/><div className="page-body"><div className="chapter-intro"><SelectField label="Region" field="region" value={region} all="All regions" options={catalog.areas}/></div>
    {catalog.areas.filter(a => !region || a.id === region).map(area => <section key={area.id} className="region-section"><SectionTitle title={area.name} aside={<span className="region-price">{area.cost ? `${area.requiresDeed ? 'Deed' : 'Licence'} · ${coins(area.cost)}` : 'No licence fee'}</span>}/>{area.unlockIds.length > 0 && <Unlocks ids={area.unlockIds}/>}<div className="location-grid">{catalog.locations.filter(l => l.areaId === area.id).map(l => <a href={`#/waters/${l.id}`} key={l.id} className="location-card"><img src={sceneFor(l.id)} alt="" loading="lazy"/><div><span className="eyebrow">{titleCase(l.kind)}{l.kind !== 'pond' && ` · ${l.fishIds.length} fish entries`}</span><h3>{l.name}</h3>{l.hint && <p>{l.hint}</p>}</div></a>)}</div></section>)}
  </div></>;
}
function LocationDetail({ id, params }: { id: string; params: URLSearchParams }) {
  const { catalog } = useGuide();
  const location = catalog.locations.find(l => l.id === id);
  if (!location) return <NotFound/>;
  const area = catalog.areas.find(a => a.id === location.areaId)!;
  const fish = filterFish(catalog.fish, { water: id, time: params.get('time') || '', encounter: params.get('encounter') || '' });
  return <><Hero scene={id} eyebrow={`${area.name} · ${titleCase(location.kind)}`} title={location.name}/><div className="page-body"><Breadcrumb chapter="waters" title={location.name}/><div className="detail-columns"><section><h2>Unlocks</h2><p>{area.cost ? `${area.requiresDeed ? 'Deed' : 'Region licence'}: ${coins(area.cost)}.` : 'No licence fee.'}</p>{(area.unlockIds.length > 0 || location.unlockIds.length > 0) && <Unlocks ids={[...area.unlockIds, ...location.unlockIds]}/>}</section>{location.kind === 'ice' && <section><h2>Equipment</h2><p>Snow Wolf XT1 and an ice rod. Dismount on the ice to drill a hole.</p><a href="#/tackle?mode=ice">Ice tackle →</a></section>}{location.kind === 'pond' && <section><h2>Stocking</h2><p>Clear the rubbish, then stock freshwater species with completed size records.</p><p>Capacity: {location.restock.maxSpawns} species × {location.restock.maxFishPerSpawn} fish.</p></section>}</div>
      {location.kind !== 'pond' && <><SectionTitle title="Fish"/><div className="water-time-controls"><SelectField label="Time of day" field="time" value={params.get('time') || ''} all="Any period" options={times.map(t => ({ id: t, name: titleCase(t) }))}/><SelectField label="Encounter" field="encounter" value={params.get('encounter') || ''} all="All encounters" options={[{ id: 'ordinary', name: 'Ordinary' }, { id: 'legendary', name: 'Legendary' }, { id: 'trophy', name: 'Trophy possible' }]}/><p role="status">{fish.length} {noun(fish.length, 'fish entry', 'fish entries')}</p></div>{fish.length ? <div className="water-targets">{fish.map(f => <div key={f.id} className="water-target"><div className="water-target-title"><Artwork image={f.image} name=""/><h3><EntityLink id={f.id}/></h3><span>{f.preferredLures.map(l => nameOf(catalog.lureTypes, l)).join(', ')}</span></div><ConditionsTable fish={f} conditions={matchingConditions(f, { water: id, time: params.get('time') || '', encounter: params.get('encounter') || '' })}/></div>)}</div> : <EmptyState/>}</>}
      <Sources imported sources={[{ title: 'Community location reference', url: location.source }]}/>
    </div></>;
}
function Tackle({ params }: { params: URLSearchParams }) {
  const { catalog } = useGuide();
  const kind = params.get('kind') || '';
  const q = params.get('q') || '';
  const mode = params.get('mode') || '';
  const items = catalog.equipment.filter(e => (!kind || e.kind === kind) && (!mode || e.environment === mode || e.environment === 'both') && matchesText(`${e.name} ${e.kind} ${e.lureType ?? ''}`, q));
  return <><Hero scene="eagles" title="Tackle"/><div className="page-body"><div className="filter-panel"><div className="filter-search-row"><label className="inline-search"><Icon name="search"/><input type="search" aria-label="Search tackle" placeholder="Search tackle…" value={q} onChange={e => setParam('q', e.target.value)}/></label><button className="reset-button" onClick={clearParams}>Reset</button></div><div className="water-time-controls"><SelectField label="Equipment" field="kind" value={kind} all="All equipment" options={[{ id: 'rod', name: 'Rods' }, { id: 'lure', name: 'Lures' }, { id: 'boat', name: 'Boats & transport' }]}/><SelectField label="Fishing mode" field="mode" value={mode} all="Open water & ice" options={[{ id: 'open-water', name: 'Open water' }, { id: 'ice', name: 'Ice fishing' }]}/><p role="status">{items.length} {noun(items.length, 'item')}</p></div></div>
    {items.length ? <div className="equipment-grid">{items.map(e => <a href={routeHref('tackle', e.id, params)} key={e.id} className="equipment-card"><div className={`equipment-art ${e.kind}`}><Artwork image={e.image} name=""/></div><div className="equipment-card-copy"><span className="eyebrow">{e.kind === 'lure' ? nameOf(catalog.lureTypes, e.lureType) : titleCase(e.kind)}{e.environment === 'ice' ? ' · Ice' : ''}</span><h3>{e.name}</h3><div className="equipment-meta"><span>{e.cost ? coins(e.cost) : 'No purchase cost'}</span>{e.sizes.length > 0 && <Sizes values={e.sizes}/>}</div>{e.kind === 'rod' && <p>{nameOf(catalog.lineTypes, e.lineType)} line</p>}{e.kind === 'lure' && <p>{e.techniques?.map(t => nameOf(catalog.techniques, t)).join(' · ')}</p>}{e.kind === 'boat' && <p>{e.storage?.at(-1)?.capacity ?? 0} maximum storage slots</p>}</div></a>)}</div> : <EmptyState/>}
    <SectionTitle title="Fishing lines"/><div className="line-notes">{catalog.lineTypes.map(l => <article key={l.id}><h3>{l.name}</h3><p>{l.scaresSmallerFish ? 'Can scare smaller fish.' : 'Does not scare smaller fish.'}</p><p className="small-print"><LinkedList ids={catalog.equipment.filter(e => e.lineType === l.id).map(e => e.id)}/></p></article>)}</div>
  </div></>;
}
function Upgrades({ label, values, valueKey, suffix = '' }: { label: string; values: Upgrade[]; valueKey: keyof Upgrade; suffix?: string }) {
  const { unit } = useGuide();
  if (!values.length) return null;
  const total = values.slice(1).reduce((n, x) => n + x.cost, 0);
  return <section className="upgrade-table"><h3>{label}</h3><div className="table-scroll"><table><thead><tr><th>Level</th><th>{valueKey === 'weight' ? 'Line strength' : valueKey === 'capacity' ? 'Storage' : valueKey === 'maxSpeed' ? 'Relative speed' : 'Spool distance'}</th><th>Upgrade cost</th></tr></thead><tbody>{values.map(v => <tr key={v.level}><td>{v.level === 0 ? 'Included' : v.level}</td><td>{valueKey === 'weight' ? weight(v.weight ?? 0, unit) : `${v[valueKey]}${suffix}`}</td><td>{v.level === 0 ? 'Included with purchase' : coins(v.cost)}</td></tr>)}</tbody></table></div><p className="small-print">All {label.toLowerCase()} upgrades: {coins(total)}.{valueKey === 'maxSpeed' || valueKey === 'spoolDistance' ? ' Values use the game’s internal scale; real-world units are unconfirmed.' : ''}</p></section>;
}
function EquipmentDetail({ id, params }: { id: string; params: URLSearchParams }) {
  const { catalog } = useGuide();
  const item = catalog.equipment.find(e => e.id === id);
  if (!item) return <NotFound/>;
  const fish = fishForEquipment(catalog, item);
  const hasUpgrades = [item.strength, item.length, item.engine, item.storage].some(values => values?.length);
  return <div className="page-body detail-body equipment-detail"><Breadcrumb chapter="tackle" title={item.name} params={params}/>
    <div className="equipment-detail-head"><header className="entry-heading"><span className="eyebrow">{titleCase(item.kind)} · {item.environment === 'both' ? 'Open water & ice' : titleCase(item.environment)}</span><h1>{item.name}</h1><div className="tag-line"><Badge type="gold">{item.cost ? coins(item.cost) : 'No purchase cost'}</Badge>{item.sizes.length > 0 && <Sizes values={item.sizes}/>}</div></header><div className={`equipment-art large ${item.kind}`}><Artwork image={item.image} name="" eager/></div></div>
    <SectionNav sections={[{ id: 'equipment-overview', label: 'Overview' }, ...(hasUpgrades ? [{ id: 'equipment-upgrades', label: 'Upgrades' }] : []), ...(fish.length ? [{ id: 'matching-fish', label: 'Matching fish' }] : [])]}/>
    <section className="detail-section" aria-labelledby="equipment-overview"><SectionTitle id="equipment-overview" title="At a glance"/><div className="detail-columns"><section><h3>Unlocks</h3><Unlocks ids={item.unlockIds} fallback={item.kind === 'lure' && !item.startAvailable ? 'Check Rusty’s shop after discovering fish that use this lure.' : item.startAvailable || item.cost === 0 ? 'Available from the start.' : 'Buy from Rusty; no extra unlock requirement.'}/></section>{item.kind !== 'boat' && <section><h3>{item.kind === 'rod' ? 'Line & reel' : 'Lure & technique'}</h3>{item.kind === 'rod' ? <p>{nameOf(catalog.reelTypes, item.reelType)} reel · {nameOf(catalog.lineTypes, item.lineType)} line.</p> : <><p>Family: <strong>{nameOf(catalog.lureTypes, item.lureType)}</strong></p>{!!item.bonuses?.length && <p>Species bonuses: <LinkedList ids={item.bonuses}/></p>}{item.techniques?.map(t => <p className="technique-note" key={t}><strong>{nameOf(catalog.techniques, t)}.</strong> {techniqueAdvice[t]}</p>)}</>}</section>}</div></section>
    {hasUpgrades && <section className="detail-section" aria-labelledby="equipment-upgrades"><SectionTitle id="equipment-upgrades" title="Upgrades"/><div className="upgrade-grid">{item.strength && <Upgrades label="Strength" values={item.strength} valueKey="weight"/>}{item.length && <Upgrades label="Line length" values={item.length} valueKey="spoolDistance"/>}{item.engine && <Upgrades label="Engine" values={item.engine} valueKey="maxSpeed"/>}{item.storage && <Upgrades label="Storage" values={item.storage} valueKey="capacity" suffix=" slots"/>}</div></section>}
    {fish.length > 0 && <section className="detail-section" aria-labelledby="matching-fish"><SectionTitle id="matching-fish" title={item.kind === 'lure' ? 'Fish that prefer this lure family' : 'Fish with a matching size'} aside={<span className="muted">{fish.length} {noun(fish.length, 'entry', 'entries')}</span>}/><div className="compact-fish-grid">{fish.map(f => <a href={`#/fish/${f.id}`} key={f.id}><Artwork image={f.image} name=""/><div><strong>{fishLabel(f)}</strong><Sizes values={f.sizes.filter(s => item.sizes.includes(s))}/></div><Icon name="arrow" size={15}/></a>)}</div></section>}

    <Sources imported sources={[{ title: 'Community equipment reference', url: item.source }]}/>
  </div>;
}
const techniqueAdvice: Record<string, string> = { suspend: 'Hold the lure at the fish’s depth.', retrieve: 'Retrieve steadily through the fish’s path.', 'long-steady-retrieve': 'Use a long, steady retrieve.', rip: 'Pull briskly, then let the lure settle.', hop: 'Alternate short pulls and pauses.', jig: 'Make small, repeated movements at the target depth.' };
function ArticleLink({ article }: { article: Article }) {
  return <a className="article-link" href={`#/handbook/${article.id}`}><h3>{article.title}</h3><p>{article.summary}</p></a>;
}
function Handbook({ cabin = false, params }: { cabin?: boolean; params: URLSearchParams }) {
  const q = params.get('q') || '';
  const list = articles.filter(a => cabin ? a.category === 'cabin' : a.category !== 'cabin').filter(a => matchesText(`${a.title} ${a.summary} ${a.keywords.join(' ')}`, q));
  return <><Hero scene={cabin ? 'cabin' : 'mistwood'} title={cabin ? 'Old Moose Cabin' : 'Fieldcraft'}/><div className="page-body">
    <label className="inline-search standalone-search"><Icon name="search"/><input type="search" aria-label="Search handbook" placeholder="Search topics…" value={q} onChange={e => setParam('q', e.target.value)}/></label>
    {list.length ? <div className="article-link-grid">{list.map(a => <ArticleLink key={a.id} article={a}/>)}</div> : <EmptyState/>}
  </div></>;
}
function ArticleDetail({ id }: { id: string }) {
  const article = articles.find(a => a.id === id);
  if (!article) return <NotFound/>;
  const jumpTo = (index: number) => {
    const heading = document.getElementById(`article-section-${index}`);
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({ block: 'start' });
  };
  return <article className="page-body reading-page article-page">
    <Breadcrumb chapter={article.category === 'cabin' ? 'cabin' : 'handbook'} title={article.title}/>
    <header className="article-heading"><span className="eyebrow">{article.category === 'cabin' ? 'Old Moose Cabin' : 'Fieldcraft'}</span><h1>{article.title}</h1><p>{article.summary}</p></header>
    <nav className="article-contents" aria-label="On this page"><span>In this article</span>{article.sections.map((section, index) => <button key={section.heading} onClick={() => jumpTo(index)}><span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>{section.heading}<Icon name="arrow" size={14}/></button>)}</nav>
    <div className="article-body">{article.sections.map((section, index) => <section key={section.heading}><h2 id={`article-section-${index}`} tabIndex={-1}>{section.heading}</h2>{section.paragraphs.map((p, i) => <p key={i}>{p}</p>)}</section>)}</div>
    {(article.relatedFishIds.length > 0 || article.relatedEquipmentIds.length > 0) && <div className="related-entries">{article.relatedFishIds.length > 0 && <p><strong>Fish: </strong><LinkedList ids={article.relatedFishIds}/></p>}{article.relatedEquipmentIds.length > 0 && <p><strong>Tackle: </strong><LinkedList ids={article.relatedEquipmentIds}/></p>}</div>}<Sources sources={article.sources}/>
  </article>;
}
function Achievements({ params }: { params: URLSearchParams }) {
  const { catalog, unit } = useGuide();
  return <><Hero scene="autumn" title="Achievements"/><div className="page-body"><AchievementBrowser catalog={catalog} articles={articles} params={params} unit={unit} heading={false}/></div></>;
}
function Wardrobe({ params }: { params: URLSearchParams }) {
  const { catalog } = useGuide();
  const q = params.get('q') || '';
  const kind = params.get('kind') || '';
  const filtered = catalog.cosmetics.filter(c => (!kind || c.kind === kind) && matchesText(`${c.name} ${c.kind}`, q));
  return <><Hero scene="eagles" title="Companions & Wardrobe"/><div className="page-body"><div className="filter-panel"><label className="inline-search"><Icon name="search"/><input type="search" aria-label="Search wardrobe" placeholder="Search wardrobe…" value={q} onChange={e => setParam('q', e.target.value)}/></label><div className="water-time-controls"><SelectField label="Collection" field="kind" value={kind} all="Everything" options={[{ id: 'companion', name: 'Companions' }, { id: 'angler', name: 'Angler appearances' }, { id: 'hat', name: 'Hats' }, { id: 'outfit', name: 'Outfits' }, { id: 'boat-color', name: 'Boat colours' }]}/><p role="status">{filtered.length} {noun(filtered.length, 'entry', 'entries')}</p><button className="reset-button" onClick={clearParams}>Reset</button></div></div><div className="wardrobe-grid">{filtered.map(c => <article key={c.id} className="wardrobe-card"><div className="wardrobe-art"><Artwork image={c.image} name={c.name}/></div><span className="eyebrow">{titleCase(c.kind)}</span><h3>{c.name}</h3>{c.supporter && <Badge type="gold">Supporter Pack</Badge>}{c.colors.length > 0 && <div className="color-swatches" aria-label="Appearance colours">{c.colors.map((color, i) => <span key={i} style={{ background: color }} title={color}/>)}</div>}{c.boatId && <p><EntityLink id={c.boatId}/></p>}{c.unlockIds.length > 0 && <Unlocks ids={c.unlockIds}/>}</article>)}</div>{!filtered.length && <EmptyState/>}<Sources imported/></div></>;
}
function About() {
  const { catalog } = useGuide();
  return <div className="page-body reading-page">
    <h1>Sources & Version</h1>
    <section><h2>Game version</h2>
      <p>{catalog.meta.gameVersion} · Steam build {catalog.meta.steamBuild}<br/>Imported {new Date(catalog.meta.importedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.</p>
      <p>{catalog.meta.speciesCount} species · {catalog.fish.length} entries · {catalog.locations.length} locations · {catalog.equipment.length} equipment items · {catalog.achievements.length} achievements.</p>
      <p>Includes Autumnwood, Frozen Waters, and Old Moose Cabin. Ice variants have separate catch conditions.</p>
    </section>
    <section><h2>Data notes</h2>
      <p>Fish, equipment, prices, unlocks, and conditions come from the installed game. Handbook sources are linked on each article.</p>
      <ul>
        <li>Trophy and spawn weights are estimates. The in-game display takes precedence.</li>
        <li>Time labels use Dawn, Day, Dusk, and Night; exact clock hours are unconfirmed.</li>
        <li>Spawn records do not include all quest or respawn state.</li>
        <li>Unnamed cosmetic variants use game IDs. Supporter Pack companions are labelled.</li>
      </ul>
    </section>
    <section><h2>Sources & credits</h2>
      <p>Achievement tips: <a href={achievementSource.url} target="_blank" rel="noreferrer">{achievementSource.title} ↗</a>.</p>
      <ul>{catalog.meta.sources.map(s => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.title} ↗</a></li>)}</ul>
      <p>Reel &amp; Chill is an unofficial companion. Cast n Chill and its artwork belong to Wombat Brawler. Regional press-kit images may represent more than one fishing spot.</p>
      <p>Fira Sans: SIL Open Font License. DejaVu Sans Mono: Bitstream Vera licence. Cast Pixel: original display alphabet.</p><p>Aurora Fjord and Deep Reef ASCII scenes and renderer by <a href="https://ascii.rest/" target="_blank" rel="noreferrer">bas3line / ascii.rest</a>, <a href={publicAsset('/licenses/ascii-rest.txt')} target="_blank" rel="noreferrer">MIT licence</a>.</p>
    </section>
  </div>;
}
function NotFound() {
  return <div className="page-body"><EmptyState title="Page not found" reset={false}/><a className="button" href="#/fish">Fish Atlas</a></div>;
}

function trapDialogTab(event: React.KeyboardEvent<HTMLDialogElement>) {
  if (event.key !== 'Tab') return;
  const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]')].filter(el => el.getClientRects().length > 0);
  const first = controls[0], last = controls.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}
function ChapterNavigation({ active, close }: { active: string; close?: () => void }) {
  const { catalog } = useGuide();
  return <>
    <div className="sidebar-heading">
      <a className="brand" href="#/home" aria-label="Reel & Chill home" onClick={close}><span className="brand-fish"><Icon name="fish" size={48}/></span><span className="brand-title">Reel &amp; Chill</span><span className="brand-subtitle">Your Cast n Chill companion.</span></a>
      {close && <button className="icon-button drawer-close" onClick={close} aria-label="Close chapter index"><Icon name="close" size={16}/></button>}
    </div>
    <div className="index-label">CHAPTERS</div>
    <nav aria-label="Chapters">{([['home', 'Start'], ...chapters] as const).map(([key, label], i) => <a href={routeHref(key)} key={key} onClick={close} className={active === key ? 'active' : ''} aria-current={active === key ? 'page' : undefined}><span className="chapter-number">{String(i).padStart(2, '0')}</span><Icon name={key} size={16}/><span>{label}</span></a>)}</nav>
    <div className="sidebar-bottom">STEAM · v{catalog.meta.gameVersion.split('(')[0]}</div>
  </>;
}
function ChapterDrawer({ open, close, active }: { open: boolean; close: () => void; active: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) {
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      ref.current?.showModal();
      ref.current?.querySelector<HTMLElement>('[aria-current="page"]')?.focus();
    } else {
      ref.current?.close();
      returnFocus.current?.focus({ preventScroll: true });
      returnFocus.current = null;
    }
  }, [open]);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 981px)');
    const resized = () => { if (media.matches) close(); };
    media.addEventListener('change', resized);
    return () => media.removeEventListener('change', resized);
  }, [close]);
  return <dialog className="chapter-drawer sidebar" ref={ref} aria-label="Chapter index" onKeyDown={trapDialogTab} onCancel={e => { e.preventDefault(); close(); }} onClick={e => { if (e.target === ref.current) { const box = ref.current.getBoundingClientRect(); if (e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom) close(); } }}><ChapterNavigation active={active} close={close}/></dialog>;
}
function SearchDialog({ open, close }: { open: boolean; close: () => void }) {
  const { catalog } = useGuide();
  const ref = useRef<HTMLDialogElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const resultList = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchGuide(catalog, articles, query), [catalog, query]);
  // Clear the previous query before the open dialog can receive input. A
  // deferred reset can otherwise erase a quickly repeated search and its focus.
  useLayoutEffect(() => {
    if (open) {
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setQuery('');
      ref.current?.showModal();
      searchInput.current?.focus();
    } else {
      ref.current?.close();
      returnFocus.current?.focus({ preventScroll: true });
      returnFocus.current = null;
    }
  }, [open]);
  const moveResult = (event: React.KeyboardEvent) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const links = [...(resultList.current?.querySelectorAll<HTMLAnchorElement>('a') || [])];
    if (!links.length) return;
    event.preventDefault();
    const current = links.indexOf(document.activeElement as HTMLAnchorElement);
    const next = current + (event.key === 'ArrowDown' ? 1 : -1);
    if (next < 0) searchInput.current?.focus();
    else links[Math.min(next, links.length - 1)]?.focus();
  };
  return <dialog className="search-dialog" ref={ref} onKeyDown={e => { trapDialogTab(e); if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } }} onCancel={close} onClick={e => { if (e.target === ref.current) { const box = ref.current.getBoundingClientRect(); if (e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom) close(); } }} aria-labelledby="search-title">
    <div className="search-dialog-top"><h2 id="search-title">Search the guide</h2><button className="icon-button" onClick={close} aria-label="Close search"><Icon name="close" size={16}/></button></div>
    <label className="inline-search"><Icon name="search" size={16}/><input ref={searchInput} autoFocus type="search" aria-label="Search the whole guide" placeholder="Fish, places, tackle, topics…" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { moveResult(e); if (e.key === 'Enter' && results[0]) { e.preventDefault(); window.location.hash = results[0].href.slice(1); close(); } }}/></label>
    {query ? <><p className="search-count" role="status">{results.length} {results.length === 1 ? 'result' : 'results'}</p><div className="search-results" ref={resultList} onKeyDown={moveResult}>{results.map((r, i) => <a key={`${r.href}-${i}`} href={r.href} onClick={close}><span className="search-result-art">{r.image ? <Artwork image={r.image} name=""/> : <Icon name={r.href.split('/')[1]} size={24}/>}</span><div><strong>{r.title}</strong><small>{r.subtitle}</small></div><Icon name="arrow" size={16}/></a>)}{!results.length && <p className="search-empty">No matches. Try a fish, place, or lure name.</p>}</div></> : <div className="search-start"><p>Or browse a chapter</p><div className="search-chapters">{chapters.slice(0, 6).map(([key, label]) => <a key={key} href={routeHref(key)} onClick={close}><Icon name={key} size={20}/><span>{label}</span><Icon name="arrow" size={14}/></a>)}</div></div>}
    <div className="search-dialog-footer"><span><kbd>↑</kbd><kbd>↓</kbd> browse</span><span><kbd>↵</kbd> open</span><span><kbd>Esc</kbd> close</span></div>
  </dialog>;
}
function Guide({ catalog, unit }: { catalog: Catalog; unit: string }) {
  const [route, setRoute] = useState(getRoute);
  const [searchOpen, setSearchOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    const previousRestoration = history.scrollRestoration;
    history.scrollRestoration = 'manual';
    const positions = new Map<string, number>();
    let sequence = 0;
    const newEntry = () => `cast-${performance.timeOrigin}-${++sequence}`;
    let entry = history.state?.castEntry || newEntry();
    let path = `${getRoute().chapter}/${getRoute().id || ''}`;
    history.replaceState({ ...history.state, castEntry: entry }, '');
    let frame = 0;
    const remember = () => positions.set(entry, window.scrollY);
    const changed = () => {
      const next = getRoute();
      const nextPath = `${next.chapter}/${next.id || ''}`;
      const knownEntry = history.state?.castEntry as string | undefined;
      const returning = !!knownEntry && knownEntry !== entry;
      entry = knownEntry || newEntry();
      if (!knownEntry) history.replaceState({ ...history.state, castEntry: entry }, '');
      setRoute(next);
      setNavOpen(false);
      if (path !== nextPath || returning) {
        const top = returning ? positions.get(entry) || 0 : 0;
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          window.scrollTo(0, top);
          main.current?.focus({ preventScroll: true });
        });
      }
      path = nextPath;
    };
    window.addEventListener('scroll', remember, { passive: true });
    window.addEventListener('hashchange', changed);
    return () => {
      cancelAnimationFrame(frame);
      history.scrollRestoration = previousRestoration;
      window.removeEventListener('scroll', remember);
      window.removeEventListener('hashchange', changed);
    };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setNavOpen(false); setSearchOpen(s => !s); } if (e.key === 'Escape') setNavOpen(false); };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    if (!navOpen && !searchOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [navOpen, searchOpen]);
  const { chapter, id, params } = route;
  const activeChapter = chapter === 'fish' && params.get('from') === 'legends' ? 'legends' : chapter === 'handbook' && articles.find(a => a.id === id)?.category === 'cabin' ? 'cabin' : chapter;
  useEffect(() => { const name = chapter === 'fish' && id ? catalog.fish.find(f => f.id === id)?.name : chapter === 'tackle' && id ? catalog.equipment.find(e => e.id === id)?.name : chapter === 'waters' && id ? catalog.locations.find(l => l.id === id)?.name : chapter === 'handbook' && id ? articles.find(a => a.id === id)?.title : chapter === 'home' ? 'Field Guide' : chapters.find(c => c[0] === chapter)?.[1]; document.title = chapter === 'home' ? 'Reel & Chill · Your Cast n Chill companion.' : `${name || 'Field Guide'} · Reel & Chill`; }, [chapter, id, catalog]);
  let page: React.ReactNode;
  switch (chapter) {
    case 'home': page = <Home onSearch={() => setSearchOpen(true)}/>; break;
    case 'fish': page = id ? <FishDetail key={id} id={id} params={params}/> : <Atlas params={params}/>; break;
    case 'legends': page = <Atlas params={params} legends/>; break;
    case 'waters': page = id ? <LocationDetail id={id} params={params}/> : <Waters params={params}/>; break;
    case 'tackle': page = id ? <EquipmentDetail id={id} params={params}/> : <Tackle params={params}/>; break;
    case 'handbook': page = id ? <ArticleDetail id={id}/> : <Handbook params={params}/>; break;
    case 'cabin': page = <Handbook cabin params={params}/>; break;
    case 'achievements': page = <Achievements params={params}/>; break;
    case 'wardrobe': page = <Wardrobe params={params}/>; break;
    case 'sources': page = <About/>; break;
    default: page = <NotFound/>;
  }

  const chapterName = chapters.find(([key]) => key === activeChapter)?.[1] || 'Field guide';
  return <GuideContext.Provider value={{ catalog, unit }}>
    <a href="#main-content" className="skip-link" onClick={e => { e.preventDefault(); main.current?.focus(); }}>Skip to content</a>
    <div className="guide-shell">
      <aside className="sidebar desktop-sidebar"><ChapterNavigation active={activeChapter}/></aside>
      <div className="book">
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label={navOpen ? 'Close chapter index' : 'Open chapter index'} aria-expanded={navOpen} onClick={() => setNavOpen(!navOpen)}><Icon name={navOpen ? 'close' : 'menu'} size={16}/><span>{chapterName}</span></button>
          <a className="topbar-context" href={routeHref(activeChapter)}><Icon name={activeChapter} size={16}/>{chapterName}</a>
          <div className="topbar-actions">
            <button className="global-search-button" aria-label="Search guide" aria-keyshortcuts="Control+K Meta+K" onClick={() => setSearchOpen(true)}><Icon name="search" size={16}/><span>Search guide</span><kbd>Ctrl K</kbd></button>
            <HeaderControls/>
          </div>
        </header>
        <main id="main-content" ref={main} tabIndex={-1}>{page}</main>
      </div>
    </div>
    <ChapterDrawer open={navOpen} close={() => setNavOpen(false)} active={activeChapter}/>
    <SearchDialog open={searchOpen} close={() => setSearchOpen(false)}/>
  </GuideContext.Provider>;
}
function App() {
  const [theme, setTheme] = useTheme();
  const [unit, setUnit] = useUnits();
  const [design, setDesign] = useDesign();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { const controller = new AbortController(); fetch(publicAsset('/data/catalog.json'), { signal: controller.signal }).then(async response => { if (!response.ok) throw new Error('The catalog could not be loaded.'); const data = await response.json(); if (data.schemaVersion !== 1 || !data.fish?.length) throw new Error('The catalog is missing or has an unsupported format.'); setCatalog(resolveCatalogAssets(data)); }).catch(e => { if (e.name !== 'AbortError') setError(e.message); }); return () => controller.abort(); }, []);
  if (error) return <div className="boot-screen"><Icon name="handbook" size={48}/><p>Reel &amp; Chill</p><h1>Catalog unavailable</h1><p>We couldn’t load the catalog. Check your connection and try again.</p><button className="button" onClick={() => window.location.reload()}>Try again</button></div>;
  if (!catalog) return <div className="boot-screen" role="status"><Icon name="fish" size={56}/><h1>Reel &amp; Chill</h1><p>Your Cast n Chill companion.</p><p>Loading catalog…</p></div>;
  return <GuidePreferences design={design} setDesign={setDesign} theme={theme} setTheme={setTheme} unit={unit} setUnit={setUnit}>
    {design === 'original'
      ? <Guide catalog={catalog} unit={unit}/>
      : <AlternativeGuide catalog={catalog} articles={articles} design={design} setDesign={setDesign} unit={unit}/>}
  </GuidePreferences>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);

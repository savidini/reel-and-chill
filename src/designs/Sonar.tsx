import { HeaderControls } from '../components/GuidePreferences';
import { useEffect, useRef, useState } from 'react';
import { coins, filterFish, fishForEquipment, fishLabel, matchesText, matchingConditions, nameOf, suggestedTackle, timeLabel, times, titleCase, weight } from '../guide';
import type { Equipment, Fish, Size } from '../types';
import { Glyph, href, SourceFootnote, Sprite, type ViewProps } from './shared';
import { AchievementBrowser } from '../components/AchievementBrowser';
import './sonar.css';

export function Sonar({ catalog, articles, route, unit, onOriginal }: ViewProps) {
  const mode = route.chapter === 'achievements' ? 'achievements' : route.chapter === 'tackle' ? 'gear' : ['handbook', 'cabin', 'wardrobe', 'sources'].includes(route.chapter) ? 'notes' : 'fish';
  const [query, setQuery] = useState(route.params.get('q') || '');
  const [water, setWater] = useState(route.chapter === 'waters' && route.id ? route.id : route.params.get('water') || '');
  const [period, setPeriod] = useState(route.params.get('time') || '');
  const [onlyLegends, setOnlyLegends] = useState(route.chapter === 'legends');
  const [size, setSize] = useState('');
  const [gearKind, setGearKind] = useState('');
  const [sort, setSort] = useState('name');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [tackleSize, setTackleSize] = useState<Size>('s');
  const search = useRef<HTMLInputElement>(null);
  const previousMode = useRef(mode);
  const filters = { q: query, water, time: period, encounter: onlyLegends ? 'legendary' : '', size, sort };
  const fishResults = filterFish(catalog.fish, filters);
  const gearResults = catalog.equipment.filter(e => (!gearKind || e.kind === gearKind) && matchesText(`${e.name} ${e.kind} ${nameOf(catalog.lureTypes, e.lureType)}`, query)).sort((a,b) => a.name.localeCompare(b.name));
  const noteResults = articles.filter(a => matchesText(`${a.title} ${a.summary} ${a.keywords.join(' ')}`, query));
  const fish = fishResults.find(f => f.id === route.id) || fishResults[0];
  const gear = gearResults.find(e => e.id === route.id) || gearResults[0];
  const note = noteResults.find(a => a.id === route.id) || noteResults[0];
  const results = mode === 'fish' ? fishResults : gearResults;
  const isDetail = !!route.id && route.chapter !== 'waters';
  useEffect(() => {
    if (previousMode.current !== mode) { setQuery(''); previousMode.current = mode; }
    setFiltersOpen(false);
  }, [mode]);
  useEffect(() => {
    if (route.chapter === 'waters') setWater(route.id || '');
    if (route.chapter === 'legends') setOnlyLegends(true);
  }, [route.chapter, route.id]);
  useEffect(() => { if (fish) setTackleSize(fish.sizes[0]); }, [fish?.id]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      const editing = event.target instanceof HTMLElement && event.target.matches('input,select,textarea,[contenteditable=true]');
      if ((event.key === '/' && !editing) || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k')) {
        event.preventDefault();
        const input = search.current || document.querySelector<HTMLInputElement>('.achievement-search input');
        input?.focus(); input?.select();
      }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);
  const reset = () => { setQuery(''); setWater(''); setPeriod(''); setOnlyLegends(false); setSize(''); setGearKind(''); };
  const activeFilters = mode === 'fish' ? Number(!!water) + Number(!!period) + Number(onlyLegends) + Number(!!size) : Number(!!gearKind);
  const move = (e: React.KeyboardEvent) => {
    if (!['ArrowDown', 'ArrowUp'].includes(e.key)) return;
    const rows = [...document.querySelectorAll<HTMLAnchorElement>('.s-record-link')];
    if (!rows.length) return;
    e.preventDefault();
    const index = rows.indexOf(document.activeElement as HTMLAnchorElement);
    rows[Math.max(0, Math.min(rows.length - 1, index + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus();
  };
  const fishInspector = (f: Fish) => {
    const chosenSize = f.sizes.includes(tackleSize) ? tackleSize : f.sizes[0];
    const tackle = suggestedTackle(catalog, f, chosenSize);
    const windows = matchingConditions(f, filters);
    return <><div className="s-inspector-caption"><span>SPECIES / {String(catalog.fish.indexOf(f) + 1).padStart(3,'0')}</span><span>{f.variant === 'ice' ? 'ICE' : 'OPEN WATER'}</span></div><div className="s-specimen"><span className="s-specimen-cross one">+</span><Sprite fish={f}/><span className="s-specimen-cross two">+</span><span className="s-specimen-scale">{f.sizes.join(' / ').toUpperCase()}</span></div><div className="s-inspector-body"><header><span className="s-record-type">{titleCase(f.rarity)} fish</span><h2>{fishLabel(f)}</h2></header><dl className="s-numbers"><div><dt>Maximum</dt><dd>{weight(f.weight.max, unit)}</dd></div><div><dt>Trophy at</dt><dd>{weight(f.trophyWeight, unit)}</dd></div></dl><section><h3>Catch windows <span>{windows.length}</span></h3>{windows.map((c,i) => <div className="s-window" key={i}><a href={href('waters',c.locationId)}>{nameOf(catalog.locations,c.locationId)} <Glyph name="arrow" size={12}/></a><span>{timeLabel(c)}<small>{c.sizes.join(' · ').toUpperCase()}</small></span>{c.encounter === 'legendary' && <strong><Glyph name="star" size={12}/>{f.legendName}</strong>}</div>)}{!windows.length && <p>No catch window matches the active filters.</p>}</section><section className="s-preferences"><h3>Preferences</h3><dl><dt>Lure family</dt><dd>{f.preferredLures.map(l=>nameOf(catalog.lureTypes,l)).join(', ') || 'None specified'}</dd><dt>Line</dt><dd>{f.preferredLine ? nameOf(catalog.lineTypes,f.preferredLine) : 'None specified'}</dd></dl></section><section className="s-recommendations"><div><h3>Compatible tackle</h3><select aria-label="Tackle size" value={chosenSize} onChange={e=>setTackleSize(e.target.value as Size)}>{f.sizes.map(s=><option value={s} key={s}>{s.toUpperCase()}</option>)}</select></div>{[tackle.rods[0],tackle.lures[0]].filter(Boolean).map(e=><a href={href('tackle',e.id)} key={e.id}><Sprite fish={e}/><span>{e.name}<small>{titleCase(e.kind)} · {coins(e.cost)}</small></span><Glyph name="arrow" size={14}/></a>)}{(!tackle.rods.length || !tackle.lures.length) && <p>No compatible {tackle.rods.length ? 'lure' : 'rod'} for this size.</p>}</section><SourceFootnote catalog={catalog}/></div></>;
  };
  const gearInspector = (e: Equipment) => <><div className="s-inspector-caption"><span>EQUIPMENT / {titleCase(e.kind)}</span><span>{e.environment.toUpperCase()}</span></div><div className="s-specimen s-gear-specimen"><Sprite fish={e}/></div><div className="s-inspector-body"><header><span className="s-record-type">{e.startAvailable ? 'Starting equipment' : 'Shop equipment'}</span><h2>{e.name}</h2></header><dl className="s-numbers"><div><dt>Purchase</dt><dd>{coins(e.cost)}</dd></div><div><dt>Sizes</dt><dd>{e.sizes.join(' / ').toUpperCase() || '—'}</dd></div></dl><p>{e.description}</p><section className="s-preferences"><h3>Specifications</h3><dl><dt>Water</dt><dd>{titleCase(e.environment)}</dd>{e.lineType && <><dt>Line</dt><dd>{nameOf(catalog.lineTypes,e.lineType)}</dd></>}{e.lureType && <><dt>Family</dt><dd>{nameOf(catalog.lureTypes,e.lureType)}</dd></>}{e.techniques?.length ? <><dt>Techniques</dt><dd>{e.techniques.map(t=>nameOf(catalog.techniques,t)).join(', ')}</dd></> : null}</dl></section>{e.kind !== 'boat' && <section className="s-compatible-fish"><h3>Compatible species</h3>{fishForEquipment(catalog,e).map(f=><a href={href('fish',f.id)} key={f.id} onClick={reset}><Sprite fish={f}/><span>{fishLabel(f)}</span><Glyph name="arrow" size={14}/></a>)}</section>}<SourceFootnote catalog={catalog}/></div></>;

  return <div className="alt-app sonar-app">
    <header className="s-header"><a href={href('home')} className="s-brand" aria-label="Reel & Chill home"><span className="s-brand-mark" aria-hidden="true"><i/></span>Reel &amp; Chill<span className="s-brand-sub">Your Cast n Chill companion.</span></a><nav aria-label="Database tables">{[['fish','Species'],['tackle','Equipment'],['handbook','Notes'],['achievements','Achievements']].map(([key,label])=><a href={href(key)} key={key} aria-current={(key==='fish'&&mode==='fish')||(key==='tackle'&&mode==='gear')||(key==='handbook'&&mode==='notes')||(key==='achievements'&&mode==='achievements')?'page':undefined}>{label}</a>)}</nav><HeaderControls/></header>
    {mode !== 'achievements' && <div className="s-querybar"><Glyph name="search" size={21}/><label className="sr-only" htmlFor="s-query">Search {mode === 'fish' ? 'species' : mode === 'gear' ? 'equipment' : 'notes'}</label><input ref={search} id="s-query" type="search" placeholder={mode === 'fish' ? 'Search a species or a legend…' : mode === 'gear' ? 'Search equipment…' : 'Find a field note…'} value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={move}/><span className="s-query-hint"><kbd>/</kbd> to search</span><span className="s-query-status"><i/> GAME CATALOG</span></div>}
    {mode === 'achievements' ? <main id="alternative-content" tabIndex={-1}><AchievementBrowser catalog={catalog} articles={articles} params={route.params} unit={unit}/></main> : mode === 'notes' ? <main id="alternative-content" tabIndex={-1} className={`s-note-workspace ${isDetail ? 's-note-detail' : ''}`}><aside className="s-note-index"><h1>Field notes <span>{noteResults.length}</span></h1>{noteResults.map(a=><a href={href('handbook',a.id)} key={a.id} className={note?.id===a.id?'is-selected':''}><Glyph name="book" size={16}/><span>{a.title}<small>{a.category === 'cabin' ? 'Cabin' : 'Fishing'}</small></span></a>)}{!noteResults.length&&<p className="s-no-results">No matching notes. <button onClick={()=>setQuery('')}>Clear search</button></p>}</aside><article className="s-note-reader">{note ? <><a href={href('handbook')} className="s-back-results"><Glyph name="back" size={16}/>All notes</a><div className="s-note-meta">REFERENCE / {note.id.toUpperCase()}</div><h2>{note.title}</h2><p className="s-note-summary">{note.summary}</p>{note.sections.map(s=><section key={s.heading}><h3>{s.heading}</h3>{s.paragraphs.map(p=><p key={p}>{p}</p>)}</section>)}<details className="alt-source"><summary>Sources</summary>{note.sources.map(s=><p key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.title} ↗</a></p>)}</details></> : <p>No note selected.</p>}</article></main> : <main id="alternative-content" tabIndex={-1} className={`s-workbench ${isDetail ? 's-detail-open' : ''} ${filtersOpen ? 's-filters-open' : ''}`}>
      <aside className="s-filters" aria-label="Database filters" onKeyDown={e => { if (e.key === 'Escape') { setFiltersOpen(false); document.querySelector<HTMLButtonElement>('.s-filter-toggle')?.focus(); } }}><div className="s-filter-title">FILTERS<div><button onClick={reset}>Reset</button><button className="s-filters-close" aria-label="Close filters" onClick={() => { setFiltersOpen(false); document.querySelector<HTMLButtonElement>('.s-filter-toggle')?.focus(); }}><Glyph name="close" size={18}/></button></div></div>{mode === 'fish' ? <>
        <fieldset><legend>Water</legend><label className="s-select-label"><span className="sr-only">Fishing spot</span><select value={water} onChange={e=>setWater(e.target.value)} aria-label="Fishing spot"><option value="">All fishing spots</option>{catalog.locations.filter(l=>l.kind!=='pond').map(l=><option value={l.id} key={l.id}>{l.name}</option>)}</select></label></fieldset>
        <fieldset><legend>Time of day</legend>{[['','Any time'],...times.map(t=>[t,titleCase(t)])].map(([key,label])=><label className="s-radio" key={key}><input type="radio" name="sonar-time" checked={period===key} onChange={()=>setPeriod(key)}/><span>{label}</span>{key&&<img src={catalog.timeIcons[key as typeof times[number]]} alt=""/>}</label>)}</fieldset>
        <fieldset><legend>Fish size</legend><div className="s-size-filter">{['s','m','l','xl','xxl','xxxl'].map(s=><button key={s} aria-pressed={size===s} onClick={()=>setSize(size===s?'':s)}>{s.toUpperCase()}</button>)}</div></fieldset>
        <fieldset><legend>Encounters</legend><label className="s-checkbox"><input type="checkbox" checked={onlyLegends} onChange={e=>setOnlyLegends(e.target.checked)}/><span>Legends only</span></label></fieldset>
      </> : <fieldset><legend>Equipment type</legend>{[['','All equipment'],['rod','Rods'],['lure','Lures'],['boat','Boats']].map(([key,label])=><label className="s-radio" key={key}><input type="radio" name="sonar-gear" checked={gearKind===key} onChange={()=>setGearKind(key)}/><span>{label}</span></label>)}</fieldset>}<div className="s-filter-foot"><span>GAME {catalog.meta.gameVersion}</span><button onClick={onOriginal}>Open complete guide <Glyph name="arrow" size={12}/></button></div></aside>
      <section className="s-results" aria-label="Search results"><div className="s-results-heading"><h1>{mode==='fish'?'Species':'Equipment'}<span role="status">{results.length}</span></h1><button className="s-filter-toggle" aria-expanded={filtersOpen} onClick={()=>setFiltersOpen(!filtersOpen)}>{filtersOpen?'Done':`Filters${activeFilters?` (${activeFilters})`:''}`}</button>{mode==='fish'&&<label><span className="sr-only">Sort species</span><select aria-label="Sort species" value={sort} onChange={e=>setSort(e.target.value)}><option value="name">Name A–Z</option><option value="weight">Max weight ↓</option></select></label>}</div>
        {(water||period||size||onlyLegends)&&mode==='fish'&&<div className="s-active-filters">{water&&<button onClick={()=>setWater('')}>{nameOf(catalog.locations,water)} ×</button>}{period&&<button onClick={()=>setPeriod('')}>{titleCase(period)} ×</button>}{size&&<button onClick={()=>setSize('')}>{size.toUpperCase()} ×</button>}{onlyLegends&&<button onClick={()=>setOnlyLegends(false)}>Legends ×</button>}</div>}
        <div className="s-table-scroll" onKeyDown={move}><table className="s-records"><thead><tr><th>{mode==='fish'?'Species / variant':'Equipment'}</th><th>Size</th><th>{mode==='fish'?'Max weight':'Cost'}</th><th className="s-extra">{mode==='fish'?'Rarity':'Type'}</th></tr></thead><tbody>{mode==='fish'?fishResults.map(f=><tr key={f.id} className={fish?.id===f.id?'is-selected':''}><td><a className="s-record-link" href={href('fish',f.id)} aria-current={fish?.id===f.id?'true':undefined}><Sprite fish={f}/><span>{fishLabel(f)}{f.legendary&&<small><Glyph name="star" size={10}/>{f.legendName}</small>}</span></a></td><td className="s-mono">{f.sizes.length===1?f.sizes[0].toUpperCase():`${f.sizes[0].toUpperCase()}–${f.sizes.at(-1)?.toUpperCase()}`}</td><td className="s-mono">{weight(f.weight.max,unit)}</td><td className="s-extra"><span className={`s-rarity rarity-${f.rarity}`}>{titleCase(f.rarity)}</span></td></tr>):gearResults.map(e=><tr key={e.id} className={gear?.id===e.id?'is-selected':''}><td><a className="s-record-link" href={href('tackle',e.id)} aria-current={gear?.id===e.id?'true':undefined}><Sprite fish={e}/><span>{e.name}</span></a></td><td className="s-mono">{e.sizes.join('/').toUpperCase()||'—'}</td><td className="s-mono">{e.cost.toLocaleString()}</td><td className="s-extra">{titleCase(e.kind)}</td></tr>)}</tbody></table>{!results.length&&<div className="s-empty"><Glyph name="search" size={32}/><h2>No matching records</h2><p>Try a different search or remove a filter.</p><button onClick={reset}>Clear search and filters</button></div>}</div><div className="s-results-footer"><span>{results.length} / {mode==='fish'?catalog.fish.length:catalog.equipment.length} RECORDS</span><span>↑ ↓ navigate · Enter inspect</span></div>
      </section>
      <aside className="s-inspector" aria-label="Selected record"><a className="s-back-results" href={href(mode==='fish'?'fish':'tackle')}><Glyph name="back" size={16}/>Back to results</a>{mode==='fish'&&fish?fishInspector(fish):mode==='gear'&&gear?gearInspector(gear):<div className="s-empty"><Glyph name="fish" size={40}/><p>Select a record to inspect it.</p></div>}</aside>
    </main>}
  </div>;
}

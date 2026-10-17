import { AsciiScene } from '../components/AsciiScene';
import { HeaderControls } from '../components/GuidePreferences';
import { useEffect, useRef, useState } from 'react';
import { coins, filterFish, fishLabel, matchesText, matchingConditions, nameOf, sceneFor, suggestedTackle, timeLabel, times, titleCase, weight } from '../guide';
import type { Article, Catalog, Fish, Size, Time } from '../types';
import { Glyph, href, SourceFootnote, Sprite, type ViewProps } from './shared';
import { AchievementBrowser } from '../components/AchievementBrowser';
import './drift.css';

const waterCopy: Record<string, string> = {
  river: 'Follow the current. Find your quiet.',
  lake: 'A little stillness goes a long way.',
  ocean: 'Leave the shore behind.',
  ice: 'Clear your head. Cut through the ice.',
  pond: 'Every good day ends somewhere like this.',
};
const number = (n: number) => String(n).padStart(2, '0');
const readTime = (value: string | null): Time | '' => times.includes(value as Time) ? value as Time : '';
const waterHref = (id: string, time: Time | '') => `${href('waters', id)}${time ? `?time=${time}` : ''}`;

function TimePicker({ value, onChange }: { value: Time | ''; onChange: (time: Time | '') => void }) {
  return <fieldset className="d-time-picker"><legend>Time on the water</legend><div>
    {(['', ...times] as const).map(time => <button key={time} type="button" aria-pressed={value === time} onClick={() => onChange(time)}>{time ? titleCase(time) : 'Any time'}</button>)}
  </div></fieldset>;
}

function Shoal({ fish, unit, water, time = '' }: { fish: Fish[]; unit: string; water?: string; time?: Time | '' }) {
  return <div className="d-shoal">{fish.map((f, i) => {
    const params = new URLSearchParams();
    if (water) params.set('water', water);
    if (time) params.set('time', time);
    return <a className="d-fish-link" key={f.id} href={`${href('fish', f.id)}${params.size ? `?${params}` : ''}`}>
      <div className="d-fish-art"><span className="d-small-number" aria-hidden="true">{number(i + 1)}</span><Sprite fish={f}/><span className="d-fish-arrow"><Glyph name="arrow" size={22}/></span></div>
      <div className="d-fish-label"><h3>{fishLabel(f)}</h3><span>{f.legendary ? 'A legend lives here' : titleCase(f.rarity)}<small>To {weight(f.weight.max, unit)}</small></span></div>
    </a>;
  })}</div>;
}

function FishDetail({ fish, catalog, unit, water, time, onTime }: { fish: Fish; catalog: Catalog; unit: string; water?: string; time: Time | ''; onTime: (time: Time | '') => void }) {
  const [size, setSize] = useState<Size>(fish.sizes[0]);
  const [placeId, setPlaceId] = useState(water || '');
  const selectedWater = catalog.locations.find(l => l.id === water);
  const windows = matchingConditions(fish, { water: placeId, time, size });
  const tackle = suggestedTackle(catalog, fish, size);
  return <>
    <section className="d-specimen">
      <div className="d-specimen-copy"><a className="d-back" href={selectedWater ? waterHref(selectedWater.id, time) : href('fish')}><Glyph name="back" size={18}/>{selectedWater ? `Back to ${selectedWater.name}` : 'All fish'}</a><span className="d-eyebrow">{fish.variant === 'ice' ? 'Under the ice' : 'Below the surface'} / {titleCase(fish.rarity)}</span><h1>{fish.name}<em>{fish.variant === 'ice' ? 'The ice edition.' : 'Worth the wait.'}</em></h1><dl className="d-specimen-facts"><div><dt>Grows to</dt><dd>{weight(fish.weight.max, unit)}</dd></div><div><dt>Trophy from</dt><dd>{weight(fish.trophyWeight, unit)}</dd></div></dl></div>
      <div className="d-specimen-art"><span className="d-specimen-ring" aria-hidden="true"/><Sprite fish={fish}/><span className="d-specimen-caption">{fish.variant === 'ice' ? 'ICE FISHING' : 'OPEN WATER'} · {fish.sizes.join(' / ').toUpperCase()}</span></div>
    </section>
    <div className="d-catch-details d-content">
      <section className="d-windows"><span className="d-eyebrow">01 / The right place, the right time</span><h2>Find your moment.</h2>
        <div className="d-catch-controls"><label>Fishing spot<select value={placeId} onChange={e => setPlaceId(e.target.value)}><option value="">All locations</option>{fish.locationIds.map(id => <option key={id} value={id}>{nameOf(catalog.locations, id)}</option>)}</select></label><fieldset className="d-size-picker"><legend>Target size</legend><div>{fish.sizes.map(s => <button key={s} aria-pressed={s === size} onClick={() => setSize(s)}>{s.toUpperCase()}</button>)}</div></fieldset></div>
        <TimePicker value={time} onChange={onTime}/>
        <div className="d-window-count" role="status">{windows.length} matching catch {windows.length === 1 ? 'window' : 'windows'}</div>
        <div className="d-window-list">{windows.map((c, i) => <article className={c.encounter === 'legendary' ? 'd-legend-window' : ''} key={`${c.locationId}-${i}`}><div><span className="d-eyebrow">{c.encounter === 'legendary' ? `Legend / ${fish.legendName}` : 'Ordinary encounter'}</span><h3><a href={waterHref(c.locationId, time)}>{nameOf(catalog.locations, c.locationId)} <Glyph name="arrow" size={18}/></a></h3></div><p>{timeLabel(c)}<small>{weight(c.weightRange[0], unit)} – {weight(c.weightRange[1], unit)}</small></p></article>)}</div>
        {!windows.length && <div className="d-empty"><h3>A different moment, perhaps.</h3><p>No confirmed catch matches this place, time, and size. Change a filter to explore another window.</p><button onClick={() => { setPlaceId(''); onTime(''); }}>Show all places and times <Glyph name="arrow" size={18}/></button></div>}
      </section>
      <aside className="d-kit"><span className="d-eyebrow">02 / Bring the essentials</span><h2>Travel light.</h2><p>A compatible starting pair for a {size.toUpperCase()} catch.</p><div className="d-kit-list">{[tackle.rods[0], tackle.lures[0]].filter(Boolean).map(item => <div key={item.id}><Sprite fish={item}/><div><small>{titleCase(item.kind)}</small><h3>{item.name}</h3><span>{coins(item.cost)}</span></div></div>)}</div>{(!tackle.rods.length || !tackle.lures.length) && <p>No compatible {tackle.rods.length ? 'lure' : 'rod'} is listed for this size.</p>}<p className="d-fine">Match upgrades to your catch. These suggestions don’t check the tackle you own.</p><a className="d-text-link" href={href('handbook', 'matching-tackle')}>A little tackle know-how <Glyph name="arrow" size={18}/></a></aside>
    </div>
  </>;
}

function Notes({ articles, article }: { articles: Article[]; article?: Article }) {
  return article ? <article className="d-reading d-content"><a className="d-back" href={href('handbook')}><Glyph name="back" size={18}/>All notes</a><header><span className="d-eyebrow">A little know-how / {titleCase(article.category)}</span><h1>{article.title}</h1><p>{article.summary}</p></header><div className="d-reading-body">{article.sections.map((s, i) => <section key={s.heading}><span className="d-reading-number" aria-hidden="true">{number(i + 1)}</span><div><h2>{s.heading}</h2>{s.paragraphs.map(p => <p key={p}>{p}</p>)}</div></section>)}</div>{article.sources.length > 0 && <details className="d-note-sources"><summary>Sources & further reading</summary>{article.sources.map(s => <a key={s.url} href={s.url} target="_blank" rel="noreferrer">{s.title} ↗</a>)}</details>}</article>
    : <section className="d-notes d-content"><header className="d-page-heading"><span className="d-eyebrow">For the quiet hours</span><h1>A little less guesswork.<br/><em>A little more fishing.</em></h1><p>Small lessons to take with you.</p></header><div className="d-note-index">{articles.map((a, i) => <a key={a.id} href={href('handbook', a.id)}><span className="d-note-index-number">{number(i + 1)}</span><span><small>{titleCase(a.category)}</small><h2>{a.title}</h2><p>{a.summary}</p></span><Glyph name="arrow" size={28}/></a>)}</div></section>;
}

export function Drift({ catalog, articles, route, unit, onOriginal }: ViewProps) {
  const page = route.chapter === 'achievements' ? 'achievements' : ['fish', 'legends'].includes(route.chapter) ? 'fish' : ['home', 'waters'].includes(route.chapter) ? 'waters' : 'notes';
  const place = catalog.locations.find(l => route.chapter === 'waters' && l.id === route.id) || catalog.locations[0];
  const placeIndex = catalog.locations.indexOf(place);
  const previous = catalog.locations[(placeIndex - 1 + catalog.locations.length) % catalog.locations.length];
  const next = catalog.locations[(placeIndex + 1) % catalog.locations.length];
  const area = catalog.areas.find(a => a.id === place.areaId);
  const fish = route.chapter === 'fish' ? catalog.fish.find(f => f.id === route.id) : undefined;
  const water = fish?.locationIds.find(id => id === route.params.get('water'));
  const article = articles.find(a => a.id === route.id);
  const [moment, setMoment] = useState<Time | ''>(() => readTime(route.params.get('time')));
  const [query, setQuery] = useState('');
  const [onlyLegends, setOnlyLegends] = useState(route.chapter === 'legends');
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [waterQuery, setWaterQuery] = useState('');
  const directory = useRef<HTMLDialogElement>(null);
  const stopStrip = useRef<HTMLDivElement>(null);
  const listedWaters = catalog.locations.filter(l => matchesText(`${l.name} ${l.kind} ${nameOf(catalog.areas, l.areaId)}`, waterQuery));
  const openDirectory = () => {
    setWaterQuery('');
    directory.current?.showModal();
    setDirectoryOpen(true);
    directory.current?.querySelector('input')?.focus({ preventScroll: true });
    directory.current?.querySelector('.d-directory-list')?.scrollTo(0, 0);
  };
  const timeParam = route.params.get('time');
  const changeTime = (time: Time | '') => {
    setMoment(time);
    const params = new URLSearchParams(route.params);
    if (time) params.set('time', time); else params.delete('time');
    // Keep reload and browser Back on the chosen time without adding a history entry.
    history.replaceState(history.state, '', `${href(route.chapter, route.id)}${params.size ? `?${params}` : ''}`);
  };
  useEffect(() => {
    setMoment(readTime(timeParam));
    setOnlyLegends(route.chapter === 'legends');
    directory.current?.close();
    window.scrollTo(0, 0);
  }, [route.chapter, route.id, timeParam]);
  useEffect(() => {
    if (!directoryOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [directoryOpen]);
  useEffect(() => {
    const strip = stopStrip.current;
    const current = strip?.querySelector<HTMLElement>('[aria-current="location"]');
    if (!strip || !current) return;
    const center = () => strip.scrollTo({ left: current.offsetLeft - (strip.clientWidth - current.offsetWidth) / 2 });
    center();
    const observer = new ResizeObserver(center);
    observer.observe(strip);
    return () => observer.disconnect();
  }, [place.id, page]);
  const catches = filterFish(catalog.fish, page === 'waters' ? { water: place.id, time: moment } : { q: query, encounter: onlyLegends ? 'legendary' : '', sort: 'name' });

  return <div className={`alt-app drift-app ${page === 'waters' || fish ? 'd-immersive' : ''}`}>
    <header className="d-header"><a className="d-brand" href={href('home')} aria-label="Reel & Chill home">Reel &amp; Chill<span>Your Cast n Chill companion.</span></a><nav aria-label="Drift sections"><a href={href('waters')} aria-current={page === 'waters' ? 'page' : undefined}>The waters</a><a href={href('fish')} aria-current={page === 'fish' ? 'page' : undefined}>The fish</a><a href={href('handbook')} aria-current={page === 'notes' ? 'page' : undefined}>The notes</a><a href={href('achievements')} aria-current={page === 'achievements' ? 'page' : undefined}>Achievements</a></nav><HeaderControls/></header>
    <main id="alternative-content" tabIndex={-1}>
      {page === 'waters' ? <>
        <section className="d-landscape" aria-labelledby="d-water-title"><img className="d-landscape-image" key={sceneFor(place.id)} src={sceneFor(place.id)} alt={`${nameOf(catalog.areas, place.areaId)} scenery`} fetchPriority="high"/><div className="d-landscape-shade"/>
          <div className="d-landscape-copy"><span className="d-eyebrow">The waters / {number(placeIndex + 1)}</span><h1 id="d-water-title">{place.name}<span aria-hidden="true">.</span></h1><p>{waterCopy[place.kind]}</p><button className="d-discover" onClick={() => { const section = document.getElementById('d-below'); section?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); section?.focus({ preventScroll: true }); }}>{place.kind === 'pond' ? 'Make yourself at home' : 'Meet the fish'}<span aria-hidden="true">↘</span></button></div>
          <div className="d-next-stop"><span className="d-eyebrow">Up next</span><a href={waterHref(next.id, moment)} aria-label={`Next water: ${next.name}`}><span>{next.name}</span><Glyph name="arrow" size={32}/></a></div>
          <div className="d-landscape-footer"><span><Glyph name="waves" size={17}/>{nameOf(catalog.areas, place.areaId)}<i/> {titleCase(place.kind)}</span><span>{number(placeIndex + 1)} <b>/ {number(catalog.locations.length)}<span> places to unwind</span></b></span></div>
        </section>
        <nav className="d-water-navigation" aria-label="Browse waters"><a className="d-water-previous" href={waterHref(previous.id, moment)} aria-label={`Previous water: ${previous.name}`}><Glyph name="back" size={22}/></a><div className="d-stops" ref={stopStrip}>{catalog.locations.map((l, i) => <a key={l.id} href={waterHref(l.id, moment)} aria-current={l.id === place.id ? 'location' : undefined}><span>{number(i + 1)}</span>{l.name}</a>)}</div><a className="d-water-next" href={waterHref(next.id, moment)} aria-label={`Next water: ${next.name}`}><Glyph name="arrow" size={22}/></a><button className="d-all-waters" onClick={openDirectory} aria-haspopup="dialog" aria-expanded={directoryOpen} aria-controls="d-water-directory">All waters<Glyph name="search" size={18}/></button></nav>
        <section id="d-below" className="d-below d-content" tabIndex={-1}>
          <div className={`d-water-intro ${place.kind === 'ocean' ? 'd-reef-intro' : ''}`}><div className="d-water-intro-copy"><div><span className="d-eyebrow">{place.kind === 'pond' ? 'A place of your own' : 'Get to know the locals'}</span><h2>{place.kind === 'pond' ? 'Welcome home.' : 'Beneath the surface.'}</h2></div><div className="d-place-access"><span>Region licence <strong>{coins(area?.cost || 0)}</strong></span>{place.hint && <details><summary>Getting here</summary><p>{place.hint}</p>{area?.requiresDeed && <p>This region also requires a deed.</p>}</details>}</div></div>{place.kind === 'ocean' && <AsciiScene scene="deep-reef"/>}</div>
          {place.kind === 'pond' ? <div className="d-pond"><Glyph name="hook" size={54}/><div><h3>A pond full of your own stories.</h3><p>Bring home your catches and give them somewhere to stay. This pond has no native fish; its residents are yours to choose.</p><a className="d-text-link" href={href('handbook', 'pond-stocking')}>How to stock your pond <Glyph name="arrow" size={18}/></a></div></div> : <><div className="d-catch-bar"><TimePicker value={moment} onChange={changeTime}/><span role="status">{catches.length} fish to discover</span></div><Shoal fish={catches} unit={unit} water={place.id} time={moment}/>{!catches.length && <div className="d-empty"><h3>Quiet water at this hour.</h3><p>No confirmed catches for this time of day.</p><button onClick={() => changeTime('')}>Explore every time <Glyph name="arrow" size={18}/></button></div>}</>}
        </section>
      </> : page === 'fish' ? fish ? <FishDetail key={`${fish.id}/${water || ''}`} fish={fish} catalog={catalog} unit={unit} water={water} time={moment} onTime={changeTime}/> : <section className="d-fish-index d-content"><header className="d-page-heading"><span className="d-eyebrow">{catalog.meta.speciesCount} species. Endless reasons to stay.</span><h1>Something worth<br/><em>waiting for.</em></h1><p>From the first small catch to the one you’ll remember.</p></header><div className="d-index-controls"><label className="d-search"><Glyph name="search" size={20}/><input type="search" aria-label="Find a fish" placeholder="Name a fish. Or a legend…" value={query} onChange={e => setQuery(e.target.value)}/></label><button className="d-legends-toggle" aria-pressed={onlyLegends} onClick={() => setOnlyLegends(!onlyLegends)}><Glyph name="star" size={17}/>Legends only</button><span role="status">{catches.length} fish</span></div><Shoal fish={catches} unit={unit}/>{!catches.length && <div className="d-empty"><h2>No fish by that name.</h2><button onClick={() => { setQuery(''); setOnlyLegends(false); }}>Show all fish <Glyph name="arrow" size={18}/></button></div>}</section>
        : page === 'achievements' ? <AchievementBrowser catalog={catalog} articles={articles} params={route.params} unit={unit}/> : <Notes articles={articles} article={article}/>}
    </main>
    <footer className="d-footer"><div><a className="d-footer-brand" href={href('home')}>Reel &amp; Chill</a><span>No hurry. Just one more cast.</span></div><SourceFootnote catalog={catalog}/><button onClick={onOriginal}>The complete field guide <Glyph name="arrow" size={17}/></button></footer>
    <dialog id="d-water-directory" className="d-water-directory" ref={directory} aria-labelledby="d-directory-title" onClose={() => setDirectoryOpen(false)} onKeyDown={e => {
      if (e.key !== 'Tab') return;
      const stops = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href]')).filter(el => el.getClientRects().length > 0);
      const first = stops[0], last = stops[stops.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }} onClick={e => {
      if (e.target !== directory.current) return;
      const box = e.currentTarget.getBoundingClientRect();
      if (e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom) directory.current?.close();
    }}>
      <div className="d-directory-heading"><div><span className="d-eyebrow">The whole wide water</span><h2 id="d-directory-title">Choose a water.</h2></div><button onClick={() => directory.current?.close()} aria-label="Close water directory"><Glyph name="close" size={22}/></button></div>
      <label className="d-search d-water-search"><Glyph name="search" size={20}/><input type="search" aria-label="Find a water" placeholder="A place, a region, a river…" value={waterQuery} onChange={e => setWaterQuery(e.target.value)}/></label>
      <p className="d-directory-count" role="status">{listedWaters.length} of {catalog.locations.length} places</p>
      <div className="d-directory-list">{listedWaters.map(l => <a key={l.id} href={waterHref(l.id, moment)} onClick={() => directory.current?.close()} aria-current={l.id === place.id ? 'location' : undefined}><img src={sceneFor(l.id)} alt="" loading="lazy"/><span><strong>{l.name}</strong><small>{nameOf(catalog.areas, l.areaId)} · {titleCase(l.kind)}</small></span><Glyph name={l.id === place.id ? 'check' : 'arrow'} size={18}/></a>)}</div>
      {!listedWaters.length && <div className="d-empty"><h3>No water by that name.</h3><button onClick={() => setWaterQuery('')}>Show every place <Glyph name="arrow" size={18}/></button></div>}
    </dialog>
  </div>;
}

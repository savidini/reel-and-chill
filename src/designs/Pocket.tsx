import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { filterFish, fishLabel, matchesText, nameOf, sceneFor, titleCase, weight } from '../guide';
import { Glyph, href, Sprite, windowsFor, type ViewProps } from './shared';
import { AchievementBrowser } from '../components/AchievementBrowser';
import './pocket.css';

const caughtKey = 'cast-guide-caught-v1';
const palettes = ['peach','sage','lilac','butter','sky'];
function readCaught(): string[] { try { const value: unknown = JSON.parse(localStorage.getItem(caughtKey) || '[]'); return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []; } catch { return []; } }

export function Pocket({ catalog, articles, route, unit, onOriginal }: ViewProps) {
  const [caught, setCaught] = useState<string[]>(readCaught);
  const [query, setQuery] = useState('');
  const [shelf, setShelf] = useState(route.chapter === 'legends' ? 'legends' : 'all');
  const [noteQuery, setNoteQuery] = useState('');
  const modal = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const openFish = route.chapter === 'fish' ? catalog.fish.find(f => f.id === route.id) : undefined;
  const openPlace = route.chapter === 'waters' ? catalog.locations.find(l => l.id === route.id) : undefined;
  const page = route.chapter === 'achievements' ? 'achievements' : route.chapter === 'waters' ? 'places' : ['handbook','cabin','wardrobe','tackle','sources'].includes(route.chapter) ? 'notes' : 'fish';
  const matched = filterFish(catalog.fish, { q: query, encounter: shelf === 'legends' ? 'legendary' : '' }).filter(f => shelf === 'caught' ? caught.includes(f.id) : shelf === 'todo' ? !caught.includes(f.id) : true);
  const totalCaught = catalog.fish.filter(f => caught.includes(f.id)).length;
  const percentage = Math.round(totalCaught / catalog.fish.length * 100);
  const toggleCaught = (id: string) => setCaught(current => {
    const next = current.includes(id) ? current.filter(item => item !== id) : [...current, id];
    try { localStorage.setItem(caughtKey, JSON.stringify(next)); } catch { /* The checklist still works for this visit. */ }
    return next;
  });
  useEffect(() => {
    const sync = (event: StorageEvent) => { if (event.key === caughtKey || event.key === null) setCaught(readCaught()); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  useLayoutEffect(() => {
    if (openFish) {
      if (!modal.current?.open) {
        returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        modal.current?.showModal();
      }
      modal.current?.querySelector<HTMLElement>('.p-card-close')?.focus({ preventScroll: true });
      modal.current?.querySelector('.p-card-notes')?.scrollTo(0, 0);
    } else {
      modal.current?.close();
      if (returnFocus.current?.isConnected) returnFocus.current.focus({ preventScroll: true });
      returnFocus.current = null;
    }
  }, [openFish?.id]);
  useEffect(() => {
    if (!openFish) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [!!openFish]);
  useEffect(() => { if (!openFish) window.scrollTo(0,0); }, [page, openPlace?.id]);
  const closeCard = () => { location.hash = '/fish'; };
  const openIndex = openFish ? catalog.fish.indexOf(openFish) : 0;

  return <div className="alt-app pocket-app">
    <header className="p-header"><a className="p-brand" href={href('home')} aria-label="Reel & Chill home"><span><Glyph name="fish" size={26}/></span><strong>Reel &amp; Chill<small>Your Cast n Chill companion.</small></strong></a></header>
    <main id="alternative-content" className="p-desk" tabIndex={-1}>
      <nav className="p-tabs" aria-label="Catch book pages"><a className={page==='fish'?'is-active':''} href={href('fish')}><Glyph name="fish"/><span>My fish</span><small>{totalCaught}/{catalog.fish.length}</small></a><a className={page==='places'?'is-active':''} href={href('waters')}><Glyph name="map"/><span>Postcards</span></a><a className={page==='notes'?'is-active':''} href={href('handbook')}><Glyph name="book"/><span>Field notes</span></a><a className={page==='achievements'?'is-active':''} href={href('achievements')}><Glyph name="star"/><span>Achievements</span></a></nav>
      <div className="p-book"><div className="p-binding" aria-hidden="true"><i/><i/><i/><i/><i/></div>
      {page==='achievements' ? <AchievementBrowser catalog={catalog} articles={articles} params={route.params} unit={unit}/> : page==='fish' ? <>
        <div className="p-book-heading"><div><span className="p-handwriting">One cast at a time.</span><h1>A little book<br/>of big catches.</h1><p>Your own checklist. Fill it with fish, at your own pace.</p></div><div className="p-progress-stamp" aria-label={`${totalCaught} of ${catalog.fish.length} fish records caught`}><span>THE COLLECTION</span><strong>{String(totalCaught).padStart(2,'0')}<small>/{catalog.fish.length}</small></strong><div className="p-progress-track"><i style={{width:`${percentage}%`}}/></div><span>{percentage === 100 ? 'EVERY LAST ONE!' : 'PLENTY OF WATER LEFT'}</span></div></div>
        <div className="p-collection-controls"><div className="p-shelf-tabs" role="group" aria-label="Collection filter">{[['all','All fish'],['todo','To catch'],['caught','Caught'],['legends','Legends']].map(([key,label])=><button key={key} aria-pressed={shelf===key} onClick={()=>setShelf(key)}>{label}{key==='caught'&&<span>{totalCaught}</span>}</button>)}</div><label className="p-search"><Glyph name="search" size={17}/><input type="search" aria-label="Search your catch book" placeholder="Find a fish…" value={query} onChange={e=>setQuery(e.target.value)}/></label></div>
        <div className="p-sheet-label"><span role="status">{matched.length} fish to explore</span><span>Open a card for the little details ↘</span></div>
        <div className="p-stamp-grid">{matched.map(f=>{const index=catalog.fish.indexOf(f);const marked=caught.includes(f.id);return <article className={`p-stamp p-${palettes[index%palettes.length]} ${marked?'is-caught':''}`} key={f.id}>
          <a href={href('fish',f.id)} className="p-stamp-link" aria-label={`Open ${fishLabel(f)} card`}><div className="p-stamp-art"><span className="p-stamp-number">N° {String(index+1).padStart(2,'0')}</span><span className="p-stamp-orbit" aria-hidden="true"/><Sprite fish={f}/>{f.legendary&&<span className="p-stamp-legend"><Glyph name="star" size={12}/>LEGEND INSIDE</span>}</div><div className="p-stamp-label"><h2>{f.name}</h2><span>{f.variant==='ice'?'Ice fishing':titleCase(f.rarity)}<small>{f.sizes.join(' / ').toUpperCase()}</small></span></div></a>
          <button className="p-mark-caught" onClick={()=>toggleCaught(f.id)} aria-pressed={marked} aria-label={`${marked?'Unmark':'Mark'} ${fishLabel(f)} as caught`} title={marked?'Mark as still to catch':'Mark as caught'}>{marked?<Glyph name="check" size={16}/>:<span>+</span>}</button>
        </article>;})}</div>
        {!matched.length&&<div className="p-empty"><Glyph name={shelf==='caught'?'hook':'search'} size={42}/><h2>{shelf==='caught'&&!query?'The first one is special.':'No fish on this page.'}</h2><p>{shelf==='caught'&&!query?'Tap the + on a fish card after you’ve caught it.':'Try another search or collection filter.'}</p><button onClick={()=>{setQuery('');setShelf('all');}}>Browse all fish <Glyph name="arrow" size={16}/></button></div>}
        <div className="p-page-bottom"><span>Ice variants get their own card.</span><span>Checklist saved on this device · independent of your game</span></div>
      </> : page==='places' ? <>
        {openPlace ? <><a className="p-back" href={href('waters')}><Glyph name="back" size={17}/>All postcards</a><div className="p-place-spread"><figure className="p-big-postcard"><img src={sceneFor(openPlace.id)} alt={`The landscape at ${openPlace.name}`}/><figcaption><span>Greetings from</span><h1>{openPlace.name}</h1><small>{nameOf(catalog.areas,openPlace.areaId)}</small></figcaption></figure><section className="p-place-back"><span className="p-handwriting">Meet the locals.</span><h2>Who lives here?</h2>{catalog.fish.filter(f=>f.locationIds.includes(openPlace.id)).map(f=><a href={href('fish',f.id)} key={f.id}><Sprite fish={f}/><span>{fishLabel(f)}<small>{caught.includes(f.id)?'Already in your book':'Still to catch'}</small></span>{caught.includes(f.id)?<Glyph name="check" size={17}/>:<Glyph name="arrow" size={17}/>}</a>)}{openPlace.kind==='pond'&&<p>This pond is yours to stock. <a href={href('handbook','pond-stocking')}>Read the pond notes.</a></p>}{openPlace.hint&&<div className="p-sticky-note"><span>Rusty says…</span><p>{openPlace.hint}</p></div>}</section></div></> : <><div className="p-book-heading"><div><span className="p-handwriting">Been there. Cast that.</span><h1>Somewhere<br/>worth staying.</h1><p>A pocketful of places, from the fork to the frozen flats.</p></div><div className="p-postage" aria-hidden="true"><Glyph name="waves" size={42}/><span>17 LITTLE ESCAPES</span></div></div><div className="p-postcard-wall">{catalog.locations.map((l,i)=><a href={href('waters',l.id)} className={`p-postcard tilt-${i%3}`} key={l.id}><div className="p-postcard-photo"><img src={sceneFor(l.id)} alt=""/><span className="p-postmark" aria-hidden="true">REEL<br/>&amp; CHILL</span></div><span>Greetings from</span><h2>{l.name}</h2><small>{l.fishIds.length?`${l.fishIds.length} fish records to discover`:'A little place of your own'}<Glyph name="arrow" size={17}/></small></a>)}</div></>}
      </> : <>
        <div className="p-book-heading"><div><span className="p-handwriting">Things to remember.</span><h1>Notes from<br/>the water.</h1><p>Small lessons for better days out.</p></div><span className="p-notes-doodle" aria-hidden="true"><Glyph name="hook" size={80}/></span></div><label className="p-search p-note-search"><Glyph name="search" size={18}/><input type="search" aria-label="Find a field note" placeholder="Something you’re wondering about?" value={noteQuery} onChange={e=>setNoteQuery(e.target.value)}/></label><div className="p-notes-stack">{articles.filter(a=>matchesText(`${a.title} ${a.summary} ${a.keywords.join(' ')}`,noteQuery)).map((a,i)=><details className={`p-note p-${palettes[i%palettes.length]}`} key={a.id} open={a.id===route.id || undefined}><summary><span className="p-note-number">{String(i+1).padStart(2,'0')}</span><span><h2>{a.title}</h2><small>{a.summary}</small></span><span className="p-note-plus" aria-hidden="true">+</span></summary><div className="p-note-content">{a.sections.map(s=><section key={s.heading}><h3>{s.heading}</h3>{s.paragraphs.map(p=><p key={p}>{p}</p>)}</section>)}</div></details>)}</div>{!articles.some(a=>matchesText(`${a.title} ${a.summary} ${a.keywords.join(' ')}`,noteQuery))&&<div className="p-empty"><h2>No notes found.</h2><button onClick={()=>setNoteQuery('')}>Show all notes</button></div>}
      </>}
      </div>
      <footer className="p-desk-footer"><span>Reel &amp; Chill · Your Cast n Chill companion. <Glyph name="sun" size={16}/></span><button onClick={onOriginal}>Need every detail? Open the full guide ↗</button></footer>
    </main>
    <dialog className="p-fish-dialog" ref={modal} aria-labelledby="p-fish-title" onCancel={e=>{e.preventDefault();closeCard();}} onClick={e=>{if(e.target===modal.current){const r=modal.current.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeCard();}}}>
      {openFish&&<><button className="p-card-close" onClick={closeCard} aria-label="Close fish card"><Glyph name="close" size={20}/></button><div className="p-open-card"><section className={`p-card-front p-${palettes[openIndex%palettes.length]}`}><div className="p-card-topline"><span>THE CATCH BOOK</span><span>N° {String(openIndex+1).padStart(2,'0')}</span></div><div className="p-card-fish"><span className="p-card-circle" aria-hidden="true"/><Sprite fish={openFish}/></div><span className="p-handwriting">{openFish.variant==='ice'?'A chilly little catch.':'A keeper for the book.'}</span><h2 id="p-fish-title">{fishLabel(openFish)}</h2><div className="p-card-facts"><div><span>Grows to</span><strong>{weight(openFish.weight.max,unit)}</strong></div><div><span>Sizes</span><strong>{openFish.sizes.join(' / ').toUpperCase()}</strong></div></div><button className="p-caught-button" onClick={()=>toggleCaught(openFish.id)} aria-pressed={caught.includes(openFish.id)}><Glyph name={caught.includes(openFish.id)?'check':'fish'} size={20}/>{caught.includes(openFish.id)?'Caught! In your book.':'I caught this one'}</button></section><div className="p-card-notes"><span className="p-card-note-label">A FEW LITTLE POINTERS</span><h3>Find your fish.</h3>{windowsFor(openFish,catalog).map((w,i)=><a href={href('waters',w.locationId)} className="p-catch-place" key={i}><Glyph name="pin" size={19}/><span>{w.place}<small>{w.time} · {w.sizes}</small></span><Glyph name="arrow" size={16}/></a>)}<div className="p-lure-note"><Glyph name="hook" size={26}/><div><h4>A tempting offer</h4><p>{openFish.preferredLures.map(l=>nameOf(catalog.lureTypes,l)).join(', ') || 'No special lure preference'}. Match your rod and lure to the fish size.</p></div></div><div className="p-trophy-note"><span>Trophy size</span><strong>{weight(openFish.trophyWeight,unit)} or more</strong></div>{openFish.legendary&&<div className="p-legend-secret"><Glyph name="star" size={22}/><span>THERE’S A LEGEND HERE</span><h4>{openFish.legendName}</h4>{windowsFor(openFish,catalog,true).map((w,i)=><p key={i}>{w.place}<br/>{w.time} · {w.sizes}</p>)}</div>}<nav className="p-card-pagination" aria-label="Browse fish cards"><a href={href('fish',catalog.fish[(openIndex-1+catalog.fish.length)%catalog.fish.length].id)} aria-label="Previous fish card"><Glyph name="back" size={18}/>Previous</a><a href={href('fish',catalog.fish[(openIndex+1)%catalog.fish.length].id)} aria-label="Next fish card">Next<Glyph name="arrow" size={18}/></a></nav></div></div></>}
    </dialog>
  </div>;
}

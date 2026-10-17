import { useEffect, useState } from 'react';
import { coins, filterFish, fishLabel, nameOf, sceneFor, suggestedTackle, titleCase, weight } from '../guide';
import type { Article, Fish } from '../types';
import { Glyph, href, SourceFootnote, Sprite, windowsFor, type ViewProps } from './shared';
import { AchievementBrowser } from '../components/AchievementBrowser';
import './journal.css';

const storyScenes: Record<string, string> = { 'first-cast': 'fork', 'trophies-and-legends': 'night', 'ice-fishing': 'ice', 'cabin-restoration': 'cabin', 'time-of-day': 'mistwood', 'fighting-fish': 'rapids' };

export function Journal({ catalog, articles, route, unit, onOriginal }: ViewProps) {
  const [query, setQuery] = useState('');
  const { chapter, id } = route;
  const fish = chapter === 'fish' && id ? catalog.fish.find(f => f.id === id) : undefined;
  const place = chapter === 'waters' && id ? catalog.locations.find(l => l.id === id) : undefined;
  const article = chapter === 'handbook' && id ? articles.find(a => a.id === id) : undefined;
  const isSpecies = chapter === 'fish' || chapter === 'legends';
  const isStories = ['handbook', 'cabin', 'wardrobe', 'sources'].includes(chapter);
  const featuredFish = catalog.fish.find(f => f.id === 'northern-pike')!;
  useEffect(() => {
    window.scrollTo(0, 0);
    if (!document.querySelector(':popover-open')) document.getElementById('alternative-content')?.focus({ preventScroll: true });
  }, [chapter, id]);

  const fishStory = (f: Fish) => <article className="j-species-story">
    <div className="j-story-kicker"><a href={href('fish')}>The species index</a><span>Specimen № {String(catalog.fish.indexOf(f) + 1).padStart(2, '0')}</span></div>
    <header className="j-species-heading"><p className="j-overline">{titleCase(f.rarity)} · {f.variant === 'ice' ? 'Beneath the ice' : 'Open water'}</p><h1>{f.name}</h1>{f.legendary && <p className="j-deck">A familiar face. A legend called <em>{f.legendName}.</em></p>}</header>
    <figure className="j-species-plate"><Sprite fish={f}/><figcaption>Fig. {String(catalog.fish.indexOf(f) + 1).padStart(2, '0')} / {fishLabel(f)}<span>{weight(f.weight.min, unit)} — {weight(f.weight.max, unit)}</span></figcaption></figure>
    <div className="j-species-body"><aside><p className="j-overline">The particulars</p><dl><dt>Sizes</dt><dd>{f.sizes.join(' / ').toUpperCase()}</dd><dt>Trophy threshold</dt><dd>{weight(f.trophyWeight, unit)}</dd><dt>Preferred lures</dt><dd>{f.preferredLures.map(l => nameOf(catalog.lureTypes, l)).join(', ') || 'No particular preference'}</dd></dl></aside><div>
      <h2>Where the water holds them.</h2>{f.description && <p>{f.description}</p>}
      <div className="j-catch-notes">{windowsFor(f, catalog).map((w, i) => <div key={i}><a href={href('waters', w.locationId)}>{w.place} <Glyph name="arrow" size={17}/></a><span>{w.time} · {w.sizes}</span></div>)}</div>
      {f.legendary && <div className="j-legend-note"><span className="j-overline">A bigger story</span><h3>Meet {f.legendName}.</h3>{windowsFor(f, catalog, true).map((w, i) => <p key={i}>{w.place} · {w.time} · {w.sizes}</p>)}</div>}
      <h3>Pack for the smallest size first.</h3><p>{suggestedTackle(catalog, f, f.sizes[0]).rods.slice(0, 2).map(r => r.name).join(' or ') || 'Check the rod’s size and water compatibility'}{f.preferredLures.length ? `, with a ${nameOf(catalog.lureTypes, f.preferredLures[0]).toLowerCase()} lure.` : '.'} Match rod, lure, and fish size before casting.</p><a className="j-text-link" href={href('handbook', 'matching-tackle')}>Read the tackle notes <Glyph name="arrow" size={18}/></a>
    </div></div>
  </article>;

  const readArticle = (a: Article) => <article className="j-longread">
    <a className="j-back" href={href('handbook')}><Glyph name="back" size={17}/> All stories</a><header><p className="j-overline">The practical pages · {a.category === 'cabin' ? 'Life ashore' : 'On the water'}</p><h1>{a.title}</h1><p className="j-deck">{a.summary}</p></header>
    <figure className="j-longread-image"><img src={sceneFor(storyScenes[a.id] || 'meadow')} alt="A quiet pixel-art fishing landscape"/><figcaption>Take a moment. There’s no rush here.</figcaption></figure>
    <div className="j-reading-columns"><aside><span className="j-overline">In this story</span>{a.sections.map((s, i) => <button key={s.heading} onClick={() => document.getElementById(`j-section-${i}`)?.scrollIntoView({ behavior: 'auto', block: 'start' })}>{String(i + 1).padStart(2, '0')} / {s.heading}</button>)}</aside><div className="j-prose">{a.sections.map((s, i) => <section id={`j-section-${i}`} key={s.heading}><h2>{s.heading}</h2>{s.paragraphs.map(p => <p key={p}>{p}</p>)}</section>)}{a.sources.length > 0 && <details><summary>Sources for this story</summary>{a.sources.map(s => <a key={s.url} href={s.url} target="_blank" rel="noreferrer">{s.title} ↗</a>)}</details>}</div></div>
  </article>;

  let body;
  if (fish) body = fishStory(fish);
  else if (chapter === 'achievements') body = <AchievementBrowser catalog={catalog} articles={articles} params={route.params} unit={unit}/>;
  else if (article) body = readArticle(article);
  else if (place) body = <article className="j-place-story"><div className="j-story-kicker"><a href={href('waters')}>Postcards from the water</a><span>{nameOf(catalog.areas, place.areaId)}</span></div><h1>{place.name}</h1><img className="j-place-panorama" src={sceneFor(place.id)} alt={`The scenery at ${place.name}`}/><div className="j-place-columns"><div><p className="j-overline">A little local knowledge</p><h2>{titleCase(place.kind)} days.</h2><p>{place.description || place.hint || 'Pick a promising patch of water, match your tackle, and settle in.'}</p><p>Region licence: {coins(catalog.areas.find(a => a.id === place.areaId)?.cost || 0)}.</p>{place.hint && place.description && <p>{place.hint}</p>}</div><div><h2>Look beneath the surface.</h2>{catalog.fish.filter(f => f.locationIds.includes(place.id)).map(f => <a className="j-place-species" href={href('fish', f.id)} key={f.id}><Sprite fish={f}/><span>{fishLabel(f)}<small>{titleCase(f.rarity)}</small></span><Glyph name="arrow"/></a>)}{!place.fishIds.length && <a className="j-text-link" href={href('handbook', 'pond-stocking')}>Read about pond stocking <Glyph name="arrow"/></a>}</div></div></article>;
  else if (isSpecies) {
    const matches = filterFish(catalog.fish, { q: query, sort: 'name', encounter: chapter === 'legends' ? 'legendary' : '' });
    body = <section className="j-index"><p className="j-overline">A natural history of Cast n Chill</p><h1>{chapter === 'legends' ? 'Larger than life.' : 'The species index.'}</h1><div className="j-index-tools"><p>{matches.length} entries, from the humble shad to the deep-water giants.</p><label><Glyph name="search"/><input type="search" aria-label="Find a species" placeholder="Find a species…" value={query} onChange={e => setQuery(e.target.value)}/></label></div><div className="j-alphabet">{[...new Set(matches.map(f => f.name[0]))].sort().map(letter => <a href={`#j-letter-${letter}`} key={letter} onClick={e => { e.preventDefault(); document.getElementById(`j-letter-${letter}`)?.scrollIntoView(); }}>{letter}</a>)}</div><div className="j-species-index">{matches.map((f, i) => <a href={href('fish', f.id)} key={f.id} id={i === 0 || matches[i - 1].name[0] !== f.name[0] ? `j-letter-${f.name[0]}` : undefined}><span className="j-index-number">{String(catalog.fish.indexOf(f) + 1).padStart(2, '0')}</span><Sprite fish={f}/><div><h2>{fishLabel(f)}</h2><p>{f.locationIds.map(l => nameOf(catalog.locations, l)).join(' · ')}</p></div><Glyph name="arrow"/></a>)}</div>{!matches.length && <p className="j-empty">No species found. <button onClick={() => setQuery('')}>Clear the search</button>.</p>}</section>;
  } else if (chapter === 'waters') body = <section className="j-postcards"><p className="j-overline">Letters from the shore</p><h1>Wish you were here.</h1><p className="j-deck">Seventeen places to lose track of time.</p><div>{catalog.locations.map((l, i) => <a href={href('waters', l.id)} key={l.id}><img src={sceneFor(l.id)} alt=""/><span className="j-overline">{String(i + 1).padStart(2, '0')} / {nameOf(catalog.areas, l.areaId)}</span><h2>{l.name}</h2><span>{titleCase(l.kind)} · {l.fishIds.length} fish records <Glyph name="arrow" size={18}/></span></a>)}</div></section>;
  else if (chapter === 'tackle') body = <section className="j-gear"><p className="j-overline">The well-packed bag</p><h1>Less guesswork.<br/><em>More fishing.</em></h1><p className="j-deck">A rod, a lure, and a little know-how.</p><a className="j-text-link" href={href('handbook', 'matching-tackle')}>Start with compatibility <Glyph name="arrow"/></a>{(['rod', 'lure', 'boat'] as const).map(kind => <section key={kind}><h2>{titleCase(kind)}s</h2><div>{catalog.equipment.filter(e => e.kind === kind).map(e => <article key={e.id}><Sprite fish={e}/><div><h3>{e.name}</h3><p>{e.sizes.length ? e.sizes.join(' / ').toUpperCase() : titleCase(e.environment)} · {coins(e.cost)}</p>{e.lureType && <small>{nameOf(catalog.lureTypes, e.lureType)}</small>}</div></article>)}</div></section>)}</section>;
  else if (isStories) body = <section className="j-stories"><p className="j-overline">Good things to know</p><h1>Stories for the slow days.</h1><div className="j-story-list">{articles.filter(a => chapter !== 'cabin' || a.category === 'cabin').map((a, i) => <a href={href('handbook', a.id)} key={a.id}><span className="j-story-number">{String(i + 1).padStart(2, '0')}</span><div><span className="j-overline">{a.category === 'cabin' ? 'Life ashore' : 'Field notes'}</span><h2>{a.title}</h2><p>{a.summary}</p></div><Glyph name="arrow" size={28}/></a>)}</div></section>;
  else body = <>
    <div className="j-edition-line"><span>Your Cast n Chill companion.</span><span>Vol. 01 · The slow-water issue</span></div>
    <h1 className="j-masthead">Reel &amp; Chill<span aria-hidden="true">✳</span></h1>
    <div className="j-frontpage">
      <article className="j-cover-story"><a href={href('handbook', 'first-cast')} className="j-cover-photo"><img src={sceneFor('fork')} alt="Sunlight on a river between wooded banks"/><span className="j-photo-label">ON THE WATER / THE FORK</span></a><div className="j-cover-title"><span className="j-overline">The art of doing very little</span><a href={href('handbook', 'first-cast')}><h2>A good day<br/>to <em>get lost.</em></h2></a><div><p>Find a quiet bank. Pick your lure. Let the rest of the world wait a while.</p><a className="j-text-link" href={href('handbook', 'first-cast')}>Make your first cast <Glyph name="arrow"/></a></div></div></article>
      <aside className="j-front-aside"><div className="j-specimen-feature"><p className="j-overline">A fish worth knowing</p><span className="j-plate-number">01</span><a href={href('fish', featuredFish.id)} className="j-feature-fish"><Sprite fish={featuredFish}/></a><p className="j-overline">Still water. Sharp teeth.</p><a href={href('fish', featuredFish.id)}><h2>The one with<br/>the <em>teeth.</em></h2></a><p>Northern Pike. Patient angler, meet impatient predator.</p><a className="j-text-link" href={href('fish', featuredFish.id)}>Know your quarry <Glyph name="arrow" size={18}/></a></div><div className="j-editor-note"><span className="j-overline">A note from the bank</span><p>“You don’t need to catch everything today.”</p><a href={href('handbook', 'active-and-passive')}>The case for slowing down ↗</a></div></aside>
    </div>
    <section className="j-below-fold"><div className="j-section-rule"><h2>For the next quiet hour</h2><a href={href('handbook')}>All stories <Glyph name="arrow" size={18}/></a></div><div className="j-feature-stories">{['trophies-and-legends', 'cabin-restoration', 'ice-fishing'].map((aid, i) => { const a = articles.find(a => a.id === aid)!; return <a href={href('handbook', aid)} key={aid}><img src={sceneFor(storyScenes[aid])} alt=""/><span className="j-overline">0{i + 2} / {i === 0 ? 'Tall tales' : i === 1 ? 'Life ashore' : 'A change of season'}</span><h3>{i === 0 ? 'Some stories have bigger fish.' : i === 1 ? 'A place to come home to.' : 'Still water. Colder mornings.'}</h3><p>{a.summary}</p></a>; })}</div></section>
    <section className="j-index-invitation"><span className="j-overline">Every fish has a story</span><a href={href('fish')}><span>{catalog.meta.speciesCount}</span><h2>reasons to cast<br/><em>one more time.</em></h2><Glyph name="arrow" size={54}/></a></section>
  </>;

  return <div className="alt-app journal-app">
    <header className="j-top"><a className="j-wordmark" href={href('home')} aria-label="Reel & Chill home">R&amp;C<span>REEL &amp; CHILL</span></a></header>
    <nav className="j-nav" aria-label="Magazine sections">{[['home', 'The current issue'], ['handbook', 'Stories'], ['fish', 'Species index'], ['waters', 'Places'], ['tackle', 'The kit'], ['achievements', 'Achievements']].map(([key, label]) => <a key={key} className={(key === 'fish' ? isSpecies : key === 'handbook' ? isStories : chapter === key) ? 'is-active' : ''} href={href(key)}>{label}</a>)}</nav>
    <main id="alternative-content" tabIndex={-1} className="j-pages">{body}</main>
    <footer className="j-footer"><a href={href('home')}>Reel &amp; Chill</a><span>Your Cast n Chill companion.</span><button onClick={onOriginal}>Open the complete field guide ↗</button><SourceFootnote catalog={catalog}/></footer>
  </div>;
}

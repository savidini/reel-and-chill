import type { Article, Catalog } from '../types';
import { achievementCategories, achievementCategory, filterAchievements, fishLabel, nameOf, timeLabel, weight } from '../guide';
import { achievementNotes, achievementSource, whiteTipNote } from '../content/achievements';
import { Icon } from './Icon';
import '../styles/achievements.css';

export function AchievementBrowser({ catalog, articles, params, unit, heading = true }: {
  catalog: Catalog; articles: Article[]; params: URLSearchParams; unit: string; heading?: boolean;
}) {
  const query = params.get('q') || '';
  const kind = params.get('kind') || '';
  const filtered = filterAchievements(catalog, query, kind);
  const changeFilter = (key?: string, value = '') => {
    const next = key ? new URLSearchParams(params) : new URLSearchParams();
    if (key) { if (value) next.set(key, value); else next.delete(key); }
    history.replaceState(history.state, '', `#/achievements${next.size ? `?${next}` : ''}`);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };

  return <section className="achievement-browser" aria-label="Achievement guide">
    {heading && <header className="achievement-heading"><span className="achievement-kicker">Milestones on the water</span><h1>Achievements</h1><p>From your first catch to a full trophy wall.</p></header>}
    <p className="achievement-source">Requirements and catch windows from game {catalog.meta.gameVersion}. Tips from <a href={achievementSource.url} target="_blank" rel="noreferrer">{achievementSource.title} ↗</a>.</p>
    <div className="achievement-controls">
      <label className="achievement-search"><span>Search achievements</span><input type="search" aria-label="Search achievements" placeholder="Name, requirement, fish or place…" value={query} onChange={e => changeFilter('q', e.target.value)}/></label>
      <label><span>Category</span><select aria-label="Achievement category" value={kind} onChange={e => changeFilter('kind', e.target.value)}><option value="">All achievements</option>{achievementCategories.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
      <button className="achievement-reset" onClick={() => changeFilter()}>Reset filters</button>
    </div>
    <p className="achievement-count" role="status">{filtered.length} of {catalog.achievements.length} achievements</p>
    <div className="achievement-cards">{filtered.map(a => {
      const note = achievementNotes[a.id];
      const fish = catalog.fish.find(f => f.id === a.fish?.id);
      const windows = fish?.conditions.filter(c => c.encounter === 'legendary') || [];
      const article = articles.find(article => article.id === (note?.articleId || (fish ? 'trophies-and-legends' : 'completion-route')));
      const relatedFish = catalog.fish.filter(f => note?.fishIds?.includes(f.id));
      const places = catalog.locations.filter(l => note?.locationIds?.includes(l.id));
      return <article className="achievement-card" key={a.id} data-achievement={a.id}>
        <header>{a.image ? <img className="achievement-icon" src={a.image} alt="" loading="lazy"/> : <Icon name="achievements" size={48}/>}<div><span className="achievement-kicker">{nameOf(achievementCategories, achievementCategory(a))}</span><h2>{a.name}</h2></div></header>
        <p className="achievement-requirement">{a.description}</p>
        <details className="achievement-help"><summary>How to unlock <span aria-hidden="true">+</span></summary><div>
          {note && <p>{note.tip}</p>}
          {fish && <>
            <p><a href={`#/fish/${fish.id}`}>{fishLabel(fish)}</a> · Trophy from approximately <strong>{weight(fish.trophyWeight, unit)}</strong>.</p>
            {windows.length > 0 && <ul className="achievement-windows">{windows.map((c, i) => <li key={i}><a href={`#/waters/${c.locationId}`}>{nameOf(catalog.locations, c.locationId)}</a><span>{nameOf(catalog.areas, catalog.locations.find(l => l.id === c.locationId)?.areaId)} · {timeLabel(c)} · {c.sizes.join(' / ').toUpperCase()}</span></li>)}</ul>}
            {a.id === 'walleye-trophy' && <p className="achievement-caveat">{whiteTipNote}</p>}
          </>}
          {(relatedFish.length > 0 || places.length > 0) && <ul className="achievement-related" aria-label="Related fish and places">{relatedFish.map(f => <li key={f.id}><a href={`#/fish/${f.id}`}>{fishLabel(f)}</a></li>)}{places.map(l => <li key={l.id}><a href={`#/waters/${l.id}`}>{l.name}</a></li>)}</ul>}
          {article && <a className="achievement-read" href={`#/handbook/${article.id}`}>{article.title} <span aria-hidden="true">→</span></a>}
        </div></details>
      </article>;
    })}</div>
    {!filtered.length && <div className="achievement-empty"><h2>No matching achievements</h2><p>Try another search or category.</p><button className="achievement-reset" onClick={() => changeFilter()}>Show all achievements</button></div>}
  </section>;
}

import { useEffect } from 'react';
import type { Article, Catalog } from '../types';
import type { ThemePreference } from '../useTheme';
import { designs, type Design } from '../useDesign';
import { DesignSwitcher } from '../components/DesignSwitcher';
import { DisplaySettings } from '../components/DisplaySettings';
import { Journal } from './Journal';
import { Drift } from './Drift';
import { Sonar } from './Sonar';
import { Pocket } from './Pocket';
import { SkipLink, titleFor, useRoute, useUnits } from './shared';
import './alternatives.css';

export function AlternativeGuide({ catalog, articles, design, setDesign, theme, setTheme }: {
  catalog: Catalog; articles: Article[]; design: Exclude<Design, 'original'>; setDesign: (design: Design) => void;
  theme: ThemePreference; setTheme: (theme: ThemePreference) => void;
}) {
  const route = useRoute();
  const [unit, setUnit] = useUnits();
  useEffect(() => { window.scrollTo(0, 0); }, [design]);
  useEffect(() => { document.title = `${titleFor(route, catalog, articles) ? titleFor(route, catalog, articles) + ' · ' : ''}Reel & Chill · ${designs.find(d => d.id === design)?.name}`; }, [route, catalog, articles, design]);
  const props = { catalog, articles, route, unit, onOriginal: () => setDesign('original') };
  return <>
    <SkipLink/>
    <div className={`alt-utilities utilities-${design}`} aria-label="Guide preferences">
      <DesignSwitcher design={design} onChange={setDesign}/>
      <DisplaySettings theme={theme} setTheme={setTheme} unit={unit} setUnit={setUnit}/>
    </div>
    {design === 'journal' ? <Journal {...props}/> : design === 'expedition' ? <Drift {...props}/> : design === 'sonar' ? <Sonar {...props}/> : <Pocket {...props}/>}
  </>;
}

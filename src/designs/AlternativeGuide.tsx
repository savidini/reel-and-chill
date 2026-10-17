import { useEffect } from 'react';
import type { Article, Catalog } from '../types';
import { designs, type Design } from '../useDesign';
import { Journal } from './Journal';
import { Drift } from './Drift';
import { Sonar } from './Sonar';
import { Pocket } from './Pocket';
import { SkipLink, titleFor, useRoute } from './shared';
import './alternatives.css';

export function AlternativeGuide({ catalog, articles, design, setDesign, unit }: {
  catalog: Catalog; articles: Article[]; design: Exclude<Design, 'original'>; setDesign: (design: Design) => void;
  unit: string;
}) {
  const route = useRoute();
  useEffect(() => { window.scrollTo(0, 0); }, [design]);
  useEffect(() => { document.title = `${titleFor(route, catalog, articles) ? titleFor(route, catalog, articles) + ' · ' : ''}Reel & Chill · ${designs.find(d => d.id === design)?.name}`; }, [route, catalog, articles, design]);
  const props = { catalog, articles, route, unit, onOriginal: () => setDesign('original') };
  return <>
    <SkipLink/>
    {design === 'journal' ? <Journal {...props}/> : design === 'expedition' ? <Drift {...props}/> : design === 'sonar' ? <Sonar {...props}/> : <Pocket {...props}/>}
  </>;
}

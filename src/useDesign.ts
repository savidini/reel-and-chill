import { useLayoutEffect, useState } from 'react';

export const designs = [
  { id: 'original', name: 'Original', description: 'The familiar field guide', detail: 'Paper, pine & pixel art' },
  { id: 'journal', name: 'Sunday Cast', description: 'An editorial fishing magazine', detail: 'Read stories & natural histories' },
  { id: 'expedition', name: 'Drift', description: 'A slower journey through the waters', detail: 'Explore a landscape & meet its fish' },
  { id: 'sonar', name: 'Sonar', description: 'A searchable reference desk', detail: 'Filter records & inspect the details' },
  { id: 'studio', name: 'Pocket', description: 'Your personal catch book', detail: 'Collect fish & explore postcards' },
] as const;
export type Design = typeof designs[number]['id'];
const storageKey = 'cast-guide-design';

function readDesign(): Design {
  try {
    const saved = localStorage.getItem(storageKey);
    if (designs.some(design => design.id === saved)) return saved as Design;
  } catch { /* The switcher remains usable without browser storage. */ }
  return 'original';
}

export function useDesign() {
  const [design, setDesign] = useState<Design>(readDesign);
  useLayoutEffect(() => {
    document.documentElement.dataset.design = design;
    const color = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
  }, [design]);
  useLayoutEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) setDesign(readDesign());
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  const changeDesign = (next: Design) => {
    setDesign(next);
    try { localStorage.setItem(storageKey, next); } catch { /* Keep the current choice in memory. */ }
  };
  return [design, changeDesign] as const;
}

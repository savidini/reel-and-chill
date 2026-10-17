import { useEffect, useState } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';
const storageKey = 'cast-guide-theme';

function readPreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* Preferences remain usable when browser storage is unavailable. */ }
  return 'system';
}

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(readPreference);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme = preference === 'system'
        ? (media.matches ? 'dark' : 'light') : preference;
      const color = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim();
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [preference]);

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) setPreference(readPreference());
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const changePreference = (next: ThemePreference) => {
    setPreference(next);
    try { localStorage.setItem(storageKey, next); } catch { /* Keep the in-memory choice. */ }
  };

  return [preference, changePreference] as const;
}

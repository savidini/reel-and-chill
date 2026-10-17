import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { mount } from '../vendor/ascii/mount';
import * as alpineDawn from '../vendor/ascii/pieces/alpine-dawn';

export function AsciiLake({ children }: { children?: ReactNode }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const time = useRef(12);
  const render = useMemo(() => alpineDawn.default(), []);
  const [paused, setPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setPaused(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);

  useEffect(() => {
    if (!canvas.current) return;
    const start = time.current;
    // Keep the same scene and playhead when pausing. The library suspends
    // rendering outside the viewport and while the tab is hidden.
    return mount(canvas.current, {
      meta: alpineDawn.meta,
      default: () => (seconds, env) => {
        time.current = start + seconds;
        return render(time.current, env);
      },
    }, { fps: paused ? 0 : 12, motion: !paused });
  }, [paused, render]);

  return <div className="ascii-frame">
    <canvas className="ascii-lake" ref={canvas} role="img" aria-label="ASCII artwork of snow-capped mountains at dawn, reflected in a lake"/>
    <div className="scene-toolbar">{children}<button className="scene-toggle" onClick={() => setPaused(!paused)} aria-pressed={paused} aria-label={paused ? 'Play lake animation' : 'Pause lake animation'}><span aria-hidden="true">{paused ? '▶' : 'Ⅱ'}</span>{paused ? 'Play' : 'Pause'}</button></div>
  </div>;
}

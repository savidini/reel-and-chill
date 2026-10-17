import { useEffect, useMemo, useRef, useState } from 'react';
import { mount } from '../vendor/ascii/mount';
import type { Piece } from '../vendor/ascii/types';
import './ascii-scene.css';

const scenes = {
  'aurora-fjord': {
    title: 'Aurora Fjord',
    description: 'ASCII artwork of green aurora curtains above snowy mountains and a still fjord, with a lit cabin on the shore',
    load: () => import('../vendor/ascii/pieces/aurora-fjord'),
  },
  'deep-reef': {
    title: 'Deep Reef',
    description: 'ASCII artwork of sunlight filtering through ocean water above coral, swaying kelp, and a school of fish',
    load: () => import('../vendor/ascii/pieces/deep-reef'),
  },
};
type Scene = keyof typeof scenes;

export function AsciiScene({ scene }: { scene: Scene }) {
  return <ScenePlayback key={scene} scene={scene}/>;
}

function ScenePlayback({ scene }: { scene: Scene }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const time = useRef(12);
  const [piece, setPiece] = useState<Piece>();
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const render = useMemo(() => piece?.default(), [piece]);
  const { title, description, load } = scenes[scene];

  useEffect(() => {
    let active = true;
    load().then(module => { if (active) setPiece(module); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [load]);

  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setPaused(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);

  useEffect(() => {
    if (!canvas.current || !piece || !render) return;
    const start = time.current;
    // Keep the factory and playhead on pause. Mount suspends offscreen/hidden
    // rendering and disconnects observers and animation frames on cleanup.
    return mount(canvas.current, {
      meta: { ...piece.meta, still: 0 },
      default: () => (seconds, env) => {
        time.current = start + seconds;
        return render(time.current, env);
      },
    }, { fps: paused ? 0 : piece.meta.fps, motion: !paused });
  }, [piece, paused, render]);

  return <figure className={`ascii-scene scene-${scene}`} data-scene={scene}>
    {failed ? <p className="scene-unavailable">{title} could not load. Reload to try again.</p> : <canvas className="ascii-canvas" ref={canvas} role="img" aria-label={description} data-ready={!!piece}/>}
    <figcaption className="scene-caption">
      <a href={`https://ascii.rest/${scene}/`} target="_blank" rel="noreferrer">{title}<span> · ascii.rest</span></a>
      <button className="scene-toggle" disabled={!piece} onClick={() => setPaused(!paused)} aria-pressed={paused} aria-label={`${paused ? 'Play' : 'Pause'} ${title} animation`}><span aria-hidden="true">{paused ? '▶' : 'Ⅱ'}</span>{paused ? 'Play' : 'Pause'}</button>
    </figcaption>
  </figure>;
}

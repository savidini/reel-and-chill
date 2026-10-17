import { useEffect, useRef, useState } from 'react';
import type { ThemePreference } from '../useTheme';
import { Icon } from './Icon';
import { positionPopover } from './positionPopover';

const themes: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

export function DisplaySettings({ theme, setTheme, unit, setUnit }: {
  theme: ThemePreference;
  setTheme: (value: ThemePreference) => void;
  unit: string;
  setUnit: (value: string) => void;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const position = () => positionPopover(trigger.current, panel.current, 304);
  useEffect(position);
  useEffect(() => {
    const close = () => panel.current?.hidePopover();
    window.addEventListener('hashchange', close);
    window.addEventListener('resize', position);
    return () => {
      window.removeEventListener('hashchange', close);
      window.removeEventListener('resize', position);
    };
  }, []);

  return <>
    <button ref={trigger} className="display-trigger" popoverTarget="display-settings"
      aria-label="Display settings" aria-haspopup="dialog" aria-expanded={open}
      title="Appearance and weight units">
      <Icon name={theme} size={18}/><span>{themes.find(t => t.value === theme)?.label}</span>
      <span className="display-chevron" aria-hidden="true">⌄</span>
    </button>
    <div ref={panel} id="display-settings" className="display-panel" popover="auto"
      role="dialog" aria-labelledby="display-title"
      onBeforeToggle={e => { if (e.newState === 'open') position(); }}
      onToggle={e => {
        const visible = e.newState === 'open';
        setOpen(visible);
        if (visible) {
          position();
          panel.current?.querySelector<HTMLInputElement>('input[name="appearance"]:checked')?.focus({ preventScroll: true });
        }
      }}
      onBlur={e => {
        if (e.relatedTarget instanceof Node && !e.currentTarget.contains(e.relatedTarget) && e.relatedTarget !== trigger.current) panel.current?.hidePopover();
      }}>
      <div className="display-panel-heading"><h2 id="display-title">Display</h2><button className="icon-button" popoverTarget="display-settings" popoverTargetAction="hide" aria-label="Close display settings"><Icon name="close" size={16}/></button></div>
      <fieldset className="appearance-options" aria-describedby="system-theme-note">
        <legend>Appearance</legend>
        <div className="theme-options">{themes.map(option => <label className="theme-option" key={option.value}>
          <input className="sr-only" type="radio" name="appearance" value={option.value} checked={theme === option.value} onChange={() => setTheme(option.value)}/>
          <Icon name={option.value} size={24}/><span>{option.label}</span>
          <span className="option-check" aria-hidden="true">✓</span>
        </label>)}</div>
        <p id="system-theme-note">System follows your device’s appearance.</p>
      </fieldset>
      <fieldset className="weight-options"><legend>Weight units</legend><div className="unit-options">
        {[{ value: 'lb', label: 'lb / oz' }, { value: 'kg', label: 'kg' }].map(option => <label key={option.value}>
          <input className="sr-only" type="radio" name="weight-unit" value={option.value} checked={unit === option.value} onChange={() => setUnit(option.value)}/>
          <span>{option.label}</span><span className="option-check" aria-hidden="true">✓</span>
        </label>)}
      </div></fieldset>
    </div>
  </>;
}

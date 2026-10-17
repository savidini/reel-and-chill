import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type ToggleEvent } from 'react';
import { designs, type Design } from '../useDesign';
import type { ThemePreference } from '../useTheme';
import { DesignSwitcher } from './DesignSwitcher';
import { DisplaySettings } from './DisplaySettings';
import { Icon } from './Icon';
import { positionPopover } from './positionPopover';

function usePopover(maxWidth: number) {
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const returnFocus = useRef(false);
  const position = () => positionPopover(trigger.current, panel.current, maxWidth);
  useLayoutEffect(position);
  useEffect(() => {
    const close = () => panel.current?.hidePopover();
    const reposition = () => { if (panel.current?.matches(':popover-open')) position(); };
    window.addEventListener('hashchange', close);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('hashchange', close);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, []);
  return {
    trigger, panel, open,
    onBeforeToggle(event: ToggleEvent<HTMLDivElement>) {
      if (event.newState === 'open') position();
      else returnFocus.current = panel.current?.contains(document.activeElement) || document.activeElement === document.body;
    },
    onToggle(event: ToggleEvent<HTMLDivElement>) {
      const visible = event.newState === 'open';
      setOpen(visible);
      if (visible) {
        position();
        panel.current?.querySelector<HTMLInputElement>('input:checked')?.focus({ preventScroll: true });
      } else if (returnFocus.current && (document.activeElement === document.body || panel.current?.contains(document.activeElement))) {
        // The original invoker may have been replaced by a different layout.
        trigger.current?.focus({ preventScroll: true });
      }
    },
  };
}
export type PreferencePopover = ReturnType<typeof usePopover>;
type Preferences = {
  design: Design; theme: ThemePreference;
  designPicker: PreferencePopover; display: PreferencePopover;
};
const PreferencesContext = createContext<Preferences | null>(null);

/** Panels and their focus stay mounted while each layout owns its header slot. */
export function GuidePreferences({ children, design, setDesign, theme, setTheme, unit, setUnit }: {
  children: ReactNode; design: Design; setDesign: (value: Design) => void;
  theme: ThemePreference; setTheme: (value: ThemePreference) => void;
  unit: string; setUnit: (value: string) => void;
}) {
  const designPicker = usePopover(850);
  const display = usePopover(304);
  return <PreferencesContext.Provider value={{ design, theme, designPicker, display }}>
    {children}
    <DesignSwitcher design={design} onChange={setDesign} control={designPicker}/>
    <DisplaySettings theme={theme} setTheme={setTheme} unit={unit} setUnit={setUnit} control={display}/>
  </PreferencesContext.Provider>;
}

export function HeaderControls() {
  const preferences = useContext(PreferencesContext);
  if (!preferences) throw new Error('Header controls need GuidePreferences');
  const { design, theme, designPicker, display } = preferences;
  const selected = designs.find(option => option.id === design)!;
  return <div className="header-controls" aria-label="Guide preferences">
    <button ref={designPicker.trigger} className="design-trigger" popoverTarget="design-picker" aria-haspopup="dialog" aria-expanded={designPicker.open} aria-label={`Change design, current: ${selected.name}`}>
      <Icon name="grid" size={18}/><span>Design<span className="design-current"> · {selected.name}</span></span><span className="display-chevron" aria-hidden="true">⌄</span>
    </button>
    <button ref={display.trigger} className="display-trigger" popoverTarget="display-settings" aria-label="Display settings" aria-haspopup="dialog" aria-expanded={display.open} title="Appearance and weight units">
      <Icon name={theme} size={18}/><span>Display</span><span className="display-chevron" aria-hidden="true">⌄</span>
    </button>
  </div>;
}

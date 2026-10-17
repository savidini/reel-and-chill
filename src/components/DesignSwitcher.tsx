import { useEffect, useRef, useState } from 'react';
import { designs, type Design } from '../useDesign';
import { Icon } from './Icon';
import { positionPopover } from './positionPopover';

export function DesignSwitcher({ design, onChange }: { design: Design; onChange: (design: Design) => void }) {
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = designs.find(option => option.id === design)!;
  const position = () => positionPopover(trigger.current, panel.current, 850);
  useEffect(() => {
    const close = () => panel.current?.hidePopover();
    window.addEventListener('hashchange', close);
    window.addEventListener('resize', position);
    return () => {
      window.removeEventListener('hashchange', close);
      window.removeEventListener('resize', position);
    };
  }, []);
  // A design can also change the navigation width while this panel is open.
  useEffect(position, [design]);

  return <>
    <button ref={trigger} className="design-trigger" popoverTarget="design-picker" aria-haspopup="dialog" aria-expanded={open} aria-label={`Change design, current: ${selected.name}`}>
      <Icon name="grid" size={18}/><span>Design<span className="design-current"> · {selected.name}</span></span><span className="display-chevron" aria-hidden="true">⌄</span>
    </button>
    <div ref={panel} id="design-picker" className="design-panel" popover="auto" role="dialog" aria-labelledby="design-picker-title"
      onBeforeToggle={event => { if (event.newState === 'open') position(); }}
      onToggle={event => {
        setOpen(event.newState === 'open');
        if (event.newState === 'open') {
          position();
          panel.current?.querySelector<HTMLInputElement>('input:checked')?.focus({ preventScroll: true });
        }
      }}
      onBlur={event => {
        if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget) && event.relatedTarget !== trigger.current) panel.current?.hidePopover();
      }}>
      <div className="design-panel-heading"><div><h2 id="design-picker-title">Find your kind of chill.</h2><p>A field guide, a magazine, a quiet escape, a database, a catch book.</p></div><button className="icon-button" popoverTarget="design-picker" popoverTargetAction="hide" aria-label="Close design picker"><Icon name="close" size={16}/></button></div>
      <fieldset><legend className="sr-only">Guide design</legend><div className="design-options">
        {designs.map(option => <label className="design-option" key={option.id}>
          <input className="sr-only" type="radio" name="guide-design" value={option.id} checked={design === option.id} onChange={() => onChange(option.id)} aria-label={option.name} aria-describedby={`design-${option.id}-description`}/>
          <span className={`design-preview preview-${option.id}`} aria-hidden="true"><i className="preview-nav"/><i className="preview-heading"/><i className="preview-art"/><i className="preview-card one"/><i className="preview-card two"/><i className="preview-card three"/></span>
          <span className="design-option-copy"><span className="design-option-name">{option.name}<span className="design-selected" aria-hidden="true">✓</span></span><span id={`design-${option.id}-description`} className="design-option-description">{option.detail}</span></span>
        </label>)}
      </div></fieldset>
      <div className="design-panel-footer"><span role="status">{selected.name} selected · changes apply instantly</span><button popoverTarget="design-picker" popoverTargetAction="hide" className="button">Done</button></div>
    </div>
  </>;
}

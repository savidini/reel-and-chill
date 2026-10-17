/** Keep a top-bar panel inside the viewport, including Journal's tall masthead. */
export function positionPopover(trigger: HTMLElement | null, panel: HTMLElement | null, maxWidth: number) {
  if (!trigger || !panel) return;
  const rect = trigger.getBoundingClientRect();
  const viewport = document.documentElement.clientWidth;
  const width = panel.getBoundingClientRect().width || Math.min(maxWidth, viewport - 24);
  const top = Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - 120));
  panel.style.top = `${top}px`;
  panel.style.maxHeight = `${window.innerHeight - top - 12}px`;
  panel.style.left = `${Math.max(12, Math.min(rect.right - width, viewport - width - 12))}px`;
  panel.style.right = 'auto';
}

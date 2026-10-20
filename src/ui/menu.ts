// Small popovers (the player's settings, the panel's menu, the Chord page's View menu), closed by a
// click elsewhere or Escape; and quiet disclosure lines whose open state is remembered.

import { Child, h } from './dom';
import { chevronIcon } from './icons';

/** A remembered choice (null when storage is unavailable or nothing was kept). */
export function recall(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function keep(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode); the choice just isn't kept.
  }
}

let count = 0;

/** A button and the popover it opens under it. */
export function popover(button: HTMLButtonElement, ...rows: Child[]): { el: HTMLElement; close: () => void } {
  const id = `pop-${++count}`;
  const pop = h('div', { class: 'player-pop', id, hidden: true }, rows);
  const el = h('div', { class: 'pop-wrap' }, button, pop);
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', id);
  const setOpen = (open: boolean) => {
    pop.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    button.classList.toggle('open', open);
    if (open) fit(pop, button);
  };
  button.addEventListener('click', () => setOpen(pop.hidden));
  document.addEventListener('click', (e) => {
    if (!pop.hidden && !el.contains(e.target as Node)) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !pop.hidden) {
      setOpen(false);
      button.focus();
    }
  });
  return { el, close: () => setOpen(false) };
}

/**
 * Keep an open popover on screen, 8px from every edge: it opens upward when there's no room below
 * its button (a menu in the bottom dock), shifts sideways to fit, and scrolls inside if it's still too tall.
 */
function fit(pop: HTMLElement, button: HTMLElement) {
  const M = 8;
  pop.classList.remove('up');
  pop.style.transform = '';
  pop.style.maxHeight = '';
  const b = button.getBoundingClientRect();
  let r = pop.getBoundingClientRect();
  if (r.bottom > window.innerHeight - M && b.top - r.height - M >= M) {
    pop.classList.add('up');
    r = pop.getBoundingClientRect();
  }
  const dx = r.left < M ? M - r.left : r.right > window.innerWidth - M ? window.innerWidth - M - r.right : 0;
  if (dx) pop.style.transform = `translateX(${dx}px)`;
  const room = pop.classList.contains('up') ? b.top - 2 * M : window.innerHeight - r.top - M;
  if (r.height > room) {
    pop.style.maxHeight = `${Math.max(120, room)}px`;
    pop.style.overflowY = 'auto';
  }
}

/** A menu action: runs, then the menu closes. */
export const menuItem = (label: string, run: () => void, close: () => void) =>
  h('button', { class: 'menu-item', onclick: () => { close(); run(); } }, label);

/** A checkbox row (Loop, Swing, All chord tones), kept in step with the state by sync(). */
export function checkbox(label: string, checked: () => boolean, onChange: (on: boolean) => void) {
  const input = h('input', { type: 'checkbox', onchange: (e: Event) => onChange((e.target as HTMLInputElement).checked) });
  return { input, el: h('label', { class: 'check' }, input, label), sync: () => (input.checked = checked()) };
}

/** A quiet line that opens what's under it; open or closed is remembered. */
export function disclosure(key: string, summary: string, ...body: Child[]): HTMLDetailsElement {
  const d = h('details', { class: 'disclose', open: recall(key) === '1' }, h('summary', {}, chevronIcon(), summary), body);
  d.addEventListener('toggle', () => keep(key, d.open ? '1' : '0'));
  return d;
}

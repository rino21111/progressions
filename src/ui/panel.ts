// Whether the Progression panel (the sidebar; the dock on phones) is shown. It starts hidden while
// the progression is empty, opens by itself when the first chord goes in, and otherwise stays as the
// player last left it (remembered across visits).

import { state, subscribe } from '../state';
import { h } from './dom';
import { panelIcon } from './icons';

const KEY = 'guitar-theory-progression-open';

function stored(): boolean | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === null ? null : v === '1';
  } catch {
    return null;
  }
}

function remember(open: boolean) {
  try {
    localStorage.setItem(KEY, open ? '1' : '0');
  } catch {
    // Storage can be unavailable (private mode); the choice just isn't kept.
  }
}

/** The panel's state on load: hidden when empty; otherwise the last choice, or shown. */
export const initialOpen = (chords: number, choice: boolean | null) => (chords ? choice ?? true : false);

/** After a change to the progression: the first chord opens the panel; nothing else changes it. */
export const openAfter = (open: boolean, before: number, after: number) => (before === 0 && after > 0 ? true : open);

export interface Panel {
  /** For the main header: icon, "Progression" and the count (shown while the panel is hidden). */
  showButton: HTMLButtonElement;
  /** For the side header: icon only (shown while the panel is open). */
  hideButton: HTMLButtonElement;
  isOpen: () => boolean;
  toggle: () => void;
}

export function createPanel(app: HTMLElement): Panel {
  let open = initialOpen(state.progression.length, stored());
  let count = state.progression.length;
  let shown = open;
  const countEl = h('span', { class: 'panel-count' });
  const showButton = h('button', { class: 'panel-btn show', onclick: () => toggle() },
    panelIcon(), h('span', { class: 'panel-label' }, 'Progression'), countEl);
  const hideButton = h('button', {
    class: 'icon-btn panel-btn hide', title: 'Hide progression', 'aria-label': 'Hide progression', onclick: () => toggle(),
  }, panelIcon());

  const apply = () => {
    app.classList.toggle('panel-closed', !open);
    showButton.title = open ? 'Hide progression' : 'Show progression';
    showButton.setAttribute('aria-label', showButton.title);
    showButton.setAttribute('aria-expanded', String(open));
    countEl.textContent = state.progression.length ? String(state.progression.length) : '';
    // The page's room for the dock goes with it.
    if (!open) document.documentElement.style.setProperty('--dock-h', '0px');
    if (open !== shown) {
      shown = open;
      // Pages that lay out to their width (the tab's bars per line) reflow.
      window.dispatchEvent(new Event('resize'));
    }
  };
  const toggle = () => {
    open = !open;
    remember(open);
    apply();
  };
  subscribe(() => {
    // An add while the panel is hidden is confirmed by its count.
    if (state.progression.length > count && count > 0 && !open) {
      countEl.classList.remove('pulse');
      void countEl.offsetWidth;
      countEl.classList.add('pulse');
    }
    open = openAfter(open, count, state.progression.length);
    count = state.progression.length;
    apply();
  });
  apply();
  return { showButton, hideButton, isOpen: () => open, toggle };
}

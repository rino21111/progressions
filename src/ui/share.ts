// The Share buttons (Progression panel, Chord page) and opening a shared link. On phones the
// system share sheet is used when there is one; otherwise the link is copied, with a short toast.

import { Shared } from '../share';
import { state, update } from '../state';
import { noteCause } from '../undo';
import { h } from './dom';
import { shareIcon } from './icons';

let toastTimer = 0;
function toast(text: string) {
  const el = document.querySelector('.toast') ?? document.body.appendChild(h('div', { class: 'toast', role: 'status' }));
  el.textContent = text;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('on'), 1600);
}

/** A Share icon button for the link `hash()` makes (null: nothing to share). */
export function shareButton(label: string, hash: () => string | null): HTMLButtonElement {
  return h('button', {
    class: 'player-btn toggle-btn share-btn', title: label, 'aria-label': label,
    onclick: async () => {
      const value = hash();
      if (!value) return;
      const url = `${location.origin}${location.pathname}#${value}`;
      if (window.matchMedia('(max-width: 999px)').matches && navigator.share) {
        navigator.share({ url }).catch(() => {});
        return;
      }
      try {
        await navigator.clipboard.writeText(url);
        toast('Link copied');
      } catch {
        // No clipboard access (an insecure page or a refusal): nothing to confirm.
      }
    },
  }, shareIcon());
}

/** Open a shared link: it replaces the progression (or chord) and the settings; Undo brings back what was there. */
export function applyShare(shared: Shared) {
  const patch = { ...shared.patch };
  if (patch.playVariants) patch.playVariants = { ...state.playVariants, ...patch.playVariants };
  if (shared.kind === 'chord' && patch.fingering) noteCause('hand');
  update(patch);
}

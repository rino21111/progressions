import './style.css';
// Start tracking undo history before anything else subscribes, so undo buttons see each change.
import { redo, undo } from './undo';
import { createDetector, focusSearch } from './ui/detector';
import { createProgressions } from './ui/progressions';
import { createTab } from './ui/tab';
import { add, h } from './ui/dom';
import { fretIcon } from './ui/icons';
import { PlayerTarget, createPlayer } from './ui/player';
import { createSidebar } from './ui/sidebar';
import { createPanel } from './ui/panel';
import { addSelection, moveProgressionCard, removeFromProgression, selectCard } from './ui/common';
import { canUndo } from './undo';
import { shortcutFor } from './interaction';
import { cardIndex, stepCard } from './yourChords';
import { isDragging } from './ui/dragReorder';
import { undoIcon } from './ui/icons';
import { state, subscribe } from './state';
import { setTone } from './audio';
import { PROGRESSION_ID, progressionFingerings } from './playback';
import { OLD_TAB_HASHES, TAB_HASHES, TAB_LABELS } from './tabs';
import { readShare } from './share';
import { applyShare } from './ui/share';

type Tab = 'detector' | 'progressions' | 'tab';

const tabPage = createTab();
const pages: Record<Tab, HTMLElement> = {
  detector: createDetector(),
  progressions: createProgressions(),
  tab: tabPage.el,
};

const tabs = (Object.keys(pages) as Tab[]).map((tab) =>
  h('button', { class: 'tab', role: 'tab', 'data-tab': tab, onclick: () => show(tab) }, TAB_LABELS[tab]),
);

// Play (and Space) always plays the progression, on either page; playback carries on across tabs.
const target: PlayerTarget = { id: PROGRESSION_ID, perChord: true, chords: () => progressionFingerings(state) };
const player = createPlayer(() => target);

function show(tab: Tab) {
  for (const [name, page] of Object.entries(pages)) page.hidden = name !== tab;
  tabs.forEach((b) => {
    const active = b.dataset.tab === tab;
    b.classList.toggle('active', active);
    b.setAttribute('aria-selected', String(active));
  });
  const hash = `#${TAB_HASHES[tab]}`;
  if (location.hash !== hash) history.replaceState(null, '', hash);
  window.scrollTo({ top: 0 });
  if (tab === 'tab') tabPage.refresh();
}

setTone(state.tone);
subscribe((s) => setTone(s.tone));

// Keyboard shortcuts (shown in tooltips): A adds the selection, Space plays, Delete removes the
// selected card, arrows select the next card, Alt+arrows move it, / searches, Cmd/Ctrl+Z undoes
// (Shift redoes). Typing in a field is left alone.
document.addEventListener('keydown', (e) => {
  const typing = e.target instanceof Element && !!e.target.closest('input, select, textarea, [contenteditable]');
  const action = shortcutFor({ key: e.key, metaKey: e.metaKey, ctrlKey: e.ctrlKey, altKey: e.altKey, shiftKey: e.shiftKey, typing });
  if (!action || (action === 'play' && e.repeat)) return;
  const n = state.progression.length;
  const card = cardIndex(n, state.selectedCard);
  // Alt+arrows are left to the browser unless there's a card to move.
  if ((action === 'moveLeft' || action === 'moveRight') && card < 0) return;
  e.preventDefault();
  // While a card is lifted, nothing else may change the progression.
  if (isDragging() && action !== 'play' && action !== 'search') return;
  switch (action) {
    case 'add':
      addSelection();
      break;
    case 'play':
      player.toggle();
      break;
    case 'remove':
      if (card >= 0) removeFromProgression(card);
      break;
    case 'prev':
    case 'next':
      if (n) selectCard(stepCard(n, state.selectedCard, action === 'prev' ? -1 : 1));
      break;
    case 'moveLeft':
    case 'moveRight':
      if (card >= 0) moveProgressionCard(card, card + (action === 'moveLeft' ? -1 : 1));
      break;
    case 'search':
      show('detector');
      focusSearch();
      break;
    case 'undo':
      undo();
      break;
    case 'redo':
      redo();
      break;
  }
});

const undoButton = h('button', { class: 'icon-btn undo-btn', title: 'Undo (Cmd/Ctrl+Z)', 'aria-label': 'Undo', onclick: () => undo() }, undoIcon());
subscribe(() => (undoButton.disabled = !canUndo()));
undoButton.disabled = !canUndo();

// Two columns on desktop: the page (scrolling) and the Progression sidebar (scrolling on its own),
// under one header line. On phones the sidebar becomes a dock at the bottom.
const app = h('div', { class: 'app' });
const panel = createPanel(app);
const sidebar = createSidebar(player.el, panel.toggle);
add(app,
    h('header', { class: 'main-header' },
      h('div', { class: 'brand', role: 'img', 'aria-label': 'progressions', title: 'progressions' }, h('span', { class: 'logo' }, fretIcon(22))),
      h('nav', { class: 'tabs', role: 'tablist' }, tabs),
      h('span', { class: 'spacer' }),
      undoButton,
      player.settings,
      panel.showButton,
    ),
    sidebar.header,
    h('main', {}, Object.values(pages)),
    sidebar.body,
);
document.querySelector('#app')!.append(app);

// A shared link (#v=1&p=...) replaces the progression or chord and the settings, then opens its page;
// the page's own hash takes the link's place, so a reload doesn't apply it again. Old links
// (#progressions) still open Relationships.
function openHash() {
  const shared = readShare(location.hash);
  if (shared) {
    applyShare(shared);
    history.replaceState(null, '', location.pathname);
    show(shared.page ?? 'detector');
    return;
  }
  const hashName = location.hash.slice(1);
  const fromHash = (Object.keys(TAB_HASHES) as Tab[]).find((t) => TAB_HASHES[t] === hashName)
    ?? OLD_TAB_HASHES[hashName as keyof typeof OLD_TAB_HASHES];
  show(fromHash ?? 'detector');
}
window.addEventListener('hashchange', () => readShare(location.hash) && openHash());
openHash();

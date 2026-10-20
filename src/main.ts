import './style.css';
// Start tracking undo history before anything else subscribes, so undo buttons see each change.
import { redo, undo } from './undo';
import { createTab } from './ui/tab';
import { add, h } from './ui/dom';
import { PlayerTarget, createPlayer } from './ui/player';
import { Mode, createInstrument } from './ui/instrument';
import { addSelection, moveProgressionCard, removeFromProgression, selectCard } from './ui/common';
import { shortcutFor } from './interaction';
import { cardIndex, stepCard } from './yourChords';
import { isDragging } from './ui/dragReorder';
import { state, subscribe } from './state';
import { setTone } from './audio';
import { PROGRESSION_ID, progressionFingerings } from './playback';
import { Page, openFromHash, syncHash } from './share';

// Play (and Space) always plays the progression; playback carries on whatever is shown.
const target: PlayerTarget = { id: PROGRESSION_ID, perChord: true, chords: () => progressionFingerings(state) };
const player = createPlayer(() => target);
const tabPage = createTab();

// The address carries the state (#chord&p=C.G.Am.F&bpm=120), so copying it shares it. The route is
// the view: chord (the instrument) or tab.
let mode: Mode = 'chords';
const page = (): Page => (mode === 'tab' ? 'tab' : 'detector');
// Edits update the address 300ms after the last change, in place: Back never steps through them.
const writeHash = syncHash(page, (hash) => {
  if (location.hash !== `#${hash}`) history.replaceState(null, '', `#${hash}`);
});

const instrument = createInstrument({
  play: player.el,
  settings: player.settings,
  settingsPop: player.settings.querySelector('.player-pop') as HTMLElement,
  tab: tabPage.el,
  onMode: (m) => {
    mode = m;
    writeHash();
    if (m === 'tab') tabPage.refresh();
  },
});

setTone(state.tone);
subscribe((s) => setTone(s.tone));

// Keyboard shortcuts (shown in tooltips): A adds the selection, Space plays, Delete removes the
// card at your place, arrows move your place, Alt+arrows move the card, / searches, Cmd/Ctrl+Z undoes
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
      instrument.setMode('chords');
      instrument.focusSearch();
      break;
    case 'undo':
      undo();
      break;
    case 'redo':
      redo();
      break;
  }
});

const app = h('div', { class: 'app' });
add(app, instrument.stage, instrument.desk);
document.querySelector('#app')!.append(app);

// A shared address replaces the progression and settings (Undo takes it back); a bare one keeps
// the saved state. Old routes (#next, #progressions, #chord) open the instrument.
const show = (p: Page) => instrument.setMode(p === 'tab' ? 'tab' : 'chords');
window.addEventListener('hashchange', () => show(openFromHash(location.hash, page())));
window.addEventListener('pagehide', writeHash);
show(openFromHash(location.hash, 'detector'));
writeHash();

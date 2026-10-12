// Undo covers what you built, not what you looked at: changes to the progression (add, remove, move,
// duplicate, clear) and fretboard edits are steps; selecting a chord to look at or hear it is not, unless it replaces
// a shape you edited by hand (so that edit can be recovered).

import { History } from './history';
import { AppState, state, subscribe, update } from './state';

type Entry =
  | { kind: 'chords'; progression: AppState['progression']; selectedCard: AppState['selectedCard'] }
  | { kind: 'shape'; fingering: AppState['fingering']; selected: AppState['selected']; hand: boolean };

const history = new History<Entry>();
let last = { progression: state.progression, selectedCard: state.selectedCard, fingering: state.fingering, selected: state.selected };
/** Whether the current fingering was edited by hand on the fretboard. */
let hand = false;
let cause: 'hand' | 'select' | null = null;
let restoring = false;

/** Call just before a state update so the change is classed correctly. */
export function noteCause(next: 'hand' | 'select') {
  cause = next;
}

subscribe((s) => {
  const chordsChanged = s.progression !== last.progression;
  const shapeChanged = s.fingering !== last.fingering;
  if (!restoring) {
    if (chordsChanged) history.record({ kind: 'chords', progression: last.progression, selectedCard: last.selectedCard });
    if (shapeChanged && (cause === 'hand' || (cause === 'select' && hand))) {
      history.record({ kind: 'shape', fingering: last.fingering, selected: last.selected, hand });
    }
    if (shapeChanged) hand = cause === 'hand';
  }
  last = { progression: s.progression, selectedCard: s.selectedCard, fingering: s.fingering, selected: s.selected };
  cause = null;
});

const current = (kind: Entry['kind']): Entry =>
  kind === 'chords'
    ? { kind, progression: state.progression, selectedCard: state.selectedCard }
    : { kind, fingering: state.fingering, selected: state.selected, hand };

function restore(entry: Entry | undefined) {
  if (!entry) return;
  restoring = true;
  if (entry.kind === 'chords') update({ progression: entry.progression, selectedCard: entry.selectedCard });
  else {
    update({ fingering: entry.fingering, selected: entry.selected });
    hand = entry.hand;
  }
  restoring = false;
}

export function undo() {
  const next = history.peekUndo();
  if (next) restore(history.undo(current(next.kind)));
}

export function redo() {
  const next = history.peekRedo();
  if (next) restore(history.redo(current(next.kind)));
}

export const canUndo = () => history.canUndo;

/** Start from an empty history (used by tests to begin each case cleanly). */
export const forgetHistory = () => history.clear();

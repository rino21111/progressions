// Small rules for clicks and keys, kept free of the page so they can be tested.

import { Chord, chordSymbol } from './theory/chords';

/** A click on a chord: the first selects and strums it; the second of a double-click adds it. */
export function chordClickAction(clickCount: number): 'select' | 'add' | 'none' {
  if (clickCount <= 1) return 'select';
  return clickCount === 2 ? 'add' : 'none';
}

/** What the add card shows for the selection. */
export function addCardLabel(selected: Chord | null): { symbol: string; title: string; disabled: boolean } {
  if (!selected) return { symbol: '', title: 'Select a chord to add it', disabled: true };
  const symbol = chordSymbol(selected);
  return { symbol, title: `Add ${symbol} (A)`, disabled: false };
}

export type Shortcut = 'add' | 'play' | 'remove' | 'prev' | 'next' | 'moveLeft' | 'moveRight' | 'search' | 'undo' | 'redo';

interface KeyLike {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  /** Focus is in a text field, select or similar. */
  typing: boolean;
}

/** The keyboard shortcut for a key press, if any. Most are ignored while typing. */
export function shortcutFor(e: KeyLike): Shortcut | null {
  const mod = e.metaKey || e.ctrlKey;
  if (mod && !e.altKey && e.key.toLowerCase() === 'z') return e.typing ? null : e.shiftKey ? 'redo' : 'undo';
  if (e.altKey && !mod && !e.typing && e.key === 'ArrowLeft') return 'moveLeft';
  if (e.altKey && !mod && !e.typing && e.key === 'ArrowRight') return 'moveRight';
  if (mod || e.altKey || e.typing) return null;
  switch (e.key) {
    case 'a':
    case 'A':
      return 'add';
    case ' ':
      return 'play';
    case 'Delete':
    case 'Backspace':
      return 'remove';
    case 'ArrowLeft':
      return 'prev';
    case 'ArrowRight':
      return 'next';
    case '/':
      return 'search';
    default:
      return null;
  }
}

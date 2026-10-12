import { describe, expect, it } from 'vitest';
import { addCardLabel, chordClickAction, shortcutFor } from '../src/interaction';
import { makeChord } from '../src/theory/chords';
import { parseChordName, parseSearch } from '../src/theory/search';
import { chordFitInKey } from '../src/theory/keys';

describe('clicking chords', () => {
  it('a single click selects; the second click of a double-click adds (without re-selecting)', () => {
    expect(chordClickAction(1)).toBe('select');
    expect(chordClickAction(2)).toBe('add');
    expect(chordClickAction(3)).toBe('none');
  });
});

describe('the add card', () => {
  it('names the selection, with its shortcut', () => {
    expect(addCardLabel(makeChord(2, 'min'))).toEqual({ symbol: 'Dm', title: 'Add Dm (A)', disabled: false });
    expect(addCardLabel(null).disabled).toBe(true);
  });
});

describe('keyboard shortcuts', () => {
  const k = (key: string, more: Partial<Parameters<typeof shortcutFor>[0]> = {}) => shortcutFor({ key, typing: false, ...more });
  it('maps A, Space, Delete/Backspace, arrows and / when not typing', () => {
    expect(k('a')).toBe('add');
    expect(k('A')).toBe('add');
    expect(k(' ')).toBe('play');
    expect(k('Delete')).toBe('remove');
    expect(k('Backspace')).toBe('remove');
    expect(k('ArrowLeft')).toBe('prev');
    expect(k('ArrowRight')).toBe('next');
    expect(k('/')).toBe('search');
  });
  it('ignores them while typing in a field', () => {
    expect(k('a', { typing: true })).toBeNull();
    expect(k('Backspace', { typing: true })).toBeNull();
  });
  it('undo and redo with Cmd/Ctrl+Z', () => {
    expect(k('z', { metaKey: true })).toBe('undo');
    expect(k('z', { ctrlKey: true, shiftKey: true })).toBe('redo');
    expect(k('a', { metaKey: true })).toBeNull(); // Cmd+A stays select-all
  });
  it('Alt/Option + arrows move the selected card', () => {
    expect(k('ArrowLeft', { altKey: true })).toBe('moveLeft');
    expect(k('ArrowRight', { altKey: true })).toBe('moveRight');
    expect(k('ArrowLeft', { altKey: true, typing: true })).toBeNull();
  });
});

describe('the search field', () => {
  it('reads chord names', () => {
    expect(parseChordName('Dm7')).toMatchObject({ root: 2, template: { id: 'm7' } });
    expect(parseChordName('F#m7b5')).toMatchObject({ root: 6, template: { id: 'm7b5' } });
    expect(parseChordName('Bbmaj7')).toMatchObject({ root: 10, template: { id: 'maj7' } });
    expect(parseChordName('C/E')).toMatchObject({ root: 0, bass: 4, template: { id: 'maj' } });
    expect(parseChordName('Am')).toMatchObject({ root: 9, template: { id: 'min' } });
    expect(parseChordName('Hm')).toBeNull();
    expect(parseChordName('Cxyz')).toBeNull();
  });

  it('tells fingerings from chord names', () => {
    expect(parseSearch('x02210')).toEqual({ kind: 'fingering', fingering: [null, 0, 2, 2, 1, 0] });
    expect(parseSearch('10-12-12-10-10-10')).toEqual({ kind: 'fingering', fingering: [10, 12, 12, 10, 10, 10] });
    expect(parseSearch('Dm7')?.kind).toBe('chord');
    expect(parseSearch('xx')).toBeNull();
    expect(parseSearch('')).toBeNull();
  });
});

describe('out-of-key chords', () => {
  it('are told apart so their numeral can be coloured', () => {
    const C = { tonic: 0, mode: 'major' as const };
    expect(chordFitInKey(makeChord(2, 'min'), C)).not.toBe('outside');
    expect(chordFitInKey(makeChord(1, 'maj'), C)).toBe('outside');
  });
});

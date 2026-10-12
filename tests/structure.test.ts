import { describe, expect, it } from 'vitest';
import { chordStructure } from '../src/theory/structure';
import { makeChord } from '../src/theory/chords';
import { parseFingering } from '../src/theory/fingering';

const ROWS = ['13', '11', '9', '7th', '5', '3', 'R', 'Bass'];
/** Each row as "note label state", or "-" when empty, keyed by row. */
function stack(root: number, type: string, shape: string | null = null, bass = root) {
  const rows = chordStructure(makeChord(root, type, bass), shape ? parseFingering(shape) : null);
  return Object.fromEntries(rows.map((r, i) => [ROWS[i], r.label ? `${r.note} ${r.label} ${r.state}` : '-']));
}
/** Which option column (0-3) is the chord's own in a row, or -1. */
const column = (root: number, type: string, row: number) =>
  chordStructure(makeChord(root, type), null)[row].options.findIndex((o) => o?.on);

describe('chord structure', () => {
  it('Abmaj7: root, 3, 5 and 7', () => {
    expect(stack(8, 'maj7')).toEqual({ 13: '-', 11: '-', 9: '-', '7th': 'G 7 on', 5: 'Eb 5 on', 3: 'C 3 on', R: 'Ab R on', Bass: '-' });
  });

  it('Asus4 puts the 4 in the 3rd row, last column', () => {
    expect(stack(9, 'sus4')[3]).toBe('D 4 on');
    expect(column(9, 'sus4', 5)).toBe(3);
  });

  it('Cadd9 fills the 9 row only (no 7th)', () => {
    const s = stack(0, 'add9');
    expect(s[9]).toBe('D 9 on');
    expect(s['7th']).toBe('-');
  });

  it('C6 puts the 6 in the 7th row', () => {
    expect(stack(0, '6')['7th']).toBe('A 6 on');
    expect(column(0, '6', 3)).toBe(1);
  });

  it("Cdim7 shows bb7 in the 6's column", () => {
    expect(stack(0, 'dim7')['7th']).toBe('Bbb bb7 on');
    const opt = chordStructure(makeChord(0, 'dim7'), null)[3].options[1];
    expect(opt).toEqual({ text: 'bb7', on: true });
  });

  it('C7#9: the #9 in the last column of the 9 row, b7 in the 7th row', () => {
    const s = stack(0, '7#9');
    expect(s[9]).toBe('D# #9 on');
    expect(column(0, '7#9', 2)).toBe(3);
    expect(s['7th']).toBe('Bb b7 on');
  });

  it('Cm13 (the engine has no m7b13): 13 in the 13 row, natural column; b3 and b7', () => {
    const s = stack(0, 'm13');
    expect(s[13]).toBe('A 13 on');
    expect(column(0, 'm13', 0)).toBe(2);
    expect(s[3]).toBe('Eb b3 on');
  });

  it('G7 shell 3x34xx leaves the 5th out (implied)', () => {
    const s = stack(7, '7', '3x34xx');
    expect(s[5]).toBe('D 5 implied');
    expect(s['7th']).toBe('F b7 on');
    expect(s.Bass).toBe('-');
  });

  it('Am/C x32210: bass C, b3', () => {
    expect(stack(9, 'min', 'x32210', 0).Bass).toBe('C b3 on');
  });
});

import { describe, expect, it } from 'vitest';
import { pairVoices } from '../src/theory/voiceLeading';
import { makeChord } from '../src/theory/chords';
import { sharpName } from '../src/theory/notes';

const ch = (root: number, type: string) => makeChord(root, type);
const F = ch(5, 'maj');
/** "from>to(semis)" per voice, root first. */
const moves = (a: ReturnType<typeof ch>, b: ReturnType<typeof ch>) =>
  pairVoices(a, b).moves.map((m) => `${sharpName(m.from)}>${sharpName(m.to)}(${m.semis})`).join(' ');

describe('voice pairing', () => {
  it('F to G: down to the nearest notes, avoiding parallel fifths', () => {
    expect(moves(F, ch(7, 'maj'))).toBe('F>D(-3) A>G(-2) C>B(-1)');
  });
  it('F to C: C stays, A to G, F to E', () => {
    expect(moves(F, ch(0, 'maj'))).toBe('F>E(-1) A>G(-2) C>C(0)');
  });
  it('F to Fm: only the third moves, down a fret', () => {
    expect(moves(F, ch(5, 'min'))).toBe('F>F(0) A>G#(-1) C>C(0)');
  });
  it('F to Dm: two notes held, C up to D', () => {
    expect(moves(F, ch(2, 'min'))).toBe('F>F(0) A>A(0) C>D(2)');
  });
  it('F to Bb and Ab', () => {
    expect(moves(F, ch(10, 'maj'))).toBe('F>F(0) A>A#(1) C>D(2)');
    expect(moves(F, ch(8, 'maj'))).toBe('F>D#(-2) A>G#(-1) C>C(0)');
  });
  it('triad to a seventh chord: the extra tone enters on top', () => {
    const e7 = pairVoices(F, ch(4, '7'));
    expect(e7.moves).toHaveLength(3);
    expect(e7.entering).toHaveLength(1);
    const a7 = pairVoices(F, ch(9, '7'));
    expect(a7.entering).toHaveLength(1);
  });
  it('seventh to triad: two voices may share a note (G7 to C)', () => {
    const p = pairVoices(ch(7, '7'), ch(0, 'maj'));
    expect(p.moves).toHaveLength(4);
    expect(new Set(p.moves.map((m) => m.to)).size).toBe(3);
    expect(p.moves.find((m) => m.fromLabel === '3')!.to).toBe(0); // B up to C
    expect(p.moves.find((m) => m.fromLabel === 'b7')!.to).toBe(4); // F down to E
  });
  it('Cmaj7 to F: C holds, E and B up a fret, G up to A', () => {
    const p = pairVoices(ch(0, 'maj7'), F);
    expect(p.cost).toBe(4);
    expect(p.moves.map((m) => m.semis)).toEqual([0, 1, 2, 1]);
  });
});

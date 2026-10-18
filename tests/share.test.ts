// Share links: state to hash to state, for a progression and for a chord, and links with junk in them.
import { describe, expect, it } from 'vitest';
import { chordHash, progressionHash, readShare } from '../src/share';
import { AppState, ProgressionChord, state } from '../src/state';
import { chordSymbol } from '../src/theory/chords';
import { parseChordName } from '../src/theory/search';

const chord = (name: string, fingering?: (number | null)[]): ProgressionChord => {
  const c: ProgressionChord = parseChordName(name)!;
  if (fingering) c.fingering = fingering;
  return c;
};
const names = (list: ProgressionChord[] = []) => list.map((c) => chordSymbol(c)).join(' ');

describe('share links', () => {
  it('a progression with custom shapes and non-default settings comes back the same', () => {
    const s: AppState = {
      ...state,
      progression: [chord('C'), chord('G', [3, 5, 5, 4, 3, 3]), chord('Am'), chord('F#m7b5'), chord('C/E')],
      keyChoice: '9-minor', style: 'sevenths', playPattern: 'bossa', playVariants: { ...state.playVariants, bossa: 'clave' },
      bpm: 132, beatsPerBar: 3, barsPerChord: 2, tone: 'nylon', swing: true, loop: false,
    };
    const hash = progressionHash(s, 'progressions');
    expect(hash).toBe('v=1&p=C.G.Am.F%23m7b5.C/E&f=_.355433._._._&key=Am&style=sevenths&play=bossa.clave&bpm=132&time=3&bars=2&tone=nylon&swing=1&loop=0&page=next');
    const back = readShare(`#${hash}`)!;
    expect(back.kind).toBe('progression');
    expect(back.page).toBe('progressions');
    expect(names(back.patch.progression)).toBe('C G Am F#m7b5 C/E');
    expect(back.patch.progression!.map((c) => c.fingering ?? null)).toEqual([null, [3, 5, 5, 4, 3, 3], null, null, null]);
    expect(back.patch).toMatchObject({
      keyChoice: '9-minor', style: 'sevenths', playPattern: 'bossa', playVariants: { bossa: 'clave' },
      bpm: 132, beatsPerBar: 3, barsPerChord: 2, tone: 'nylon', swing: true, loop: false,
    });
  });
  it('Best guess leaves the key out, and a link without one goes back to guessing', () => {
    const hash = progressionHash({ ...state, progression: [chord('C'), chord('G')], keyChoice: null }, 'detector');
    expect(hash).not.toMatch(/key=/);
    expect(readShare(`#${hash}`)!.patch.keyChoice).toBeNull();
  });
  it('a chord link carries its shape and the settings, and opens the Chord page', () => {
    const cadd9 = parseChordName('Cadd9')!;
    const hash = chordHash(cadd9, [null, 3, 2, 0, 3, 0], { ...state, bpm: 160, loop: true });
    expect(hash).toBe('v=1&c=Cadd9&f=x32030&play=strum.whole&bpm=160&time=4&bars=1&tone=steel&swing=0&loop=1');
    const back = readShare(`#${hash}`)!;
    expect(back.kind).toBe('chord');
    expect(back.page).toBe('detector');
    expect(chordSymbol(back.patch.selected!)).toBe('Cadd9');
    expect(back.patch.fingering).toEqual([null, 3, 2, 0, 3, 0]);
    expect(back.patch).toMatchObject({ bpm: 160, loop: true, playPattern: 'strum' });
  });
  it('junk is ignored and the rest still loads', () => {
    const back = readShare('#v=9&p=C.Hm.G.zz&f=x32010.bad&key=Q&style=polka&play=kazoo.x&bpm=9999&time=7&bars=x&tone=banjo&swing=2&loop=yes&page=nowhere&what=1&%=%E0')!;
    expect(names(back.patch.progression)).toBe('C G');
    expect(back.patch.progression![0].fingering).toEqual([null, 3, 2, 0, 1, 0]);
    expect(back.page).toBeNull();
    for (const k of ['keyChoice', 'style', 'playPattern', 'bpm', 'beatsPerBar', 'barsPerChord', 'tone', 'swing', 'loop']) expect(back.patch).not.toHaveProperty(k);
  });
  it('page hashes are not share links', () => {
    expect(readShare('#next')).toBeNull();
    expect(readShare('')).toBeNull();
  });
});

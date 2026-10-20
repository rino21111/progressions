// The address carries the state: state to hash to state, defaults left out, bare addresses keep the
// saved state, and edits reach the address.
import { describe, expect, it, vi } from 'vitest';
import { openFromHash, readShare, stateHash, syncHash } from '../src/share';
import { AppState, DEFAULTS, ProgressionChord, state, update } from '../src/state';
import { chordSymbol } from '../src/theory/chords';
import { parseChordName } from '../src/theory/search';

const chord = (name: string, fingering?: (number | null)[]): ProgressionChord => {
  const c: ProgressionChord = parseChordName(name)!;
  if (fingering) c.fingering = fingering;
  return c;
};
const names = (list: ProgressionChord[] = []) => list.map((c) => chordSymbol(c)).join(' ');
const base: AppState = { ...DEFAULTS, playVariants: { ...DEFAULTS.playVariants } };

describe('the address carries the state', () => {
  it('a progression with custom shapes and non-default settings comes back the same', () => {
    const s: AppState = {
      ...base,
      progression: [chord('C'), chord('G', [3, 5, 5, 4, 3, 3]), chord('Am'), chord('F#m7b5'), chord('C/E')],
      keyChoice: '9-minor', style: 'sevenths', playPattern: 'bossa', playVariants: { ...base.playVariants, bossa: 'clave' },
      bpm: 132, beatsPerBar: 3, barsPerChord: 2, tone: 'nylon', swing: true, loop: false,
    };
    const hash = stateHash(s, 'progressions');
    expect(hash).toBe('progression&p=C.G.Am.F%23m7b5.C/E&f=_.355433._._._&key=Am&style=sevenths&play=bossa.clave&bpm=132&time=3&bars=2&tone=nylon&swing=1&loop=0');
    const back = readShare(`#${hash}`)!;
    expect(back.page).toBe('progressions');
    expect(names(back.patch.progression)).toBe('C G Am F#m7b5 C/E');
    expect(back.patch.progression!.map((c) => c.fingering ?? null)).toEqual([null, [3, 5, 5, 4, 3, 3], null, null, null]);
    expect(back.patch).toMatchObject({
      keyChoice: '9-minor', style: 'sevenths', playPattern: 'bossa', playVariants: { bossa: 'clave' },
      bpm: 132, beatsPerBar: 3, barsPerChord: 2, tone: 'nylon', swing: true, loop: false,
    });
  });
  it('defaults are left out: C G Am F at 160 bpm in Triads is just the chords', () => {
    expect(stateHash({ ...base, progression: [chord('C'), chord('G'), chord('Am'), chord('F')] }, 'progressions')).toBe('progression&p=C.G.Am.F');
    expect(stateHash(base, 'tab')).toBe('tab');
    expect(stateHash(base, 'detector')).toBe('chord');
  });
  it('and what a link leaves out loads as the default', () => {
    const back = readShare('#next&p=C.G')!;
    expect(back.patch).toMatchObject({ keyChoice: null, style: 'triads', playPattern: 'strum', bpm: 160, beatsPerBar: 4, barsPerChord: 1, tone: 'steel', swing: false, loop: true });
  });
  it('on the Chord page it carries the chord and its shape when the shape is not the usual one', () => {
    const cadd9 = parseChordName('Cadd9')!;
    expect(stateHash({ ...base, selected: cadd9, fingering: [null, 3, 2, 0, 3, 0] }, 'detector')).toBe('chord&c=Cadd9&cf=x32030');
    const back = readShare('#chord&c=Cadd9&cf=x32030')!;
    expect(back.page).toBe('detector');
    expect(chordSymbol(back.patch.selected!)).toBe('Cadd9');
    expect(back.patch.fingering).toEqual([null, 3, 2, 0, 3, 0]);
    // A shape that isn't a chord travels as its frets alone.
    expect(stateHash({ ...base, selected: null, fingering: [0, 1, 2, null, null, null] }, 'detector')).toBe('chord&cf=012xxx');
    expect(readShare('#chord&cf=012xxx')!.patch.fingering).toEqual([0, 1, 2, null, null, null]);
  });
  it('links from the first Share button still open', () => {
    const p = readShare('#v=1&p=C.G&style=sevenths&bpm=120&page=tab')!;
    expect(p.page).toBe('tab');
    expect(names(p.patch.progression)).toBe('C G');
    const c = readShare('#v=1&c=Cadd9&f=x32030&bpm=160')!;
    expect(c.page).toBe('detector');
    expect(c.patch.fingering).toEqual([null, 3, 2, 0, 3, 0]);
    expect(c.patch).not.toHaveProperty('progression');
  });
  it('junk is skipped and the rest still loads', () => {
    const back = readShare('#next&p=C.Hm.G.zz&f=x32010.bad&key=Q&style=polka&play=kazoo.x&bpm=9999&time=7&bars=x&tone=banjo&swing=2&loop=yes&what=1&%=%E0')!;
    expect(names(back.patch.progression)).toBe('C G');
    expect(back.patch.progression![0].fingering).toEqual([null, 3, 2, 0, 1, 0]);
    expect(back.patch).toMatchObject({ keyChoice: null, style: 'triads', bpm: 160, beatsPerBar: 4, tone: 'steel', loop: true });
  });
  it('a bare address (or only a route) keeps the saved state', () => {
    expect(readShare('#next')).toBeNull();
    expect(readShare('')).toBeNull();
    update({ progression: [chord('D'), chord('A')] });
    const before = state.progression;
    expect(openFromHash('#next', 'detector')).toBe('progressions');
    expect(openFromHash('', 'detector')).toBe('detector');
    expect(state.progression).toBe(before);
  });
  it('a shared address replaces the progression; this browser\'s own address after a reload changes nothing', () => {
    update({ progression: [chord('D'), chord('A')], bpm: 100 });
    expect(openFromHash('#next&p=C.G.Am.F', 'detector')).toBe('progressions');
    expect(names(state.progression)).toBe('C G Am F');
    expect(state.bpm).toBe(160);
    const own = state.progression;
    openFromHash(`#${stateHash(state, 'progressions')}`, 'detector');
    expect(state.progression).toBe(own);
  });
  it('edits reach the address 300ms after the last change', () => {
    vi.useFakeTimers();
    const written: string[] = [];
    syncHash(() => 'progressions', (h) => written.push(h));
    update({ progression: [chord('C')], bpm: 160 });
    update({ progression: [chord('C'), chord('F')] });
    expect(written).toEqual([]);
    vi.advanceTimersByTime(300);
    expect(written).toEqual(['progression&p=C.F']);
    vi.useRealTimers();
  });
  it('progression chords are written in the key\'s spelling, and old links in the general spelling still load', () => {
    const ab = ['Ab', 'Db', 'Eb', 'Fm'].map((n) => chord(n));
    expect(stateHash({ ...base, progression: ab }, 'progressions')).toBe('progression&p=Ab.Db.Eb.Fm');
    const old = readShare('#next&p=Ab.C%23.Eb.Fm')!;
    expect(old.patch.progression!.map((c) => c.root)).toEqual([8, 1, 3, 5]);
    expect(stateHash({ ...base, progression: old.patch.progression! }, 'progressions')).toBe('progression&p=Ab.Db.Eb.Fm');
    expect(stateHash({ ...base, progression: [chord('F#'), chord('C#'), chord('D#m'), chord('B')] }, 'progressions')).toBe('progression&p=F%23.C%23.D%23m.B');
  });
});

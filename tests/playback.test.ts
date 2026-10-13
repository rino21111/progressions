import { describe, expect, it, vi } from 'vitest';
import { INSPECTOR_ID, PROGRESSION_ID, chordFingerings, progressionFingerings } from '../src/playback';
import { makeChord } from '../src/theory/chords';
import { parseFingering } from '../src/theory/fingering';
import { bestVoicing } from '../src/theory/voicings';
import { TAB_HASHES, TAB_LABELS } from '../src/tabs';

const progression = [makeChord(0, 'maj'), makeChord(7, 'maj'), makeChord(9, 'min'), makeChord(5, 'maj')];
const selection = parseFingering('xx0232')!; // D on the Inspector

describe('Play always plays the progression', () => {
  it("plays the progression's shapes in order, whatever is selected", () => {
    expect(progressionFingerings({ progression })).toEqual(progression.map((c) => bestVoicing(c)));
    expect(progressionFingerings({ progression: [] })).toEqual([]);
  });
});

describe('the Inspector during playback', () => {
  it('stays on the selection: playing the progression never changes the selected chord or its shape', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', globalThis);
    vi.doMock('../src/audio', () => ({ createSessionBus: () => ({ input: {}, output: { disconnect() {} }, setEcho() {} }), now: () => 0, ready: async () => {}, silenceBus() {}, strum() {} }));
    const { state, update } = await import('../src/state');
    const { play, stop, currentPlayback } = await import('../src/player');
    update({ progression, selectedCard: null, fingering: selection, selected: makeChord(2, 'maj') });
    const before = { fingering: state.fingering, selected: state.selected };
    play(PROGRESSION_ID, () => progressionFingerings(state), { perChord: true });
    await vi.advanceTimersByTimeAsync(5000);
    expect(currentPlayback()?.id).toBe(PROGRESSION_ID);
    expect(state.fingering).toBe(before.fingering);
    expect(state.selected).toBe(before.selected);
    stop();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
});

describe("the Inspector's Play and Loop", () => {
  it('plays the fretboard shape as fingered, and nothing when no string sounds', () => {
    expect(chordFingerings({ fingering: selection })).toEqual([selection]);
    expect(chordFingerings({ fingering: [null, null, null, null, null, null] })).toEqual([]);
  });

  it('plays one bar unless its own Loop is on (the progression Loop does not apply), and only one thing plays at a time', async () => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.stubGlobal('window', globalThis);
    vi.doMock('../src/audio', () => ({ createSessionBus: () => ({ input: {}, output: { disconnect() {} }, setEcho() {} }), now: () => Date.now() / 1000, ready: async () => {}, silenceBus() {}, strum() {} }));
    const { state, update } = await import('../src/state');
    const { play, stop, currentPlayback } = await import('../src/player');
    update({ progression, fingering: selection, loop: true, chordLoop: false, bpm: 120 });
    const chord = () => play(INSPECTOR_ID, () => chordFingerings(state), { loop: () => state.chordLoop });

    chord();
    await vi.advanceTimersByTimeAsync(5000); // one 4/4 bar at 120 bpm is 2 s
    expect(currentPlayback()).toBeNull();

    update({ chordLoop: true });
    chord();
    await vi.advanceTimersByTimeAsync(10000);
    expect(currentPlayback()?.id).toBe(INSPECTOR_ID);

    // Starting the progression stops the chord, and starting the chord stops the progression.
    play(PROGRESSION_ID, () => progressionFingerings(state), { perChord: true });
    expect(currentPlayback()?.id).toBe(PROGRESSION_ID);
    chord();
    expect(currentPlayback()?.id).toBe(INSPECTOR_ID);
    stop();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
});

describe('playback follows the cards when the progression changes', () => {
  it('after a move it plays the card now after the sounding one; after removing it, the card now in its place; empty stops', async () => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.stubGlobal('window', globalThis);
    vi.doMock('../src/audio', () => ({ createSessionBus: () => ({ input: {}, output: { disconnect() {} }, setEcho() {} }), now: () => Date.now() / 1000, ready: async () => {}, silenceBus() {}, strum() {} }));
    const { state, update } = await import('../src/state');
    const { play, stop, currentPlayback, remapSteps } = await import('../src/player');
    const { moveIndex } = await import('../src/yourChords');
    update({ progression, loop: true, bpm: 120, beatsPerBar: 4, barsPerChord: 1 });

    play(PROGRESSION_ID, () => progressionFingerings(state), { perChord: true });
    await vi.advanceTimersByTimeAsync(500); // C (0) sounding
    // C moves to the end: G Am F C. Next is the card after C, wrapping (Loop is on) to G at 0.
    update({ progression: [progression[1], progression[2], progression[3], progression[0]] });
    remapSteps(PROGRESSION_ID, (i) => moveIndex(i, 0, 3), 4);
    await vi.advanceTimersByTimeAsync(2000);
    expect(currentPlayback()?.step).toBe(0);

    // G (0) is sounding and is removed: carry on from the card now at 0 (Am).
    update({ progression: [progression[2], progression[3], progression[0]] });
    remapSteps(PROGRESSION_ID, (i) => (i === 0 ? null : i - 1), 3);
    await vi.advanceTimersByTimeAsync(2000);
    expect(currentPlayback()?.step).toBe(0);

    remapSteps(PROGRESSION_ID, () => null, 0);
    expect(currentPlayback()).toBeNull();
    stop();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
});

describe('page names', () => {
  it('calls the pages Chord, Next… and Tab', () => {
    expect(Object.values(TAB_LABELS)).toEqual(['Chord', 'Next…', 'Tab']);
  });

  it('uses the same names in the address bar', () => {
    expect(Object.values(TAB_HASHES)).toEqual(['chord', 'next', 'tab']);
  });
});

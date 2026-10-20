import { beforeEach, describe, expect, it, vi } from 'vitest';

// No sound in tests.
const strum = vi.fn();
vi.mock('../src/audio', () => ({ strum, now: () => 0 }));
// Whether something is playing (the progression or the Inspector's chord).
let playing: { id: string; step: number | null } | null = null;
vi.mock('../src/player', () => ({ currentPlayback: () => playing, remapSteps: () => {} }));

const { state, update } = await import('../src/state');
const { undo, canUndo, forgetHistory } = await import('../src/undo');
const {
  addToProgression, clearProgression, duplicateCard, moveProgressionCard, previewChange, removeFromProgression, selectCard,
  selectChord, setFingering,
} = await import('../src/ui/common');
const { cardIndex, stepCard } = await import('../src/yourChords');
const { addSelection, onChordClick, onShapeClick, selectPhrase, selectedPhrase } = await import('../src/ui/common');
const { progressionFingerings } = await import('../src/playback');
const { loadProgression, storeProgression } = await import('../src/state');
const { parseFingering } = await import('../src/theory/fingering');
const { bestVoicing } = await import('../src/theory/voicings');
const { makeChord, chordSymbol } = await import('../src/theory/chords');

const names = () => state.progression.map((c) => chordSymbol(c));
const C = makeChord(0, 'maj');
const G = makeChord(7, 'maj');
const Am = makeChord(9, 'min');
const F = makeChord(5, 'maj');
const Dm = makeChord(2, 'min');
const Em = makeChord(4, 'min');

beforeEach(() => {
  update({ progression: [C, G, Am, F], selectedCard: null, selected: C });
  forgetHistory();
});

describe('adding, removing, duplicating and the selected card', () => {
  it('Add appends at the end, whichever card is selected, and selects the new card', () => {
    selectCard(1); // G
    selectChord(Em);
    addToProgression(state.selected!);
    expect(names()).toEqual(['C', 'G', 'Am', 'F', 'Em']);
    expect(state.selectedCard).toBe(4);
  });

  it('double-click duplicates a card right after itself, as one undo step', () => {
    duplicateCard(1);
    expect(names()).toEqual(['C', 'G', 'G', 'Am', 'F']);
    undo();
    expect(names()).toEqual(['C', 'G', 'Am', 'F']);
    expect(canUndo()).toBe(false);
  });

  it('removing the selected card selects its neighbour; Clear empties and selects nothing', () => {
    selectCard(2);
    removeFromProgression(2);
    expect(names()).toEqual(['C', 'G', 'F']);
    expect(state.selectedCard).toBe(1);
    clearProgression();
    expect(names()).toEqual([]);
    expect(state.selectedCard).toBeNull();
  });
});

describe('a card keeps the exact shape it was added with', () => {
  const shape = parseFingering('x57765')!; // not the usual shape for this chord

  it('the + card and A add the fretboard shape, which survives duplicate, move, undo/redo, playback and saving', async () => {
    const { redo } = await import('../src/undo');
    setFingering(shape);
    const name = chordSymbol(state.selected!);
    expect(bestVoicing(state.selected!)).not.toEqual(shape);
    addSelection();
    const last = () => state.progression[state.progression.length - 1];
    expect(chordSymbol(last())).toBe(name);
    expect(last().fingering).toEqual(shape);

    duplicateCard(4);
    expect(state.progression[5].fingering).toEqual(shape);
    moveProgressionCard(5, 0);
    expect(state.progression[0].fingering).toEqual(shape);
    undo();
    undo();
    expect(state.progression[4].fingering).toEqual(shape);
    redo();
    expect(state.progression[5].fingering).toEqual(shape);

    expect(progressionFingerings(state)[4]).toEqual(shape);
    expect(loadProgression(JSON.parse(JSON.stringify(storeProgression(state.progression))))[4].fingering).toEqual(shape);

    selectChord(C);
    selectCard(4);
    expect(state.fingering).toEqual(shape); // selecting the card loads its exact shape
  });

  it("double-clicking an Inspector tile adds that tile's shape (its first click put it on the fretboard)", () => {
    const tile = onShapeClick(Dm, shape, () => selectChord(Dm, shape));
    tile({ detail: 1 } as unknown as Event);
    expect(state.fingering).toEqual(shape);
    expect(state.progression).toHaveLength(4);
    tile({ detail: 2 } as unknown as Event);
    expect(state.progression).toHaveLength(5);
    expect(state.progression[4].fingering).toEqual(shape);
  });

  it('Relationships adds and old saves (no shape) use the usual shape', () => {
    addToProgression(Dm);
    expect(progressionFingerings(state)[4]).toEqual(bestVoicing(Dm));
    const old = loadProgression([{ root: 2, type: 'min', bass: 2 }]);
    expect(old[0].fingering).toBeUndefined();
    expect(progressionFingerings({ progression: old })[0]).toEqual(bestVoicing(Dm));
  });
});

describe('a phrase picked on Relationships', () => {
  it('selects all its chords for the add card; adding inserts them in order as one undo step', () => {
    selectPhrase([Dm, G, C], 'then:Dm G C');
    expect(selectedPhrase()!.map((c) => chordSymbol(c))).toEqual(['Dm', 'G', 'C']);
    addSelection();
    expect(names()).toEqual(['C', 'G', 'Am', 'F', 'Dm', 'G', 'C']);
    expect(selectedPhrase()).toBeNull();
    undo();
    expect(names()).toEqual(['C', 'G', 'Am', 'F']);
  });
  it('lapses when the progression changes or a single chord is picked', () => {
    selectPhrase([Dm, G, C], 'then:Dm G C');
    selectChord(Em);
    expect(selectedPhrase()).toBeNull();
    selectPhrase([Dm, G, C], 'then:Dm G C');
    removeFromProgression(0);
    expect(selectedPhrase()).toBeNull();
  });
});

describe('clicks are silent while something plays', () => {
  it('with playback on, a card click selects without sounding, and a double-click still adds; with nothing playing, a click sounds', () => {
    playing = { id: 'progression', step: 0 };
    strum.mockClear();
    selectCard(2);
    expect(chordSymbol(state.selected!)).toBe('Am');
    expect(state.selectedCard).toBe(2);
    const chip = onChordClick(Dm);
    chip({ detail: 1 } as unknown as Event);
    chip({ detail: 2 } as unknown as Event);
    previewChange(Em);
    expect(names()).toEqual(['C', 'G', 'Am', 'F', 'Dm']);
    expect(strum).not.toHaveBeenCalled();

    playing = null;
    selectCard(1);
    expect(strum).toHaveBeenCalledTimes(1);
  });
});

describe('moving cards', () => {
  it('a move is one undo step, and redo moves it again', async () => {
    const { redo } = await import('../src/undo');
    moveProgressionCard(0, 3);
    expect(names()).toEqual(['G', 'Am', 'F', 'C']);
    undo();
    expect(names()).toEqual(['C', 'G', 'Am', 'F']);
    expect(canUndo()).toBe(false);
    redo();
    expect(names()).toEqual(['G', 'Am', 'F', 'C']);
  });

  it('dropping a card back where it was adds no step', () => {
    moveProgressionCard(2, 2);
    expect(canUndo()).toBe(false);
  });

  it('the selected card moves with Alt+arrows (one step each) and stays selected', () => {
    selectCard(1);
    moveProgressionCard(1, 2);
    expect(names()).toEqual(['C', 'Am', 'G', 'F']);
    expect(state.selectedCard).toBe(2);
  });
});

describe('listening never changes the progression or undo', () => {
  it('clicking cards, arrow keys and picking or previewing chords push no undo step', () => {
    selectCard(1);
    selectCard(stepCard(4, state.selectedCard, 1));
    expect(cardIndex(4, state.selectedCard)).toBe(2);
    selectChord(Dm);
    previewChange(Em);
    selectChord(F);
    expect(names()).toEqual(['C', 'G', 'Am', 'F']);
    expect(canUndo()).toBe(false);
    expect(chordSymbol(state.selected!)).toBe('F');
    expect(state.selectedCard).toBeNull(); // a chord picked elsewhere isn't a card
  });
});

describe('undo covers what you built, not what you looked at', () => {
  it('remove F, select C, select Dm: one undo brings F back', () => {
    removeFromProgression(3);
    selectChord(C);
    selectChord(Dm);
    undo();
    expect(names()).toEqual(['C', 'G', 'Am', 'F']);
    expect(chordSymbol(state.selected!)).toBe('Dm'); // what you're looking at stays
  });

  it('a hand-edited shape replaced by a selection can be recovered', () => {
    setFingering([null, 0, 2, 2, 1, 0]); // Am by hand
    selectChord(G);
    undo();
    expect(state.fingering).toEqual([null, 0, 2, 2, 1, 0]);
  });
});

describe('smooth shapes when adding from the Chord page', () => {
  const fmt = (f: unknown) => (f as (number | null)[]).map((x) => (x === null ? 'x' : x)).join('');
  it('a chord picked by name goes in the shape that moves least from the last card', () => {
    update({ progression: [Dm], selectedCard: null });
    selectChord(G);
    addSelection();
    expect(fmt(state.progression[1].fingering)).toBe('320033');
  });
  it('a shape the player picked is kept as it is', () => {
    update({ progression: [Dm], selectedCard: null });
    selectChord(G, parseFingering('320003'));
    addSelection();
    expect(fmt(state.progression[1].fingering)).toBe('320003');
    update({ progression: [Dm], selectedCard: null });
    setFingering(parseFingering('355433')!);
    addSelection();
    expect(fmt(state.progression[1].fingering)).toBe('355433');
  });
});

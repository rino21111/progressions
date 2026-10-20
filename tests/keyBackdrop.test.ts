// The key backdrop: which notes a key marks, which chord tones it rings, and its switch (saved, and
// in the address only when off).
import { describe, expect, it, vi } from 'vitest';
import { Key, keyScale, outOfKeyTones } from '../src/theory/keys';
import { parseChordName } from '../src/theory/search';
import { readShare, stateHash } from '../src/share';
import { DEFAULTS } from '../src/state';
import { sharpName } from '../src/theory/notes';

const names = (pcs: Iterable<number>) => [...pcs].sort((a, b) => a - b).map(sharpName).join(' ');
const k = (tonic: number, mode: Key['mode']): Key => ({ tonic, mode });
const rings = (chord: string, key: Key) => names(outOfKeyTones(parseChordName(chord)!, key));

describe('key notes', () => {
  it('a key marks its scale: major or natural minor, sharp and flat keys', () => {
    expect(names(keyScale(k(0, 'major')))).toBe('C D E F G A B');
    expect(names(keyScale(k(9, 'minor')))).toBe('C D E F G A B');
    expect(names(keyScale(k(7, 'major')))).toBe('C D E F# G A B');
    expect(names(keyScale(k(10, 'major')))).toBe('C D D# F G A A#');
    expect(names(keyScale(k(4, 'minor')))).toBe('C D E F# G A B');
    expect(names(keyScale(k(5, 'minor')))).toBe('C C# D# F G G# A#');
  });
  it('rings the chord tones outside the key', () => {
    expect(rings('Fm', k(0, 'major'))).toBe('G#');
    expect(rings('C', k(0, 'major'))).toBe('');
    expect(rings('E7', k(9, 'minor'))).toBe('');
    expect(rings('Bb', k(0, 'major'))).toBe('A#');
  });
  it('the switch is on by default, in the address only when off', () => {
    expect(DEFAULTS.keyNotes).toBe(true);
    expect(stateHash(DEFAULTS, 'detector')).toBe('chord');
    const off = stateHash({ ...DEFAULTS, keyNotes: false }, 'detector');
    expect(off).toBe('chord&kn=0');
    expect(readShare(`#${off}`)!.patch.keyNotes).toBe(false);
    expect(readShare('#chord&c=Dm')!.patch.keyNotes).toBe(true);
  });
  it('the switch is saved with the other View settings', async () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    });
    vi.resetModules();
    const first = await import('../src/state');
    first.update({ keyNotes: false });
    expect(JSON.parse(store.get('guitar-theory-state-v1')!).keyNotes).toBe(false);
    vi.resetModules();
    const again = await import('../src/state');
    expect(again.state.keyNotes).toBe(false);
    vi.unstubAllGlobals();
  });
});

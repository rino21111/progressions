// Chord relationships in a key: loose chord comparison, the chord a secondary dominant points at, and
// a short tag naming a move (a cadence, a borrowed chord, a secondary dominant).

import { Chord, ChordFamily, chordPitchClasses } from './chords';
import { Key, chordFitInKey, chordSymbolInKey, diatonicChords, scalePitchClasses, tonicName } from './keys';
import { mod12 } from './notes';
import { chordQuality } from './progressionMap';

/** Compare chords loosely: same root and same basic flavour (major / minor / ...). */
function triadKind(family: ChordFamily): string {
  return family === 'power' ? 'major' : family;
}

export function sameFunction(a: Chord, b: Chord): boolean {
  return a.root === b.root && triadKind(a.template.family) === triadKind(b.template.family);
}

/** The key's own chord on a root (semitones above the tonic), if there is one. */
function diatonicOn(key: Key, semi: number): Chord | null {
  return diatonicChords(key).find((d) => !d.borrowed && mod12(d.chord.root - key.tonic) === mod12(semi))?.chord ?? null;
}

const semiOf = (c: Chord, key: Key) => mod12(c.root - key.tonic);
const majorish = (c: Chord) => ['maj', 'dom'].includes(chordQuality(c));

/**
 * The chord a secondary dominant or leading-tone chord points at: a major or dominant chord from
 * outside the key a fifth above one of its chords (not its diminished one), or a diminished one a
 * half step below one. E in C leads to Am.
 */
export function secondaryTarget(chord: Chord, key: Key): Chord | null {
  if (chordFitInKey(chord, key) !== 'outside') return null;
  const q = chordQuality(chord);
  const semi = semiOf(chord, key);
  const usable = (t: Chord | null) => (t && !['dim', 'hdim'].includes(chordQuality(t)) ? t : null);
  if (q === 'maj' || q === 'dom') return usable(diatonicOn(key, semi - 7));
  if (q === 'dim' || q === 'hdim') return usable(diatonicOn(key, semi + 1));
  return null;
}

/** A short name for the move from `x` to `c`, or for what `c` is, or null. */
export function ideaTag(x: Chord, c: Chord, key: Key): string | null {
  const xs = semiOf(x, key);
  const cs = semiOf(c, key);
  const xq = chordQuality(x);
  const toTonic = cs === 0 && chordQuality(c) === (key.mode === 'major' ? 'maj' : 'min');
  if (toTonic && ((xs === 7 && majorish(x)) || (xs === 11 && (xq === 'dim' || xq === 'hdim')))) return 'Authentic cadence';
  if (toTonic && xs === 5 && (xq === 'maj' || xq === 'min')) return 'Plagal cadence';
  if (xs === 7 && majorish(x) && ((cs === 9 && chordQuality(c) === 'min') || (cs === 8 && chordQuality(c) === 'maj'))) return 'Deceptive cadence';
  if (xs === 10 && majorish(x) && cs === 0) return 'Backdoor';
  if (key.mode === 'minor' && cs === 0 && majorish(c)) return 'Picardy third';
  // Borrowed from the parallel key first (D in A minor is the Dorian IV, not V of G).
  if (chordFitInKey(c, key) === 'outside') {
    const parallel: Key = { tonic: key.tonic, mode: key.mode === 'major' ? 'minor' : 'major' };
    const scale = new Set(scalePitchClasses(parallel));
    if (chordPitchClasses(c).every((pc) => scale.has(pc))) return `From ${tonicName(key)} ${parallel.mode}`;
  }
  const target = secondaryTarget(c, key);
  return target ? `Leads to ${chordSymbolInKey(target, key)}` : null;
}

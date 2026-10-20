// Keys, scales, diatonic chords, Roman numerals and figuring out which key
// a set of chords belongs to.

import { Chord, ChordFamily, chordPitchClasses, chordSymbol, makeChord } from './chords';
import { PitchClass, mod12, spellFrom } from './notes';

export type Mode = 'major' | 'minor';

export interface Key {
  tonic: PitchClass;
  mode: Mode;
}

export const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
export const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

const MAJOR_KEY_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const MINOR_KEY_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];

export function tonicName(key: Key): string {
  return (key.mode === 'major' ? MAJOR_KEY_NAMES : MINOR_KEY_NAMES)[mod12(key.tonic)];
}

export function keyName(key: Key): string {
  return `${tonicName(key)} ${key.mode}`;
}

export function keyId(key: Key): string {
  return `${key.tonic}-${key.mode}`;
}

export function scaleSteps(key: Key): number[] {
  return key.mode === 'major' ? MAJOR_SCALE : MINOR_SCALE;
}

export function scalePitchClasses(key: Key): PitchClass[] {
  return scaleSteps(key).map((s) => mod12(key.tonic + s));
}

/** Correctly spelled scale, e.g. F major -> F G A Bb C D E. */
export function scaleNoteNames(key: Key): string[] {
  const tn = tonicName(key);
  return scaleSteps(key).map((s, i) => spellFrom(tn, i, mod12(key.tonic + s)));
}

/** Letter (scale degree index) used to spell each semitone above the tonic: b2, 2, b3, 3, 4, #4, 5, b6, 6, b7, 7. */
const DEGREE_LETTER = [0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6];

/** Spelling of a chord root relative to a key, e.g. A# rather than Bb in F# major. */
export function spellRootInKey(key: Key, root: PitchClass): string {
  const semi = mod12(root - key.tonic);
  return spellFrom(tonicName(key), DEGREE_LETTER[semi], root);
}

// Roots a learner rarely meets, shown as their plain enharmonic (the numeral stays as written).
const PLAIN_ROOT: Record<string, string> = { Fb: 'E', Cb: 'B', 'E#': 'F', 'B#': 'C' };

/** Chord symbol spelled to suit the key, e.g. A# rather than Bb in F# major (but E, not Fb). */
export function chordSymbolInKey(chord: Chord, key: Key): string {
  const root = chord.spelling ?? spellRootInKey(key, chord.root);
  return chordSymbol(chord, PLAIN_ROOT[root] ?? root);
}

/**
 * A numeral as the site shows it: the degree and only a seventh-type mark. Colour tails go
 * (Iadd9 → I, ii(add9) → ii, Vsus4 → V, ii9 → ii7, V13 → V7); °, °7, ø7, + and maj7 stay.
 */
export function numeralLabel(numeral: string): string {
  const m = /^((?:bb|b|#)?(?:VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i))(.*)$/.exec(numeral);
  if (!m) return numeral;
  const tail = m[2].replace(/[()]/g, '');
  const mark = /^°/.test(tail) ? (/7/.test(tail) ? '°7' : '°')
    : /^ø/.test(tail) ? 'ø7'
      : /^\+/.test(tail) ? '+'
        : /^maj(7|9|11|13)/.test(tail) ? 'maj7'
          : /^(7|9|11|13)/.test(tail) ? '7' : '';
  return m[1] + mark;
}

const MAJOR_DEGREE: Record<number, string> = {
  0: 'I', 1: 'bII', 2: 'II', 3: 'bIII', 4: 'III', 5: 'IV', 6: '#IV', 7: 'V', 8: 'bVI', 9: 'VI', 10: 'bVII', 11: 'VII',
};
const MINOR_DEGREE: Record<number, string> = {
  0: 'I', 1: 'bII', 2: 'II', 3: 'III', 4: '#III', 5: 'IV', 6: '#IV', 7: 'V', 8: 'VI', 9: '#VI', 10: 'VII', 11: 'VII',
};

const isMinorish = (family: ChordFamily) => family === 'minor' || family === 'diminished';

/** Roman numeral for a chord within a key, e.g. "vi", "V7", "ii°", "bVII". */
export function romanNumeral(chord: Chord, key: Key): string {
  if (chord.numeral) return chord.numeral;
  const semi = mod12(chord.root - key.tonic);
  let numeral = (key.mode === 'major' ? MAJOR_DEGREE : MINOR_DEGREE)[semi];
  const { family, id, suffix } = chord.template;
  if (isMinorish(family)) numeral = numeral.toLowerCase();
  let tail: string;
  switch (id) {
    case 'dim':
      tail = '°';
      break;
    case 'dim7':
      tail = '°7';
      break;
    case 'm7b5':
      tail = 'ø7';
      break;
    case 'aug':
      tail = '+';
      break;
    default:
      tail = family === 'minor' ? suffix.replace(/^m/, '') : suffix;
  }
  return numeral + tail;
}

export interface DiatonicChord {
  degree: number; // 0..6
  chord: Chord;
  numeral: string;
  symbol: string;
  /** Tonic, subdominant or dominant. */
  role: string;
  /** Only for minor keys: the major V borrowed from harmonic minor. */
  borrowed?: boolean;
}

const MAJOR_TRIADS = ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim'];
const MAJOR_SEVENTHS = ['maj7', 'm7', 'm7', 'maj7', '7', 'm7', 'm7b5'];
const MINOR_TRIADS = ['min', 'dim', 'maj', 'min', 'min', 'maj', 'maj'];
const MINOR_SEVENTHS = ['m7', 'm7b5', 'maj7', 'm7', 'm7', 'maj7', '7'];
const MAJOR_ROLES = ['Tonic (home)', 'Predominant', 'Tonic (weak)', 'Predominant', 'Dominant', 'Tonic (relative minor)', 'Dominant'];
const MINOR_ROLES = ['Tonic (home)', 'Predominant', 'Tonic (relative major)', 'Predominant', 'Dominant (soft)', 'Predominant', 'Dominant (subtonic)'];

export function diatonicChords(key: Key, sevenths = false): DiatonicChord[] {
  const steps = scaleSteps(key);
  const types =
    key.mode === 'major'
      ? sevenths ? MAJOR_SEVENTHS : MAJOR_TRIADS
      : sevenths ? MINOR_SEVENTHS : MINOR_TRIADS;
  const roles = key.mode === 'major' ? MAJOR_ROLES : MINOR_ROLES;
  const list: DiatonicChord[] = steps.map((semi, degree) => {
    const chord = makeChord(key.tonic + semi, types[degree]);
    return {
      degree,
      chord,
      numeral: romanNumeral(chord, key),
      symbol: chordSymbolInKey(chord, key),
      role: roles[degree],
    };
  });
  if (key.mode === 'minor') {
    const chord = makeChord(key.tonic + 7, sevenths ? '7' : 'maj');
    list.push({
      degree: 4,
      chord,
      numeral: romanNumeral(chord, key),
      symbol: chordSymbolInKey(chord, key),
      role: 'Dominant (from harmonic minor)',
      borrowed: true,
    });
  }
  return list;
}

export const ALL_KEYS: Key[] = [
  ...Array.from({ length: 12 }, (_, tonic) => ({ tonic, mode: 'major' as Mode })),
  ...Array.from({ length: 12 }, (_, tonic) => ({ tonic, mode: 'minor' as Mode })),
];

export type ChordFit = 'diatonic' | 'harmonic-minor' | 'outside';

export interface KeyFit {
  key: Key;
  score: number;
  fits: ChordFit[];
  fitCount: number;
}

/** Whether a note belongs to the key as the numerals count it: the scale, plus minor's raised 7th (harmonic minor). */
export function pitchInKey(pc: PitchClass, key: Key): boolean {
  return scalePitchClasses(key).includes(mod12(pc)) || (key.mode === 'minor' && mod12(pc - key.tonic) === 11);
}

export function chordFitInKey(chord: Chord, key: Key): ChordFit {
  const scale = new Set(scalePitchClasses(key));
  const pcs = chordPitchClasses(chord);
  if (pcs.every((pc) => scale.has(pc))) return 'diatonic';
  if (key.mode === 'minor') {
    const harmonic = new Set(scale);
    harmonic.delete(mod12(key.tonic + 10));
    harmonic.add(mod12(key.tonic + 11));
    if (pcs.every((pc) => harmonic.has(pc))) return 'harmonic-minor';
  }
  return 'outside';
}

const isTonicChord = (chord: Chord, key: Key) =>
  chord.root === mod12(key.tonic) &&
  (key.mode === 'minor' ? chord.template.family === 'minor' : chord.template.family === 'major' || chord.template.family === 'power');

/** A chord that can act as a dominant: major (or 7th) or suspended, so a fifth-down move resolves it. */
const canDominate = (c: Chord) => c.template.family === 'major' || c.template.family === 'suspended';
const sameChord = (a: Chord, b: Chord) => a.root === b.root && a.template.id === b.template.id;
/** A chord that can be landed on: not a major chord with a flat seventh (that one wants to move on). */
const restful = (c: Chord) => !(c.template.family === 'major' && c.template.tones.some((t) => t.semi === 10));

/**
 * What a key gets from how the chords lean on it, beyond fitting: the first chord as its tonic, the
 * chord heard most (when one is), a V resolving to its tonic, and the IV–V and V–vi (V–VI in minor)
 * moves that only one key explains.
 */
function leanScore(chords: Chord[], key: Key): number {
  let score = 0;
  if (isTonicChord(chords[0], key)) score += 1.5;
  if (chords.length > 1 && isTonicChord(chords[chords.length - 1], key)) score += 0.75;
  if (chords.some((c) => isTonicChord(c, key))) score += 0.5;
  const counts = chords.map((c) => chords.filter((d) => sameChord(c, d)).length);
  const most = Math.max(...counts);
  if (most > 1 && chords.some((c, i) => counts[i] === most && isTonicChord(c, key))) score += 0.5;
  const degree = (c: Chord) => mod12(c.root - key.tonic);
  const sixth = key.mode === 'major' ? 9 : 8;
  // Played round: the last chord leads back into the first (a turnaround's V into I).
  const at = (i: number) => chords[i % chords.length];
  const lands = (c: Chord) => isTonicChord(c, key) && restful(c);
  for (let i = 1; i <= chords.length; i++) {
    const a = chords[i - 1], b = at(i), next = at(i + 1);
    if (chords.length > 1 && lands(b) && degree(a) === 7 && canDominate(a)) score += 0.5; // V–I
    if (i === chords.length) break;
    // IV–V, unless the V goes on down a fifth to something other than home (then it was a V of V: I–II7–V7)
    if (degree(a) === 5 && degree(b) === 7 && canDominate(b) && !(mod12(b.root - next.root) === 7 && !lands(next))) score += 1;
    if (degree(a) === 7 && canDominate(a) && degree(b) === sixth) score += 1.25; // V–vi, the deceptive cadence
  }
  return score;
}

/** Every key ranked by how well it explains the chords, best first. */
export function rankKeys(chords: Chord[]): KeyFit[] {
  if (!chords.length) return [];
  const results = ALL_KEYS.map((key) => {
    const scale = new Set(scalePitchClasses(key));
    let score = key.mode === 'major' ? 0.1 : 0;
    const fits = chords.map((chord) => {
      const fit = chordFitInKey(chord, key);
      if (fit === 'diatonic') score += 2;
      else if (fit === 'harmonic-minor') score += 1.5;
      else score -= chordPitchClasses(chord).filter((pc) => !scale.has(pc)).length;
      return fit;
    });
    score += leanScore(chords, key);
    return { key, score, fits, fitCount: fits.filter((f) => f !== 'outside').length };
  });
  return results.sort((a, b) => b.score - a.score);
}

/** The key's scale tones (major, or natural minor): what the key backdrop marks on the neck. */
export const keyScale = (key: Key): Set<PitchClass> => new Set(scalePitchClasses(key));

/** A chord's tones that the key doesn't hold (the raised 7th counts as in a minor key): ringed on the neck. */
export const outOfKeyTones = (chord: Chord, key: Key): PitchClass[] => chordPitchClasses(chord).filter((pc) => !pitchInKey(pc, key));

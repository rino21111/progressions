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

/** Chord symbol spelled to suit the key, e.g. A# rather than Bb in F# major. */
export function chordSymbolInKey(chord: Chord, key: Key): string {
  return chordSymbol(chord, spellRootInKey(key, chord.root));
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
    if (isTonicChord(chords[0], key)) score += 1.5;
    if (chords.length > 1 && isTonicChord(chords[chords.length - 1], key)) score += 0.75;
    if (chords.some((c) => isTonicChord(c, key))) score += 0.5;
    return { key, score, fits, fitCount: fits.filter((f) => f !== 'outside').length };
  });
  return results.sort((a, b) => b.score - a.score);
}

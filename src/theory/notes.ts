// Pitch classes, note spelling and the guitar's tuning.

/** A pitch class: 0 = C, 1 = C#/Db, ... 11 = B. */
export type PitchClass = number;

/** Default spelling for a pitch class used as a chord root. */
const ROOT_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];

/** Standard tuning as MIDI note numbers, low E (6th string) first. */
export const STANDARD_TUNING = [40, 45, 50, 55, 59, 64];
export const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];

export const mod12 = (n: number): number => ((n % 12) + 12) % 12;

export function rootName(pc: PitchClass): string {
  return ROOT_NAMES[mod12(pc)];
}

export function sharpName(pc: PitchClass): string {
  return SHARP_NAMES[mod12(pc)];
}

export function flatName(pc: PitchClass): string {
  return FLAT_NAMES[mod12(pc)];
}

/** Both spellings of a black-key note, e.g. "C#/Db"; white keys are returned once. */
export function enharmonicName(pc: PitchClass): string {
  const s = sharpName(pc);
  const f = flatName(pc);
  return s === f ? s : `${s}/${f}`;
}

/** Parse a note name like "C", "f#", "Bb", "Ebb". Returns null if it isn't one. */
export function parseNote(name: string): PitchClass | null {
  const m = /^([A-Ga-g])([#b]*)$/.exec(name.trim());
  if (!m) return null;
  const letter = LETTERS.indexOf(m[1].toUpperCase());
  let pc = LETTER_PC[letter];
  for (const ch of m[2]) pc += ch === '#' ? 1 : -1;
  return mod12(pc);
}

/**
 * Spell a note by letter so that it is the given number of letter steps above a
 * root. For example the third (2 letters) above Eb is G, and above F# it is A#.
 */
export function spellFrom(rootSpelling: string, letterSteps: number, pc: PitchClass): string {
  const rootLetter = LETTERS.indexOf(rootSpelling[0].toUpperCase());
  const letterIdx = (rootLetter + letterSteps) % 7;
  const letter = LETTERS[letterIdx];
  let diff = mod12(pc - LETTER_PC[letterIdx]);
  if (diff > 6) diff -= 12;
  if (Math.abs(diff) > 2) return sharpName(pc); // too many accidentals; fall back
  const acc = diff > 0 ? '#'.repeat(diff) : 'b'.repeat(-diff);
  return letter + acc;
}

/** Degree labels like "b3", "#11", "bb7" -> number of letter steps above the root. */
export function letterStepsForDegree(label: string): number {
  if (label === 'R') return 0;
  const n = parseInt(label.replace(/[#b]/g, ''), 10);
  return (n - 1) % 7;
}

export function midiToPc(midi: number): PitchClass {
  return mod12(midi);
}

/** Note name with octave, e.g. 40 -> "E2". */
export function midiName(midi: number): string {
  return `${sharpName(midi)}${Math.floor(midi / 12) - 1}`;
}

export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Interval names in semitones, used when two notes are played. */
export const INTERVAL_NAMES = [
  'Unison / octave',
  'Minor 2nd',
  'Major 2nd',
  'Minor 3rd',
  'Major 3rd',
  'Perfect 4th',
  'Tritone',
  'Perfect 5th',
  'Minor 6th',
  'Major 6th',
  'Minor 7th',
  'Major 7th',
];

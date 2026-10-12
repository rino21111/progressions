// Chord formulas and chord identification from a set of notes.

import {
  PitchClass,
  flatName,
  letterStepsForDegree,
  mod12,
  rootName,
  sharpName,
  spellFrom,
} from './notes';

export type ChordFamily = 'major' | 'minor' | 'diminished' | 'augmented' | 'suspended' | 'power';

export interface ChordTone {
  /** Semitones above the root. */
  semi: number;
  /** Degree label, e.g. "R", "b3", "5", "b7", "9". */
  label: string;
  /** Can be left out of a voicing and the chord keeps its name (usually the 5th). */
  optional?: boolean;
}

export interface ChordTemplate {
  id: string;
  /** What follows the root in the chord symbol, e.g. "m7". */
  suffix: string;
  /** Plain-English name, e.g. "minor seventh". */
  name: string;
  family: ChordFamily;
  /** Lower = simpler/more common; used to pick the most natural name. */
  rank: number;
  tones: ChordTone[];
}

const R: ChordTone = { semi: 0, label: 'R' };
const b3: ChordTone = { semi: 3, label: 'b3' };
const M3: ChordTone = { semi: 4, label: '3' };
const P5: ChordTone = { semi: 7, label: '5' };
const o5: ChordTone = { semi: 7, label: '5', optional: true };
const b5: ChordTone = { semi: 6, label: 'b5' };
const s5: ChordTone = { semi: 8, label: '#5' };
const b7: ChordTone = { semi: 10, label: 'b7' };
const M7: ChordTone = { semi: 11, label: '7' };
const n9: ChordTone = { semi: 2, label: '9' };
const o9: ChordTone = { semi: 2, label: '9', optional: true };

const t = (
  id: string,
  suffix: string,
  name: string,
  family: ChordFamily,
  rank: number,
  tones: ChordTone[],
): ChordTemplate => ({ id, suffix, name, family, rank, tones });

export const CHORD_TEMPLATES: ChordTemplate[] = [
  t('maj', '', 'major', 'major', 0, [R, M3, P5]),
  t('min', 'm', 'minor', 'minor', 0, [R, b3, P5]),
  t('5', '5', 'power chord', 'power', 1, [R, P5]),
  t('7', '7', 'dominant seventh', 'major', 1, [R, M3, o5, b7]),
  t('maj7', 'maj7', 'major seventh', 'major', 1.5, [R, M3, o5, M7]),
  t('m7', 'm7', 'minor seventh', 'minor', 1.5, [R, b3, o5, b7]),
  t('sus4', 'sus4', 'suspended fourth', 'suspended', 1.5, [R, { semi: 5, label: '4' }, P5]),
  t('sus2', 'sus2', 'suspended second', 'suspended', 2, [R, { semi: 2, label: '2' }, P5]),
  t('dim', 'dim', 'diminished', 'diminished', 2, [R, b3, b5]),
  t('aug', 'aug', 'augmented', 'augmented', 2.5, [R, M3, s5]),
  t('add9', 'add9', 'major add nine', 'major', 2.5, [R, M3, o5, n9]),
  t('6', '6', 'major sixth', 'major', 3, [R, M3, o5, { semi: 9, label: '6' }]),
  t('m6', 'm6', 'minor sixth', 'minor', 3.5, [R, b3, o5, { semi: 9, label: '6' }]),
  t('madd9', 'm(add9)', 'minor add nine', 'minor', 3, [R, b3, o5, n9]),
  t('m7b5', 'm7b5', 'half-diminished', 'diminished', 3, [R, b3, b5, b7]),
  t('dim7', 'dim7', 'diminished seventh', 'diminished', 3, [R, b3, b5, { semi: 9, label: 'bb7' }]),
  t('7sus4', '7sus4', 'dominant seventh suspended fourth', 'suspended', 3, [
    R,
    { semi: 5, label: '4' },
    o5,
    b7,
  ]),
  t('9', '9', 'dominant ninth', 'major', 3, [R, M3, o5, b7, n9]),
  t('maj9', 'maj9', 'major ninth', 'major', 3.5, [R, M3, o5, M7, n9]),
  t('m9', 'm9', 'minor ninth', 'minor', 3.5, [R, b3, o5, b7, n9]),
  t('mMaj7', 'm(maj7)', 'minor-major seventh', 'minor', 4, [R, b3, o5, M7]),
  t('7#9', '7#9', 'dominant seventh sharp nine ("Hendrix chord")', 'major', 4, [
    R,
    M3,
    o5,
    b7,
    { semi: 3, label: '#9' },
  ]),
  t('69', '6/9', 'six-nine', 'major', 4, [R, M3, o5, { semi: 9, label: '6' }, n9]),
  t('add11', 'add11', 'major add eleven', 'major', 4, [R, M3, P5, { semi: 5, label: '11' }]),
  t('7#5', '7#5', 'augmented seventh', 'augmented', 4, [R, M3, s5, b7]),
  t('7b9', '7b9', 'dominant seventh flat nine', 'major', 4.5, [R, M3, o5, b7, { semi: 1, label: 'b9' }]),
  t('9sus4', '9sus4', 'dominant ninth suspended fourth', 'suspended', 4.5, [
    R,
    { semi: 5, label: '4' },
    o5,
    b7,
    n9,
  ]),
  t('13', '13', 'dominant thirteenth', 'major', 4.5, [R, M3, o5, b7, o9, { semi: 9, label: '13' }]),
  t('m69', 'm6/9', 'minor six-nine', 'minor', 5, [R, b3, o5, { semi: 9, label: '6' }, n9]),
  t('madd11', 'm(add11)', 'minor add eleven', 'minor', 4.5, [R, b3, P5, { semi: 5, label: '11' }]),
  t('m11', 'm11', 'minor eleventh', 'minor', 5, [R, b3, o5, b7, o9, { semi: 5, label: '11' }]),
  t('7b5', '7b5', 'dominant seventh flat five', 'major', 5, [R, M3, b5, b7]),
  t('7#11', '7#11', 'dominant seventh sharp eleven', 'major', 5, [
    R,
    M3,
    o5,
    b7,
    { semi: 6, label: '#11' },
  ]),
  t('maj7#11', 'maj7#11', 'major seventh sharp eleven (Lydian)', 'major', 5, [
    R,
    M3,
    o5,
    M7,
    { semi: 6, label: '#11' },
  ]),
  t('maj7#5', 'maj7#5', 'augmented major seventh', 'augmented', 5, [R, M3, s5, M7]),
  t('maj13', 'maj13', 'major thirteenth', 'major', 5.5, [R, M3, o5, M7, o9, { semi: 9, label: '13' }]),
  t('m13', 'm13', 'minor thirteenth', 'minor', 5.5, [R, b3, o5, b7, o9, { semi: 9, label: '13' }]),
];

export const TEMPLATE_BY_ID: Record<string, ChordTemplate> = Object.fromEntries(
  CHORD_TEMPLATES.map((tpl) => [tpl.id, tpl]),
);

export interface Chord {
  root: PitchClass;
  template: ChordTemplate;
  /** Lowest note. Equal to root unless the chord is inverted / a slash chord. */
  bass: PitchClass;
}

export interface ChordMatch extends Chord {
  /** Lower is a better (more natural) name. */
  score: number;
  /** Labels of optional tones that aren't being played, e.g. ["5"]. */
  omitted: string[];
}

export function makeChord(root: PitchClass, templateId: string, bass?: PitchClass): Chord {
  const template = TEMPLATE_BY_ID[templateId];
  if (!template) throw new Error(`Unknown chord type ${templateId}`);
  return { root: mod12(root), template, bass: mod12(bass ?? root) };
}

/** Preferred root spelling: sharps for minor-ish chords on C#/G#, flats otherwise. */
export function preferredRootName(root: PitchClass, family: ChordFamily): string {
  const pc = mod12(root);
  if (family === 'minor' || family === 'diminished') {
    if (pc === 1 || pc === 8) return sharpName(pc);
    if (pc === 6) return 'F#';
  }
  return rootName(pc);
}

export function toneLabelFor(chord: Chord, pc: PitchClass): string | undefined {
  const semi = mod12(pc - chord.root);
  return chord.template.tones.find((tone) => tone.semi === semi)?.label;
}

/** Spell a note that belongs to the chord relative to the chord's root spelling. */
export function spellChordNote(chord: Chord, pc: PitchClass, rootSpelling?: string): string {
  const rs = rootSpelling ?? preferredRootName(chord.root, chord.template.family);
  const label = toneLabelFor(chord, pc);
  if (!label) return pc === chord.root ? rs : rs.includes('b') ? flatName(pc) : sharpName(pc);
  return spellFrom(rs, letterStepsForDegree(label), pc);
}

/** Chord symbol, e.g. "Am7", "C/E", "F#m7b5". */
export function chordSymbol(chord: Chord, rootSpelling?: string): string {
  const rs = rootSpelling ?? preferredRootName(chord.root, chord.template.family);
  const base = rs + chord.template.suffix;
  if (chord.bass === chord.root) return base;
  return `${base}/${spellChordNote(chord, chord.bass, rs)}`;
}

export interface SpelledTone {
  pc: PitchClass;
  label: string;
  name: string;
  optional: boolean;
}

export function chordTones(chord: Chord, rootSpelling?: string): SpelledTone[] {
  const rs = rootSpelling ?? preferredRootName(chord.root, chord.template.family);
  return chord.template.tones.map((tone) => {
    const pc = mod12(chord.root + tone.semi);
    return {
      pc,
      label: tone.label,
      name: spellFrom(rs, letterStepsForDegree(tone.label), pc),
      optional: !!tone.optional,
    };
  });
}

export function chordPitchClasses(chord: Chord, includeOptional = true): PitchClass[] {
  return chord.template.tones
    .filter((tone) => includeOptional || !tone.optional)
    .map((tone) => mod12(chord.root + tone.semi));
}

/**
 * Name the chord formed by a set of pitch classes with a given bass note.
 * Returns every formula that fits, best (most natural) name first.
 */
export function identifyChord(pcsIn: Iterable<PitchClass>, bass: PitchClass): ChordMatch[] {
  const pcs = [...new Set([...pcsIn].map(mod12))];
  if (pcs.length < 2) return [];
  const matches: ChordMatch[] = [];

  for (const root of pcs) {
    const intervals = new Set(pcs.map((pc) => mod12(pc - root)));
    for (const template of CHORD_TEMPLATES) {
      const all = new Set(template.tones.map((tone) => tone.semi));
      const required = template.tones.filter((tone) => !tone.optional);
      if (!required.every((tone) => intervals.has(tone.semi))) continue;
      if (![...intervals].every((semi) => all.has(semi))) continue;

      const omittedTones = template.tones.filter((tone) => tone.optional && !intervals.has(tone.semi));
      let score = template.rank;
      for (const tone of omittedTones) score += tone.label === '5' ? 0.5 : 1;
      if (bass !== root) score += 3;
      matches.push({
        root,
        template,
        bass: mod12(bass),
        score,
        omitted: omittedTones.map((tone) => tone.label),
      });
    }
  }

  matches.sort((a, b) => a.score - b.score || b.template.tones.length - a.template.tones.length);
  return matches;
}

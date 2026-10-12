// A fingering is what your fretting hand does: one entry per string.

import { ChordMatch, identifyChord } from './chords';
import { INTERVAL_NAMES, PitchClass, STANDARD_TUNING, mod12 } from './notes';

/** Fret per string, low E (6th string) first. null = muted, 0 = open. */
export type Fingering = (number | null)[];

export const MAX_FRET = 15;

export interface SoundingNote {
  /** 0 = low E (6th string) ... 5 = high e (1st string). */
  string: number;
  fret: number;
  midi: number;
  pc: PitchClass;
}

export function soundingNotes(fingering: Fingering, tuning = STANDARD_TUNING): SoundingNote[] {
  const notes: SoundingNote[] = [];
  fingering.forEach((fret, string) => {
    if (fret === null) return;
    const midi = tuning[string] + fret;
    notes.push({ string, fret, midi, pc: mod12(midi) });
  });
  return notes;
}

/**
 * Parse fingerings written the usual way, low E first:
 *   "x32010", "320003", "x-3-5-5-5-3", "8 10 10 9 8 8".
 * Returns null if it can't be read as six strings.
 */
export function parseFingering(text: string): Fingering | null {
  const cleaned = text.trim().toLowerCase();
  if (!cleaned) return null;
  const tokens = /[\s,\-/.]/.test(cleaned)
    ? cleaned.split(/[\s,\-/.]+/).filter(Boolean)
    : cleaned.split('');
  if (tokens.length !== 6) return null;
  const result: Fingering = [];
  for (const token of tokens) {
    if (token === 'x' || token === 'm') {
      result.push(null);
      continue;
    }
    const n = Number(token);
    if (!Number.isInteger(n) || n < 0 || n > 24) return null;
    result.push(n);
  }
  return result;
}

/** Format a fingering, e.g. [null,3,2,0,1,0] -> "x32010", or "x-3-5-5-5-3" past fret 9. */
export function formatFingering(fingering: Fingering): string {
  const parts = fingering.map((f) => (f === null ? 'x' : String(f)));
  return parts.some((p) => p.length > 1) ? parts.join('-') : parts.join('');
}

export interface FingeringAnalysis {
  notes: SoundingNote[];
  pitchClasses: PitchClass[];
  bass: SoundingNote | null;
  matches: ChordMatch[];
  /** Set when exactly two different notes are sounding. */
  interval?: { semitones: number; name: string };
}

export function analyzeFingering(fingering: Fingering): FingeringAnalysis {
  const notes = soundingNotes(fingering);
  const pitchClasses = [...new Set(notes.map((n) => n.pc))];
  const bass = notes.reduce<SoundingNote | null>((lo, n) => (!lo || n.midi < lo.midi ? n : lo), null);
  const matches = bass ? identifyChord(pitchClasses, bass.pc) : [];
  const analysis: FingeringAnalysis = { notes, pitchClasses, bass, matches };
  if (pitchClasses.length === 2 && bass) {
    const other = pitchClasses.find((pc) => pc !== bass.pc)!;
    const semitones = mod12(other - bass.pc);
    analysis.interval = { semitones, name: INTERVAL_NAMES[semitones] };
  }
  return analysis;
}

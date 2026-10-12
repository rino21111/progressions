// Find playable fingerings for a chord by searching small windows of the neck.

import { detectCagedShape } from './caged';
import { Chord, chordPitchClasses, toneLabelFor } from './chords';
import { Fingering, MAX_FRET, soundingNotes } from './fingering';
import { STANDARD_TUNING, mod12 } from './notes';

export interface Voicing {
  fingering: Fingering;
  /** Lowest fretted position (0 for open chords). */
  position: number;
  score: number;
}

const SPAN = 3; // frets above the window's lowest fret a hand can comfortably reach

/** Rough count of fingers needed, allowing one barre across the lowest fret. */
function fingersNeeded(fingering: Fingering): { fingers: number; barre: boolean } | null {
  const fretted = fingering
    .map((f, s) => ({ f, s }))
    .filter((x): x is { f: number; s: number } => x.f !== null && x.f > 0);
  if (fretted.length <= 4) return { fingers: fretted.length, barre: false };
  const low = Math.min(...fretted.map((x) => x.f));
  const atLow = fretted.filter((x) => x.f === low);
  const firstBarred = Math.min(...atLow.map((x) => x.s));
  // A barre can't sit under an open string it would cover.
  for (let s = firstBarred; s < 6; s++) if (fingering[s] === 0) return null;
  const fingers = 1 + fretted.length - atLow.length;
  return fingers <= 4 ? { fingers, barre: true } : null;
}

function scoreVoicing(fingering: Fingering, chord: Chord, windowStart: number): number | null {
  const notes = soundingNotes(fingering);
  if (notes.length < 3) return null;
  // Sounding strings must be next to each other (no muted string in the middle).
  const first = notes[0].string;
  const last = notes[notes.length - 1].string;
  if (last - first + 1 !== notes.length) return null;
  // Bass note must be the chord's bass.
  if (notes[0].pc !== chord.bass) return null;
  const present = new Set(notes.map((n) => n.pc));
  const required = chordPitchClasses(chord, false);
  if (!required.every((pc) => present.has(pc))) return null;
  // Want at least one of each tone for small chords and enough strings for big ones.
  if (notes.length < Math.min(4, chordPitchClasses(chord).length)) return null;
  const hand = fingersNeeded(fingering);
  if (!hand) return null;

  const fretted = notes.filter((n) => n.fret > 0).map((n) => n.fret);
  if (!fretted.length) return null;
  const span = Math.max(...fretted) - Math.min(...fretted);
  if (span > SPAN) return null;
  const opens = notes.length - fretted.length;

  let score = notes.length * 1.5 - fretted.length * 0.2;
  // Shapes that come from the CAGED system are the ones guitarists actually use.
  if (detectCagedShape(fingering, chord.root)) score += 3;
  score -= windowStart * 0.4;
  if (span === SPAN) score -= 1.5;
  if (hand.barre) score -= 1;
  if (hand.fingers === 4) score -= 1;
  // Ringing open strings next to notes high up the neck are awkward to finger.
  if (Math.max(...fretted) >= 5) score -= opens * 2;
  return score;
}

/** Playable voicings of a chord, best first. */
export function findVoicings(chord: Chord, limit = 8): Voicing[] {
  const pcs = new Set(chordPitchClasses(chord));
  const seen = new Map<string, Voicing>();

  for (let start = 0; start <= 12; start++) {
    const lo = Math.max(1, start);
    const hi = Math.min(MAX_FRET, lo + SPAN);
    const options: (number | null)[][] = STANDARD_TUNING.map((open) => {
      const opts: (number | null)[] = [null];
      if (pcs.has(mod12(open))) opts.push(0);
      for (let f = lo; f <= hi; f++) if (pcs.has(mod12(open + f))) opts.push(f);
      return opts;
    });

    const current: Fingering = [];
    const walk = (string: number) => {
      if (string === 6) {
        const score = scoreVoicing(current, chord, start);
        if (score === null) return;
        const key = current.join(',');
        const prev = seen.get(key);
        if (!prev || prev.score < score) {
          const fretted = current.filter((f): f is number => f !== null && f > 0);
          const position = current.some((f) => f === 0) || !fretted.length ? 0 : Math.min(...fretted);
          seen.set(key, { fingering: [...current], position, score });
        }
        return;
      }
      for (const opt of options[string]) {
        current[string] = opt;
        walk(string + 1);
      }
      current.length = string;
    };
    walk(0);
  }

  const all = [...seen.values()].sort((a, b) => b.score - a.score);
  // Keep variety: at most two voicings starting at the same position.
  const result: Voicing[] = [];
  const perPosition = new Map<number, number>();
  for (const v of all) {
    const count = perPosition.get(v.position) ?? 0;
    if (count >= 2) continue;
    perPosition.set(v.position, count + 1);
    result.push(v);
    if (result.length >= limit) break;
  }
  return result;
}

/** The single most natural fingering for a chord. */
export function bestVoicing(chord: Chord): Fingering | null {
  return findVoicings(chord, 1)[0]?.fingering ?? null;
}

/** The chord-tone label (R, 3, 5, b7…) of each string in a fingering, or null for muted strings. */
export function fingeringToneLabels(chord: Chord, fingering: Fingering): (string | null)[] {
  return fingering.map((fret, str) => (fret === null ? null : toneLabelFor(chord, mod12(STANDARD_TUNING[str] + fret)) ?? ''));
}

/** Every place on the neck (open strings included) where one of the chord's tones sits, except where the shape already plays. */
export function chordTonePositions(chord: Chord, shape: Fingering): { string: number; fret: number; pc: number }[] {
  const tones = new Set(chordPitchClasses(chord));
  const out: { string: number; fret: number; pc: number }[] = [];
  for (let string = 0; string < 6; string++) {
    for (let fret = 0; fret <= MAX_FRET; fret++) {
      const pc = mod12(STANDARD_TUNING[string] + fret);
      if (tones.has(pc) && shape[string] !== fret) out.push({ string, fret, pc });
    }
  }
  return out;
}

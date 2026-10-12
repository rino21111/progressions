// How one chord's tones move to the next chord's, as pitch classes in close position: each voice of
// the first chord goes to a tone of the second by the shortest way, so every tone of the second is
// used and the total movement is as small as possible.

import { Chord, chordTones } from './chords';
import { PitchClass, mod12 } from './notes';

export interface VoiceMove {
  from: PitchClass;
  fromLabel: string;
  to: PitchClass;
  toLabel: string;
  /** Semitones moved, -6..+5 (0: the note is held). */
  semis: number;
}

export interface VoicePairing {
  /** One per tone of the first chord, bottom (root) first. */
  moves: VoiceMove[];
  /** Tones of the second chord no voice moved to (it has more tones): they enter on top. */
  entering: { pc: PitchClass; label: string }[];
  /** Total semitones moved. */
  cost: number;
}

/** Compare two tie-break keys in order. */
function lessThan(a: number[], b: number[]): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}

/** The shortest way from one pitch class to another, -6..+5 semitones. */
const step = (from: PitchClass, to: PitchClass) => mod12(to - from + 6) - 6;

/**
 * Pair the voices. Ties on total movement go, in order, to: fewer parallel fifths or octaves, more
 * contrary motion, the smallest sum of squares, and the lowest voice landing on the new root.
 */
export function pairVoices(a: Chord, b: Chord): VoicePairing {
  const from = chordTones(a);
  const to = chordTones(b);
  const n = from.length;
  const m = to.length;
  let best: { pick: number[]; key: number[] } | null = null;

  const pick: number[] = [];
  const visit = (i: number) => {
    if (i === n) {
      const used = new Set(pick);
      // Every tone of the second chord is used, unless it has more tones than voices (then each voice gets its own).
      if (n >= m ? used.size !== m : used.size !== n) return;
      const moves = pick.map((j, v) => step(from[v].pc, to[j].pc));
      let parallels = 0;
      let contrary = 0;
      for (let x = 0; x < n; x++) {
        for (let y = x + 1; y < n; y++) {
          const apart = mod12(from[y].pc - from[x].pc);
          if ((apart === 0 || apart === 7 || apart === 5) && moves[x] === moves[y] && moves[x] !== 0) parallels++;
          if (moves[x] * moves[y] < 0) contrary++;
        }
      }
      const key = [
        moves.reduce((s, d) => s + Math.abs(d), 0),
        parallels,
        -contrary,
        moves.reduce((s, d) => s + d * d, 0),
        to[pick[0]].pc === b.root ? 0 : 1,
      ];
      if (!best || lessThan(key, best.key)) best = { pick: [...pick], key };
      return;
    }
    for (let j = 0; j < m; j++) {
      pick.push(j);
      visit(i + 1);
      pick.pop();
    }
  };
  visit(0);

  const chosen = best!.pick;
  const moves = chosen.map((j, v) => ({
    from: from[v].pc, fromLabel: from[v].label, to: to[j].pc, toLabel: to[j].label, semis: step(from[v].pc, to[j].pc),
  }));
  const used = new Set(chosen);
  return {
    moves,
    entering: to.filter((_, j) => !used.has(j)).map((t) => ({ pc: t.pc, label: t.label })),
    cost: best!.key[0],
  };
}

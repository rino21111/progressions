// How one shape becomes the next, one voice per string: held, gliding (two frets or less along the
// string), or swapped (anything else, including a string starting or stopping). And the moves line
// that says it: "C stays · F→E · A→G".

import { Chord, spellChordNote } from './chords';
import { Fingering } from './fingering';
import { STANDARD_TUNING, mod12 } from './notes';

export type MoveKind = 'mute' | 'held' | 'glide' | 'swap';

export interface StringMove {
  string: number;
  from: number | null;
  to: number | null;
  kind: MoveKind;
}

export function stringMoves(from: Fingering, to: Fingering): StringMove[] {
  return from.map((a, string) => {
    const b = to[string];
    const kind: MoveKind = a === null && b === null ? 'mute'
      : a === null || b === null ? 'swap'
        : a === b ? 'held'
          : Math.abs(a - b) <= 2 ? 'glide' : 'swap';
    return { string, from: a, to: b, kind };
  });
}

const pcAt = (string: number, fret: number) => mod12(STANDARD_TUNING[string] + fret);

/** A note as the site spells it in this chord. */
export const noteIn = (chord: Chord, string: number, fret: number) => spellChordNote(chord, pcAt(string, fret), chord.spelling);

export interface MovesLine {
  /** Notes held in place, each once, low string first. */
  held: string[];
  /** Note changes, low string first, each pair once. */
  moves: [string, string][];
}

export function movesLine(fromChord: Chord, from: Fingering, toChord: Chord, to: Fingering): MovesLine {
  const all = stringMoves(from, to);
  const held: string[] = [];
  for (const m of all) {
    const name = m.kind === 'held' ? noteIn(fromChord, m.string, m.from!) : null;
    if (name && !held.includes(name)) held.push(name);
  }
  const glided = new Set(all.filter((m) => m.kind === 'glide').map((m) => noteIn(toChord, m.string, m.to!)));
  const moves: [string, string][] = [];
  for (const m of all) {
    if (m.from === null || m.to === null || m.kind === 'held') continue;
    const pair: [string, string] = [noteIn(fromChord, m.string, m.from), noteIn(toChord, m.string, m.to)];
    // A longer jump is named only when its note isn't already there (held, or brought in by a glide).
    if (m.kind === 'swap' && (held.includes(pair[1]) || glided.has(pair[1]))) continue;
    if (!moves.some((p) => p[0] === pair[0] && p[1] === pair[1])) moves.push(pair);
  }
  return { held, moves };
}

/** "X stays", "X and Y stay", "X, Y and Z stay". */
export function heldPhrase(held: string[]): string {
  if (!held.length) return '';
  const names = held.length === 1 ? held[0] : `${held.slice(0, -1).join(', ')} and ${held[held.length - 1]}`;
  return `${names} ${held.length === 1 ? 'stays' : 'stay'}`;
}

export const movesText = (line: MovesLine): string =>
  [heldPhrase(line.held), ...line.moves.map(([a, b]) => `${a}→${b}`)].filter(Boolean).join(' · ');

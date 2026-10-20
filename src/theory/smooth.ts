// Smooth shapes: when the site picks a chord's shape, it takes the one of the chord's usual shapes
// (the Chord page's Other shapes) that moves least from the shape before it.

import { Chord } from './chords';
import { Fingering } from './fingering';
import { findVoicings } from './voicings';

/** How many of a chord's shapes are in play: the ones the Chord page offers. */
export const SHAPES = 6;

export const COST = {
  /** Each string held at the same fret. */
  held: -1,
  /** Each fret moved, on strings that sound in both. */
  fret: 1,
  /** Each string that starts or stops sounding. */
  mute: 1.5,
  /** Each fret the hand moves (the average of the fretted frets). */
  position: 1,
  /** Each step down the chord's list of shapes, so the usual shape wins ties. */
  rank: 1.5,
};

const handAt = (f: Fingering) => {
  const fretted = f.filter((x): x is number => x !== null && x > 0);
  return fretted.length ? fretted.reduce((a, b) => a + b, 0) / fretted.length : 0;
};

/** The cost of going from shape `a` to shape `b` (its place in the list aside). */
export function moveCost(a: Fingering, b: Fingering): number {
  let cost = 0;
  for (let s = 0; s < 6; s++) {
    const x = a[s], y = b[s];
    if (x === null && y === null) continue;
    if (x === null || y === null) cost += COST.mute;
    else if (x === y) cost += COST.held;
    else cost += COST.fret * Math.abs(x - y);
  }
  return cost + COST.position * Math.abs(handAt(a) - handAt(b));
}

const cache = new Map<string, Fingering[]>();
/** The chord's shapes, usual first (cached: the search is not cheap). */
export function shapesOf(chord: Chord): Fingering[] {
  const key = `${chord.root}:${chord.template.id}:${chord.bass}`;
  let list = cache.get(key);
  if (!list) {
    list = findVoicings(chord, SHAPES).map((v) => v.fingering);
    cache.set(key, list);
  }
  return list;
}

/** The chord's shape that moves least from `from` (its usual shape when there's nothing before it). */
export function smoothShape(chord: Chord, from: Fingering | null | undefined): Fingering | null {
  const list = shapesOf(chord);
  if (!from || !list.length) return list[0] ?? null;
  let best = list[0];
  let bestCost = Infinity;
  list.forEach((shape, rank) => {
    const cost = moveCost(from, shape) + COST.rank * rank;
    if (cost < bestCost) {
      best = shape;
      bestCost = cost;
    }
  });
  return best;
}

/** Shapes for chords played in turn: the first as given (or usual), each next one smooth from the one before. */
export function smoothChain(chords: Chord[], first?: Fingering | null): (Fingering | null)[] {
  const out: (Fingering | null)[] = [];
  chords.forEach((c, i) => out.push(i === 0 ? first ?? shapesOf(c)[0] ?? null : smoothShape(c, out[i - 1])));
  return out;
}

/** The chords, each carrying its smooth shape (what's added and played). */
export function withSmoothShapes<T extends Chord>(chords: T[], first?: Fingering | null): (T & { fingering?: Fingering })[] {
  const shapes = smoothChain(chords, first);
  return chords.map((c, i) => (shapes[i] ? { ...c, fingering: shapes[i]! } : c));
}

// Ways to play a chord over one bar of 4/4 or 3/4: which notes sound on which beat.
// Five styles (strum, arpeggio, Travis picking, bossa nova, post-rock), each with a few variants.

import { SoundingNote } from './fingering';

export type PlayStyle = 'strum' | 'arpeggio' | 'travis' | 'bossa' | 'postrock';
/** Beats in a bar: 4 for 4/4, 3 for a waltz. */
export type BeatsPerBar = 3 | 4;

/** The first variant is each style's default. */
export const PLAY_STYLES: { id: PlayStyle; label: string; variants: { id: string; label: string }[] }[] = [
  {
    id: 'strum',
    label: 'Strum',
    variants: [
      { id: 'whole', label: 'Whole' },
      { id: 'quarters', label: 'Quarters' },
      { id: 'folk', label: 'Folk' },
      { id: 'rock', label: 'Rock' },
      { id: 'reggae', label: 'Reggae' },
    ],
  },
  {
    id: 'arpeggio',
    label: 'Arpeggio',
    variants: [
      { id: 'up', label: 'Up' },
      { id: 'updown', label: 'Up & down' },
      { id: 'classic', label: 'Classic' },
      { id: 'roll', label: 'Roll' },
    ],
  },
  {
    id: 'travis',
    label: 'Travis',
    variants: [
      { id: 'basic', label: 'Basic' },
      { id: 'thumb', label: 'Thumb only' },
      { id: 'pinch', label: 'Pinch' },
      { id: 'monotonic', label: 'Monotonic' },
      { id: 'muted', label: 'Muted bass' },
    ],
  },
  {
    id: 'bossa',
    label: 'Bossa',
    variants: [
      { id: 'basic', label: 'Basic' },
      { id: 'twobar', label: 'Two-bar' },
      { id: 'clave', label: 'Clave' },
      { id: 'arpeggio', label: 'Arpeggio' },
    ],
  },
  {
    id: 'postrock',
    label: 'Post-rock',
    variants: [
      { id: 'cascade', label: 'Cascade' },
      { id: 'pulse', label: 'Pulse' },
      { id: 'tremolo', label: 'Tremolo' },
    ],
  },
];

/** Styles played straight even when swing is on. */
export const STRAIGHT_STYLES: PlayStyle[] = ['bossa', 'postrock'];

/** Styles that play through the dotted-eighth echo. */
export const ECHO_STYLES: PlayStyle[] = ['postrock'];

/** Echo settings: delay in beats (a dotted eighth), feedback and wet level against a dry level of 1. */
export const ECHO = { beats: 0.75, feedback: 0.25, wet: 0.2, highpassHz: 300 };

/** A known variant of the style, or the style's default (its first) if `variant` isn't one of them. */
export function validVariant(style: PlayStyle, variant: string | undefined): string {
  const variants = PLAY_STYLES.find((s) => s.id === style)!.variants;
  return variants.some((v) => v.id === variant) ? variant! : variants[0].id;
}

const range = (n: number, step = 1) => Array.from({ length: n }, (_, i) => i * step);

export interface PatternEvent {
  /** Position in the bar, in beats from 0 (beat 1) up to (not including) the bar length. */
  beat: number;
  midis: number[];
  /** Relative loudness, 1 = full. */
  volume: number;
  /** Gap between strings in a strum, in ms (0 = all at once). */
  spreadMs: number;
  /** Strum from the high strings down (an upstroke). */
  up?: boolean;
  /** Cut the notes off after this many beats (short, choppy or palm-muted notes); otherwise they ring. */
  lengthBeats?: number;
  /** A slow harp-like roll rather than a strum. */
  roll?: boolean;
  /** Palm-muted. */
  muted?: boolean;
  /** Tremolo-picked through its length: the player expands it into fast alternating strikes. */
  tremolo?: boolean;
}

/** Tremolo strikes per beat: about 12 a second at any tempo, never fewer than 4. */
export const tremoloStrikes = (bpm: number) => Math.max(4, Math.round((12 * 60) / bpm));

/** A tremolo event as the strikes the player sounds: even across its length, alternating down and up, each cutting the last. */
export function expandTremolo(e: PatternEvent, bpm: number): PatternEvent[] {
  const n = Math.max(1, Math.round(tremoloStrikes(bpm) * (e.lengthBeats ?? 1)));
  const step = (e.lengthBeats ?? 1) / n;
  return range(n).map((i) => ({
    beat: e.beat + i * step, midis: e.midis, volume: i % 2 ? 0.42 : 0.5, spreadMs: 0, lengthBeats: step,
    ...(i % 2 ? { up: true } : {}),
  }));
}

/**
 * Where two parts land on the same string at the same beat, it sounds once, at the louder volume.
 * Parts stay separate events, so a bass note keeps its own volume rather than being shared out.
 */
function mergeParts(events: PatternEvent[]): PatternEvent[] {
  const out = events.map((e) => ({ ...e, midis: [...e.midis] }));
  for (const e of out) {
    for (const o of out) {
      if (o === e || o.beat !== e.beat || o.volume > e.volume || (o.volume === e.volume && out.indexOf(o) > out.indexOf(e))) continue;
      o.midis = o.midis.filter((m) => !e.midis.includes(m));
    }
  }
  return out.filter((e) => e.midis.length).sort((a, b) => a.beat - b.beat);
}


/**
 * One bar of a style/variant for a chord's sounding notes (sorted here, low string to high).
 * `bar` counts bars played so far, for patterns that alternate between bars.
 */
export function patternEvents(
  style: PlayStyle,
  variant: string,
  notes: SoundingNote[],
  beats: BeatsPerBar = 4,
  bar = 0,
): PatternEvent[] {
  const sorted = [...notes].sort((a, b) => a.string - b.string);
  if (!sorted.length) return [];
  const waltz = beats === 3;
  const all = sorted.map((n) => n.midi);
  const top = all.slice(-4);
  const one = (beat: number, note: SoundingNote, volume = 0.8, lengthBeats?: number): PatternEvent =>
    ({ beat, midis: [note.midi], volume, spreadMs: 0, lengthBeats });
  const pinch = (beat: number, a: SoundingNote, b: SoundingNote, volume = 0.85): PatternEvent =>
    ({ beat, midis: [...new Set([a.midi, b.midi])], volume, spreadMs: 0 });
  const down = (beat: number, volume = 1, spreadMs = 30, lengthBeats?: number): PatternEvent =>
    ({ beat, midis: all, volume, spreadMs, lengthBeats });
  const up = (beat: number): PatternEvent => ({ beat, midis: top, volume: 0.65, spreadMs: 20, up: true });

  // Picking-hand roles: two bass strings for the thumb, and up to three top strings for the
  // fingers (t(0) = highest). Small chords reuse what they have.
  const bass1 = sorted[0];
  const bass2 = sorted[1] ?? bass1;
  const rest = sorted.slice(2);
  const treble = rest.length ? rest.slice(-3).reverse() : [bass2];
  const t = (i: number) => treble[i % treble.length];
  // The strings above the root, highest first (a(0) the top string), never the root itself.
  const above = sorted.slice(1).reverse();
  const a = (i: number): SoundingNote | undefined => above[i];
  // Bossa fingers: the three highest strings above the root. The thumb's second note sounds below them:
  // the fifth if it's there, else the next bass string, else the root again.
  const fingers = above.slice(0, 3);
  const firstFinger = fingers.length ? sorted.indexOf(fingers[fingers.length - 1]) : sorted.length;
  const below = sorted.slice(1, firstFinger);
  const alt = below.find((n) => n.pc === (bass1.pc + 7) % 12) ?? below[0] ?? bass1;

  switch (`${style}:${variant}`) {
    // ---- Strum ----
    case 'strum:quarters':
      return range(beats).map((b) => down(b, b === 0 ? 1 : 0.85));
    case 'strum:folk':
      // 4/4: D . D U . U D U    3/4: D . D U D U
      return waltz
        ? [down(0), down(1), up(1.5), down(2), up(2.5)]
        : [down(0), down(1), up(1.5), up(2.5), down(3), up(3.5)];
    case 'strum:rock':
      // Straight down-stroke eighths, short and punchy, accented on the beat.
      return range(beats * 2, 0.5).map((b) => down(b, Number.isInteger(b) ? 1 : 0.75, 15, 0.4));
    case 'strum:reggae':
      // Short choppy strums on the off-beats only.
      return range(beats).map((b) => ({ beat: b + 0.5, midis: top, volume: 0.8, spreadMs: 12, lengthBeats: 0.2 }));
    // ---- Bossa nova ----
    case 'bossa:basic':
    case 'bossa:twobar':
    case 'bossa:clave': {
      // Thumb: root on 1, then on 3 the shape's fifth if it sounds below the finger strings (else the
      // next bass string below them, else the root again). Fingers pluck the three highest strings above
      // the root together, short. "Two-bar" and "Clave" alternate two comping bars.
      const pluck = (beat: number): PatternEvent => ({ beat, midis: fingers.map((n) => n.midi).reverse(), volume: 0.7, spreadMs: 0, lengthBeats: 0.45 });
      const second = bar % 2 === 1;
      const plucks = variant === 'clave'
        ? (waltz ? (second ? [1] : [0, 1.5]) : second ? [1, 2.5] : [0, 1.5, 3])
        : variant === 'twobar' && second
          ? (waltz ? [0.5, 2] : [0.5, 2, 3])
          : waltz ? [0, 1.5] : [0, 1.5, 3];
      return mergeParts([one(0, bass1, 0.85), one(2, alt, 0.8), ...(fingers.length ? plucks.map(pluck) : [])]);
    }
    case 'bossa:arpeggio': {
      // Single notes over the thumb; the top string carries the bossa accents on 1, the and of 2, and 4.
      const at = (beat: number, note: SoundingNote | undefined, volume: number) => (note ? [one(beat, note, volume)] : []);
      const out = waltz
        ? [...at(0, bass1, 0.85), ...at(0, a(0), 0.8), ...at(0.5, a(2), 0.6), ...at(1, a(1), 0.6), ...at(1.5, a(0), 0.8), ...at(2, alt, 0.8), ...at(2.5, a(1), 0.6)]
        : [...at(0, bass1, 0.85), ...at(0, a(0), 0.8), ...at(0.5, a(2), 0.6), ...at(1, a(1), 0.6), ...at(1.5, a(0), 0.8),
          ...at(2, alt, 0.8), ...at(2.5, a(1), 0.6), ...at(3, a(0), 0.8), ...at(3.5, a(2), 0.6)];
      return mergeParts(out);
    }

    // ---- Post-rock (straight, through the echo) ----
    case 'postrock:cascade': {
      // A falling 3-3-2 arpeggio over the root; a missing third string falls back to the root.
      const lo = a(2) ?? bass1;
      const at = (beat: number, note: SoundingNote | undefined, volume: number) => (note ? [one(beat, note, volume)] : []);
      const cycle = [a(0), a(1), lo];
      const steps = range(beats * 2).map((i) => ({ beat: i / 2, note: i === 0 ? a(0) : cycle[i % 3] }));
      return mergeParts([...at(0, bass1, 0.85), ...steps.flatMap((x) => at(x.beat, x.note, x.note === a(0) ? 0.8 : 0.7))]);
    }
    case 'postrock:pulse': {
      // Open strums on the 3-3-2 points (1, the and of 2, and 4) over a palm-muted root in between.
      const strums = waltz ? [0, 1.5] : [0, 1.5, 3];
      const mutes = waltz ? [0.5, 1, 2, 2.5] : [0.5, 1, 2, 2.5, 3.5];
      return [
        ...strums.map((b) => down(b, b === 0 ? 1 : 0.9, 15)),
        ...mutes.map((b) => ({ ...one(b, bass1, 0.55, 0.3), muted: true })),
      ].sort((x, y) => x.beat - y.beat);
    }
    case 'postrock:tremolo':
      // The root rings under the top string tremolo-picked through every beat.
      return mergeParts([one(0, bass1, 0.8), ...(a(0) ? range(beats).map((b) => ({ ...one(b, a(0)!, 0.5, 1), tremolo: true })) : [])]);

    // ---- Arpeggio ----
    case 'arpeggio:updown': {
      // Eighth notes up through the strings and back down.
      const cycle = sorted.length > 2 ? [...sorted, ...sorted.slice(1, -1).reverse()] : sorted;
      return range(beats * 2).map((i) => one(i / 2, cycle[i % cycle.length]));
    }
    case 'arpeggio:classic': {
      // p-i-m-a-m-i: bass, then the top three strings up and back; 4/4 adds the other bass and m.
      const order = [bass1, t(2), t(1), t(0), t(1), t(2)];
      if (!waltz) order.push(bass2, t(1));
      return order.map((note, i) => one(i / 2, note, i === 0 ? 0.9 : 0.75));
    }
    case 'arpeggio:roll':
      // A quick harp-like roll from bass to treble on every beat.
      return range(beats).map((b) => ({ ...down(b, b === 0 ? 0.9 : 0.75, 55), roll: true }));

    // ---- Travis ----
    case 'travis:thumb':
      // Just the alternating bass: the place to start.
      return range(beats).map((b) => one(b, b % 2 === 0 ? bass1 : bass2, 0.9));
    case 'travis:pinch':
      // Bass and top string together on 1 (and 3 in 4/4), bass alone in between.
      return waltz
        ? [pinch(0, bass1, t(0)), one(1, bass2, 0.85), one(2, bass2, 0.85)]
        : [pinch(0, bass1, t(0)), one(1, bass2, 0.85), pinch(2, bass1, t(0)), one(3, bass2, 0.85)];
    case 'travis:monotonic':
      // The same bass note on every beat, with syncopated treble notes on the off-beats.
      return [
        pinch(0, bass1, t(0)),
        ...range(beats - 1).flatMap((i) => [one(i + 1, bass1, 0.85), one(i + 1.5, t(i % 2 === 0 ? 1 : 0))]),
      ];
    case 'travis:basic':
    case 'travis:muted': {
      // Thumb alternates between two bass strings on the beat; fingers pick treble strings in between.
      // "Muted bass" palm-mutes the thumb (short and softer) under ringing treble.
      const muted = variant === 'muted';
      const b = (beat: number, note: SoundingNote) => ({ ...one(beat, note, muted ? 0.7 : 0.85, muted ? 0.3 : undefined), muted: muted || undefined });
      if (waltz) {
        // Bass on 1, treble pinches on 2 and 3, with a lead-in back to the bass.
        return [b(0, bass1), pinch(1, t(1), t(0), 0.75), one(1.5, t(2)), pinch(2, t(1), t(0), 0.75), b(2.5, bass2)];
      }
      return [
        b(0, bass1), one(0, t(0)),
        one(0.5, t(2)),
        b(1, bass2),
        one(1.5, t(1)),
        b(2, bass1),
        one(2.5, t(0)),
        b(3, bass2),
        one(3.5, t(1)),
      ];
    }

    // Defaults: arpeggio "up" (bass to treble once, ringing) and strum "whole" (one down strum per bar).
    case 'arpeggio:up':
      return sorted.slice(0, beats * 2).map((note, i) => one(i / 2, note));
    case 'strum:whole':
    default:
      return [down(0)];
  }
}

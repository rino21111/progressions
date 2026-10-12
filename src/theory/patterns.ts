// Ways to play a chord over one bar of 4/4 or 3/4: which notes sound on which beat.
// Four styles (strum, arpeggio, Travis picking, bossa nova), each with a few variants.

import { SoundingNote } from './fingering';

export type PlayStyle = 'strum' | 'arpeggio' | 'travis' | 'bossa';
/** Beats in a bar: 4 for 4/4, 3 for a waltz. */
export type BeatsPerBar = 3 | 4;

/** `short` is used where space is tight (phones). The first variant is each style's default. */
export const PLAY_STYLES: { id: PlayStyle; label: string; short?: string; variants: { id: string; label: string }[] }[] = [
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
    short: 'Arp',
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
    ],
  },
];

/** Styles played straight even when swing is on. */
export const STRAIGHT_STYLES: PlayStyle[] = ['bossa'];

/** A known variant of the style, or the style's default (its first) if `variant` isn't one of them. */
export function validVariant(style: PlayStyle, variant: string | undefined): string {
  const variants = PLAY_STYLES.find((s) => s.id === style)!.variants;
  return variants.some((v) => v.id === variant) ? variant! : variants[0].id;
}

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
}

const range = (n: number, step = 1) => Array.from({ length: n }, (_, i) => i * step);

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
    case 'bossa:twobar': {
      // Thumb: root on 1, then the shape's fifth on 3 if it has one on a low string (otherwise the
      // next bass string), all within the fingering. Fingers pluck the top strings together, short,
      // on a syncopated pattern; "Two-bar" alternates two comping bars.
      const fifth = sorted.slice(1, 4).find((n) => n.pc === (bass1.pc + 7) % 12);
      const thumb2 = (fifth ?? bass2).midi;
      const pluck = (beat: number): PatternEvent => ({ beat, midis: top.slice(-3), volume: 0.7, spreadMs: 0, lengthBeats: 0.45 });
      const second = variant === 'twobar' && bar % 2 === 1;
      const plucks = waltz ? (second ? [0.5, 2] : [0, 1.5]) : second ? [0.5, 2, 3] : [0, 1.5, 3];
      const thumb: PatternEvent[] = [one(0, bass1, 0.85), { beat: 2, midis: [thumb2], volume: 0.8, spreadMs: 0 }];
      return [...thumb, ...plucks.map(pluck)].sort((a, b) => a.beat - b.beat);
    }

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

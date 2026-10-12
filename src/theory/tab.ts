// Guitar tab for the progression: a dry run of the player's pattern scheduler (no audio) over one
// pass, bar by bar, with each card's own fingering. What the tab shows is exactly what Play plays.

import { Fingering, SoundingNote, soundingNotes } from './fingering';
import { BeatsPerBar, PatternEvent, PlayStyle, patternEvents } from './patterns';
import { chordForBar } from './timing';

export interface TabNote {
  /** 0 = low E, as in a fingering. */
  string: number;
  fret: number;
}

export interface TabEvent {
  /** Eighth-note slot in the bar (beat × 2). */
  slot: number;
  /** Low string first. */
  notes: TabNote[];
  /** A strum (notes spread across the strings), and which way. */
  strum?: 'down' | 'up';
  roll?: boolean;
  /** Cut short by a length limit. */
  short?: boolean;
  muted?: boolean;
  /** A later strum in the bar whose strings were all already written in it. */
  faded?: boolean;
}

/** One rhythm value under the staff: a note (from an onset) or a rest, in eighths. */
export interface RhythmItem {
  slot: number;
  /** 1 eighth, 2 quarter, 3 dotted quarter, 4 half, 6 dotted half, 8 whole. */
  length: number;
  rest?: boolean;
  /** Continues the note before it (a length no single value writes, such as five eighths). */
  tied?: boolean;
}

export interface TabBar {
  /** Which card (chord) the bar plays. */
  chord: number;
  events: TabEvent[];
  rhythm: RhythmItem[];
}

export interface TabSettings {
  style: PlayStyle;
  variant: string;
  beats: BeatsPerBar;
  barsPerChord: number;
}

/**
 * How many passes to write before the repeat: two when a pattern alternates bars (Bossa Two-bar)
 * and the progression has an odd number of bars, since the player's bar count runs across the loop.
 */
export function tabPasses(settings: TabSettings, bars: number): number {
  return settings.style === 'bossa' && settings.variant === 'twobar' && bars % 2 === 1 ? 2 : 1;
}

/** The tab's bars: one pass of the progression (two when the pattern needs it), as the player schedules it. */
export function tabBars(fingerings: Fingering[], settings: TabSettings): TabBar[] {
  const perPass = fingerings.length * Math.max(1, settings.barsPerChord);
  const total = perPass * tabPasses(settings, perPass);
  const out: TabBar[] = [];
  for (let played = 0; played < total; played++) {
    const chord = chordForBar(played % perPass, fingerings.length, settings.barsPerChord)!;
    const notes = soundingNotes(fingerings[chord]);
    const written = new Set<number>();
    const raw = patternEvents(settings.style, settings.variant, notes, settings.beats, played);
    const events = raw.map((e): TabEvent => {
      const used = new Set<SoundingNote>();
      const tabNotes = e.midis
        .map((m) => notes.find((n) => n.midi === m && !used.has(n) && used.add(n))!)
        .map((n) => ({ string: n.string, fret: n.fret }))
        .sort((a, b) => a.string - b.string);
      const strum = tabNotes.length > 1 && e.spreadMs > 0 ? (e.up ? 'up' : 'down') : undefined;
      const faded = !!strum && tabNotes.every((n) => written.has(n.string));
      tabNotes.forEach((n) => written.add(n.string));
      return {
        slot: Math.round(e.beat * 2), notes: tabNotes,
        ...(strum ? { strum } : {}), ...(e.roll ? { roll: true } : {}), ...(e.lengthBeats !== undefined && strum ? { short: true } : {}),
        ...(e.muted ? { muted: true } : {}), ...(faded ? { faded: true } : {}),
      };
    });
    out.push({ chord, events, rhythm: rhythm(raw, notes, settings.beats * 2) });
  }
  return out;
}

const WRITTEN = [8, 6, 4, 3, 2, 1];
/** A length in eighths as written values: the largest that fits, then tied ones for the rest. */
function split(slot: number, length: number, rest: boolean): RhythmItem[] {
  const out: RhythmItem[] = [];
  while (length > 0) {
    const v = rest ? (slot % 2 === 0 && length >= 2 ? 2 : 1) : WRITTEN.find((w) => w <= length)!;
    out.push({ slot, length: v, ...(rest ? { rest: true } : {}), ...(!rest && out.length ? { tied: true } : {}) });
    slot += v;
    length -= v;
  }
  return out;
}

/**
 * The bar's rhythm. Each onset lasts until the next (or the bar's end), since notes ring, unless
 * everything sounding has been cut short before then: the onset then lasts until that silence
 * (rounded up to an eighth) and the rest of the gap is rests. Silence before the first onset is rests.
 */
export function rhythm(events: PatternEvent[], notes: SoundingNote[], slots: number): RhythmItem[] {
  const onsets = [...new Set(events.map((e) => Math.round(e.beat * 2)))].sort((a, b) => a - b);
  if (!onsets.length) return split(0, slots, true);
  const out: RhythmItem[] = onsets[0] > 0 ? split(0, onsets[0], true) : [];
  /** When each string stops, in eighths (Infinity while it rings). */
  const ends = new Map<number, number>();
  onsets.forEach((slot, i) => {
    for (const e of events.filter((x) => Math.round(x.beat * 2) === slot)) {
      for (const m of e.midis) {
        const string = notes.find((n) => n.midi === m)!.string;
        ends.set(string, e.lengthBeats === undefined ? Infinity : slot + e.lengthBeats * 2);
      }
    }
    const next = onsets[i + 1] ?? slots;
    const silence = Math.max(...ends.values());
    const sounding = silence < next ? Math.max(1, Math.ceil(silence - slot - 1e-9)) : next - slot;
    out.push(...split(slot, sounding, false));
    if (slot + sounding < next) out.push(...split(slot + sounding, next - slot - sounding, true));
  });
  return out;
}

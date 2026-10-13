// Where everything in the tab goes: lines of bars, slots, strings, chord names and the end sign.
// Pure numbers, so it can be tested without a page; tab.ts draws it.

import { TabBar } from '../theory/tab';

export interface TabMetrics {
  /** Gap between strings. */
  gap: number;
  /** From a bar's start to its first slot's left edge. */
  pad: number;
  /** Room on the left for the string names. */
  labels: number;
  fret: number;
  halo: number;
  name: number;
  /** Rhythm stems: how far below the E string they start, and how long they are. */
  stemGap: number;
  stem: number;
  /** The time signature's digits, and the room it adds before the first line's first note. */
  time: number;
  timeRoom: number;
}

export const DESKTOP: TabMetrics = { gap: 16, pad: 18, labels: 16, fret: 14, halo: 4, name: 15, stemGap: 8, stem: 18, time: 15, timeRoom: 16 };
export const PHONE: TabMetrics = { gap: 12, pad: 14, labels: 14, fret: 12, halo: 3, name: 14, stemGap: 7, stem: 14, time: 13, timeRoom: 14 };

/** Room after a bar's last slot, and the extra the last bar needs to clear a repeat sign's dots. */
const RIGHT = 6;
const REPEAT_ROOM = 14;
/** What a fret number needs: about 7px per digit plus 4. */
const needs = (fret: number) => String(fret).length * 7 + 4;

export interface LaidBar {
  /** Index into the tab's bars. */
  index: number;
  x: number;
  width: number;
  /** From the bar's start to its first slot's left edge (wider after the time signature). */
  pad: number;
  slotWidth: number;
  /** The chord's name, where it changes and at the start of each line. */
  name: string | null;
}

export interface LaidLine {
  top: number;
  /** y of the high e string (the E string is 5 gaps below). */
  staff: number;
  bars: LaidBar[];
  /**
   * The palm-mute mark's spans and their y (between the staff and the rhythm): one span per run of
   * muted notes, broken by an open strum or where the muted string rings open again.
   */
  muted: [number, number][] | null;
  mutedY: number;
  /** Where the rhythm stems start and end. */
  stemTop: number;
  stemEnd: number;
  /** y of the strum arrows and chord names. */
  arrow: number;
  chordName: number;
}

export interface TabLayout {
  width: number;
  height: number;
  slots: number;
  lines: LaidLine[];
  /** With Loop on the tab ends in a repeat sign; otherwise a final barline. */
  end: 'repeat' | 'final';
  swing: boolean;
  /** "let ring" for picking styles. */
  letRing: boolean;
  /** "Echo" for styles that play through it. */
  echo: boolean;
  beats: number;
  m: TabMetrics;
}

export interface LayoutInput {
  bars: TabBar[];
  /** Name of each card's chord. */
  names: string[];
  beats: number;
  width: number;
  phone: boolean;
  loop: boolean;
  swing: boolean;
  letRing: boolean;
  echo: boolean;
}

/** x of a slot's centre in a laid bar. */
export const slotX = (b: LaidBar, slot: number) => b.x + b.pad + (slot + 0.5) * b.slotWidth;

/** y of a string (0 = low E) on a line. */
export const stringY = (line: LaidLine, string: number, m: TabMetrics) => line.staff + (5 - string) * m.gap;

export function layoutTab(input: LayoutInput): TabLayout {
  const m = input.phone ? PHONE : DESKTOP;
  const slots = input.beats * 2;
  // An empty progression still draws one empty bar.
  const bars: TabBar[] = input.bars.length ? input.bars : [{ chord: -1, events: [], rhythm: [] }];
  const staffWidth = Math.max(120, input.width - m.labels);
  const widest = (from: number, to: number) => Math.max(0, ...bars.slice(from, to).flatMap((b) => b.events.flatMap((e) => e.notes.map((n) => needs(n.fret)))));

  // 4 bars a line with room for them (2 otherwise), fewer while a line's numbers don't fit their slots.
  let perLine = Math.min(bars.length, input.width >= 640 ? 4 : 2);
  const fits = (n: number) => {
    const slotWidth = (staffWidth / n - m.pad - RIGHT - (REPEAT_ROOM + m.timeRoom) / n) / slots;
    for (let i = 0; i < bars.length; i += n) if (widest(i, i + n) > slotWidth) return false;
    return true;
  };
  while (perLine > 1 && !fits(perLine)) perLine--;

  const muted = (b: TabBar) => b.events.some((e) => e.muted);
  const lines: LaidLine[] = [];
  let y = input.swing || input.letRing || input.echo ? 14 : 0;
  for (let i = 0; i < bars.length; i += perLine) {
    const group = bars.slice(i, i + perLine);
    const last = i + perLine >= bars.length;
    const barWidth = staffWidth / perLine;
    const top = y;
    const chordName = top + m.name;
    // The arrow row only where the line strums.
    const strums = group.some((b) => b.events.some((e) => e.strum));
    const arrow = chordName + (strums ? (input.phone ? 15 : 17) : 0);
    const staff = arrow + (strums ? (input.phone ? 11 : 13) : input.phone ? 13 : 15);
    const lowE = staff + 5 * m.gap;
    const hasMute = group.some(muted);
    const mutedY = lowE + 13;
    const stemTop = lowE + m.stemGap + (hasMute ? 14 : 0);
    const stemEnd = stemTop + m.stem;
    const laid = group.map((b, j): LaidBar => {
      const index = i + j;
      const x = m.labels + j * barWidth;
      const right = RIGHT + (last && j === group.length - 1 && input.loop ? REPEAT_ROOM : 0);
      const pad = m.pad + (index === 0 ? m.timeRoom : 0);
      const changed = index === 0 || j === 0 || bars[index - 1].chord !== b.chord;
      const name = b.chord >= 0 && changed ? input.names[b.chord] ?? null : null;
      return { index, x, width: barWidth, pad, slotWidth: (barWidth - pad - right) / slots, name };
    });
    // Runs of muted notes: a run ends at an open strum, or where a muted string rings open again.
    const spans: [number, number][] = [];
    let run: [number, number] | null = null;
    let strings = new Set<number>();
    for (const b of laid) {
      const half = b.slotWidth / 2;
      const onsets = [...new Set(bars[b.index].events.map((e) => e.slot))].sort((p, q) => p - q);
      for (const slot of onsets) {
        const here = bars[b.index].events.filter((e) => e.slot === slot);
        const mutedHere = here.filter((e) => e.muted);
        const open = here.filter((e) => !e.muted).some((e) => !!e.strum || e.notes.some((n) => strings.has(n.string)));
        if (open && run) {
          spans.push(run);
          run = null;
        }
        if (mutedHere.length) {
          const x = slotX(b, slot);
          if (!run) run = [x - half, x + half];
          else run[1] = x + half;
          strings = new Set(mutedHere.flatMap((e) => e.notes.map((n) => n.string)));
        }
      }
    }
    if (run) spans.push(run);
    lines.push({
      top, staff, bars: laid, stemTop, stemEnd, arrow, chordName, mutedY,
      muted: spans.length ? spans : null,
    });
    y = stemEnd + 22;
  }
  return {
    width: m.labels + staffWidth, height: y - 16, slots, lines, end: input.loop ? 'repeat' : 'final',
    swing: input.swing, letRing: input.letRing, echo: input.echo, beats: input.beats, m,
  };
}

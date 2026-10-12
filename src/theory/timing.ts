// Timing rules for the player: tempo limits, swing, and which chord each bar plays.

export const MIN_BPM = 40;
export const MAX_BPM = 200;
export const DEFAULT_BPM = 80;

/** Turn whatever was typed into a usable tempo: a whole number between 40 and 200. */
export function clampBpm(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_BPM;
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(value)));
}

/**
 * Where a note lands with swing on: offbeat eighths ("and"s) are pushed late to
 * two-thirds of the beat, giving the long-short 2:1 feel. On-beat notes don't move.
 */
export function swingBeat(beat: number, swing: boolean): number {
  if (!swing) return beat;
  const whole = Math.floor(beat);
  return Math.abs(beat - whole - 0.5) < 1e-9 ? whole + 2 / 3 : beat;
}

/** Which chord a bar plays when each chord lasts `barsPerChord` bars, or null once the list is done. */
export function chordForBar(bar: number, chordCount: number, barsPerChord: number): number | null {
  const index = Math.floor(bar / Math.max(1, barsPerChord));
  return index < chordCount ? index : null;
}

// Which recorded sample plays a note, and how much to speed it up or slow it down.

/** The notes that have a recording: every third semitone from low E (MIDI 40) to Bb5 (82). */
export const SAMPLE_NOTES = Array.from({ length: 15 }, (_, i) => 40 + i * 3);

/** Pick the closest recorded note and the playback rate that retunes it to `midi`. */
export function nearestSample(midi: number, available: number[] = SAMPLE_NOTES): { sample: number; rate: number } {
  let sample = available[0];
  for (const m of available) if (Math.abs(m - midi) < Math.abs(sample - midi)) sample = m;
  return { sample, rate: 2 ** ((midi - sample) / 12) };
}

/**
 * Index of the first audible sample in a recording (MP3s often start with a few ms
 * of encoder silence), so playback can skip straight to the pluck.
 */
export function firstAudible(data: Float32Array, threshold: number): number {
  for (let i = 0; i < data.length; i++) if (Math.abs(data[i]) >= threshold) return i;
  return 0;
}

import { describe, expect, it } from 'vitest';
import { SAMPLE_NOTES, firstAudible, nearestSample } from '../src/sampleMap';
import { makeChord } from '../src/theory/chords';
import { parseFingering } from '../src/theory/fingering';
import { bestVoicing, fingeringToneLabels } from '../src/theory/voicings';

describe('sample mapping', () => {
  it('covers low E to Bb5 every third semitone', () => {
    expect(SAMPLE_NOTES).toHaveLength(15);
    expect(SAMPLE_NOTES[0]).toBe(40);
    expect(SAMPLE_NOTES.at(-1)).toBe(82);
  });

  it('plays a recorded note as is', () => {
    expect(nearestSample(40)).toEqual({ sample: 40, rate: 1 });
    expect(nearestSample(64)).toEqual({ sample: 64, rate: 1 });
  });

  it('retunes the closest sample by at most one semitone', () => {
    const up = nearestSample(41);
    expect(up.sample).toBe(40);
    expect(up.rate).toBeCloseTo(2 ** (1 / 12));
    const down = nearestSample(42);
    expect(down.sample).toBe(43);
    expect(down.rate).toBeCloseTo(2 ** (-1 / 12));
    for (let midi = 40; midi <= 82; midi++) {
      expect(Math.abs(nearestSample(midi).sample - midi)).toBeLessThanOrEqual(1);
    }
  });

  it('stretches the end samples for notes outside the range', () => {
    expect(nearestSample(38)).toMatchObject({ sample: 40 });
    expect(nearestSample(38).rate).toBeCloseTo(2 ** (-2 / 12));
    expect(nearestSample(86).sample).toBe(82);
  });

  it('finds where the sound starts', () => {
    const data = new Float32Array([0, 0.0001, -0.0002, 0.3, 0.5]);
    expect(firstAudible(data, 0.01)).toBe(3);
    expect(firstAudible(new Float32Array(4), 0.01)).toBe(0);
  });
});

describe('diagram labels and voicings', () => {
  it('labels each string of a shape by its chord tone', () => {
    const C = makeChord(0, 'maj');
    expect(fingeringToneLabels(C, parseFingering('x32010')!)).toEqual([null, 'R', '3', '5', 'R', '3']);
    const G7 = makeChord(7, '7');
    expect(fingeringToneLabels(G7, parseFingering('320001')!)).toEqual(['R', '3', '5', 'R', '3', 'b7']);
  });

  it('always picks the same shape for a chord, so the diagram matches what plays', () => {
    const Am = makeChord(9, 'min');
    expect(bestVoicing(Am)).toEqual(bestVoicing(Am));
    expect(bestVoicing(Am)).not.toBeNull();
  });
});

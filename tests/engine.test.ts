// The TypeScript engine against the reference engine's output (tests/golden/engine.json, from
// reference/theory/engine.js run with node on the same battery).
import { describe, expect, it } from 'vitest';
import golden from './golden/engine.json';
import { StyleName, afterIdeas, diatonicSet, starts } from '../src/theory/engine';

type GoldenKey = { tonic: number; mode: 'major' | 'minor'; name: string };

describe('engine port matches the reference', () => {
  for (const c of golden.cases as { key: GoldenKey; prog: string; at?: number; style?: StyleName; spice: boolean; ideas: unknown[] }[]) {
    const name = `${c.key.name} ${c.key.mode}: ${c.prog}${c.at != null ? ` at ${c.at}` : ''}${c.style ? ` (${c.style})` : ''} ${c.spice ? 'Spicy' : 'Natural'}`;
    it(name, () => {
      const opts: { spice: boolean; at?: number; style?: StyleName } = { spice: c.spice };
      if (c.at != null) opts.at = c.at;
      if (c.style) opts.style = c.style;
      const got = afterIdeas(c.prog.split(' '), c.key, opts).map((x) => ({
        chord: x.chord, numeral: x.numeral, lane: x.lane, tag: x.tag, why: x.why,
        then: x.then && { name: x.then.name, chords: x.then.chords, numerals: x.then.numerals, lanes: x.then.lanes, returnsHome: x.then.returnsHome },
      }));
      expect(got).toEqual(c.ideas);
    });
  }
  for (const s of golden.starts) {
    it(`starts in ${s.key.name} ${s.key.mode}`, () => {
      const item = (x: ReturnType<typeof starts>[number]['items'][number]) =>
        ({ name: x.name, chords: x.chords, numerals: x.numerals, lanes: x.lanes, repeat: x.repeat, tonic: x.tonic, style: x.style });
      const got = starts(s.key as GoldenKey).map((g) => ({ name: g.name, items: g.items.map(item), more: g.more.map(item) }));
      expect(got).toEqual(s.groups);
    });
  }
  for (const set of golden.sets as { key: GoldenKey; style: StyleName; chords: string[] }[]) {
    it(`diatonicSet in ${set.key.name} ${set.key.mode}, ${set.style}`, () => {
      expect(diatonicSet(set.key, set.style).map((c) => c.symbol)).toEqual(set.chords);
    });
  }
});

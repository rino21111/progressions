// The TypeScript engine against the reference engine's output (tests/golden/engine.json, from
// reference/theory/engine.js run with node on the same battery).
import { describe, expect, it } from 'vitest';
import golden from './golden/engine.json';
import { afterIdeas, starts } from '../src/theory/engine';

describe('engine port matches the reference', () => {
  for (const c of golden.cases) {
    const name = `${c.key.name} ${c.key.mode}: ${c.prog}${c.at != null ? ` at ${c.at}` : ''} ${c.spice ? 'Spicy' : 'Natural'}`;
    it(name, () => {
      const opts: { spice: boolean; at?: number } = { spice: c.spice };
      if (c.at != null) opts.at = c.at;
      const got = afterIdeas(c.prog.split(' '), c.key as { tonic: number; mode: 'major' | 'minor'; name: string }, opts).map((x) => ({
        chord: x.chord, numeral: x.numeral, lane: x.lane, tag: x.tag, why: x.why,
        then: x.then && { name: x.then.name, chords: x.then.chords, numerals: x.then.numerals, lanes: x.then.lanes, returnsHome: x.then.returnsHome },
      }));
      expect(got).toEqual(c.ideas);
    });
  }
  for (const s of golden.starts) {
    it(`starts in ${s.key.name} ${s.key.mode}`, () => {
      const got = starts(s.key as { tonic: number; mode: 'major' | 'minor'; name: string }).map((g) => ({
        name: g.name, items: g.items.map((x) => ({ name: x.name, chords: x.chords, numerals: x.numerals, lanes: x.lanes, repeat: x.repeat, tonic: x.tonic })),
      }));
      expect(got).toEqual(s.groups);
    });
  }
});

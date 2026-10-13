import { describe, expect, it } from 'vitest';
import { ideaTag } from '../src/theory/progressions';
import { CHORD_TEMPLATES, Chord, chordSymbol, makeChord } from '../src/theory/chords';
import { StyleName, afterIdeas, collapseRepeats, engineSymbol, ideaReason, keyChords, siteChord, starts, thenPhrase } from '../src/theory/ideas';
import * as engine from '../src/theory/engine';
import { showsReturn } from '../src/theory/progressionMap';
import { Key, chordSymbolInKey, keyName, romanNumeral } from '../src/theory/keys';
import { parseChordName } from '../src/theory/search';
import golden from './golden/engine.json';

const C: Key = { tonic: 0, mode: 'major' };
const Am: Key = { tonic: 9, mode: 'minor' };
const ch = (root: number, type: string) => makeChord(root, type);
const names = (list: Chord[], key: Key) => list.map((c) => chordSymbolInKey(c, key));

describe('tags', () => {
  it('names cadences and borrowed or secondary chords', () => {
    expect(ideaTag(ch(7, 'maj'), ch(0, 'maj'), C)).toBe('Authentic cadence');
    expect(ideaTag(ch(5, 'maj'), ch(0, 'maj'), C)).toBe('Plagal cadence');
    expect(ideaTag(ch(7, 'maj'), ch(9, 'min'), C)).toBe('Deceptive cadence');
    expect(ideaTag(ch(10, 'maj'), ch(0, 'maj'), C)).toBe('Backdoor');
    expect(ideaTag(ch(0, 'maj'), ch(5, 'min'), C)).toBe('From C minor');
    expect(ideaTag(ch(0, 'maj'), ch(4, '7'), C)).toBe('Leads to Am');
    expect(ideaTag(ch(4, '7'), ch(9, 'maj'), Am)).toBe('Picardy third');
    expect(ideaTag(ch(9, 'min'), ch(2, 'maj'), Am)).toBe('From A major');
    expect(ideaTag(ch(0, 'maj'), ch(5, 'maj'), C)).toBeNull();
  });
});


describe('after ideas and start with (site bridge to the engine)', () => {
  it('ideas come back as site chords, then lines with the return as the first chord played', () => {
    const prog = [ch(0, 'maj'), ch(7, 'maj'), ch(9, 'min'), ch(5, 'add9')];
    const natural = afterIdeas(prog, C, { spice: false });
    expect(natural.map((i) => chordSymbol(i.chord))).toEqual(['C', 'G', 'Dm']);
    const dm = natural[2];
    expect(names(dm.then!.chords, C)).toEqual(['G', 'C']);
    expect(dm.then!.returnsHome).toBe(true);
    expect(dm.then!.chords[1]).toBe(prog[0]);
    expect(names(thenPhrase(dm), C)).toEqual(['Dm', 'G']);
    const spicy = afterIdeas(prog, C, { spice: true });
    expect(names(spicy.map((i) => i.chord), C)).toEqual(['D7', 'F#dim7', 'Fm', 'A7']);
    expect(afterIdeas([], C, { spice: false })).toEqual([]);
  });
  it('the style control reaches the engine', () => {
    const prog = [ch(0, 'maj'), ch(7, 'maj'), ch(9, 'min'), ch(5, 'maj')];
    const at = (style: StyleName) => names(afterIdeas(prog, C, { spice: false, style }).map((i) => i.chord), C);
    expect(at('sevenths')).toEqual(['Cmaj7', 'G7', 'Dm7']);
    expect(at('triads')).toEqual(['C', 'G', 'Dm']);
    expect(at('ninths')).toEqual(['Cmaj9', 'G13', 'Dm9']);
    expect(at('add9')).toEqual(['Cadd9', 'Gadd9', 'Dm(add9)']);
  });
  it('the Key band follows the style', () => {
    expect(names(keyChords(C, 'ninths').map((d) => d.chord), C)).toEqual(['Cmaj9', 'Dm9', 'Em7', 'Fmaj9', 'G13', 'Am9', 'Bm7b5']);
    expect(keyChords(Am, 'triads').map((d) => d.borrowed)).toEqual([false, false, false, false, false, false, false, true]);
  });
  it('the title drops an "As in" that only repeats the tag', () => {
    const e = afterIdeas([ch(9, 'min'), ch(7, 'maj'), ch(5, 'maj')], Am, { spice: false })[0];
    expect(ideaReason(e)).toBe('Andalusian cadence. Turns back to Am at bar 4');
  });
  it('chords go to the engine with their own suffix (no slash) and come back as the same type', () => {
    expect(engineSymbol(makeChord(5, 'maj7', 9), C)).toBe('Fmaj7');
    expect(engineSymbol(ch(7, '9'), C)).toBe('G9');
    expect(engineSymbol(ch(2, 'm11'), C)).toBe('Dm11');
    expect(engineSymbol(ch(7, 'sus4'), C)).toBe('Gsus4');
    expect(engineSymbol(ch(6, 'dim7'), C)).toBe('F#dim7');
    expect(engineSymbol(ch(10, 'maj'), { tonic: 6, mode: 'major' })).toBe('A#');
  });
  it('every chord type on every root round-trips through the engine', () => {
    for (const key of [C, Am, { tonic: 6, mode: 'major' } as Key, { tonic: 1, mode: 'major' } as Key]) {
      for (const t of CHORD_TEMPLATES) {
        for (let root = 0; root < 12; root++) {
          const c = ch(root, t.id);
          const e = engine.parse(engineSymbol(c, key));
          expect(e.root).toBe(root);
          const back = siteChord(e.symbol);
          expect([back.root, back.template.id]).toEqual([root, t.id]);
        }
      }
    }
  });
  it('start entries: groups in display order, realized in the key, repeats written out', () => {
    const groups = starts(C);
    expect(groups.map((g) => g.name)).toEqual(['Classical and folk', 'Blues and rock', 'Jazz and soul', 'Bossa nova', 'Ballad and pop', 'Post-rock and cinematic', 'Flamenco']);
    const andalusian = groups[6].items[0];
    expect(groups.every((g) => g.items.length <= 4)).toBe(true);
    expect(groups.find((g) => g.name === 'Bossa nova')!.items.every((i) => i.style === 'ninths' || i.style === 'sevenths')).toBe(true);
    expect(names(andalusian.chords, andalusian.key)).toEqual(['Am', 'G', 'F', 'E']);
    expect(keyName(andalusian.key)).toBe('A minor');
    const blues = groups[1].items.find((i) => i.name === '12-bar blues')!;
    expect(names(blues.chords, C).join(' ')).toBe('C7 C7 C7 C7 F7 F7 C7 C7 G7 F7 C7 G7');
    expect(starts(Am)[0].name).toBe('Classical and folk');
  });
  it('repeats collapse into counts', () => {
    const blues = [0, 0, 0, 0, 5, 5, 0, 0, 7, 5, 0, 7].map((r) => ch(r, '7'));
    const cols = collapseRepeats(blues, (a, b) => a.root === b.root && a.template.id === b.template.id);
    expect(cols.map((c) => `${chordSymbol(c.chord)}x${c.count}`)).toEqual(['C7x4', 'F7x2', 'C7x2', 'G7x1', 'F7x1', 'C7x1', 'G7x1']);
  });
  it('with Loop on, the first chord always comes round again', () => {
    const prog = [ch(0, 'maj'), ch(7, 'maj')];
    expect(showsReturn(prog, true)).toBe(true);
    expect(showsReturn(prog, false)).toBe(false);
    expect(showsReturn([], true)).toBe(false);
  });
});

describe("the engine's spelling reaches the page", () => {
  const read = (symbols: string) => symbols.split(' ').map((x) => parseChordName(x)!);
  const root = (symbol: string) => /^[A-G][#b]?/.exec(symbol)![0];
  it('after Dm9 G13 in 9ths, Spicy offers G#dim7 (#v°7), leading to Am, not Abdim7', () => {
    const spicy = afterIdeas(read('Dm9 G13'), C, { spice: true, style: 'ninths' });
    const dim = spicy.find((i) => i.chord.template.id === 'dim7')!;
    expect(chordSymbolInKey(dim.chord, C)).toBe('G#dim7');
    expect(romanNumeral(dim.chord, C)).toBe('#v°7');
    expect(dim.numeral).toBe('#v°7');
  });
  it("suffixes keep the site's formatting", () => {
    const natural = afterIdeas(read('Cadd9 Gadd9 Am(add9) Fadd9'), C, { spice: false, style: 'add9' });
    const ii = natural.find((i) => i.chord.template.id === 'madd9')!;
    expect([chordSymbolInKey(ii.chord, C), ii.numeral]).toEqual(['Dm(add9)', 'ii(add9)']);
  });
  it('every engine symbol keeps its letter and accidental on the site (ideas, then lines, starts)', () => {
    type G = { key: { tonic: number; mode: 'major' | 'minor' }; prog: string; at?: number; style?: StyleName; spice: boolean;
      ideas: { chord: string; then: { chords: string[]; returnsHome: boolean } | null }[] };
    for (const c of (golden.cases as G[]).filter((x) => x.at == null)) {
      const key: Key = { tonic: c.key.tonic, mode: c.key.mode };
      const got = afterIdeas(read(c.prog), key, { spice: c.spice, style: c.style });
      expect(got.map((i) => root(chordSymbolInKey(i.chord, key)))).toEqual(c.ideas.map((i) => root(i.chord)));
      got.forEach((i, n) => {
        const want = c.ideas[n].then;
        if (!want) return expect(i.then).toBeNull();
        const shown = i.then!.chords.map((x) => root(chordSymbolInKey(x, key)));
        // a returning last chord is the user's own chord, as played
        const upTo = want.returnsHome ? -1 : undefined;
        expect(shown.slice(0, upTo)).toEqual(want.chords.map(root).slice(0, upTo));
      });
    }
    for (const s of golden.starts) {
      const key: Key = { tonic: s.key.tonic, mode: s.key.mode as Key['mode'] };
      const groups = starts(key);
      s.groups.forEach((g, gi) => {
        [...g.items, ...g.more].forEach((it, ii) => {
          const site = [...groups[gi].items, ...groups[gi].more][ii];
          // repeated bars share one chord, so each written chord appears once here
          const written = site.chords.filter((c, i) => i === 0 || c !== site.chords[i - 1]);
          expect(written.map((c) => root(chordSymbolInKey(c, site.key)))).toEqual(it.chords.map(root));
        });
      });
    }
  });
});

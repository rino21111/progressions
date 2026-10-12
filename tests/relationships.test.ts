import { describe, expect, it } from 'vitest';
import { ideaTag } from '../src/theory/progressions';
import { Chord, chordSymbol, makeChord } from '../src/theory/chords';
import { afterIdeas, collapseRepeats, engineSymbol, ideaReason, starts, thenPhrase } from '../src/theory/ideas';
import { showsReturn } from '../src/theory/progressionMap';
import { Key, chordSymbolInKey, keyName } from '../src/theory/keys';

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
  it('the Triads / 7th chords toggle reaches the engine', () => {
    const prog = [ch(0, 'maj'), ch(7, 'maj'), ch(9, 'min'), ch(5, 'maj')];
    expect(names(afterIdeas(prog, C, { spice: false, sevenths: true }).map((i) => i.chord), C)).toEqual(['Cmaj7', 'G7', 'Dm7']);
    expect(names(afterIdeas(prog, C, { spice: false, sevenths: false }).map((i) => i.chord), C)).toEqual(['C', 'G', 'Dm']);
  });
  it('the title drops an "As in" that only repeats the tag', () => {
    const e = afterIdeas([ch(9, 'min'), ch(7, 'maj'), ch(5, 'maj')], Am, { spice: false })[0];
    expect(ideaReason(e)).toBe('Andalusian cadence. Turns back to Am at bar 4');
  });
  it('the engine reads slash, sus and extended chords as the chord they colour', () => {
    expect(engineSymbol(makeChord(5, 'maj7', 9), C)).toBe('Fmaj7');
    expect(engineSymbol(ch(7, '9'), C)).toBe('G7');
    expect(engineSymbol(ch(2, 'm11'), C)).toBe('Dm7');
    expect(engineSymbol(ch(7, 'sus4'), C)).toBe('G');
    expect(engineSymbol(ch(6, 'dim7'), C)).toBe('F#dim7');
    expect(engineSymbol(ch(10, 'maj'), { tonic: 6, mode: 'major' })).toBe('A#');
  });
  it('start entries: groups in display order, realized in the key, repeats written out', () => {
    const groups = starts(C);
    expect(groups.map((g) => g.name)).toEqual(['Classical and folk', 'Blues and rock', 'Jazz and soul', 'Ballad and pop', 'Flamenco']);
    const andalusian = groups[4].items[0];
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

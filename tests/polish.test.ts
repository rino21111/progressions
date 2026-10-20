// Polish: one spelling for a chord across the site, one numeral format, rare roots made plain, and
// the reason filter matching the heading's chord by degree.
import { describe, expect, it } from 'vitest';
import { Key, chordSymbolInKey, numeralLabel } from '../src/theory/keys';
import { parseChordName } from '../src/theory/search';
import { makeChord } from '../src/theory/chords';
import { AfterIdea, ideaWhy } from '../src/theory/ideas';

const key = (tonic: number, mode: Key['mode']): Key => ({ tonic, mode });

describe('polish', () => {
  it('chords are spelled for the key (the rail uses this too): Db in Ab, D#m in F#', () => {
    expect(chordSymbolInKey(makeChord(1, 'maj'), key(8, 'major'))).toBe('Db');
    expect(chordSymbolInKey(makeChord(3, 'min'), key(6, 'major'))).toBe('D#m');
    expect(chordSymbolInKey(makeChord(10, 'maj'), key(0, 'major'))).toBe('Bb');
  });
  it('rare roots are shown as their plain enharmonic', () => {
    expect(chordSymbolInKey({ ...makeChord(4, 'maj'), spelling: 'Fb' }, key(8, 'major'))).toBe('E');
    expect(chordSymbolInKey({ ...makeChord(0, 'dim7'), spelling: 'B#' }, key(6, 'major'))).toBe('Cdim7');
    expect(chordSymbolInKey(makeChord(5, 'dim'), key(6, 'major'))).toBe('Fdim');
    expect(chordSymbolInKey(makeChord(11, 'maj'), key(6, 'major'))).toBe('B');
  });
  it('numerals: the degree and only a seventh-type mark', () => {
    const cases: [string, string][] = [
      ['Iadd9', 'I'], ['ii(add9)', 'ii'], ['Vsus4', 'V'], ['vi7', 'vi7'], ['ii9', 'ii7'], ['V13', 'V7'],
      ['Imaj7', 'Imaj7'], ['VI7b9', 'VI7'], ['bII7#11', 'bII7'], ['I6/9', 'I'], ['vii°', 'vii°'], ['#i°7', '#i°7'],
      ['iiø7', 'iiø7'], ['bVI', 'bVI'], ['III+', 'III+'], ['i(maj7)', 'imaj7'], ['V7sus4', 'V7'],
    ];
    for (const [from, to] of cases) expect(numeralLabel(from)).toBe(to);
  });
  it('"Common after" the heading\'s chord is dropped however the engine writes it (III for III7)', () => {
    const idea: AfterIdea = { chord: parseChordName('Am')!, numeral: 'vi', lane: 'T', tag: null, why: 'E7 resolves to Am; Common after III', then: null };
    expect(ideaWhy(idea, { after: 'III7', progression: 'I–III7', thenRoot: null })).toBe('E7 resolves to Am');
    expect(ideaWhy(idea, { after: 'V7', progression: 'I–V7', thenRoot: null })).toBe('E7 resolves to Am. Common after III');
  });
});

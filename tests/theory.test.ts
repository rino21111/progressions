import { describe, expect, it } from 'vitest';
import { chordSymbol, chordTones, makeChord } from '../src/theory/chords';
import { detectCagedShape } from '../src/theory/caged';
import { analyzeFingering, formatFingering, parseFingering } from '../src/theory/fingering';
import { chordSymbolInKey, diatonicChords, keyName, rankKeys, romanNumeral, scaleNoteNames } from '../src/theory/keys';
import { findVoicings } from '../src/theory/voicings';

const name = (shape: string) => {
  const result = analyzeFingering(parseFingering(shape)!);
  return result.matches[0] ? chordSymbol(result.matches[0]) : null;
};

describe('chord detection', () => {
  const cases: [string, string][] = [
    ['x32010', 'C'],
    ['320003', 'G'],
    ['320033', 'G'],
    ['xx0232', 'D'],
    ['x02220', 'A'],
    ['022100', 'E'],
    ['133211', 'F'],
    ['x24442', 'B'],
    ['x35553', 'C'],
    ['x02210', 'Am'],
    ['022000', 'Em'],
    ['xx0231', 'Dm'],
    ['x24432', 'Bm'],
    ['x02010', 'Am7'],
    ['020100', 'E7'],
    ['x32310', 'C7'],
    ['xx0212', 'D7'],
    ['x02120', 'Amaj7'],
    ['xx3210', 'Fmaj7'],
    ['x32000', 'Cmaj7'],
    ['032010', 'C/E'],
    ['xx0233', 'Dsus4'],
    ['xx0230', 'Dsus2'],
    ['x02200', 'Asus2'],
    ['x32030', 'Cadd9'],
    ['x2323x', 'Bm7b5'],
    ['x3424x', 'Cdim7'],
    ['x7678x', 'E7#9'],
    ['x32210', 'Am/C'],
    ['x3221x', 'Am/C'],
    ['320000', 'G6'],
    ['x355xx', 'C5'],
    ['8-10-10-9-8-8', 'C'],
    ['xx0202', 'D6'],
    ['xx0222', 'Dmaj7'],
  ];
  for (const [shape, expected] of cases) {
    it(`${shape} is ${expected}`, () => expect(name(shape)).toBe(expected));
  }

  it('names the interval for two notes', () => {
    const r = analyzeFingering(parseFingering('x32xxx')!);
    expect(r.interval?.name).toBe('Major 3rd');
  });

  it('labels and spells chord tones', () => {
    const tones = chordTones(makeChord(3, 'm7b5')); // Ebm7b5
    expect(tones.map((t) => `${t.name}:${t.label}`)).toEqual(['Eb:R', 'Gb:b3', 'Bbb:b5', 'Db:b7']);
    expect(chordTones(makeChord(6, 'maj')).map((t) => t.name)).toEqual(['F#', 'A#', 'C#']);
  });

  it('parses and formats fingerings', () => {
    expect(parseFingering('x-3-5-5-5-3')).toEqual([null, 3, 5, 5, 5, 3]);
    expect(formatFingering([null, 3, 2, 0, 1, 0])).toBe('x32010');
    expect(formatFingering([8, 10, 10, 9, 8, 8])).toBe('8-10-10-9-8-8');
    expect(parseFingering('x3201')).toBeNull();
  });
});

describe('CAGED shapes', () => {
  const shape = (s: string, root: number) => detectCagedShape(parseFingering(s)!, root);
  it('recognises the open shapes', () => {
    expect(shape('x32010', 0)?.description).toBe('Open C shape');
    expect(shape('320003', 7)?.description).toBe('Open G shape');
    expect(shape('xx0232', 2)?.description).toBe('Open D shape');
  });
  it('recognises barre chords', () => {
    expect(shape('133211', 5)).toMatchObject({ form: 'E', position: 1 });
    expect(shape('x35553', 0)).toMatchObject({ form: 'A', position: 3 });
    expect(shape('577655', 9)).toMatchObject({ form: 'E', position: 5 });
    expect(shape('x-6-8-8-8-6', 3)).toMatchObject({ form: 'A', position: 6 });
    expect(shape('12-14-14-13-12-12', 4)).toMatchObject({ form: 'E', position: 12 });
  });
  it('recognises minor and seventh barre shapes', () => {
    expect(shape('x24432', 11)).toMatchObject({ form: 'A', position: 2 });
    expect(shape('575555', 9)).toMatchObject({ form: 'E', position: 5 });
  });
});

describe('voicings', () => {
  const top = (root: number, id: string) => formatFingering(findVoicings(makeChord(root, id), 1)[0].fingering);
  it('finds the usual open chords', () => {
    expect(top(0, 'maj')).toBe('x32010');
    expect(top(4, 'maj')).toBe('022100');
    expect(top(9, 'min')).toBe('x02210');
    expect(top(2, 'maj')).toBe('xx0232');
  });
  it('finds a playable voicing for every chord type and root', () => {
    for (let root = 0; root < 12; root++) {
      for (const id of ['maj', 'min', '7', 'maj7', 'm7', 'sus4', 'dim', 'm7b5', 'dim7', 'add9', '9']) {
        const voicings = findVoicings(makeChord(root, id), 3);
        expect(voicings.length, `${root} ${id}`).toBeGreaterThan(0);
        for (const v of voicings) {
          const best = analyzeFingering(v.fingering).matches[0];
          expect(best && best.root === root, `${formatFingering(v.fingering)} for ${root} ${id}`).toBe(true);
        }
      }
    }
  });
});

describe('keys', () => {
  it('spells scales', () => {
    expect(scaleNoteNames({ tonic: 5, mode: 'major' })).toEqual(['F', 'G', 'A', 'Bb', 'C', 'D', 'E']);
    expect(scaleNoteNames({ tonic: 6, mode: 'major' })).toEqual(['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#']);
    expect(scaleNoteNames({ tonic: 9, mode: 'minor' })).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
  });

  it('builds diatonic chords with numerals', () => {
    const g = diatonicChords({ tonic: 7, mode: 'major' });
    expect(g.map((d) => `${d.numeral}:${d.symbol}`)).toEqual([
      'I:G', 'ii:Am', 'iii:Bm', 'IV:C', 'V:D', 'vi:Em', 'vii°:F#dim',
    ]);
    const am7 = diatonicChords({ tonic: 9, mode: 'minor' }, true);
    expect(am7.map((d) => d.numeral)).toEqual(['i7', 'iiø7', 'IIImaj7', 'iv7', 'v7', 'VImaj7', 'VII7', 'V7']);
  });

  it('names borrowed chords', () => {
    const c = { tonic: 0, mode: 'major' as const };
    expect(romanNumeral(makeChord(10, 'maj'), c)).toBe('bVII');
    expect(chordSymbolInKey(makeChord(10, 'maj'), c)).toBe('Bb');
    expect(chordSymbolInKey(makeChord(8, 'maj'), { tonic: 9, mode: 'minor' })).toBe('G#');
  });

  it('works out the key from chords', () => {
    const chords = [makeChord(0, 'maj'), makeChord(7, 'maj'), makeChord(9, 'min'), makeChord(5, 'maj')];
    expect(keyName(rankKeys(chords)[0].key)).toBe('C major');
    const minor = [makeChord(9, 'min'), makeChord(2, 'min'), makeChord(4, 'maj')];
    expect(keyName(rankKeys(minor)[0].key)).toBe('A minor');
    expect(keyName(rankKeys([makeChord(4, 'min')])[0].key)).toBe('E minor');
    expect(keyName(rankKeys([makeChord(2, 'maj')])[0].key)).toBe('D major');
  });
});

describe('all chord tones on the neck', () => {
  it('include open strings whose open note is a chord tone, but not where the shape already plays', async () => {
    const { chordTonePositions } = await import('../src/theory/voicings');
    const { makeChord } = await import('../src/theory/chords');
    const { parseFingering } = await import('../src/theory/fingering');
    const dm = makeChord(2, 'min');
    const open = chordTonePositions(dm, parseFingering('xx0231')!).filter((p) => p.fret === 0).map((p) => p.string);
    expect(open).toEqual([1]); // open A (the 5th); open D is already played
    const c = chordTonePositions(makeChord(0, 'maj'), parseFingering('x32010')!).filter((p) => p.fret === 0).map((p) => p.string);
    expect(c).toEqual([0]); // low E (the 3rd); open G and high E are already played
  });
});

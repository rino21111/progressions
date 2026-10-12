import { describe, expect, it } from 'vitest';
import { bassPc, chordLane, columnTones, heldTones, laneInfo, mapRows, monotonePath, progressionLanes, showsStrip } from '../src/theory/progressionMap';
import { makeChord } from '../src/theory/chords';
import { parseFingering } from '../src/theory/fingering';
import { bestVoicing } from '../src/theory/voicings';
import { Key } from '../src/theory/keys';

const C: Key = { tonic: 0, mode: 'major' };
const Am: Key = { tonic: 9, mode: 'minor' };
const col = (root: number, type: string, _key?: Key | null, shape?: string) => {
  const chord = makeChord(root, type);
  return columnTones(chord, shape ? parseFingering(shape)! : bestVoicing(chord));
};
const names = (rows: { name: string }[]) => rows.map((r) => r.name);

describe('shared notes map: rows', () => {
  it('a major key: its seven notes, tonic at the bottom', () => {
    expect(names(mapRows([col(0, 'maj', C), col(7, 'maj', C)], C))).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
  });

  it('a minor key counts the raised 7th (G#) as in the key', () => {
    const rows = mapRows([col(9, 'min', Am), col(4, '7', Am)], Am);
    expect(names(rows)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'G#']);
    expect(rows.find((r) => r.name === 'G#')!.chromatic).toBe(false);
  });

  it('adds other notes in pitch order, spelled as the chord spells them, marked chromatic', () => {
    const rows = mapRows([col(0, 'maj', C), col(9, '7', C)], C);
    expect(names(rows)).toEqual(['C', 'C#', 'D', 'E', 'F', 'G', 'A', 'B']);
    expect(rows[1].chromatic).toBe(true);
  });

  it('with no key: just the notes used, up from the first chord root, none chromatic', () => {
    const rows = mapRows([col(2, 'min', null), col(7, 'maj', null)], null);
    expect(names(rows)).toEqual(['D', 'F', 'G', 'A', 'B']);
    expect(rows.every((r) => !r.chromatic)).toBe(true);
  });
});

describe('shared notes map: columns and held notes', () => {
  it("a column is what the shape sounds: G7 3x34xx has no 5th", () => {
    const tones = col(7, '7', C, '3x34xx');
    expect(tones.map((t) => t.label).sort()).toEqual(['3', 'R', 'b7']);
  });

  it('held notes are the pitch classes shared by neighbours', () => {
    const cols = [col(0, 'maj', C, 'x32010'), col(9, 'min', C, 'x02210'), col(2, 'm7', C, 'xx0211')];
    const held = heldTones(cols);
    expect(held[0]).toEqual([]);
    expect([...held[1]].sort((a, b) => a - b)).toEqual([0, 4]); // C and E
    expect([...held[2]].sort((a, b) => a - b)).toEqual([0, 9]); // C and A
  });
});

describe('harmonic function lanes', () => {
  const ch = (root: number, type: string, bass = root) => makeChord(root, type, bass);
  /** Lanes for a progression of [root, type] pairs (the last looks at the first). */
  const lanes = (key: Key, ...list: [number, string, number?][]) => progressionLanes(list.map(([r, t, b]) => ch(r, t, b ?? r)), key);

  it('I vi ii V and iii in major', () => {
    expect(lanes(C, [0, 'maj'], [9, 'min'], [2, 'min'], [7, 'maj'])).toEqual(['T', 'T', 'PD', 'D']);
    expect(chordLane(ch(4, 'min'), C)).toBe('T');
  });

  it('wraps from the last chord to the first', () => {
    // bVII is dominant only when the next chord is I; the last bVII looks at the first chord.
    expect(lanes(C, [0, 'maj'], [10, 'maj'])).toEqual(['T', 'D']);
  });

  it('I7 is tonic in a blues, but V7/IV right before IV; a Picardy I in minor likewise', () => {
    expect(lanes(C, [0, '7'], [0, '7'], [0, '7'], [0, '7'], [5, '7'])).toEqual(['T', 'T', 'T', 'D', 'PD']);
    expect(chordLane(ch(9, 'maj'), Am, ch(2, 'min'))).toBe('D');
    expect(chordLane(ch(9, 'maj'), Am, ch(4, 'maj'))).toBe('T');
  });

  it('bVII: backdoor dominant into I, otherwise predominant; minor VII into i or III is dominant', () => {
    expect(chordLane(ch(10, '7'), C, ch(0, 'maj'))).toBe('D');
    expect(chordLane(ch(10, 'maj'), C, ch(5, 'maj'))).toBe('PD');
    expect(chordLane(ch(7, 'maj'), Am, ch(9, 'min'))).toBe('D');
    expect(chordLane(ch(7, 'maj'), Am, ch(0, 'maj'))).toBe('D');
    expect(chordLane(ch(7, 'maj'), Am, ch(2, 'min'))).toBe('PD');
  });

  it('II is V/V only before V; otherwise Lydian II (predominant)', () => {
    expect(chordLane(ch(2, '7'), C, ch(7, 'maj'))).toBe('D');
    expect(chordLane(ch(2, 'maj'), C, ch(5, 'maj'))).toBe('PD');
  });

  it('secondary dominants and other outside dominant 7ths are dominant', () => {
    expect(chordLane(ch(9, '7'), C, ch(2, 'min'))).toBe('D'); // VI7 = V7/ii
    expect(chordLane(ch(4, 'maj'), C, ch(9, 'min'))).toBe('D'); // III = V/vi
    expect(chordLane(ch(1, '7'), C, ch(0, 'maj'))).toBe('D'); // bII7 tritone sub
    expect(chordLane(ch(8, '7'), C, ch(7, 'maj'))).toBe('D'); // bVI7
    expect(chordLane(ch(0, '7'), Am, ch(5, 'maj'))).toBe('D'); // III7 in minor
  });

  it('a related ii (outside m7 or ø7 before a dominant 7th a 4th up) is predominant', () => {
    expect(chordLane(ch(11, 'm7'), C, ch(4, '7'))).toBe('PD'); // Bm7 E7 in C
    expect(chordLane(ch(2, 'm7'), C, ch(7, '7'))).toBe('PD'); // diatonic ii keeps its lane
  });

  it('bVII7, iv and minor V', () => {
    expect(chordLane(ch(5, 'min'), C)).toBe('PD');
    expect(chordLane(ch(4, 'maj'), Am)).toBe('D');
    expect(chordLane(ch(9, 'min'), Am)).toBe('T');
  });

  it('augmented triads take the major triad’s lane; III+ is V+/vi', () => {
    expect(chordLane(ch(7, 'aug'), C)).toBe('D');
    expect(chordLane(ch(0, 'aug'), C)).toBe('T');
    expect(chordLane(ch(4, 'aug'), C)).toBe('D');
  });

  it('diminished 7ths: common-tone takes the next lane; a leading-tone one is dominant', () => {
    expect(chordLane(ch(0, 'dim7'), C, ch(0, 'maj'))).toBe('T'); // Cdim7 → C
    expect(chordLane(ch(1, 'dim7'), C, ch(2, 'min'))).toBe('D'); // C#dim7 → Dm
  });

  it('slash chords: cadential 6/4, IV/5 and ii/5 are dominant; other inversions keep their lane', () => {
    expect(chordLane(ch(0, 'maj', 7), C, ch(7, '7'))).toBe('D'); // C/G → G7
    expect(chordLane(ch(5, 'maj', 7), C, ch(0, 'maj'))).toBe('D'); // F/G
    expect(chordLane(ch(2, 'min', 7), C, ch(0, 'maj'))).toBe('D'); // Dm/G
    expect(chordLane(ch(0, 'maj', 4), C, ch(5, 'maj'))).toBe('T'); // C/E
    expect(chordLane(ch(7, 'sus4'), C)).toBe('D');
  });

  it('no key: no lanes', () => {
    expect(chordLane(makeChord(0, 'maj'), null)).toBe('none');
  });
});

describe('chromatic rows', () => {
  const chromatic = (root: number, type: string, key: Key = C) =>
    mapRows([col(0, 'maj'), col(root, type)], key).filter((r) => r.chromatic).map((r) => r.name);
  it('are spelled as the chord spells them', () => {
    expect(chromatic(4, '7')).toEqual(['G#']); // E7
    expect(chromatic(11, '7')).toEqual(['D#', 'F#']); // B7
    expect(chromatic(2, '7')).toEqual(['F#']); // D7
    expect(chromatic(5, 'min')).toEqual(['Ab']); // Fm
    expect(chromatic(10, '7')).toEqual(['Ab', 'Bb']); // Bb7
  });
  it('when two chords spell a note differently, the first card wins; no double accidentals', () => {
    const rows = mapRows([col(4, '7'), col(5, 'min')], C); // G# from E7, then Ab from Fm
    expect(rows.filter((r) => r.chromatic).map((r) => r.name)).toEqual(['G#']);
    expect(mapRows([col(3, 'dim7')], C).every((r) => !/##|bb/.test(r.name.slice(1)))).toBe(true);
  });

  it("in minor, amber exactly where the numerals call it outside the key: G# isn't, F# is", () => {
    const rows = mapRows([col(9, 'min'), col(4, '7'), col(2, '7')], Am);
    expect(rows.find((r) => r.name === 'G#')!.chromatic).toBe(false);
    expect(rows.find((r) => r.name === 'F#')!.chromatic).toBe(true);
  });
});

describe('the bass', () => {
  it('is the lowest sounding note, open strings included and muted strings skipped', () => {
    expect(bassPc(parseFingering('022100'))).toBe(4); // open low E
    expect(bassPc(parseFingering('x32010'))).toBe(0); // C
    expect(bassPc(parseFingering('332010'))).toBe(7); // C/G
    expect(bassPc(parseFingering('x20033'))).toBe(11); // G/B
    expect(bassPc(parseFingering('xxxxxx'))).toBeNull();
  });
  it('marks that note in the column', () => {
    const tones = columnTones(makeChord(7, 'maj', 11), parseFingering('x20033'));
    expect(tones.filter((t) => t.bass).map((t) => t.name)).toEqual(['B']);
  });
});

describe('why each chord got its lane', () => {
  const ch = (root: number, type: string, bass = root) => makeChord(root, type, bass);
  const why = (chord: ReturnType<typeof ch>, next?: ReturnType<typeof ch>, key: Key = C) => laneInfo(chord, key, next).reason;
  it('plain table lanes', () => {
    expect(why(ch(9, 'min'), ch(5, 'maj'))).toBe('vi, tonic');
    expect(why(ch(5, 'maj'), ch(7, 'maj'))).toBe('IV, predominant');
    expect(why(ch(7, '7'), ch(9, 'min'))).toBe('V7, dominant');
  });
  it('a dominant going home', () => {
    expect(why(ch(7, '7'), ch(0, 'maj'))).toBe('V7, resolves to C');
  });
  it('secondary dominants and leading-tone chords', () => {
    expect(why(ch(9, '7'), ch(2, 'm7'))).toBe('V7 of ii, resolves to Dm7');
    expect(why(ch(9, '7'), ch(5, 'maj'))).toBe('V7 of ii');
    expect(why(ch(6, 'dim'), ch(7, 'maj'))).toBe('vii° of V');
  });
  it('backdoor, Aeolian and passing bVII', () => {
    expect(why(ch(10, 'maj'), ch(0, 'maj'))).toBe('bVII, backdoor to C');
    expect(why(ch(7, 'maj'), ch(9, 'min'), Am)).toBe('VII, resolves to Am');
    expect(why(ch(10, 'maj'), ch(5, 'maj'))).toBe('bVII, predominant');
  });
  it('blues I7', () => {
    expect(why(ch(0, '7'), ch(5, '7'))).toBe('I7, V7 of IV here');
    expect(why(ch(0, '7'), ch(0, '7'))).toBe('I7, tonic');
  });
  it('Lydian II and V of V', () => {
    expect(why(ch(2, 'maj'), ch(5, 'maj'))).toBe('II, predominant');
    expect(why(ch(2, '7'), ch(7, 'maj'))).toBe('II7, V7 of V');
  });
  it('related ii', () => {
    expect(why(ch(11, 'm7'), ch(4, '7'))).toBe('ii of E7');
  });
  it('diminished 7ths', () => {
    expect(why(ch(0, 'dim7'), ch(0, 'maj'))).toBe('dim7, decorates C');
    expect(why(ch(1, 'dim7'), ch(2, 'm7'))).toBe('dim7, leads to Dm7');
  });
  it('slash chords', () => {
    expect(why(ch(0, 'maj', 7), ch(7, '7'))).toBe('I/5, cadential 6/4 before G7');
    expect(why(ch(5, 'maj', 7), ch(0, 'maj'))).toBe('IV/5, dominant');
  });
  it('augmented chords read as their major triad', () => {
    expect(why(ch(7, 'aug'), ch(9, 'min'))).toBe('V+, dominant');
  });
});

describe('the function strip', () => {
  it('shows only when at least two chords have a function', () => {
    expect(showsStrip(['T', 'none', 'none'])).toBe(false);
    expect(showsStrip(['T', 'none', 'D'])).toBe(true);
  });
});

describe('the function curve', () => {
  it('never leaves the band between neighbouring nodes', () => {
    const pts = [{ x: 0, y: 7 }, { x: 40, y: 35 }, { x: 80, y: 21 }, { x: 120, y: 35 }, { x: 160, y: 35 }, { x: 200, y: 7 }];
    const d = monotonePath(pts);
    const segs = [...d.matchAll(/C([-\d.]+),([-\d.]+) ([-\d.]+),([-\d.]+) ([-\d.]+),([-\d.]+)/g)].map((m) => m.slice(1).map(Number));
    expect(segs).toHaveLength(pts.length - 1);
    segs.forEach((s, i) => {
      const y0 = pts[i].y;
      const [, y1, , y2, , y3] = s;
      const lo = Math.min(y0, y3) - 1e-9;
      const hi = Math.max(y0, y3) + 1e-9;
      for (let t = 0; t <= 1; t += 0.05) {
        const y = (1 - t) ** 3 * y0 + 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t ** 2 * y2 + t ** 3 * y3;
        expect(y).toBeGreaterThanOrEqual(lo);
        expect(y).toBeLessThanOrEqual(hi);
      }
    });
  });
});

import { describe, expect, it } from 'vitest';
import { Fingering, parseFingering, soundingNotes } from '../src/theory/fingering';
import { BeatsPerBar, PLAY_STYLES, PlayStyle, patternEvents } from '../src/theory/patterns';
import { TabBar, rhythm, tabBars } from '../src/theory/tab';
import { layoutTab } from '../src/ui/tabLayout';

const shapes = ['x32010', '320003', 'x02210', '133211'].map((f) => parseFingering(f)!);
const names = ['C', 'G', 'Am', 'F'];

/** What the scheduler plays for one pass, as (bar, beat, string, fret) rows. */
function scheduled(fingerings: Fingering[], style: PlayStyle, variant: string, beats: BeatsPerBar, barsPerChord: number, passes = 1) {
  const rows: string[] = [];
  const total = fingerings.length * barsPerChord * passes;
  for (let bar = 0; bar < total; bar++) {
    const notes = soundingNotes(fingerings[Math.floor((bar % (fingerings.length * barsPerChord)) / barsPerChord)]);
    for (const e of patternEvents(style, variant, notes, beats, bar)) {
      for (const m of e.midis) {
        const n = notes.find((x) => x.midi === m)!;
        rows.push(`${bar} ${e.beat} ${n.string}/${n.fret}`);
      }
    }
  }
  return rows.sort();
}
const written = (bars: TabBar[]) =>
  bars.flatMap((b, bar) => b.events.flatMap((e) => e.notes.map((n) => `${bar} ${e.slot / 2} ${n.string}/${n.fret}`))).sort();

describe('tab notes are the scheduler\'s notes', () => {
  for (const style of PLAY_STYLES) {
    for (const v of style.variants) {
      it(`${style.label} ${v.label} on C G Am F`, () => {
        expect(written(tabBars(shapes, { style: style.id, variant: v.id, beats: 4, barsPerChord: 1 }))).toEqual(scheduled(shapes, style.id, v.id, 4, 1));
      });
    }
  }
  it('in 3/4 and with 2 bars per chord', () => {
    for (const style of PLAY_STYLES) for (const v of style.variants) {
      expect(written(tabBars(shapes, { style: style.id, variant: v.id, beats: 3, barsPerChord: 1 }))).toEqual(scheduled(shapes, style.id, v.id, 3, 1));
      expect(written(tabBars(shapes, { style: style.id, variant: v.id, beats: 4, barsPerChord: 2 }))).toEqual(scheduled(shapes, style.id, v.id, 4, 2));
    }
  });
  it('Bossa Two-bar over an odd number of bars writes two passes, as the player alternates across the loop', () => {
    const three = shapes.slice(0, 3);
    const bars = tabBars(three, { style: 'bossa', variant: 'twobar', beats: 4, barsPerChord: 1 });
    expect(bars.map((b) => b.chord)).toEqual([0, 1, 2, 0, 1, 2]);
    expect(written(bars)).toEqual(scheduled(three, 'bossa', 'twobar', 4, 1, 2));
    expect(tabBars(shapes, { style: 'bossa', variant: 'twobar', beats: 4, barsPerChord: 1 })).toHaveLength(4);
  });
});

describe('tab marks', () => {
  it('a strum over strings already written in the bar is faded; the first is not', () => {
    const [c] = tabBars(shapes, { style: 'strum', variant: 'folk', beats: 4, barsPerChord: 1 });
    expect(c.events.map((e) => `${e.strum}${e.faded ? '-faded' : ''}`)).toEqual(['down', 'down-faded', 'up-faded', 'up-faded', 'down-faded', 'up-faded']);
  });
  it('rolls, short strums and palm-muted thumbs are flagged', () => {
    expect(tabBars(shapes, { style: 'arpeggio', variant: 'roll', beats: 4, barsPerChord: 1 })[0].events.every((e) => e.roll)).toBe(true);
    expect(tabBars(shapes, { style: 'strum', variant: 'rock', beats: 4, barsPerChord: 1 })[0].events.every((e) => e.short)).toBe(true);
    const muted = tabBars(shapes, { style: 'travis', variant: 'muted', beats: 4, barsPerChord: 1 })[0].events;
    expect(muted.filter((e) => e.muted).map((e) => e.slot)).toEqual([0, 2, 4, 6]);
  });
});

describe('tab layout', () => {
  const lay = (bars: TabBar[], extra: Partial<Parameters<typeof layoutTab>[0]> = {}) =>
    layoutTab({ bars, names, beats: 4, width: 1000, phone: false, loop: true, swing: false, letRing: true, ...extra });
  it('chord names only where the chord changes and at the start of each line', () => {
    const bars = tabBars(shapes, { style: 'travis', variant: 'basic', beats: 4, barsPerChord: 2 });
    const L = lay(bars);
    expect(L.lines.map((l) => l.bars.map((b) => b.name))).toEqual([['C', null, 'G', null], ['Am', null, 'F', null]]);
    const narrow = lay(bars, { width: 500 });
    expect(narrow.lines.map((l) => l.bars.map((b) => b.name))).toEqual([['C', null], ['G', null], ['Am', null], ['F', null]]);
  });
  it('4 bars a line from 640px, 2 below, fewer when two-digit frets don\'t fit', () => {
    const bars = tabBars(shapes, { style: 'travis', variant: 'basic', beats: 4, barsPerChord: 1 });
    expect(lay(bars, { width: 640 }).lines[0].bars).toHaveLength(4);
    expect(lay(bars, { width: 600 }).lines[0].bars).toHaveLength(2);
    const high = tabBars(['x-10-12-12-12-10', '8-10-10-9-8-8', 'x-12-14-14-13-12', '13-15-15-14-13-13'].map((f) => parseFingering(f)!), { style: 'arpeggio', variant: 'updown', beats: 4, barsPerChord: 1 });
    expect(lay(high, { width: 640 }).lines[0].bars.length).toBeLessThan(4);
  });
  it('a repeat sign with Loop on, a final barline with it off', () => {
    const bars = tabBars(shapes, { style: 'strum', variant: 'whole', beats: 4, barsPerChord: 1 });
    expect(lay(bars).end).toBe('repeat');
    expect(lay(bars, { loop: false }).end).toBe('final');
  });
  it('an empty progression draws one empty bar', () => {
    const L = lay([]);
    expect(L.lines).toHaveLength(1);
    expect(L.lines[0].bars).toHaveLength(1);
    expect(L.lines[0].bars[0].name).toBeNull();
  });
});

describe('note lengths under the staff', () => {
  /** Each bar's rhythm: q quarter, e eighth, q. dotted quarter, h half, w whole, r for rests; a + joins tied values. */
  const NAME: Record<number, string> = { 1: 'e', 2: 'q', 3: 'q.', 4: 'h', 6: 'h.', 8: 'w' };
  const read = (style: PlayStyle, variant: string, beats: BeatsPerBar = 4, barsPerChord = 1) =>
    tabBars(shapes, { style, variant, beats, barsPerChord }).map((b) =>
      b.rhythm.map((r) => (r.tied ? '+' : '') + (r.rest ? 'r' : '') + NAME[r.length]).join(' '));
  const every = (s: string) => [s, s, s, s];
  it('strums', () => {
    expect(read('strum', 'whole')).toEqual(every('w'));
    expect(read('strum', 'quarters')).toEqual(every('q q q q'));
    expect(read('strum', 'folk')).toEqual(every('q e q e e e'));
    expect(read('strum', 'rock')).toEqual(every('e e e e e e e e'));
    expect(read('strum', 'reggae')).toEqual(every('re e re e re e re e'));
  });
  it('arpeggios', () => {
    expect(read('arpeggio', 'up')).toEqual(['e e e e h', 'e e e e e q.', 'e e e e h', 'e e e e e q.']);
    expect(read('arpeggio', 'updown')).toEqual(every('e e e e e e e e'));
    expect(read('arpeggio', 'classic')).toEqual(every('e e e e e e e e'));
    expect(read('arpeggio', 'roll')).toEqual(every('q q q q'));
  });
  it('Travis', () => {
    expect(read('travis', 'basic')).toEqual(every('e e e e e e e e'));
    expect(read('travis', 'muted')).toEqual(every('e e e e e e e e'));
    expect(read('travis', 'thumb')).toEqual(every('q q q q'));
    expect(read('travis', 'pinch')).toEqual(every('q q q q'));
    expect(read('travis', 'monotonic')).toEqual(every('q e e e e e e'));
  });
  it('Bossa: bass or trebles keep ringing, so no rests', () => {
    expect(read('bossa', 'basic')).toEqual(every('q. e q q'));
    expect(read('bossa', 'twobar')).toEqual(['q. e q q', 'e q. q q', 'q. e q q', 'e q. q q']);
  });
  it('in 3/4 and with 2 bars per chord', () => {
    expect(read('travis', 'basic', 3)).toEqual(every('q e e e e'));
    expect(read('strum', 'folk', 4, 2)).toEqual([...every('q e q e e e'), ...every('q e q e e e')]);
  });
  it('rests: a quarter rest only for a whole silent beat on the beat, eighths otherwise', () => {
    const notes = soundingNotes(shapes[0]);
    const short = [{ beat: 0, midis: [notes[0].midi], volume: 1, spreadMs: 0, lengthBeats: 0.2 }];
    expect(rhythm(short, notes, 8).map((r) => (r.rest ? 'r' : '') + NAME[r.length]).join(' ')).toBe('e re rq rq rq');
  });
});

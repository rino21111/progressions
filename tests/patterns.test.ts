import { describe, expect, it } from 'vitest';
import { parseFingering, soundingNotes } from '../src/theory/fingering';
import { ECHO_STYLES, PLAY_STYLES, STRAIGHT_STYLES, expandTremolo, patternEvents, validVariant } from '../src/theory/patterns';
import { chordForBar, clampBpm, swingBeat } from '../src/theory/timing';

const notes = (shape: string) => soundingNotes(parseFingering(shape)!);
// C major, x32010: C3 E3 G3 C4 E4
const C = notes('x32010');

const ALL = PLAY_STYLES.flatMap((s) => s.variants.map((v) => [s.id, v.id] as const));
const first = (style: Parameters<typeof patternEvents>[0], variant: string, beats: 3 | 4 = 4) =>
  patternEvents(style, variant, C, beats).map((e) => e.midis[0]);
const beatsOf = (style: Parameters<typeof patternEvents>[0], variant: string, beats: 3 | 4 = 4) =>
  patternEvents(style, variant, C, beats).map((e) => e.beat);

describe('play patterns', () => {
  it('offers strum, arpeggio, Travis, bossa and post-rock, each with variants', () => {
    expect(PLAY_STYLES.map((s) => s.id)).toEqual(['strum', 'arpeggio', 'travis', 'bossa', 'postrock']);
    expect(PLAY_STYLES.map((s) => s.variants[0].id)).toEqual(['whole', 'up', 'basic', 'basic', 'cascade']);
    expect(PLAY_STYLES.find((s) => s.id === 'bossa')!.variants.map((v) => v.label)).toEqual(['Basic', 'Two-bar', 'Clave', 'Arpeggio']);
    expect(PLAY_STYLES.find((s) => s.id === 'postrock')!.variants.map((v) => v.label)).toEqual(['Cascade', 'Pulse', 'Tremolo']);
  });

  it('keeps every variant inside the bar and in time order, in 4/4 and 3/4', () => {
    for (const [style, variant] of ALL) {
      for (const beats of [4, 3] as const) {
        const events = patternEvents(style, variant, C, beats);
        expect(events.length, `${style}:${variant}`).toBeGreaterThan(0);
        events.forEach((e, i) => {
          expect(e.beat).toBeGreaterThanOrEqual(0);
          expect(e.beat, `${style}:${variant} ${beats}/4`).toBeLessThan(beats);
          if (i) expect(e.beat).toBeGreaterThanOrEqual(events[i - 1].beat);
        });
      }
    }
  });

  it('strum: whole, quarters, folk, rock and reggae rhythms', () => {
    expect(beatsOf('strum', 'whole')).toEqual([0]);
    expect(patternEvents('strum', 'whole', C)[0].midis).toHaveLength(5);
    expect(beatsOf('strum', 'quarters')).toEqual([0, 1, 2, 3]);
    expect(beatsOf('strum', 'quarters', 3)).toEqual([0, 1, 2]);
    const folk = patternEvents('strum', 'folk', C);
    expect(folk.map((e) => [e.beat, e.up ? 'U' : 'D'])).toEqual([[0, 'D'], [1, 'D'], [1.5, 'U'], [2.5, 'U'], [3, 'D'], [3.5, 'U']]);
    expect(patternEvents('strum', 'folk', C, 3).map((e) => [e.beat, e.up ? 'U' : 'D'])).toEqual([[0, 'D'], [1, 'D'], [1.5, 'U'], [2, 'D'], [2.5, 'U']]);
    const rock = patternEvents('strum', 'rock', C);
    expect(rock.map((e) => e.beat)).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]);
    expect(rock.every((e) => !e.up && e.lengthBeats! < 0.5)).toBe(true);
    const reggae = patternEvents('strum', 'reggae', C);
    expect(reggae.map((e) => e.beat)).toEqual([0.5, 1.5, 2.5, 3.5]);
    expect(reggae.every((e) => e.lengthBeats! <= 0.25)).toBe(true);
  });

  it('arpeggio: up, up & down, classic and roll', () => {
    expect(first('arpeggio', 'up')).toEqual([48, 52, 55, 60, 64]);
    expect(beatsOf('arpeggio', 'up')).toEqual([0, 0.5, 1, 1.5, 2]);
    expect(first('arpeggio', 'updown')).toEqual([48, 52, 55, 60, 64, 60, 55, 52]);
    expect(first('arpeggio', 'updown', 3)).toEqual([48, 52, 55, 60, 64, 60]);
    // p-i-m-a-m-i over the top three strings (G3 C4 E4), then the other bass and m in 4/4
    expect(first('arpeggio', 'classic', 3)).toEqual([48, 55, 60, 64, 60, 55]);
    expect(first('arpeggio', 'classic')).toEqual([48, 55, 60, 64, 60, 55, 52, 60]);
    const roll = patternEvents('arpeggio', 'roll', C);
    expect(roll.map((e) => e.beat)).toEqual([0, 1, 2, 3]);
    expect(roll[0].spreadMs).toBeGreaterThan(40);
  });

  it('travis: basic, thumb only, pinch, monotonic and muted bass', () => {
    const onBeat = (variant: string) =>
      patternEvents('travis', variant, C).filter((e) => Number.isInteger(e.beat)).map((e) => e.midis[0]);
    expect([...new Set(onBeat('basic'))]).toEqual([48, 64, 52]); // bass alternates, top string pinched on 1
    expect(first('travis', 'thumb')).toEqual([48, 52, 48, 52]);
    const pinch = patternEvents('travis', 'pinch', C);
    expect(pinch.map((e) => e.midis)).toEqual([[48, 64], [52], [48, 64], [52]]);
    const mono = patternEvents('travis', 'monotonic', C);
    expect(mono.filter((e) => Number.isInteger(e.beat)).every((e) => e.midis[0] === 48)).toBe(true);
    expect(mono.some((e) => !Number.isInteger(e.beat))).toBe(true);
    const muted = patternEvents('travis', 'muted', C);
    const bass = muted.filter((e) => e.midis[0] === 48 || e.midis[0] === 52);
    expect(bass.every((e) => e.lengthBeats! > 0 && e.lengthBeats! < 0.5)).toBe(true);
    expect(muted.filter((e) => e.midis[0] >= 55).every((e) => e.lengthBeats === undefined)).toBe(true);
  });

  it('travis in 3/4 puts the bass on 1 and treble on 2 and 3', () => {
    const events = patternEvents('travis', 'basic', C, 3);
    const at = (beat: number) => events.find((e) => e.beat === beat)!.midis;
    expect(at(0)).toEqual([48]);
    expect(at(1)).toEqual([60, 64]);
    expect(at(2)).toEqual([60, 64]);
  });

  it('copes with tiny chords and silence', () => {
    for (const [style, variant] of ALL) {
      expect(patternEvents(style, variant, notes('x3xxxx')).length, `${style}:${variant}`).toBeGreaterThan(0);
      expect(patternEvents(style, variant, notes('xxxxxx'))).toEqual([]);
    }
  });

  it('falls back to the default variant for unknown names', () => {
    expect(validVariant('strum', 'block')).toBe('whole');
    expect(validVariant('strum', 'funk')).toBe('whole');
    expect(validVariant('travis', 'pinch')).toBe('pinch');
  });
});

describe('player timing', () => {
  it('keeps the tempo between 40 and 200 bpm', () => {
    expect(clampBpm(95.4)).toBe(95);
    expect(clampBpm(10)).toBe(40);
    expect(clampBpm(400)).toBe(200);
    expect(clampBpm(NaN)).toBe(80);
  });

  it('swing pushes only the offbeat eighths late', () => {
    expect(swingBeat(1.5, true)).toBeCloseTo(1 + 2 / 3);
    expect(swingBeat(2, true)).toBe(2);
    expect(swingBeat(1.5, false)).toBe(1.5);
  });

  it('swing leaves on-beat strums alone and moves folk upstrokes', () => {
    expect(patternEvents('strum', 'quarters', C).map((e) => swingBeat(e.beat, true))).toEqual([0, 1, 2, 3]);
    const folk = patternEvents('strum', 'folk', C).map((e) => swingBeat(e.beat, true));
    expect(folk[2]).toBeCloseTo(1 + 2 / 3);
  });

  it('maps bars to chords for one or two bars per chord', () => {
    expect([0, 1, 2, 3, 4].map((b) => chordForBar(b, 4, 1))).toEqual([0, 1, 2, 3, null]);
    expect([0, 1, 2, 3, 7, 8].map((b) => chordForBar(b, 4, 2))).toEqual([0, 0, 1, 1, 3, null]);
  });

});

describe('bossa', () => {
  it('bossa: root on 1, a bass note below the fingers on 3, short top-string plucks on a syncopated pattern', () => {
    const events = patternEvents('bossa', 'basic', C);
    const thumb = events.filter((e) => e.midis.length === 1);
    expect(thumb.map((e) => [e.beat, e.midis[0]])).toEqual([[0, 48], [2, 52]]); // C, then E (the G is a finger string)
    const plucks = events.filter((e) => e.midis.length > 1);
    expect(plucks.map((e) => e.beat)).toEqual([0, 1.5, 3]);
    expect(plucks.every((e) => e.lengthBeats! < 0.5 && e.midis.join() === '55,60,64')).toBe(true);
  });

  it('bossa two-bar alternates its comping between bars, and has a 3/4 form', () => {
    const plucks = (bar: number, beats: 3 | 4 = 4) =>
      patternEvents('bossa', 'twobar', C, beats, bar).filter((e) => e.midis.length > 1).map((e) => e.beat);
    expect(plucks(0)).toEqual([0, 1.5, 3]);
    expect(plucks(1)).toEqual([0.5, 2, 3]);
    expect(plucks(2)).toEqual(plucks(0));
    expect(plucks(0, 3)).toEqual([0, 1.5]);
    expect(plucks(1, 3)).toEqual([0.5, 2]);
  });

});

describe('playing only the fingering shown', () => {
  it('never sounds a note that is not one of the shape\'s strings and frets', () => {
    for (const shape of ['x32010', 'x02220', 'xx0232', '133211', 'x24432', '320003', 'x3xxxx']) {
      const sounding = notes(shape);
      const allowed = new Set(sounding.map((n) => n.midi));
      for (const [style, variant] of ALL) {
        for (const beats of [4, 3] as const) {
          for (const bar of [0, 1]) {
            for (const e of patternEvents(style, variant, sounding, beats, bar)) {
              for (const m of e.midis) expect(allowed.has(m), `${shape} ${style}:${variant} ${beats}/4 played ${m}`).toBe(true);
            }
          }
        }
      }
    }
  });
});

describe('shared string rules (bossa and post-rock)', () => {
  const name = (n: { string: number; fret: number }) => `${6 - n.string}/${n.fret}`;
  const roles = (shape: string) => {
    const ns = notes(shape);
    const at = (beat: number) => patternEvents('bossa', 'arpeggio', ns, 4, 0).filter((e) => e.beat === beat).flatMap((e) => e.midis.map((m) => name(ns.find((x) => x.midi === m)!)));
    const plucks = patternEvents('bossa', 'basic', ns).filter((e) => e.lengthBeats !== undefined)[0];
    return { alt: at(2), fingers: plucks ? plucks.midis.map((m) => name(ns.find((x) => x.midi === m)!)).sort() : [] };
  };
  it('the fingers are the three highest strings above the root; the thumb on 3 sounds below them', () => {
    // 3x343x: G B G A? no: G (6/3), D (4/3), G (3/4), B (2/3). Fingers B G D; nothing below but the root.
    expect(roles('3x343x')).toEqual({ alt: ['6/3'], fingers: ['2/3', '3/4', '4/3'] });
    // xx0232: D A D F#. Fingers F# D A; the root again on 3.
    expect(roles('xx0232')).toEqual({ alt: ['4/0'], fingers: ['1/2', '2/3', '3/2'] });
    // x32010: C E G C E. Fingers E C G; the fifth is a finger string, so E on 3.
    expect(roles('x32010')).toEqual({ alt: ['4/2'], fingers: ['1/0', '2/1', '3/0'] });
    // 022100: E B E G# B E. Fingers E B G#; the fifth B sounds below them.
    expect(roles('022100')).toEqual({ alt: ['5/2'], fingers: ['1/0', '2/0', '3/1'] });
  });
  it('a string never sounds twice at one beat; bass and fingers keep their own volumes', () => {
    for (const shape of ['3x343x', 'xx0232', 'x32010', '022100', 'xx023x']) {
      for (const variant of ['basic', 'twobar', 'clave', 'arpeggio']) {
        for (const bar of [0, 1]) {
          const ev = patternEvents('bossa', variant, notes(shape), 4, bar);
          for (const beat of new Set(ev.map((e) => e.beat))) {
            const ms = ev.filter((e) => e.beat === beat).flatMap((e) => e.midis);
            expect(new Set(ms).size).toBe(ms.length);
          }
          expect(ev.find((e) => e.beat === 0 && e.midis.length === 1)?.volume).toBe(0.85);
        }
      }
    }
  });
});

describe('new bossa and post-rock variants', () => {
  const show = (style: Parameters<typeof patternEvents>[0], variant: string, beats: 3 | 4 = 4, bar = 0) =>
    patternEvents(style, variant, C, beats, bar).map((e) => `${e.beat}:${e.midis.join('+')}`).join(' ');
  it('bossa clave: plucks at 1, the and of 2, 4, then 2 and the and of 3', () => {
    const plucks = (bar: number, beats: 3 | 4 = 4) => patternEvents('bossa', 'clave', C, beats, bar).filter((e) => e.lengthBeats !== undefined).map((e) => e.beat);
    expect(plucks(0)).toEqual([0, 1.5, 3]);
    expect(plucks(1)).toEqual([1, 2.5]);
    expect(plucks(0, 3)).toEqual([0, 1.5]);
    expect(plucks(1, 3)).toEqual([1]);
  });
  it('bossa arpeggio: the top string on 1, the and of 2 and 4', () => {
    expect(show('bossa', 'arpeggio')).toBe('0:48 0:64 0.5:55 1:60 1.5:64 2:52 2.5:60 3:64 3.5:55');
    expect(show('bossa', 'arpeggio', 3)).toBe('0:48 0:64 0.5:55 1:60 1.5:64 2:52 2.5:60');
  });
  it('cascade: a falling 3-3-2 over the root', () => {
    expect(show('postrock', 'cascade')).toBe('0:48 0:64 0.5:60 1:55 1.5:64 2:60 2.5:55 3:64 3.5:60');
    expect(show('postrock', 'cascade', 3)).toBe('0:48 0:64 0.5:60 1:55 1.5:64 2:60 2.5:55');
    // a two-string shape falls back to the root for the missing third string
    expect(patternEvents('postrock', 'cascade', notes('x35xxx')).map((e) => e.midis[0])).toContain(48);
  });
  it('pulse: open strums on the 3-3-2 points over a palm-muted root', () => {
    const ev = patternEvents('postrock', 'pulse', C);
    expect(ev.filter((e) => e.muted).map((e) => e.beat)).toEqual([0.5, 1, 2, 2.5, 3.5]);
    expect(ev.filter((e) => !e.muted).map((e) => e.beat)).toEqual([0, 1.5, 3]);
    expect(ev.filter((e) => e.muted).every((e) => e.midis.join() === '48' && e.lengthBeats === 0.3)).toBe(true);
  });
  it('tremolo: the root rings under the top string picked about 12 times a second at any tempo', () => {
    const ev = patternEvents('postrock', 'tremolo', C);
    expect(ev.filter((e) => e.tremolo).map((e) => `${e.beat}:${e.midis}`)).toEqual(['0:64', '1:64', '2:64', '3:64']);
    for (const bpm of [40, 80, 120, 200]) {
      const strikes = expandTremolo(ev.find((e) => e.tremolo)!, bpm);
      const perSecond = strikes.length / (60 / bpm);
      expect(perSecond).toBeGreaterThan(11);
      expect(perSecond).toBeLessThan(14);
      expect(strikes.map((x) => !!x.up)).toEqual(strikes.map((_, i) => i % 2 === 1));
    }
  });
  it('bossa and post-rock stay straight; only post-rock plays through the echo', () => {
    expect(STRAIGHT_STYLES).toEqual(['bossa', 'postrock']);
    expect(ECHO_STYLES).toEqual(['postrock']);
  });
});

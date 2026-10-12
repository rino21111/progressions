// The progression's "shared notes" map: each chord's sounding notes on rows of the key (tonic at
// the bottom), the notes held from one chord to the next, and each chord's harmonic function
// (tonic, predominant, dominant) for the strip underneath.

import { Chord, chordPitchClasses, chordSymbol, spellChordNote, toneLabelFor } from './chords';
import { Fingering, soundingNotes } from './fingering';
import { Key, chordFitInKey, diatonicChords, pitchInKey, romanNumeral, scalePitchClasses, scaleNoteNames } from './keys';
import { PitchClass, flatName, mod12, sharpName } from './notes';

export interface MapTone {
  pc: PitchClass;
  /** Role in the chord (R, b3, 5, b7...), or the interval above the root when it isn't a chord tone. */
  label: string;
  name: string;
  /** The lowest pitch the shape sounds it at. */
  midi: number;
  /** The shape's lowest note (its bass). */
  bass: boolean;
}

export interface MapRow {
  pc: PitchClass;
  name: string;
  /** Outside the key (shown in amber). */
  chromatic: boolean;
}

const INTERVALS = ['R', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'];

/** A note name without double accidentals (Fbb becomes Eb, C## becomes D). */
function simpleName(name: string, pc: PitchClass): string {
  if (name.includes('##') || name.includes('x')) return sharpName(pc);
  if (name.slice(1).includes('bb')) return flatName(pc);
  return name;
}

/** The notes a card's exact shape sounds (muted strings skipped), one per pitch class, spelled as the chord spells them. */
export function columnTones(chord: Chord, shape: Fingering | null): MapTone[] {
  const bass = bassPc(shape);
  const tones = new Map<PitchClass, MapTone>();
  for (const n of shape ? soundingNotes(shape) : []) {
    const seen = tones.get(n.pc);
    if (seen) {
      seen.midi = Math.min(seen.midi, n.midi);
      continue;
    }
    tones.set(n.pc, {
      pc: n.pc,
      label: toneLabelFor(chord, n.pc) ?? INTERVALS[mod12(n.pc - chord.root)],
      name: simpleName(spellChordNote(chord, n.pc), n.pc),
      midi: n.midi,
      bass: n.pc === bass,
    });
  }
  return [...tones.values()];
}

/**
 * The rows, bottom (lowest) first. With a key: its seven notes as the key spells them, plus any
 * other note a chord sounds, spelled as the first chord using it spells it. A row is chromatic
 * (amber) exactly when the numerals count that note as outside the key. Without a key: just the
 * notes used, upward from the first chord's root.
 */
export function mapRows(columns: MapTone[][], key: Key | null): MapRow[] {
  const used = new Map<PitchClass, string>();
  for (const col of columns) for (const t of col) if (!used.has(t.pc)) used.set(t.pc, t.name);

  if (!key) {
    const base = columns.find((c) => c.length)?.find((t) => t.label === 'R')?.pc ?? columns[0]?.[0]?.pc ?? 0;
    return [...used.entries()]
      .sort(([a], [b]) => mod12(a - base) - mod12(b - base))
      .map(([pc, name]) => ({ pc, name, chromatic: false }));
  }

  const rows = new Map<PitchClass, MapRow>();
  const names = scaleNoteNames(key);
  scalePitchClasses(key).forEach((pc, i) => rows.set(pc, { pc, name: names[i], chromatic: false }));
  for (const [pc, name] of used) if (!rows.has(pc)) rows.set(pc, { pc, name, chromatic: !pitchInKey(pc, key) });
  return [...rows.values()].sort((a, b) => mod12(a.pc - key.tonic) - mod12(b.pc - key.tonic));
}

/** The notes each chord keeps from the one before (empty for the first). */
export function heldTones(columns: MapTone[][]): PitchClass[][] {
  return columns.map((col, i) => (i === 0 ? [] : col.filter((t) => columns[i - 1].some((p) => p.pc === t.pc)).map((t) => t.pc)));
}

export type Lane = 'T' | 'PD' | 'D' | 'none';
type Quality = 'maj' | 'min' | 'dom' | 'dim' | 'hdim' | 'aug';

/** A chord's basic quality: sus, 6, add9, extensions and inversions count as their base chord. */
export function chordQuality(chord: Chord): Quality {
  const { id, family, tones } = chord.template;
  if (id === 'dim' || id === 'dim7') return 'dim';
  if (id === 'm7b5') return 'hdim';
  if (family === 'minor') return 'min';
  if (tones.some((t) => t.label === 'b7')) return 'dom';
  if (family === 'augmented') return 'aug';
  return 'maj';
}

const hasSeventh = (chord: Chord) => chord.template.tones.some((t) => t.label === 'b7');

/**
 * The basic lane of each chord by semitones above the tonic and quality (augmented triads count as
 * the major triad on their root). Kept as a table so it can be adjusted; the context rules in
 * chordLane (what comes next, secondary dominants...) are applied around it.
 */
export const LANE_TABLE: Record<Key['mode'], { semi: number; qualities: Quality[]; lane: Exclude<Lane, 'none'> }[]> = {
  major: [
    { semi: 0, qualities: ['maj', 'dom'], lane: 'T' },
    { semi: 4, qualities: ['min'], lane: 'T' },
    { semi: 9, qualities: ['min'], lane: 'T' },
    { semi: 3, qualities: ['maj'], lane: 'T' },
    { semi: 2, qualities: ['min', 'hdim', 'maj', 'dom'], lane: 'PD' },
    { semi: 5, qualities: ['maj', 'min', 'dom'], lane: 'PD' },
    { semi: 8, qualities: ['maj'], lane: 'PD' },
    { semi: 10, qualities: ['maj', 'dom'], lane: 'PD' },
    { semi: 1, qualities: ['maj'], lane: 'PD' },
    { semi: 7, qualities: ['maj', 'dom'], lane: 'D' },
    { semi: 11, qualities: ['dim', 'hdim'], lane: 'D' },
  ],
  minor: [
    { semi: 0, qualities: ['min', 'maj', 'dom'], lane: 'T' },
    { semi: 3, qualities: ['maj'], lane: 'T' },
    { semi: 5, qualities: ['min'], lane: 'PD' },
    { semi: 2, qualities: ['dim', 'hdim'], lane: 'PD' },
    { semi: 8, qualities: ['maj'], lane: 'PD' },
    { semi: 1, qualities: ['maj'], lane: 'PD' },
    { semi: 7, qualities: ['maj', 'dom', 'min'], lane: 'D' },
    { semi: 11, qualities: ['dim'], lane: 'D' },
    { semi: 10, qualities: ['maj', 'dom'], lane: 'PD' },
  ],
};

/** A lane and, for the strip's hover note, why the chord got it. */
export interface LaneInfo {
  lane: Lane;
  reason: string;
}

const WORD: Record<Exclude<Lane, 'none'>, string> = { T: 'tonic', PD: 'predominant', D: 'dominant' };

/** The numeral of the key's own chord on a root (semitones above the tonic), e.g. "ii". */
function degreeNumeral(key: Key, semi: number): string {
  return diatonicChords(key).find((d) => mod12(d.chord.root - key.tonic) === semi)?.numeral ?? '?';
}

function tableInfo(chord: Chord, key: Key, next?: Chord): LaneInfo {
  const semi = mod12(chord.root - key.tonic);
  const numeral = romanNumeral(chord, key);
  const plain = (lane: Lane): LaneInfo => ({ lane, reason: lane === 'none' ? numeral : `${numeral}, ${WORD[lane]}` });
  let quality = chordQuality(chord);
  if (quality === 'aug') {
    if (key.mode === 'major' && semi === 4) return { lane: 'D', reason: `${numeral}, V+ of vi` };
    quality = 'maj';
  }
  const resolves = (to: number) => next && mod12(next.root - key.tonic) === to;
  const hit = LANE_TABLE[key.mode].find((row) => row.semi === semi && row.qualities.includes(quality));
  if (hit) {
    // A dominant going home says so.
    if (hit.lane === 'D' && next && resolves(0)) return { lane: 'D', reason: `${numeral}, resolves to ${chordSymbol(next)}` };
    return plain(hit.lane);
  }
  const diatonicRoots = new Set(scalePitchClasses(key).map((pc) => mod12(pc - key.tonic)));
  const outside = chordFitInKey(chord, key) === 'outside';
  if (quality === 'maj' || quality === 'dom') {
    // A secondary dominant: a major or dominant chord a fifth above a chord of the key (A7 in C is
    // V7/ii), but not above the key's diminished chord (vii° in major, ii° in minor).
    const target = mod12(semi - 7);
    const diminished = key.mode === 'major' ? 11 : 2;
    if (diatonicRoots.has(target) && target !== diminished) {
      const of = `${quality === 'dom' ? 'V7' : 'V'} of ${degreeNumeral(key, target)}`;
      return { lane: 'D', reason: next && resolves(target) ? `${of}, resolves to ${chordSymbol(next)}` : of };
    }
    // Any other dominant 7th from outside the key (bII7 tritone sub, bVI7...).
    if (quality === 'dom' && outside) return plain('D');
  }
  // A secondary leading-tone chord: diminished, a semitone below a chord of the key.
  if ((quality === 'dim' || quality === 'hdim') && diatonicRoots.has(mod12(semi + 1))) {
    const label = chord.template.id === 'dim7' ? 'vii°7' : quality === 'hdim' ? 'viiø7' : 'vii°';
    return { lane: 'D', reason: `${label} of ${degreeNumeral(key, mod12(semi + 1))}` };
  }
  return plain('none');
}

/**
 * Which function a chord serves (tonic, predominant, dominant) and why, given the chord after it
 * (the next card, wrapping from the last to the first). Rules about the next chord look only at its
 * root and quality, never its lane, so they can't go round in circles.
 */
export function laneInfo(chord: Chord, key: Key | null, next?: Chord): LaneInfo {
  if (!key) return { lane: 'none', reason: '' };
  const semi = mod12(chord.root - key.tonic);
  const quality = chordQuality(chord);
  const numeral = romanNumeral(chord, key);
  const nextSemi = next ? mod12(next.root - key.tonic) : null;
  const nextQuality = next ? chordQuality(next) : null;
  const nextName = next ? chordSymbol(next) : '';
  const isMajorish = quality === 'maj' || quality === 'dom';

  // Explicit slash chords: a cadential 6/4 (I/5 or i/5 before a chord on the 5th), and IV/5 or ii/5,
  // are dominant; any other inversion takes its upper chord's lane.
  if (chord.bass !== chord.root && mod12(chord.bass - key.tonic) === 7) {
    if (semi === 0 && nextSemi === 7) return { lane: 'D', reason: `${numeral}/5, cadential 6/4 before ${nextName}` };
    if ((semi === 5 && isMajorish) || (semi === 2 && quality === 'min')) return { lane: 'D', reason: `${numeral}/5, dominant` };
  }

  // Diminished 7ths: one sharing the next chord's root takes its lane (a common-tone dim7); otherwise
  // a note a half step below the next root makes it a leading-tone chord.
  if (chord.template.id === 'dim7' && next) {
    const notes = chordPitchClasses(chord);
    if (notes.includes(mod12(next.root))) return { lane: laneInfo(next, key).lane, reason: `dim7, decorates ${nextName}` };
    if (notes.some((pc) => mod12(next.root - pc) === 1)) return { lane: 'D', reason: `dim7, leads to ${nextName}` };
  }

  // A related ii: a minor 7th or half-diminished chord from outside the key, before a dominant 7th a
  // 4th above it (Bm7 E7 in C).
  if ((quality === 'hdim' || (quality === 'min' && hasSeventh(chord))) && chordFitInKey(chord, key) === 'outside'
    && next && nextQuality === 'dom' && mod12(next.root - chord.root) === 5) return { lane: 'PD', reason: `ii of ${nextName}` };

  // I7 in major (blues) and a major I in minor (Picardy) are tonic, except right before IV or iv.
  if (semi === 0 && (key.mode === 'major' ? quality === 'dom' : isMajorish)) {
    return nextSemi === 5
      ? { lane: 'D', reason: `${numeral}, ${quality === 'dom' ? 'V7' : 'V'} of ${degreeNumeral(key, 5)} here` }
      : { lane: 'T', reason: `${numeral}, tonic` };
  }
  if (semi === 10 && isMajorish) {
    // bVII: a backdoor dominant into I; minor VII: dominant into i or III (Aeolian); otherwise passing.
    if (key.mode === 'major' && nextSemi === 0) return { lane: 'D', reason: `${numeral}, backdoor to ${nextName}` };
    if (key.mode === 'minor' && (nextSemi === 0 || nextSemi === 3)) return { lane: 'D', reason: `${numeral}, resolves to ${nextName}` };
    return { lane: 'PD', reason: `${numeral}, predominant` };
  }
  // A major IV in minor (Dorian IV) is predominant unless it resolves to VII, where it's V of VII.
  if (key.mode === 'minor' && semi === 5 && isMajorish) {
    return nextSemi === 10 ? { lane: 'D', reason: `${numeral}, ${quality === 'dom' ? 'V7' : 'V'} of VII` } : { lane: 'PD', reason: `${numeral}, predominant` };
  }
  // Major II (Lydian II) is predominant unless it leads to V, where it's V/V.
  if (key.mode === 'major' && semi === 2 && isMajorish) {
    return nextSemi === 7 ? { lane: 'D', reason: `${numeral}, ${quality === 'dom' ? 'V7' : 'V'} of V` } : { lane: 'PD', reason: `${numeral}, predominant` };
  }
  return tableInfo(chord, key, next);
}

export function chordLane(chord: Chord, key: Key | null, next?: Chord): Lane {
  return laneInfo(chord, key, next).lane;
}

/** Each card's lane and its reason, looking at the card after it (the last card looks at the first). */
export function progressionLaneInfo(chords: Chord[], key: Key | null): LaneInfo[] {
  return chords.map((c, i) => laneInfo(c, key, chords[(i + 1) % chords.length]));
}

/** The lowest note a shape sounds (open strings included, muted ones skipped), or null if none. */
export function bassPc(shape: Fingering | null): PitchClass | null {
  const notes = shape ? soundingNotes(shape) : [];
  if (!notes.length) return null;
  return notes.reduce((lo, n) => (n.midi < lo.midi ? n : lo)).pc;
}

/** With Loop on, the map shows the first chord coming round again after the last column (and any chords being tried). */
export function showsReturn(list: Chord[], loop: boolean): boolean {
  return loop && list.length > 0;
}

/** The strip needs at least two chords with a function to say anything. */
export function showsStrip(lanes: Lane[]): boolean {
  return lanes.filter((l) => l !== 'none').length >= 2;
}

/** Each card's lane, looking at the card after it (the last card looks at the first). */
export function progressionLanes(chords: Chord[], key: Key | null): Lane[] {
  return chords.map((c, i) => chordLane(c, key, chords[(i + 1) % chords.length]));
}

/**
 * A smooth path through points that never overshoots between them (monotone cubic, Fritsch-Carlson,
 * like d3's curveMonotoneX): equal neighbours give a flat segment.
 */
export function monotonePath(points: { x: number; y: number }[]): string {
  const n = points.length;
  if (!n) return '';
  if (n === 1) return `M${points[0].x},${points[0].y}`;
  const dx = points.slice(1).map((p, i) => p.x - points[i].x);
  const slope = points.slice(1).map((p, i) => (p.y - points[i].y) / dx[i]);
  const m = points.map((_, i) => {
    if (i === 0) return slope[0];
    if (i === n - 1) return slope[n - 2];
    const a = slope[i - 1];
    const b = slope[i];
    if (a * b <= 0) return 0;
    // Weighted harmonic mean keeps the curve monotone between points.
    const w1 = 2 * dx[i] + dx[i - 1];
    const w2 = dx[i] + 2 * dx[i - 1];
    return (w1 + w2) / (w1 / a + w2 / b);
  });
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const p = points[i];
    const q = points[i + 1];
    const h = dx[i] / 3;
    d += ` C${p.x + h},${p.y + m[i] * h} ${q.x - h},${q.y - m[i + 1] * h} ${q.x},${q.y}`;
  }
  return d;
}

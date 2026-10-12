// A chord's structure as a stack, top to bottom: extensions (13, 11, 9), the 7th, the triad
// (5, 3, root), and the bass when it isn't the root. Each row lists the possible degrees for that
// slot with the natural one always third, so the naturals line up, and marks the chord's own.

import { Chord, chordTones, spellChordNote, toneLabelFor } from './chords';
import { Fingering, soundingNotes } from './fingering';
import { mod12 } from './notes';

export type StructureGroup = 'Extensions' | '7th' | 'Triad' | 'Bass';

export interface StructureRow {
  group: StructureGroup;
  /** The chord's tone in this slot (its degree label, spelled note and pitch class), if any. */
  label: string | null;
  note: string | null;
  pc: number | null;
  /** on: the shape plays it; implied: the chord has it but this shape leaves it out; empty: not in the chord. */
  state: 'on' | 'implied' | 'empty';
  /** The degrees this slot can hold (null for a blank column), and whether it's the chord's. */
  options: ({ text: string; on: boolean } | null)[];
}

/** Each stacked slot and its four option columns (natural third). A diminished 7th (bb7) shares the 6's column. */
const SLOTS: { group: StructureGroup; options: (string | null)[]; also?: Record<string, number> }[] = [
  { group: 'Extensions', options: [null, 'b13', '13', null] },
  { group: 'Extensions', options: [null, null, '11', '#11'] },
  { group: 'Extensions', options: [null, 'b9', '9', '#9'] },
  { group: '7th', options: ['b6', '6', 'b7', '7'], also: { bb7: 1 } },
  { group: 'Triad', options: [null, 'b5', '5', '#5'] },
  { group: 'Triad', options: ['2', 'b3', '3', '4'] },
  { group: 'Triad', options: [null, null, 'R', null] },
];

const BASS_INTERVALS = ['R', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'];

export function chordStructure(chord: Chord, fingering: Fingering | null): StructureRow[] {
  const notes = fingering ? soundingNotes(fingering) : [];
  const present = new Set(notes.map((n) => n.pc));
  const tones = chordTones(chord);

  const rows: StructureRow[] = SLOTS.map((slot) => {
    const column = (label: string) => {
      const i = slot.options.indexOf(label);
      return i >= 0 ? i : slot.also?.[label] ?? -1;
    };
    const tone = tones.find((t) => column(t.label) >= 0);
    const at = tone ? column(tone.label) : -1;
    return {
      group: slot.group,
      label: tone?.label ?? null,
      note: tone?.name ?? null,
      pc: tone?.pc ?? null,
      state: !tone ? 'empty' : !fingering || present.has(tone.pc) ? 'on' : 'implied',
      options: slot.options.map((text, i) => (i === at ? { text: tone!.label, on: true } : text ? { text, on: false } : null)),
    };
  });

  // The bass row is filled only when the lowest note isn't the root (a slash chord).
  const bassPc = notes.length ? notes.reduce((lo, n) => (n.midi < lo.midi ? n : lo)).pc : chord.bass;
  const slash = bassPc !== chord.root;
  const bassLabel = slash ? toneLabelFor(chord, bassPc) ?? BASS_INTERVALS[mod12(bassPc - chord.root)] : null;
  rows.push({
    group: 'Bass',
    label: bassLabel,
    note: slash ? spellChordNote(chord, bassPc) : null,
    pc: slash ? bassPc : null,
    state: slash ? 'on' : 'empty',
    options: [null, null, bassLabel ? { text: bassLabel, on: true } : null, null],
  });
  return rows;
}

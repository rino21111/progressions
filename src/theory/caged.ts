// CAGED: every movable chord shape is one of the open C, A, G, E or D shapes
// slid up the neck, with the nut replaced by your index finger (or a barre).

import { PitchClass, mod12 } from './notes';
import { Fingering, soundingNotes } from './fingering';

export type CagedForm = 'C' | 'A' | 'G' | 'E' | 'D';

interface FormDef {
  form: CagedForm;
  /** Open major shape, low E first. */
  shape: Fingering;
  /** Pitch class of the open shape's root. */
  rootPc: PitchClass;
  /** Where the roots sit in the open shape: [string, fret]. */
  roots: [number, number][];
  /** Description of where the root lives. */
  rootHint: string;
}

const FORMS: FormDef[] = [
  {
    form: 'C',
    shape: [null, 3, 2, 0, 1, 0],
    rootPc: 0,
    roots: [
      [1, 3],
      [4, 1],
    ],
    rootHint: 'root on the 5th string under your ring finger, with another on the 2nd string',
  },
  {
    form: 'A',
    shape: [null, 0, 2, 2, 2, 0],
    rootPc: 9,
    roots: [
      [1, 0],
      [3, 2],
    ],
    rootHint: 'root on the 5th string at the barre, with another on the 3rd string',
  },
  {
    form: 'G',
    shape: [3, 2, 0, 0, 0, 3],
    rootPc: 7,
    roots: [
      [0, 3],
      [3, 0],
      [5, 3],
    ],
    rootHint: 'roots on the 6th and 1st strings at the top of the shape, and on the 3rd string at the barre',
  },
  {
    form: 'E',
    shape: [0, 2, 2, 1, 0, 0],
    rootPc: 4,
    roots: [
      [0, 0],
      [2, 2],
      [5, 0],
    ],
    rootHint: 'root on the 6th string at the barre, with more on the 4th and 1st strings',
  },
  {
    form: 'D',
    shape: [null, null, 0, 2, 3, 2],
    rootPc: 2,
    roots: [
      [2, 0],
      [4, 3],
    ],
    rootHint: 'root on the 4th string at the barre, with another on the 2nd string',
  },
];

export interface CagedMatch {
  form: CagedForm;
  /** How far the open shape has been moved up the neck (0 = the open chord itself). */
  position: number;
  description: string;
  rootHint: string;
}

/** Which CAGED shape a fingering is built on, if it fits one cleanly. */
export function detectCagedShape(fingering: Fingering, root: PitchClass): CagedMatch | null {
  const notes = soundingNotes(fingering);
  if (notes.length < 3) return null;
  let best: { def: FormDef; position: number; score: number } | null = null;

  for (const def of FORMS) {
    const shift = mod12(root - def.rootPc);
    for (const position of [shift, shift + 12]) {
      if (position > 15) continue;
      let rootHits = 0;
      let shapeHits = 0;
      let outside = 0;
      for (const note of notes) {
        const fret = note.fret;
        const inBox = position === 0 ? fret <= 3 : fret >= position && fret <= position + 3;
        if (!inBox) outside++;
        if (note.pc === mod12(root) && def.roots.some(([s, f]) => s === note.string && f + position === fret)) {
          rootHits++;
        }
        const shapeFret = def.shape[note.string];
        if (shapeFret !== null && shapeFret + position === fret) shapeHits++;
      }
      if (rootHits === 0 || outside > 0) continue;
      const score = rootHits * 3 + shapeHits;
      if (!best || score > best.score) best = { def, position, score };
    }
  }

  if (!best || best.score < 5) return null;
  const { def, position } = best;
  const description =
    position === 0 ? `Open ${def.form} shape` : `${def.form} shape moved up to fret ${position}`;
  return { form: def.form, position, description, rootHint: def.rootHint };
}

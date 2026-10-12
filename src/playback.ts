// What the two Plays play: the sidebar's plays the progression (Space too), the Inspector's plays its chord.

import { AppState, ProgressionChord } from './state';
import { Fingering, soundingNotes } from './theory/fingering';
import { bestVoicing } from './theory/voicings';

export const PROGRESSION_ID = 'progression';
export const INSPECTOR_ID = 'inspector';

/** A card's shape: the exact one it was added with, or the chord's usual shape. */
export function cardShape(c: ProgressionChord): Fingering | null {
  return c.fingering ?? bestVoicing(c);
}

/** The progression's shapes, in order: what Play and Space play, on either page. */
export function progressionFingerings(s: Pick<AppState, 'progression'>): Fingering[] {
  return s.progression.map(cardShape).filter((f) => f !== null);
}

/** The Inspector's chord, exactly as fingered (nothing when no string sounds). */
export function chordFingerings(s: Pick<AppState, 'fingering'>): Fingering[] {
  return soundingNotes(s.fingering).length ? [s.fingering] : [];
}

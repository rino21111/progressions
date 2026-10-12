// The Inspector's search field: a chord name (Dm7, F#m7b5, Bbmaj7, C/E) or a fingering (x02210).

import { CHORD_TEMPLATES, Chord, makeChord } from './chords';
import { Fingering, MAX_FRET, parseFingering } from './fingering';
import { parseNote } from './notes';

/** Other ways people write some chord suffixes, mapped to the app's own. */
const ALIASES: Record<string, string> = {
  maj: '', M: '', major: '',
  min: 'm', minor: 'm', '-': 'm',
  M7: 'maj7', 'Δ': 'maj7', 'Δ7': 'maj7', ma7: 'maj7',
  min7: 'm7', '-7': 'm7',
  '°': 'dim', o: 'dim', '°7': 'dim7', o7: 'dim7',
  '+': 'aug', '+7': '7#5',
  'ø': 'm7b5', 'ø7': 'm7b5',
  madd9: 'm(add9)', mmaj7: 'm(maj7)', mM7: 'm(maj7)', madd11: 'm(add11)',
  '69': '6/9', m69: 'm6/9', sus: 'sus4',
};

/** Parse a chord name like "Dm7", "F#m7b5", "Bbmaj7" or "C/E". */
export function parseChordName(text: string): Chord | null {
  const m = /^([A-Ga-g][#b]?)(.*?)(?:\/([A-Ga-g][#b]?))?$/.exec(text.trim());
  if (!m) return null;
  const root = parseNote(m[1]);
  if (root === null) return null;
  const raw = m[2].trim();
  const suffix = ALIASES[raw] ?? raw;
  const template = CHORD_TEMPLATES.find((t) => t.suffix === suffix);
  if (!template) return null;
  const bass = m[3] ? parseNote(m[3]) : root;
  if (bass === null) return null;
  return makeChord(root, template.id, bass);
}

export type SearchResult = { kind: 'fingering'; fingering: Fingering } | { kind: 'chord'; chord: Chord };

/** Read the search field: a fingering if it looks like one, otherwise a chord name. */
export function parseSearch(text: string): SearchResult | null {
  const value = text.trim();
  if (!value) return null;
  if (/^[xX0-9\s-]+$/.test(value)) {
    const fingering = parseFingering(value);
    if (!fingering || fingering.some((f) => f !== null && f > MAX_FRET)) return null;
    return { kind: 'fingering', fingering };
  }
  const chord = parseChordName(value);
  return chord ? { kind: 'chord', chord } : null;
}

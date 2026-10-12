// What to play after the progression (Natural, or Spicy from outside the key), each idea with an
// optional "then" phrase from the library; and what to start with when there's nothing yet. The
// engine (engine.ts) decides; this turns the site's chords into its symbols and back.

import { Chord, makeChord } from './chords';
import { Key, chordSymbolInKey, romanNumeral, spellRootInKey, tonicName } from './keys';
import { Lane, laneInfo } from './progressionMap';
import { ideaTag, secondaryTarget } from './progressions';
import * as engine from './engine';

export interface ThenPhrase {
  name: string;
  genre: string;
  mood: string;
  /** The chords that follow the idea; with returnsHome the last is the progression's first chord coming round. */
  chords: Chord[];
  numerals: string[];
  lanes: Lane[];
  returnsHome: boolean;
}

export interface AfterIdea {
  chord: Chord;
  numeral: string;
  /** Its function where it would be added. */
  lane: Lane;
  tag: string | null;
  /** The reason, for the row's title. */
  why: string;
  then: ThenPhrase | null;
}

/** What a then line adds: the idea and its chords, less the return to the first chord. */
export const thenPhrase = (idea: AfterIdea): Chord[] =>
  idea.then ? [idea.chord, ...(idea.then.returnsHome ? idea.then.chords.slice(0, -1) : idea.then.chords)] : [idea.chord];

const QUALITY: Record<string, engine.Quality> = {
  maj: 'maj', min: 'm', dim: 'dim', aug: 'aug', 7: '7', m7: 'm7', maj7: 'maj7', m7b5: 'm7b5', dim7: 'dim7',
  // the rest as the chord they colour
  5: 'maj', sus2: 'maj', sus4: 'maj', add9: 'maj', 6: 'maj', 69: 'maj', add11: 'maj',
  m6: 'm', madd9: 'm', m69: 'm', madd11: 'm', mMaj7: 'm',
  9: '7', 13: '7', '7sus4': '7', '9sus4': '7', '7#9': '7', '7b9': '7', '7b5': '7', '7#11': '7',
  maj9: 'maj7', maj13: 'maj7', 'maj7#11': 'maj7', m9: 'm7', m11: 'm7', m13: 'm7', '7#5': 'aug', 'maj7#5': 'aug',
};
const TEMPLATE: Record<engine.Quality, string> = { maj: 'maj', m: 'min', dim: 'dim', aug: 'aug', 7: '7', m7: 'm7', maj7: 'maj7', m7b5: 'm7b5', dim7: 'dim7' };
const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const engineKey = (key: Key): engine.EngineKeyInput => ({ tonic: key.tonic, mode: key.mode, name: tonicName(key) });

/** The engine's symbol for a site chord, spelled in the key (no slash, no double accidental). */
export function engineSymbol(c: Chord, key: Key): string {
  let root = spellRootInKey(key, c.root);
  if (/bb|##/.test(root)) root = (root.includes('#') ? SHARP : FLAT)[c.root];
  const q = QUALITY[c.template.id] ?? (c.template.family === 'minor' ? 'm' : 'maj');
  return root + (q === 'maj' ? '' : q);
}
const siteChord = (symbol: string): Chord => {
  const c = engine.parse(symbol);
  return makeChord(c.root, TEMPLATE[c.quality]);
};

/** Up to four ideas for after the progression's last chord (Natural, or Spicy from outside the key). */
export function afterIdeas(progression: Chord[], key: Key, opts: { spice: boolean; sevenths?: boolean }): AfterIdea[] {
  if (!progression.length) return [];
  const first = progression[0];
  return engine.afterIdeas(progression.map((c) => engineSymbol(c, key)), engineKey(key), { spice: opts.spice, sevenths: opts.sevenths }).map((x) => {
    const t = x.then;
    let then: ThenPhrase | null = null;
    if (t) {
      const chords = t.chords.map(siteChord);
      // the return is the progression's own first chord, as played
      if (t.returnsHome) chords[chords.length - 1] = first;
      then = { name: t.name, genre: t.genre, mood: t.mood, chords, numerals: t.numerals, lanes: t.lanes, returnsHome: t.returnsHome };
    }
    return { chord: siteChord(x.chord), numeral: x.numeral, lane: x.lane, tag: x.tag || null, why: x.why, then };
  });
}

/** The reason for an idea's title: its tag, then its why, less an "As in" that only repeats the tag. */
export function ideaReason(idea: AfterIdea): string {
  const why = idea.why.split('; ').filter((w) => w !== `As in ${idea.tag}`).join('; ');
  return [idea.tag, why].filter(Boolean).join('. ');
}

/** An idea row for any chord after `x` (a key-band chord picked to compare). */
export function ideaFor(x: Chord, c: Chord, key: Key, first: Chord): AfterIdea {
  // A secondary dominant (or leading-tone chord) reads as leading to its target, as its tag says.
  const target = secondaryTarget(c, key);
  const plain = laneInfo(c, key, first);
  const aimed = target ? laneInfo(c, key, target) : plain;
  const to = aimed.lane === plain.lane ? plain : { lane: aimed.lane, reason: `${romanNumeral(c, key)}, leads to ${chordSymbolInKey(target!, key)}` };
  return { chord: c, numeral: romanNumeral(c, key), lane: to.lane, tag: ideaTag(x, c, key), why: to.reason.replace(/^[^,]+, /, ''), then: null };
}

export interface StartItem {
  id: string;
  name: string;
  genre: string;
  mood: string;
  mode: Key['mode'];
  /** The key it's realized in: the selected key, or its relative for the other mode. */
  key: Key;
  /** One per bar (repeats written out). */
  chords: Chord[];
  /** Each bar's function, as the engine reads it in this progression (I7 is home in a blues). */
  lanes: Lane[];
  /** One line for the name's tooltip. */
  note: string;
}

export interface StartGroup {
  name: string;
  items: StartItem[];
}

/** Progressions to start from, grouped by genre family, realized in the key (the other mode on its relative). */
export function starts(key: Key): StartGroup[] {
  return engine.starts(engineKey(key)).map((g) => ({
    name: g.name,
    items: g.items.map((x) => {
      const bars = <T,>(list: T[]) => list.flatMap((v, i) => Array.from({ length: x.repeat?.[i] ?? 1 }, () => v));
      return {
        id: x.id, name: x.name, genre: x.genre, mood: x.mood, mode: x.mode, note: x.note,
        key: { tonic: engine.parse(x.tonic).root, mode: x.mode },
        chords: bars(x.chords.map(siteChord)),
        lanes: bars(x.lanes),
      };
    }),
  }));
}

/** Runs of the same chord in a row become one column with a count (12-bar: C7 x4, F7 x2...). */
export function collapseRepeats<T>(chords: T[], same: (a: T, b: T) => boolean): { chord: T; count: number; first: number }[] {
  const out: { chord: T; count: number; first: number }[] = [];
  chords.forEach((c, i) => {
    const last = out[out.length - 1];
    if (last && same(last.chord, c)) last.count++;
    else out.push({ chord: c, count: 1, first: i });
  });
  return out;
}

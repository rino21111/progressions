// What to play after the progression (Natural, or Spicy from outside the key), each idea with an
// optional "then" phrase from the library; and what to start with when there's nothing yet. The
// engine (engine.ts) decides; this turns the site's chords into its symbols and back.

import { Chord } from './chords';
import { Key, chordSymbolInKey, romanNumeral, spellRootInKey, tonicName } from './keys';
import { Lane, laneInfo } from './progressionMap';
import { ideaTag, secondaryTarget } from './progressions';
import { parseChordName } from './search';
import * as engine from './engine';

export type { StyleName } from './engine';
export const STYLES = engine.STYLES;

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

const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const engineKey = (key: Key): engine.EngineKeyInput => ({ tonic: key.tonic, mode: key.mode, name: tonicName(key) });

/**
 * The engine's symbol for a site chord: its root spelled in the key (no slash, no double accidental) and
 * the site's own suffix, which the engine reads for every chord type (colour chords as their base).
 */
export function engineSymbol(c: Chord, key: Key): string {
  let root = spellRootInKey(key, c.root);
  if (/bb|##/.test(root)) root = (root.includes('#') ? SHARP : FLAT)[c.root];
  return root + c.template.suffix;
}

/** A site chord for an engine symbol, through the site's own chord-name reader. */
export function siteChord(symbol: string): Chord {
  const c = parseChordName(symbol);
  if (!c) throw new Error(`Unreadable chord from the engine: ${symbol}`);
  return c;
}

const DEGREE = /^(bb|b|#)?(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)/;
/**
 * A chord the engine supplied, as the site shows it: the engine's root spelling and degree (G#dim7,
 * #v°7 leading to Am), with the site's own suffix formatting (ii(add9), not iiadd9).
 */
function supplied(symbol: string, numeral: string, key: Key): Chord {
  const c = siteChord(symbol);
  c.spelling = /^[A-G][#b]?/.exec(symbol)![0];
  const degree = DEGREE.exec(numeral)?.[0] ?? '';
  const site = romanNumeral(c, key);
  c.numeral = degree + site.slice(DEGREE.exec(site)?.[0].length ?? 0);
  return c;
}

/** The key's own chords in a style (minor adds the harmonic V, marked borrowed): the Key band. */
export function keyChords(key: Key, style: engine.StyleName): { chord: Chord; borrowed: boolean }[] {
  const k = engineKey(key);
  return engine.diatonicSet(k, style).map((c, i) => ({ chord: supplied(c.symbol, engine.numeral(c, k), key), borrowed: key.mode === 'minor' && i === 7 }));
}

/** Up to four ideas for after the progression's last chord (Natural, or Spicy from outside the key). */
export function afterIdeas(progression: Chord[], key: Key, opts: { spice: boolean; style?: engine.StyleName }): AfterIdea[] {
  if (!progression.length) return [];
  const first = progression[0];
  return engine.afterIdeas(progression.map((c) => engineSymbol(c, key)), engineKey(key), { spice: opts.spice, style: opts.style }).map((x) => {
    const t = x.then;
    let then: ThenPhrase | null = null;
    if (t) {
      const chords = t.chords.map((sym, i) => supplied(sym, t.numerals[i], key));
      // the return is the progression's own first chord, as played
      if (t.returnsHome) chords[chords.length - 1] = first;
      then = { name: t.name, genre: t.genre, mood: t.mood, chords, numerals: t.numerals, lanes: t.lanes, returnsHome: t.returnsHome };
    }
    const chord = supplied(x.chord, x.numeral, key);
    return { chord, numeral: chord.numeral!, lane: x.lane, tag: x.tag || null, why: x.why, then };
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
  /** The style its chords imply: adding it to an empty progression sets the style control. */
  style: engine.StyleName;
}

export interface StartGroup {
  name: string;
  /** Shown first (at most four). */
  items: StartItem[];
  /** The rest, behind a More control. */
  more: StartItem[];
}

/** Progressions to start from, grouped by genre family, realized in the key (the other mode on its relative). */
export function starts(key: Key): StartGroup[] {
  const item = (x: engine.EngineStart): StartItem => {
    const bars = <T,>(list: T[]) => list.flatMap((v, i) => Array.from({ length: x.repeat?.[i] ?? 1 }, () => v));
    const k: Key = { tonic: engine.parse(x.tonic).root, mode: x.mode };
    return {
      id: x.id, name: x.name, genre: x.genre, mood: x.mood, mode: x.mode, note: x.note, style: x.style,
      key: k,
      chords: bars(x.chords.map((sym, i) => supplied(sym, x.numerals[i], k))),
      lanes: bars(x.lanes),
    };
  };
  return engine.starts(engineKey(key)).map((g) => ({ name: g.name, items: g.items.map(item), more: g.more.map(item) }));
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

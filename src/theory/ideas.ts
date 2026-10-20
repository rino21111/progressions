// What to play after the progression (Natural, or Spicy from outside the key), each idea with an
// optional "then" phrase from the library; and what to start with when there's nothing yet. The
// engine (engine.ts) decides; this turns the site's chords into its symbols and back.

import { Chord } from './chords';
import { Key, keyId, romanNumeral, spellRootInKey, tonicName } from './keys';
import { Lane } from './progressionMap';
import { parseChordName } from './search';
import { parseNote } from './notes';
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

/** An engine idea as the site shows it; a then phrase that returns home ends on the progression's own first chord. */
function siteIdea(x: engine.EngineIdea, key: Key, first: Chord): AfterIdea {
  const t = x.then;
  let then: ThenPhrase | null = null;
  if (t) {
    const chords = t.chords.map((sym, i) => supplied(sym, t.numerals[i], key));
    if (t.returnsHome) chords[chords.length - 1] = first;
    then = { name: t.name, genre: t.genre, mood: t.mood, chords, numerals: t.numerals, lanes: t.lanes, returnsHome: t.returnsHome };
  }
  const chord = supplied(x.chord, x.numeral, key);
  return { chord, numeral: chord.numeral!, lane: x.lane, tag: x.tag || null, why: x.why, then };
}

/** Up to four ideas for after the progression's last chord (Natural, or Spicy from outside the key). */
export function afterIdeas(progression: Chord[], key: Key, opts: { spice: boolean; style?: engine.StyleName }): AfterIdea[] {
  if (!progression.length) return [];
  return engine.afterIdeas(progression.map((c) => engineSymbol(c, key)), engineKey(key), { spice: opts.spice, style: opts.style })
    .map((x) => siteIdea(x, key, progression[0]));
}

export type Mood = engine.Mood;

/** What could come after the progression, grouped by how the move feels (Resolve, Lift, Drift, Darken, Tension). */
export function nextByMood(progression: Chord[], key: Key, style?: engine.StyleName): { mood: Mood; ideas: AfterIdea[] }[] {
  if (!progression.length) return [];
  return engine.nextByMood(progression.map((c) => engineSymbol(c, key)), engineKey(key), { style })
    .map((g) => ({ mood: g.mood, ideas: g.ideas.map((x) => siteIdea(x, key, progression[0])) }));
}

/** The degree alone (I for Cadd9, II for D7, #v for G#dim7), for a chip. */
export const degreeOf = (numeral: string): string => DEGREE.exec(numeral)?.[0] ?? numeral;

/** The reason for an idea's title: its tag, then its why, less an "As in" that only repeats the tag. */
export function ideaReason(idea: AfterIdea): string {
  const why = idea.why.split('; ').filter((w) => w !== `As in ${idea.tag}`).join('; ');
  return [idea.tag, why].filter(Boolean).join('. ');
}

export interface ReasonContext {
  /** The numeral of the chord the page says After (the heading already names it). */
  after: string;
  /** The progression by numerals, as library names write it ("I–V–vi–IV"). */
  progression: string;
  /** The root of the then line's first chord, when there's a then line. */
  thenRoot: number | null;
}

const FUNCTION_PHRASE = /^(Stays (tonic|predominant|dominant)|(Tonic|Predominant|Dominant) to (tonic|predominant|dominant))$/;

/**
 * The reason for the detail panel, without what the panel already shows: the notes kept (the moves line
 * says them), "Common after" the heading's chord, "As in" the progression itself, "Leads to" where the
 * then line goes, and the function change when there's a then line. Empty when nothing is left.
 */
export function ideaWhy(idea: AfterIdea, ctx: ReasonContext): string {
  const parts = [idea.tag, ...idea.why.split('; ')].filter((p): p is string => !!p);
  return parts.filter((p, i) => {
    if (i > 0 && p === `As in ${idea.tag}`) return false;
    if (/^Keeps /.test(p)) return false;
    // The engine writes the chord as a triad (III); the heading may show III7.
    if (p.startsWith('Common after ') && degreeOf(p.slice('Common after '.length)) === degreeOf(ctx.after)) return false;
    if (p === `As in ${ctx.progression}`) return false;
    const lead = /^Leads to ([A-G][#b]?)/.exec(p);
    if (lead && ctx.thenRoot !== null && parseNote(lead[1]) === ctx.thenRoot) return false;
    if (ctx.thenRoot !== null && FUNCTION_PHRASE.test(p)) return false;
    return true;
  }).join('. ');
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

/** What adding a start to an empty progression also sets: its style, and the key it's listed in. */
export const startSettings = (item: StartItem): { style: engine.StyleName; keyChoice: string } =>
  ({ style: item.style, keyChoice: keyId(item.key) });

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

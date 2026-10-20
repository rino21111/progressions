// The address bar carries the state, so copying it shares it: the page route, then the progression
// (with any card shape that isn't the usual one), the key when one is chosen, the chord style, the
// playback settings and, on the Chord page, its chord and shape. Values equal to the defaults are
// left out: #next&p=C.G.Am.F&bpm=120. Unknown or invalid parameters are skipped.

import { AppState, DEFAULTS, ProgressionChord, state, subscribe, update } from './state';
import { Chord, chordSymbol } from './theory/chords';
import { Fingering, analyzeFingering, formatFingering, parseFingering } from './theory/fingering';
import { ALL_KEYS, Key, chordSymbolInKey, keyId, rankKeys, tonicName } from './theory/keys';
import { parseNote } from './theory/notes';
import { PLAY_STYLES, PlayStyle } from './theory/patterns';
import { parseChordName } from './theory/search';
import { MAX_BPM, MIN_BPM } from './theory/timing';
import { STYLES, StyleName } from './theory/engine';
import { bestVoicing } from './theory/voicings';
import { OLD_TAB_HASHES, TAB_HASHES } from './tabs';
import { noteCause } from './undo';
import type { Tone } from './audio';

const TONES: Tone[] = ['steel', 'nylon', 'electric'];
export type Page = keyof typeof TAB_HASHES;

export interface Shared {
  page: Page | null;
  /** The whole shared state: what the link leaves out is the default. playVariants holds only the linked style's variant. */
  patch: Partial<AppState>;
}

// Only what would break the hash is escaped (C#m7 -> C%23m7); slashes and dots stay readable.
const esc = (s: string) => s.replace(/[%#&=+ ]/g, encodeURIComponent);
const sameShape = (a: Fingering | null | undefined, b: Fingering | null | undefined) => !!a && !!b && formatFingering(a) === formatFingering(b);
const sameChord = (a: Chord | null, b: Chord | null) => !!a && !!b && a.root === b.root && a.template.id === b.template.id && a.bass === b.bass;
const keyParam = (k: Key) => `${tonicName(k)}${k.mode === 'minor' ? 'm' : ''}`;

/** The key the page uses: the one chosen, or the best guess (as on the Next page). */
const keyFor = (s: AppState): Key =>
  ALL_KEYS.find((k) => keyId(k) === s.keyChoice) ?? rankKeys(s.progression)[0]?.key ?? { tonic: 0, mode: 'major' };

/** The hash for the state on a page: the route, then whatever differs from the defaults. Progression chords are spelled in the key, as the page shows them. */
export function stateHash(s: AppState, page: Page): string {
  const out: string[] = [TAB_HASHES[page]];
  const inKey = keyFor(s);
  const name = (c: Chord) => chordSymbolInKey(c, inKey);
  const add = (name: string, value: string | number, isDefault: boolean) => { if (!isDefault) out.push(`${name}=${value}`); };
  if (s.progression.length) {
    out.push(`p=${s.progression.map((c) => esc(name(c))).join('.')}`);
    const shapes = s.progression.map((c) => (c.fingering && !sameShape(c.fingering, bestVoicing(c)) ? formatFingering(c.fingering) : '_'));
    if (shapes.some((f) => f !== '_')) out.push(`f=${shapes.join('.')}`);
  }
  const [tonic, mode] = (s.keyChoice ?? '').split('-');
  if (s.keyChoice && (mode === 'major' || mode === 'minor')) out.push(`key=${esc(keyParam({ tonic: Number(tonic), mode }))}`);
  add('style', s.style, s.style === DEFAULTS.style);
  const variant = s.playVariants[s.playPattern];
  add('play', `${s.playPattern}.${variant}`, s.playPattern === DEFAULTS.playPattern && variant === DEFAULTS.playVariants[s.playPattern]);
  add('bpm', s.bpm, s.bpm === DEFAULTS.bpm);
  add('time', s.beatsPerBar, s.beatsPerBar === DEFAULTS.beatsPerBar);
  add('bars', s.barsPerChord, s.barsPerChord === DEFAULTS.barsPerChord);
  add('tone', s.tone, s.tone === DEFAULTS.tone);
  add('swing', s.swing ? 1 : 0, s.swing === DEFAULTS.swing);
  add('loop', s.loop ? 1 : 0, s.loop === DEFAULTS.loop);
  add('kn', s.keyNotes ? 1 : 0, s.keyNotes === DEFAULTS.keyNotes);
  if (page === 'detector') {
    const usual = s.selected ? bestVoicing(s.selected) : null;
    const isDefault = sameChord(s.selected, DEFAULTS.selected) && sameShape(s.fingering, DEFAULTS.fingering);
    if (s.selected && !isDefault) out.push(`c=${esc(chordSymbol(s.selected))}`);
    if (!isDefault && !sameShape(s.fingering, usual)) out.push(`cf=${formatFingering(s.fingering)}`);
  }
  return out.join('&');
}

/** A hash read as a shared state; null when it carries no state (the bare site, or only a route). */
export function readShare(hash: string): Shared | null {
  const parts = hash.replace(/^#/, '').split('&').filter(Boolean);
  const route = parts[0] && !parts[0].includes('=') ? parts.shift()! : '';
  const params = new Map<string, string>();
  for (const part of parts) {
    const i = part.indexOf('=');
    if (i <= 0) continue;
    try {
      params.set(part.slice(0, i), decodeURIComponent(part.slice(i + 1)));
    } catch {
      // A broken escape: that parameter is skipped.
    }
  }
  const pages = Object.keys(TAB_HASHES) as Page[];
  const routed = pages.find((p) => TAB_HASHES[p] === route) ?? OLD_TAB_HASHES[route as keyof typeof OLD_TAB_HASHES]
    ?? pages.find((p) => TAB_HASHES[p] === params.get('page')) ?? null; // links from before the route came first
  params.delete('page');
  if (!params.size) return null;
  const get = (name: string) => params.get(name);
  const has = (name: string) => params.has(name);
  // Links made by the first Share button (v=1) gave a chord's shape as f.
  if (get('v') === '1' && has('c') && !has('p') && !has('cf')) params.set('cf', get('f') ?? '');

  const patch: Partial<AppState> = {
    style: DEFAULTS.style, keyChoice: null, playPattern: DEFAULTS.playPattern, bpm: DEFAULTS.bpm, beatsPerBar: DEFAULTS.beatsPerBar,
    barsPerChord: DEFAULTS.barsPerChord, tone: DEFAULTS.tone, swing: DEFAULTS.swing, loop: DEFAULTS.loop, keyNotes: DEFAULTS.keyNotes, selectedCard: null,
  };
  const play = get('play')?.split('.');
  const style = PLAY_STYLES.find((st) => st.id === play?.[0]);
  if (style) {
    patch.playPattern = style.id as PlayStyle;
    const variant = style.variants.find((v) => v.id === play?.[1]) ?? style.variants[0];
    patch.playVariants = { [style.id]: variant.id } as AppState['playVariants'];
  } else patch.playVariants = { [DEFAULTS.playPattern]: DEFAULTS.playVariants[DEFAULTS.playPattern] } as AppState['playVariants'];
  const bpm = Number(get('bpm'));
  if (has('bpm') && Number.isInteger(bpm) && bpm >= MIN_BPM && bpm <= MAX_BPM) patch.bpm = bpm;
  if (get('time') === '3' || get('time') === '4') patch.beatsPerBar = Number(get('time')) as AppState['beatsPerBar'];
  if (get('bars') === '1' || get('bars') === '2') patch.barsPerChord = Number(get('bars'));
  if (TONES.includes(get('tone') as Tone)) patch.tone = get('tone') as Tone;
  if (get('swing') === '0' || get('swing') === '1') patch.swing = get('swing') === '1';
  if (get('loop') === '0' || get('loop') === '1') patch.loop = get('loop') === '1';
  if (get('kn') === '0' || get('kn') === '1') patch.keyNotes = get('kn') === '1';
  if (STYLES.includes(get('style') as StyleName)) patch.style = get('style') as StyleName;
  const key = /^([A-G][#b]?)(m?)$/.exec(get('key') ?? '');
  const tonic = key ? parseNote(key[1]) : null;
  if (tonic !== null) patch.keyChoice = keyId({ tonic, mode: key![2] ? 'minor' : 'major' });

  const shapes = (get('f') ?? '').split('.');
  const progression: ProgressionChord[] = [];
  if (!(get('v') === '1' && !has('p'))) {
    (get('p') ?? '').split('.').forEach((name, i) => {
      const chord: ProgressionChord | null = name ? parseChordName(name) : null;
      if (!chord) return;
      const shape = shapes[i] && shapes[i] !== '_' ? parseFingering(shapes[i]) : null;
      if (shape) chord.fingering = shape;
      progression.push(chord);
    });
    patch.progression = progression;
  }

  // The Chord page's chord: named and/or shaped; a Chord page link without one shows the default chord.
  const chord = has('c') ? parseChordName(get('c')!) : null;
  const shape = has('cf') ? parseFingering(get('cf')!) : null;
  const page = routed ?? (has('c') || has('cf') ? 'detector' : null);
  if (chord || shape) {
    patch.fingering = shape ?? bestVoicing(chord!) ?? DEFAULTS.fingering;
    const found = analyzeFingering(patch.fingering).matches[0];
    patch.selected = chord ?? (found ? { root: found.root, template: found.template, bass: found.bass } : null);
  } else if (page === 'detector') {
    patch.selected = DEFAULTS.selected;
    patch.fingering = DEFAULTS.fingering;
  }
  return { page, patch };
}

/** Open a shared state: it replaces the progression and settings, as an edit Undo can take back. */
export function applyShare(shared: Shared) {
  const patch = { ...shared.patch, playVariants: { ...state.playVariants, ...shared.patch.playVariants } };
  if (patch.fingering) noteCause('hand');
  update(patch);
}

/**
 * Load from the address: a shared state is applied (unless it's this browser's own state, as after a
 * reload); otherwise the saved state stays. Returns the page to show.
 */
export function openFromHash(hash: string, fallback: Page): Page {
  const shared = readShare(hash);
  if (!shared) return readRoute(hash) ?? fallback;
  const page = shared.page ?? fallback;
  if (hash.replace(/^#/, '') !== stateHash(state, page)) applyShare(shared);
  return page;
}

/** Just the route (#next, or an old #relationships). */
export function readRoute(hash: string): Page | null {
  const route = hash.replace(/^#/, '').split('&')[0];
  return (Object.keys(TAB_HASHES) as Page[]).find((p) => TAB_HASHES[p] === route)
    ?? OLD_TAB_HASHES[route as keyof typeof OLD_TAB_HASHES] ?? null;
}

/** Keep the address in step with the state, 300ms after the last change; never a new history entry. */
export function syncHash(page: () => Page, write: (hash: string) => void, delay = 300): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const now = () => {
    clearTimeout(timer);
    write(stateHash(state, page()));
  };
  subscribe(() => {
    clearTimeout(timer);
    timer = setTimeout(now, delay);
  });
  return now;
}

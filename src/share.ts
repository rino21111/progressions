// Share links: a progression or a chord, with every playback setting, written into the address's hash
// (#v=1&p=C.G.Am.F&key=C&style=triads&bpm=160&loop=1...), so nothing goes to a server. Unknown or
// invalid parameters are ignored and the rest still load.

import { AppState, ProgressionChord } from './state';
import { Chord, chordSymbol } from './theory/chords';
import { Fingering, formatFingering, parseFingering } from './theory/fingering';
import { Key, keyId, tonicName } from './theory/keys';
import { parseNote } from './theory/notes';
import { PLAY_STYLES, PlayStyle } from './theory/patterns';
import { parseChordName } from './theory/search';
import { MAX_BPM, MIN_BPM } from './theory/timing';
import { STYLES, StyleName } from './theory/engine';
import { bestVoicing } from './theory/voicings';
import { TAB_HASHES } from './tabs';
import type { Tone } from './audio';

const VERSION = '1';
const TONES: Tone[] = ['steel', 'nylon', 'electric'];
export type Page = keyof typeof TAB_HASHES;

/** Settings every link carries. */
type Settings = Pick<AppState, 'playPattern' | 'bpm' | 'beatsPerBar' | 'barsPerChord' | 'tone' | 'swing' | 'loop'> & { variant: string };

export interface Shared {
  kind: 'progression' | 'chord';
  page: Page | null;
  /** What to set; playVariants holds only the linked style's variant (merged into the rest). */
  patch: Partial<AppState>;
}

// Only what would break the hash is escaped (C#m7 -> C%23m7); slashes and dots stay readable.
const esc = (s: string) => s.replace(/[%#&=+ ]/g, encodeURIComponent);
const same = (a: Fingering | null, b: Fingering | null) => !!a && !!b && formatFingering(a) === formatFingering(b);
const keyParam = (k: Key) => `${tonicName(k)}${k.mode === 'minor' ? 'm' : ''}`;

function settingsParams(s: Settings): string[] {
  return [
    `play=${s.playPattern}.${s.variant}`, `bpm=${s.bpm}`, `time=${s.beatsPerBar}`, `bars=${s.barsPerChord}`,
    `tone=${s.tone}`, `swing=${s.swing ? 1 : 0}`, `loop=${s.loop ? 1 : 0}`,
  ];
}

const settingsOf = (s: AppState): Settings => ({
  playPattern: s.playPattern, variant: s.playVariants[s.playPattern], bpm: s.bpm, beatsPerBar: s.beatsPerBar,
  barsPerChord: s.barsPerChord, tone: s.tone, swing: s.swing, loop: s.loop,
});

/** The hash for the progression: its chords (and any shape that isn't the usual one), key, style, settings and page. */
export function progressionHash(s: AppState, page: Page): string {
  const chords = s.progression.map((c) => esc(chordSymbol(c)));
  const shapes = s.progression.map((c) => (c.fingering && !same(c.fingering, bestVoicing(c)) ? formatFingering(c.fingering) : '_'));
  const [tonic, mode] = (s.keyChoice ?? '').split('-');
  const key = s.keyChoice && (mode === 'major' || mode === 'minor') ? keyParam({ tonic: Number(tonic), mode }) : null;
  return [
    `v=${VERSION}`, `p=${chords.join('.')}`,
    shapes.some((f) => f !== '_') ? `f=${shapes.join('.')}` : null,
    key ? `key=${esc(key)}` : null, `style=${s.style}`,
    ...settingsParams(settingsOf(s)), `page=${TAB_HASHES[page]}`,
  ].filter(Boolean).join('&');
}

/** The hash for a chord: its name and shape, and the settings. It opens on the Chord page. */
export function chordHash(chord: Chord, fingering: Fingering, s: AppState): string {
  return [`v=${VERSION}`, `c=${esc(chordSymbol(chord))}`, `f=${formatFingering(fingering)}`, ...settingsParams(settingsOf(s))].join('&');
}

/** A shared link's hash, read; null when the hash isn't a share link (#next, #chord). */
export function readShare(hash: string): Shared | null {
  const params = new Map<string, string>();
  for (const part of hash.replace(/^#/, '').split('&')) {
    const i = part.indexOf('=');
    if (i <= 0) continue;
    try {
      params.set(part.slice(0, i), decodeURIComponent(part.slice(i + 1)));
    } catch {
      // A broken escape: that parameter is ignored.
    }
  }
  if (!params.has('p') && !params.has('c')) return null;
  const patch: Partial<AppState> = {};
  const get = (name: string) => params.get(name);

  const play = get('play')?.split('.');
  const style = PLAY_STYLES.find((st) => st.id === play?.[0]);
  if (style) {
    patch.playPattern = style.id as PlayStyle;
    const variant = style.variants.find((v) => v.id === play?.[1]);
    if (variant) patch.playVariants = { [style.id]: variant.id } as AppState['playVariants'];
  }
  const bpm = Number(get('bpm'));
  if (get('bpm') && Number.isInteger(bpm) && bpm >= MIN_BPM && bpm <= MAX_BPM) patch.bpm = bpm;
  if (get('time') === '3' || get('time') === '4') patch.beatsPerBar = Number(get('time')) as AppState['beatsPerBar'];
  if (get('bars') === '1' || get('bars') === '2') patch.barsPerChord = Number(get('bars'));
  if (TONES.includes(get('tone') as Tone)) patch.tone = get('tone') as Tone;
  if (get('swing') === '0' || get('swing') === '1') patch.swing = get('swing') === '1';
  if (get('loop') === '0' || get('loop') === '1') patch.loop = get('loop') === '1';

  if (params.has('c')) {
    const chord = parseChordName(get('c')!);
    if (!chord) return Object.keys(patch).length ? { kind: 'chord', page: 'detector', patch } : null;
    const shape = parseFingering(get('f') ?? '') ?? bestVoicing(chord);
    patch.selected = chord;
    if (shape) patch.fingering = shape;
    patch.selectedCard = null;
    return { kind: 'chord', page: 'detector', patch };
  }

  const shapes = (get('f') ?? '').split('.');
  const progression: ProgressionChord[] = [];
  get('p')!.split('.').forEach((name, i) => {
    const chord: ProgressionChord | null = parseChordName(name);
    if (!chord) return;
    const shape = shapes[i] && shapes[i] !== '_' ? parseFingering(shapes[i]) : null;
    if (shape) chord.fingering = shape;
    progression.push(chord);
  });
  patch.progression = progression;
  patch.selectedCard = null;
  // No key: Best guess. A key that can't be read is ignored.
  const key = /^([A-G][#b]?)(m?)$/.exec(get('key') ?? '');
  const tonic = key ? parseNote(key[1]) : null;
  if (tonic !== null) patch.keyChoice = keyId({ tonic, mode: key![2] ? 'minor' : 'major' });
  else if (!params.has('key')) patch.keyChoice = null;
  if (STYLES.includes(get('style') as StyleName)) patch.style = get('style') as StyleName;
  const page = (Object.keys(TAB_HASHES) as Page[]).find((p) => TAB_HASHES[p] === get('page')) ?? null;
  return { kind: 'progression', page, patch };
}

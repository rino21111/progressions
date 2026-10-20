// Shared app state with simple change notifications and local persistence.

import { STYLES, StyleName } from './theory/engine';
import { Chord, makeChord } from './theory/chords';
import { Fingering } from './theory/fingering';
import { BeatsPerBar, PLAY_STYLES, PlayStyle, validVariant } from './theory/patterns';
import type { Tone } from './audio';
import { DEFAULT_BPM } from './theory/timing';

export type LabelMode = 'interval' | 'note';
/** Which list of chords to add is showing on the progressions page. */
export type AddMode = 'suggested' | 'spice';

interface StoredChord {
  root: number;
  type: string;
  bass: number;
  fingering?: Fingering;
}

/** A chord in the progression, with the exact shape it was added with (none: its usual shape). */
export interface ProgressionChord extends Chord {
  fingering?: Fingering;
}

/** The progression as saved: names plus each card's shape. */
export function storeProgression(list: ProgressionChord[]): StoredChord[] {
  return list.map((c) => ({ root: c.root, type: c.template.id, bass: c.bass, ...(c.fingering ? { fingering: c.fingering } : {}) }));
}

/** Read a saved progression; older saves have no shapes, so those cards use the usual shape. */
export function loadProgression(stored: StoredChord[]): ProgressionChord[] {
  return stored.map((c) => {
    const chord: ProgressionChord = makeChord(c.root, c.type, c.bass);
    if (Array.isArray(c.fingering) && c.fingering.length === 6) chord.fingering = c.fingering;
    return chord;
  });
}

export interface AppState {
  /** The selected chord, shown in the header and on the Chord Inspector (null when the shape isn't a chord). */
  selected: Chord | null;
  /** The shape on the Inspector's fretboard: the selected chord's fingering. */
  fingering: Fingering;
  labelMode: LabelMode;
  showNeck: boolean;
  /** The key backdrop: the key's notes as faint dots on the neck, and chord tones outside it ringed. */
  keyNotes: boolean;
  /** Show the chord's structure (the stack) instead of the tone chips. A view preference. */
  showStructure: boolean;
  /** Show the shared-notes map under the progression. A view preference. */
  showMap: boolean;
  progression: ProgressionChord[];
  /** The progression card that was clicked (index), or null. Never an undo step. */
  selectedCard: number | null;
  /** How chords are written on Next…: triads, 7ths, 9ths or add9. */
  style: StyleName;
  /** Key chosen on the progressions page, or null to use the best guess. */
  keyChoice: string | null;
  addMode: AddMode;
  /** How the header player plays each chord. */
  playPattern: PlayStyle;
  /** The chosen variant of each style (e.g. strum: 'folk'). */
  playVariants: Record<PlayStyle, string>;
  /** Loop the progression; and, separately, the Inspector's chord. */
  loop: boolean;
  chordLoop: boolean;
  bpm: number;
  /** On the progressions page, how many bars each chord lasts (1 or 2). */
  barsPerChord: number;
  swing: boolean;
  beatsPerBar: BeatsPerBar;
  tone: Tone;
}

const STORAGE_KEY = 'guitar-theory-state-v1';
/** Bumped when a default changes, so a save made under the old defaults can pick up the new ones. */
const SAVE_VERSION = 2;

/**
 * A save from before 160 bpm and looping became the defaults: a value equal to the old default (80
 * bpm, no loop) counts as unset, once. A tempo chosen on purpose stays.
 */
export function migrateDefaults(data: Record<string, unknown>): Record<string, unknown> {
  const out = { ...data };
  if (out.v !== SAVE_VERSION) {
    if (out.bpm === 80) delete out.bpm;
    if (out.loop === false) delete out.loop;
  }
  delete out.v;
  return out;
}

export const DEFAULTS: AppState = {
  selected: makeChord(0, 'maj'),
  fingering: [null, 3, 2, 0, 1, 0],
  labelMode: 'interval',
  showNeck: false,
  keyNotes: true,
  showStructure: false,
  showMap: false,
  progression: [],
  selectedCard: null,
  style: 'triads',
  keyChoice: null,
  addMode: 'suggested',
  playPattern: 'strum',
  playVariants: { strum: 'whole', arpeggio: 'up', travis: 'basic', bossa: 'basic', postrock: 'cascade' },
  loop: true,
  chordLoop: false,
  bpm: DEFAULT_BPM,
  barsPerChord: 1,
  swing: false,
  beatsPerBar: 4,
  tone: 'steel',
};

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const data = migrateDefaults(JSON.parse(raw)) as any;
    // Older saves had a 7th-chords switch.
    if (!STYLES.includes(data.style)) data.style = data.sevenths ? 'sevenths' : 'triads';
    delete data.sevenths;
    // Settings that no longer exist.
    delete data.countIn;
    delete data.walkUps;
    delete data.place;
    // Older saves may name a style that's gone (e.g. "block") or lack variants.
    const style: PlayStyle = PLAY_STYLES.some((s) => s.id === data.playPattern) ? data.playPattern : 'strum';
    const variants = Object.fromEntries(
      PLAY_STYLES.map((s) => [s.id, validVariant(s.id, data.playVariants?.[s.id])]),
    ) as Record<PlayStyle, string>;
    return {
      ...DEFAULTS,
      ...data,
      playPattern: style,
      playVariants: variants,
      progression: loadProgression(data.progression ?? []),
      selected: data.selected === undefined ? DEFAULTS.selected
        : data.selected && makeChord(data.selected.root, data.selected.type, data.selected.bass),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(state: AppState) {
  try {
    const data = {
      v: SAVE_VERSION,
      ...state,
      progression: storeProgression(state.progression),
      selected: state.selected && { root: state.selected.root, type: state.selected.template.id, bass: state.selected.bass },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage can be unavailable (private mode); the app still works without it.
  }
}

type Listener = (state: AppState) => void;
const listeners = new Set<Listener>();

export const state: AppState = load();

export function update(patch: Partial<AppState>) {
  Object.assign(state, patch);
  save(state);
  listeners.forEach((fn) => fn(state));
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Plays a chord or a list of chords bar by bar in the chosen pattern, optionally looping.

import { SessionBus, createSessionBus, now, ready, silenceBus, strum } from './audio';
import { state } from './state';
import { Fingering, soundingNotes } from './theory/fingering';
import { ECHO_STYLES, STRAIGHT_STYLES, expandTremolo, patternEvents } from './theory/patterns';
import { chordForBar, swingBeat } from './theory/timing';

/** How far ahead (in seconds) bars are handed to the audio clock. */
const LOOKAHEAD = 0.25;

/** What's playing: which source, and which of its chords is sounding (null during the count-in). */
export interface Playback {
  id: string;
  step: number | null;
  /** For a bar: when it starts on the audio clock (see audio's now()), its beat length in seconds and beats, whether swing moves its "and"s, and its bar counts (within the pass, and in total). */
  bar?: { start: number; beat: number; beats: number; swing: boolean; inPass: number; played: number };
}

export interface PlayOptions {
  /** Whether the "bars per chord" setting applies (true for progressions, not a single chord). */
  perChord?: boolean;
  /** Whether to go round again at the end (read live); defaults to the progression's Loop. */
  loop?: () => boolean;
}

interface Session {
  id: string;
  chords: () => Fingering[];
  perChord: boolean;
  loop: () => boolean;
  bus: SessionBus;
  /** Bar within the chord list (resets when looping), and bars played in total. */
  bar: number;
  /** The chord of the bar scheduled last (null before the first). */
  lastStep: number | null;
  played: number;
  nextTime: number;
  ticker: number;
  timers: number[];
}

let session: Session | null = null;
let playback: Playback | null = null;
const listeners = new Set<(p: Playback | null) => void>();
const noteListeners = new Set<(strings: number[], p: Playback) => void>();

function announce(p: Playback | null) {
  playback = p;
  listeners.forEach((fn) => fn(p));
}

export function currentPlayback(): Playback | null {
  return playback;
}

export function onPlayback(fn: (p: Playback | null) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Called as each string is picked (string 0 = low E), in time with the sound, with the chord it belongs to. */
export function onNote(fn: (strings: number[], p: Playback) => void): () => void {
  noteListeners.add(fn);
  return () => noteListeners.delete(fn);
}

/** Schedule one bar and return its length in seconds. */
function scheduleBar(s: Session, step: number, fingering: Fingering, start: number): Playback {
  // Read the settings each bar so changing them while playing takes effect on the next bar.
  const beat = 60 / state.bpm;
  const notes = soundingNotes(fingering);
  const style = state.playPattern;
  const swing = state.swing && !STRAIGHT_STYLES.includes(style);
  const p: Playback = { id: s.id, step, bar: { start, beat, beats: state.beatsPerBar, swing, inPass: s.bar, played: s.played } };
  // Tremolo notes sound as fast alternating strikes; post-rock plays through the echo.
  const events = patternEvents(style, state.playVariants[style], notes, state.beatsPerBar, s.played)
    .flatMap((e) => (e.tremolo ? expandTremolo(e, state.bpm) : [e]));
  s.bus.setEcho(ECHO_STYLES.includes(style), beat, start);
  const tell = (delay: number, strings: number[]) =>
    s.timers.push(window.setTimeout(() => session === s && noteListeners.forEach((fn) => fn(strings, p)), Math.max(0, delay)));

  for (const e of events) {
    const at = start + swingBeat(e.beat, swing) * beat;
    const length = e.lengthBeats === undefined ? undefined : e.lengthBeats * beat;
    const strings = e.midis.map((m) => notes.find((n) => n.midi === m)!.string);
    strum(e.midis, { at, delayMs: e.spreadMs, up: e.up, volume: e.volume, bus: s.bus.input, strings, length });
    // Tell listeners when each string sounds, following the strum's order and spread.
    const order = [...e.midis].sort((a, b) => (e.up ? b - a : a - b));
    order.forEach((midi, i) => {
      const lit = notes.filter((n) => n.midi === midi).map((n) => n.string);
      tell((at + (i * e.spreadMs) / 1000 - now()) * 1000, lit);
    });
  }
  return p;
}

function endSession(s: Session) {
  clearInterval(s.ticker);
  s.timers.forEach(clearTimeout);
  if (session === s) {
    session = null;
    announce(null);
  }
}

/**
 * Start playing. `chords` is read again at every bar, so editing the chord or
 * the list while it plays (or loops) is heard straight away.
 */
export function play(id: string, chords: () => Fingering[], options: PlayOptions = {}) {
  stop();
  if (!chords().length) return;
  const s: Session = {
    id, chords, perChord: options.perChord ?? false, loop: options.loop ?? (() => state.loop),
    bus: createSessionBus(), bar: 0, lastStep: null, played: 0, nextTime: now() + 0.05, ticker: 0, timers: [],
  };
  session = s;
  announce({ id, step: null });
  // The recordings load on first use; start the clock once they're ready (unless stopped meanwhile).
  void ready().then(() => session === s && start(s));
}

function start(s: Session) {
  s.nextTime = now() + 0.05;

  const tick = () => {
    while (session === s && s.nextTime < now() + LOOKAHEAD) {
      const list = s.chords();
      const barsPerChord = s.perChord ? state.barsPerChord : 1;
      let step = chordForBar(s.bar, list.length, barsPerChord);
      if (step === null && s.loop() && list.length) {
        s.bar = 0;
        step = 0;
      }
      if (step === null) {
        // Let the last bar finish, then report that playback is over.
        clearInterval(s.ticker);
        s.timers.push(window.setTimeout(() => endSession(s), Math.max(0, (s.nextTime - now()) * 1000)));
        setTimeout(() => s.bus.output.disconnect(), (s.nextTime - now() + 5) * 1000);
        return;
      }
      s.lastStep = step;
      const p = scheduleBar(s, step, list[step], s.nextTime);
      const length = p.bar!.beat * p.bar!.beats;
      s.timers.push(window.setTimeout(() => session === s && announce(p), Math.max(0, (s.nextTime - now()) * 1000)));
      s.bar++;
      s.played++;
      s.nextTime += length;
    }
  };
  s.ticker = window.setInterval(tick, 50);
  tick();
}

/**
 * The list changed under the player (a card moved, was added or removed): `map` gives each old
 * index's new one, or null for a removed card. Playback carries on from the card after the sounding
 * one, wherever it now is; if the sounding card was removed, from the card now in its place. Stops
 * when the list is empty.
 */
export function remapSteps(id: string, map: (i: number) => number | null, length: number) {
  const s = session;
  if (!s || s.id !== id) return;
  if (!length) {
    stop();
    return;
  }
  if (s.lastStep === null) return;
  const perChord = s.perChord ? state.barsPerChord : 1;
  const moved = map(s.lastStep);
  if (moved === null) s.bar = s.lastStep * perChord;
  else s.bar += (moved - s.lastStep) * perChord;
  s.lastStep = moved ?? s.lastStep - 1;
}

/** Stop at once, cutting off anything already scheduled. */
export function stop() {
  const s = session;
  if (!s) return;
  silenceBus(s.bus.output);
  endSession(s);
}

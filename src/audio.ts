// Guitar sound: recorded notes (FluidR3 soundfont, see README credits) retuned to any pitch,
// through a little room reverb and a limiter so full strums don't clip.

import { firstAudible, nearestSample, SAMPLE_NOTES } from './sampleMap';

export type Tone = 'steel' | 'nylon' | 'electric';

// Vite turns each file into a URL: served as-is in dev, inlined as a data URI in the build.
const SAMPLE_URLS = import.meta.glob<string>('./samples/*/*.mp3', { query: '?url', import: 'default', eager: true });
const sampleUrl = (tone: Tone, midi: number) => SAMPLE_URLS[`./samples/${tone}/${midi}.mp3`];

/** A decoded recording, where its sound starts, and the gain that brings it up to a common level. */
interface Sample {
  buffer: AudioBuffer;
  offset: number;
  gain: number;
}

/** How far each sample's peak is brought up to (the recordings are quiet, around -18 dBFS). */
const TARGET_PEAK = 0.9;
/** Each note fades out over this long before its recording ends, so the hard cut is never heard. */
const END_FADE = 0.1;
/** Time to fade in from silence, so starting mid-waveform doesn't click. */
const ATTACK = 0.004;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let tone: Tone = 'steel';
const loading = new Map<Tone, Promise<Map<number, Sample>>>();
const loaded = new Map<Tone, Map<number, Sample>>();

function audio(): { ctx: AudioContext; master: GainNode } {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.8;
    // A fast, hard compressor acts as a limiter on the summed strings.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -8;
    limiter.knee.value = 4;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.2;
    const reverb = ctx.createConvolver();
    reverb.buffer = roomImpulse(ctx);
    const wet = ctx.createGain();
    wet.gain.value = 0.16;
    master.connect(limiter);
    master.connect(reverb).connect(wet).connect(limiter);
    limiter.connect(ctx.destination);
    void loadTone(tone);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return { ctx, master: master! };
}

/** A small-room reverb made from decaying noise, a little darker as it fades. */
function roomImpulse(c: BaseAudioContext): AudioBuffer {
  const seconds = 1.4;
  const length = Math.floor(c.sampleRate * seconds);
  const impulse = c.createBuffer(2, length, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    let smooth = 0;
    for (let i = 0; i < length; i++) {
      const t = i / length;
      const white = Math.random() * 2 - 1;
      const darkness = 0.2 + 0.75 * t; // more low-pass towards the tail
      smooth = darkness * smooth + (1 - darkness) * white;
      data[i] = smooth * (1 - t) ** 3;
    }
  }
  return impulse;
}

function loadTone(t: Tone): Promise<Map<number, Sample>> {
  let promise = loading.get(t);
  if (!promise) {
    const { ctx: c } = audio();
    promise = Promise.all(
      SAMPLE_NOTES.map(async (midi): Promise<[number, Sample]> => {
        const bytes = await (await fetch(sampleUrl(t, midi))).arrayBuffer();
        const buffer = await c.decodeAudioData(bytes);
        const data = buffer.getChannelData(0);
        let peak = 0;
        for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
        const offset = firstAudible(data, peak * 0.02) / buffer.sampleRate;
        return [midi, { buffer, offset, gain: peak > 0 ? TARGET_PEAK / peak : 1 }];
      }),
    ).then((entries) => {
      const samples = new Map(entries);
      loaded.set(t, samples);
      return samples;
    });
    promise.catch(() => loading.delete(t)); // allow a retry if loading failed
    loading.set(t, promise);
  }
  return promise;
}

export function setTone(next: Tone) {
  tone = next;
  if (ctx) void loadTone(next);
}

/** Resolves once the current tone's recordings are ready to play. */
export async function ready(): Promise<void> {
  audio();
  await loadTone(tone);
}

// The note last scheduled on each string, so picking the string again cuts it off like a real string.
const ringing = new Map<number, { gain: GainNode; start: number }>();

function playNote(midi: number, when: number, volume: number, destination: AudioNode, string?: number, length?: number) {
  const samples = loaded.get(tone);
  if (!samples) return;
  const { ctx: c } = audio();
  const { sample, rate } = nearestSample(midi);
  const s = samples.get(sample)!;

  const source = c.createBufferSource();
  source.buffer = s.buffer;
  source.playbackRate.value = rate;
  const gain = c.createGain();
  const level = volume * s.gain * (0.92 + Math.random() * 0.16); // a little human variation
  // A note rings for its whole recording unless it's cut short (choppy or palm-muted).
  const natural = when + (s.buffer.duration - s.offset) / rate;
  const end = length === undefined ? natural : Math.min(natural, when + Math.max(length, ATTACK + 0.03));
  const fade = length === undefined ? END_FADE : 0.03;
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(level, when + ATTACK);
  gain.gain.setValueAtTime(level, end - fade);
  gain.gain.linearRampToValueAtTime(0, end);
  source.connect(gain).connect(destination);
  source.start(when, s.offset);
  source.stop(end);

  if (string !== undefined) {
    const previous = ringing.get(string);
    if (previous && previous.start < when) {
      previous.gain.gain.cancelScheduledValues(when);
      previous.gain.gain.setTargetAtTime(0, when, 0.012);
    }
    ringing.set(string, { gain, start: when });
  }
}

interface StrumOptions {
  delayMs?: number;
  up?: boolean;
  at?: number;
  /** Relative loudness, 1 = full. */
  volume?: number;
  /** Where to send the sound; defaults to the main output. */
  bus?: AudioNode;
  /** Which string each note in `midis` is on (same order), so re-picked strings cut off. */
  strings?: number[];
  /** Cut each note off after this many seconds instead of letting it ring. */
  length?: number;
}

/** Strum notes low to high (or high to low for an upstroke). */
export function strum(midis: number[], options: StrumOptions = {}) {
  if (!midis.length) return;
  if (!loaded.get(tone)) {
    // First sound of the session: wait for the recordings, then play straight away.
    if (options.at === undefined) void ready().then(() => strum(midis, options));
    else void ready();
    return;
  }
  const { ctx: c, master: m } = audio();
  const notes = midis.map((midi, i) => ({ midi, string: options.strings?.[i] }));
  notes.sort((a, b) => (options.up ? b.midi - a.midi : a.midi - b.midi));
  const start = options.at ?? c.currentTime + 0.02;
  const delay = (options.delayMs ?? 35) / 1000;
  const volume = ((options.volume ?? 1) * 0.9) / Math.sqrt(notes.length);
  notes.forEach((n, i) => playNote(n.midi, start + i * delay, volume, options.bus ?? m, n.string, options.length));
}

/** A volume control that a group of notes can share, so they can all be silenced at once. */
export function createBus(): GainNode {
  const { ctx: c, master: m } = audio();
  const bus = c.createGain();
  bus.connect(m);
  return bus;
}

/** Silence everything on a bus right away (with a tiny fade so it doesn't click), including notes not yet started. */
export function silenceBus(bus: GainNode) {
  const t = bus.context.currentTime;
  bus.gain.cancelScheduledValues(t);
  bus.gain.setValueAtTime(bus.gain.value, t);
  bus.gain.linearRampToValueAtTime(0, t + 0.03);
  setTimeout(() => bus.disconnect(), 100);
}

export function now(): number {
  return audio().ctx.currentTime;
}

// Start fetching and decoding as soon as the user first touches the page, so the first chord isn't late.
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', () => void ready(), { once: true, capture: true });
  document.addEventListener('keydown', () => void ready(), { once: true, capture: true });
}

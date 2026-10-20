// The Next page's neck strip: the chord the page says After, becoming the selected idea, one voice per
// string. Held notes stay (relabelled if their role changes), near notes glide along their string and
// leave a trail, anything else fades. Played, the first chord sounds, then the idea two beats later,
// and the dots land exactly as it sounds.

import { Chord, chordSymbol, toneLabelFor } from '../theory/chords';
import { Fingering, formatFingering, soundingNotes } from '../theory/fingering';
import { STANDARD_TUNING, STRING_NAMES, mod12 } from '../theory/notes';
import { StringMove, noteIn, stringMoves } from '../theory/change';
import { createSessionBus, now, ready, silenceBus, strum } from '../audio';
import { state } from '../state';
import { clicksSound } from './common';
import { h, s, toneClass } from './dom';

const W = 340;
const NAME_X = 6;
const OPEN_X = 30;
const NUT_X = 42;
const END_X = W - 4;
const TOP = 14;
const GAP = 15;
const R = 6.5;
const GLIDE = 0.42;
const H = TOP + 5 * GAP + GAP / 2 + 16;

const stringY = (string: number) => TOP + (5 - string) * GAP;
const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface Shape {
  chord: Chord;
  fingering: Fingering;
}

/** A dot that stays on its string (held or gliding): moved, then relabelled at landing. */
interface Voice {
  el: SVGGElement;
  dx: number;
  from: { text: string; cls: string };
  to: { text: string; cls: string };
}

export class ChangeStrip {
  readonly element: HTMLButtonElement;
  private svg: SVGSVGElement;
  private shown = '';
  private voices: Voice[] = [];
  private frame = 0;
  private landTimer = 0;
  private bus: ReturnType<typeof createSessionBus> | null = null;
  private pair: [Shape, Shape] | null = null;

  constructor() {
    this.svg = s('svg', { class: 'change-strip', viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true' });
    this.element = h('button', { class: 'strip-btn', onclick: () => void this.play() }, this.svg);
  }

  /** Show this change, landed (a new pair stops whatever the last one was doing). */
  show(from: Shape, to: Shape) {
    const key = [from, to].map((x) => `${chordSymbol(x.chord)}:${formatFingering(x.fingering)}`).join('>') + state.labelMode;
    this.element.title = `Hear ${chordSymbol(from.chord)} to ${chordSymbol(to.chord)}`;
    this.element.setAttribute('aria-label', this.element.title);
    if (key === this.shown) return;
    this.stop();
    this.shown = key;
    this.pair = [from, to];
    this.draw(from, to);
    this.svg.classList.remove('landed');
    this.land();
  }

  /** Sound the change and move the dots: the first chord now, the idea two beats later. */
  async play() {
    if (!this.pair) return;
    this.stop();
    const [from, to] = this.pair;
    this.reset();
    const sound = clicksSound();
    try {
      await ready();
    } catch {
      // No sound to be had: the dots still move.
    }
    const t1 = now() + 0.05;
    const t2 = t1 + 2 * (60 / state.bpm);
    if (sound) {
      const bus = createSessionBus();
      this.bus = bus;
      for (const [f, at] of [[from.fingering, t1], [to.fingering, t2]] as const) {
        const notes = soundingNotes(f);
        strum(notes.map((n) => n.midi), { strings: notes.map((n) => n.string), at, bus: bus.input });
      }
    }
    const start = t2 - GLIDE;
    const still = reduced();
    const tick = () => {
      const t = now();
      if (t >= t2) return this.land();
      if (!still && t >= start) {
        const p = ease((t - start) / GLIDE);
        for (const v of this.voices) v.el.setAttribute('transform', `translate(${v.dx * p} 0)`);
      }
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
    // Landing also comes on time when frames aren't drawn (a background tab).
    this.landTimer = window.setTimeout(() => this.land(), Math.max(0, (t2 - now()) * 1000));
  }

  /** Stop the motion and anything still ringing or scheduled. */
  stop() {
    cancelAnimationFrame(this.frame);
    clearTimeout(this.landTimer);
    if (this.bus) silenceBus(this.bus.output);
    this.bus = null;
  }

  private reset() {
    this.svg.classList.remove('landed');
    for (const v of this.voices) {
      v.el.removeAttribute('transform');
      v.el.setAttribute('class', `voice ${v.from.cls}`);
      v.el.querySelector('text')!.textContent = v.from.text;
    }
  }

  /** Everything changes together, as the idea sounds. */
  private land() {
    cancelAnimationFrame(this.frame);
    clearTimeout(this.landTimer);
    if (this.svg.classList.contains('landed')) return;
    this.svg.classList.add('landed');
    for (const v of this.voices) {
      v.el.setAttribute('transform', `translate(${v.dx} 0)`);
      const relabel = v.from.text !== v.to.text || v.from.cls !== v.to.cls;
      v.el.setAttribute('class', `voice ${v.to.cls}${relabel && v.dx === 0 && !reduced() ? ' pulse' : ''}`);
      v.el.querySelector('text')!.textContent = v.to.text;
    }
  }

  private draw(from: Shape, to: Shape) {
    // Frets 1–5 when both shapes fit; otherwise a window of at least five covering both.
    const fretted = [...from.fingering, ...to.fingering].filter((f): f is number => f !== null && f > 0);
    const top = Math.max(0, ...fretted);
    const lo = top <= 5 ? 1 : Math.min(...fretted);
    const hi = Math.max(top, lo + 4);
    const width = (END_X - NUT_X) / (hi - lo + 1);
    const x = (fret: number) => (fret === 0 ? OPEN_X : NUT_X + (fret - lo + 0.5) * width);
    const boardTop = stringY(5) - GAP / 2;
    const boardBottom = stringY(0) + GAP / 2;

    const board = s('g', {},
      s('rect', { class: 'board', x: NUT_X, y: boardTop, width: END_X - NUT_X, height: boardBottom - boardTop, rx: 2 }),
      Array.from({ length: hi - lo + 1 }, (_, i) => [
        s('line', { class: 'fret', x1: NUT_X + (i + 1) * width, x2: NUT_X + (i + 1) * width, y1: boardTop, y2: boardBottom }),
        s('text', { class: 'fret-number', x: NUT_X + (i + 0.5) * width, y: H - 3 }, lo + i),
      ]),
      lo === 1 ? s('rect', { class: 'nut', x: NUT_X, y: boardTop, width: 4, height: boardBottom - boardTop }) : null,
      Array.from({ length: 6 }, (_, str) => [
        s('line', { class: 'string', x1: NUT_X, x2: END_X, y1: stringY(str), y2: stringY(str), 'stroke-width': 0.8 + (5 - str) * 0.25 }),
        s('text', { class: 'string-name', x: NAME_X, y: stringY(str) + 3.5 }, STRING_NAMES[str]),
      ]),
    );

    const label = (chord: Chord, str: number, fret: number) => {
      const role = toneLabelFor(chord, mod12(STANDARD_TUNING[str] + fret));
      return { text: state.labelMode === 'interval' ? role ?? '' : noteIn(chord, str, fret), cls: toneClass(role) };
    };
    const dot = (cls: string, cx: number, y: number, text: string) =>
      s('g', { class: cls }, s('circle', { cx, cy: y, r: R }), s('text', { x: cx, y: y + 3 }, text));
    const cross = (cls: string, y: number) => s('text', { class: `cross ${cls}`, x: OPEN_X, y: y + 4 }, '×');

    const trails: SVGElement[] = [];
    const fades: SVGElement[] = [];
    this.voices = [];
    stringMoves(from.fingering, to.fingering).forEach((m: StringMove) => {
      const y = stringY(m.string);
      if (m.kind === 'mute') return fades.push(cross('', y));
      if (m.from === null) fades.push(cross('pre', y));
      if (m.to === null) fades.push(cross('post', y));
      if (m.kind === 'held' || m.kind === 'glide') {
        const a = label(from.chord, m.string, m.from!);
        const b = label(to.chord, m.string, m.to!);
        if (m.kind === 'glide') {
          trails.push(s('line', { class: `trail post ${b.cls}`, x1: x(m.from!), x2: x(m.to!), y1: y, y2: y, 'stroke-width': R * 2 * 0.67 }));
        }
        const el = dot(`voice ${a.cls}`, x(m.from!), y, a.text);
        this.voices.push({ el, dx: x(m.to!) - x(m.from!), from: a, to: b });
        return;
      }
      if (m.from !== null) {
        const a = label(from.chord, m.string, m.from);
        fades.push(dot(`fade pre ${a.cls}`, x(m.from), y, a.text));
      }
      if (m.to !== null) {
        const b = label(to.chord, m.string, m.to);
        fades.push(dot(`fade post ${b.cls}`, x(m.to), y, b.text));
      }
    });
    this.svg.replaceChildren(board, s('g', {}, trails), s('g', {}, fades), s('g', {}, this.voices.map((v) => v.el)));
  }
}

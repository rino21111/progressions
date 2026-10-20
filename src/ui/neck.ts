// The neck: one big fretboard on the stage, frets 0–15 with real spacing. It shows the chord on the
// neck (click to place or lift a finger; left of the nut switches a string open or muted) and, while
// an idea is tried, the move into it: one voice per string, held notes stay (relabelled if their role
// changes), near notes glide along their string and leave a trail, anything else fades. Played, the
// first chord sounds, then the idea two beats later, and the dots land exactly as it sounds.

import { Fingering, MAX_FRET, soundingNotes } from '../theory/fingering';
import { STANDARD_TUNING, STRING_NAMES, mod12 } from '../theory/notes';
import { stringMoves } from '../theory/change';
import { createSessionBus, now, ready, silenceBus, strum } from '../audio';
import { state } from '../state';
import { PHRASE_GAP, clicksSound } from './common';
import { s } from './dom';
import { signs } from './music';

export interface Mark {
  string: number;
  fret: number;
  text: string;
  cls: string;
  /** Outside the key: a dashed ring around it. */
  out?: boolean;
}

/** A key note marked on the neck (the tonic a little stronger). */
export interface KeyDot {
  string: number;
  fret: number;
  tonic: boolean;
}

export interface NeckView {
  fingering: Fingering;
  marks: Mark[];
  /** The chord's tones elsewhere on the neck (All chord tones). */
  ghosts: Mark[];
  keyDots: KeyDot[];
}

/** What a dot on a string shows for a chord: its label, tone class and whether it's outside the key. */
export type Label = (string: number, fret: number, which: 'from' | 'to') => { text: string; cls: string; out: boolean };

const FRETS = MAX_FRET;
const GLIDE = 0.42;
const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const MARKERS = [3, 5, 7, 9, 12, 15];

interface Geo {
  W: number;
  H: number;
  sp: number;
  R: number;
  nut: number;
  x0: number;
  x1: number;
  top: number;
  bottom: number;
  fx: (n: number) => number;
  y: (str: number) => number;
  x: (fret: number) => number;
  open: number;
}

function geometry(phone: boolean): Geo {
  const W = 1000;
  const sp = phone ? 34 : 21;
  const R = phone ? 15 : 9.8;
  const nut = phone ? 9 : 6;
  const x0 = phone ? 56 : 40;
  const x1 = W - 2;
  const top = 2;
  const edge = sp * 0.6;
  const bottom = top + sp * 5 + edge * 2;
  const K = (x1 - x0 - nut) / (1 - 2 ** (-(FRETS + 0.3) / 12));
  const fx = (n: number) => x0 + nut + K * (1 - 2 ** (-n / 12));
  const y = (str: number) => top + edge + (5 - str) * sp;
  const open = x0 - R - 6;
  const x = (fret: number) => (fret === 0 ? open : (fx(fret - 1) + fx(fret)) / 2);
  return { W, H: bottom + 26, sp, R, nut, x0, x1, top, bottom, fx, y, x, open };
}

/** A voice that stays on its string (held or gliding): moved, then relabelled at landing. */
interface Voice {
  el: SVGGElement;
  x: number;
  y: number;
  dx: number;
  from: { text: string; cls: string; out: boolean; open: boolean };
  to: { text: string; cls: string; out: boolean; open: boolean };
}

export class Neck {
  readonly element: SVGSVGElement;
  private onFingering: (f: Fingering) => void;
  private fingering: Fingering = [null, null, null, null, null, null];
  private phone = false;
  private geo = geometry(false);
  private layer: SVGGElement;
  private shown = '';
  private voices: Voice[] = [];
  private move: { from: Fingering; to: Fingering } | null = null;
  private frame = 0;
  private landTimer = 0;
  private bus: ReturnType<typeof createSessionBus> | null = null;

  constructor(onFingering: (f: Fingering) => void) {
    this.onFingering = onFingering;
    this.element = s('svg', { class: 'neck', role: 'group', 'aria-label': 'Fretboard: click a fret to place or lift a finger; left of the nut switches a string open or muted' });
    this.layer = s('g');
  }

  /** Phones draw the neck bigger in a sideways scroller. */
  setPhone(phone: boolean) {
    if (phone === this.phone) return;
    this.phone = phone;
    this.geo = geometry(phone);
    this.element.classList.toggle('phone-neck', phone);
    this.shown = '';
  }

  // The board as on the Chord page fretboard: warm brown wood, light fret lines, plain strings, a
  // cream nut, and inlays (which step aside while the key's notes show).
  private board(): SVGElement[] {
    const g = this.geo;
    const h = g.bottom - g.top;
    const out: SVGElement[] = [s('rect', { class: 'board', x: g.x0, y: g.top, width: g.x1 - g.x0, height: h, rx: 3 })];
    const mid = (a: number, b: number) => (g.y(a) + g.y(b)) / 2;
    for (const f of [3, 5, 7, 9, 15]) out.push(s('circle', { class: 'inlay', cx: g.x(f), cy: mid(2, 3), r: g.sp * 0.2 }));
    out.push(s('circle', { class: 'inlay', cx: g.x(12), cy: mid(1, 2), r: g.sp * 0.2 }), s('circle', { class: 'inlay', cx: g.x(12), cy: mid(3, 4), r: g.sp * 0.2 }));
    for (let n = 1; n <= FRETS; n++) {
      out.push(s('line', { class: 'fret', x1: g.fx(n), x2: g.fx(n), y1: g.top, y2: g.bottom, 'stroke-width': g.sp * 0.085 }));
      out.push(s('text', { class: `fnum${MARKERS.includes(n) ? ' mark' : ''}`, x: g.x(n), y: g.bottom + 19 }, n));
    }
    out.push(s('rect', { class: 'nut', x: g.x0, y: g.top, width: g.nut, height: h }));
    for (let str = 0; str < 6; str++) {
      const y = g.y(str);
      out.push(s('line', { class: 'str', x1: g.x0, x2: g.x1, y1: y, y2: y, 'stroke-width': (1 + (5 - str) * 0.35) * (g.sp / 30) }));
      out.push(s('text', { class: 'sname', x: 4, y: y + 4 }, STRING_NAMES[str]));
    }
    return out;
  }

  private hits(): SVGGElement {
    const g = this.geo;
    const hits = s('g', { class: 'hits' });
    for (let str = 0; str < 6; str++) {
      const y = g.y(str) - g.sp / 2;
      hits.append(s('rect', {
        class: 'hit', x: 0, y, width: g.x0, height: g.sp,
        'aria-label': `${STRING_NAMES[str]} string: open or muted`, onclick: () => this.toggleOpen(str),
      }));
      for (let f = 1; f <= FRETS; f++) {
        hits.append(s('rect', {
          class: 'hit', x: g.fx(f - 1), y, width: g.fx(f) - g.fx(f - 1), height: g.sp,
          'aria-label': `${STRING_NAMES[str]} string, fret ${f}`, onclick: () => this.clickFret(str, f),
        }));
      }
    }
    return hits;
  }

  private toggleOpen(str: number) {
    const next = [...this.fingering];
    next[str] = next[str] === 0 ? null : 0;
    this.onFingering(next);
  }

  private clickFret(str: number, fret: number) {
    const next = [...this.fingering];
    next[str] = next[str] === fret ? null : fret;
    this.onFingering(next);
  }

  private keyLayer(dots: KeyDot[]): SVGGElement {
    const g = this.geo;
    // As on the Chord page: radius 4 and 5.5 for a dot of 12.
    return s('g', {}, dots.map((k) => s('circle', { class: `kd${k.tonic ? ' tonic' : ''}`, cx: g.x(k.fret), cy: g.y(k.string), r: g.R * (k.tonic ? 5.5 : 4) / 12 })));
  }

  /** A note dot (or an open-string ring) centred at 0,0, placed by its transform. */
  private dot(cls: string, str: number, fret: number, text: string, out: boolean): SVGGElement {
    const g = this.geo;
    return s('g', { class: `dot ${cls}${fret === 0 ? ' open' : ''}${out ? ' out' : ''}`, 'data-string': str, 'data-pc': mod12(STANDARD_TUNING[str] + fret), transform: `translate(${g.x(fret)} ${g.y(str)})` },
      s('g', { class: 'in' },
        s('circle', { class: 'out-ring', r: g.R + 5 * (g.R / 12) }),
        s('circle', { class: 'pluck', r: g.R }),
        s('circle', { class: 'disc', r: g.R }),
        s('text', { class: text.length > 2 ? 'long' : '' }, signs(text))));
  }

  private cross(cls: string, str: number): SVGElement {
    return s('text', { class: `vx ${cls}`, x: this.geo.open, y: this.geo.y(str) + 5 }, '×');
  }

  private frame0() {
    this.element.setAttribute('viewBox', `0 0 ${this.geo.W} ${this.geo.H}`);
  }

  /** The chord on the neck (stops any move). */
  show(view: NeckView) {
    this.stop();
    this.move = null;
    this.voices = [];
    this.shown = '';
    this.fingering = view.fingering;
    this.frame0();
    const g = this.geo;
    const layer = s('g', { class: 'dots' });
    for (const m of view.ghosts) {
      layer.append(s('g', { class: `ghost ${m.cls}`, 'data-pc': mod12(STANDARD_TUNING[m.string] + m.fret), transform: `translate(${g.x(m.fret)} ${g.y(m.string)})` },
        s('circle', { r: g.R * 0.78 }), s('text', {}, signs(m.text))));
    }
    view.fingering.forEach((fret, str) => {
      if (fret === null && !view.ghosts.some((m) => m.string === str && m.fret === 0)) layer.append(this.cross('', str));
    });
    for (const m of view.marks) layer.append(this.dot(m.cls, m.string, m.fret, m.text, !!m.out));
    this.element.classList.remove('landed');
    this.element.classList.toggle('keyed', view.keyDots.length > 0);
    this.element.replaceChildren(...this.board(), this.keyLayer(view.keyDots), layer, this.hits());
    this.layer = layer;
  }

  /** Show a move, landed (a new move stops whatever the last one was doing). `key` names it, so the same move isn't redrawn. */
  showMove(key: string, from: Fingering, to: Fingering, label: Label, keyDots: KeyDot[]) {
    this.fingering = to;
    const id = `${key}|${this.phone}`;
    if (id === this.shown) return;
    this.stop();
    this.shown = id;
    this.move = { from, to };
    this.frame0();
    const g = this.geo;
    const trails: SVGElement[] = [];
    const fades: SVGElement[] = [];
    this.voices = [];
    for (const m of stringMoves(from, to)) {
      if (m.kind === 'mute') {
        fades.push(this.cross('', m.string));
        continue;
      }
      if (m.from === null) fades.push(this.cross('pre', m.string));
      if (m.to === null) fades.push(this.cross('post', m.string));
      if (m.kind === 'held' || m.kind === 'glide') {
        const a = { ...label(m.string, m.from!, 'from'), open: m.from === 0 };
        const b = { ...label(m.string, m.to!, 'to'), open: m.to === 0 };
        if (m.kind === 'glide') {
          trails.push(s('line', { class: `trail post ${b.cls}`, x1: g.x(m.from!), x2: g.x(m.to!), y1: g.y(m.string), y2: g.y(m.string), 'stroke-width': g.R * 2 * 0.67 }));
        }
        const el = this.dot(`voice ${a.cls}`, m.string, m.from!, a.text, a.out);
        this.voices.push({ el, x: g.x(m.from!), y: g.y(m.string), dx: g.x(m.to!) - g.x(m.from!), from: a, to: b });
        continue;
      }
      if (m.from !== null) {
        const a = label(m.string, m.from, 'from');
        fades.push(this.dot(`fade pre ${a.cls}`, m.string, m.from, a.text, a.out));
      }
      if (m.to !== null) {
        const b = label(m.string, m.to, 'to');
        fades.push(this.dot(`fade post ${b.cls}`, m.string, m.to, b.text, b.out));
      }
    }
    const layer = s('g', { class: 'dots' }, s('g', { class: 'trails' }, trails), fades, this.voices.map((v) => v.el));
    this.element.classList.remove('landed');
    this.element.classList.toggle('keyed', keyDots.length > 0);
    this.element.replaceChildren(...this.board(), this.keyLayer(keyDots), layer, this.hits());
    this.layer = layer;
    this.land();
  }

  private setVoice(v: Voice, side: 'from' | 'to', dx: number, pulse = false) {
    const end = v[side];
    v.el.setAttribute('transform', `translate(${v.x + dx} ${v.y})`);
    v.el.setAttribute('class', `dot voice ${end.cls}${end.open ? ' open' : ''}${end.out ? ' out' : ''}${pulse ? ' pulse' : ''}`);
    v.el.querySelector('text')!.textContent = signs(end.text);
  }

  private reset() {
    this.element.classList.remove('landed');
    for (const v of this.voices) this.setVoice(v, 'from', 0);
  }

  /** Everything changes together, as the idea sounds. */
  private land() {
    cancelAnimationFrame(this.frame);
    clearTimeout(this.landTimer);
    if (this.element.classList.contains('landed')) return;
    this.element.classList.add('landed');
    for (const v of this.voices) {
      const relabel = v.from.text !== v.to.text || v.from.cls !== v.to.cls;
      this.setVoice(v, 'to', v.dx, relabel && v.dx === 0 && !reduced());
    }
  }

  /** Sound the move and play it on the neck: the first chord now, the idea two beats later. */
  async play() {
    const move = this.move;
    if (!move) return;
    this.stop();
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
      for (const [f, at] of [[move.from, t1], [move.to, t2]] as const) {
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
        for (const v of this.voices) this.setVoice(v, 'from', v.dx * p);
      }
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
    // Landing also comes on time when frames aren't drawn (a background tab).
    this.landTimer = window.setTimeout(() => this.land(), Math.max(0, (t2 - now()) * 1000));
  }

  /** Strum the chord on the neck once (on this neck's own sound, so a new tap stops it). */
  async strumOnce(f: Fingering) {
    await this.playInTurn([f]);
  }

  /** Shapes heard one after another (a then line's phrase), on this neck's sound; the dots stay. */
  async playInTurn(shapes: Fingering[]) {
    this.stop();
    if (this.move) this.land();
    if (!clicksSound()) return;
    try {
      await ready();
    } catch {
      return;
    }
    const t1 = now() + 0.05;
    const bus = createSessionBus();
    this.bus = bus;
    shapes.forEach((f, i) => {
      const notes = soundingNotes(f);
      strum(notes.map((n) => n.midi), { strings: notes.map((n) => n.string), at: t1 + PHRASE_GAP * i, bus: bus.input });
    });
  }

  /** Stop the motion and anything still ringing or scheduled. */
  stop() {
    cancelAnimationFrame(this.frame);
    clearTimeout(this.landTimer);
    if (this.bus) silenceBus(this.bus.output);
    this.bus = null;
  }

  /** Briefly ring the dots on these strings, as they're played. */
  pluck(strings: number[]) {
    for (const str of strings) {
      const dot = this.layer.querySelector(`.dot[data-string="${str}"]:not(.pre)`);
      if (!dot) continue;
      dot.classList.remove('plucked');
      void (dot as SVGElement).getBoundingClientRect(); // restart the animation if it's still running
      dot.classList.add('plucked');
    }
  }
}

// Interactive SVG fretboard. High e string on top, like tab.

import { Fingering, MAX_FRET } from '../theory/fingering';
import { STANDARD_TUNING, STRING_NAMES, mod12 } from '../theory/notes';
import { s } from './dom';

export interface Mark {
  string: number;
  fret: number;
  text: string;
  cls: string;
}

export interface FretboardView {
  fingering: Fingering;
  /** Labels for the notes being played. */
  marks: Mark[];
  /** Faint chord tones elsewhere on the neck. */
  ghosts: Mark[];
}

const W = 1100;
const H = 225;
const NUT_X = 64;
const END_X = W - 16;
const TOP = 28;
const GAP = 30;
const INLAYS = [3, 5, 7, 9, 15];

/** x of fret wire n, spaced like a real neck (frets get closer together up the neck). */
function fretX(n: number): number {
  const scale = (1 - Math.pow(2, -n / 12)) / (1 - Math.pow(2, -MAX_FRET / 12));
  return NUT_X + scale * (END_X - NUT_X);
}

const noteX = (fret: number) => (fret === 0 ? NUT_X / 2 : (fretX(fret - 1) + fretX(fret)) / 2);
/** Pitch class sounding at a string and fret, used to match dots to a hovered chord tone. */
const pcAt = (string: number, fret: number) => mod12(STANDARD_TUNING[string] + fret);
/** y of a string; string 0 is low E and sits at the bottom. */
const stringY = (string: number) => TOP + (5 - string) * GAP;

export class Fretboard {
  readonly element: SVGSVGElement;
  private onFingering: (f: Fingering) => void;
  private fingering: Fingering = [null, null, null, null, null, null];
  private layer: SVGGElement;

  constructor(onFingering: (f: Fingering) => void) {
    this.onFingering = onFingering;
    this.element = s('svg', {
      class: 'fretboard',
      viewBox: `0 0 ${W} ${H}`,
      role: 'group',
      'aria-label': 'Guitar fretboard. Click a fret to place a finger; click left of the nut to switch a string between open and muted.',
    });
    this.element.append(this.drawBoard());
    this.layer = s('g');
    this.element.append(this.layer);
    this.element.append(this.drawHitAreas());
  }

  private drawBoard(): SVGGElement {
    const g = s('g');
    const boardTop = stringY(5) - GAP / 2;
    const boardBottom = stringY(0) + GAP / 2;
    g.append(s('rect', { class: 'board', x: NUT_X, y: boardTop, width: END_X - NUT_X, height: boardBottom - boardTop, rx: 3 }));
    const midY = (stringY(2) + stringY(3)) / 2;
    for (const f of INLAYS) g.append(s('circle', { class: 'inlay', cx: noteX(f), cy: midY, r: 6 }));
    g.append(s('circle', { class: 'inlay', cx: noteX(12), cy: (stringY(1) + stringY(2)) / 2, r: 6 }));
    g.append(s('circle', { class: 'inlay', cx: noteX(12), cy: (stringY(3) + stringY(4)) / 2, r: 6 }));
    for (let f = 1; f <= MAX_FRET; f++) {
      g.append(s('line', { class: 'fret', x1: fretX(f), x2: fretX(f), y1: boardTop, y2: boardBottom }));
      g.append(s('text', { class: 'fret-number', x: noteX(f), y: H - 6 }, f));
    }
    g.append(s('rect', { class: 'nut', x: NUT_X - 5, y: boardTop, width: 7, height: boardBottom - boardTop }));
    for (let str = 0; str < 6; str++) {
      const y = stringY(str);
      g.append(s('line', { class: 'string', x1: NUT_X, x2: END_X, y1: y, y2: y, 'stroke-width': 1 + (5 - str) * 0.35 }));
      g.append(s('text', { class: 'string-name', x: 8, y: y + 4 }, STRING_NAMES[str]));
    }
    return g;
  }

  private drawHitAreas(): SVGGElement {
    const g = s('g', { class: 'hits' });
    for (let str = 0; str < 6; str++) {
      const y = stringY(str) - GAP / 2;
      g.append(
        s('rect', {
          class: 'hit hit-open',
          x: 18,
          y,
          width: NUT_X - 22,
          height: GAP,
          'aria-label': `${STRING_NAMES[str]} string: open or muted`,
          onclick: () => this.toggleOpen(str),
        }),
      );
      for (let f = 1; f <= MAX_FRET; f++) {
        g.append(
          s('rect', {
            class: 'hit',
            x: fretX(f - 1),
            y,
            width: fretX(f) - fretX(f - 1),
            height: GAP,
            'aria-label': `${STRING_NAMES[str]} string, fret ${f}`,
            onclick: () => this.clickFret(str, f),
          }),
        );
      }
    }
    return g;
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

  /** Briefly ring the dots on these strings, as they're played. */
  pluck(strings: number[]) {
    for (const str of strings) {
      const dot = this.layer.querySelector(`.dot[data-string="${str}"]`);
      if (!dot) continue;
      dot.classList.remove('plucked');
      void dot.getBoundingClientRect(); // restart the animation if it's still running
      dot.classList.add('plucked');
    }
  }

  clearPlucks() {
    this.layer.querySelectorAll('.plucked').forEach((el) => el.classList.remove('plucked'));
  }

  render(view: FretboardView) {
    this.fingering = view.fingering;
    const layer = s('g');
    // Open strings sit just left of the nut, filled like fretted notes (or as rings for chord tones).
    const markX = (fret: number) => (fret === 0 ? NUT_X / 2 + 4 : noteX(fret));
    for (const ghost of view.ghosts) {
      const x = markX(ghost.fret);
      const y = stringY(ghost.string);
      layer.append(
        s('g', { class: `ghost ${ghost.cls}`, 'data-pc': pcAt(ghost.string, ghost.fret) },
          s('circle', { cx: x, cy: y, r: 9.5 }),
          s('text', { x, y: y + 3.5 }, ghost.text),
        ),
      );
    }
    view.fingering.forEach((fret, str) => {
      // A muted string shows ×, unless its open note is a chord tone (then the ring says it's unplayed).
      if (fret === null && !view.ghosts.some((g) => g.string === str && g.fret === 0)) {
        const y = stringY(str);
        layer.append(s('text', { class: 'muted-mark', x: NUT_X / 2 + 4, y: y + 5 }, '×'));
      }
    });
    for (const mark of view.marks) {
      const x = markX(mark.fret);
      const y = stringY(mark.string);
      layer.append(
        s('g', { class: `dot ${mark.cls}${mark.fret === 0 ? ' open' : ''}`, 'data-string': mark.string, 'data-pc': pcAt(mark.string, mark.fret) },
          s('circle', { class: 'pluck', cx: x, cy: y, r: 12 }),
          s('circle', { cx: x, cy: y, r: 12 }),
          s('text', { x, y: y + 4 }, mark.text),
        ),
      );
    }
    this.layer.replaceWith(layer);
    this.layer = layer;
  }
}

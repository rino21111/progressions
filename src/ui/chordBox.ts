// Classic vertical chord diagram (the kind printed in songbooks).

import { Fingering } from '../theory/fingering';
import { STANDARD_TUNING, mod12 } from '../theory/notes';
import { s } from './dom';

export interface BoxLabel {
  text: string;
  cls: string;
}

const LEFT = 36;
const STRING_GAP = 17;
const TOP = 30;
const ROW = 22;
const ROWS = 5;

/** `compact` is for small cards: centred with even margins, four frets (more if the shape needs them),
 * and the position (4fr) under the grid instead of beside it. */
export function chordBox(fingering: Fingering, labels: (BoxLabel | null)[] = [], title?: string, compact = false): SVGSVGElement {
  const fretted = fingering.filter((f): f is number => f !== null && f > 0);
  const maxFret = fretted.length ? Math.max(...fretted) : 0;
  const minFret = fretted.length ? Math.min(...fretted) : 0;
  const rows = compact ? Math.max(4, maxFret - minFret + 1) : ROWS;
  const start = maxFret <= rows ? 1 : minFret;
  const x = (str: number) => LEFT + str * STRING_GAP;
  const y = (fret: number) => TOP + (fret - start + 0.5) * ROW;

  const box = compact
    ? { left: LEFT - 10, top: TOP - 20, width: 20 + STRING_GAP * 5, height: 20 + ROW * rows + 14 }
    : { left: 0, top: 0, width: LEFT + STRING_GAP * 5 + 14, height: TOP + ROW * rows + 10 };
  const svg = s('svg', { class: 'chord-box', viewBox: `${box.left} ${box.top} ${box.width} ${box.height}`, role: 'img', 'aria-label': title ?? 'Chord diagram' });

  for (let r = 0; r <= rows; r++) {
    const isNut = r === 0 && start === 1;
    svg.append(s('line', { class: isNut ? 'box-nut' : 'box-fret', x1: x(0), x2: x(5), y1: TOP + r * ROW, y2: TOP + r * ROW }));
  }
  for (let str = 0; str < 6; str++) {
    svg.append(s('line', { class: 'box-string', x1: x(str), x2: x(str), y1: TOP, y2: TOP + rows * ROW }));
  }
  if (start > 1) {
    svg.append(compact
      ? s('text', { class: 'box-position under', x: x(2.5), y: TOP + rows * ROW + 11 }, `${start}fr`)
      : s('text', { class: 'box-position', x: LEFT - 11, y: y(start) + 4 }, `${start}fr`));
  }

  // Draw a barre when the lowest fret is held across several strings with nothing open between.
  const atMin = fingering.map((f, str) => (f === minFret && minFret > 0 ? str : -1)).filter((str) => str >= 0);
  if (atMin.length >= 2 && fretted.length > 4) {
    const first = atMin[0];
    const last = atMin[atMin.length - 1];
    const blocked = fingering.slice(first, last + 1).some((f) => f === null || f === 0 || f < minFret);
    if (!blocked) {
      svg.append(s('rect', { class: 'box-barre', x: x(first) - 7, y: y(minFret) - 7, width: x(last) - x(first) + 14, height: 14, rx: 7 }));
    }
  }

  fingering.forEach((fret, str) => {
    const label = labels[str];
    if (fret === null) {
      svg.append(s('text', { class: 'box-muted', x: x(str), y: TOP - 8 }, '×'));
    } else if (fret === 0) {
      svg.append(
        s('g', { class: `box-open-mark ${label?.cls ?? ''}`, 'data-string': str, 'data-pc': mod12(STANDARD_TUNING[str]) },
          s('circle', { class: 'pluck', cx: x(str), cy: TOP - 12, r: 5 }),
          s('circle', { class: 'box-open', cx: x(str), cy: TOP - 12, r: 5 }),
        ),
      );
    } else {
      svg.append(
        s('g', { class: `box-dot ${label?.cls ?? ''}`, 'data-string': str, 'data-pc': mod12(STANDARD_TUNING[str] + fret) },
          s('circle', { class: 'pluck', cx: x(str), cy: y(fret), r: 7.5 }),
          s('circle', { cx: x(str), cy: y(fret), r: 7.5 }),
          label ? s('text', { x: x(str), y: y(fret) + 3 }, label.text) : null,
        ),
      );
    }
  });
  return svg;
}

/** Briefly ring the dots on these strings in a chord box, as they're played. */
export function pluckBox(svg: Element, strings: number[]) {
  for (const str of strings) {
    const mark = svg.querySelector(`[data-string="${str}"]`);
    if (!mark) continue;
    mark.classList.remove('plucked');
    void mark.getBoundingClientRect(); // restart the animation if it's still running
    mark.classList.add('plucked');
  }
}

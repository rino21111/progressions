// Small inline glyphs drawn with currentColor, used instead of emoji.

import { s } from './dom';

const glyph = (size: number, ...children: SVGElement[]) =>
  s('svg', {
    class: 'glyph', width: size, height: size, viewBox: '0 0 16 16',
    fill: 'none', stroke: 'currentColor', 'stroke-width': 1.4, 'stroke-linecap': 'round',
    'aria-hidden': 'true', focusable: 'false',
  }, ...children);

/** A tiny chord box: nut, frets, strings and one fretted dot. */
export const fretIcon = (size = 14) =>
  glyph(size,
    s('path', { d: 'M3 2.5h10', 'stroke-width': 2 }),
    s('path', { d: 'M3 7h10M3 11h10M3 14.5h10', 'stroke-width': 1 }),
    s('path', { d: 'M3 2.5v12M6.33 2.5v12M9.67 2.5v12M13 2.5v12', 'stroke-width': 1 }),
    s('circle', { cx: 9.67, cy: 9, r: 1.7, fill: 'currentColor', stroke: 'none' }),
  );

/** A solid play triangle. */
export const playIcon = (size = 11) =>
  glyph(size, s('path', { d: 'M4 2.5l9 5.5-9 5.5z', fill: 'currentColor', stroke: 'none' }));

/** A solid stop square. */
export const stopIcon = (size = 11) =>
  glyph(size, s('rect', { x: 3, y: 3, width: 10, height: 10, rx: 1.5, fill: 'currentColor', stroke: 'none' }));

/** Two arrows chasing each other round, for loop/repeat. */
export const loopIcon = (size = 14) =>
  glyph(size,
    s('path', { d: 'M2.5 8.5V7a3 3 0 0 1 3-3h7.5' }),
    s('path', { d: 'M11 2l2 2-2 2' }),
    s('path', { d: 'M13.5 7.5V9a3 3 0 0 1-3 3H3' }),
    s('path', { d: 'M5 10l-2 2 2 2' }),
  );

/** Three sliders, for the player's extra settings. */
export const settingsIcon = (size = 14) =>
  glyph(size,
    s('path', { d: 'M2.5 4h11M2.5 8h11M2.5 12h11', 'stroke-width': 1.2 }),
    s('circle', { cx: 5.5, cy: 4, r: 1.6, fill: 'var(--surface)' }),
    s('circle', { cx: 10.5, cy: 8, r: 1.6, fill: 'var(--surface)' }),
    s('circle', { cx: 7, cy: 12, r: 1.6, fill: 'var(--surface)' }),
  );

/** A curved arrow turning back, for undo. */
export const undoIcon = (size = 14) =>
  glyph(size,
    s('path', { d: 'M5.5 3.5L2.5 6.5l3 3', 'stroke-linejoin': 'round' }),
    s('path', { d: 'M2.5 6.5h7a3.5 3.5 0 0 1 0 7H7' }),
  );

/** A chevron pointing down, for showing more (rotated when open). */
export const chevronIcon = (size = 14) =>
  glyph(size, s('path', { d: 'M4 6l4 4 4-4', 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));

/** A magnifying glass, for looking up a chord by name. */
export const searchIcon = (size = 14) =>
  glyph(size,
    s('circle', { cx: 7, cy: 7, r: 4.25 }),
    s('path', { d: 'M10.2 10.2l3.3 3.3', 'stroke-width': 1.8 }),
  );

/** A window with its right third marked off: the progression panel. */
export const panelIcon = (size = 14) =>
  glyph(size,
    s('rect', { x: 1.75, y: 2.75, width: 12.5, height: 10.5, rx: 1.5 }),
    s('path', { d: 'M10 3v10' }),
  );

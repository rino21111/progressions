// Music typography: real flat and sharp signs (B♭, F♯, ♭VII), and chord extensions raised (G⁷,
// F♯°⁷). The signs come from a two-glyph subset of Gentium Plus.

import { h } from './dom';

const SIGN: Record<string, string> = { b: '♭', '#': '♯' };

/** Text with b and # as accidentals turned into sign glyphs (for SVG text, which can't hold spans). */
export const signs = (text: string): string => text
  .replace(/([A-G])([b#]+)/g, (_, n: string, a: string) => n + [...a].map((x) => SIGN[x]).join(''))
  .replace(/(^|[^A-Za-z])([b#]+)(?=[0-9IViv])/g, (_, pre: string, a: string) => pre + [...a].map((x) => SIGN[x]).join(''));

const acc = (a: string) => h('span', { class: 'acc' }, SIGN[a] ?? a);

/** A note name: C, B♭, F♯. */
export function noteNode(name: string): HTMLElement {
  const m = /^([A-G])([b#]*)$/.exec(name);
  return h('span', { class: 'note-name' }, m ? [m[1], ...[...m[2]].map(acc)] : name);
}

/** Accidentals inside a short run (an extension like 7b9, an interval like b3). */
function withSigns(text: string): (HTMLElement | string)[] {
  return text.split(/([b#])(?=[b#0-9])/).map((part) => (part === 'b' || part === '#' ? acc(part) : part)).filter((p) => p !== '');
}

/** A chord symbol: root, its sign, m for minor, the rest raised; a slash bass stays on the line. */
export function chordNode(symbol: string): HTMLElement {
  const m = /^([A-G])([b#]?)(.*?)(?:\/([A-G][b#]?))?$/.exec(symbol);
  if (!m) return h('span', { class: 'sym-text' }, symbol);
  let rest = m[3];
  let minor = '';
  if (/^m(?!aj)/.test(rest)) {
    minor = 'm';
    rest = rest.slice(1);
  }
  rest = rest.replace(/^dim7$/, '°7').replace(/^dim$/, '°').replace(/^\((.*)\)$/, '$1');
  return h('span', { class: 'sym-text' },
    m[1], m[2] ? acc(m[2]) : null, minor,
    rest ? h('sup', {}, withSigns(rest)) : null,
    m[4] ? ['/', noteNode(m[4])] : null);
}

/** A Roman numeral: its leading sign as a glyph (♭VII, ♯iv°7). */
export function numeralNode(numeral: string): HTMLElement {
  const m = /^(bb|b|#)?(.*)$/.exec(numeral)!;
  return h('span', {}, m[1] ? [...m[1]].map(acc) : null, m[2]);
}

/** An interval label: R, 3, ♭3, ♯11. */
export function degreeNode(label: string): HTMLElement {
  return h('span', {}, withSigns(label));
}

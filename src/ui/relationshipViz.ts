// Small drawings for the Relationships tab: how each voice moves from one chord to the next (the
// chord before greyed), and a compact Shared notes map for a progression to start with.

import { Chord, chordTones } from '../theory/chords';
import { Key, chordFitInKey, chordSymbolInKey, pitchInKey, romanNumeral, spellRootInKey } from '../theory/keys';
import { Lane, MapTone, heldTones, mapRows, monotonePath } from '../theory/progressionMap';
import { pairVoices } from '../theory/voiceLeading';
import { s, toneClass } from './dom';

const LANES: Exclude<Lane, 'none'>[] = ['D', 'PD', 'T'];

/** A chord's tones spelled as its symbol spells them (in the key). */
const spelled = (chord: Chord, key: Key) => chordTones(chord, spellRootInKey(key, chord.root));

/** Moves in words, top voice first: "F to Fm: C stays, A down 1 fret to Ab, F stays (nearest notes, not strings)". */
export function voiceSummary(x: Chord, c: Chord, key: Key): string {
  const p = pairVoices(x, c);
  const name = (chord: Chord, pc: number) => spelled(chord, key).find((t) => t.pc === pc)?.name ?? '';
  const parts = p.moves.map((m) => {
    const from = name(x, m.from);
    if (!m.semis) return `${from} stays`;
    const n = Math.abs(m.semis);
    return `${from} ${m.semis > 0 ? 'up' : 'down'} ${n} fret${n > 1 ? 's' : ''} to ${name(c, m.to)}`;
  }).reverse();
  for (const e of p.entering) parts.unshift(`${name(c, e.pc)} added`);
  return `${chordSymbolInKey(x, key)} to ${chordSymbolInKey(c, key)}: ${parts.join(', ')} (nearest notes, not strings)`;
}

/**
 * Voice picture: the first chord's tones in lanes (root at the bottom) on the left, the candidate's on
 * the right, each voice joined to where it goes. Held notes get the grey bar; moved ones a line in the
 * new tone's colour, the right dot shifted 3.5px per semitone, with the step in frets.
 */
const PITCH = 17;

/** How far a picture's dots reach below the root lane and above it (px), so a card's rows can share one scale. */
export function voiceExtent(x: Chord, c: Chord): { below: number; top: number } {
  const p = pairVoices(x, c);
  const lanes = p.moves.length + p.entering.length;
  const shifts = p.moves.map((m, i) => i * PITCH + 3.5 * m.semis);
  return { below: Math.max(0, -Math.min(0, ...shifts)), top: Math.max(PITCH * (lanes - 1), ...shifts) };
}

/**
 * `scale` is shared by all rows of a card (the most any of them reaches below and above), so the
 * first chord's dots line up down the column; by default the picture fits its own dots.
 */
export function voicePicture(x: Chord, c: Chord, key: Key, leftNames: boolean, scale = voiceExtent(x, c)): SVGSVGElement {
  const p = pairVoices(x, c);
  const pitch = PITCH;
  const { below, top } = scale;
  const height = 10 + top + below + 10;
  const laneY = (i: number) => height - 10 - below - i * pitch;
  const LX = 34;
  const RX = 96;
  const xTones = spelled(x, key);
  const cTones = spelled(c, key);
  const xPcs = new Set(xTones.map((t) => t.pc));
  const svg = s('svg', { class: 'voice-pic', width: 128, height, role: 'img', 'aria-label': voiceSummary(x, c, key) },
    s('title', {}, voiceSummary(x, c, key)));

  // Where each candidate tone sits: from the lowest voice moving to it (voices that share a tone converge).
  const rightY = new Map<number, number>();
  p.moves.forEach((m, i) => {
    if (!rightY.has(m.to)) rightY.set(m.to, laneY(i) - 3.5 * m.semis);
  });
  p.entering.forEach((e, i) => rightY.set(e.pc, laneY(p.moves.length + i)));

  const lines = s('g');
  const dots = s('g');
  p.moves.forEach((m, i) => {
    const y1 = laneY(i);
    const y2 = rightY.get(m.to)!;
    if (!m.semis && y1 === y2) lines.append(s('line', { class: 'pm-held', x1: LX, x2: RX, y1, y2 }));
    else {
      const label = cTones.find((t) => t.pc === m.to)!.label;
      lines.append(s('line', { class: `vp-move ${toneClass(label)}`, x1: LX, x2: RX, y1, y2 }));
      if (m.semis) lines.append(s('text', { class: 'vp-step', x: (LX + RX) / 2, y: (y1 + y2) / 2 - 4 }, String(Math.abs(m.semis))));
    }
    dots.append(dot(LX, y1, m.fromLabel, 'vp-prior'));
    if (leftNames) {
      const name = xTones.find((t) => t.pc === m.from)!.name;
      dots.append(s('text', { class: `vp-name left${pitchInKey(m.from, key) ? '' : ' out'}`, x: LX - 11, y: y1 + 3.5 }, name));
    }
  });
  p.entering.forEach((e, i) => {
    const y = laneY(p.moves.length + i);
    lines.append(s('line', { class: `vp-move vp-enter ${toneClass(e.label)}`, x1: RX - 22, x2: RX, y1: y, y2: y }));
  });
  for (const t of cTones) {
    const y = rightY.get(t.pc);
    if (y === undefined) continue;
    dots.append(dot(RX, y, t.label));
    const held = xPcs.has(t.pc);
    dots.append(s('text', { class: `vp-name${held ? ' held' : ' new'}${pitchInKey(t.pc, key) ? '' : ' out'}`, x: RX + 11, y: y + 3.5 }, t.name));
  }
  svg.append(lines, dots);
  return svg;
}

function chordToneColumn(chord: Chord, key: Key): MapTone[] {
  return spelled(chord, key).map((t) => ({ pc: t.pc, label: t.label, name: t.name, midi: 48 + t.pc, bass: false }));
}

function dot(x: number, y: number, label: string, extra = ''): SVGGElement {
  return s('g', { class: `pm-dot ${toneClass(label)} ${extra}` }, s('circle', { cx: x, cy: y, r: 7 }), s('text', { x, y: y + 2.8 }, label));
}

export interface ExampleMap {
  svg: SVGSVGElement;
  /** Which column each bar of the example plays in (repeats share one). */
  columnOfBar: number[];
  /** Per column: its playing tint and its curve node (if it has a lane). */
  columns: { tint: SVGRectElement; node: SVGCircleElement | null }[];
}

/**
 * A compact Shared notes map for an example: one column per chord (repeats collapsed, marked x4), the
 * key's rows plus any outside note in amber, held bars, role dots, and the D/PD/T strip with the
 * curve, which loops back to the first chord.
 */
export function exampleMap(
  cols: { chord: Chord; count: number; first: number }[], chords: Chord[], allLanes: Lane[], key: Key, available: number,
  onColumn: (index: number) => (e: Event) => void,
): ExampleMap {
  const gutter = 18;
  const n = cols.length;
  const colW = Math.min(52, (available - gutter) / (n + 0.75));
  const counts = cols.some((c) => c.count > 1);
  const top = counts ? 36 : 26;
  const pitch = 15;
  // Full chord tones (not a voicing that may leave the 5th out), so every column reads alike.
  const tones = cols.map((c) => chordToneColumn(c.chord, key));
  const rows = mapRows(tones, key).reverse();
  const held = heldTones(tones);
  const lanes = cols.map((c) => allLanes[c.first]);
  const rowY = (r: number) => top + pitch * r + pitch / 2;
  const yOf = (pc: number) => rowY(rows.findIndex((r) => r.pc === pc));
  const stripTop = top + pitch * rows.length + 8;
  const laneH = 10;
  const height = stripTop + laneH * 3;
  const x = (i: number) => gutter + colW * (i + 0.5);
  const returnX = x(n - 1) + 0.75 * colW;
  const end = returnX + 8;
  const svg = s('svg', { class: 'pmap-svg ex-map', width: end, height, viewBox: `0 0 ${end} ${height}` });

  const columns: ExampleMap['columns'] = [];
  cols.forEach((col, i) => {
    const tint = s('rect', { class: 'pm-playing ex-tint', x: x(i) - colW / 2 + 1, y: 1, width: colW - 2, height: height - 2, rx: 6 });
    svg.append(tint, s('rect', { class: 'pm-col', x: x(i) - colW / 2, y: 0, width: colW, height, onclick: onColumn(i) },
      s('title', {}, `${chordSymbolInKey(col.chord, key)}: click to hear, double-click to add`)));
    columns.push({ tint, node: null });
  });
  cols.forEach((col, i) => {
    const out = chordFitInKey(col.chord, key) === 'outside';
    svg.append(s('text', { class: 'pm-head ex-sym', x: x(i), y: 11 }, chordSymbolInKey(col.chord, key)));
    svg.append(s('text', { class: `ex-num${out ? ' out' : ''}`, x: x(i), y: 22 }, romanNumeral(col.chord, key)));
    if (col.count > 1) svg.append(s('text', { class: 'ex-count', x: x(i), y: 32 }, `x${col.count}`));
  });
  rows.forEach((row, r) => {
    svg.append(s('text', { class: `pm-row-label ex-rowlabel${row.chromatic ? ' chromatic' : ''}`, x: 1, y: rowY(r) + 3 }, row.name));
    svg.append(s('line', { class: 'pm-row-line', x1: gutter, x2: end, y1: rowY(r), y2: rowY(r) }));
  });
  for (let i = 1; i < n; i++) for (const pc of held[i]) svg.append(s('line', { class: 'pm-held', x1: x(i - 1), x2: x(i), y1: yOf(pc), y2: yOf(pc) }));
  // Round again: dashed bars for notes the last chord carries into the first.
  for (const t of tones[0]) {
    if (n > 1 && tones[n - 1].some((p) => p.pc === t.pc)) svg.append(s('line', { class: 'pm-return-held', x1: x(n - 1), x2: returnX, y1: yOf(t.pc), y2: yOf(t.pc) }));
  }
  tones.forEach((col, i) => col.forEach((t) => svg.append(dot(x(i), yOf(t.pc), t.label))));

  svg.append(s('rect', { class: 'pm-panel', x: 0, y: stripTop, width: end, height: laneH * 3, rx: 5 }));
  const laneY = (l: Exclude<Lane, 'none'>) => stripTop + laneH * (LANES.indexOf(l) + 0.5);
  const pts: { x: number; y: number; i: number }[] = [];
  lanes.forEach((l, i) => l !== 'none' && pts.push({ x: x(i), y: laneY(l), i }));
  if (pts.length > 1) svg.append(s('path', { class: 'pm-curve', d: monotonePath(pts) }));
  if (lanes[n - 1] !== 'none' && lanes[0] !== 'none' && pts.length) {
    const back = { x: returnX, y: laneY(lanes[0] as Exclude<Lane, 'none'>) };
    const d = monotonePath([...pts.slice(-2), back]);
    const last = pts[pts.length - 1];
    svg.append(s('path', { class: 'pm-return-curve', d: `M${last.x},${last.y}${d.slice(d.lastIndexOf(' C'))}` }));
    svg.append(s('circle', { class: 'pm-return-node', cx: back.x, cy: back.y, r: 3.5 }));
  }
  for (const p of pts) {
    const node = s('circle', { class: 'pm-node', cx: p.x, cy: p.y, r: 4 });
    columns[p.i].node = node;
    svg.append(node);
  }

  const columnOfBar = chords.map((_, bar) => cols.findIndex((c) => bar >= c.first && bar < c.first + c.count));
  return { svg, columnOfBar, columns };
}

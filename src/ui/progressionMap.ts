// The "shared notes" map under the progression: each chord's sounding notes on rows of the key, grey
// bars for notes held into the next chord, and a strip showing each chord's function (D, PD, T) joined
// by a curve. On phones its columns sit exactly over the cards and scroll with them.

import { strum } from '../audio';
import { Chord, chordSymbol } from '../theory/chords';
import { chordSymbolInKey } from '../theory/keys';
import { Key } from '../theory/keys';
import { Lane, LaneInfo, MapRow, MapTone, columnTones, heldTones, mapRows, laneInfo, monotonePath, progressionLaneInfo, showsReturn, showsStrip } from '../theory/progressionMap';
import { bestVoicing } from '../theory/voicings';
import { ProgressionChord } from '../state';
import { cardShape } from '../playback';
import { clicksSound } from './common';
import { h, s, toneClass } from './dom';

const LANES: Exclude<Lane, 'none'>[] = ['D', 'PD', 'T'];

interface Layout {
  phone: boolean;
  /** Column centre and width for chord i (within its block). */
  cx: (i: number) => number;
  colWidth: number;
  gutter: number;
  top: number;
  pitch: number;
  gap: number;
  lane: number;
  /** Where row lines and the strip panel end. */
  end: (count: number) => number;
}

interface Context {
  list: ProgressionChord[];
  columns: MapTone[][];
  rows: MapRow[];
  held: number[][];
  infos: LaneInfo[];
  showStrip: boolean;
  playing: number | null;
  loop: boolean;
  key: Key | null;
  /** Chords picked on Relationships to try next (one, or a phrase): shown faded where the add card would put them. */
  ghosts: Chord[];
  /** Whether the first chord is shown coming round again (Loop on). */
  ret: boolean;
}

export function createProgressionMap(onSelect: (index: number) => void): {
  el: HTMLElement;
  render: (list: ProgressionChord[], key: Key | null, playing: number | null, phone: boolean, loop: boolean, ghosts?: Chord[]) => void;
} {
  const el = h('div', { class: 'pmap', id: 'progression-map' });

  const render = (list: ProgressionChord[], key: Key | null, playing: number | null, phone: boolean, loop: boolean, ghosts: Chord[] = []) => {
    const ret = showsReturn(list, loop);
    const columns = list.map((c) => columnTones(c, cardShape(c)));
    const infos = progressionLaneInfo(list, key);
    const ctx: Context = {
      list, columns, infos, playing, loop, key, ghosts, ret,
      rows: mapRows(columns, key).reverse(), // top row first (highest)
      held: heldTones(columns),
      showStrip: showsStrip(infos.map((l) => l.lane)),
    };
    const n = list.length;

    if (phone) {
      const layout: Layout = {
        phone, colWidth: 68, gutter: 0, top: 4, pitch: 17, gap: 8, lane: 13,
        cx: (i) => 16 + 31 + 68 * i,
        end: (count) => 16 + 68 * count + 62,
      };
      const { svg, height } = block(ctx, layout, 0, n, true);
      // The first faded column sits over the add card; any more extend the strip.
      svg.setAttribute('width', String(layout.end(n) + 16 + 68 * Math.max(0, ghosts.length + (ret ? 1 : 0) - 1)));
      svg.setAttribute('height', String(height));
      // Row and lane labels stay put in a sticky gutter while the columns scroll under it.
      const labels = s('svg', { width: 18, height });
      labelColumn(labels, ctx.rows, ctx.showStrip, layout, 3);
      el.replaceChildren(h('div', { class: 'pmap-gutter' }, labels), svg);
      return;
    }

    // Desktop: up to 8 columns share the width; more wrap into blocks of 8. With Loop on, the last
    // block also fits a faded return column (the first chord coming round again).
    const per = n > 8 ? 8 : n;
    const lastCount = n - per * Math.floor((n - 1) / per);
    // Faded columns (a phrase being tried, the loop return) squeeze the columns to fit, down to 36px;
    // past that the map scrolls sideways.
    const extra = ghosts.length + (ret ? 0.75 : 0);
    const colWidth = extra ? Math.max(36, Math.min(56, 336 / (lastCount + extra))) : n > 8 ? 42 : Math.min(56, Math.max(40, 336 / n));
    const needed = 24 + colWidth * (lastCount + extra) + 8;
    const layout: Layout = {
      phone, colWidth, gutter: 24, top: 22, pitch: 19, gap: 14, lane: 14,
      cx: (i) => 24 + colWidth * (i + 0.5),
      end: (count) => 24 + colWidth * count,
    };
    const svg = s('svg', { class: 'pmap-svg', width: needed > 360 ? needed : '100%' });
    let y = 0;
    for (let from = 0; from < n; from += per) {
      const to = Math.min(n, from + per);
      const { svg: part, height } = block(ctx, layout, from, to, to === n);
      const g = s('g', { transform: `translate(0, ${y})` }, ...Array.from(part.childNodes) as SVGElement[]);
      svg.append(g);
      y += height + 16;
    }
    svg.setAttribute('height', String(y - 16));
    el.replaceChildren(svg);
  };

  /** One block of columns [from, to): header (desktop), rows, held bars, dots and the function strip. */
  function block(ctx: Context, L: Layout, from: number, to: number, last: boolean): { svg: SVGSVGElement; height: number } {
    const symbol = (c: Chord) => (ctx.key ? chordSymbolInKey(c, ctx.key) : chordSymbol(c));
    const { list, columns, rows, held, infos, showStrip, playing } = ctx;
    const svg = s('svg', { class: 'pmap-svg' });
    const count = to - from;
    const x = (i: number) => L.cx(i - from);
    const rowY = (r: number) => L.top + L.pitch * r + L.pitch / 2;
    const rowsBottom = L.top + L.pitch * rows.length;
    const stripTop = rowsBottom + L.gap;
    const height = showStrip ? stripTop + L.lane * 3 : rowsBottom + 4;
    const yOf = (pc: number) => rowY(rows.findIndex((r) => r.pc === pc));
    const half = L.phone ? 31 : L.colWidth / 2;
    const laneY = (lane: Exclude<Lane, 'none'>) => stripTop + L.lane * (LANES.indexOf(lane) + 0.5);
    // After the last chord, faded: the chord being tried (where the add card would put it), then with
    // Loop on the first chord coming round again.
    const ghosts = last ? ctx.ghosts : [];
    const ghostXs = ghosts.map((_, k) => (L.phone ? x(to + k) : x(to - 1) + L.colWidth * (k + 1)));
    const lastGhostX = ghostXs[ghostXs.length - 1] ?? null;
    const returnX = ctx.ret && last
      ? (L.phone ? x(to + ghosts.length) : (lastGhostX ?? x(to - 1)) + 0.75 * L.colWidth)
      : null;
    const lastExtra = returnX ?? lastGhostX;
    const lineEnd = L.phone
      ? L.end(count) + 68 * Math.max(0, ghosts.length + (returnX !== null ? 1 : 0) - 1)
      : lastExtra !== null ? lastExtra + 8 : L.end(count);
    // A note that isn't on a row yet sits midway between its neighbours (its row arrives when it's added).
    const base = ctx.key ? ctx.key.tonic : rows[rows.length - 1]?.pc ?? 0;
    const rel = (pc: number) => ((pc - base) % 12 + 12) % 12;
    const yAny = (pc: number) => {
      const r = rows.findIndex((row) => row.pc === pc);
      if (r >= 0) return rowY(r);
      const above = rows.map((row, i) => ({ i, d: rel(row.pc) - rel(pc) })).filter((o) => o.d > 0).sort((a, b) => a.d - b.d)[0];
      const below = rows.map((row, i) => ({ i, d: rel(pc) - rel(row.pc) })).filter((o) => o.d > 0).sort((a, b) => a.d - b.d)[0];
      const ya = above ? rowY(above.i) : rowY(0) - L.pitch / 2;
      const yb = below ? rowY(below.i) : rowY(rows.length - 1) + L.pitch / 2;
      return (ya + yb) / 2;
    };
    const ghostTones = ghosts.map((g) => columnTones(g, bestVoicing(g)));
    const ghostLanes = ghosts.map((g, k) => (ctx.key ? laneInfo(g, ctx.key, ghosts[k + 1] ?? list[0]).lane : 'none'));

    // Behind everything: the playing column's tint, and each column's click area.
    if (playing !== null && playing >= from && playing < to) {
      svg.append(s('rect', { class: 'pm-playing', x: x(playing) - half + 2, y: 2, width: half * 2 - 4, height: height - 4, rx: 7 }));
    }
    for (let i = from; i < to; i++) {
      svg.append(s('rect', {
        class: 'pm-col', x: x(i) - half, y: 0, width: half * 2, height,
        onclick: () => onSelect(i),
      }, s('title', {}, symbol(list[i]))));
    }

    if (!L.phone) {
      for (let i = from; i < to; i++) {
        const sym = symbol(list[i]);
        const small = sym.length * 6 > L.colWidth - 4;
        svg.append(s('text', { class: `pm-head${small ? ' small' : ''}`, x: x(i), y: 14 }, sym));
      }
      labelColumn(svg, rows, showStrip, L, 4, stripTop);
    }

    rows.forEach((_, r) => svg.append(s('line', { class: 'pm-row-line', x1: L.phone ? 16 : L.gutter, x2: lineEnd, y1: rowY(r), y2: rowY(r) })));

    // Notes held into the next chord: a bar between the two dots (not across blocks).
    for (let i = from + 1; i < to; i++) {
      for (const pc of held[i]) {
        svg.append(s('line', { class: 'pm-held', x1: x(i - 1), x2: x(i), y1: yOf(pc), y2: yOf(pc) }));
      }
    }

    // The faded columns sit under the dots: their notes as hollow rings, with dashed bars for the notes
    // carried into them from the column before.
    const faded = (at: number, name: string, tones: MapTone[], fromX: number, fromTones: MapTone[], named: boolean) => {
      const g = s('g', { class: 'pm-return' });
      if (!L.phone) g.append(s('text', { class: 'pm-head pm-return-head', x: at, y: 14 }, name));
      for (const t of tones) {
        if (fromTones.some((p) => p.pc === t.pc)) g.append(s('line', { class: 'pm-return-held', x1: fromX, x2: at, y1: yAny(t.pc), y2: yAny(t.pc) }));
      }
      for (const t of tones) {
        const cy = yAny(t.pc);
        g.append(s('circle', { class: `pm-ghost ${toneClass(t.label)}`, cx: at, cy, r: L.phone ? 6 : 5.5 }));
        if (named && !rows.some((r) => r.pc === t.pc)) g.append(s('text', { class: 'pm-ghost-name', x: at + 8, y: cy + 3 }, t.name));
      }
      svg.append(g);
    };
    let prevX = x(to - 1);
    let prevTones = columns[to - 1];
    ghosts.forEach((g, k) => {
      faded(ghostXs[k], symbol(g), ghostTones[k], prevX, prevTones, true);
      prevX = ghostXs[k];
      prevTones = ghostTones[k];
    });
    if (returnX !== null) faded(returnX, symbol(list[0]), columns[0], prevX, prevTones, false);

    for (let i = from; i < to; i++) {
      for (const t of columns[i]) {
        const cy = yOf(t.pc);
        svg.append(s('g', {
          class: `pm-dot ${toneClass(t.label)}`,
          onclick: (e: Event) => {
            e.stopPropagation();
            if (clicksSound()) strum([t.midi]);
          },
        },
          s('title', {}, `${t.name}, ${t.label} of ${symbol(list[i])}${t.bass ? ', bass' : ''}`),
          s('circle', { cx: x(i), cy, r: 8 }),
          // The lowest note the shape sounds gets a ring.
          t.bass ? s('circle', { class: 'pm-bass-ring', cx: x(i), cy, r: 10.5 }) : null,
          s('text', { x: x(i), y: cy + 3 }, t.label),
        ));
      }
    }

    if (showStrip) {
      svg.append(s('rect', { class: 'pm-panel', x: 0, y: stripTop, width: lineEnd, height: L.lane * 3, rx: 6 }));
      if (!L.phone) LANES.forEach((lane) => svg.append(s('text', { class: 'pm-lane-label', x: 4, y: laneY(lane) + 3 }, lane)));
      // The curve breaks at a chord with no function and picks up again after it.
      const runs: { x: number; y: number; i: number }[][] = [[]];
      for (let i = from; i < to; i++) {
        const lane = infos[i].lane;
        if (lane === 'none') runs.push([]);
        else runs[runs.length - 1].push({ x: x(i), y: laneY(lane), i });
      }
      for (const run of runs) if (run.length > 1) svg.append(s('path', { class: 'pm-curve', d: monotonePath(run) }));
      // On to the faded columns: dashed segments ending at hollow nodes (the ghost, then the return).
      const tail = [...runs[runs.length - 1]];
      const extend = (at: number, lane: Lane) => {
        if (lane === 'none' || !tail.length) {
          tail.length = 0;
          return;
        }
        const end = { x: at, y: laneY(lane), i: -1 };
        const d = monotonePath([...tail.slice(-2), end]);
        const lastPoint = tail[tail.length - 1];
        svg.append(s('path', { class: 'pm-return-curve', d: `M${lastPoint.x},${lastPoint.y}${d.slice(d.lastIndexOf(' C'))}` }));
        svg.append(s('circle', { class: 'pm-return-node', cx: end.x, cy: end.y, r: 4 }));
        tail.push(end);
      };
      if (infos[to - 1].lane === 'none') tail.length = 0;
      ghostXs.forEach((gx, k) => extend(gx, ghostLanes[k]));
      if (returnX !== null) extend(returnX, infos[0].lane);
      runs.flat().forEach((p) => svg.append(s('circle', { class: 'pm-node', cx: p.x, cy: p.y, r: 4.5, onclick: () => onSelect(p.i) },
        s('title', {}, infos[p.i].reason))));
    }
    return { svg, height };
  }

  /** Row names (amber when outside the key) and, with a key, the D/PD/T lane names. */
  function labelColumn(svg: SVGSVGElement, rows: MapRow[], showStrip: boolean, L: Layout, at: number, stripTop?: number) {
    rows.forEach((row, r) => {
      svg.append(s('text', { class: `pm-row-label${row.chromatic ? ' chromatic' : ''}`, x: at, y: L.top + L.pitch * r + L.pitch / 2 + 3.5 }, row.name));
    });
    if (showStrip && L.phone) {
      const top = stripTop ?? L.top + L.pitch * rows.length + L.gap;
      svg.append(s('rect', { class: 'pm-panel', x: 0, y: top, width: 18, height: L.lane * 3 }));
      LANES.forEach((lane, i) => svg.append(s('text', { class: 'pm-lane-label', x: at, y: top + L.lane * (i + 0.5) + 3 }, lane)));
    }
  }

  return { el, render };
}


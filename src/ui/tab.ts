// The Tab page: the progression written out as guitar tab in the chosen playing pattern, with a
// playhead that follows Play. The notes come from a dry run of the player's own scheduler.

import { now } from '../audio';
import { currentKey } from '../key';
import { PROGRESSION_ID, cardShape } from '../playback';
import { Playback, currentPlayback, onPlayback } from '../player';
import { state, subscribe } from '../state';
import { chordSymbolInKey } from '../theory/keys';
import { ECHO_STYLES, STRAIGHT_STYLES } from '../theory/patterns';
import { RhythmItem, TabBar, tabBars, tabPasses } from '../theory/tab';
import { h, s } from './dom';
import { LaidBar, LaidLine, TabLayout, layoutTab, slotX, stringY } from './tabLayout';

const NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];
const phone = window.matchMedia('(max-width: 999px)');

export function createTab(): { el: HTMLElement; refresh: () => void } {
  const card = h('section', { class: 'card tab-card' });
  const page = h('div', { class: 'page tab-page' }, card);

  let bars: TabBar[] = [];
  let layout: TabLayout | null = null;
  let perPass = 0;
  let passes = 1;
  /** Elements at each bar's slots, to light under the playhead. */
  let atSlot = new Map<string, Element[]>();
  let head: SVGLineElement | null = null;
  let lit: Element[] = [];
  let shownLine = -1;

  const render = () => {
    const pad = parseFloat(getComputedStyle(card).paddingLeft) + parseFloat(getComputedStyle(card).paddingRight);
    const width = card.clientWidth - pad;
    if (page.hidden || width <= 0) return;
    const { key } = currentKey();
    const slots = state.progression.map((c) => ({ chord: c, shape: cardShape(c) })).filter((x) => x.shape !== null);
    const style = state.playPattern;
    const settings = { style, variant: state.playVariants[style], beats: state.beatsPerBar, barsPerChord: state.barsPerChord };
    bars = tabBars(slots.map((x) => x.shape!), settings);
    perPass = slots.length * Math.max(1, state.barsPerChord);
    passes = tabPasses(settings, perPass);
    const swing = state.swing && !STRAIGHT_STYLES.includes(style);
    layout = layoutTab({
      bars, names: slots.map((x) => chordSymbolInKey(x.chord, key)), beats: state.beatsPerBar,
      width, phone: phone.matches, loop: state.loop, swing,
      letRing: style !== 'strum' && !(style === 'postrock' && settings.variant === 'pulse'), echo: ECHO_STYLES.includes(style),
    });
    card.replaceChildren(draw(layout));
    shownLine = -1;
    lit = [];
    follow(currentPlayback());
  };

  const draw = (L: TabLayout) => {
    const m = L.m;
    const svg = s('svg', { class: `tab-svg${bars.length ? '' : ' empty'}`, width: L.width, height: L.height, viewBox: `0 0 ${L.width} ${L.height}`, role: 'img', 'aria-label': 'Tab' });
    atSlot = new Map();
    const mark = (bar: number, slot: number, el: Element) => {
      const k = `${bar}:${slot}`;
      atSlot.set(k, [...(atSlot.get(k) ?? []), el]);
      return el;
    };
    const marks = [L.letRing ? 'let ring' : null, L.swing ? 'Swing' : null, L.echo ? 'Echo' : null].filter(Boolean).join('   ');
    if (marks) svg.append(s('text', { class: 'tab-swing', x: 0, y: 10 }, marks));
    const last = L.lines[L.lines.length - 1];
    L.lines.forEach((line) => {
      const left = m.labels;
      const right = line.bars[line.bars.length - 1].x + line.bars[line.bars.length - 1].width;
      for (let st = 0; st < 6; st++) {
        const y = stringY(line, st, m);
        svg.append(s('line', { class: 'tab-string', x1: left, x2: right, y1: y, y2: y }));
        svg.append(s('text', { class: 'tab-label', x: 0, y: y + 3.5 }, NAMES[st]));
      }
      const top = stringY(line, 5, m);
      const bottom = stringY(line, 0, m);
      const barline = (x: number) => svg.append(s('line', { class: 'tab-bar', x1: x, x2: x, y1: top, y2: bottom }));
      line.bars.forEach((b) => {
        barline(b.x);
        const tb = bars[b.index];
        if (b.name) svg.append(s('text', { class: 'tab-chord', x: slotX(b, 0) - 4, y: line.chordName }, b.name));
        if (b.index === 0) {
          const x = b.x + 4 + m.timeRoom / 2;
          svg.append(s('text', { class: 'tab-time', x, y: top + 1.25 * m.gap, 'font-size': m.time }, String(L.beats)));
          svg.append(s('text', { class: 'tab-time', x, y: top + 3.75 * m.gap, 'font-size': m.time }, '4'));
        }
        if (tb) drawRhythm(svg, tb, b, line, mark);
        for (const e of tb?.events ?? []) {
          const x = slotX(b, e.slot);
          if (e.strum) {
            svg.append(mark(b.index, e.slot, s('text', { class: 'tab-arrow', x, y: line.arrow }, e.strum === 'up' ? '↑' : '↓')));
            if (e.short) svg.append(s('circle', { class: 'tab-staccato', cx: x, cy: line.arrow + 5, r: 1.4 }));
          }
          if (e.roll) {
            const ys = e.notes.map((n) => stringY(line, n.string, m));
            svg.append(s('path', { class: 'tab-roll', d: wavy(x - (e.notes.some((n) => n.fret > 9) ? 12 : 9), Math.min(...ys) - 4, Math.max(...ys) + 4) }));
          }
          for (const n of e.notes) {
            svg.append(mark(b.index, e.slot, s('text', { class: `tab-fret${e.faded ? ' faded' : ''}`, x, y: stringY(line, n.string, m) + m.fret * 0.36 }, String(n.fret))));
          }
        }
      });
      if (line.muted) {
        // One "P.M." for the line, then a dashed line under each run of muted notes.
        const y = line.mutedY;
        const [first, ...rest] = line.muted;
        svg.append(s('text', { class: 'tab-pm', x: first[0], y: y + 3.5 }, 'P.M.'));
        if (first[1] > first[0] + 28) svg.append(s('line', { class: 'tab-pm-line', x1: first[0] + 24, x2: first[1], y1: y, y2: y }));
        for (const [x1, x2] of rest) svg.append(s('line', { class: 'tab-pm-line', x1, x2, y1: y, y2: y }));
      }
      if (line !== last) barline(right);
      else endSign(svg, L, line, right);
    });
    head = s('line', { class: 'tab-head', x1: 0, x2: 0, y1: 0, y2: 0, visibility: 'hidden' });
    svg.append(head);
    return svg;
  };

  const endSign = (svg: SVGSVGElement, L: TabLayout, line: LaidLine, x: number) => {
    const m = L.m;
    const top = stringY(line, 5, m);
    const bottom = stringY(line, 0, m);
    svg.append(s('line', { class: 'tab-bar', x1: x - 5, x2: x - 5, y1: top, y2: bottom }));
    svg.append(s('line', { class: 'tab-bar thick', x1: x - 1.5, x2: x - 1.5, y1: top, y2: bottom }));
    if (L.end === 'repeat') {
      for (const [a, b] of [[4, 3], [2, 1]]) {
        svg.append(s('circle', { class: 'tab-dot', cx: x - 10, cy: (stringY(line, a, m) + stringY(line, b, m)) / 2, r: 2.3 }));
      }
    }
  };

  // ---- Playhead: the current eighth, from the bar's start on the audio clock.
  let playing: Playback | null = null;
  let frame = 0;
  const tick = () => {
    frame = 0;
    const p = playing;
    if (!p?.bar || !layout || page.hidden) return;
    const { start, beat, beats, swing, inPass, played } = p.bar;
    const at = Math.max(0, (now() - start) / beat);
    const whole = Math.min(beats - 1, Math.floor(at));
    const slot = whole * 2 + (at - whole >= (swing ? 2 / 3 : 0.5) && at < beats ? 1 : 0);
    const index = passes > 1 ? played % (perPass * passes) : inPass;
    light(index, slot);
    frame = requestAnimationFrame(tick);
  };

  const light = (index: number, slot: number) => {
    const L = layout!;
    const lineIndex = L.lines.findIndex((l) => l.bars.some((b) => b.index === index));
    const line = L.lines[lineIndex];
    const bar = line?.bars.find((b) => b.index === index);
    if (!line || !bar || !head) return hide();
    const x = slotX(bar, slot);
    head.setAttribute('x1', String(x));
    head.setAttribute('x2', String(x));
    head.setAttribute('y1', String(stringY(line, 5, L.m) - 9));
    head.setAttribute('y2', String(line.stemEnd + 2));
    head.setAttribute('visibility', 'visible');
    const now = atSlot.get(`${index}:${slot}`) ?? [];
    if (now !== lit) {
      lit.forEach((el) => el.classList.remove('now'));
      now.forEach((el) => el.classList.add('now'));
      lit = now;
    }
    if (lineIndex !== shownLine) {
      shownLine = lineIndex;
      keepInView(line);
    }
  };

  const hide = () => {
    head?.setAttribute('visibility', 'hidden');
    lit.forEach((el) => el.classList.remove('now'));
    lit = [];
    shownLine = -1;
  };

  /** Keep the playing line on screen: above the dock on phones; on desktop only once it has left the screen. */
  const keepInView = (line: LaidLine) => {
    const svg = card.querySelector('svg');
    const scroller = page.closest('main');
    if (!svg || !scroller) return;
    const box = svg.getBoundingClientRect();
    const top = box.top + line.top;
    const bottom = box.top + line.stemEnd + 6;
    const view = scroller.getBoundingClientRect();
    const dock = phone.matches ? parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dock-h')) || 0 : 0;
    const visibleBottom = Math.min(view.bottom, window.innerHeight - dock);
    const visibleTop = Math.max(view.top, 0);
    if (top >= visibleTop && bottom <= visibleBottom) return;
    const target = scroller.scrollHeight > scroller.clientHeight ? scroller : document.scrollingElement!;
    target.scrollBy({ top: top - visibleTop - 12, behavior: 'smooth' });
  };

  const follow = (p: Playback | null) => {
    playing = p?.id === PROGRESSION_ID && p.bar ? p : null;
    if (!playing) {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      hide();
    } else if (!frame) frame = requestAnimationFrame(tick);
  };
  onPlayback(follow);

  subscribe(render);
  phone.addEventListener('change', render);
  window.addEventListener('resize', render);
  let seen = 0;
  new ResizeObserver(() => card.clientWidth !== seen && ((seen = card.clientWidth), render())).observe(card);
  return { el: page, refresh: render };
}

/**
 * The rhythm under a bar: a stem per onset (a half note's lower half only, none for a whole note),
 * eighths in the same beat beamed, a lone eighth flagged, dots for dotted values, rests on the row.
 */
function drawRhythm(svg: SVGSVGElement, tb: TabBar, b: LaidBar, line: LaidLine, mark: (bar: number, slot: number, el: Element) => Element) {
  const { stemTop: y0, stemEnd: y1 } = line;
  const items = tb.rhythm;
  const notes = items.filter((r) => !r.rest);
  const beamed = (r: RhythmItem) => r.length === 1 && notes.some((o) => o !== r && o.length === 1 && Math.floor(o.slot / 2) === Math.floor(r.slot / 2));
  for (const r of items) {
    const x = slotX(b, r.slot);
    if (r.rest) {
      const mid = (y0 + y1) / 2;
      svg.append(s('path', { class: 'tab-rest', d: r.length === 2 ? quarterRest(x, mid) : eighthRest(x, mid) }));
      continue;
    }
    if (r.length === 8) continue;
    const half = r.length === 4 || r.length === 6;
    svg.append(mark(b.index, r.slot, s('line', { class: 'tab-stem', x1: x, x2: x, y1: half ? (y0 + y1) / 2 : y0, y2: y1 })));
    if (r.length === 3 || r.length === 6) svg.append(s('circle', { class: 'tab-rdot', cx: x + 4.5, cy: y1 - 2, r: 1.5 }));
    if (r.tied) {
      const prev = items[items.indexOf(r) - 1];
      const px = slotX(b, prev.slot);
      svg.append(s('path', { class: 'tab-tie', d: `M${px + 2},${y1 + 3} Q${(px + x) / 2},${y1 + 8} ${x - 2},${y1 + 3}` }));
    }
    // Tremolo: three slashes across the stem.
    if (tb.events.some((e) => e.slot === r.slot && e.tremolo)) {
      for (let i = 0; i < 3; i++) {
        const y = y0 + 4 + i * 3.5;
        svg.append(s('line', { class: 'tab-tremolo', x1: x - 3.5, x2: x + 3.5, y1: y + 1.5, y2: y - 1.5 }));
      }
    }
    if (r.length !== 1) continue;
    if (beamed(r)) {
      const partner = r.slot % 2 === 0 ? notes.find((o) => o.length === 1 && o.slot === r.slot + 1) : undefined;
      if (partner) svg.append(s('line', { class: 'tab-beam', x1: x, x2: slotX(b, partner.slot), y1: y1 - 1, y2: y1 - 1 }));
    } else {
      svg.append(s('path', { class: 'tab-flag', d: `M${x},${y1} q${0.5},-5 ${5},-8` }));
    }
  }
}

const eighthRest = (x: number, y: number) => `M${x - 1.5},${y - 3} m-1.2,0 a1.2,1.2 0 1,0 2.4,0 a1.2,1.2 0 1,0 -2.4,0 M${x - 0.5},${y - 3} Q${x + 1.5},${y - 2} ${x + 2.5},${y - 5} L${x - 0.5},${y + 5}`;
const quarterRest = (x: number, y: number) => `M${x - 1.5},${y - 7} l3,3.5 l-3,3 l3,3.5 q-3,-1 -2,3`;

/** A thin wavy vertical line (a roll) from y1 down to y2. */
function wavy(x: number, y1: number, y2: number): string {
  let d = `M${x},${y1}`;
  for (let y = y1, i = 0; y < y2; y += 4, i++) d += ` Q${x + (i % 2 ? -2.5 : 2.5)},${y + 2} ${x},${Math.min(y + 4, y2)}`;
  return d;
}

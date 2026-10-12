// How the chord sounds (a word or two, and one line on why), then its tones: as chips in degree
// order, or (behind the chevron) as a stack showing each slot of the chord's structure.

import { strum } from '../audio';
import { Chord, chordTones } from '../theory/chords';
import { chordCharacter, chordReason } from '../theory/character';
import { chordStructure } from '../theory/structure';
import { currentKey } from '../key';
import { Fingering, soundingNotes } from '../theory/fingering';
import { state, update } from '../state';
import { h, toneClass } from './dom';
import { clicksSound } from './common';
import { chevronIcon } from './icons';

/**
 * `voicing` is the shape being played (to know which tones are present and which octave to
 * play a tapped tone in); `dots` returns the diagram or fretboard whose dots a hovered tone lights up.
 */
export function toneArea(chord: Chord, voicing: Fingering | null, dots: () => Element | null): HTMLElement[] {
  const notes = voicing ? soundingNotes(voicing) : [];
  const present = new Set(notes.map((n) => n.pc));
  const midiFor = (pc: number) => notes.find((n) => n.pc === pc)?.midi ?? 48 + pc;

  const focus = (pc: number | null) => {
    const root = dots();
    if (!root) return;
    root.classList.toggle('tone-focus', pc !== null);
    root.querySelectorAll('.tone-focused').forEach((el) => el.classList.remove('tone-focused'));
    if (pc !== null) root.querySelectorAll(`[data-pc="${pc}"]`).forEach((el) => el.classList.add('tone-focused'));
  };
  const hover = (pc: number) => ({
    onmouseenter: () => focus(pc),
    onmouseleave: () => focus(null),
    onfocus: () => focus(pc),
    onblur: () => focus(null),
  });

  const chips = () => h('div', { class: 'tone-strip' },
    chordTones(chord).map((t) => {
      const sounding = !voicing || present.has(t.pc);
      return h('button', {
        class: `tone-chip ${toneClass(t.label)}${sounding ? '' : ' omitted'}`,
        title: `Play ${t.name}`,
        onclick: () => clicksSound() && strum([midiFor(t.pc)]),
        ...hover(t.pc),
      },
        t.pc === chord.bass ? h('span', { class: 'tone-bass' }, 'bass') : null,
        h('span', { class: 'tone-role' }, t.label),
        h('span', { class: 'tone-name' }, t.name),
      );
    }),
  );

  // The stack: a group label spanning its rows, then each row's slot and its four option columns.
  const structure = () => {
    const rows = chordStructure(chord, voicing);
    const cells: HTMLElement[] = [];
    let line = 1;
    rows.forEach((row, i) => {
      if (row.group === 'Bass') {
        cells.push(h('div', { class: 'st-gap', style: `grid-row: ${line}` }));
        line++;
      }
      if (row.group !== rows[i - 1]?.group) {
        const span = rows.filter((r) => r.group === row.group).length;
        cells.push(h('div', { class: 'st-label', style: `grid-row: ${line} / span ${span}` }, row.group));
      }
      const tone = row.label ? toneClass(row.label) : '';
      cells.push(row.state === 'on' && row.pc !== null
        ? h('button', {
          class: `st-slot on ${tone}`, style: `grid-row: ${line}`, title: `Play ${row.note}`,
          onclick: () => clicksSound() && strum([midiFor(row.pc!)]),
          ...hover(row.pc),
        }, row.note)
        : h('div', {
          class: `st-slot ${row.state} ${tone}`, style: `grid-row: ${line}`,
          title: row.state === 'implied' ? 'Not in this shape' : null,
        }, row.note ?? ''));
      row.options.forEach((opt, col) => {
        if (opt) cells.push(h('span', { class: `st-opt${opt.on ? ` on ${tone}` : ''}`, style: `grid-row: ${line}; grid-column: ${col + 3}` }, opt.text));
      });
      line++;
    });
    return h('div', { class: 'structure' }, cells);
  };

  const open = state.showStructure;
  const toggle = h('button', {
    class: 'structure-toggle', 'aria-expanded': String(open),
    title: open ? 'Show tone chips' : 'Show chord structure',
    'aria-label': open ? 'Show tone chips' : 'Show chord structure',
    onclick: () => update({ showStructure: !state.showStructure }),
  }, chevronIcon());

  return [
    h('p', { class: 'chord-about' },
      h('span', { class: 'chord-character' }, `${chordCharacter(chord.template.id) ?? ''}.`), ' ', chordReason(chord, currentKey().key)),
    h('div', { class: 'tones' }, open ? structure() : chips(), toggle),
  ];
}

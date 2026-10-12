// The Progression sidebar (a dock at the bottom on phones): the transport, then the chord chart
// with a diagram per chord (drag to reorder), the selected card marked, and the add card at the end.

import { currentKey } from '../key';
import { currentPlayback, onNote, onPlayback } from '../player';
import { PROGRESSION_ID, cardShape } from '../playback';
import { state, subscribe, update } from '../state';
import { Chord, chordSymbol } from '../theory/chords';
import { chordFitInKey, romanNumeral } from '../theory/keys';
import { bestVoicing, fingeringToneLabels } from '../theory/voicings';
import { addCardLabel } from '../interaction';
import { cardIndex, moveIndex } from '../yourChords';
import { chordBox, pluckBox } from './chordBox';
import {
  addSelection, clearProgression, selectedPhrase, selectionSource, duplicateCard, moveProgressionCard, removeFromProgression, selectCard, takeJustAdded,
} from './common';
import { enableReorder } from './dragReorder';
import { createProgressionMap } from './progressionMap';
import { chevronIcon } from './icons';
import { h, toneClass } from './dom';


/** A chord diagram with its dots labelled and coloured by role (R, 3, 5...). */
export function labelledBox(chord: Chord, fingering: NonNullable<ReturnType<typeof bestVoicing>>): SVGSVGElement {
  return chordBox(fingering,
    fingeringToneLabels(chord, fingering).map((label) => (label === null ? null : { text: label, cls: toneClass(label || undefined) })),
    `${chordSymbol(chord)} chord diagram`, true);
}

/**
 * The sidebar's own header (title, Play and Loop, Clear) and its body (the chart). On phones the
 * header is hidden and Play and Loop move to the dock's bottom row.
 */
export function createSidebar(transport: HTMLElement): { header: HTMLElement; body: HTMLElement } {
  const clearButton = h('button', { class: 'text-btn side-clear', onclick: clearProgression }, 'Clear');
  const title = h('h2', {}, 'Progression');
  const header = h('div', { class: 'side-header' }, title, clearButton);
  const chart = h('div', { class: 'chart' });
  // The shared-notes map (toggled below the chart; a tab on top of the dock on phones). On phones the
  // map and the cards share one horizontal scroller, so each column stays over its card.
  const map = createProgressionMap((i) => selectCard(i));
  const scroller = h('div', { class: 'chart-scroll' }, map.el, chart);
  const mapToggle = h('button', {
    class: 'map-toggle', title: 'Shared notes', 'aria-label': 'Shared notes', 'aria-controls': 'progression-map',
    onclick: () => update({ showMap: !state.showMap }),
  }, chevronIcon());
  const phone = window.matchMedia('(max-width: 999px)');
  let cards: HTMLElement[] = [];
  let shownSelected = -1;
  const sidebar = h('aside', { class: 'sidebar', 'aria-label': 'Progression' });
  const drag = enableReorder(chart, {
    items: () => cards,
    ignore: '.remove-btn',
    scrollers: () => [scroller, chart, sidebar],
    bounds: () => sidebar,
    onTap: selectCard,
    onMove: (from, to) => {
      // During playback the change is heard from the next chord; the sounding card keeps its highlight.
      const p = currentPlayback();
      moveProgressionCard(from, to);
      if (p?.id === PROGRESSION_ID && p.step !== null) cards[moveIndex(p.step, from, to)]?.classList.add('playing');
    },
  });

  const addCard = () => {
    // A phrase picked on Relationships adds all its chords: their names stacked under the +.
    const phrase = selectedPhrase();
    if (phrase) {
      const names = phrase.map((c) => chordSymbol(c));
      const title = `Add ${names.join(' ')} (A)`;
      return h('button', { class: 'add-card phrase', title, 'aria-label': title, onclick: addSelection },
        h('span', { class: 'add-plus' }, '+'), names.map((nm) => h('span', { class: 'add-sym' }, nm)));
    }
    const label = addCardLabel(state.selected);
    return h('button', {
      class: 'add-card', title: label.title, 'aria-label': label.title, disabled: label.disabled,
      onclick: addSelection,
    }, h('span', { class: 'add-plus' }, '+'), label.symbol ? h('span', { class: 'add-sym' }, label.symbol) : null);
  };

  const render = () => {
    const { key } = currentKey();
    const n = state.progression.length;
    const selected = cardIndex(n, state.selectedCard);
    clearButton.hidden = !n;
    drag.cancel();
    // Click a card to select and hear it; double-click duplicates it right after itself; drag to move it.
    cards = state.progression.map((chord, i) => {
      const fingering = cardShape(chord);
      const outside = chordFitInKey(chord, key) === 'outside';
      return h('div', {
        class: `chart-card${i === selected ? ' selected' : ''}`, role: 'button', tabindex: 0,
        title: 'Click to select, drag to move, double-click to duplicate',
        'aria-label': chordSymbol(chord),
        onclick: (e: Event) => {
          const clicks = (e as MouseEvent).detail;
          if (clicks === 2) duplicateCard(i);
          else if (clicks <= 1) selectCard(i);
        },
        onkeydown: (e: Event) => {
          if ((e as KeyboardEvent).key === 'Enter') selectCard(i);
        },
      },
        h('div', { class: 'card-top' },
          // Long names (Abmaj7) shrink to fit the card.
          h('span', { class: `sym${chordSymbol(chord).length > 4 ? ' long' : ''}` }, chordSymbol(chord)),
          // Chords from outside the key get their numeral in the extension colour.
          h('span', { class: `numeral${outside ? ' out' : ''}` }, romanNumeral(chord, key)),
        ),
        fingering ? labelledBox(chord, fingering) : null,
        h('button', {
          class: 'remove-btn', title: 'Remove (Delete)', 'aria-label': `Remove ${chordSymbol(chord)}`,
          onclick: (e: Event) => { e.stopPropagation(); removeFromProgression(i); },
        }, '×'),
      );
    });
    chart.replaceChildren(...cards, addCard());
    renderMap();
    // A newly selected card (arrow keys, or a column of the map) is scrolled into view.
    if (selected !== shownSelected && cards[selected]) cards[selected].scrollIntoView({ block: 'nearest', inline: 'nearest' });
    shownSelected = selected;
    // A brief pulse on the card just added.
    if (takeJustAdded() && cards[selected]) {
      const card = cards[selected];
      card.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      card.classList.add('pulse');
      setTimeout(() => card.classList.remove('pulse'), 450);
    }
  };

  function renderMap() {
    const n = state.progression.length;
    const open = state.showMap && n > 0;
    mapToggle.hidden = !n;
    mapToggle.setAttribute('aria-expanded', String(open));
    map.el.hidden = !open;
    queueMicrotask(measureDock);
    if (!open) return;
    const p = currentPlayback();
    // A chord picked on Relationships (an After idea or a key chip) shows faded where it would be added.
    const source = selectionSource();
    const phrase = selectedPhrase();
    const trying = phrase ?? (state.selectedCard === null && state.selected && source && /^(after|key):/.test(source) ? [state.selected] : []);
    map.render(state.progression, currentKey().key, p?.id === PROGRESSION_ID ? p.step : null, phone.matches, state.loop, trying);
  }

  function measureDock() {
    if (sidebar.isConnected) document.documentElement.style.setProperty('--dock-h', `${sidebar.offsetHeight}px`);
  }
  phone.addEventListener('change', renderMap);

  // The sounding card lights up and its dots ring as each string sounds; on phones it's kept in view.
  onPlayback((p) => {
    const step = p?.id === PROGRESSION_ID ? p.step : null;
    cards.forEach((el, i) => el.classList.toggle('playing', step === i));
    if (step !== null && phone.matches) cards[step]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    renderMap();
  });
  onNote((strings, p) => {
    const box = p.id === PROGRESSION_ID && p.step !== null ? cards[p.step]?.querySelector('.chord-box') : null;
    if (box) pluckBox(box, strings);
  });

  subscribe(render);
  render();

  sidebar.append(scroller, mapToggle);
  const place = () => (phone.matches ? sidebar.prepend(transport) : title.after(transport));
  phone.addEventListener('change', place);
  window.addEventListener('resize', place);
  place();
  // The page leaves room for the dock, however tall it is (it grows when the map is open): measured
  // after every render, and whenever its size changes.
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(measureDock).observe(sidebar);
  return { header, body: sidebar };
}

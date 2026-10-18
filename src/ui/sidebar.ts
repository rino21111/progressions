// The Progression sidebar (a dock at the bottom on phones): Play and a menu (Loop, Clear, Hide), then
// the chord chart with a diagram per chord (drag to reorder), the selected card marked, the add card at
// the end, and Shared notes folded under it. On phones the dock rests as a strip of chord chips.

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
import { chevronIcon, moreIcon } from './icons';
import { checkbox, menuItem, popover } from './menu';
import { h, toneClass } from './dom';


/** A chord diagram with its dots labelled and coloured by role (R, 3, 5...). */
export function labelledBox(chord: Chord, fingering: NonNullable<ReturnType<typeof bestVoicing>>): SVGSVGElement {
  return chordBox(fingering,
    fingeringToneLabels(chord, fingering).map((label) => (label === null ? null : { text: label, cls: toneClass(label || undefined) })),
    `${chordSymbol(chord)} chord diagram`, true);
}

/**
 * The sidebar's own header (title, Play, the menu) and its body (the chart). On phones the header is
 * hidden and Play and the menu move to the dock's row.
 */
export function createSidebar(play: HTMLElement, hide: () => void): { header: HTMLElement; body: HTMLElement } {
  const menuButton = h('button', { class: 'player-btn toggle-btn menu-btn', title: 'Progression menu', 'aria-label': 'Progression menu' }, moreIcon());
  const loop = checkbox('Loop', () => state.loop, (on) => update({ loop: on }));
  let close = () => {};
  const clearItem = menuItem('Clear', clearProgression, () => close());
  const menu = popover(menuButton, h('div', { class: 'pop-row' }, loop.el), clearItem, menuItem('Hide', hide, () => close()));
  close = menu.close;
  menu.el.classList.add('side-menu');
  const title = h('h2', {}, 'Progression');
  const header = h('div', { class: 'side-header' });
  const chart = h('div', { class: 'chart' });
  // Shared notes, folded under the chart (on phones the map and the cards share one horizontal
  // scroller, so each column stays over its card).
  const map = createProgressionMap((i) => selectCard(i));
  const scroller = h('div', { class: 'chart-scroll' }, map.el, chart);
  const mapToggle = h('button', {
    class: 'map-toggle', 'aria-controls': 'progression-map',
    onclick: () => update({ showMap: !state.showMap }),
  }, chevronIcon(), 'Shared notes');
  // Phones: the dock rests as one row (chord chips, Play, the menu); the handle or a chip opens it.
  const strip = h('div', { class: 'strip-chips' });
  const handle = h('button', { class: 'dock-handle', onclick: () => setFull(!full) }, chevronIcon());
  const dockRow = h('div', { class: 'dock-row' });
  let full = false;
  const setFull = (on: boolean) => {
    full = on;
    sidebar.classList.toggle('strip', !full);
    handle.title = full ? 'Fold the progression' : 'Open the progression';
    handle.setAttribute('aria-label', handle.title);
    handle.setAttribute('aria-expanded', String(full));
    queueMicrotask(measureDock);
  };
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
    clearItem.disabled = !n;
    loop.sync();
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
    strip.replaceChildren(...state.progression.map((chord, i) => h('button', {
      class: `strip-chip${i === selected ? ' selected' : ''}`,
      onclick: () => {
        setFull(true);
        selectCard(i);
      },
    }, chordSymbol(chord))));
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
    [...strip.children].forEach((el, i) => el.classList.toggle('playing', step === i));
    if (step !== null && phone.matches) cards[step]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    renderMap();
  });
  onNote((strings, p) => {
    const box = p.id === PROGRESSION_ID && p.step !== null ? cards[p.step]?.querySelector('.chord-box') : null;
    if (box) pluckBox(box, strings);
  });

  subscribe(render);
  render();

  const place = () => {
    if (phone.matches) {
      sidebar.replaceChildren(handle, scroller, dockRow);
      dockRow.replaceChildren(play, strip, mapToggle, h('span', { class: 'spacer' }), menu.el);
      header.replaceChildren();
    } else {
      sidebar.replaceChildren(scroller, mapToggle);
      header.replaceChildren(title, play, h('span', { class: 'spacer' }), menu.el);
    }
  };
  phone.addEventListener('change', place);
  window.addEventListener('resize', () => phone.matches === sidebar.contains(dockRow) || place());
  place();
  setFull(false);
  // The page leaves room for the dock, however tall it is (it grows when the map is open): measured
  // after every render, and whenever its size changes.
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(measureDock).observe(sidebar);
  return { header, body: sidebar };
}

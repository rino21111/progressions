// Bits shared by both pages.

import { now, strum } from '../audio';
import { noteCause } from '../undo';
import { afterChord, append, duplicateAt, moveCard, moveIndex, removeAt } from '../yourChords';
import { chordClickAction } from '../interaction';
import { Chord, TEMPLATE_BY_ID, chordSymbol } from '../theory/chords';
import { Fingering, analyzeFingering, soundingNotes } from '../theory/fingering';
import { rootName } from '../theory/notes';
import { bestVoicing } from '../theory/voicings';
import { smoothShape } from '../theory/smooth';
import { AppState, ProgressionChord, state, update } from '../state';
import { PROGRESSION_ID, cardShape } from '../playback';
import { currentPlayback, remapSteps } from '../player';
import { isDragging } from './dragReorder';
import { h } from './dom';

/** Chord types offered in the pickers, in a learning-friendly order. */
export const PICKER_TYPES = [
  'maj', 'min', '7', 'maj7', 'm7', 'sus2', 'sus4', '5', 'dim', 'aug', '6', 'm6',
  'add9', 'madd9', '9', 'maj9', 'm9', 'm7b5', 'dim7', '7sus4', '7#9', '13',
];

export function rootSelect(selected = 0): HTMLSelectElement {
  const select = h('select', { 'aria-label': 'Root note' });
  for (let pc = 0; pc < 12; pc++) {
    select.append(h('option', { value: pc, selected: pc === selected }, rootName(pc)));
  }
  return select;
}

export function typeSelect(selected = 'maj'): HTMLSelectElement {
  const select = h('select', { 'aria-label': 'Chord type' });
  for (const id of PICKER_TYPES) {
    const tpl = TEMPLATE_BY_ID[id];
    const label = `${tpl.suffix || 'maj'} (${tpl.name})`;
    select.append(h('option', { value: id, selected: id === selected }, label));
  }
  return select;
}

/** Clicks only sound when nothing is playing (the progression or the Inspector's chord); otherwise they're silent. */
export const clicksSound = () => currentPlayback() === null;

/** Strum a shape on click (silent while something is playing). */
export function playFingering(fingering: Fingering) {
  if (!clicksSound()) return;
  const notes = soundingNotes(fingering);
  strum(notes.map((n) => n.midi), { strings: notes.map((n) => n.string) });
}

export function playChord(chord: Chord) {
  const fingering = bestVoicing(chord);
  if (fingering) playFingering(fingering);
}

/**
 * Select a chord (from any chord name, the look-up, or one of the Inspector's other shapes):
 * it goes in the header box and onto the Inspector's fretboard, and you hear it.
 * Uses the app's usual shape for it unless a fingering is given.
 */
export function selectChord(chord: Chord, given?: Fingering | null, play = true, card: number | null = null) {
  const fingering = given === undefined ? bestVoicing(chord) : given;
  shapePicked = given !== undefined;
  noteCause('select');
  phrase = null;
  update({ selected: { root: chord.root, template: chord.template, bass: chord.bass }, selectedCard: card, ...(fingering ? { fingering } : {}) });
  if (fingering && play) playFingering(fingering);
}

/** Change the Inspector's fingering by hand; the selection becomes whatever chord the shape makes. */
export function setFingering(fingering: Fingering) {
  shapePicked = true;
  const found = analyzeFingering(fingering).matches[0];
  noteCause('hand');
  update({ fingering, selectedCard: null, selected: found ? { root: found.root, template: found.template, bass: found.bass } : null });
}

let justAdded = false;
/** Whether the Inspector's shape was picked (a shape, a card, frets typed or placed), not just the chord's usual one. */
let shapePicked = false;

/**
 * Add the Inspector's chord (the + card and A): with the exact frets on the fretboard when a shape
 * was picked; otherwise in the shape that moves least from the last card.
 */
export function addSelection() {
  const chords = selectedPhrase();
  if (chords) addToProgression(...chords);
  else if (state.selected) {
    const last = afterChord(state.progression);
    const fingering = shapePicked ? state.fingering : smoothShape(state.selected, last && cardShape(last)) ?? state.fingering;
    addToProgression({ ...state.selected, fingering });
  }
}

// A phrase picked on Relationships (an idea and the chords that follow it), for the add card. It
// lapses when the progression or the key changes (so also once it's added).
let phrase: { chords: Chord[]; progression: AppState['progression']; keyChoice: string | null } | null = null;

/** The selected phrase, or null (a single chord, or none, is selected). */
export function selectedPhrase(): Chord[] | null {
  if (phrase && (phrase.progression !== state.progression || phrase.keyChoice !== state.keyChoice)) phrase = null;
  return phrase?.chords ?? null;
}

/**
 * Pick a phrase: hear the last chord (as fingered), then each chord of the phrase (usual shapes),
 * and select the whole phrase for the add card. `source` marks the line it was picked from.
 */
export function selectPhrase(chords: ProgressionChord[], source: string, sound: (shapes: Fingering[]) => void = playInTurn) {
  const last = afterChord(state.progression);
  const from = last && cardShape(last);
  selectedFrom = source;
  selectChord(chords[0], cardShape(chords[0]), false);
  phrase = { chords, progression: state.progression, keyChoice: state.keyChoice };
  update({});
  const shapes = [from, ...chords.map((c) => cardShape(c))].filter((f) => !!f) as Fingering[];
  sound(shapes);
}

/** Shapes strummed one after another, 0.7s apart (how a phrase is previewed). */
export const PHRASE_GAP = 0.7;
function playInTurn(shapes: Fingering[]) {
  shapes.forEach((f, i) => (i ? playFingeringAt(f, PHRASE_GAP * i) : playFingering(f)));
}

/** Add chords at the end of the progression; the last one added becomes the selected card. */
export function addToProgression(...chords: ProgressionChord[]) {
  let { progression: list, selectedCard: card } = state;
  // A card keeps the chord and its shape; an engine's spelling and numeral belong to where it was suggested.
  for (const { spelling: _s, numeral: _n, ...chord } of chords) ({ list, card } = append(list, chord));
  justAdded = true;
  update({ progression: list, selectedCard: card });
}

/** Double-click a card: a copy goes right after it, and is selected. */
export function duplicateCard(index: number) {
  if (!state.progression[index]) return;
  const { list, card } = duplicateAt(state.progression, index);
  justAdded = true;
  update({ progression: list, selectedCard: card });
  remapSteps(PROGRESSION_ID, (i) => (i > index ? i + 1 : i), list.length);
}

/** Move a card (drag, or Alt+arrow); the selection follows its card. Same place: no change. */
export function moveProgressionCard(from: number, to: number) {
  const { list, card } = moveCard(state.progression, state.selectedCard, from, to);
  if (list === state.progression) return;
  update({ progression: list, selectedCard: card });
  remapSteps(PROGRESSION_ID, (i) => moveIndex(i, from, to), list.length);
}

/** Whether the last change was an add (so the new card can pulse); reading it clears it. */
export function takeJustAdded(): boolean {
  const was = justAdded;
  justAdded = false;
  return was;
}

// Which chip or box the selection was clicked from, so only that one gets the accent ring.
let selectedFrom: string | null = null;

/** Where the selected chord was last picked from (a chip's source id), or null. */
export const selectionSource = () => selectedFrom;

/** Whether this chip (identified by `source`) is the one the selected chord was clicked from. */
export function isSelected(chord: Chord, source: string): boolean {
  const sel = state.selected;
  return selectedFrom === source && !!sel && sel.root === chord.root && sel.template.id === chord.template.id && sel.bass === chord.bass;
}

/**
 * Click handler for anything showing a chord: a click selects (and strums) it, a double-click
 * adds it at the end of the progression. The first click of a double has already selected it, so the
 * second only adds.
 */
export function onChordClick(chord: Chord, select: () => void = () => selectChord(chord), source: string | null = null) {
  return (e: Event) => {
    const action = chordClickAction((e as MouseEvent).detail || 1);
    if (action === 'select') {
      selectedFrom = source;
      select();
    } else if (action === 'add') addToProgression(chord);
  };
}

/** Inspector click handler: a click does `select`; a double-click adds the chord with exactly this shape. */
export function onShapeClick(chord: Chord, fingering: Fingering, select: () => void) {
  return (e: Event) => {
    const action = chordClickAction((e as MouseEvent).detail || 1);
    if (action === 'select') select();
    else if (action === 'add') addToProgression({ ...chord, fingering });
  };
}

/** Select a progression card: it shows on the Inspector (with the card's shape) and is heard. Not an undo step. */
export function selectCard(index: number) {
  const chord = state.progression[index];
  if (chord) selectChord(chord, cardShape(chord) ?? undefined, true, index);
}

export function removeFromProgression(index: number) {
  const { list, card } = removeAt(state.progression, state.selectedCard, index);
  update({ progression: list, selectedCard: card });
  remapSteps(PROGRESSION_ID, (i) => (i === index ? null : i > index ? i - 1 : i), list.length);
}

export function clearProgression() {
  if (isDragging()) return;
  update({ progression: [], selectedCard: null, keyChoice: null });
  remapSteps(PROGRESSION_ID, () => null, 0);
}

/**
 * Hear a candidate next chord: the progression's last chord, then the candidate. Selects the
 * candidate but leaves the progression and the After list alone.
 */
export function previewChange(chord: Chord) {
  const last = afterChord(state.progression);
  const from = last && cardShape(last);
  const to = bestVoicing(chord);
  selectChord(chord, to, !from);
  if (from && to) {
    playFingering(from);
    playFingeringAt(to, 0.7);
  }
}

function playFingeringAt(fingering: Fingering, delaySeconds: number) {
  if (!clicksSound()) return;
  const notes = soundingNotes(fingering);
  strum(notes.map((n) => n.midi), { strings: notes.map((n) => n.string), at: now() + delaySeconds });
}

/** The one chord chip used wherever a chord name appears: click to select and hear it, double-click to add it. */
export function chordChip(chord: Chord, symbol = chordSymbol(chord), source = `chip:${symbol}`): HTMLElement {
  return h('button', {
    class: `chord-chip${isSelected(chord, source) ? ' selected' : ''}`,
    title: `${symbol}: click to hear, double-click to add`,
    onclick: onChordClick(chord, undefined, source),
  }, symbol);
}

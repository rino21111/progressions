// Chord detector page: build a fingering, get the chord name and shape.

import {
  Chord,
  chordSymbol,
  preferredRootName,
  spellChordNote,
  toneLabelFor,
} from '../theory/chords';
import { Fingering, FingeringAnalysis, MAX_FRET, analyzeFingering, formatFingering } from '../theory/fingering';
import { mod12, sharpName } from '../theory/notes';
import { chordTonePositions, findVoicings, fingeringToneLabels } from '../theory/voicings';
import { state, subscribe, update } from '../state';
import { chordBox } from './chordBox';
import { addSelection, onShapeClick, playFingering, selectChord, setFingering } from './common';
import { currentPlayback, onNote, onPlayback, play, stop } from '../player';
import { INSPECTOR_ID, chordFingerings } from '../playback';
import { playIcon, stopIcon } from './icons';
import { checkbox, disclosure, menuItem, popover } from './menu';
import { add, clear, h, toneClass } from './dom';
import { Fretboard, KeyDot, Mark } from './fretboard';
import { currentKey } from '../key';
import { keyScale, pitchInKey } from '../theory/keys';
import { STANDARD_TUNING } from '../theory/notes';
import { toneArea } from './toneStrip';
import { parseSearch } from '../theory/search';
import { searchIcon } from './icons';

const BASS_INTERVALS = ['R', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'];

/** Label for a played note: its role in the chord, or its distance from the bass if unnamed. */
function labelFor(analysis: FingeringAnalysis, pc: number): string {
  const chord = analysis.matches[0];
  if (chord) return toneLabelFor(chord, pc) ?? '?';
  if (!analysis.bass) return '';
  return BASS_INTERVALS[mod12(pc - analysis.bass.pc)];
}

function noteNameFor(analysis: FingeringAnalysis, pc: number): string {
  const chord = analysis.matches[0];
  return chord ? spellChordNote(chord, pc) : sharpName(pc);
}

/** Name the shape as the chord it was picked as when that's one of its names (e.g. C6, not Am7/C). */
function withPreferredFirst(analysis: FingeringAnalysis, preferred: Chord | null): FingeringAnalysis {
  const sel = preferred;
  const i = sel ? analysis.matches.findIndex((m) => m.root === sel.root && m.template.id === sel.template.id) : -1;
  if (i <= 0) return analysis;
  return { ...analysis, matches: [analysis.matches[i], ...analysis.matches.filter((_, j) => j !== i)] };
}

let searchInput: HTMLInputElement | null = null;

/** Put the cursor in the Inspector's search field (the / shortcut). */
export function focusSearch() {
  searchInput?.focus();
  searchInput?.select();
}

/** The Inspector's Play: one bar of the fretboard's chord in the sidebar's style, or stop. */
export function toggleChordPlay() {
  if (currentPlayback()?.id === INSPECTOR_ID) stop();
  else play(INSPECTOR_ID, () => chordFingerings(state));
}

export function createDetector(): HTMLElement {
  // The Inspector always shows the selection; during playback the sidebar's card lights up instead.
  const fretboard = new Fretboard(setFingering);

  // One search field: a chord name loads its usual shape, a fingering is applied as typed.
  const input = h('input', {
    class: 'search-input',
    type: 'text',
    spellcheck: false,
    autocomplete: 'off',
    placeholder: 'Dm7 or x02210',
    title: 'Type a chord (Dm7) or a fingering (x02210). Shortcut: /',
    'aria-label': 'Search: a chord name or a fingering',
  });
  searchInput = input;
  const inputHint = h('span', { class: 'input-hint' });
  const applyInput = () => {
    const found = parseSearch(input.value);
    if (!found) {
      inputHint.textContent = `Type a chord like Dm7 or F#m7b5, or six frets low E first like x02210 (frets up to ${MAX_FRET}).`;
      input.classList.add('invalid');
      return;
    }
    input.classList.remove('invalid');
    inputHint.textContent = '';
    if (found.kind === 'chord') selectChord(found.chord);
    else setFingering(found.fingering);
    input.value = formatFingering(state.fingering);
  };
  input.addEventListener('change', applyInput);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') applyInput();
  });

  // How the fretboard is labelled and drawn, and the two quick resets: one click away, in View.
  const modeButtons = (['interval', 'note'] as const).map((mode) =>
    h('button', { class: 'seg', 'data-mode': mode, onclick: () => update({ labelMode: mode }) },
      mode === 'interval' ? 'Intervals' : 'Notes'),
  );
  const neck = checkbox('All chord tones', () => state.showNeck, (on) => update({ showNeck: on }));
  const keyNotes = checkbox('Key notes', () => state.keyNotes, (on) => update({ keyNotes: on }));
  let close = () => {};
  const view = popover(h('button', { class: 'text-btn view-btn' }, 'View'),
    h('div', { class: 'pop-row' }, h('span', {}, 'Labels'), h('div', { class: 'segmented small', role: 'group', 'aria-label': 'Labels' }, modeButtons)),
    h('div', { class: 'pop-row' }, neck.el),
    h('div', { class: 'pop-row' }, keyNotes.el),
    menuItem('Mute all strings', () => setFingering([null, null, null, null, null, null]), () => close()),
    menuItem('Open all strings', () => setFingering([0, 0, 0, 0, 0, 0]), () => close()),
  );
  close = view.close;

  const controls = h('div', { class: 'controls' },
    h('label', { class: 'search' }, searchIcon(), input),
    h('span', { class: 'spacer' }),
    view.el,
  );

  // Play for the chord on the fretboard, separate from the progression's. The shape is read as it
  // plays, so editing it is heard straight away.
  const playButton = h('button', { class: 'player-btn play-btn', onclick: toggleChordPlay });
  const chordControls = h('div', { class: 'chord-play' }, playButton);
  const refreshControls = () => {
    const playing = currentPlayback()?.id === INSPECTOR_ID;
    playButton.replaceChildren(playing ? stopIcon() : playIcon());
    playButton.title = playing ? 'Stop this chord' : 'Play this chord';
    playButton.setAttribute('aria-label', playButton.title);
  };
  onPlayback(refreshControls);
  onNote((strings, p) => p.id === INSPECTOR_ID && fretboard.pluck(strings));

  const nameCard = h('section', { class: 'card name-card' });
  const voicingsCard = h('section', { class: 'card voicings-card' });

  const page = h('div', { class: 'page detector' },
    controls,
    inputHint,
    h('div', { class: 'fretboard-wrap' }, fretboard.element),
    h('div', { class: 'results' }, nameCard, voicingsCard),
  );

  function render() {
    const shown = state.fingering;
    const analysis = withPreferredFirst(analyzeFingering(shown), state.selected);
    const chord = analysis.matches[0];
    if (document.activeElement !== input) {
      input.value = formatFingering(shown);
      input.classList.remove('invalid');
      inputHint.textContent = '';
    }
    modeButtons.forEach((b) => {
      b.classList.toggle('active', b.dataset.mode === state.labelMode);
      b.setAttribute('aria-pressed', String(b.dataset.mode === state.labelMode));
    });
    neck.sync();
    keyNotes.sync();
    // The key backdrop: the Next page's key (chosen or guessed), its notes as faint dots wherever no
    // chord dot sits, and chord tones outside it ringed.
    const { key } = currentKey();
    const outside = (pc: number) => state.keyNotes && !pitchInKey(pc, key);

    const text = (pc: number) => (state.labelMode === 'interval' ? labelFor(analysis, pc) : noteNameFor(analysis, pc));
    const marks: Mark[] = analysis.notes.map((n) => ({
      string: n.string,
      fret: n.fret,
      text: text(n.pc),
      cls: toneClass(labelFor(analysis, n.pc)),
      out: outside(n.pc),
    }));
    const ghosts: Mark[] = state.showNeck && chord
      ? chordTonePositions(chord, shown).map((p) => ({ string: p.string, fret: p.fret, text: text(p.pc), cls: toneClass(labelFor(analysis, p.pc)) }))
      : [];
    const taken = new Set([...marks, ...ghosts].map((m) => `${m.string}:${m.fret}`));
    const scale = keyScale(key);
    const keyDots: KeyDot[] = [];
    if (state.keyNotes) {
      for (let string = 0; string < 6; string++) {
        for (let fret = 1; fret <= MAX_FRET; fret++) {
          const pc = mod12(STANDARD_TUNING[string] + fret);
          if (scale.has(pc) && !taken.has(`${string}:${fret}`)) keyDots.push({ string, fret, tonic: pc === mod12(key.tonic) });
        }
      }
    }
    fretboard.render({ fingering: shown, marks, ghosts, keyDots });

    refreshControls();
    renderName(nameCard, analysis, shown, fretboard.element, chordControls, outside);
    renderVoicings(voicingsCard, analysis, shown);
  }

  subscribe(render);
  render();
  return page;
}

function renderName(card: HTMLElement, analysis: FingeringAnalysis, shown: Fingering, board: Element, controls: HTMLElement, outside: (pc: number) => boolean) {
  clear(card);
  const chord = analysis.matches[0];
  if (!analysis.notes.length) {
    add(card, h('h2', { class: 'chord-name muted' }, '—'));
    return;
  }
  if (!chord) {
    if (analysis.pitchClasses.length === 1) {
      add(card, h('h2', { class: 'chord-name' }, sharpName(analysis.pitchClasses[0])), h('p', {}, 'A single note (octaves count as the same note). Add another to make an interval or a chord.'));
    } else if (analysis.interval) {
      add(card,
        h('h2', { class: 'chord-name' }, analysis.interval.name),
        h('p', {}, `Two notes: ${sharpName(analysis.bass!.pc)} up to ${sharpName(analysis.pitchClasses.find((pc) => pc !== analysis.bass!.pc)!)}. Add a third note to make a chord.`),
      );
    } else {
      add(card,
        h('h2', { class: 'chord-name muted' }, '?'),
        h('p', {}, 'These notes don\'t form a standard chord. The labels show each note\'s distance from the bass note, so you can see what you\'ve built.'),
      );
    }
    return;
  }

  const alternates = analysis.matches.slice(1, 5);
  add(card,
    h('div', { class: 'name-row' },
      h('h2', { class: 'chord-name' },
        h('button', {
          class: 'chord-name-btn', title: 'Click to hear, double-click to add',
          onclick: onShapeClick(chord, shown, () => playFingering(shown)),
        }, chordSymbol(chord)),
        // While the progression panel is hidden its add card can't be seen, so the chord offers its own +.
        h('button', {
          class: 'chord-add', title: `Add ${chordSymbol(chord)} to progression (A)`,
          'aria-label': `Add ${chordSymbol(chord)} to progression (A)`, onclick: addSelection,
        }, '+')),
      controls),
    h('p', { class: 'chord-long' }, `(${preferredRootName(chord.root, chord.template.family)} ${chord.template.name})`),
    toneArea(chord, shown, () => board, outside),
    alternates.length
      ? h('p', { class: 'small' }, 'Alternate names: ',
          alternates.map((m, i) => [i ? ', ' : '', h('strong', {}, chordSymbol(m))]))
      : null,
  );
}

function renderVoicings(card: HTMLElement, analysis: FingeringAnalysis, shown: Fingering) {
  clear(card);
  const chord = analysis.matches[0];
  if (!chord) {
    card.hidden = true;
    return;
  }
  const current = formatFingering(shown);
  // The tile matching the fretboard's shape (if it's among them) gets an accent border.
  const voicings = findVoicings(chord, 6);
  card.hidden = !voicings.length;
  add(card, disclosure('guitar-theory-other-shapes', `Other shapes (${voicings.length})`,
    h('div', { class: 'voicing-list' },
      voicings.map((v) => {
        const labels = fingeringToneLabels(chord, v.fingering).map((label) =>
          label === null ? null : { text: label, cls: toneClass(label || undefined) });
        return h('button', {
          class: `voicing${formatFingering(v.fingering) === current ? ' current' : ''}`,
          title: 'Click to put this shape on the fretboard, double-click to add',
          onclick: onShapeClick(chord, v.fingering, () => selectChord(chord, v.fingering)),
        },
          chordBox(v.fingering, labels),
          // Long fingerings (10-12-12-10-10-10) get smaller text to fit the tile.
          h('span', { class: `fingering-text${formatFingering(v.fingering).length > 6 ? ' long' : ''}` }, formatFingering(v.fingering)),
          h('span', { class: 'small muted' }, v.position ? `fret ${v.position}` : 'open'),
        );
      }),
    ),
  ));
}

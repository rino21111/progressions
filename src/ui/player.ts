// The player's controls. Play sits at the top of the Progression panel (or in the phone dock); how to
// play, tempo and the rest apply to every Play, so they sit behind the header's settings button.

import { PlayOptions, currentPlayback, onPlayback, play, stop } from '../player';
import type { Tone } from '../audio';
import { state, subscribe, update } from '../state';
import { Fingering } from '../theory/fingering';
import { PLAY_STYLES, PlayStyle } from '../theory/patterns';
import { MAX_BPM, MIN_BPM, clampBpm } from '../theory/timing';
import { h } from './dom';
import { playIcon, settingsIcon, stopIcon } from './icons';
import { checkbox, popover } from './menu';

/** Something the player can play: an id (for highlighting) and the chords, read live. */
export interface PlayerTarget extends PlayOptions {
  id: string;
  chords: () => Fingering[];
}

const TONE_CHOICES: { id: Tone; label: string }[] = [
  { id: 'steel', label: 'Steel' },
  { id: 'nylon', label: 'Nylon' },
  { id: 'electric', label: 'Electric' },
];

export function createPlayer(target: () => PlayerTarget): { el: HTMLElement; settings: HTMLElement; refresh: () => void; toggle: () => void } {
  // One picker for how to play, grouped by style ("Strum · Folk"). Each style remembers its own variant.
  const comboSelect = h('select', {
    class: 'variant-combo',
    'aria-label': 'How to play',
    onchange: () => {
      const [style, variant] = comboSelect.value.split(':') as [PlayStyle, string];
      update({ playPattern: style, playVariants: { ...state.playVariants, [style]: variant } });
    },
  }, PLAY_STYLES.map((st) =>
    h('optgroup', { label: st.label }, st.variants.map((v) => h('option', { value: `${st.id}:${v.id}` }, `${st.short ?? st.label} · ${v.label}`))),
  ));

  const setBpm = (value: number) => update({ bpm: clampBpm(value) });
  const bpmInput = h('input', {
    type: 'number', min: MIN_BPM, max: MAX_BPM, step: 1, inputmode: 'numeric',
    'aria-label': 'Tempo in beats per minute',
    onchange: () => {
      // Change fires once the value is committed, so it's safe to show the clamped tempo straight away.
      setBpm(Number(bpmInput.value));
      bpmInput.value = String(state.bpm);
    },
    onkeydown: (e: Event) => {
      if ((e as KeyboardEvent).key === 'Enter') (e.target as HTMLInputElement).blur();
    },
  });
  const tempo = h('label', { class: 'tempo', title: `Tempo (${MIN_BPM}–${MAX_BPM} bpm)` },
    bpmInput,
    h('span', { class: 'unit' }, 'bpm'),
  );

  const toggle = () => {
    if (currentPlayback()?.id === target().id) stop();
    else {
      const t = target();
      play(t.id, t.chords, t);
    }
  };
  const playButton = h('button', { class: 'primary player-btn play-btn', onclick: toggle });

  const barsButtons = [1, 2].map((n) =>
    h('button', { class: 'seg', onclick: () => update({ barsPerChord: n }) }, String(n)),
  );
  const barsRow = h('div', { class: 'pop-row' },
    h('span', {}, 'Bars per chord'), h('div', { class: 'segmented small' }, barsButtons));
  const meterButtons = ([4, 3] as const).map((n) =>
    h('button', { class: 'seg', onclick: () => update({ beatsPerBar: n }) }, `${n}/4`),
  );
  const toneButtons = TONE_CHOICES.map((t) =>
    h('button', { class: 'seg', onclick: () => update({ tone: t.id }) }, t.label),
  );
  const swing = checkbox('Swing', () => state.swing, (on) => update({ swing: on }));
  const settingsButton = h('button', {
    class: 'player-btn toggle-btn settings-btn', title: 'Settings', 'aria-label': 'Settings',
  }, settingsIcon());
  const settings = popover(settingsButton,
    h('div', { class: 'pop-row' }, comboSelect),
    h('div', { class: 'pop-row' }, h('span', {}, 'Tempo'), tempo),
    h('div', { class: 'pop-row' }, h('span', {}, 'Time'), h('div', { class: 'segmented small' }, meterButtons)),
    barsRow,
    h('div', { class: 'pop-row' }, h('span', {}, 'Tone'), h('div', { class: 'segmented small' }, toneButtons)),
    h('div', { class: 'pop-row' }, swing.el),
  ).el;
  settings.classList.add('player-settings');

  const press = (b: HTMLElement, on: boolean) => {
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', String(on));
  };
  const refresh = () => {
    comboSelect.value = `${state.playPattern}:${state.playVariants[state.playPattern]}`;
    barsButtons.forEach((b, i) => press(b, i + 1 === state.barsPerChord));
    meterButtons.forEach((b, i) => press(b, [4, 3][i] === state.beatsPerBar));
    toneButtons.forEach((b, i) => press(b, TONE_CHOICES[i].id === state.tone));
    if (document.activeElement !== bpmInput) bpmInput.value = String(state.bpm);
    swing.sync();
    const t = target();
    barsRow.hidden = !t.perChord;
    const playing = currentPlayback()?.id === t.id;
    playButton.replaceChildren(playing ? stopIcon() : playIcon());
    playButton.title = playing ? 'Stop (Space)' : 'Play (Space)';
    playButton.setAttribute('aria-label', playButton.title);
    playButton.disabled = !playing && t.chords().length === 0;
  };

  subscribe(refresh);
  onPlayback(refresh);
  refresh();
  return { el: playButton, settings, refresh, toggle };
}

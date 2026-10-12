// Relationships page: the key's chords by function, what could come after the progression's last
// chord (how each voice moves, how the function changes, what the move is called, and the chords that
// often follow it), and, when there's nothing yet, progressions to start with, each drawn as a small
// Shared notes map.

import { Chord, makeChord } from '../theory/chords';
import { ALL_KEYS, Key, chordFitInKey, chordSymbolInKey, diatonicChords, keyId, keyName, rankKeys, romanNumeral } from '../theory/keys';
import { sameFunction } from '../theory/progressions';
import { AfterIdea, StartItem, afterIdeas, collapseRepeats, ideaFor, ideaReason, starts, thenPhrase } from '../theory/ideas';
import { laneInfo } from '../theory/progressionMap';
import { AddMode, state, subscribe, update } from '../state';
import { currentKey, currentKeyGuess } from '../key';
import { Playback, currentPlayback, onPlayback, play } from '../player';
import { PROGRESSION_ID } from '../playback';
import { bestVoicing } from '../theory/voicings';
import { chordClickAction } from '../interaction';
import { afterChord } from '../yourChords';
import { addToProgression, isSelected, onChordClick, previewChange, selectChord, selectPhrase, selectedPhrase, selectionSource } from './common';
import { add, clear, h } from './dom';
import { playIcon } from './icons';
import { ExampleMap, exampleMap, voiceExtent, voicePicture, voiceSummary } from './relationshipViz';

const ADD_MODES: { id: AddMode; label: string }[] = [
  { id: 'suggested', label: 'Natural' },
  { id: 'spice', label: 'Spicy' },
];
const LANE_WORDS = { D: 'Dominant', PD: 'Predominant', T: 'Tonic' } as const;
const same = (a: Chord, b: Chord) => a.root === b.root && a.template.id === b.template.id && a.bass === b.bass;

/** The tab's one chord chip: symbol over numeral (amber when outside the key). */
function chip(chord: Chord, key: Key, extra = ''): HTMLElement {
  const out = chordFitInKey(chord, key) === 'outside';
  return h('span', { class: `rchip ${extra}` },
    h('span', { class: `sym${chordSymbolInKey(chord, key).length > 4 ? ' long' : ''}` }, chordSymbolInKey(chord, key)),
    h('span', { class: `num${out ? ' out' : ''}` }, romanNumeral(chord, key)));
}

export function createProgressions(): HTMLElement {
  const keyCard = h('section', { class: 'card key-band' });
  const afterCard = h('section', { class: 'card after-card' });
  const startCard = h('section', { class: 'card examples start-with' });
  const page = h('div', { class: 'page progressions' }, keyCard, afterCard, startCard);

  const playingChord = (): Chord | null => {
    const p = currentPlayback();
    return p?.id === PROGRESSION_ID && p.step !== null ? state.progression[p.step] ?? null : null;
  };

  // ---- Key band: each chord of the key in its lane (as it would act going home).
  let bandColumns: { chord: Chord; cells: HTMLElement[] }[] = [];
  const renderKey = (key: Key, guessed: boolean) => {
    clear(keyCard);
    const n = state.progression.length;
    const ranked = n ? rankKeys(state.progression).slice(0, 4) : [];
    const likely = new Set(ranked.map((r) => keyId(r.key)));
    const option = (k: Key, label = keyName(k)) => h('option', { value: keyId(k), selected: !guessed && keyId(k) === keyId(key) }, label);
    const picker = h('select', {
      'aria-label': 'Key',
      onchange: (e: Event) => update({ keyChoice: (e.target as HTMLSelectElement).value || null }),
    },
      h('option', { value: '', selected: guessed }, `Best guess: ${keyName(guessed ? key : currentKeyGuess())}`),
      ranked.length ? h('optgroup', { label: 'Likely' }, ranked.map((r) => option(r.key, `${keyName(r.key)} (${r.fitCount}/${n} fit)`))) : null,
      h('optgroup', { label: 'All keys' }, ALL_KEYS.filter((k) => !likely.has(keyId(k))).map((k) => option(k))),
    );
    const home = makeChord(key.tonic, key.mode === 'major' ? 'maj' : 'min');
    const chords = diatonicChords(key, state.sevenths);
    const playing = playingChord();
    bandColumns = chords.map((d) => {
      const lane = laneInfo(d.chord, key, home);
      const source = `key:${chordSymbolInKey(d.chord, key)}`;
      const yours = state.progression.some((c) => sameFunction(c, d.chord));
      const cls = `kb-col${yours ? ' yours' : ''}${d.borrowed ? ' borrowed' : ''}${playing && sameFunction(playing, d.chord) ? ' playing' : ''}`;
      const button = h('button', {
        class: `kb-chip${isSelected(d.chord, source) ? ' selected' : ''}`,
        title: `${chordSymbolInKey(d.chord, key)}, ${LANE_WORDS[lane.lane as 'T'].toLowerCase()}: click to hear, double-click to add`,
        onclick: onChordClick(d.chord, () => selectChord(d.chord), source),
      }, chip(d.chord, key, d.borrowed ? 'harmonic' : ''));
      const strip = h('div', { class: `kb-strip ${cls}` }, h('span', { class: `kb-node lane-${lane.lane}` }));
      return { chord: d.chord, cells: [h('div', { class: `kb-top ${cls}` }, button), strip] };
    });
    const gutter = h('div', { class: 'kb-gutter' }, (['D', 'PD', 'T'] as const).map((l) =>
      h('span', { class: `kb-lane lane-${l}` }, h('span', { class: 'word' }, LANE_WORDS[l]), h('span', { class: 'abbr' }, l))));
    add(keyCard,
      h('div', { class: 'card-head' }, h('h2', {}, 'Key'), picker,
        h('div', { class: 'segmented small' },
          h('button', { class: `seg ${state.sevenths ? '' : 'active'}`, onclick: () => update({ sevenths: false }) }, 'Triads'),
          h('button', { class: `seg ${state.sevenths ? 'active' : ''}`, onclick: () => update({ sevenths: true }) }, '7th chords'),
        ),
      ),
      h('div', { class: 'kb-grid', style: `--cols: ${chords.length}` },
        h('div', { class: 'kb-corner' }), bandColumns.map((c) => c.cells[0]),
        gutter, bandColumns.map((c) => c.cells[1]),
      ),
    );
  };

  // ---- After: what could follow the last chord, each idea with the chords that often follow it.
  const renderAfter = (key: Key) => {
    clear(afterCard);
    const x = afterChord(state.progression);
    afterCard.hidden = !x;
    if (!x) return;
    const tab: AddMode = state.addMode === 'spice' ? 'spice' : 'suggested';
    const ideas: AfterIdea[] = afterIdeas(state.progression, key, { spice: tab === 'spice', sevenths: state.sevenths });
    const first = state.progression[0];
    // A chord picked in the key band that isn't an idea joins as a fifth row, to compare (no then line).
    const sel = state.selected;
    if (sel && state.selectedCard === null && !selectedPhrase() && !ideas.some((i) => same(i.chord, sel))
      && diatonicChords(key, state.sevenths).some((d) => same(d.chord, sel) && isSelected(d.chord, `key:${chordSymbolInKey(d.chord, key)}`))) {
      ideas.push(ideaFor(x, sel, key, first));
    }
    const xName = chordSymbolInKey(x, key);
    // One vertical scale for the card, so the first chord's dots line up in every row.
    const extents = ideas.map((i) => voiceExtent(x, i.chord));
    const scale = { below: Math.max(...extents.map((e) => e.below)), top: Math.max(...extents.map((e) => e.top)) };
    add(afterCard,
      h('div', { class: 'card-head' },
        h('h2', {}, `After ${xName}`),
        h('div', { class: 'segmented small', role: 'group', 'aria-label': 'Chord ideas' },
          ADD_MODES.map((m) => h('button', {
            class: `seg ${tab === m.id ? 'active' : ''}`, 'aria-pressed': String(tab === m.id),
            onclick: () => update({ addMode: m.id }),
          }, m.label)),
        ),
      ),
      ideas.length ? null : h('p', { class: 'muted idea-none' }, 'Nothing fits here'),
      h('div', { class: 'idea-grid' }, ideas.map((idea, i) => {
        const c = idea.chord;
        const sym = chordSymbolInKey(c, key);
        const source = `after:${sym}`;
        const click = onChordClick(c, () => previewChange(c), source);
        const why = ideaReason(idea);
        const row = h('div', {
          class: `idea-row${isSelected(c, source) && !selectedPhrase() ? ' selected' : ''}${state.progression.some((p) => sameFunction(p, c)) ? ' yours' : ''}`,
          role: 'button', tabindex: 0,
          title: `${xName} to ${sym} (${idea.numeral}): ${why}. Click to hear it, double-click to add`,
          'aria-label': `${xName} to ${sym} (${idea.numeral}): ${why}. ${voiceSummary(x, c, key)}`,
          onclick: click,
          onkeydown: (e: Event) => {
            if ((e as KeyboardEvent).key === 'Enter') click(new MouseEvent('click', { detail: 1 }));
          },
        },
          chip(c, key),
          voicePicture(x, c, key, i === 0, scale),
        );
        return h('div', { class: 'idea-item' }, row, idea.then ? thenLine(x, idea, key) : null);
      })),
    );
  };

  /** "then Dm G C · ii–V–I · Jazz · smooth": the chords that often follow an idea, picked and added as one phrase. */
  const thenLine = (x: Chord, idea: AfterIdea, key: Key) => {
    const then = idea.then!;
    const chords = thenPhrase(idea);
    const names = [idea.chord, ...then.chords].map((c) => chordSymbolInKey(c, key));
    const source = `then:${names.join(' ')}`;
    const selected = selectionSource() === source && !!selectedPhrase();
    const label = `${then.name}: ${chordSymbolInKey(x, key)}, ${names[0]}, then ${names.slice(1).join(' ')}`;
    const home = then.returnsHome ? then.chords.length - 1 : -1;
    const click = (e: Event) => {
      const action = chordClickAction((e as MouseEvent).detail || 1);
      if (action === 'select') selectPhrase(chords, source);
      else if (action === 'add') addToProgression(...chords);
    };
    return h('div', {
      class: `then-line${selected ? ' selected' : ''}`, role: 'button', tabindex: 0,
      title: `${label}. Click to preview, double-click to add all`, 'aria-label': label,
      onclick: click,
      onkeydown: (e: Event) => {
        if ((e as KeyboardEvent).key === 'Enter') click(new MouseEvent('click', { detail: 1 }));
      },
    },
      h('span', { class: 'then-word' }, 'then'),
      h('span', { class: 'then-chips' }, then.chords.map((c, i) => i === home
        ? Object.assign(chip(c, key, 'mini home'), { title: `Back to ${chordSymbolInKey(c, key)}` })
        : chip(c, key, 'mini'))),
      h('span', { class: 'then-text' },
        h('span', { class: 'then-name' }, then.name),
        h('span', { class: 'then-meta' }, `${then.genre} · ${then.mood}`)),
    );
  };

  // ---- Start with (only when the progression is empty), drawn once per key and chord style.
  type StartCard = { item: StartItem; chords: Chord[]; card: HTMLElement; map: ExampleMap; id: string };
  const startCache = new Map<string, { el: HTMLElement; cards: StartCard[] }>();
  let shown: StartCard[] = [];
  const buildStarts = (key: Key) => {
    const cards: StartCard[] = [];
    const el = h('div', { class: 'example-groups' }, starts(key).map((group) =>
      h('div', { class: 'ex-group' },
        h('h3', {}, group.name),
        h('div', { class: 'ex-row' }, group.items.map((item) => {
          const k = item.key;
          const chords = item.chords;
          const cols = collapseRepeats(chords, same);
          const id = `start:${item.id}`;
          const wide = cols.length >= 5;
          const map = exampleMap(cols, chords, item.lanes, k, wide ? 470 : 230, (i) => onChordClick(cols[i].chord, undefined, `${id}:${i}`));
          const card = h('article', { class: `ex-card${wide ? ' wide' : ''}` },
            h('div', { class: 'ex-head' },
              h('h4', { title: item.note }, item.name),
              h('div', { class: 'row' },
                h('button', {
                  class: 'icon', title: 'Play this progression', 'aria-label': `Play ${item.name}`,
                  onclick: () => play(id, () => chords.map((c) => bestVoicing(c)).filter((f) => f !== null), { perChord: true }),
                }, playIcon()),
                h('button', { class: 'icon', title: 'Add these chords to the progression', 'aria-label': `Add ${item.name} to the progression`, onclick: () => addToProgression(...chords) }, '+'),
              ),
            ),
            map.svg,
            h('p', { class: 'ex-genre' }, h('span', { class: 'genre' }, item.genre), h('span', { class: 'muted' }, ` · ${item.mood}`)),
          );
          cards.push({ item, chords, card, map, id });
          return card;
        })),
      ),
    ));
    return { el, cards };
  };

  const renderStarts = (key: Key) => {
    startCard.hidden = state.progression.length > 0;
    if (startCard.hidden) {
      shown = [];
      return;
    }
    const cacheKey = `${keyId(key)}|${state.sevenths}`;
    let entry = startCache.get(cacheKey);
    if (!entry) {
      entry = buildStarts(key);
      startCache.set(cacheKey, entry);
    }
    shown = entry.cards;
    if (startCard.lastChild !== entry.el) {
      clear(startCard);
      add(startCard, h('div', { class: 'card-head' }, h('h2', {}, 'Start with')), entry.el);
    }
    showPlaying(currentPlayback());
  };

  const showPlaying = (p: Playback | null) => {
    for (const c of shown) {
      const col = p?.id === c.id && p.step !== null ? c.map.columnOfBar[p.step] : -1;
      c.map.columns.forEach((m, i) => {
        m.tint.classList.toggle('on', i === col);
        m.node?.classList.toggle('playing', i === col);
      });
    }
    const chordNow = playingChord();
    bandColumns.forEach((b) => b.cells.forEach((cell) => cell.classList.toggle('playing', !!chordNow && sameFunction(chordNow, b.chord))));
  };
  onPlayback(showPlaying);

  const render = () => {
    const { key, guessed } = currentKey();
    renderKey(key, guessed);
    renderAfter(key);
    renderStarts(key);
  };

  subscribe(render);
  render();
  return page;
}

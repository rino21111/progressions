// Relationships page: the key's chords on one line, what could come after the progression's last
// chord grouped by how the move feels (a chip opens its reason, the chords that often follow it and
// its adds), and, when there's nothing yet, progressions to start with, one family at a time.

import { Chord } from '../theory/chords';
import { ALL_KEYS, Key, chordFitInKey, chordSymbolInKey, keyId, keyName, rankKeys, romanNumeral } from '../theory/keys';
import { sameFunction } from '../theory/progressions';
import { AfterIdea, StartGroup, StartItem, StyleName, collapseRepeats, degreeOf, ideaReason, keyChords, nextByMood, starts, thenPhrase } from '../theory/ideas';
import { state, subscribe, update } from '../state';
import { currentKey, currentKeyGuess } from '../key';
import { Playback, currentPlayback, onPlayback, play } from '../player';
import { PROGRESSION_ID } from '../playback';
import { bestVoicing } from '../theory/voicings';
import { chordClickAction } from '../interaction';
import { afterChord } from '../yourChords';
import { addToProgression, isSelected, onChordClick, previewChange, selectChord, selectPhrase, selectedPhrase, selectionSource } from './common';
import { add, clear, h } from './dom';
import { playIcon } from './icons';
import { keep, recall } from './menu';
import { labelledBox } from './sidebar';

const STYLE_CHOICES: { id: StyleName; label: string }[] = [
  { id: 'triads', label: 'Triads' },
  { id: 'sevenths', label: '7ths' },
  { id: 'ninths', label: '9ths' },
  { id: 'add9', label: 'add9' },
];
const FAMILY_KEY = 'guitar-theory-start-family';
const same = (a: Chord, b: Chord) => a.root === b.root && a.template.id === b.template.id && a.bass === b.bass;

/** The tab's one chord chip: symbol over numeral (amber when outside the key). */
function chip(chord: Chord, key: Key, extra = '', numeral = romanNumeral(chord, key)): HTMLElement {
  const out = chordFitInKey(chord, key) === 'outside';
  return h('span', { class: `rchip ${extra}` },
    h('span', { class: `sym${chordSymbolInKey(chord, key).length > 4 ? ' long' : ''}` }, chordSymbolInKey(chord, key)),
    h('span', { class: `num${out ? ' out' : ''}` }, numeral));
}

export function createProgressions(): HTMLElement {
  const keyCard = h('section', { class: 'card key-band' });
  const afterCard = h('section', { class: 'card after-card' });
  const startCard = h('section', { class: 'card examples start-with' });
  const page = h('div', { class: 'page progressions' }, keyCard, afterCard, startCard);
  const phone = window.matchMedia('(max-width: 999px)');

  const playingChord = (): Chord | null => {
    const p = currentPlayback();
    return p?.id === PROGRESSION_ID && p.step !== null ? state.progression[p.step] ?? null : null;
  };

  // ---- Key: the key and style pickers, then the key's chords (yours marked).
  let keyButtons: { chord: Chord; el: HTMLElement }[] = [];
  let selects: HTMLElement;
  const keyLine = h('div', { class: 'key-line' });
  keyCard.append(keyLine);
  const renderKey = (key: Key, guessed: boolean) => {
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
    const style = h('select', {
      'aria-label': 'Chord style',
      onchange: (e: Event) => update({ style: (e.target as HTMLSelectElement).value as StyleName }),
    }, STYLE_CHOICES.map((c) => h('option', { value: c.id, selected: state.style === c.id }, c.label)));
    selects = h('div', { class: 'key-selects' }, picker, style);
    const playing = playingChord();
    keyButtons = keyChords(key, state.style).map((d) => {
      const source = `key:${chordSymbolInKey(d.chord, key)}`;
      const yours = state.progression.some((c) => sameFunction(c, d.chord));
      const el = h('button', {
        class: `kb-chip${isSelected(d.chord, source) ? ' selected' : ''}${yours ? ' yours' : ''}${playing && sameFunction(playing, d.chord) ? ' playing' : ''}`,
        title: `${chordSymbolInKey(d.chord, key)}: click to hear, double-click to add`,
        onclick: onChordClick(d.chord, () => selectChord(d.chord), source),
      }, chip(d.chord, key, d.borrowed ? 'harmonic' : ''));
      return { chord: d.chord, el };
    });
    keyLine.replaceChildren(selects, h('div', { class: 'kb-chips' }, keyButtons.map((b) => b.el)));
  };

  // ---- After: one row per feeling; the open chip's detail under its row.
  let open: { at: string; source: string } | null = null;
  let afterHead: HTMLElement | null = null;
  const renderAfter = (key: Key) => {
    clear(afterCard);
    afterHead = null;
    const x = afterChord(state.progression);
    afterCard.hidden = !x;
    if (!x) return;
    const at = state.progression.map((c) => chordSymbolInKey(c, key)).join(' ');
    const groups = nextByMood(state.progression, key, state.style);
    const xName = chordSymbolInKey(x, key);
    afterHead = h('div', { class: 'card-head' }, h('h2', {}, `After ${xName}`));
    add(afterCard, afterHead,
      groups.length ? null : h('p', { class: 'muted idea-none' }, 'Nothing fits here'),
      h('div', { class: 'mood-grid' }, groups.map((g) => {
        const shown = g.ideas.find((i) => open?.at === at && open.source === `after:${chordSymbolInKey(i.chord, key)}`);
        return [
          h('span', { class: 'mood' }, g.mood),
          h('div', { class: 'mood-chips' }, g.ideas.map((idea) => {
            const c = idea.chord;
            const sym = chordSymbolInKey(c, key);
            const source = `after:${sym}`;
            const click = onChordClick(c, () => previewChange(c), source);
            return h('button', {
              class: `idea-chip${isSelected(c, source) && !selectedPhrase() ? ' selected' : ''}${state.progression.some((p) => sameFunction(p, c)) ? ' yours' : ''}`,
              title: `${xName} to ${sym} (${idea.numeral}). Click to hear, double-click to add`,
              'aria-expanded': String(idea === shown),
              onclick: (e: Event) => {
                open = { at, source };
                click(e);
              },
            }, chip(c, key, '', degreeOf(idea.numeral)));
          })),
          shown ? detail(x, shown, key) : null,
        ];
      })),
    );
  };

  /** Under a mood row: the chord's shape, why it fits, the chords that often follow it, and its adds. */
  const detail = (x: Chord, idea: AfterIdea, key: Key) => {
    const c = idea.chord;
    const fingering = bestVoicing(c);
    const phrase = thenPhrase(idea);
    const names = (list: Chord[]) => list.map((p) => chordSymbolInKey(p, key)).join(' ');
    return h('div', { class: 'idea-detail' },
      fingering ? labelledBox(c, fingering) : null,
      h('div', { class: 'idea-body' },
        h('p', { class: 'muted idea-why' }, ideaReason(idea)),
        idea.then ? thenLine(x, idea, key) : null,
        h('div', { class: 'idea-adds' },
          h('button', { onclick: () => addToProgression(c) }, `+ ${names([c])}`),
          phrase.length > 1 ? h('button', { onclick: () => addToProgression(...phrase) }, `+ ${names(phrase)}`) : null,
        ),
      ),
    );
  };

  /** "then Dm G C  ii–V–I · Jazz": the chords that often follow an idea (click to hear them as one phrase). */
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
      title: `${label}. Click to hear, double-click to add`, 'aria-label': label,
      onclick: click,
      onkeydown: (e: Event) => {
        if ((e as KeyboardEvent).key === 'Enter') click(new MouseEvent('click', { detail: 1 }));
      },
    },
      h('span', { class: 'then-word' }, 'then'),
      h('span', { class: 'then-chips' }, then.chords.map((c, i) => i === home
        ? Object.assign(chip(c, key, 'mini home'), { title: `Back to ${chordSymbolInKey(c, key)}` })
        : chip(c, key, 'mini'))),
      h('span', { class: 'then-meta' }, `${then.name} · ${then.genre}`),
    );
  };

  // ---- Start with (only when the progression is empty): one family at a time, built once per key.
  type StartRow = { id: string; chips: HTMLElement[]; colOfBar: number[] };
  const startCache = new Map<string, { el: HTMLElement; rows: StartRow[] }>();
  let shown: StartRow[] = [];
  const buildStarts = (key: Key) => {
    const rows: StartRow[] = [];
    const row = (group: StartGroup, item: StartItem) => {
      const chords = item.chords;
      const cols = collapseRepeats(chords, same);
      const id = `start:${item.id}`;
      const chips = cols.map((col, i) => h('button', {
        class: 'start-chip', title: 'Click to hear, double-click to add',
        onclick: onChordClick(col.chord, undefined, `${id}:${i}`),
      }, chip(col.chord, item.key, 'mini'), col.count > 1 ? h('span', { class: 'start-count' }, `×${col.count}`) : null));
      rows.push({ id, chips, colOfBar: cols.flatMap((col, i) => Array.from({ length: col.count }, () => i)) });
      const named = group.name.toLowerCase().includes(item.genre.toLowerCase());
      return h('div', { class: 'start-row' },
        h('button', {
          class: 'icon', title: 'Play this progression', 'aria-label': `Play ${item.name}`,
          onclick: () => play(id, () => chords.map((c) => bestVoicing(c)).filter((f) => f !== null), { perChord: true }),
        }, playIcon()),
        h('span', { class: 'start-name', title: item.note }, item.name),
        h('span', { class: 'start-chips' }, chips),
        h('span', { class: 'start-mood muted' }, named ? item.mood : `${item.genre} · ${item.mood}`),
        h('button', {
          class: 'icon', title: 'Add these chords to the progression', 'aria-label': `Add ${item.name} to the progression`,
          onclick: () => {
            // Starting from nothing, the style follows the entry (a bossa start lands in 9ths).
            const empty = !state.progression.length;
            addToProgression(...chords);
            if (empty) update({ style: item.style });
          },
        }, '+'),
      );
    };
    const groups = starts(key).filter((g) => g.items.length + g.more.length);
    const lists = groups.map((g) => h('div', { class: 'start-list' }, [...g.items, ...g.more].map((item) => row(g, item))));
    const pills = groups.map((g, i) => h('button', { class: 'pill', onclick: () => pick(i) }, g.name));
    const pick = (i: number) => {
      keep(FAMILY_KEY, groups[i].name);
      lists.forEach((l, j) => (l.hidden = j !== i));
      pills.forEach((p, j) => {
        p.classList.toggle('active', j === i);
        p.setAttribute('aria-pressed', String(j === i));
      });
    };
    pick(Math.max(0, groups.findIndex((g) => g.name === recall(FAMILY_KEY))));
    return { el: h('div', {}, h('div', { class: 'family-pills', role: 'group', 'aria-label': 'Family' }, pills), lists), rows };
  };

  const renderStarts = (key: Key) => {
    startCard.hidden = state.progression.length > 0;
    if (startCard.hidden) {
      shown = [];
      return;
    }
    const cacheKey = keyId(key);
    let entry = startCache.get(cacheKey);
    if (!entry) {
      entry = buildStarts(key);
      startCache.set(cacheKey, entry);
    }
    shown = entry.rows;
    if (startCard.lastChild !== entry.el) {
      clear(startCard);
      add(startCard, h('div', { class: 'card-head' }, h('h2', {}, 'Start with')), entry.el);
    }
    showPlaying(currentPlayback());
  };

  const showPlaying = (p: Playback | null) => {
    for (const r of shown) {
      const col = p?.id === r.id && p.step !== null ? r.colOfBar[p.step] : -1;
      r.chips.forEach((c, i) => c.classList.toggle('playing', i === col));
    }
    const chordNow = playingChord();
    keyButtons.forEach((b) => b.el.classList.toggle('playing', !!chordNow && sameFunction(chordNow, b.chord)));
  };
  onPlayback(showPlaying);

  // On phones the key and style pickers sit at the right of the After heading.
  const placeSelects = () => {
    if (phone.matches && afterHead) afterHead.append(selects);
    else if (selects.parentElement !== keyLine) keyLine.prepend(selects);
  };

  const render = () => {
    const { key, guessed } = currentKey();
    renderKey(key, guessed);
    renderAfter(key);
    renderStarts(key);
    placeSelects();
  };

  subscribe(render);
  phone.addEventListener('change', placeSelects);
  window.addEventListener('resize', placeSelects);
  render();
  return page;
}

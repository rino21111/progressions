// One instrument: a dark stage with the neck (the chord on it, or the move into the idea being tried),
// a caption that names it, and the progression as a track; below, the desk with the chord on the neck
// and what could come next. The desk shows one view: the chord on the neck, the progression (what
// could come next), the shared-notes map, or the tab.

import { Chord, chordSymbol, chordTones, preferredRootName } from '../theory/chords';
import { Fingering, FingeringAnalysis, MAX_FRET, analyzeFingering, formatFingering } from '../theory/fingering';
import { STANDARD_TUNING, mod12, sharpName } from '../theory/notes';
import { ALL_KEYS, Key, chordFitInKey, chordSymbolInKey, keyId, keyName, keyScale, numeralLabel, pitchInKey, rankKeys, romanNumeral } from '../theory/keys';
import { sameFunction } from '../theory/progressions';
import { AfterIdea, StartGroup, StartItem, StyleName, collapseRepeats, ideaWhy, keyChords, nextByMood, startSettings, starts, thenPhrase } from '../theory/ideas';
import { chordCharacter, chordReason } from '../theory/character';
import { movesLine } from '../theory/change';
import { noteIn } from '../theory/change';
import { chordTonePositions, findVoicings, fingeringToneLabels } from '../theory/voicings';
import { smoothShape, withSmoothShapes } from '../theory/smooth';
import { parseSearch } from '../theory/search';
import { PLAY_STYLES, PlayStyle } from '../theory/patterns';
import { MAX_BPM, MIN_BPM, clampBpm } from '../theory/timing';
import { state, subscribe, update } from '../state';
import { currentKey, currentKeyGuess } from '../key';
import { currentPlayback, onNote, onPlayback, play } from '../player';
import { PROGRESSION_ID, cardShape } from '../playback';
import { chordClickAction } from '../interaction';
import { afterChord, placeIndex } from '../yourChords';
import {
  addSelection, addToProgression, clearProgression, duplicateCard, isSelected, moveProgressionCard, onChordClick, onShapeClick,
  removeFromProgression, selectCard, selectChord, selectPhrase, setFingering, takeJustAdded,
} from './common';
import { chordBox } from './chordBox';
import { enableReorder } from './dragReorder';
import { createProgressionMap } from './progressionMap';
import { add, clear, h, toneClass } from './dom';
import { chevronIcon, fretIcon, moreIcon, playIcon, searchIcon, undoIcon } from './icons';
import { checkbox, disclosure, keep, menuItem, popover, recall } from './menu';
import { chordNode, noteNode, numeralNode } from './music';
import { KeyDot, Label, Mark, Neck } from './neck';
import { toneArea } from './toneStrip';
import { canUndo, undo } from '../undo';

const STYLE_CHOICES: { id: StyleName; label: string }[] = [
  { id: 'triads', label: 'Triads' },
  { id: 'sevenths', label: '7ths' },
  { id: 'ninths', label: '9ths' },
  { id: 'add9', label: 'add9' },
];
const FAMILY_KEY = 'guitar-theory-start-family';
const BASS_INTERVALS = ['R', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'];
const same = (a: Chord | null | undefined, b: Chord | null | undefined) => !!a && !!b && a.root === b.root && a.template.id === b.template.id && a.bass === b.bass;
const sameShape = (a: Fingering | null | undefined, b: Fingering | null | undefined) => !!a && !!b && formatFingering(a) === formatFingering(b);
const pcAt = (str: number, fret: number) => mod12(STANDARD_TUNING[str] + fret);

export type Mode = 'chord' | 'progression' | 'notes' | 'tab';

export interface Instrument {
  stage: HTMLElement;
  desk: HTMLElement;
  focusSearch: () => void;
  setMode: (mode: Mode) => void;
}

/** The idea being tried: the chord on the neck is an idea after your place, in its smooth shape. */
interface Trying {
  idea: AfterIdea;
  mood: string;
  from: Fingering;
  to: Fingering;
}

export function createInstrument(opts: {
  play: HTMLElement;
  settings: HTMLElement;
  settingsPop: HTMLElement;
  tab: HTMLElement;
  onMode: (mode: Mode) => void;
}): Instrument {
  const phone = window.matchMedia('(max-width: 760px)');
  const neck = new Neck(setFingering);
  let mode: Mode = 'progression';

  // ---------------------------------------------------------------- bar
  const keySelect = h('select', { class: 'dd key', 'aria-label': 'Key', onchange: (e: Event) => update({ keyChoice: (e.target as HTMLSelectElement).value || null }) });
  const styleSelect = h('select', { class: 'dd style', 'aria-label': 'Chord style', onchange: (e: Event) => update({ style: (e.target as HTMLSelectElement).value as StyleName }) },
    STYLE_CHOICES.map((c) => h('option', { value: c.id }, c.label)));
  const keyChips = h('div', { class: 'kchips' });
  const input = h('input', {
    class: 'search-input', type: 'text', spellcheck: false, autocomplete: 'off', placeholder: 'Chord or fingering',
    'aria-label': 'Search a chord or a fingering (/)',
  });
  const hint = h('span', { class: 'input-hint' });
  const applySearch = () => {
    const found = parseSearch(input.value);
    if (!found) {
      hint.textContent = 'Try Dm7 or x02210';
      input.classList.add('invalid');
      return;
    }
    input.classList.remove('invalid');
    hint.textContent = '';
    if (found.kind === 'chord') selectChord(found.chord);
    else setFingering(found.fingering);
    input.value = '';
    input.blur();
    search.classList.remove('open');
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') applySearch();
    if (e.key === 'Escape') {
      input.value = '';
      input.blur();
    }
  });
  input.addEventListener('blur', () => {
    hint.textContent = '';
    input.classList.remove('invalid');
    if (!input.value) search.classList.remove('open');
  });
  const search = h('label', { class: 'search' },
    h('button', { class: 'search-icon', 'aria-label': 'Search', onclick: () => { search.classList.add('open'); input.focus(); } }, searchIcon(15)),
    input, hint);
  const undoButton = h('button', { class: 'icon-btn undo-btn', title: 'Undo (Cmd/Ctrl+Z)', 'aria-label': 'Undo', onclick: () => undo() }, undoIcon(17));
  // On phones the key button opens a menu with the key, the style and the key's chords.
  const keyMenuButton = h('button', { class: 'dd key key-menu-btn' });
  const keyMenuBody = h('div', { class: 'key-menu' });
  const keyMenu = popover(keyMenuButton, keyMenuBody);
  keyMenu.el.classList.add('key-pop');
  const keyWrap = h('span', { class: 'key-wrap' }, keySelect, chevronIcon(10));
  const styleWrap = h('span', { class: 'style-wrap' }, styleSelect, chevronIcon(10));
  const barSpacer = h('span', { class: 'spacer' });
  const bar = h('header', { class: 'bar' },
    h('span', { class: 'logo', role: 'img', 'aria-label': 'progressions', title: 'progressions' }, fretIcon(22)),
    keyMenu.el, keyWrap, styleWrap, keyChips, barSpacer, search, undoButton, opts.settings);

  // ---------------------------------------------------------------- caption and View
  const modeButtons = (['interval', 'note'] as const).map((m) =>
    h('button', { class: 'seg', 'data-mode': m, onclick: () => update({ labelMode: m }) }, m === 'interval' ? 'Intervals' : 'Notes'));
  const neckBox = checkbox('All chord tones', () => state.showNeck, (on) => update({ showNeck: on }));
  const keyNotes = checkbox('Key notes', () => state.keyNotes, (on) => update({ keyNotes: on }));
  let closeView = () => {};
  const viewRows = h('div', { class: 'view-rows' },
    h('div', { class: 'pop-row' }, h('span', {}, 'Labels'), h('div', { class: 'segmented small', role: 'group', 'aria-label': 'Labels' }, modeButtons)),
    h('div', { class: 'pop-row' }, neckBox.el),
    h('div', { class: 'pop-row' }, keyNotes.el),
    menuItem('Mute all strings', () => setFingering([null, null, null, null, null, null]), () => closeView()),
    menuItem('Open all strings', () => setFingering([0, 0, 0, 0, 0, 0]), () => closeView()),
  );
  const viewSlot = h('div', {});
  const view = popover(h('button', { class: 'dd view-btn' }, 'View', chevronIcon(10)), viewSlot);
  closeView = view.close;
  view.el.classList.add('view');
  const caption = h('div', { class: 'caption' });

  // ---------------------------------------------------------------- track
  const tiles = h('div', { class: 'tiles' });
  const bpm = h('input', {
    class: 'tempo-input', type: 'number', min: MIN_BPM, max: MAX_BPM, step: 1, inputmode: 'numeric', 'aria-label': 'Tempo in beats per minute',
    onchange: () => {
      update({ bpm: clampBpm(Number(bpm.value)) });
      bpm.value = String(state.bpm);
    },
    onkeydown: (e: Event) => (e as KeyboardEvent).key === 'Enter' && bpm.blur(),
  });
  const how = h('select', {
    class: 'dd how', 'aria-label': 'How to play',
    onchange: () => {
      const [st, variant] = how.value.split(':') as [PlayStyle, string];
      update({ playPattern: st, playVariants: { ...state.playVariants, [st]: variant } });
    },
  }, PLAY_STYLES.map((st) => h('optgroup', { label: st.label }, st.variants.map((v) => h('option', { value: `${st.id}:${v.id}` }, `${st.label} · ${v.label}`)))));
  const MODE_NAMES: Record<Mode, string> = { chord: 'Chord', progression: 'Progression', notes: 'Notes', tab: 'Tab' };
  const modeSeg = (['chord', 'progression', 'notes', 'tab'] as const).map((m) => h('button', { 'data-mode': m, onclick: () => setMode(m) }, MODE_NAMES[m]));
  const seg = h('div', { class: 'tseg', role: 'group', 'aria-label': 'Show the progression as' }, modeSeg);
  const loop = checkbox('Loop', () => state.loop, (on) => update({ loop: on }));
  let closeMore = () => {};
  const clearItem = menuItem('Clear', clearProgression, () => closeMore());
  const more = popover(h('button', { class: 'icon-btn menu-btn', title: 'Progression menu', 'aria-label': 'Progression menu' }, moreIcon(16)),
    h('div', { class: 'pop-row' }, loop.el), clearItem);
  closeMore = more.close;
  more.el.classList.add('more');
  const tools = h('div', { class: 'track-tools' },
    h('label', { class: 'tempo' }, bpm, h('small', {}, 'bpm')),
    h('span', { class: 'how-wrap' }, how, chevronIcon(10)),
    h('span', { class: 'vsep' }), seg);
  opts.play.classList.add('play-big');
  const track = h('div', { class: 'track' }, opts.play, tiles, tools, more.el);

  const map = createProgressionMap((i) => selectCard(i));
  const mapWrap = h('div', { class: 'map-wrap' }, map.el);

  const neckWrap = h('div', { class: 'neckwrap' }, neck.element);
  const stage = h('section', { class: 'stage', 'aria-label': 'Instrument' }, bar, neckWrap, caption, track);

  // ---------------------------------------------------------------- desk
  const chordInfo = h('div', { class: 'chordinfo' });
  const nextInfo = h('div', { class: 'nextinfo' });
  const deskCols = h('div', { class: 'desk-cols' }, chordInfo, nextInfo);
  // On phones the view switch sits at the top of the desk, one tap away.
  const deskSwitch = h('div', { class: 'desk-switch' });
  const desk = h('section', { class: 'desk' }, deskSwitch, mapWrap, deskCols, opts.tab);

  // ---------------------------------------------------------------- shared reads
  const label = (chord: Chord, analysis: FingeringAnalysis | null) => (str: number, fret: number) => {
    const pc = pcAt(str, fret);
    const role = chord ? fingeringRole(chord, pc) : analysis?.bass ? BASS_INTERVALS[mod12(pc - analysis.bass.pc)] : '';
    return { role, text: state.labelMode === 'interval' ? role : chord ? noteIn(chord, str, fret) : sharpName(pc) };
  };
  const fingeringRole = (chord: Chord, pc: number) => {
    const t = chordTones(chord).find((x) => x.pc === pc);
    return t?.label ?? '';
  };
  const keyDotsFor = (key: Key, taken: Set<string>): KeyDot[] => {
    if (!state.keyNotes) return [];
    const scale = keyScale(key);
    const out: KeyDot[] = [];
    for (let string = 0; string < 6; string++) {
      for (let fret = 1; fret <= MAX_FRET; fret++) {
        const pc = pcAt(string, fret);
        if (scale.has(pc) && !taken.has(`${string}:${fret}`)) out.push({ string, fret, tonic: pc === mod12(key.tonic) });
      }
    }
    return out;
  };
  const outside = (key: Key) => (pc: number) => state.keyNotes && !pitchInKey(pc, key);

  let open: { at: string; source: string } | null = null;

  const read = () => {
    const { key, guessed } = currentKey();
    const n = state.progression.length;
    const place = placeIndex(n, state.selectedCard);
    const x = afterChord(state.progression, state.selectedCard) ?? null;
    const from = x ? cardShape(x) : null;
    const groups = x ? nextByMood(state.progression, key, state.style, place + 1) : [];
    const at = `${place}:${state.progression.map((c) => chordSymbolInKey(c, key)).join(' ')}`;
    let trying: Trying | null = null;
    if (x && from && state.selected) {
      for (const g of groups) {
        for (const idea of g.ideas) {
          const to = smoothShape(idea.chord, from);
          if (!to || !same(idea.chord, state.selected) || !sameShape(to, state.fingering)) continue;
          const source = `after:${chordSymbolInKey(idea.chord, key)}`;
          // The idea picked here, or (on load, or after a key change) the chord on the neck when it's one of the ideas.
          if (!trying || (open?.at === at && open.source === source)) trying = { idea, mood: g.mood, from, to };
        }
      }
    }
    return { key, guessed, n, place, x, from, groups, at, trying };
  };
  type Read = ReturnType<typeof read>;

  // ---------------------------------------------------------------- bar render
  const renderBar = (r: Read) => {
    const ranked = r.n ? rankKeys(state.progression).slice(0, 4) : [];
    const likely = new Set(ranked.map((k) => keyId(k.key)));
    const option = (k: Key, text = keyName(k)) => h('option', { value: keyId(k), selected: !r.guessed && keyId(k) === keyId(r.key) }, text);
    clear(keySelect);
    add(keySelect,
      h('option', { value: '', selected: r.guessed }, keyName(r.guessed ? r.key : currentKeyGuess())),
      ranked.length ? h('optgroup', { label: 'Likely' }, ranked.map((k) => option(k.key))) : null,
      h('optgroup', { label: 'All keys' }, ALL_KEYS.filter((k) => !likely.has(keyId(k))).map((k) => option(k))),
    );
    keySelect.title = r.guessed ? 'Best guess' : 'Key';
    styleSelect.value = state.style;
    keyMenuButton.replaceChildren(keyName(r.key), chevronIcon(10));
    const playing = playingChord();
    keyChips.replaceChildren(...keyChords(r.key, state.style).map((d) => {
      const source = `key:${chordSymbolInKey(d.chord, r.key)}`;
      const yours = state.progression.some((c) => sameFunction(c, d.chord));
      return h('button', {
        class: `kchip${yours ? ' yours' : ''}${isSelected(d.chord, source) ? ' selected' : ''}${playing && sameFunction(playing, d.chord) ? ' playing' : ''}`,
        title: `${chordSymbolInKey(d.chord, r.key)}: click to play, double-click to add`,
        onclick: onChordClick(d.chord, () => selectChord(d.chord), source),
      }, h('span', { class: 'sym' }, chordNode(chordSymbolInKey(d.chord, r.key))),
      h('span', { class: `num${chordFitInKey(d.chord, r.key) === 'outside' ? ' out' : ''}` }, numeralNode(numeralLabel(romanNumeral(d.chord, r.key)))));
    }));
    undoButton.disabled = !canUndo();
  };

  // ---------------------------------------------------------------- neck render
  const renderNeck = (r: Read) => {
    neck.setPhone(phone.matches);
    if (r.trying && r.x) {
      const { idea, from, to } = r.trying;
      const xl = label(r.x, null);
      const il = label(idea.chord, null);
      const out = outside(r.key);
      const lab: Label = (str, fret, which) => {
        const l = (which === 'from' ? xl : il)(str, fret);
        return { text: l.text, cls: toneClass(l.role || undefined), out: out(pcAt(str, fret)) };
      };
      const taken = new Set([from, to].flatMap((f) => f.map((fret, str) => `${str}:${fret}`)));
      neck.showMove(`${formatFingering(from)}>${formatFingering(to)}:${chordSymbol(r.x)}>${chordSymbol(idea.chord)}:${state.labelMode}:${state.keyNotes ? keyId(r.key) : ''}`,
        from, to, lab, keyDotsFor(r.key, taken));
      return;
    }
    showShape(state.fingering, r.key);
  };
  const showShape = (shape: Fingering, key: Key) => {
    const analysis = withPreferredFirst(analyzeFingering(shape), state.selected);
    const chord = analysis.matches[0] ?? null;
    const l = chord ? label(chord, analysis) : label(null as unknown as Chord, analysis);
    const out = outside(key);
    const marks: Mark[] = analysis.notes.map((n) => {
      const x = chord ? l(n.string, n.fret) : { role: analysis.bass ? BASS_INTERVALS[mod12(n.pc - analysis.bass.pc)] : '', text: '' };
      const text = state.labelMode === 'interval' ? x.role : chord ? noteIn(chord, n.string, n.fret) : sharpName(n.pc);
      return { string: n.string, fret: n.fret, text, cls: toneClass(x.role || undefined), out: out(n.pc) };
    });
    const ghosts: Mark[] = state.showNeck && chord
      ? chordTonePositions(chord, shape).map((p) => {
        const role = fingeringRole(chord, p.pc);
        return { string: p.string, fret: p.fret, text: state.labelMode === 'interval' ? role : noteIn(chord, p.string, p.fret), cls: toneClass(role || undefined) };
      })
      : [];
    const taken = new Set([...marks, ...ghosts].map((m) => `${m.string}:${m.fret}`));
    neck.show({ fingering: shape, marks, ghosts, keyDots: keyDotsFor(key, taken) });
  };

  // ---------------------------------------------------------------- caption render
  const renderCaption = (r: Read) => {
    const name = (c: Chord) => chordSymbolInKey(c, r.key);
    const playButton = (title: string, onclick: () => void) => h('button', { class: 'replay', title, 'aria-label': title, onclick }, h('span', { class: 'pb' }, playIcon(11)));
    if (r.trying && r.x) {
      const { idea, from, to } = r.trying;
      const c = idea.chord;
      const line = movesLine(r.x, from, c, to);
      const parts: Node[] = [];
      if (line.held.length) {
        line.held.forEach((n, i) => {
          if (i) parts.push(document.createTextNode(i === line.held.length - 1 ? ' and ' : ', '));
          parts.push(h('b', {}, noteNode(n)));
        });
        parts.push(document.createTextNode(line.held.length === 1 ? ' stays' : ' stay'));
      }
      line.moves.forEach(([a, b]) => {
        if (parts.length) parts.push(h('span', { class: 'sep' }, ' · '));
        parts.push(h('b', {}, noteNode(a)), h('span', { class: 'arr' }, '→'), h('b', {}, noteNode(b)));
      });
      const why = ideaWhy(idea, {
        after: romanNumeral(r.x, r.key),
        progression: state.progression.map((p) => romanNumeral(p, r.key)).join('–'),
        thenRoot: idea.then?.chords[0]?.root ?? null,
      });
      const phrase = withSmoothShapes(thenPhrase(idea), to);
      const title = `Play ${name(r.x)} to ${name(c)}`;
      clear(caption);
      add(caption,
        playButton(title, () => void neck.play()),
        h('span', { class: 'mv-title' }, chordNode(name(r.x)), h('span', { class: 'arr' }, '→'), chordNode(name(c))),
        h('span', { class: 'mv-line' }, parts),
        why ? h('span', { class: 'mv-why' }, why) : null,
        h('div', { class: 'adds' },
          h('button', { class: 'add primary', onclick: () => addToProgression({ ...c, fingering: to }) }, '+\u00a0', chordNode(name(c))),
          phrase.length > 1 ? h('button', { class: 'add', onclick: () => addToProgression(...phrase) }, '+\u00a0', phrase.map((p, i) => [i ? ' ' : '', chordNode(name(p))])) : null),
        view.el,
      );
      return;
    }
    const analysis = withPreferredFirst(analyzeFingering(state.fingering), state.selected);
    const chord = analysis.matches[0];
    const title = chord ? name(chord) : analysis.pitchClasses.length === 1 ? sharpName(analysis.pitchClasses[0]) : analysis.interval?.name ?? '';
    clear(caption);
    add(caption,
      playButton(chord ? `Play ${name(chord)}` : 'Play', () => void neck.strumOnce(state.fingering)),
      h('span', { class: 'mv-title' }, chord ? chordNode(name(chord)) : title),
      chord ? h('span', { class: 'mv-line' }, numeralNode(numeralLabel(romanNumeral(chord, r.key))), ` in ${keyName(r.key)}`) : null,
      h('span', { class: 'spacer' }),
      chord ? h('div', { class: 'adds' }, h('button', { class: 'add primary', title: `Add ${name(chord)} (A)`, onclick: addSelection }, '+\u00a0', chordNode(name(chord)))) : null,
      view.el,
    );
  };

  // ---------------------------------------------------------------- track render
  let tileEls: HTMLElement[] = [];
  const drag = enableReorder(tiles, {
    items: () => tileEls,
    ignore: '.remove-btn',
    scrollers: () => [tiles],
    bounds: () => tiles,
    onTap: (i) => {
      open = null;
      selectCard(i);
    },
    onMove: (from, to) => moveProgressionCard(from, to),
  });
  const miniBox = (c: Chord, f: Fingering) => chordBox(f, fingeringToneLabels(c, f).map((l) => (l === null ? null : { text: l, cls: toneClass(l || undefined) })), `${chordSymbol(c)} chord diagram`, true);
  const tile = (c: Chord, f: Fingering | null, key: Key, cls: string, extra: Record<string, unknown> = {}) => h('div', {
    class: `tile ${cls}`, role: 'button', tabindex: 0, 'aria-label': chordSymbolInKey(c, key), ...extra,
  },
    h('span', { class: 'sym' }, chordNode(chordSymbolInKey(c, key))),
    h('span', { class: `num${chordFitInKey(c, key) === 'outside' ? ' out' : ''}` }, numeralNode(numeralLabel(romanNumeral(c, key)))),
    f ? miniBox(c, f) : null);
  const renderTrack = (r: Read) => {
    drag.cancel();
    const p = currentPlayback();
    const step = p?.id === PROGRESSION_ID ? p.step : null;
    tileEls = state.progression.map((c, i) => {
      const el = tile(c, cardShape(c), r.key, `card${i === r.place && (state.selectedCard !== null || r.n) ? ' from' : ''}${step === i ? ' now' : ''}`, {
        title: 'Click to select, drag to move, double-click to duplicate',
        // Click: your place moves here, and you hear it; double-click duplicates it right after itself.
        onclick: (e: Event) => {
          const clicks = (e as MouseEvent).detail;
          if (clicks === 2) duplicateCard(i);
          else if (clicks <= 1) {
            open = null;
            selectCard(i);
          }
        },
        onkeydown: (e: Event) => (e as KeyboardEvent).key === 'Enter' && selectCard(i),
      });
      if (i === r.place) {
        el.append(h('button', {
          class: 'remove-btn', title: 'Remove (Delete)', 'aria-label': `Remove ${chordSymbolInKey(c, r.key)}`,
          onclick: (e: Event) => { e.stopPropagation(); removeFromProgression(i); },
        }, '×'));
      }
      return el;
    });
    const slot = r.trying ? ghost(r) : h('button', {
      class: 'tile add-slot', title: 'Add the chord on the neck (A)', 'aria-label': 'Add the chord on the neck (A)', onclick: addSelection,
    }, h('span', { class: 'plus' }, '+'));
    const nodes: HTMLElement[] = [...tileEls];
    nodes.splice(r.n ? r.place + 1 : 0, 0, slot);
    tiles.replaceChildren(...nodes);
    // Your place and the idea stay in view.
    if (takeJustAdded() || phone.matches) slot.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  const ghost = (r: Read) => {
    const { idea, to } = r.trying!;
    const then = idea.then;
    const phrase = withSmoothShapes(thenPhrase(idea), to);
    const source = `then:${[idea.chord, ...(then?.chords ?? [])].map((c) => chordSymbolInKey(c, r.key)).join(' ')}`;
    const preview = (e: Event) => {
      const action = chordClickAction((e as MouseEvent).detail || 1);
      if (action === 'select') selectPhrase(phrase, source, (shapes) => void neck.playInTurn(shapes));
      else if (action === 'add') addToProgression(...phrase);
    };
    const home = then?.returnsHome ? then.chords.length - 1 : -1;
    return h('div', { class: 'ghost' },
      then ? h('button', { class: 'legend', title: 'Click to play, double-click to add', onclick: preview }, `${then.name} · ${then.genre}`) : null,
      tile(idea.chord, to, r.key, 'idea', { title: `Play ${chordSymbolInKey(r.x!, r.key)} to ${chordSymbolInKey(idea.chord, r.key)}`, onclick: () => void neck.play() }),
      (then?.chords ?? []).map((c, i) => tile(c, i < phrase.length - 1 ? phrase[i + 1].fingering ?? cardShape(c) : cardShape(c), r.key, i === home ? 'end' : '', {
        title: 'Click to play, double-click to add', onclick: preview,
      })));
  };

  // ---------------------------------------------------------------- desk render
  const renderChordInfo = (r: Read) => {
    const shape = state.fingering;
    const analysis = withPreferredFirst(analyzeFingering(shape), state.selected);
    const chord = analysis.matches[0];
    clear(chordInfo);
    if (!analysis.notes.length) return add(chordInfo, h('h1', { class: 'cname muted' }, '—'));
    if (!chord) {
      if (analysis.pitchClasses.length === 1) return add(chordInfo, h('h1', { class: 'cname' }, noteNode(sharpName(analysis.pitchClasses[0]))));
      if (analysis.interval) {
        return add(chordInfo, h('div', { class: 'ci-head' }, h('h1', { class: 'cname small' }, analysis.interval.name),
          h('div', { class: 'ci-meta' }, h('p', { class: 'ci-full' }, noteNode(sharpName(analysis.bass!.pc)), '–', noteNode(sharpName(analysis.pitchClasses.find((pc) => pc !== analysis.bass!.pc)!))))));
      }
      return add(chordInfo, h('h1', { class: 'cname muted' }, '?'));
    }
    const name = chordSymbolInKey(chord, r.key);
    const character = chordCharacter(chord.template.id);
    const tones = toneArea(chord, shape, () => neck.element, outside(r.key));
    const voicings = findVoicings(chord, 6);
    const current = formatFingering(shape);
    add(chordInfo,
      h('div', { class: 'ci-head' },
        h('h1', { class: 'cname' }, h('button', { class: 'cname-btn', title: 'Click to play, double-click to add', onclick: onShapeClick(chord, shape, () => void neck.strumOnce(shape)) }, chordNode(name))),
        h('div', { class: 'ci-meta' },
          h('p', { class: 'ci-full' }, noteNode(preferredRootName(chord.root, chord.template.family)), ` ${chord.template.name}`),
          h('p', { class: 'ci-desc' }, character ? `${character[0].toUpperCase()}${character.slice(1)}. ` : '', chordReason(chord, r.key)))),
      tones.chips,
      h('div', { class: 'discl' },
        disclosure('guitar-theory-structure', 'Chord structure', tones.structure()),
        voicings.length ? disclosure('guitar-theory-other-shapes', `Other shapes ${voicings.length}`,
          h('div', { class: 'voicing-list' }, voicings.map((v) => h('button', {
            class: `voicing${formatFingering(v.fingering) === current ? ' current' : ''}`,
            title: 'Click to put this shape on the neck, double-click to add',
            onclick: onShapeClick(chord, v.fingering, () => selectChord(chord, v.fingering)),
          }, miniBox(chord, v.fingering), h('span', { class: 'fingering-text' }, formatFingering(v.fingering)))))) : null),
    );
  };

  const renderNext = (r: Read) => {
    // A re-render keeps focus on the chip that had it.
    const active = document.activeElement as HTMLElement | null;
    const focused = active && nextInfo.contains(active) ? active.dataset.source ?? null : null;
    clear(nextInfo);
    if (!r.x) {
      add(nextInfo, h('h2', { class: 'next-h' }, 'Start with'), startsFor(r.key));
      return;
    }
    add(nextInfo,
      h('h2', { class: 'next-h' }, h('span', { class: 'pre' }, 'After'), ' ', chordNode(chordSymbolInKey(r.x, r.key))),
      r.groups.length ? null : h('p', { class: 'muted idea-none' }, 'Nothing fits here'),
      h('div', { class: 'moods' }, r.groups.map((g) => [
        h('div', { class: 'mood' }, g.mood),
        h('div', { class: 'mrow' }, g.ideas.map((idea) => {
          const c = idea.chord;
          const sym = chordSymbolInKey(c, r.key);
          const source = `after:${sym}`;
          const to = smoothShape(c, r.from);
          const click = onChordClick(c, () => {
            selectChord(c, to ?? undefined, false);
            void neck.play();
          }, source);
          const on = r.trying?.idea === idea;
          return h('button', {
            class: `ichip${on ? ' sel' : ''}${state.progression.some((p) => sameFunction(p, c)) ? ' yours' : ''}`,
            title: `${chordSymbolInKey(r.x!, r.key)} to ${sym} (${numeralLabel(idea.numeral)}). Click to play, double-click to add`,
            'aria-pressed': String(on), 'data-source': source,
            onclick: (e: Event) => {
              open = { at: r.at, source };
              click(e);
            },
          }, h('span', { class: 'sym' }, chordNode(sym)), h('span', { class: `num${chordFitInKey(c, r.key) === 'outside' ? ' out' : ''}` }, numeralNode(numeralLabel(idea.numeral))));
        })),
      ])),
    );
    if (focused) (nextInfo.querySelector(`[data-source="${CSS.escape(focused)}"]`) as HTMLElement | null)?.focus();
  };

  // Start with: one family at a time, built once per key.
  type StartRow = { id: string; chips: HTMLElement[]; colOfBar: number[] };
  const startCache = new Map<string, { el: HTMLElement; rows: StartRow[] }>();
  let startRows: StartRow[] = [];
  const startsFor = (key: Key) => {
    let entry = startCache.get(keyId(key));
    if (!entry) {
      entry = buildStarts(key);
      startCache.set(keyId(key), entry);
    }
    startRows = entry.rows;
    return entry.el;
  };
  const buildStarts = (key: Key) => {
    const rows: StartRow[] = [];
    const row = (group: StartGroup, item: StartItem) => {
      const chords = item.chords;
      const cols = collapseRepeats(chords, same);
      const id = `start:${item.id}`;
      const chips = cols.map((col) => h('span', { class: 'start-chip' },
        h('span', { class: 'sym' }, chordNode(chordSymbolInKey(col.chord, item.key))),
        h('span', { class: `num${chordFitInKey(col.chord, item.key) === 'outside' ? ' out' : ''}` }, numeralNode(numeralLabel(romanNumeral(col.chord, item.key)))),
        col.count > 1 ? h('span', { class: 'start-count' }, `×${col.count}`) : null));
      rows.push({ id, chips, colOfBar: cols.flatMap((col, i) => Array.from({ length: col.count }, () => i)) });
      const named = group.name.toLowerCase().includes(item.genre.toLowerCase());
      return h('div', { class: 'start-row' },
        h('button', {
          class: 'round-play', title: 'Play this progression', 'aria-label': `Play ${item.name}`,
          // Played and added in smooth shapes: the first as usual, each next one moving least.
          onclick: () => play(id, () => withSmoothShapes(chords).map((c) => c.fingering).filter((f) => !!f) as Fingering[], { perChord: true }),
        }, playIcon()),
        h('span', { class: 'start-name', title: item.note }, item.name),
        h('span', { class: 'start-chips' }, chips),
        h('span', { class: 'start-mood' }, named ? item.mood : `${item.genre} · ${item.mood}`),
        h('button', {
          class: 'start-add', title: 'Add these chords to the progression', 'aria-label': `Add ${item.name} to the progression`,
          onclick: () => {
            // Starting from nothing, the style and key follow the entry (a bossa start lands in 9ths).
            const empty = !state.progression.length;
            addToProgression(...withSmoothShapes(chords));
            if (empty) update(startSettings(item));
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

  // ---------------------------------------------------------------- render
  const playingChord = (): Chord | null => {
    const p = currentPlayback();
    return p?.id === PROGRESSION_ID && p.step !== null ? state.progression[p.step] ?? null : null;
  };

  const renderTools = () => {
    if (document.activeElement !== bpm) bpm.value = String(state.bpm);
    how.value = `${state.playPattern}:${state.playVariants[state.playPattern]}`;
    modeSeg.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    modeButtons.forEach((b) => {
      b.classList.toggle('active', b.dataset.mode === state.labelMode);
      b.setAttribute('aria-pressed', String(b.dataset.mode === state.labelMode));
    });
    neckBox.sync();
    keyNotes.sync();
    loop.sync();
    clearItem.disabled = !state.progression.length;
  };

  const renderMap = (r: Read) => {
    const on = mode === 'notes';
    mapWrap.hidden = !on;
    if (!on) return;
    const p = currentPlayback();
    map.render(state.progression, r.key, p?.id === PROGRESSION_ID ? p.step : null, phone.matches, state.loop, r.trying ? [r.trying.idea.chord] : []);
    if (!phone.matches) fitMap();
  };

  // On the desk the map is drawn larger, rows up to about 30px, as far as the window allows.
  const fitMap = () => {
    const svg = mapWrap.querySelector('svg.pmap-svg') as SVGSVGElement | null;
    if (!svg || !svg.isConnected) return;
    svg.removeAttribute('viewBox');
    svg.style.width = svg.style.height = '';
    const box = svg.getBBox();
    const w = box.x + box.width + 4;
    const h = box.y + box.height + 2;
    const room = window.innerHeight - svg.getBoundingClientRect().top + window.scrollY - 16;
    const k = Math.max(1, Math.min(30 / 19, room / h, (mapWrap.clientWidth || w) / w));
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.style.width = `${w * k}px`;
    svg.style.height = `${h * k}px`;
  };

  const render = () => {
    const r = read();
    renderBar(r);
    renderTools();
    if (!playingChord()) renderNeck(r);
    renderCaption(r);
    renderTrack(r);
    renderMap(r);
    if (mode === 'chord') renderChordInfo(r);
    if (mode === 'progression') renderNext(r);
  };

  // While the progression plays, the neck shows each chord as it sounds; nothing else moves.
  onPlayback((p) => {
    const step = p?.id === PROGRESSION_ID ? p.step : null;
    tileEls.forEach((el, i) => el.classList.toggle('now', step === i));
    const playing = playingChord();
    keyChips.querySelectorAll('.kchip').forEach((el, i) => {
      const d = keyChords(currentKey().key, state.style)[i];
      el.classList.toggle('playing', !!playing && !!d && sameFunction(playing, d.chord));
    });
    if (playing) {
      const shape = cardShape(playing);
      if (shape) showShape(shape, currentKey().key);
    } else render();
    for (const r of startRows) {
      const col = p?.id === r.id && p.step !== null ? r.colOfBar[p.step] : -1;
      r.chips.forEach((c, i) => c.classList.toggle('playing', i === col));
    }
  });
  onNote((strings, p) => (p.id === PROGRESSION_ID || p.id === 'inspector') && neck.pluck(strings));

  // Phones: the key menu holds the style and the key's chords; View's options sit in Settings;
  // the track's tools move into its menu.
  const place = () => {
    if (phone.matches) {
      opts.settingsPop.append(viewRows);
      keyMenuBody.replaceChildren(keyWrap, styleWrap, keyChips);
      deskSwitch.replaceChildren(seg);
    } else {
      viewSlot.append(viewRows);
      bar.insertBefore(keyChips, barSpacer);
      bar.insertBefore(styleWrap, keyChips);
      bar.insertBefore(keyWrap, styleWrap);
      tools.append(seg);
    }
    render();
  };
  let placedPhone: boolean | null = null;
  const replace = () => {
    if (phone.matches === placedPhone) return;
    placedPhone = phone.matches;
    place();
  };
  phone.addEventListener('change', replace);
  window.addEventListener('resize', replace);

  const setMode = (m: Mode) => {
    mode = m;
    deskCols.hidden = m !== 'chord' && m !== 'progression';
    chordInfo.hidden = m !== 'chord';
    nextInfo.hidden = m !== 'progression';
    opts.tab.hidden = m !== 'tab';
    opts.onMode(m);
    render();
  };

  subscribe(render);
  replace();
  return {
    stage, desk,
    focusSearch: () => {
      search.classList.add('open');
      input.focus();
      input.select();
    },
    setMode,
  };
}

/** Name the shape as the chord it was picked as when that's one of its names (e.g. C6, not Am7/C). */
function withPreferredFirst(analysis: FingeringAnalysis, preferred: Chord | null): FingeringAnalysis {
  const i = preferred ? analysis.matches.findIndex((m) => m.root === preferred.root && m.template.id === preferred.template.id) : -1;
  if (i <= 0) return analysis;
  return { ...analysis, matches: [analysis.matches[i], ...analysis.matches.filter((_, j) => j !== i)] };
}

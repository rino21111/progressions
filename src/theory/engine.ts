// Relationships engine: what to play after a progression (Natural or Spicy), the classic phrase that
// continues from each idea (its "then" line), and what to start with. A port of the reference engine
// (reference/theory/engine.js, design notes in reference/theory/design.md); tests/engine.test.ts holds
// it to the reference's output. Works on its own chord records and symbols; ideas.ts bridges to the site.
// Chords are { letter, acc, root (pc 0-11), quality, symbol }. A chord realized from a numeral in a key also
// carries { deg, nacc, kid } so its numeral survives respelling (Bbb is spelled A but stays bVI in Db).

import LIBRARY_JSON from './library.json';

export type Quality = 'maj' | 'm' | 'dim' | 'aug' | '7' | 'm7' | 'maj7' | 'm7b5' | 'dim7';
export type EngineLane = 'T' | 'PD' | 'D';
type Fam = 'M' | 'm' | 'd' | 'a';

export interface EChord {
  letter: string;
  acc: number;
  root: number;
  /** The base quality every rule reads (Cmaj9 is maj7). */
  quality: Quality;
  /** A colour chord's own type (a COLOUR key, the site's template id), kept in its symbol and numeral. */
  colour?: ColourId;
  symbol: string;
  kid?: string;
  deg?: number;
  nacc?: number;
}

export interface EngineKeyInput {
  tonic: number;
  mode: 'major' | 'minor';
  name?: string;
}

interface EKey {
  _k: true;
  tonic: number;
  mode: 'major' | 'minor';
  letter: string;
  li: number;
  name: string;
  label: string;
  id: string;
}

export interface LibraryEntry {
  id: string;
  name: string;
  genre: string;
  mood: string;
  mode: 'major' | 'minor';
  numerals: string[];
  kind: string;
  uses: string[];
  core?: number[];
  note: string;
  repeat?: number[];
  /** An earlier entry with the same harmony in other colours: it gives no n-gram support. */
  variantOf?: string;
  /** The name lives in colour changes on one chord (a line cliché): never cited or used for a then line. */
  nameNeedsColours?: boolean;
}

export const LIBRARY = LIBRARY_JSON as LibraryEntry[];

// ---------- basics ----------
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NAT = [0, 2, 4, 5, 7, 9, 11];
const SCALE = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const QUAL: Record<Quality, { iv: number[]; deg: number[]; fam: Fam; suf: string; num: string }> = {
  maj: { iv: [0, 4, 7], deg: [0, 2, 4], fam: 'M', suf: '', num: '' },
  m: { iv: [0, 3, 7], deg: [0, 2, 4], fam: 'm', suf: 'm', num: '' },
  dim: { iv: [0, 3, 6], deg: [0, 2, 4], fam: 'd', suf: 'dim', num: '°' },
  aug: { iv: [0, 4, 8], deg: [0, 2, 4], fam: 'a', suf: 'aug', num: '+' },
  7: { iv: [0, 4, 7, 10], deg: [0, 2, 4, 6], fam: 'M', suf: '7', num: '7' },
  m7: { iv: [0, 3, 7, 10], deg: [0, 2, 4, 6], fam: 'm', suf: 'm7', num: '7' },
  maj7: { iv: [0, 4, 7, 11], deg: [0, 2, 4, 6], fam: 'M', suf: 'maj7', num: 'maj7' },
  m7b5: { iv: [0, 3, 6, 10], deg: [0, 2, 4, 6], fam: 'd', suf: 'm7b5', num: 'ø7' },
  dim7: { iv: [0, 3, 6, 9], deg: [0, 2, 4, 6], fam: 'd', suf: 'dim7', num: '°7' },
};
const QALIAS: Record<string, Quality> = {
  '': 'maj', M: 'maj', maj: 'maj', m: 'm', min: 'm', '-': 'm', dim: 'dim', '°': 'dim', o: 'dim', aug: 'aug', '+': 'aug',
  7: '7', dom7: '7', m7: 'm7', min7: 'm7', '-7': 'm7', maj7: 'maj7', M7: 'maj7', 'Δ': 'maj7', 'Δ7': 'maj7',
  m7b5: 'm7b5', 'ø': 'm7b5', 'ø7': 'm7b5', dim7: 'dim7', '°7': 'dim7', o7: 'dim7',
};
// Colour chords (the site's other chord types). The logic reads each as its base quality, so Cmaj9 is Cmaj7 and
// Cadd9 is C to every rule below; the colour is kept on the chord (c.colour) and in its symbol and numeral.
// set: 'ext' colours mark the 9ths style, 'open' colours the add9 style. Keys match the site's template ids.
type ColourSet = 'ext' | 'open';
export const COLOUR = {
  5: { base: 'maj', suf: '5', num: '5', set: 'open' },
  sus2: { base: 'maj', suf: 'sus2', num: 'sus2', set: 'open' },
  sus4: { base: 'maj', suf: 'sus4', num: 'sus4', set: 'open' },
  add9: { base: 'maj', suf: 'add9', num: 'add9', set: 'open' },
  add11: { base: 'maj', suf: 'add11', num: 'add11', set: 'open' },
  6: { base: 'maj', suf: '6', num: '6', set: 'ext' },
  69: { base: 'maj', suf: '6/9', num: '6/9', set: 'ext' },
  madd9: { base: 'm', suf: 'm(add9)', num: 'add9', set: 'open' },
  madd11: { base: 'm', suf: 'm(add11)', num: 'add11', set: 'open' },
  m6: { base: 'm', suf: 'm6', num: '6', set: 'ext' },
  m69: { base: 'm', suf: 'm6/9', num: '6/9', set: 'ext' },
  mMaj7: { base: 'm', suf: 'm(maj7)', num: 'maj7', set: 'ext' },
  maj9: { base: 'maj7', suf: 'maj9', num: 'maj9', set: 'ext' },
  maj13: { base: 'maj7', suf: 'maj13', num: 'maj13', set: 'ext' },
  'maj7#11': { base: 'maj7', suf: 'maj7#11', num: 'maj7#11', set: 'ext' },
  m9: { base: 'm7', suf: 'm9', num: '9', set: 'ext' },
  m11: { base: 'm7', suf: 'm11', num: '11', set: 'ext' },
  m13: { base: 'm7', suf: 'm13', num: '13', set: 'ext' },
  9: { base: '7', suf: '9', num: '9', set: 'ext' },
  13: { base: '7', suf: '13', num: '13', set: 'ext' },
  '7sus4': { base: '7', suf: '7sus4', num: '7sus4', set: 'ext' },
  '9sus4': { base: '7', suf: '9sus4', num: '9sus4', set: 'ext' },
  '7b9': { base: '7', suf: '7b9', num: '7b9', set: 'ext' },
  '7#9': { base: '7', suf: '7#9', num: '7#9', set: 'ext' },
  '7b5': { base: '7', suf: '7b5', num: '7b5', set: 'ext' },
  '7#11': { base: '7', suf: '7#11', num: '7#11', set: 'ext' },
  '7#5': { base: '7', suf: '7#5', num: '7#5', set: 'ext' },
  'maj7#5': { base: 'aug', suf: 'maj7#5', num: 'maj7#5', set: 'ext' },
} as const satisfies Record<string, { base: Quality; suf: string; num: string; set: ColourSet }>;
export type ColourId = `${keyof typeof COLOUR}`;
const colourOf = (id: string): { base: Quality; suf: string; num: string; set: ColourSet } | undefined =>
  (COLOUR as Record<string, { base: Quality; suf: string; num: string; set: ColourSet }>)[id];
type AnyQuality = Quality | ColourId;
const reAlt = (list: string[]) => [...new Set(list)].sort((a, b) => b.length - a.length).map((x) => x.replace(/[+()/#]/g, '\\$&')).join('|');
const SYM_SUF = Object.keys(QALIAS).filter(Boolean).concat(Object.values(COLOUR).map((x) => x.suf));
const SYM_RE = new RegExp('^([A-G])(bb|##|b|#|♭|♯)?(' + reAlt(SYM_SUF) + ')?$');
// numeral suffixes: upper case is the major or dominant family, lower case the minor or diminished family
const NUM_UP: Record<string, AnyQuality> = { '': 'maj', 7: '7', maj7: 'maj7', '+': 'aug' };
const NUM_LO: Record<string, AnyQuality> = { '': 'm', 7: 'm7', '°': 'dim', '°7': 'dim7', 'ø7': 'm7b5' };
for (const [id, x] of Object.entries(COLOUR)) {
  const lower = QUAL[x.base].fam === 'm';
  (lower ? NUM_LO : NUM_UP)[x.num] = id as ColourId;
}
const NUM_RE = new RegExp('^(bb|b|#)?(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)(' + reAlt([...Object.keys(NUM_UP), ...Object.keys(NUM_LO)].filter(Boolean)) + ')?$');
const MAJ_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const MIN_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];

const mod = (a: number, n = 12) => ((a % n) + n) % n;
const accStr = (a: number) => (a < 0 ? 'b'.repeat(-a) : '#'.repeat(a));
const isTriad = (q: Quality) => q === 'maj' || q === 'm' || q === 'dim' || q === 'aug';
const fam = (c: EChord) => QUAL[c.quality].fam;
const TRIAD_OF: Record<Fam, Quality> = { M: 'maj', m: 'm', d: 'dim', a: 'aug' };

// quality is a base quality (QUAL) or a colour id (COLOUR); a colour is stored as c.colour over its base
function mk(letter: string, acc: number, quality: AnyQuality): EChord {
  const root = mod(NAT[LETTERS.indexOf(letter)] + acc);
  const col = colourOf(quality);
  const c: EChord = { letter, acc, root, quality: col ? col.base : (quality as Quality), symbol: letter + accStr(acc) + (col ? col.suf : QUAL[quality as Quality].suf) };
  if (col) c.colour = quality as ColourId;
  return c;
}
function tagNum(c: EChord, kid: string, deg: number, nacc: number): EChord {
  c.kid = kid; c.deg = deg; c.nacc = nacc; return c;
}
// same letter and accidental, another quality (a colour drops away); the numeral information comes along
function requality(c: EChord, q: AnyQuality): EChord {
  const r = mk(c.letter, c.acc, q);
  return c.kid ? tagNum(r, c.kid, c.deg!, c.nacc!) : r;
}
// the base chord under a colour (Cmaj9 to Cmaj7)
const plain = (c: EChord) => (c.colour ? requality(c, c.quality) : c);

export function parse(symbol: string | EChord): EChord {
  if (symbol && typeof symbol === 'object') return symbol;
  const m = String(symbol).trim().match(SYM_RE);
  if (!m) throw new Error('Unrecognized chord: ' + symbol);
  const a = (m[2] || '').replace('♭', 'b').replace('♯', '#');
  const acc = a ? (a[0] === 'b' ? -a.length : a.length) : 0;
  const sfx = m[3] || '';
  const col = (Object.keys(COLOUR) as ColourId[]).find((id) => colourOf(id)!.suf === sfx);
  return mk(m[1], acc, col || QALIAS[sfx]);
}

function keyInfo(key: EngineKeyInput | EKey): EKey {
  if ((key as EKey)._k) return key as EKey;
  const mode = key.mode === 'minor' ? 'minor' : 'major';
  const tonic = mod(key.tonic);
  const name = key.name || (mode === 'major' ? MAJ_NAMES : MIN_NAMES)[tonic];
  const letter = name[0];
  return { _k: true, tonic, mode, letter, li: LETTERS.indexOf(letter), name, label: name + ' ' + mode, id: name + ' ' + mode };
}
function relative(k: EKey): EKey {
  const li = mod(k.li + (k.mode === 'major' ? 5 : 2), 7);
  const tonic = mod(k.tonic + (k.mode === 'major' ? 9 : 3));
  const a = mod(tonic - NAT[li] + 6) - 6;
  return keyInfo({ tonic, mode: k.mode === 'major' ? 'minor' : 'major', name: LETTERS[li] + accStr(a) });
}
const parallelLabel = (k: EKey) => k.name + (k.mode === 'major' ? ' minor' : ' major');

// chord on scale degree d (0-6) at `semis` above the tonic, spelled on that degree's letter
function chordOnDegree(k: EKey, d: number, semis: number, quality: AnyQuality, nacc?: number): EChord {
  const li = mod(k.li + d, 7);
  const pc = mod(k.tonic + semis);
  const acc = mod(pc - NAT[li] + 6) - 6;
  let c: EChord;
  if (Math.abs(acc) < 2) c = mk(LETTERS[li], acc, quality);
  else {
    // never a double accidental on a chord symbol: Bbb7 is played and read as A7, F##dim7 as Gdim7.
    // The numeral keeps the degree it was realized from (bVI7, not #V7).
    const nat = NAT.indexOf(pc);
    if (nat >= 0) c = mk(LETTERS[nat], 0, quality);
    else {
      const L = acc > 0 ? NAT.indexOf(mod(pc - 1)) : NAT.indexOf(mod(pc + 1));
      c = mk(LETTERS[L], acc > 0 ? 1 : -1, quality);
    }
  }
  return tagNum(c, k.id, d, nacc != null ? nacc : mod(semis - SCALE[k.mode][d] + 6) - 6);
}

function parseNumeral(str: string): { d: number; acc: number; quality: AnyQuality } {
  const m = String(str).match(NUM_RE);
  if (!m) throw new Error('Bad numeral: ' + str);
  const acc = m[1] ? (m[1][0] === 'b' ? -m[1].length : 1) : 0;
  const upper = m[2] === m[2].toUpperCase();
  const d = ROMAN.indexOf(m[2].toUpperCase());
  const quality = (upper ? NUM_UP : NUM_LO)[m[3] || ''];
  if (!quality) throw new Error('Bad numeral quality: ' + str);
  return { d, acc, quality };
}
// realize a numeral in a key (minor: natural minor degrees; vii°, vii°7 use the leading tone)
export function realize(num: string, key: EngineKeyInput | EKey): EChord {
  const k = keyInfo(key);
  const { d, acc, quality } = parseNumeral(num);
  let semis = SCALE[k.mode][d] + acc;
  if (k.mode === 'minor' && d === 6 && acc === 0 && QUAL[colourOf(quality)?.base ?? (quality as Quality)].fam === 'd') semis += 1;
  return chordOnDegree(k, d, semis, quality, acc);
}

const numFrom = (d: number, nacc: number, q: Quality, colour?: ColourId) => {
  const f = QUAL[q].fam;
  return accStr(nacc) + (f === 'M' || f === 'a' ? ROMAN[d] : ROMAN[d].toLowerCase()) + (colour ? colourOf(colour)!.num : QUAL[q].num);
};
// the numeral of a chord in a key: the degree it was realized from when known, else read from its spelling
export function numeral(chord: string | EChord, key: EngineKeyInput | EKey): string {
  const c = parse(chord), k = keyInfo(key);
  if (c.kid === k.id) return numFrom(c.deg!, c.nacc!, c.quality, c.colour);
  const d = mod(LETTERS.indexOf(c.letter) - k.li, 7);
  const semis = mod(c.root - k.tonic);
  let acc = mod(semis - SCALE[k.mode][d] + 6) - 6;
  if (k.mode === 'minor' && d === 6 && acc === 1 && fam(c) === 'd') acc = 0;
  return numFrom(d, acc, c.quality, c.colour);
}

const semisOf = (c: EChord, k: EKey) => mod(c.root - k.tonic);
const sameRF = (a: EChord, b: EChord) => a.root === b.root && fam(a) === fam(b);
const sameChord = (a: EChord, b: EChord) => a.root === b.root && a.quality === b.quality;

interface Tone { pc: number; name: string }
// chord tones spelled: [{ pc, name }]
function tones(chord: string | EChord): Tone[] {
  const c = parse(chord), li = LETTERS.indexOf(c.letter), q = QUAL[c.quality];
  return q.iv.map((iv, i) => {
    const L = mod(li + q.deg[i], 7), pc = mod(c.root + iv);
    return { pc, name: LETTERS[L] + accStr(mod(pc - NAT[L] + 6) - 6) };
  });
}
// names in prose never carry a double accidental (C## reads D)
function plainName(name: string): string {
  if (!/(##|bb)$/.test(name)) return name;
  const pc = mod(NAT[LETTERS.indexOf(name[0])] + (name.endsWith('##') ? 2 : -2));
  return NAT.includes(pc) ? LETTERS[NAT.indexOf(pc)] : MAJ_NAMES[pc];
}
// a note named as the key spells it (B, not Cb, in C major; A#, not Bb, in G# minor), else as the chord spells it
function keyName(t: Tone, key: EKey): string {
  const k = keyInfo(key);
  const degs = SCALE[k.mode].map((s, d) => [s, d]);
  if (k.mode === 'minor') degs.push([11, 6]); // the leading tone
  for (const [s, d] of degs) {
    if (mod(k.tonic + s) !== t.pc) continue;
    const L = mod(k.li + d, 7);
    return plainName(LETTERS[L] + accStr(mod(t.pc - NAT[L] + 6) - 6));
  }
  return plainName(t.name);
}

// ---------- diatonic sets and chord roles ----------
type DiaEntry = [Fam, Quality];
const DIA: Record<'major' | 'minor', Record<number, DiaEntry>> = {
  major: { 0: ['M', 'maj7'], 2: ['m', 'm7'], 4: ['m', 'm7'], 5: ['M', 'maj7'], 7: ['M', '7'], 9: ['m', 'm7'], 11: ['d', 'm7b5'] },
  minor: { 0: ['m', 'm7'], 2: ['d', 'm7b5'], 3: ['M', 'maj7'], 5: ['m', 'm7'], 7: ['m', 'm7'], 8: ['M', 'maj7'], 10: ['M', '7'] },
};
const HARM: Record<number, DiaEntry> = { 7: ['M', '7'], 11: ['d', 'dim7'] }; // harmonic-minor V and vii°, standard in minor keys
function inMode(c: EChord, k: EKey, mode: 'major' | 'minor'): boolean {
  const s = semisOf(c, k), f = fam(c), q = c.quality;
  const ok = (t: DiaEntry | undefined) => !!t && t[0] === f && (isTriad(q) ? q !== 'aug' : q === t[1]);
  return ok(DIA[mode][s]) || (mode === 'minor' && ok(HARM[s]));
}
const diatonic = (c: EChord, k: EKey) => inMode(c, k, k.mode);
// the tonic chord; in blues style the dominant-seventh I7 is home too
const isTonicChord = (c: EChord, k: EKey, blues?: boolean) => semisOf(c, k) === 0 && fam(c) === (k.mode === 'major' ? 'M' : 'm') && (c.quality !== '7' || !!blues);
// the key's diatonic triad on `s` semitones (minor: the major V for s=7, as in "Leads to E")
function triadAt(k: EKey, s: number): EChord {
  const t = DIA[k.mode][s];
  if (!t) return null as unknown as EChord;
  const d = SCALE[k.mode].indexOf(s);
  let q = TRIAD_OF[t[0]];
  if (k.mode === 'minor' && s === 7) q = 'maj';
  return chordOnDegree(k, d, s, q);
}
const tonicizable = (k: EKey, s: number) => s !== 0 && !!DIA[k.mode][s] && DIA[k.mode][s][0] !== 'd';

type RoleName = 'tonic7' | 'secondary' | 'picardy' | 'dorian4' | 'diatonic' | 'tritone' | 'neapolitan' | 'borrowed' | 'leading' | 'blues' | 'other';
interface Role { role: RoleName; target?: number }
// context-free role of a chord in a key
function roleOf(chord: string | EChord, key: EngineKeyInput | EKey): Role {
  const c = parse(chord), k = keyInfo(key), s = semisOf(c, k), f = fam(c), q = c.quality;
  const major = k.mode === 'major';
  if (major && s === 0 && q === '7') return { role: 'tonic7', target: 5 };
  if (major && s === 0 && q === 'aug') return { role: 'secondary', target: 5 }; // I+ leans into IV
  if (!major && s === 0 && q === '7') return { role: 'secondary', target: 5 };
  if (!major && s === 0 && f === 'M') return { role: 'picardy', target: 5 };
  if (!major && s === 5 && f === 'M') return { role: 'dorian4', target: 10 };
  if (diatonic(c, k)) return { role: 'diatonic' };
  if (s === 1 && q === '7') return { role: 'tritone', target: 0 };
  if (s === 1 && f === 'M') return { role: 'neapolitan', target: 7 };
  if (inMode(c, k, major ? 'minor' : 'major')) return { role: 'borrowed' };
  if (f === 'M' && (q === 'maj' || q === '7') && tonicizable(k, mod(s + 5))) return { role: 'secondary', target: mod(s + 5) };
  if (f === 'd' && tonicizable(k, mod(s + 1))) return { role: 'leading', target: mod(s + 1) };
  if (q === '7' && ((major && s === 5) || (!major && s === 8))) return { role: 'blues', target: major ? 0 : 7 };
  return { role: 'other' };
}
const PULL_ROLES: RoleName[] = ['secondary', 'leading', 'tonic7', 'tritone', 'neapolitan'];

export interface EngineLaneInfo { lane: EngineLane; reason: string | null; role: RoleName }
// lane (T / PD / D) with the reason used for tags; `next` is the chord that follows (loops wrap).
// opts.blues: in a blues, I7 is home (T).
export function laneInfo(chord: string | EChord, key: EngineKeyInput | EKey, next?: string | EChord | null, opts: { blues?: boolean } = {}): EngineLaneInfo {
  const c = parse(chord), k = keyInfo(key), s = semisOf(c, k), f = fam(c);
  const nx = next ? parse(next) : null;
  const ns = nx ? semisOf(nx, k) : null;
  const r = roleOf(c, k);
  const out = (lane: EngineLane, reason: string | null = null): EngineLaneInfo => ({ lane, reason, role: r.role });
  const lead = () => 'Leads to ' + triadAt(k, r.target!).symbol;
  switch (r.role) {
    case 'tonic7':
      if (opts.blues) return out('T');
      return ns === 5 ? out('D', lead()) : out('T');
    case 'picardy': return ns === 5 && nx && fam(nx) === 'm' ? out('D', lead()) : out('T');
    case 'dorian4': return ns === 10 ? out('D', lead()) : out('PD', 'From ' + parallelLabel(k));
    case 'diatonic': {
      if (k.mode === 'major') return out(({ 0: 'T', 4: 'T', 9: 'T', 2: 'PD', 5: 'PD', 7: 'D', 11: 'D' } as Record<number, EngineLane>)[s]);
      if (s === 10 || (s === 7 && f === 'm')) return out(ns === 0 || ns === 3 ? 'D' : 'PD');
      return out(({ 0: 'T', 3: 'T', 2: 'PD', 5: 'PD', 8: 'PD', 7: 'D', 11: 'D' } as Record<number, EngineLane>)[s]);
    }
    case 'tritone': return out('D', 'Tritone sub');
    case 'neapolitan': return out('PD', 'Neapolitan');
    case 'borrowed': {
      const from = 'From ' + parallelLabel(k);
      if (k.mode === 'major') {
        if (s === 10) return ns === 0 ? out('D', c.quality === '7' ? 'Backdoor' : from) : out('PD', from);
        if (s === 7) return out(ns === 0 && nx!.quality !== '7' ? 'D' : 'PD', from); // v before I7 is the ii of a ii–V into IV
        if (s === 11) return out('D', from);
        return out(s === 0 || s === 3 ? 'T' : 'PD', from);
      }
      return out(s === 11 ? 'D' : s === 4 ? 'T' : 'PD', from);
    }
    case 'secondary':
      // a secondary-dominant triad that falls straight back to I is colour, not a pull (the Lydian II)
      if (isTriad(c.quality) && c.quality !== 'aug' && ns === 0) return out('PD');
      return out('D', lead());
    case 'leading': return out('D', lead());
    case 'blues': return out('PD');
    default: return out(s === 0 ? 'T' : c.quality === '7' ? 'D' : 'PD');
  }
}
const lane = (chord: string | EChord, key: EngineKeyInput | EKey, next?: string | EChord | null, opts?: { blues?: boolean }) => laneInfo(chord, key, next, opts).lane;

type Expect = [number, number, Fam];
// where a chord tends to go: [[semitones above tonic, strength, family of the chord it resolves to]]
function expectations(c: EChord, k: EKey): Expect[] {
  const s = semisOf(c, k), f = fam(c), r = roleOf(c, k);
  const tf: Fam = k.mode === 'major' ? 'M' : 'm';
  const famAt = (t: number) => fam(triadAt(k, t));
  switch (r.role) {
    case 'secondary': case 'leading':
      // I+ also slides up into vi (G# to A), the other common way out of the augmented tonic
      if (k.mode === 'major' && s === 0 && c.quality === 'aug') return [[5, 1.4, 'M'], [9, 0.6, 'm']];
      return [[r.target!, 1.4, famAt(r.target!)]];
    case 'tritone': return [[0, 1.4, tf]];
    case 'tonic7': return k.mode === 'major' ? [[5, 1.0, 'M'], [5, 0.7, 'm']] : [[5, 1.0, 'M']];
    case 'neapolitan': return [[7, 1.0, 'M']];
    case 'blues': return k.mode === 'major' ? [[0, 0.6, 'M'], [7, 0.3, 'M']] : [[7, 0.9, 'M']];
    case 'dorian4': return [[0, 0.6, 'm'], [10, 0.5, 'M']];
    case 'picardy': return [[5, 0.4, 'm']];
    default: break;
  }
  if (k.mode === 'major') {
    if (r.role === 'borrowed') {
      return ({
        0: [[5, 0.3, 'M'], [7, 0.3, 'M']], 2: [[7, 0.8, 'M']], 3: [[5, 0.6, 'M'], [8, 0.4, 'M']],
        5: [[0, 0.9, 'M'], [7, 0.5, 'M'], [10, 0.5, 'M']], 7: [[0, 0.5, 'M']], 8: [[10, 0.8, 'M'], [7, 0.6, 'M'], [5, 0.3, 'm']],
        10: [[0, 1.0, 'M'], [5, 0.5, 'M'], [8, 0.4, 'M']], 11: [[0, 1.2, 'M']],
      } as Record<number, Expect[]>)[s] || [];
    }
    return ({
      2: [[7, 0.8, 'M'], [11, 0.3, 'd']], 4: [[9, 0.4, 'm'], [5, 0.3, 'M']], 5: [[7, 0.5, 'M'], [0, 0.4, 'M'], [2, 0.2, 'm']],
      7: [[0, 1.4, 'M']], 9: [[2, 0.4, 'm'], [5, 0.4, 'M']], 11: [[0, 1.2, 'M']],
    } as Record<number, Expect[]>)[s] || [];
  }
  if (r.role === 'borrowed') return ({ 2: [[7, 0.8, 'M']], 4: [[9, 0.4, 'm']], 9: [[2, 0.4, 'm']] } as Record<number, Expect[]>)[s] || [];
  if (s === 7 && f === 'M') return [[0, 1.4, 'm']];
  if (s === 11) return [[0, 1.2, 'm']];
  return ({
    2: [[7, 0.8, 'M']], 3: [[8, 0.3, 'M'], [5, 0.3, 'm'], [10, 0.2, 'M']],
    5: [[7, 0.7, 'M'], [7, 0.4, 'm'], [0, 0.4, 'm'], [10, 0.3, 'M'], [1, 0.3, 'M']], 7: [[0, 0.5, 'm'], [8, 0.3, 'M']],
    8: [[10, 0.5, 'M'], [7, 0.5, 'M'], [5, 0.3, 'm'], [1, 0.3, 'M']], 10: [[0, 0.7, 'm'], [3, 0.6, 'M'], [8, 0.4, 'M']],
  } as Record<number, Expect[]>)[s] || [];
}
// strength of the expected resolution a -> b (0 when b is not where a goes, or has the wrong quality)
function expectHit(a: EChord, b: EChord, k: EKey): number {
  const sb = semisOf(b, k), fb = fam(b);
  let best = 0;
  for (const [t, w, f] of expectations(a, k)) if (t === sb && f === fb && w > best) best = w;
  return best;
}
const isDominantOfTonic = (c: EChord, k: EKey) => { const s = semisOf(c, k), f = fam(c); return (s === 7 && f === 'M') || (s === 11 && f === 'd'); };
const isMajorV = (c: EChord, k: EKey) => semisOf(c, k) === 7 && fam(c) === 'M' && c.quality !== 'maj7';
function isDeceptive(a: EChord, b: EChord, k: EKey): boolean {
  if (!isMajorV(a, k)) return false;
  const s = semisOf(b, k), f = fam(b);
  return k.mode === 'major' ? (s === 9 && f === 'm') || (s === 8 && f === 'M') : s === 8 && f === 'M';
}
// a chord that closes onto `b` (the chord after the insert point): an expected resolution, plagal, or deceptive move
function leadsInto(a: EChord, b: EChord, k: EKey, blues?: boolean): boolean {
  if (expectHit(a, b, k) >= 0.7) return true;
  if (isTonicChord(b, k, blues) && semisOf(a, k) === 5 && fam(a) !== 'd') return true; // IV or iv to I
  if (mod(b.root - a.root) === 5 && diatonic(a, k) && diatonic(b, k) && fam(a) !== 'd') return true; // roots fall a fifth (vi to ii)
  return isDeceptive(a, b, k);
}

// ---------- tokens ----------
// A token is root + family (C, Cmaj7 and Cadd9 alike). A dominant seventh whose 7th changes the chord's job keeps
// its own token: I7 (V7 of IV), the blues IV7, bVII7 (backdoor), bII7 (tritone sub) and the minor key's I7, III7
// and VI7. Secondary dominants (A and A7 as V of ii) share a token. In blues style only bII7 keeps the mark.
function tok(c: EChord, k: EKey, blues?: boolean): string {
  const s = semisOf(c, k);
  let t = s + fam(c);
  if (c.quality === '7' && !diatonic(c, k)) {
    const major = k.mode === 'major';
    const marked = s === 0 || s === 1 || (major && (s === 5 || s === 10)) || (!major && (s === 3 || s === 8));
    if (marked && !(blues && s !== 1)) t += '7';
  }
  return t;
}

// ---------- scoring helpers ----------
export type StyleName = 'triads' | 'sevenths' | 'ninths' | 'add9';
interface Style { sevenths: boolean; blues: boolean; kind: 'blues' | 'jazz' | 'triad'; colour: ColourSet | null; style: StyleName }
const LANE_T: Record<EngineLane, Record<EngineLane, number>> = { T: { T: 0.25, PD: 0.8, D: 0.7 }, PD: { T: 0.4, PD: 0.3, D: 0.9 }, D: { T: 0.3, PD: -0.5, D: 0.1 } };
// root motion, by semitones up: down a fifth (5) strongest
const ROOT_M = [0, 0.05, 0.1, 0.1, 0.1, 0.25, -0.3, 0.15, 0.1, 0.15, 0.1, 0.05];

function moveScore(a: EChord, b: EChord, k: EKey, bNext: EChord | null | undefined, st: Partial<Style> = {}): number {
  if (sameChord(a, b)) return -1;
  const lo = { blues: st.blues };
  const ra = roleOf(a, k);
  // outside a blues, I7 is V7 of IV wherever it goes: moving anywhere but IV leaves a dominant hanging
  const la = ra.role === 'tonic7' && !st.blues ? 'D' : lane(a, k, b, lo), lb = lane(b, k, bNext, lo);
  let s = LANE_T[la][lb];
  if (st.kind === 'jazz' && la === 'D' && lb === 'PD') s = -1.0; // after a ii–V, V7 to IVmaj7 is a wrong turn
  const hit = expectHit(a, b, k);
  const dec = isDeceptive(a, b, k);
  if (hit >= 0.7 || dec) s = Math.max(s, 0.5);
  s += hit;
  if (dec) s += 0.7;
  // a chord that pulls to another root does not resolve to its own root in another quality (A7 to Am)
  if (a.root === b.root && fam(a) !== fam(b) && ra.target != null && PULL_ROLES.includes(ra.role) && hit === 0) s = Math.min(s, -0.3);
  return s + ROOT_M[mod(b.root - a.root)];
}

// nearest-note pairing (pitch classes), each move taken in -6..+6; every target tone used
const mv = (a: number, b: number) => { let d = mod(b - a); if (d > 6) d -= 12; return d; };
function voiceLead(a: EChord, b: EChord): { cost: number; common: number[] } {
  const A = tones(a).map((t) => t.pc), B = tones(b).map((t) => t.pc);
  let best: { cost: number; sq: number; map: number[] } | null = null;
  const tryMap = (map: number[]) => {
    let cost = 0, sq = 0;
    for (let i = 0; i < A.length; i++) { const d = mv(A[i], B[map[i]]); cost += Math.abs(d); sq += d * d; }
    if (!best || cost < best.cost || (cost === best.cost && sq < best.sq)) best = { cost, sq, map: map.slice() };
  };
  const rec = (i: number, map: number[], used: Set<number>) => {
    if (i === A.length) {
      if (A.length >= B.length ? used.size === B.length : true) tryMap(map);
      return;
    }
    for (let j = 0; j < B.length; j++) {
      if (A.length < B.length && used.has(j)) continue;
      map.push(j); const had = used.has(j); used.add(j);
      rec(i + 1, map, used);
      map.pop(); if (!had) used.delete(j);
    }
  };
  rec(0, [], new Set());
  const common = A.filter((p) => B.includes(p));
  return { cost: best!.cost + Math.max(0, B.length - A.length), common };
}

function collapse<T>(list: T[], eq: (a: T, b: T) => boolean): T[] {
  const out: T[] = [];
  for (const x of list) if (!out.length || !eq(out[out.length - 1], x)) out.push(x);
  return out;
}

// 7th style: half the chords are 7ths and at least one is not a plain dominant 7th (V7 and secondary dominants live
// happily among triads). Blues: I7 and IV7 both, or dominant 7ths on I, IV and V make up at least half the chords.
// Colour styles: 9ths when at least half the chords carry 9ths-style colours (maj9, m9, 13, 6/9...), add9 when at least
// half carry open colours (add9, sus2...). opts.style ('triads', 'sevenths', 'ninths', 'add9') or the older
// opts.sevenths overrides the automatic choice; a blues is always detected.
export const STYLES: StyleName[] = ['triads', 'sevenths', 'ninths', 'add9'];
function styleOf(P: EChord[], k: EKey, opts: { sevenths?: boolean | null; style?: StyleName | null } = {}): Style {
  const sev = P.filter((c) => !isTriad(c.quality)).length;
  const dom = P.filter((c) => c.quality === '7');
  const major = k.mode === 'major';
  const on = (s: number) => dom.some((c) => semisOf(c, k) === s);
  const prim = dom.filter((c) => [0, 5, 7].includes(semisOf(c, k))).length;
  const blues = major && ((on(0) && on(5)) || ((on(0) || on(5)) && prim >= 2 && prim * 2 >= P.length));
  const set = (x: ColourSet) => P.filter((c) => c.colour && colourOf(c.colour)!.set === x).length;
  const ext = set('ext'), open = set('open');
  let style: StyleName | null = opts.style && STYLES.includes(opts.style) ? opts.style : opts.sevenths != null ? (opts.sevenths ? 'sevenths' : 'triads') : null;
  if (!style) {
    if (ext * 2 >= P.length || open * 2 >= P.length) style = ext > open ? 'ninths' : 'add9'; // a tie reads as add9 (Am(add9) Fmaj7#11)
    else style = sev / P.length >= 0.5 && sev > dom.length ? 'sevenths' : 'triads';
  }
  const sevenths = style === 'sevenths' || style === 'ninths' || blues;
  const colour: ColourSet | null = style === 'ninths' ? 'ext' : style === 'add9' ? 'open' : null;
  return { sevenths, blues, kind: blues ? 'blues' : sevenths ? 'jazz' : 'triad', colour, style: blues && !colour ? 'sevenths' : style };
}

// ---------- library index ----------
interface SeqItem { ch: EChord; tok: string; num: string; i: number; span: number[] }
interface Core { ordered?: boolean; any?: number; pos?: number[] }
interface IndexEntry {
  E: LibraryEntry;
  same: boolean;
  w: number;
  cyclic: boolean;
  seq: SeqItem[];
  frame: EKey;
  core: Core;
  style: Style;
  hasPicardy: boolean;
}
const OTHER_W = 0.35; // weight of an entry from the other mode, realized on the relative key (support only, never named)
const idxCache = new Map<string, IndexEntry[]>();
function libIndex(k: EKey, blues?: boolean): IndexEntry[] {
  const id = k.id + (blues ? ' blues' : '');
  if (idxCache.has(id)) return idxCache.get(id)!;
  const out: IndexEntry[] = [];
  for (const E of LIBRARY) {
    const same = E.mode === k.mode;
    const frame = same ? k : relative(k);
    const cyclic = E.kind !== 'cadence';
    const raw = E.numerals.map((num, i) => {
      const ch = realize(num, frame);
      return { ch, tok: tok(ch, k, blues), num: same ? num : numeral(ch, k), i };
    });
    if (!same) {
      // other mode: the same chords around another centre. Admit it only when every chord is diatonic here or is the
      // relative minor's harmonic V or vii° (Am G F E in C major).
      const relHarm = (c: EChord) => k.mode === 'major' && ((semisOf(c, frame) === 7 && fam(c) === 'M') || semisOf(c, frame) === 11);
      if (!raw.every((x) => diatonic(x.ch, k) || relHarm(x.ch))) continue;
    }
    const seq: SeqItem[] = [];
    for (const x of raw) {
      const last = seq[seq.length - 1];
      if (last && last.tok === x.tok) last.span.push(x.i);
      else seq.push({ ...x, span: [x.i] });
    }
    while (cyclic && seq.length > 1 && seq[0].tok === seq[seq.length - 1].tok) seq[0].span.push(...seq.pop()!.span);
    const L = seq.length;
    // core: the chords that must be visible before the entry's name may be shown
    let core: Core;
    if (E.core) core = { ordered: true, pos: seq.map((x, p) => (x.span.some((i) => i >= E.core![0] && i <= E.core![1]) ? p : -1)).filter((p) => p >= 0) };
    else if (cyclic && L >= 5) core = { any: 4 };
    else core = { pos: seq.map((_x, p) => p) };
    const style = styleOf(raw.map((x) => x.ch), frame);
    out.push({ E, same, w: same ? 1 : OTHER_W, cyclic, seq, frame, core, style, hasPicardy: raw.some((x) => roleOf(x.ch, k).role === 'picardy') });
  }
  // an other-mode loop that is a rotation of a same-mode loop adds nothing (i–VI–III–VII is I–V–vi–IV from vi)
  const cyc = (e: IndexEntry) => e.seq.map((x) => x.tok);
  const rot = (a: string[], b: string[]) => a.length === b.length && (a.join(' ') + ' ' + a.join(' ')).includes(b.join(' '));
  const keep = out.filter((e) => e.same || !e.cyclic || !out.some((s) => s.same && s.cyclic && rot(cyc(s), cyc(e))));
  idxCache.set(id, keep);
  return keep;
}

// n-gram support: library entries where the last k chords are followed by t (k = 1..3; loops wrap). Blues forms
// speak only to blues players (their I7 is a tonic, not V of IV).
interface Src { ent: IndexEntry; w: number; ch: EChord; num: string; j: number; kk: number }
interface Ngram {
  cnt: (Map<string, number> | null)[];
  src: (Map<string, Src[]> | null)[];
  tot: number[];
  sample: Map<string, { ch: EChord; num: string; w: number; same: boolean }>;
  K: number;
}
// st (the player's style) tempers the new genres for plain triad players: an entry written in colours, or a Post-rock or
// Bossa nova entry, counts half; a Jazz, Bossa nova or Post-rock vamp (a texture, not a chord-to-chord habit) counts only
// for players in its own style
const STYLED_GENRES = ['Jazz', 'Bossa nova', 'Post-rock'];
function ngram(ctx: string[], idx: IndexEntry[], sameOnly: boolean, bluesUser = sameOnly, st: Style | null = null, fa: Affinity | null = null): Ngram {
  const cnt: (Map<string, number> | null)[] = [null, new Map(), new Map(), new Map()];
  const src: (Map<string, Src[]> | null)[] = [null, new Map(), new Map(), new Map()];
  const sample: Ngram['sample'] = new Map();
  const K = Math.min(3, ctx.length);
  for (const ent of idx) {
    if (sameOnly && !ent.same) continue;
    if (ent.style.blues && !bluesUser) continue;
    if (ent.E.variantOf) continue; // a colour variant repeats its entry's harmony: no extra support
    if (st && ent.E.kind === 'vamp' && STYLED_GENRES.includes(ent.E.genre) && (ent.style.kind !== st.kind || (ent.style.colour && ent.style.colour !== st.colour))) continue;
    const plainHalf = st && st.kind === 'triad' && !st.colour && (ent.style.colour || ['Post-rock', 'Bossa nova'].includes(ent.E.genre));
    const w = ent.w * (plainHalf ? 0.5 : 1) * (fa && ent.same ? 1 + 0.5 * fa.rel(ent.E) : 1); // your genre's habits count more
    const S = ent.seq, L = S.length;
    for (let j = 0; j < L; j++) {
      for (let kk = 1; kk <= K; kk++) {
        if (ent.cyclic ? kk >= L : j - kk < 0) break;
        if (!ent.same && kk > 2) break; // another centre's 3-chord habit says little about this key
        if (S[mod(j - kk, L)].tok !== ctx[ctx.length - kk]) break;
        const t = S[j].tok;
        cnt[kk]!.set(t, (cnt[kk]!.get(t) || 0) + w);
        if (!src[kk]!.has(t)) src[kk]!.set(t, []);
        src[kk]!.get(t)!.push({ ent, w, ch: S[j].ch, num: S[j].num, j, kk });
        if (!sample.has(t) || w > sample.get(t)!.w) sample.set(t, { ch: S[j].ch, num: S[j].num, w, same: ent.same });
      }
    }
  }
  const tot = cnt.map((m) => (m ? [...m.values()].reduce((a, b) => a + b, 0) : 0));
  return { cnt, src, tot, sample, K };
}
const NG_W = [0, 2.0, 2.5, 3.0];
const NG_B = [0, 0.4, 0.5, 0.8];
// each context length adds weight × share + bonus, scaled by the strongest supporting entry's weight
// (an other-mode entry alone gives 0.35 of the support a same-mode entry gives)
function ngramScore(t: string, ng: Ngram): { s: number; best: number; srcs: Src[] } {
  let s = 0, best = 0;
  for (let kk = 1; kk <= ng.K; kk++) {
    const c = ng.cnt[kk]!.get(t) || 0;
    if (!c) continue;
    const maxW = Math.max(...ng.src[kk]!.get(t)!.map((x) => x.w));
    s += (NG_W[kk] * (c / ng.tot[kk]) + NG_B[kk]) * maxW;
    best = kk;
  }
  return { s, best, srcs: best ? ng.src[best]!.get(t)! : [] };
}

const POOLS: Record<'major' | 'minor', Record<string, string[]>> = {
  major: {
    tri: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
    sev: ['Imaj7', 'ii7', 'iii7', 'IVmaj7', 'V7', 'vi7', 'viiø7'],
    blues: ['I7', 'ii7', 'IV7', 'V7'],
    spiceTri: ['VI7', 'III7', 'II7', 'VII7', 'I7', 'iv', 'bVII', 'bVI', 'bIII', 'bII7', '#iv°7', '#i°7', '#v°7'],
    spiceSev: ['VI7', 'III7', 'II7', 'VII7', 'I7', 'iv7', 'bVII7', 'bVImaj7', 'bIIImaj7', 'bII7', 'iiø7', '#iv°7', '#i°7', '#v°7'],
    spiceBlues: ['VI7', 'III7', 'II7', 'VII7', 'iv7', 'bVII7', 'bVI7', 'bII7', '#iv°7', '#i°7', '#v°7'],
  },
  minor: {
    tri: ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII', 'V'],
    sev: ['i7', 'iiø7', 'IIImaj7', 'iv7', 'v7', 'VImaj7', 'VII7', 'V7'],
    spiceTri: ['V7', 'IV', 'bII', 'I', 'vii°7', 'II7', 'III7', 'I7', 'bII7', '#iv°7'],
    spiceSev: ['V7', 'IV7', 'bII', 'I', 'vii°7', 'II7', 'III7', 'I7', 'bII7', '#iv°7'],
  },
};

const posWeight = (newLen: number) => (newLen % 8 === 0 ? 1 : newLen % 4 === 0 ? 0.9 : newLen % 2 === 0 ? 0.3 : 0.15);
// how well chord c moves into the chord that follows it (the first chord, when the loop wraps)
function closeScore(c: EChord, F: EChord, k: EKey, phraseEnd: boolean, after: EChord | null | undefined, st: Partial<Style> = {}): number {
  if (sameRF(c, F)) return phraseEnd && isTonicChord(F, k, st.blues) ? 0.4 : -0.6;
  return Math.max(-1, Math.min(2.5, moveScore(c, F, k, after, st)));
}

// play a library chord in the player's style. Only chords of the key change: triad players get triads, 7th players
// the key's diatonic 7ths, blues players dominant 7ths on I, IV and V. Chromatic 7ths (I7, VI7, bII7...) stay as
// written, because they are what makes the entry that entry. Borrowed triads become their 7ths in 7th style.
// The key's own and borrowed chords lose their written colour first, and so does any chord whose colour belongs to a style
// the player is not in (A7b9 is A7 to a 7ths player); the colour styles then add theirs (colourize).
function dressTo(c: EChord, st: Style, k: EKey): EChord {
  if (c.colour && (diatonic(c, k) || roleOf(c, k).role === 'borrowed' || colourOf(c.colour)!.set !== st.colour)) c = plain(c);
  const d = dressBase(c, st, k);
  return st.colour ? colourize(d, st, k) : d;
}
function dressBase(c: EChord, st: Style, k: EKey): EChord {
  const s = semisOf(c, k), r = roleOf(c, k).role;
  const major = k.mode === 'major';
  if (st.blues && major && [0, 5, 7].includes(s) && fam(c) === 'M' && (diatonic(c, k) || r === 'tonic7' || r === 'blues')) return requality(c, '7');
  if (st.blues && major && r === 'borrowed' && s === 8) return requality(c, '7'); // bVI7 in a blues
  if (diatonic(c, k)) {
    if (st.sevenths && isTriad(c.quality)) {
      if (!major && s === 7 && fam(c) === 'M') return requality(c, '7');
      if (!major && s === 11) return requality(c, 'dim7');
      return requality(c, DIA[k.mode][s][1]);
    }
    // keep m7b5: the half-diminished shape is what a guitarist plays for ii° or vii°
    if (!st.sevenths && (c.quality === 'maj7' || c.quality === 'm7')) return requality(c, TRIAD_OF[fam(c)]);
    return c;
  }
  if (r === 'borrowed' && isTriad(c.quality) && st.sevenths) {
    const other = DIA[major ? 'minor' : 'major'][s];
    if (other && other[0] === fam(c)) return requality(c, other[1]);
  }
  if (r === 'borrowed' && !st.sevenths && (c.quality === 'maj7' || c.quality === 'm7')) return requality(c, TRIAD_OF[fam(c)]);
  return c;
}

// the scale a chord's added notes come from: a pull chord's target key (A7 to Dm takes D minor's Bb, so A7b9), the
// parallel mode for a borrowed chord, else the key itself
function colourScale(c: EChord, k: EKey): Set<number> {
  const r = roleOf(c, k);
  const pcs = (t: number, mode: 'major' | 'minor') => new Set(SCALE[mode].map((x) => mod(t + x)));
  if (['secondary', 'tonic7'].includes(r.role) && r.target != null) {
    const T = triadAt(k, r.target);
    return pcs(T.root, fam(T) === 'm' ? 'minor' : 'major');
  }
  const dorian = new Set([...pcs(k.tonic, 'minor')].map((p) => (p === mod(k.tonic + 8) ? mod(k.tonic + 9) : p)));
  // the Dorian IV, and a minor key's borrowed chord that fits Dorian (Bm7 in A minor stays Bm7, not Bm9 with C#)
  if (r.role === 'dorian4' || (r.role === 'borrowed' && k.mode === 'minor' && tones(c).every((t) => dorian.has(t.pc)))) return dorian;
  const onBorrowed = r.role === 'other' && c.quality === '7' && roleOf(requality(c, 'maj'), k).role === 'borrowed'; // bVI7 in a blues
  if (r.role === 'borrowed' || r.role === 'picardy' || onBorrowed) return pcs(k.tonic, k.mode === 'major' ? 'minor' : 'major');
  return pcs(k.tonic, k.mode);
}
// a chord written without colour, in the colour of the player's style, using only notes of its scale:
// 9ths: maj7 to maj9 (or maj7#11), m7 to m9, 7 to 13, 9 or 7b9 (bII7 to 7#11); add9: major and minor triads add the 9th
export function colourize(c: EChord, st: Pick<Style, 'colour'>, key: EngineKeyInput | EKey): EChord {
  const k = keyInfo(key);
  if (c.colour) return c;
  const sc = colourScale(c, k), has = (iv: number) => sc.has(mod(c.root + iv));
  const as = (id: AnyQuality) => requality(c, id);
  const q = c.quality;
  if (st.colour === 'ext') {
    if (q === 'maj7') return has(2) ? as('maj9') : has(6) ? as('maj7#11') : c;
    if (q === 'm7') return has(2) ? as('m9') : c; // Em7 in C stays Em7: an m11 implies the 9th (F#)
    if (q === '7') {
      if (roleOf(c, k).role === 'tritone' && has(6)) return as('7#11');
      if (has(2)) return has(9) ? as('13') : as('9');
      return has(1) ? as('7b9') : c;
    }
    return c;
  }
  if (st.colour === 'open') {
    if ((q === 'maj' || q === 'm') && has(2)) return as(q === 'maj' ? 'add9' : 'madd9');
    return c;
  }
  return c;
}

// ---------- shared phrase helpers (then lines) ----------
// how many chords of the user's collapsed context Pc (ending just before position j) the entry also has there
function backMatch(ent: IndexEntry, j: number, Pc: EChord[], k: EKey, blues: boolean, limit: number): number {
  const S = ent.seq, L = S.length;
  let m = 0;
  while (m < Pc.length && m < limit) {
    const p = j - 1 - m;
    if (!ent.cyclic && p < 0) break;
    if (S[mod(p, L)].tok !== tok(Pc[Pc.length - 1 - m], k, blues)) break;
    m++;
  }
  return m;
}
// is the window of entry positions from..to (may wrap for loops) enough to name the entry? An explicit core (a
// sequence such as the Monte) must appear in its own order: D7 G C7 F is not a Monte, it runs the other way.
function coversCore(ent: Pick<IndexEntry, 'seq' | 'core' | 'cyclic'>, from: number, to: number): boolean {
  const L = ent.seq.length, len = to - from + 1;
  if (ent.core.any) return len >= ent.core.any;
  if (ent.core.ordered) {
    const P = ent.core.pos!;
    for (let q = from; q + P.length - 1 <= to; q++) if ((ent.cyclic ? mod(q, L) : q) === P[0]) return true;
    return false;
  }
  if (ent.cyclic && len >= L) return true;
  const seen = new Set<number>();
  for (let q = from; q <= to; q++) seen.add(ent.cyclic ? mod(q, L) : q);
  return ent.core.pos!.every((p) => seen.has(p));
}
// does seq (idea plus phrase) replay a stretch of the user's loop? ii and IV count as the same, 7ths are ignored
function replays(seq: EChord[], all: EChord[], k: EKey): boolean {
  if (seq.length < 2) return false;
  const key = (c: EChord) => { const s = semisOf(c, k); return (k.mode === 'major' && (s === 2 || s === 5) && fam(c) !== 'd' ? 'pd' : s) + fam(c); };
  const A = all.map(key), B = seq.map(key), L = A.length;
  if (B.length > L) return false;
  for (let i = 0; i < L; i++) if (B.every((b, j) => A[(i + j) % L] === b)) return true;
  return false;
}
// entries a player of this style may be offered (blues forms only to blues players; jazz subs only with 7ths)
// genres whose loops sit naturally in a blues (dominant-7th colour); other genres reach a blues player only as cadences
const BLUES_FRIENDLY = ['Blues', 'Funk', 'Rock', 'Jazz', 'Swing', 'Ragtime', 'Gospel', 'Soul', 'Country'];
function styleGate(ent: IndexEntry, st: Style): boolean {
  if (ent.style.blues && !st.blues) return false;
  if (st.blues && ent.E.kind !== 'cadence' && !BLUES_FRIENDLY.includes(ent.E.genre)) return false;
  const subs = ent.seq.some((x) => x.tok === '1M7');
  if (subs && !st.sevenths) return false;
  return true;
}
function styleFit(ent: IndexEntry, st: Style): number {
  const ek = ent.style.kind;
  // a plain triad player hears the plain classics first: an entry written in add9 or 9ths colours pays 0.4
  const plainPays = st.kind === 'triad' && !st.colour && ent.style.colour ? 0.4 : 0;
  if (ek === st.kind) return 0.3 + (st.colour && ent.style.colour === st.colour ? 0.2 : 0) - plainPays; // a 9ths player hears the jazz entry first
  if (st.kind === 'blues') return ek === 'jazz' ? -0.2 : -0.3; // a blues player takes a jazz ii–V before a hymn cadence
  if (ek === 'blues') return -0.6;
  if (st.kind === 'triad' && ek === 'jazz') return -0.4 - plainPays;
  return -0.1 - plainPays;
}
const phraseOut = (E: LibraryEntry) => ({ id: E.id, name: E.name, genre: E.genre, mood: E.mood });
// a name written in numerals reads in order, so the chips must start where the name starts
const NUMERAL_NAME = /^[b#]?[IViv]+[°ø7+]*(–[b#]?[IViv]+[°ø7+]*)+$/;
// so does a numeral chain with a word before or after it (Lydian I–vii7 vamp, IV–V–vi climb), unless a core says which
// chords the name means
const CHAIN_NAME = /^(?:[A-Z][a-z]+ )?[b#]?[IViv]+[^\s–]*(?:–[b#]?[IViv]+[^\s–]*)+(?:\s|$)/;
const numName = (E: LibraryEntry) => NUMERAL_NAME.test(E.name) || (!E.core && CHAIN_NAME.test(E.name));
const nameFits = (ent: IndexEntry, from: number) => !numName(ent.E) || mod(from, ent.seq.length) === 0;
// the chord a pull chord must move to first: its target, or a dominant on the target's root (E7 to A7 in a chain)
function pullOk(y: EChord, c: EChord, k: EKey): boolean {
  const r = roleOf(y, k);
  let ok: [number, Fam][] = [];
  if (PULL_ROLES.includes(r.role)) ok = [[r.role === 'neapolitan' ? 7 : r.target!, r.role === 'tritone' ? fam(triadAt(k, 0)) : r.role === 'neapolitan' ? 'M' : fam(triadAt(k, r.target!))]];
  if (r.role === 'leading' && y.quality === 'dim7' && semisOf(y, k) === 6 && k.mode === 'major') ok.push([0, 'M']); // #iv°7 to I over its fifth
  if (k.mode === 'major' && semisOf(y, k) === 10 && y.quality === '7') ok = [[0, 'M']]; // backdoor bVII7
  if (!ok.length) return true;
  const sc = semisOf(c, k), rc = roleOf(c, k).role;
  return ok.some(([t, f]) => sc === t && (fam(c) === f || (r.role !== 'neapolitan' && ['secondary', 'tonic7'].includes(rc))));
}

// ---------- genre families ----------
// How strongly the progression reads as each Start with family. Evidence: the share of your latest chords (up to 4, at
// least 2) that a same-mode entry of the family plays in the same order, +0.25 when the entry is written in your colour
// style. Prior: the colour style's own leaning (add9 and sus: post-rock; 9ths: jazz and bossa nova; 7ths: jazz; a blues:
// blues and rock). A family's affinity is the larger of the two, 0 to 1.25.
const FAMILY_NEAR: Record<string, Record<string, number>> = {
  'Post-rock and cinematic': { 'Ballad and pop': 0.25, 'Blues and rock': 0.3, 'Classical and folk': 0.2 },
  'Jazz and soul': { 'Bossa nova': 0.8, 'Ballad and pop': 0.2, 'Blues and rock': 0.2 },
  'Bossa nova': { 'Jazz and soul': 0.8, 'Ballad and pop': 0.2 },
  'Blues and rock': { 'Ballad and pop': 0.4, 'Classical and folk': 0.35, 'Post-rock and cinematic': 0.3, 'Jazz and soul': 0.2 },
  'Ballad and pop': { 'Blues and rock': 0.4, 'Classical and folk': 0.3, 'Post-rock and cinematic': 0.3, 'Jazz and soul': 0.2 },
  'Classical and folk': { 'Ballad and pop': 0.3, 'Blues and rock': 0.2, 'Flamenco': 0.2 },
  'Flamenco': { 'Classical and folk': 0.3, 'Blues and rock': 0.2 },
};
const familyOf = (E: LibraryEntry) => (FAMILIES.find((f) => f.genres.includes(E.genre)) || { name: '' }).name;
interface Affinity {
  aff: Record<string, number>;
  top: number;
  /** How near the entry's family is to the progression's genre. */
  rel: (E: LibraryEntry) => number;
  /** The same, counting only the families that lead the read. */
  lead: (E: LibraryEntry) => number;
}
function familyAffinity(Pc: EChord[], k: EKey, st: Style, idx: IndexEntry[]): Affinity {
  const aff: Record<string, number> = {};
  for (const f of FAMILIES) aff[f.name] = 0;
  if (st.colour === 'open') aff['Post-rock and cinematic'] = 0.6;
  if (st.colour === 'ext') { aff['Jazz and soul'] = 0.5; aff['Bossa nova'] = 0.5; }
  if (st.kind === 'jazz' && !st.colour) { aff['Jazz and soul'] = 0.3; aff['Bossa nova'] = 0.2; }
  if (st.blues) aff['Blues and rock'] = 0.6;
  const want = Math.min(4, Pc.length);
  if (want >= 2) {
    for (const ent of idx) {
      if (!ent.same) continue;
      const L = ent.seq.length;
      let best = 0;
      for (let j = 0; j < (ent.cyclic ? L : L + 1); j++) best = Math.max(best, backMatch(ent, j, Pc, k, st.blues, Math.min(4, ent.cyclic ? L : j)));
      if (best < 2) continue; // one shared chord says nothing about genre
      // +0.25 when the entry is written in your colour style, or when your chords are the whole entry in its own style
      // (a Start with pick)
      const whole = best === Pc.length && best === ent.seq.length && ent.style.kind === st.kind && (ent.style.colour || null) === (st.colour || null);
      const e = Math.min(1.25, best / want + (ent.style.colour && ent.style.colour === st.colour ? 0.25 : 0) + (whole ? 0.25 : 0));
      const f = familyOf(ent.E);
      if (e > aff[f]) aff[f] = e;
    }
  }
  const top = Math.max(...Object.values(aff));
  // rel: how near the entry's family is to your genre. lead: the same, counting only the families that lead the read
  // (less than AFF_LEAD under the strongest), so a weak second reading does not let its whole neighbourhood back in
  const near = (E: LibraryEntry, only: boolean) => {
    const f = familyOf(E);
    let v = 0;
    for (const g in aff) if (!only || aff[g] > top - AFF_LEAD) v = Math.max(v, aff[g] * (g === f ? 1 : FAMILY_NEAR[g]?.[f] || 0));
    return v;
  };
  return { aff, top, rel: (E) => near(E, false), lead: (E) => near(E, true) };
}
const AFF_W = 1.0, AFF_OFF = 0.5; // then lines: + AFF_W x the entry's family affinity - AFF_OFF x the strongest affinity
// when your chords read clearly as a genre with its own sound (an entry of it plays at least 0.8 of them, and no
// common-practice family leads with it), phrases from far-off families (relation under 0.3 of that read) are not
// offered at all. A pop or folk loop keeps every phrase: those families are the shared language
const AFF_CLEAR = 0.8, AFF_FAR = 0.3, AFF_LEAD = 0.25;
const COMMON_FAMILIES = ['Classical and folk', 'Ballad and pop'];
const distinctRead = (fa: Affinity) => fa.top >= AFF_CLEAR && COMMON_FAMILIES.every((g) => fa.aff[g] <= fa.top - AFF_LEAD);
const offGenre = (fa: Affinity, E: LibraryEntry) => distinctRead(fa) && fa.lead(E) < AFF_FAR * fa.top;
// then-line score: in a distinct read, + AFF_W x the entry's relation - AFF_OFF x the read; otherwise a light preference
const AFF_LIGHT = 0.2;
const famScore = (fa: Affinity, E: LibraryEntry) => (distinctRead(fa) ? AFF_W * fa.rel(E) - AFF_OFF * fa.top : AFF_LIGHT * fa.rel(E));
// post-rock and cinematic: dominant 7ths, diminished chords and chromatic pulls are foreign to the sound
const CINE = 'Post-rock and cinematic';
const cineRead = (fa: Affinity) => fa.aff[CINE] >= AFF_CLEAR && fa.aff[CINE] === fa.top && ['Jazz and soul', 'Bossa nova'].every((g) => fa.aff[g] <= fa.top - AFF_LEAD);
const CINE_PEN = 1.0, CINE_PULL = 1.5;

// ---------- then lines ----------
interface Ctx {
  k: EKey;
  all: EChord[];
  n: number;
  at: number;
  P: EChord[];
  X: EChord;
  follow: EChord;
  afterFollow: EChord;
  st: Style;
  Pc: EChord[];
  prev: EChord | null;
  newLen: number;
  open: boolean;
  P0: EChord;
  phraseEnd: boolean;
  posW: number;
  ng?: Ngram;
  /** How the progression reads as each Start with family. */
  fam?: Affinity;
}
interface ThenCand { ent: IndexEntry; j: number; m: number; t: number; ch: EChord[]; ret: boolean; home: boolean; sc: number }
// The classic phrase that continues from an idea chord: idea + then-chords is a library phrase picked up from the
// user's progression. Returns candidates, best first (see design.md, "Then lines").
function thenCandidates(ctx: Ctx, y: EChord): ThenCand[] {
  const { k, all, n, X, follow, Pc, st, open } = ctx;
  const b = st.blues;
  const ry = roleOf(y, k);
  if (ry.role === 'picardy') return [];                 // a final chord; the loop cancels it at once
  if (!open && sameRF(y, follow)) return [];            // the idea already lands on the next chord
  if (ry.target != null && PULL_ROLES.includes(ry.role) && ry.target === semisOf(X, k)) return [];
  // phrases are matched on exact tokens even in a blues (F7 is not the IV of a hymn cadence)
  const yt = tok(y, k);
  const out: ThenCand[] = [];
  for (const ent of libIndex(k)) {
    const E = ent.E;
    if (!ent.same || ent.hasPicardy || E.nameNeedsColours || !styleGate(ent, st)) continue;
    if (ctx.fam && offGenre(ctx.fam, E)) continue;     // a post-rock loop is not continued with a country phrase
    const canCont = E.uses.includes('continue'), canEnd = E.uses.includes('end');
    if (!canCont && !canEnd) continue;
    const S = ent.seq, L = S.length;
    for (let j = 0; j < L; j++) {
      if (S[j].tok !== yt) continue;
      let m = backMatch(ent, j, Pc, k, false, ent.cyclic ? L - 2 : j);
      // a numeral name reads from the entry's first chord: when your chords match back past it round the loop, start there
      if (ent.cyclic && numName(E) && j - m < 0) m = j;
      if (ent.style.colour && ent.style.colour !== st.colour && m < 1) continue; // another colour style: only where your chords are already in it
      for (let t = 1; t <= 3; t++) {
        if (ent.cyclic ? m + 1 + t > L : j + t > L - 1) break;
        const th: SeqItem[] = [];
        for (let q = 1; q <= t; q++) th.push(S[mod(j + q, L)]);
        let ch = th.map((x) => dressTo(x.ch, st, k));
        let to = j + t;
        // a loop that completes its cycle shows the chord it comes round to when that is the next chord anyway
        if (ent.cyclic && m + 1 + t === L && t < 3 && S[mod(j + t + 1, L)].tok === tok(follow, k)) { ch = [...ch, follow]; to++; }
        if (!pullOk(y, ch[0], k)) continue;              // the idea's pull decides the first then-chord
        const ret = sameRF(ch[ch.length - 1], follow) && tok(ch[ch.length - 1], k) === tok(follow, k);
        if (ret) ch = [...ch.slice(0, -1), follow];      // the return is the user's own chord, as played
        const last = ch[ch.length - 1];
        const home = isTonicChord(last, k, b) && (ctx.at === n || leadsInto(last, follow, k, b));
        const lead = !home && !ret && leadsInto(last, follow, k, b);
        if (!home && !ret && !lead) continue;
        const fresh = ret ? ch.slice(0, -1) : ch;
        if (!fresh.length) continue;                     // nothing to add but the chord that comes anyway
        if (!canCont && !(home || (ret && isTonicChord(last, k, b)))) continue; // closing entries must close on the tonic
        if (fam(last) === 'd' && !(last.quality === 'dim7' && lead)) continue;
        if (!coversCore(ent, j - m, to) || !nameFits(ent, j - m)) continue; // the name needs its defining chords on screen
        if (replays([y, ...fresh], all, k)) continue;
        const bars = n + 1 + fresh.length;
        const whole = coversCore({ ...ent, core: { pos: S.map((_x, p) => p) } }, j - m, to);
        const sc = 1.0 * Math.min(m, 3)
          + (ret && isTonicChord(last, k, b) ? 1.0 : home || ret ? 0.8 : 0.5)
          - 0.15 * fresh.length
          + (bars % 4 === 0 ? 0.2 : bars % 2 ? -0.1 : 0)
          + styleFit(ent, st)
          + (whole ? 0.3 : 0)
          + (ent.cyclic && mod(j - m, L) === 0 ? 0.2 : 0)
          - (sameChord(ch[0], X) && (!whole || !ent.cyclic) ? 0.4 : 0) // X, idea, X again: a neighbour, not a phrase
          + (ctx.fam ? famScore(ctx.fam, E) : 0); // the progression's own genre first
        out.push({ ent, j, m, t, ch, ret, home, sc });
      }
    }
  }
  out.sort((a, b2) => b2.sc - a.sc);
  // one candidate per chord sequence, named by the entry that best fits the player's style (bVI–bVII–I, not the
  // post-rock swell, for a plain player), then by score
  const key = (c: ThenCand) => c.ch.map((x) => x.symbol).join(' ');
  const pick = new Map<string, ThenCand>();
  for (const c of out) { const s = key(c), p = pick.get(s); if (!p || styleFit(c.ent, st) > styleFit(p.ent, st)) pick.set(s, c); }
  return out.filter((c) => pick.get(key(c)) === c);
}
const THEN_MIN = 0.6;

export interface EngineThen {
  id: string;
  name: string;
  genre: string;
  mood: string;
  chords: string[];
  numerals: string[];
  lanes: EngineLane[];
  /** The last chord is the progression's own next chord (the loop's return), as played. */
  returnsHome: boolean;
}
function thenOut(c: ThenCand, ctx: Ctx): EngineThen {
  const { k, follow, st } = ctx;
  return {
    ...phraseOut(c.ent.E),
    chords: c.ch.map((x) => x.symbol),
    numerals: c.ch.map((x) => numeral(x, k)),
    lanes: c.ch.map((x, i) => lane(x, k, c.ch[i + 1] || follow, { blues: st.blues })),
    returnsHome: c.ret,
  };
}
// choose then lines for a list of ideas: different names where possible, genres and moods spread
function assignThens(ideas: EChord[], ctx: Ctx): (EngineThen | null)[] {
  const used: { name: string[]; genre: string[]; mood: string[] } = { name: [], genre: [], mood: [] };
  return ideas.map((y) => {
    let best: ThenCand | null = null, bv = -Infinity;
    for (const c of thenCandidates(ctx, y)) {
      const E = c.ent.E;
      const near = !!ctx.fam && ctx.fam.rel(E) >= 0.6; // within your genre, more of the same genre is welcome
      const v = c.sc - (used.name.includes(E.name) ? 1.0 : 0) - (used.genre.includes(E.genre) ? (near ? 0.1 : 0.3) : 0) - (used.mood.includes(E.mood) ? (near ? 0.1 : 0.2) : 0);
      if (v > bv) { bv = v; best = c; }
    }
    if (!best || bv < THEN_MIN) return null;
    used.name.push(best.ent.E.name); used.genre.push(best.ent.E.genre); used.mood.push(best.ent.E.mood);
    return thenOut(best, ctx);
  });
}

// ---------- tags ----------
const CADENCE_TAGS = ['Authentic cadence', 'Plagal cadence', 'Minor plagal', 'Deceptive cadence', 'Half cadence', 'Picardy third', 'Andalusian cadence', 'Aeolian cadence', 'Backdoor'];
function tagFor(X: EChord, c: EChord, ctx: Ctx): string {
  const { k, prev, follow, newLen, P0, Pc, at, n, st } = ctx;
  const b = st.blues;
  const sx = semisOf(X, k), sc = semisOf(c, k), fx = fam(X), fc = fam(c);
  const minor = k.mode === 'minor';
  const tonic = isTonicChord(c, k, b);
  const rx = roleOf(X, k), r = roleOf(c, k);
  const last = (m: number) => Pc.slice(-m).map((x) => tok(x, k, b)).join(' ');
  if (prev && tonic && (isMajorV(X, k) || rx.role === 'tritone') && semisOf(prev, k) === 2 && fam(prev) !== 'M') return minor ? 'Completes ii–V–i' : 'Completes ii–V–I';
  if (prev && !tonic && fx === 'M' && mod(X.root - c.root) === 7 && mod(prev.root - c.root) === 2 && fam(prev) !== 'M' && expectHit(X, c, k) >= 1) return 'Completes ii–V';
  if (Pc.length >= 3 && fc === 'M') {
    if (minor && sc === 7 && last(3) === '0m 10M 8M') return 'Andalusian cadence';
    if (!minor && sc === 4 && last(3) === '9m 7M 5M') return 'Andalusian cadence';
  }
  if (isMajorV(X, k) && sc === 0) {
    if (minor && fc === 'M' && c.quality !== '7') return at === n ? 'Picardy third' : '';
    if (tonic) return 'Authentic cadence';
  }
  if (minor && sc === 0 && fc === 'M' && c.quality !== '7' && sx === 11 && fx === 'd') return at === n ? 'Picardy third' : '';
  if (tonic && sx === 5 && fx !== 'd' && rx.role !== 'dorian4') {
    if (!minor) return fx === 'M' ? 'Plagal cadence' : 'Minor plagal';
    return 'Plagal cadence';
  }
  if (isDeceptive(X, c, k)) return 'Deceptive cadence';
  const ivBefore = (ch: EChord | null) => !!ch && semisOf(ch, k) === 5 && fam(ch) === 'm';
  if (!minor && tonic && sx === 10 && fx === 'M' && (X.quality === '7' || ivBefore(prev))) return 'Backdoor';
  if (!minor && sc === 10 && fc === 'M' && semisOf(follow, k) === 0 && (c.quality === '7' || ivBefore(X))) return 'Backdoor';
  if (minor && tonic && Pc.length >= 2 && last(2) === '8M 10M') return 'Aeolian cadence';
  const li = laneInfo(c, k, follow, { blues: b });
  if (li.lane === 'D') {
    if (r.role === 'leading' && c.quality === 'dim7' && sc === 6 && !minor && isTonicChord(follow, k, b)) return 'Leads to ' + triadAt(k, 0).symbol;
    if (['secondary', 'leading', 'tonic7', 'picardy'].includes(r.role)) return 'Leads to ' + triadAt(k, r.target!).symbol;
    if (r.role === 'diatonic' && sc === 11 && fc === 'd') return 'Leads to ' + triadAt(k, 0).symbol;
  }
  if (li.reason && !/^Leads to/.test(li.reason)) return li.reason;
  const end = at === n && newLen % 4 === 0;
  if (end && sc === 7 && fc === 'M' && isTonicChord(P0, k, b)) return 'Half cadence';
  if (end && n >= 2 && sameRF(c, P0)) return 'Back to start';
  return '';
}

// ---------- afterIdeas ----------
export interface AfterOpts {
  spice?: boolean;
  /** Insert position (the add card); default: append. */
  at?: number;
  sevenths?: boolean | null;
  /** The player's style ('triads', 'sevenths', 'ninths', 'add9'); otherwise read from the chords. */
  style?: StyleName | null;
}
const LANE_WORD: Record<EngineLane, string> = { T: 'tonic', PD: 'predominant', D: 'dominant' };
function afterContext(progression: (string | EChord)[], key: EngineKeyInput, opts: AfterOpts): Ctx | null {
  const k = keyInfo(key);
  const all = (progression || []).map(parse);
  if (!all.length) return null;
  const n = all.length;
  const at = opts.at != null ? Math.max(1, Math.min(opts.at, n)) : n;
  const P = all.slice(0, at);
  const X = P[P.length - 1];
  const follow = at < n ? all[at] : all[0];
  const afterFollow = at < n ? all[at + 1] || all[0] : all[1 % n];
  const st = styleOf(all, k, opts);
  const Pc = collapse(P, (a, b) => tok(a, k, st.blues) === tok(b, k, st.blues));
  const prev = Pc.length > 1 ? Pc[Pc.length - 2] : null;
  const newLen = n + 1;
  // a single chord: the loop has no shape yet, so the chord after the idea is still open
  const open = n === 1 && at === n;
  return {
    k, all, n, at, P, X, follow, afterFollow, st, Pc, prev, newLen, open,
    P0: all[0], phraseEnd: at === n && newLen % 4 === 0, posW: at < n ? 0.8 : posWeight(newLen),
  };
}

export interface EngineIdea {
  chord: string;
  numeral: string;
  lane: EngineLane;
  tag: string;
  why: string;
  then: EngineThen | null;
  score: number;
}
interface Parts { ng: number; move: number; vl: number; close: number; pen: number; floor: number }
interface Cand {
  c: EChord;
  t: string;
  ngs: { s: number; best: number; srcs: Src[] };
  vlr: { cost: number; common: number[] };
  parts: Parts;
  total: number;
  natural?: boolean;
  spice?: number;
  astray?: boolean;
  vouch?: boolean;
  grp?: string;
  target?: number;
  v?: number;
}

// the scored candidates behind every After list: the key's chords (nat) and the chromatic chords that pass the Spicy
// tests (rest, each with its spice value and vouch)
function afterPool(ctx: Ctx): { nat: Cand[]; rest: Cand[]; reason: (s: Cand) => boolean; lo: { blues: boolean } } {
  const { k, n, at, P, X, follow, afterFollow, st, Pc, prev, phraseEnd, posW, open } = ctx;
  const b = st.blues;
  const idx = libIndex(k, b);
  ctx.fam = familyAffinity(Pc, k, st, idx);
  const ng = ngram(Pc.map((c) => tok(c, k, b)), idx, b, b, st, ctx.fam);
  const cine = cineRead(ctx.fam);
  ctx.ng = ng;
  const lo = { blues: b };

  const pool = POOLS[k.mode];
  // in a post-rock read the V is suspended (Gsus4, not G7)
  const inStyle = (nm: string) => {
    const c = colourize(realize(nm, k), st, k);
    return cine && semisOf(c, k) === 7 && fam(c) === 'M' && !b ? requality(c, 'sus4') : c;
  };
  const dia = (b ? pool.blues : st.sevenths ? pool.sev : pool.tri).map(inStyle);
  const chromNames = b ? pool.spiceBlues : st.sevenths ? pool.spiceSev : pool.spiceTri;
  const chrom = chromNames.map(inStyle).filter((c) => !dia.some((d) => sameChord(c, d)));
  const has = (list: EChord[], t: string) => list.some((d) => tok(d, k, b) === t);
  // a chromatic chord the library context points to that neither pool holds (E major in I–III–IV–iv)
  for (const [t, smp] of ng.sample) {
    if (!smp.same || smp.w < 1 || has(dia, t) || has(chrom, t)) continue; // a full-weight same-mode entry only
    const c = dressTo(smp.ch, st, k);
    if (!diatonic(c, k)) chrom.push(c);
  }

  const xs = semisOf(X, k);
  // a same-mode library entry plays a straight into b (II7 into ii7 in the bossa turnaround)
  const libAdj = (a: EChord, b2: EChord) => {
    const ta = tok(a, k, b), tb = tok(b2, k, b);
    return idx.some((ent) => ent.same && ent.seq.some((x, j) => x.tok === ta && (ent.cyclic || j + 1 < ent.seq.length) && ent.seq[mod(j + 1, ent.seq.length)].tok === tb));
  };
  const score = (c: EChord): Cand => {
    const t = tok(c, k, b);
    const ngs = ngramScore(t, ng);
    const vlr = voiceLead(X, c);
    const parts: Parts = {
      ng: ngs.s,
      move: moveScore(X, c, k, follow, st),
      vl: -0.1 * vlr.cost,
      close: posW * closeScore(c, follow, k, phraseEnd, afterFollow, st),
      pen: 0,
      floor: 0,
    };
    // ping-pong back to the chord before last, unless that chord is home and this is a cadence into it
    const home = isTonicChord(c, k, b) && (expectHit(X, c, k) >= 0.9 || (xs === 5 && fam(X) !== 'd') || roleOf(X, k).role === 'tritone');
    if (prev && tok(c, k, b) === tok(prev, k, b) && !home) parts.pen -= 0.6;
    const used = P.filter((p) => sameRF(p, c)).length;
    if (used >= 2) parts.pen -= 0.25 * (used - 1);
    if (k.mode === 'minor' && isMajorV(X, k)) {
      if (semisOf(c, k) === 7 && fam(c) === 'm') parts.pen -= 1.0; // V to v: a cross-relation, not a move
      if (semisOf(c, k) === 3 && fam(c) === 'M') parts.pen -= 0.5; // V to III
      if (semisOf(c, k) === 10 && fam(c) === 'M') parts.pen -= 0.8; // V to VII: the leading tone falls back
    }
    if (X.quality === 'aug' && roleOf(X, k).target != null && expectHit(X, c, k) === 0 && isMajorV(c, k)) parts.pen -= 0.5; // I+ to V
    return { c, t, ngs, vlr, parts, total: 0 };
  };
  const total = (s: Cand) => { s.total = Object.values(s.parts).reduce((a, x) => a + x, 0); return s; };
  const allowed = (c: EChord) => {
    if (sameChord(c, X)) return false;
    const r = roleOf(c, k).role;
    // same root: a colour change, not a next chord, except I to I7 or I+, i to I7, and IV to iv (minor plagal)
    const ivMinor = k.mode === 'major' && semisOf(X, k) === 5 && fam(X) === 'M' && fam(c) === 'm';
    if (c.root === X.root && !['tonic7', 'secondary'].includes(r) && !ivMinor) return false;
    if (at < n && (sameChord(c, follow) || (sameRF(c, follow) && !['tonic7', 'secondary'].includes(r)))) return false; // inserting: not the chord that already follows
    return true;
  };

  const cands: Cand[] = [];
  for (const c of dia) if (allowed(c)) cands.push(Object.assign(score(c), { natural: true }));
  for (const c of chrom) if (allowed(c) && !cands.some((s) => sameChord(s.c, c))) cands.push(score(c));
  // the expected resolution is never buried under library chains: lift it to near the best-supported idea
  const topNg = Math.max(0, ...cands.map((s) => s.ngs.s));
  for (const s of cands) if (expectHit(X, s.c, k) >= 1.2) s.parts.floor = 0.6 * Math.max(0, topNg - s.ngs.s);
  cands.forEach(total);
  // something speaks for a weak row: library support, X's own pull, or a move worth hearing
  const reason = (s: Cand) => s.parts.pen > -0.6 && (s.ngs.best > 0 || expectHit(X, s.c, k) > 0 || isDeceptive(X, s.c, k) || s.parts.move >= 0.5);

  const nat = cands.filter((s) => s.natural);
  for (const s of nat) if (fam(s.c) === 'd' && s.ngs.best < 3) { s.parts.pen -= 4; s.total -= 4; } // vii° and ii° only when the library context asks
  if (cine) for (const s of nat) if (s.c.quality === '7' || fam(s.c) === 'd') { s.parts.pen -= CINE_PEN; s.total -= CINE_PEN; }
  const inPalette = (c: EChord) => diatonic(c, k) || dia.some((d) => sameChord(d, c));
  const outside2 = Pc.slice(-2).some((c) => !inPalette(c));
  const rest: Cand[] = [];
  for (const s of cands) {
    if (s.natural) continue;
    const c = s.c, r = roleOf(c, k), sc = semisOf(c, k);
    if (cands.some((x) => x.natural && x.t === s.t) && !['tonic7', 'secondary'].includes(r.role)) continue; // E7 adds nothing next to E
    let extra = -0.08 * s.vlr.cost;
    // minor VI7 (the blues role) leans on V like an augmented sixth, so it is held to the same test
    if (r.target != null && (PULL_ROLES.includes(r.role) || (r.role === 'blues' && k.mode === 'minor'))) {
      if (r.target === xs && !sameRF(follow, X)) continue; // points straight back at X
      extra += 0.2;
      if (!open) {
        const fits = semisOf(follow, k) === r.target && expectHit(c, follow, k) >= 1;
        const ivTo = r.role === 'leading' && c.quality === 'dim7' && sc === 6 && k.mode === 'major' && isTonicChord(follow, k, b) && [0, 5].includes(xs); // I or IV, #iv°7, I
        // the loop goes elsewhere: a penalty, unless a then line carries the chord to its target
        const carried = () => thenCandidates(ctx, c).some((x) => x.sc >= THEN_MIN);
        if (!fits && !ivTo && moveScore(c, follow, k, afterFollow, st) < 0.5 && !libAdj(c, follow) && !carried()) continue;
        if ((fits || ivTo) && c.quality === 'dim7') extra += 0.4;
        // after a chord already outside the key, another chromatic pull needs a reason: library support, X's own
        // pull, or the next chord as its target (C Bb D7 is a detour)
        if (!inPalette(X) && !fits && !ivTo && !s.ngs.best && !expectHit(X, c, k) && c.root !== X.root) { extra -= 0.5; s.astray = true; }
      }
    }
    if (r.role === 'tonic7' && (cine || (!open && semisOf(follow, k) !== 5))) continue; // I7 only on its way to IV, and never in post-rock
    if (r.role === 'picardy') {
      if (isDominantOfTonic(X, k) && at === n) extra += 0.4;
      else if (!(semisOf(follow, k) === 5 && fam(follow) === 'm')) continue; // otherwise only as V of iv
    }
    if (r.role === 'dorian4') extra -= 0.25;
    if (cine && (PULL_ROLES.includes(r.role) || c.quality === '7' || fam(c) === 'd')) extra -= CINE_PULL;
    if (!st.sevenths && c.quality === 'dim7') extra -= 0.4;
    if (!st.sevenths && r.role === 'tritone') continue; // a jazz substitute: only among 7th chords
    const hit = expectHit(X, c, k) > 0;
    if (r.role === 'borrowed' && !s.ngs.best && !hit && !isDeceptive(X, c, k)) extra -= 0.8; // a borrowed chord needs a reason
    const rx = roleOf(X, k);
    if (rx.target != null && PULL_ROLES.includes(rx.role) && rx.target === sc && expectHit(X, c, k) < 1) extra -= 0.5; // V/ii into a borrowed ii
    if (b && c.quality === 'dim7' && sc === 6 && semisOf(X, k) === 5) extra += 1.0; // blues IV7 to #iv°7
    // the library continues this exact context with it: three chords of context, or two when your last two leave the
    // key, or one when X does. These lead the Spicy list.
    const q = (kk: number) => !!ng.cnt[kk] && ng.cnt[kk]!.has(s.t) && ng.src[kk]!.get(s.t)!.some((x) => x.ent.same);
    if (q(3) || (outside2 && q(2)) || (!inPalette(X) && q(1))) extra += 1.0;
    s.spice = s.total + extra;
    // a row under SPICY_MIN needs something to speak for it: library support, X's pull, a deceptive move, the same
    // root inflected (D to D7), or a target that is the next chord reached by a good move
    s.vouch = !s.astray && (s.ngs.best > 0 || expectHit(X, c, k) > 0 || isDeceptive(X, c, k) || c.root === X.root
      || (r.target != null && semisOf(follow, k) === r.target && s.parts.move >= 0.5)
      || (s.parts.move >= 0.5 && thenCandidates(ctx, c).some((x) => x.sc >= THEN_MIN)));
    rest.push(s);
  }
  return { nat, rest, reason, lo };
}

/** Up to four ideas for the chord after the progression (or at `opts.at`), each with an optional then line. */
export function afterIdeas(progression: (string | EChord)[], key: EngineKeyInput, opts: AfterOpts = {}): EngineIdea[] {
  const ctx = afterContext(progression, key, opts);
  if (!ctx) return [];
  const { k } = ctx;
  const { nat, rest, reason, lo } = afterPool(ctx);
  let picked: Cand[];
  if (!opts.spice) {
    // Natural: the key's chords in the player's style
    nat.sort((a, x) => x.total - a.total);
    picked = [];
    for (const s of nat) {
      if (picked.length >= 4 || picked.some((x) => x.t === s.t)) continue;
      if (picked.length >= 2 && s.total < NATURAL_MIN) break;
      if (s.total < NATURAL_FLOOR) break;
      if (s.total < NATURAL_MIN && !reason(s)) continue; // a second row only when something speaks for it
      picked.push(s);
    }
  } else {
    // Spicy: secondary dominants, borrowed chords, diminished 7ths, Neapolitan, Picardy, tritone sub
    // greedy: at most 3 chords that pull to a target and 2 per other role, a second chord for the same target pays 0.6
    picked = [];
    while (picked.length < 4) {
      let best: Cand | null = null, bv = -Infinity;
      for (const s of rest) {
        if (picked.includes(s) || picked.some((p) => p.t === s.t || (p.c.root === s.c.root && fam(p.c) === fam(s.c)))) continue; // Bb or Bb7, not both
        const r = roleOf(s.c, k);
        const grp = ['secondary', 'leading', 'tonic7'].includes(r.role) ? 'pull' : r.role;
        if (picked.filter((p) => p.grp === grp).length >= (grp === 'pull' ? 3 : 2)) continue;
        const v = s.spice! - (r.target != null && picked.some((p) => p.target === r.target) ? 0.6 : 0);
        if (v > bv) { bv = v; best = Object.assign(s, { grp, target: r.target, v }); }
      }
      if (!best || bv < (picked.length < 2 ? SPICY_FLOOR : SPICY_MIN)) break;
      if (bv < SPICY_MIN && !best.vouch) { rest.splice(rest.indexOf(best), 1); continue; }
      picked.push(best);
    }
    picked.sort((a, x) => x.spice! - a.spice!);
  }
  const thens = assignThens(picked.map((s) => s.c), ctx);
  return picked.map((s, i) => ideaOut(s, thens[i], ctx, lo));
}
function ideaOut(s: Cand, then: EngineThen | null, ctx: Ctx, lo: { blues: boolean }): EngineIdea {
  const { k, X, follow } = ctx;
  return {
    chord: s.c.symbol,
    numeral: numeral(s.c, k),
    lane: lane(s.c, k, follow, lo),
    tag: tagFor(X, s.c, ctx),
    why: whyAfter(X, s, ctx),
    then,
    score: +(s.spice != null ? s.spice : s.total).toFixed(2),
  };
}

// ---------- Next by feeling ----------
// The same candidates as the After lists, grouped by what the move feels like instead of Natural and Spicy:
// Resolve (home), Lift (a major chord away from home), Drift (a gentle minor chord of the key), Darken (the relative or a
// borrowed minor colour), Tension (dominants, leading and diminished chords, pulls to a target).
export const MOODS = ['Resolve', 'Lift', 'Drift', 'Darken', 'Tension'] as const;
export type Mood = (typeof MOODS)[number];
const MOOD_MAX = 3, MOOD_FILL = 0;
function moodOf(c: EChord, k: EKey, follow: EChord, b: boolean): Mood {
  const s = semisOf(c, k), f = fam(c), r = roleOf(c, k).role, major = k.mode === 'major';
  if (isTonicChord(c, k, b)) return 'Resolve';
  if (r === 'picardy') return 'Lift';
  if (b && f === 'M' && s === 5) return 'Lift';                                  // the blues IV7
  if (['leading', 'tonic7', 'tritone'].includes(r) || f === 'd') return 'Tension';
  if (r === 'secondary') return isTriad(c.quality) && lane(c, k, follow, { blues: b }) === 'PD' ? 'Lift' : 'Tension'; // the Lydian II stays bright
  if ((s === 7 || (major && s === 11)) && f === 'M') return 'Tension';            // V, and VII as V of iii
  if (c.quality === '7' && !(b && [0, 5, 7].includes(s))) return 'Tension';       // other dominant 7ths
  if (f === 'M' || f === 'a') {
    if (major && [1, 3, 8].includes(s)) return 'Darken';                          // bII, bIII, bVI from the parallel minor
    if (!major && s === 1) return 'Darken';                                       // Phrygian bII
    return 'Lift';                                                                 // IV, bVII, II, III; III, VI, VII and Dorian IV in minor
  }
  if (major) return s === 2 || s === 4 || s === 7 ? 'Drift' : 'Darken';           // ii, iii, v drift; vi, iv, i darken
  return s === 5 ? 'Darken' : 'Drift';                                            // minor: iv darkens; v and ii drift
}
/** The After candidates grouped by what the move feels like (Resolve, Lift, Drift, Darken, Tension; empty groups left out). */
export function nextByMood(progression: (string | EChord)[], key: EngineKeyInput, opts: AfterOpts = {}): { mood: Mood; ideas: EngineIdea[] }[] {
  const ctx = afterContext(progression, key, opts);
  if (!ctx) return [];
  const { k, follow, st } = ctx;
  const b = st.blues;
  const { nat, rest, reason, lo } = afterPool(ctx);
  // one value per candidate: Natural rows by total, chromatic rows by their Spicy value; each must pass its own list's bar
  // a mood with nothing over its bar still shows its best key chord when that scores at least MOOD_FILL (G, F, C)
  type P = { s: Cand; v: number; chrom: boolean };
  const pool: P[] = [], fill: P[] = [];
  for (const s of nat) {
    if (s.total < NATURAL_FLOOR || (s.total < NATURAL_MIN && !reason(s))) { if (s.total >= MOOD_FILL) fill.push({ s, v: s.total, chrom: false }); continue; }
    pool.push({ s, v: s.total, chrom: false });
  }
  for (const s of rest) {
    if (s.spice! < SPICY_FLOOR || (s.spice! < SPICY_MIN && !s.vouch)) continue;
    pool.push({ s, v: s.spice!, chrom: true });
  }
  pool.sort((a, x) => x.v - a.v);
  fill.sort((a, x) => x.v - a.v);
  const groups = MOODS.map((mood) => ({ mood, picked: [] as P[] }));
  const taken: Cand[] = [];
  let pulls = 0;
  for (const p of pool) {
    const g = groups[MOODS.indexOf(moodOf(p.s.c, k, follow, b))];
    if (g.picked.length >= MOOD_MAX) continue;
    if (taken.some((x) => x.t === p.s.t || (x.c.root === p.s.c.root && fam(x.c) === fam(p.s.c)))) continue; // Bb or Bb7, not both
    if (p.chrom && g.picked.filter((x) => x.chrom).length >= 2) continue;         // keep the key's own chords in sight
    const r = roleOf(p.s.c, k).role;
    const pull = ['secondary', 'leading', 'tonic7'].includes(r);
    if (pull && pulls >= 3) continue;
    // a third idea in a group only when it is a good one
    if (g.picked.length >= 2 && p.v < (p.chrom ? SPICY_MIN : NATURAL_MIN)) continue;
    if (pull) pulls++;
    g.picked.push(p);
    taken.push(p.s);
  }
  for (const p of fill) {
    const g = groups[MOODS.indexOf(moodOf(p.s.c, k, follow, b))];
    if (g.picked.length || taken.some((x) => x.t === p.s.t)) continue;
    g.picked.push(p);
    taken.push(p.s);
  }
  const flat = groups.flatMap((g) => g.picked.map((p) => p.s.c));
  const thens = assignThens(flat, ctx);
  let i = 0;
  return groups.filter((g) => g.picked.length).map((g) => ({
    mood: g.mood,
    ideas: g.picked.map((p) => ideaOut(p.s, thens[i++], ctx, lo)),
  }));
}
// rows: Natural shows ideas down to 0.5 (a second row down to -0.5 when something speaks for it); Spicy down to 0.3
// (at least 2 down to -0.25)
const NATURAL_MIN = 0.5, NATURAL_FLOOR = -0.5;
const SPICY_MIN = 0.3, SPICY_FLOOR = -0.25;

function joinNames(a: string[]): string { return a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
// the library entry to quote: same mode only, same quality, shorter (more canonical) first
function bestSrc(srcs: Src[], c: EChord, st: Style, ctx: Ctx): Src | undefined {
  // a cited entry must reach its core (Descending ii–Vs is not quoted for its last ii–V), and an entry whose name lives in
  // its colours (a line cliché) is never cited
  const touchesCore = (x: Src) => {
    if (!x.ent.core.ordered) return true;
    for (let q = x.j - x.kk; q < x.j; q++) if (x.ent.core.pos!.includes(x.ent.cyclic ? mod(q, x.ent.seq.length) : q)) return true;
    // or the user's chords already play the core (the canon typed out)
    const L = x.ent.seq.length, m = backMatch(x.ent, x.j, ctx.Pc, ctx.k, st.blues, x.ent.cyclic ? L - 1 : x.j);
    return coversCore(x.ent, x.j - m, x.j);
  };
  const ok = srcs.filter((x) => x.ent.same && (!st.blues || x.ent.style.blues) && !x.ent.E.nameNeedsColours && touchesCore(x));
  const rank = (x: Src) => (x.ent.style.kind === st.kind ? 1.5 : 0) + (x.ent.style.colour === st.colour ? 0.5 : 0) + (x.ch.quality === c.quality ? 1 : 0) + (x.ent.E.uses.includes('continue') ? 0.5 : 0) - 0.05 * x.ent.seq.length;
  return ok.sort((a, b) => rank(b) - rank(a))[0];
}
// numeral of the chord as the context sees it: Cmaj7 reads I (its token), C7 reads I7
function ctxNumeral(X: EChord, k: EKey, blues: boolean): string {
  const t = tok(X, k, blues);
  return t.endsWith('7') ? numeral(X, k) : numeral(requality(X, TRIAD_OF[fam(X)]), k);
}
function whyAfter(X: EChord, s: Cand, ctx: Ctx): string {
  const { k, follow, newLen, at, n, st } = ctx;
  const b = st.blues;
  const out: [number, string][] = [];
  const c = s.c;
  const tag = tagFor(X, c, ctx);
  const src = s.ngs.best >= 2 && bestSrc(s.ngs.srcs, c, st, ctx);
  // never quote a cadence entry under a different cadence tag ("Deceptive cadence; As in Authentic cadence")
  if (src && !(CADENCE_TAGS.includes(tag) && src.ent.E.kind === 'cadence' && src.ent.E.name !== tag)) out.push([3, 'As in ' + src.ent.E.name]);
  const hit = expectHit(X, c, k);
  if (hit >= 1) out.push([2.5, X.symbol + ' resolves to ' + c.symbol]);
  else if (isDeceptive(X, c, k)) out.push([2.4, 'Sidesteps the expected ' + triadAt(k, 0).symbol]);
  const r = roleOf(c, k);
  const li = laneInfo(c, k, follow, { blues: b });
  if (li.lane === 'D' && r.target != null && PULL_ROLES.includes(r.role) && r.target !== semisOf(X, k) && !/^Leads to/.test(tag)) out.push([1.6, 'Points to ' + triadAt(k, r.target).symbol]);
  const cl = s.parts.close;
  if (cl >= 1 && at === n && !ctx.open) out.push([1.5, 'Turns back to ' + follow.symbol + ' at bar ' + newLen]);
  else if (cl >= 0.9 && at < n) out.push([1.5, 'Leads into ' + follow.symbol]);
  const vl = s.vlr;
  if (vl.common.length >= 2) out.push([1.2, 'Keeps ' + joinNames(tones(c).filter((t) => vl.common.includes(t.pc)).map((t) => keyName(t, k)))]);
  else if (vl.cost <= 2) out.push([1.0, 'Moves ' + vl.cost + ' semitone' + (vl.cost === 1 ? '' : 's') + ' in all']);
  if (s.ngs.best >= 1 && out.length < 2 && s.ngs.srcs.some((x) => x.ent.same)) out.push([0.8, 'Common after ' + ctxNumeral(X, k, b)]);
  if (!out.length) {
    const a = lane(X, k, c, { blues: b }), z = li.lane;
    out.push([0.5, a === z ? 'Stays ' + LANE_WORD[a] : LANE_WORD[a][0].toUpperCase() + LANE_WORD[a].slice(1) + ' to ' + LANE_WORD[z]]);
  }
  out.sort((a, x) => x[0] - a[0]);
  return out.slice(0, 2).map((x) => x[1]).join('; ');
}

/** The then line for one idea chord (null when nothing fits well). */
export function thenFor(progression: (string | EChord)[], key: EngineKeyInput, idea: string | EChord, opts: AfterOpts = {}): EngineThen | null {
  const ctx = afterContext(progression, key, opts);
  if (!ctx) return null;
  ctx.fam = familyAffinity(ctx.Pc, ctx.k, ctx.st, libIndex(ctx.k, ctx.st.blues));
  return assignThens([parse(idea)], ctx)[0];
}

// ---------- starts ----------
export interface EngineStart {
  id: string;
  name: string;
  genre: string;
  mood: string;
  mode: 'major' | 'minor';
  kind: string;
  /** The key name it is realized in (the relative key for the other mode). */
  tonic: string;
  chords: string[];
  numerals: string[];
  lanes: EngineLane[];
  repeat: number[] | null;
  note: string;
  /** The style its chords imply; adding it to an empty progression sets the player's style. */
  style: StyleName;
}
export interface StartGroup {
  name: string;
  /** Shown (at most START_CAP). */
  items: EngineStart[];
  /** The rest, behind a More control. */
  more: EngineStart[];
}
const FAMILIES = [
  { name: 'Classical and folk', genres: ['Baroque', 'Classical', 'Hymn', 'Folk', 'Celtic', 'Country'] },
  { name: 'Blues and rock', genres: ['Blues', 'Rock', 'Funk', 'Metal'] },
  { name: 'Jazz and soul', genres: ['Jazz', 'Swing', 'Ragtime', 'Soul', 'Gospel'] },
  { name: 'Bossa nova', genres: ['Bossa nova'] },
  { name: 'Ballad and pop', genres: ['Ballad', 'Pop', 'Doo-wop'] },
  { name: 'Post-rock and cinematic', genres: ['Post-rock', 'Cinematic'] },
  { name: 'Flamenco', genres: ['Flamenco'] },
];
const BLUES_GENRES = ['Blues', 'Funk'];
const START_CAP = 4;
/**
 * Progressions to start from, grouped by genre family in display order: items (at most four, shown) and more (the rest).
 * Each item's style is the style its chords imply.
 */
export function starts(key: EngineKeyInput): StartGroup[] {
  const k = keyInfo(key);
  const groups: StartGroup[] = FAMILIES.map((f) => ({ name: f.name, items: [], more: [] }));
  for (const E of LIBRARY) {
    if (!E.uses.includes('start')) continue;
    const frame = E.mode === k.mode ? k : relative(k);
    const chords = E.numerals.map((nm) => realize(nm, frame));
    const blues = BLUES_GENRES.includes(E.genre) || styleOf(chords, frame).blues; // the Jazz blues too
    const g = groups[FAMILIES.findIndex((f) => f.genres.includes(E.genre))];
    g.items.push({
      id: E.id, name: E.name, genre: E.genre, mood: E.mood, mode: E.mode, kind: E.kind, tonic: frame.name,
      chords: chords.map((c) => c.symbol), numerals: E.numerals.slice(),
      lanes: chords.map((c, i) => lane(c, frame, chords[(i + 1) % chords.length], { blues })),
      repeat: E.repeat || null, note: E.note, style: styleOf(chords, frame).style,
    });
  }
  for (const g of groups) g.items.sort((a, b) => (a.mode === k.mode ? 0 : 1) - (b.mode === k.mode ? 0 : 1));
  // Show at most START_CAP entries of the key's own mode, one per genre first, then the rest in order; the other own-mode
  // entries go to more. Other-mode entries appear only in a group with none of its own (Flamenco in a major key).
  for (const g of groups) {
    const own = g.items.filter((x) => x.mode === k.mode);
    const pool = own.length ? own : g.items;
    const keep = new Set<EngineStart>(), genres = new Set<string>();
    for (const x of pool) if (keep.size < START_CAP && !genres.has(x.genre)) { keep.add(x); genres.add(x.genre); }
    for (const x of pool) if (keep.size < START_CAP) keep.add(x);
    g.items = pool.filter((x) => keep.has(x));
    g.more = pool.filter((x) => !keep.has(x));
  }
  const share = (g: StartGroup) => (g.items.length ? g.items.filter((x) => x.mode === 'minor').length / g.items.length : 0);
  if (k.mode === 'minor') groups.sort((a, b) => share(b) - share(a));
  return groups.filter((g) => g.items.length);
}

/** The key's diatonic chords in a style, I to vii (minor adds V): for the Key band. */
export function diatonicSet(key: EngineKeyInput, style: StyleName): EChord[] {
  const k = keyInfo(key);
  const st = styleOf([], k, { style });
  const pool = POOLS[k.mode][st.sevenths ? 'sev' : 'tri'];
  return pool.map((nm) => colourize(realize(nm, k), st, k));
}

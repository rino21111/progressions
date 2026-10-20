// How a chord sounds: a word or two for the chord type, and one line on why, in its own note names.

import { Chord, chordTones, preferredRootName } from './chords';
import { Key, chordFitInKey, romanNumeral, tonicName } from './keys';
import { letterStepsForDegree, mod12, spellFrom } from './notes';

const CHARACTER: Record<string, string> = {
  maj: 'bright',
  min: 'melancholy',
  '5': 'raw',
  '7': 'bluesy, restless',
  maj7: 'dreamy',
  m7: 'smooth',
  sus4: 'suspended',
  sus2: 'airy',
  dim: 'tense',
  aug: 'mysterious',
  add9: 'shimmering',
  '6': 'sweet',
  m6: 'bittersweet',
  madd9: 'wistful',
  m7b5: 'unresolved',
  dim7: 'eerie',
  '7sus4': 'open, expectant',
  '9': 'soulful',
  maj9: 'lush',
  m9: 'moody',
  mMaj7: 'noir',
  '7#9': 'gritty',
  '69': 'warm, resolved',
  add11: 'open',
  '7#5': 'restless',
  '7b9': 'dark tension',
  '9sus4': 'floating',
  '13': 'jazzy',
  m69: 'velvety',
  madd11: 'spacious',
  m11: 'deep, mellow',
  '7b5': 'unstable',
  '7#11': 'bright tension',
  'maj7#11': 'floating',
  'maj7#5': 'surreal',
  maj13: 'lush, airy',
  m13: 'sultry',
};

/** How a chord type (by template id) sounds, in a word or two. */
export function chordCharacter(templateId: string): string | undefined {
  return CHARACTER[templateId];
}

/**
 * One short line on why a chord sounds the way it does and where it tends to go,
 * using this chord's own note names (e.g. G7: "The B–F tritone wants to resolve to C.").
 */
export function chordReason(chord: Chord, key?: Key): string {
  const rs = preferredRootName(chord.root, chord.template.family);
  const tones = chordTones(chord, rs);
  // A chord tone's spelled name by its label, e.g. n('b7') for G7 is F.
  const n = (label: string) => tones.find((t) => t.label === label)?.name ?? '';
  // A note outside the chord, spelled as the given degree above the root.
  const deg = (label: string, semis: number) => spellFrom(rs, letterStepsForDegree(label), mod12(chord.root + semis));
  const R = n('R');
  const IV = deg('4', 5); // where dominant chords resolve
  const up = deg('b2', 1); // a half step above the root

  const lines: Record<string, () => string> = {
    maj: () => `The major 3rd (${n('3')}) lifts it; home base in ${R} major.`,
    min: () => `The minor 3rd (${n('b3')}) darkens it; often the vi of ${n('b3')}.`,
    '5': () => `Just ${R} and ${n('5')}, no 3rd: neither major nor minor.`,
    '7': () => `The ${n('3')}–${n('b7')} tritone wants to resolve to ${IV}.`,
    maj7: () => `The 7th (${n('7')}) sits a half step below ${R}; a soft rest.`,
    m7: () => `Minor with a soft 7th (${n('b7')}); often the ii of ${n('b7')}.`,
    sus4: () => `The 4th (${n('4')}) replaces the 3rd and wants to fall to ${deg('3', 4)}.`,
    sus2: () => `The 2nd (${n('2')}) replaces the 3rd: open, neither major nor minor.`,
    dim: () => `Stacked minor 3rds; tends to lead up a half step to ${up}.`,
    aug: () => `The raised 5th (${n('#5')}) pushes upward; nowhere stable to rest.`,
    add9: () => `The 9th (${n('9')}) adds shimmer above a plain major triad.`,
    '6': () => `The 6th (${n('6')}) softens it; a settled, sweet final chord.`,
    m6: () => `The major 6th (${n('6')}) brightens the minor; classic jazz-minor colour.`,
    madd9: () => `The 9th (${n('9')}) rubs against the minor 3rd (${n('b3')}).`,
    m7b5: () => `The flat 5th (${n('b5')}) unsettles it; often the ii of ${n('b7')} minor.`,
    dim7: () => `Four stacked minor 3rds; often leads up a half step to ${up}.`,
    '7sus4': () => `The 4th (${n('4')}) delays the 3rd; still pulls toward ${IV}.`,
    '9': () => `A dominant 7th plus the 9th (${n('9')}); warm, still pulls to ${IV}.`,
    maj9: () => `The 7th (${n('7')}) and 9th (${n('9')}) stacked on major; rich and restful.`,
    m9: () => `Minor 7th plus the 9th (${n('9')}); often the ii of ${n('b7')}.`,
    mMaj7: () => `A major 7th (${n('7')}) over a minor triad; dark, unresolved.`,
    '7#9': () => `The #9 (${n('#9')}) clashes with the 3rd (${n('3')}): the Hendrix chord.`,
    '69': () => `The 6th (${n('6')}) and 9th (${n('9')}) add colour with no tension.`,
    add11: () => `The 11th (${n('11')}) rubs against the 3rd (${n('3')}); open and ringing.`,
    '7#5': () => `The raised 5th (${n('#5')}) adds extra pull toward ${IV}.`,
    '7b9': () => `The b9 (${n('b9')}) adds a sharp clash; pulls hard to ${IV} minor.`,
    '9sus4': () => `The 4th (${n('4')}) and 9th (${n('9')}) float without a 3rd.`,
    '13': () => `A dominant 7th plus the 13th (${n('13')}); swings toward ${IV}.`,
    m69: () => `Minor with the 6th (${n('6')}) and 9th (${n('9')}); soft, no tension.`,
    madd11: () => `The 11th (${n('11')}) above a minor triad; wide and open.`,
    m11: () => `Minor 7th plus the 11th (${n('11')}); deep, with no tension.`,
    '7b5': () => `The flat 5th (${n('b5')}) adds a second tritone; pulls hard to ${IV}.`,
    '7#11': () => `The #11 (${n('#11')}) gives a dominant 7th a bright edge.`,
    'maj7#11': () => `The #11 (${n('#11')}) lifts it: the Lydian sound.`,
    'maj7#5': () => `The raised 5th (${n('#5')}) under the 7th (${n('7')}); strange, unsettled.`,
    maj13: () => `Major 7th plus the 13th (${n('13')}); wide and lush.`,
    m13: () => `Minor 7th plus the 13th (${n('13')}); smooth Dorian colour.`,
  };
  const line = lines[chord.template.id]?.() ?? '';
  // In the current key, name the chord's role there ("often the ii of C") instead of a generic one.
  if (key && chordFitInKey(chord, key) === 'diatonic') {
    const numeral = romanNumeral(chord, key);
    const tonic = `${tonicName(key)}${key.mode === 'minor' ? ' minor' : ''}`;
    const role = /^i$/i.test(numeral) ? `home base in ${tonicName(key)} ${key.mode}` : `often the ${numeral} of ${tonic}`;
    return line.replace(/; (often the .+|home base in .+)\.$/, `; ${role}.`);
  }
  // Outside the key its generic role would contradict the key's numeral (Bb in C is bVII, not home).
  if (key) return line.replace(/; (often the .+|home base in .+)\.$/, '.');
  return line;
}

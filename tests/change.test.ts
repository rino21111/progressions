// Hear the why: the moves line (one voice per string) and the detail panel's reason filter.
import { describe, expect, it } from 'vitest';
import { movesLine, movesText, stringMoves } from '../src/theory/change';
import { AfterIdea, ideaWhy } from '../src/theory/ideas';
import { parseFingering } from '../src/theory/fingering';
import { parseChordName } from '../src/theory/search';

const F = parseChordName('F')!;
const shape = (t: string) => parseFingering(t)!;
const line = (to: string, frets: string) => movesText(movesLine(F, shape('133211'), parseChordName(to)!, shape(frets)));

describe('moves line', () => {
  it('after F 133211', () => {
    expect(line('C', 'x32010')).toBe('C stays · F→E · A→G');
    expect(line('G', '320003')).toBe('F→G · C→B · F→D · A→G');
    expect(line('D7', 'xx0212')).toBe('A and C stay · F→D · F→F#');
    expect(line('Dm', 'xx0231')).toBe('A and F stay · C→D');
    expect(line('Fm', '133111')).toBe('F and C stay · A→Ab');
    expect(line('Bb', 'x13331')).toBe('F stays · C→Bb · A→Bb · C→D');
    expect(line('F#dim7', '2x1212')).toBe('A and C stay · F→F# · F→Eb');
  });
  it('classes each string: held, glide (two frets or less), swap, muted', () => {
    expect(stringMoves(shape('133211'), shape('x32010')).map((m) => m.kind)).toEqual(['swap', 'held', 'glide', 'glide', 'held', 'glide']);
    expect(stringMoves(shape('xx0232'), shape('xx0232')).map((m) => m.kind)).toEqual(['mute', 'mute', 'held', 'held', 'held', 'held']);
    expect(stringMoves(shape('133211'), shape('xx0231'))[2].kind).toBe('swap');
  });
});

describe('reason filter', () => {
  const idea = (tag: string | null, why: string): AfterIdea => ({ chord: F, numeral: 'IV', lane: 'PD', tag, why, then: null });
  const ctx = { after: 'IV', progression: 'I–V–vi–IV', thenRoot: null };
  it('drops "Keeps ..."', () => {
    expect(ideaWhy(idea('Plagal cadence', 'Keeps C; Turns back to C at bar 5'), ctx)).toBe('Plagal cadence. Turns back to C at bar 5');
  });
  it('drops "Common after" the heading\'s chord only', () => {
    expect(ideaWhy(idea(null, 'Moves 2 semitones in all; Common after IV'), ctx)).toBe('Moves 2 semitones in all');
    expect(ideaWhy(idea(null, 'Common after V'), ctx)).toBe('Common after V');
  });
  it('drops "As in" the progression itself', () => {
    expect(ideaWhy(idea('Deceptive cadence', 'As in I–V–vi–IV'), ctx)).toBe('Deceptive cadence');
    expect(ideaWhy(idea(null, 'As in ii–V–I'), ctx)).toBe('As in ii–V–I');
  });
  it('drops "Leads to X" when the then line starts on X\'s root', () => {
    expect(ideaWhy(idea('Leads to Am', 'Points to C'), { ...ctx, thenRoot: 9 })).toBe('Points to C');
    expect(ideaWhy(idea('Leads to Am', 'Points to C'), { ...ctx, thenRoot: 7 })).toBe('Leads to Am. Points to C');
  });
  it('drops the function change when there is a then line', () => {
    expect(ideaWhy(idea('From C minor', 'Predominant to dominant'), { ...ctx, thenRoot: 5 })).toBe('From C minor');
    expect(ideaWhy(idea('From C minor', 'Predominant to dominant'), ctx)).toBe('From C minor. Predominant to dominant');
  });
  it('nothing left: empty', () => {
    expect(ideaWhy(idea(null, 'Keeps A and C'), ctx)).toBe('');
  });
});

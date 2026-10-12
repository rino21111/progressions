import { describe, expect, it } from 'vitest';
import { CHORD_TEMPLATES, makeChord } from '../src/theory/chords';
import { chordCharacter, chordReason } from '../src/theory/character';

describe('chord character', () => {
  it('describes the common chords', () => {
    expect(chordCharacter('maj')).toBe('bright');
    expect(chordCharacter('min')).toBe('melancholy');
    expect(chordCharacter('maj7')).toBe('dreamy');
    expect(chordCharacter('5')).toBe('raw');
  });

  it('has a short description for every chord the app can name', () => {
    for (const t of CHORD_TEMPLATES) {
      const words = chordCharacter(t.id);
      expect(words, t.id).toBeTruthy();
      expect(words!.split(/[ ,]+/).length, t.id).toBeLessThanOrEqual(2);
    }
  });
});

describe('chord reason line', () => {
  const line = (root: number, id: string) => chordReason(makeChord(root, id));

  it('has a line of at most 12 words for every chord type', () => {
    for (const t of CHORD_TEMPLATES) {
      const text = line(0, t.id);
      expect(text, t.id).toMatch(/\.$/);
      expect(text.split(/\s+/).length, t.id).toBeLessThanOrEqual(12);
      expect(text, t.id).not.toMatch(/\(\)|\s–|–\s|to \.$/);
    }
  });

  it('spells the notes for the chord in hand', () => {
    expect(line(7, '7')).toBe('The B–F tritone wants to resolve to C.');
    expect(line(3, '7')).toBe('The G–Db tritone wants to resolve to Ab.');
    expect(line(6, 'min')).toBe('The minor 3rd (A) darkens it; often the vi of A.');
    expect(line(9, 'min')).toBe('The minor 3rd (C) darkens it; often the vi of C.');
    expect(line(11, 'dim')).toBe('Stacked minor 3rds; tends to lead up a half step to C.');
    expect(line(0, 'sus4')).toBe('The 4th (F) replaces the 3rd and wants to fall to E.');
    expect(line(2, 'm7')).toBe('Minor with a soft 7th (C); often the ii of C.');
  });
});

describe('chord reason in the current key', () => {
  const C = { tonic: 0, mode: 'major' as const };
  it('names the role in the key for chords in it', () => {
    expect(chordReason(makeChord(2, 'min'), C)).toBe('The minor 3rd (F) darkens it; often the ii of C.');
    expect(chordReason(makeChord(9, 'min'), C)).toBe('The minor 3rd (C) darkens it; often the vi of C.');
    expect(chordReason(makeChord(5, 'maj'), C)).toBe('The major 3rd (A) lifts it; often the IV of C.');
    expect(chordReason(makeChord(0, 'maj'), C)).toBe('The major 3rd (E) lifts it; home base in C major.');
  });
  it('keeps the general wording for chords outside the key', () => {
    expect(chordReason(makeChord(1, 'min'), C)).toBe(chordReason(makeChord(1, 'min')));
  });
});


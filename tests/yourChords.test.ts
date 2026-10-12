import { describe, expect, it } from 'vitest';
import { afterChord, append, cardIndex, duplicateAt, moveCard, removeAt, stepCard } from '../src/yourChords';

const L = ['C', 'G', 'Am', 'F'];

describe('the selected card', () => {
  it('is an index, or none', () => {
    expect(cardIndex(4, 1)).toBe(1);
    expect(cardIndex(4, null)).toBe(-1);
    expect(cardIndex(4, 9)).toBe(-1);
  });

  it('arrows step through the cards and stop at the ends; from none, left picks the last and right the first', () => {
    expect(stepCard(4, null, -1)).toBe(3);
    expect(stepCard(4, null, 1)).toBe(0);
    expect(stepCard(4, 0, -1)).toBe(0);
    expect(stepCard(4, 3, 1)).toBe(3);
    expect(stepCard(4, 1, 1)).toBe(2);
  });
});

describe('After', () => {
  it('follows the last chord', () => {
    expect(afterChord(L)).toBe('F');
    expect(afterChord([])).toBeUndefined();
  });
});

describe('editing the progression', () => {
  it('adding appends at the end and selects the new card', () => {
    expect(append(L, 'Em')).toEqual({ list: ['C', 'G', 'Am', 'F', 'Em'], card: 4 });
    expect(append([], 'C')).toEqual({ list: ['C'], card: 0 });
  });

  it('duplicating puts the copy right after the card', () => {
    expect(duplicateAt(L, 1)).toEqual({ list: ['C', 'G', 'G', 'Am', 'F'], card: 2 });
    expect(duplicateAt(L, 3)).toEqual({ list: ['C', 'G', 'Am', 'F', 'F'], card: 4 });
  });

  it('removing the selected card selects the one before it (or the new first), and nothing when empty', () => {
    expect(removeAt(L, 2, 2)).toEqual({ list: ['C', 'G', 'F'], card: 1 });
    expect(removeAt(L, 0, 0)).toEqual({ list: ['G', 'Am', 'F'], card: 0 });
    expect(removeAt(['C'], 0, 0)).toEqual({ list: [], card: null });
  });

  it('removing another card keeps the selection on the same chord', () => {
    expect(removeAt(L, 2, 0)).toEqual({ list: ['G', 'Am', 'F'], card: 1 });
    expect(removeAt(L, 1, 3)).toEqual({ list: ['C', 'G', 'Am'], card: 1 });
    expect(removeAt(L, null, 1)).toEqual({ list: ['C', 'Am', 'F'], card: null });
  });

  it('moves a card, including to and from the ends, and the selection follows its card', () => {
    expect(moveCard(L, null, 0, 3).list).toEqual(['G', 'Am', 'F', 'C']);
    expect(moveCard(L, null, 3, 0).list).toEqual(['F', 'C', 'G', 'Am']);
    expect(moveCard(L, null, 1, 2).list).toEqual(['C', 'Am', 'G', 'F']);
    expect(moveCard(L, null, 1, 99).list).toEqual(['C', 'Am', 'F', 'G']); // past the last card: last
    expect(moveCard(L, 1, 1, 3).card).toBe(3); // the moved card was selected
    expect(moveCard(L, 2, 0, 3).card).toBe(1); // Am shifts left
    expect(moveCard(L, 0, 3, 1).card).toBe(0); // C is before the change
  });

  it('a move to the same place changes nothing', () => {
    const same = moveCard(L, 1, 2, 2);
    expect(same.list).toBe(L);
    expect(same.card).toBe(1);
  });
});

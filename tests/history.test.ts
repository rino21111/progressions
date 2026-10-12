import { describe, expect, it } from 'vitest';
import { History } from '../src/history';

describe('undo history', () => {
  it('steps back through earlier values and forward again', () => {
    const h = new History<string>();
    h.record('a'); // a -> b
    h.record('b'); // b -> c
    expect(h.canUndo).toBe(true);
    expect(h.undo('c')).toBe('b');
    expect(h.undo('b')).toBe('a');
    expect(h.undo('a')).toBeUndefined();
    expect(h.canUndo).toBe(false);
    expect(h.redo('a')).toBe('b');
    expect(h.redo('b')).toBe('c');
    expect(h.redo('c')).toBeUndefined();
  });

  it('forgets undone steps once something new happens', () => {
    const h = new History<number>();
    h.record(1);
    h.record(2);
    expect(h.undo(3)).toBe(2);
    h.record(2); // a new change from 2
    expect(h.redo(4)).toBeUndefined();
    expect(h.undo(4)).toBe(2);
  });

  it('keeps at most the most recent steps', () => {
    const h = new History<number>(3);
    [1, 2, 3, 4, 5].forEach((n) => h.record(n));
    expect([h.undo(6), h.undo(5), h.undo(4), h.undo(3)]).toEqual([5, 4, 3, undefined]);
  });
});

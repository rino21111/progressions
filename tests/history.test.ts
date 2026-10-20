import { describe, expect, it } from 'vitest';
import { History } from '../src/history';
import { migrateDefaults, state } from '../src/state';

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

describe('new defaults (160 bpm, looping)', () => {
  it('a save made under the old defaults picks them up once; a chosen tempo stays', () => {
    expect(migrateDefaults({ bpm: 80, loop: false })).toEqual({});
    expect(migrateDefaults({ bpm: 96, loop: false })).toEqual({ bpm: 96 });
    expect(migrateDefaults({ v: 2, bpm: 80, loop: false })).toEqual({ bpm: 80, loop: false });
    expect(migrateDefaults({ v: 3, bpm: 80, loop: false, labelMode: 'interval' })).toEqual({ bpm: 80, loop: false, labelMode: 'interval' });
  });
  it('defaults to 160 bpm with looping on', () => {
    expect(state.bpm).toBe(160);
    expect(state.loop).toBe(true);
  });
});

describe('labels default to note names', () => {
  it('a save holding the old interval default picks up note names once; a later choice stays', () => {
    expect(state.labelMode).toBe('note');
    expect(migrateDefaults({ v: 2, labelMode: 'interval' })).toEqual({});
    expect(migrateDefaults({ labelMode: 'interval', bpm: 96 })).toEqual({ bpm: 96 });
    expect(migrateDefaults({ v: 3, labelMode: 'interval' })).toEqual({ labelMode: 'interval' });
  });
});

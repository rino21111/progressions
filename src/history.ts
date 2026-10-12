// Undo/redo for one value: earlier versions on one stack, undone ones on the other.

export class History<T> {
  private past: T[] = [];
  private future: T[] = [];

  constructor(private readonly limit = 50) {}

  /** Remember `previous` before a new change; a fresh change clears anything undone. */
  record(previous: T) {
    this.past.push(previous);
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }

  /** The value to go back to (given the current one), or undefined if there's nothing to undo. */
  undo(current: T): T | undefined {
    const previous = this.past.pop();
    if (previous !== undefined) this.future.push(current);
    return previous;
  }

  redo(current: T): T | undefined {
    const next = this.future.pop();
    if (next !== undefined) this.past.push(current);
    return next;
  }

  /** The value an undo would return, without undoing. */
  peekUndo(): T | undefined {
    return this.past[this.past.length - 1];
  }

  peekRedo(): T | undefined {
    return this.future[this.future.length - 1];
  }

  /** Forget everything. */
  clear() {
    this.past = [];
    this.future = [];
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }
}

// Rules for editing the progression and its selected card (the one clicked, or null for none).
// Adding always appends; the selected card follows its chord when cards are removed or moved.

/** The selected card's index, or -1 when none is selected (or it no longer exists). */
export function cardIndex(length: number, card: number | null): number {
  return card !== null && card >= 0 && card < length ? card : -1;
}

/** What After follows: the last chord, the one you'd add after (whichever card is selected). */
export function afterChord<T>(list: T[]): T | undefined {
  return list[list.length - 1];
}

/** Append at the end; the new card is selected. */
export function append<T>(list: T[], item: T): { list: T[]; card: number } {
  return { list: [...list, item], card: list.length };
}

/** Insert a copy right after a card (double-click to duplicate); the copy is selected. */
export function duplicateAt<T>(list: T[], index: number): { list: T[]; card: number } {
  return { list: [...list.slice(0, index + 1), list[index], ...list.slice(index + 1)], card: index + 1 };
}

/**
 * Remove a card. The selection stays on the same card; if that card is the one removed, the one
 * before it is selected (or the new first card), and nothing when the list is empty.
 */
export function removeAt<T>(list: T[], card: number | null, index: number): { list: T[]; card: number | null } {
  const next = list.filter((_, i) => i !== index);
  const current = cardIndex(list.length, card);
  if (!next.length) return { list: next, card: null };
  if (current < 0) return { list: next, card: null };
  if (index < current) return { list: next, card: current - 1 };
  if (index > current) return { list: next, card: current };
  return { list: next, card: Math.max(0, index - 1) };
}

/** Move the card at `from` to `to` (clamped to the list); the selection follows its card. */
export function moveCard<T>(list: T[], card: number | null, from: number, to: number): { list: T[]; card: number | null } {
  to = Math.min(list.length - 1, Math.max(0, to));
  if (from === to || from < 0 || from >= list.length) return { list, card };
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return { list: next, card: card === null ? null : moveIndex(card, from, to) };
}

/** Where index `i` ends up after the card at `from` moves to `to`. */
export function moveIndex(i: number, from: number, to: number): number {
  if (i === from) return to;
  if (from < i && i <= to) return i - 1;
  if (to <= i && i < from) return i + 1;
  return i;
}

/** Select the card one to the left (-1) or right (+1), stopping at the ends; from nothing, the last or first. */
export function stepCard(length: number, card: number | null, step: -1 | 1): number {
  const current = cardIndex(length, card);
  if (current < 0) return step < 0 ? length - 1 : 0;
  return Math.min(length - 1, Math.max(0, current + step));
}

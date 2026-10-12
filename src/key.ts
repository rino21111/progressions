// The key in use: the one picked on Relationships, or the best guess from the progression.

import { ALL_KEYS, Key, keyId, rankKeys } from './theory/keys';
import { state } from './state';

/** The automatic best guess from the progression (C major when empty). */
export function currentKeyGuess(): Key {
  return rankKeys(state.progression)[0]?.key ?? { tonic: 0, mode: 'major' };
}

export function currentKey(): { key: Key; guessed: boolean } {
  if (state.keyChoice) {
    const chosen = ALL_KEYS.find((k) => keyId(k) === state.keyChoice);
    if (chosen) return { key: chosen, guessed: false };
  }
  return { key: currentKeyGuess(), guessed: true };
}

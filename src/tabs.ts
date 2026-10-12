// The pages' names, as shown on the tabs and in the address bar.

export const TAB_LABELS = { detector: 'Chord', progressions: 'Next…', tab: 'Tab' } as const;
export const TAB_HASHES = { detector: 'chord', progressions: 'next', tab: 'tab' } as const;
// Older addresses, so links shared before the rename still open the right page.
export const OLD_TAB_HASHES = { inspector: 'detector', relationships: 'progressions', progressions: 'progressions' } as const;

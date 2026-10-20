// The views' names in the address bar: the instrument (chord; next is the old name), notes and tab.

export const TAB_HASHES = { detector: 'chord', progressions: 'next', notes: 'notes', tab: 'tab' } as const;
// Older addresses, so links shared before the rename still open the right page.
export const OLD_TAB_HASHES = { inspector: 'detector', relationships: 'progressions', progressions: 'progressions' } as const;

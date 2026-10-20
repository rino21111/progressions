// The views' names in the address bar: chord, progression (next is its old name), notes and tab.

export const TAB_HASHES = { detector: 'chord', progressions: 'progression', notes: 'notes', tab: 'tab' } as const;
// Older addresses, so links shared before the rename still open the right page.
export const OLD_TAB_HASHES = { inspector: 'detector', relationships: 'progressions', progressions: 'progressions', next: 'progressions' } as const;

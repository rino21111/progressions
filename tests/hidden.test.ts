// The Chords | Tab switch hides the desk's columns or the tab with the hidden attribute; their own
// display rules (grids) must never override it, or both show at once.
// @ts-expect-error: a Node built-in (tests run in Node; the project has no Node types)
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Read as text: Vitest hands CSS imports back empty.
const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8');
const css = read('../src/style.css');
const instrument = read('../src/ui/instrument.ts');

describe('hidden pages stay hidden', () => {
  it('the switch shows the desk or the tab with the hidden attribute', () => {
    expect(instrument).toMatch(/chordInfo\.hidden = m !== 'chord'/);
    expect(instrument).toMatch(/nextInfo\.hidden = m !== 'progression'/);
    expect(instrument).toMatch(/opts\.tab\.hidden = m !== 'tab'/);
  });
  it('[hidden] beats any display rule', () => {
    expect(css).toMatch(/\[hidden\]\s*\{\s*display:\s*none\s*!important;\s*\}/);
  });
});

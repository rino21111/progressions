// Tabs hide their pages with the hidden attribute; a page's own display rule (the Relationships page
// is a flex column) must never override it, or its content shows under the other tab.
// @ts-expect-error: a Node built-in (tests run in Node; the project has no Node types)
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Read as text: Vitest hands CSS imports back empty.
const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8');
const css = read('../src/style.css');
const main = read('../src/main.ts');

describe('hidden pages stay hidden', () => {
  it('tabs switch pages with the hidden attribute', () => {
    expect(main).toMatch(/page\.hidden = name !== tab/);
  });
  it('[hidden] beats any display rule', () => {
    expect(css).toMatch(/\[hidden\]\s*\{\s*display:\s*none\s*!important;\s*\}/);
  });
});

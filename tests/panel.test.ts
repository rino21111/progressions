// The Progression panel: hidden until the first chord, then as the player leaves it.
// @ts-expect-error: a Node built-in (tests run in Node; the project has no Node types)
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { initialOpen, openAfter } from '../src/ui/panel';

const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
const panel = readFileSync(new URL('../src/ui/panel.ts', import.meta.url), 'utf8');

describe('progression panel', () => {
  it('starts hidden while the progression is empty, whatever was chosen', () => {
    expect(initialOpen(0, null)).toBe(false);
    expect(initialOpen(0, true)).toBe(false);
  });
  it('with chords on load: the last choice, or shown', () => {
    expect(initialOpen(4, null)).toBe(true);
    expect(initialOpen(4, false)).toBe(false);
    expect(initialOpen(4, true)).toBe(true);
  });
  it('the first chord opens it', () => {
    expect(openAfter(false, 0, 1)).toBe(true);
    expect(openAfter(false, 0, 3)).toBe(true);
  });
  it('a hand-hidden panel stays hidden through later adds', () => {
    expect(openAfter(false, 1, 2)).toBe(false);
    expect(openAfter(false, 4, 5)).toBe(false);
  });
  it('clearing the progression does not hide it', () => {
    expect(openAfter(true, 4, 0)).toBe(true);
  });
  it('the hidden panel shows the chord count beside its label, and gives back the dock\'s room', () => {
    expect(panel).toMatch(/countEl\.textContent = state\.progression\.length \? String\(state\.progression\.length\) : ''/);
    expect(panel).toMatch(/if \(!open\) document\.documentElement\.style\.setProperty\('--dock-h', '0px'\)/);
    expect(css).toMatch(/\.app\.panel-closed \.sidebar,\s*\.app\.panel-closed \.side-header \{\s*display: none;/);
  });
});

describe("the Chord page's own +", () => {
  const detector = readFileSync(new URL('../src/ui/detector.ts', import.meta.url), 'utf8');
  it('sits after the chord name (only shown chords have one) and adds like the add card', () => {
    expect(detector).toMatch(/class: 'chord-add', title: `Add \$\{chordSymbol\(chord\)\} to progression \(A\)`/);
    expect(detector).toMatch(/onclick: addSelection,\s*\}, '\+'\)/);
  });
  it('shows only while the panel is hidden; the first add opens the panel, hiding it again', () => {
    expect(css).toMatch(/\.chord-add \{\s*display: none;/);
    expect(css).toMatch(/\.app\.panel-closed \.chord-add \{\s*display: inline-block;/);
    expect(openAfter(false, 0, 1)).toBe(true);
  });
});

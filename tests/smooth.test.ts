// Smooth shapes: each chord in the shape (among its usual ones) that moves least from the one before.
import { describe, expect, it } from 'vitest';
import { moveCost, smoothChain, smoothShape } from '../src/theory/smooth';
import { formatFingering, parseFingering } from '../src/theory/fingering';
import { parseChordName } from '../src/theory/search';

const f = (t: string) => parseFingering(t)!;
const chain = (names: string) => smoothChain(names.split(' ').map((n) => parseChordName(n)!)).map((x) => formatFingering(x!)).join(' ');

describe('smooth shapes', () => {
  it('costs: held strings help; fret moves, muting and hand moves cost', () => {
    expect(moveCost(f('x32010'), f('x32010'))).toBe(-5);
    expect(moveCost(f('xx0231'), f('320033'))).toBeLessThan(moveCost(f('xx0231'), f('320003')));
    expect(moveCost(f('x02210'), f('133211'))).toBeGreaterThan(moveCost(f('x02210'), f('x02211')));
  });
  it('nothing before: the usual shape', () => {
    expect(formatFingering(smoothShape(parseChordName('G')!, null)!)).toBe('320003');
  });
  it('Dm G C keeps the hand together', () => {
    expect(chain('Dm G C')).toBe('xx0231 320033 x32013');
  });
  it('the usual shape wins unless another is clearly closer', () => {
    expect(chain('C D7 G7 C')).toBe('x32010 xx0212 320001 x32010');
    expect(chain('F G Am')).toBe('133211 320003 x02210');
  });
});

import { describe, expect, it } from 'vitest';
import { normalizeEgyptianMobile } from './phone';

describe('normalizeEgyptianMobile', () => {
  it.each([
    ['01012345678', '+201012345678'],
    ['011 2345 6789', '+201123456789'],
    ['012-3456-7890', '+201234567890'],
    ['+201512345678', '+201512345678'],
    ['00201012345678', '+201012345678'],
    ['201012345678', '+201012345678'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeEgyptianMobile(input)).toBe(expected);
  });

  it.each(['0101234567', '010123456789', '01312345678', '0223456789', '+441012345678', 'abc', ''])(
    'rejects %s',
    (input) => {
      expect(normalizeEgyptianMobile(input)).toBeNull();
    },
  );
});

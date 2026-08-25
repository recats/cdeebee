import { describe, it, expect } from 'vitest';
import { toEntityID } from '../../../lib/utils/entityID';

describe('toEntityID', () => {
  it('restores integer ids from object keys', () => {
    expect(toEntityID('5')).toBe(5);
    expect(toEntityID('0')).toBe(0);
  });
  it('keeps non-round-tripping and non-numeric keys as strings', () => {
    expect(toEntityID('007')).toBe('007');
    expect(toEntityID('1e3')).toBe('1e3');
    expect(toEntityID('1.5')).toBe('1.5');
    expect(toEntityID('abc')).toBe('abc');
  });
});

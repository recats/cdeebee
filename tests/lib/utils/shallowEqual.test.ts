import { describe, it, expect } from 'vitest';
import { shallowEqual } from '../../../lib/utils/shallowEqual';

describe('shallowEqual', () => {
  it('returns true for same reference', () => {
    const a = { x: 1 };
    expect(shallowEqual(a, a)).toBe(true);
  });
  it('compares object keys one level deep', () => {
    expect(shallowEqual({ x: 1, y: 'a' }, { x: 1, y: 'a' })).toBe(true);
    expect(shallowEqual({ x: 1, y: 'a' }, { x: 1, y: 'b' })).toBe(false);
    expect(shallowEqual({ x: 1 }, { x: 1, y: 2 })).toBe(false);
  });
  it('does not deep compare nested objects', () => {
    expect(shallowEqual({ n: { a: 1 } }, { n: { a: 1 } })).toBe(false);
  });
  it('compares arrays element-wise by reference', () => {
    const e = { id: 1 };
    expect(shallowEqual([e, 2], [e, 2])).toBe(true);
    expect(shallowEqual([{ id: 1 }], [{ id: 1 }])).toBe(false);
    expect(shallowEqual([1, 2], [1])).toBe(false);
  });
  it('handles primitives, null and undefined', () => {
    expect(shallowEqual(1, 1)).toBe(true);
    expect(shallowEqual(null, undefined)).toBe(false);
    expect(shallowEqual(null, null)).toBe(true);
    expect(shallowEqual({}, null)).toBe(false);
    expect(shallowEqual([], {})).toBe(false);
  });
});

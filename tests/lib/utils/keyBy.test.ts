import { describe, it, expect } from 'vitest';
import { keyBy } from '../../../lib/utils/keyBy';

describe('keyBy', () => {
  it('keys entities by primaryKey', () => {
    const entityList = [{ id: 1, n: 'a' }, { id: 2, n: 'b' }];
    expect(keyBy(entityList, 'id')).toEqual({ 1: entityList[0], 2: entityList[1] });
  });
  it('last duplicate wins', () => {
    expect(keyBy([{ id: 1, n: 'a' }, { id: 1, n: 'b' }], 'id')).toEqual({ 1: { id: 1, n: 'b' } });
  });
  it('skips entities without the key', () => {
    expect(keyBy([{ id: 1 }, { x: 2 } as never], 'id')).toEqual({ 1: { id: 1 } });
  });
});

import { describe, it, expect, vi } from 'vitest';
import { checkModule, mergeDeepRight, omit, batchingUpdate } from '../../../lib/reducer/helpers';
import { type CdeebeeSettings, type CdeebeeModule } from '../../../lib/reducer/types';

describe('checkModule', () => {
  it('should execute result callback when module is included in settings', () => {
    const settings: CdeebeeSettings<unknown> = {
      modules: ['history', 'listener'] as CdeebeeModule[],
      fileKey: 'file',
      bodyKey: 'body',
      primaryKey: 'id',
      mergeWithData: {},
      listStrategy: {},
    };

    const resultCallback = vi.fn();
    checkModule(settings, 'history', resultCallback);

    expect(resultCallback).toHaveBeenCalledTimes(1);
  });

  it('should not execute result callback when module is not included in settings', () => {
    const settings: CdeebeeSettings<unknown> = {
      modules: ['history', 'listener'] as CdeebeeModule[],
      fileKey: 'file',
      bodyKey: 'body',
      primaryKey: 'id',
      mergeWithData: {},
      listStrategy: {},
    };

    const resultCallback = vi.fn();
    checkModule(settings, 'cancelation', resultCallback);

    expect(resultCallback).not.toHaveBeenCalled();
  });

  it('should work with all module types', () => {
    const settings: CdeebeeSettings<unknown> = {
      modules: ['history', 'listener', 'storage', 'cancelation'] as CdeebeeModule[],
      fileKey: 'file',
      bodyKey: 'body',
      primaryKey: 'id',
      mergeWithData: {},
      listStrategy: {},
    };

    const modules: CdeebeeModule[] = ['history', 'listener', 'storage', 'cancelation'];
    
    modules.forEach(module => {
      const resultCallback = vi.fn();
      checkModule(settings, module, resultCallback);
      expect(resultCallback).toHaveBeenCalledTimes(1);
    });
  });

  it('should handle empty modules array', () => {
    const settings: CdeebeeSettings<unknown> = {
      modules: [] as CdeebeeModule[],
      fileKey: 'file',
      bodyKey: 'body',
      primaryKey: 'id',
      mergeWithData: {},
      listStrategy: {},
    };

    const resultCallback = vi.fn();
    checkModule(settings, 'history', resultCallback);

    expect(resultCallback).not.toHaveBeenCalled();
  });
});

describe('mergeDeepRight', () => {
  it('should merge simple objects', () => {
    const left = { a: 1, b: 2 };
    const right = { b: 3, c: 4 };
    const result = mergeDeepRight(left, right);

    expect(result).toEqual({ a: 1, b: 3, c: 4 });
    expect(result).not.toBe(left); // Should return new object
  });

  it('should deeply merge nested objects', () => {
    const left = {
      a: { x: 1, y: 2 },
      b: { z: 3 },
    };
    const right = {
      a: { y: 20, z: 30 },
      b: { w: 4 },
    };
    const result = mergeDeepRight(left, right);

    expect(result).toEqual({
      a: { x: 1, y: 20, z: 30 },
      b: { z: 3, w: 4 },
    });
  });

  it('should replace arrays instead of merging', () => {
    const left = { items: [1, 2, 3] };
    const right = { items: [4, 5] };
    const result = mergeDeepRight(left, right);

    expect(result).toEqual({ items: [4, 5] });
  });

  it('should replace primitives with right value', () => {
    const left = { a: 'old', b: 10 };
    const right = { a: 'new', b: 20 };
    const result = mergeDeepRight(left, right);

    expect(result).toEqual({ a: 'new', b: 20 });
  });

  it('should handle null and undefined values', () => {
    const left = { a: 1, b: 2 };
    const right = { a: null, b: undefined };
    const result = mergeDeepRight(left, right);

    expect(result).toEqual({ a: null, b: undefined });
  });

  it('should merge deeply nested objects', () => {
    const left = {
      level1: {
        level2: {
          level3: { value: 'old' },
          other: 'preserved',
        },
      },
    };
    const right = {
      level1: {
        level2: {
          level3: { value: 'new' },
        },
      },
    };
    const result = mergeDeepRight(left, right);

    expect(result).toEqual({
      level1: {
        level2: {
          level3: { value: 'new' },
          other: 'preserved',
        },
      },
    });
  });

  it('should preserve left properties not in right', () => {
    const left = { a: 1, b: 2, c: 3 };
    const right = { b: 20 };
    const result = mergeDeepRight(left, right);

    expect(result).toEqual({ a: 1, b: 20, c: 3 });
  });

  it('should handle empty objects', () => {
    const left = {};
    const right = { a: 1 };
    const result = mergeDeepRight(left, right);

    expect(result).toEqual({ a: 1 });
  });
});

describe('omit', () => {
  it('should remove specified keys from object', () => {
    const obj = { a: 1, b: 2, c: 3 };
    const result = omit(['b'], obj);

    expect(result).toEqual({ a: 1, c: 3 });
    expect(result).not.toBe(obj); // Should return new object
  });

  it('should remove multiple keys', () => {
    const obj = { a: 1, b: 2, c: 3, d: 4 };
    const result = omit(['b', 'd'], obj);

    expect(result).toEqual({ a: 1, c: 3 });
  });

  it('should handle empty keys array', () => {
    const obj = { a: 1, b: 2 };
    const result = omit([], obj);

    expect(result).toEqual({ a: 1, b: 2 });
  });

  it('should handle non-existent keys', () => {
    const obj = { a: 1, b: 2 };
    const result = omit(['c', 'd'], obj);

    expect(result).toEqual({ a: 1, b: 2 });
  });

  it('should handle removing all keys', () => {
    const obj = { a: 1, b: 2 };
    const result = omit(['a', 'b'], obj);

    expect(result).toEqual({});
  });

  it('should not mutate original object', () => {
    const obj = { a: 1, b: 2, c: 3 };
    const original = { ...obj };
    omit(['b'], obj);

    expect(obj).toEqual(original);
  });

  it('should handle nested objects (shallow omit)', () => {
    const obj = {
      a: 1,
      b: { nested: 'value' },
      c: 3,
    };
    const result = omit(['a'], obj);

    expect(result).toEqual({
      b: { nested: 'value' },
      c: 3,
    });
  });
});

describe('batchingUpdate', () => {
  it('should update a single top-level key', () => {
    const state: Record<string, unknown> = { a: 1, b: 2 };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const valueList: any = [
      { key: ['a'], value: 10 },
    ];

    batchingUpdate(state, valueList);

    expect(state.a).toBe(10);
    expect(state.b).toBe(2);
  });

  it('should update multiple top-level keys', () => {
    const state: Record<string, unknown> = { a: 1, b: 2, c: 3 };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const valueList: any = [
      { key: ['a'], value: 10 },
      { key: ['b'], value: 20 },
    ];

    batchingUpdate(state, valueList);

    expect(state.a).toBe(10);
    expect(state.b).toBe(20);
    expect(state.c).toBe(3);
  });

  it('should update nested keys', () => {
    const state: Record<string, unknown> = {
      campaignList: {
        '123': { name: 'Old Name', id: '123' },
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const valueList: any = [
      { key: ['campaignList', '123', 'name'], value: 'New Name' },
    ];

    batchingUpdate(state, valueList);

    const campaign = (state.campaignList as Record<string, unknown>)['123'] as Record<string, unknown>;
    expect(campaign.name).toBe('New Name');
    expect(campaign.id).toBe('123');
  });

  it('should create nested structure if it does not exist', () => {
    const state: Record<string, unknown> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const valueList: any = [
      { key: ['campaignList', '123', 'name'], value: 'Campaign Name' },
    ];

    batchingUpdate(state, valueList);

    const campaign = (state.campaignList as Record<string, unknown>)['123'] as Record<string, unknown>;
    expect(campaign.name).toBe('Campaign Name');
  });

  it('should update multiple nested keys', () => {
    const state: Record<string, unknown> = {
      campaignList: {
        '123': { name: 'Old Name', status: 'draft' },
        '456': { name: 'Another', status: 'active' },
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const valueList: any = [
      { key: ['campaignList', '123', 'name'], value: 'Updated Name' },
      { key: ['campaignList', '456', 'status'], value: 'paused' },
    ];

    batchingUpdate(state, valueList);

    const campaign1 = (state.campaignList as Record<string, unknown>)['123'] as Record<string, unknown>;
    const campaign2 = (state.campaignList as Record<string, unknown>)['456'] as Record<string, unknown>;
    
    expect(campaign1.name).toBe('Updated Name');
    expect(campaign1.status).toBe('draft');
    expect(campaign2.name).toBe('Another');
    expect(campaign2.status).toBe('paused');
  });

  it('should handle numeric keys in path', () => {
    const state: Record<string, unknown> = {
      items: [{ id: 1, name: 'Item 1' }, { id: 2, name: 'Item 2' }],
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const valueList: any = [
      { key: ['items', 0, 'name'], value: 'Updated Item 1' },
    ];

    batchingUpdate(state, valueList);

    const items = state.items as Array<Record<string, unknown>>;
    expect(items[0].name).toBe('Updated Item 1');
    expect(items[1].name).toBe('Item 2');
  });

  it('should handle empty path (skip)', () => {
    const state: Record<string, unknown> = { a: 1, b: 2 };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const valueList: any = [
      { key: [], value: 'ignored' },
      { key: ['a'], value: 10 },
    ];

    batchingUpdate(state, valueList);

    expect(state.a).toBe(10);
    expect(state.b).toBe(2);
  });

  it('should preserve other properties when updating nested values', () => {
    const state: Record<string, unknown> = {
      campaignList: {
        '123': { name: 'Old', status: 'active', id: '123' },
      },
      otherData: { value: 'preserved' },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const valueList: any = [
      { key: ['campaignList', '123', 'name'], value: 'New' },
    ];

    batchingUpdate(state, valueList);

    const campaign = (state.campaignList as Record<string, unknown>)['123'] as Record<string, unknown>;
    expect(campaign.name).toBe('New');
    expect(campaign.status).toBe('active');
    expect(campaign.id).toBe('123');
    expect(state.otherData).toEqual({ value: 'preserved' });
  });

  it('should handle deep nested paths', () => {
    const state: Record<string, unknown> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const valueList: any = [
      { key: ['level1', 'level2', 'level3', 'level4', 'value'], value: 'deep value' },
    ];

    batchingUpdate(state, valueList);

    const level1 = state.level1 as Record<string, unknown>;
    const level2 = level1.level2 as Record<string, unknown>;
    const level3 = level2.level3 as Record<string, unknown>;
    const level4 = level3.level4 as Record<string, unknown>;
    
    expect(level4.value).toBe('deep value');
  });

  it('should mutate state in place', () => {
    const state: Record<string, unknown> = { a: 1 };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const valueList: any = [
      { key: ['a'], value: 2 },
    ];

    batchingUpdate(state, valueList);

    // Should mutate the same object reference
    expect(state.a).toBe(2);
  });
});

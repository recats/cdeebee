import { describe, it, expect, vi } from 'vitest';
import { checkModule, mergeDeepRight, omit } from '../../../lib/reducer/helpers';
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


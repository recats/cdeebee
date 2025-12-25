import { describe, it, expect } from 'vitest';
import {
  type CdeebeeState,
  type CdeebeeValueList,
  type CdeebeeRequestOptions,
  batchingUpdate,
  request,
  factory,
} from '../../lib/index';

describe('lib/index exports', () => {
  it('should export CdeebeeState type', () => {
    // Type check - if this compiles, the export works
    const state: CdeebeeState<Record<string, unknown>> = {
      settings: {
        modules: [],
        fileKey: 'file',
        bodyKey: 'body',
        mergeWithData: {},
      },
      storage: {},
      request: {
        active: [],
        errors: {},
        done: {},
      },
    };
    expect(state).toBeDefined();
  });

  it('should export CdeebeeValueList type', () => {
    // Type check - if this compiles, the export works
    const valueList: CdeebeeValueList<Record<string, unknown>> = [
      { key: ['test'], value: 'value' },
    ];
    expect(valueList).toBeDefined();
  });

  it('should export CdeebeeRequestOptions type', () => {
    // Type check - if this compiles, the export works
    const options: CdeebeeRequestOptions<Record<string, unknown>> = {
      api: '/test',
    };
    expect(options).toBeDefined();
  });

  it('should export batchingUpdate function', () => {
    expect(typeof batchingUpdate).toBe('function');
  });

  it('should export request function', () => {
    expect(typeof request).toBe('function');
  });

  it('should export factory function', () => {
    expect(typeof factory).toBe('function');
  });
});


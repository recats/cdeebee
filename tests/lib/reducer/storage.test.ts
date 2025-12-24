import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defaultNormalize } from '../../../lib/reducer/storage';
import { type CdeebeeState, type CdeebeeListStrategy } from '../../../lib/reducer/types';

type IResponse = Record<string, Record<string, unknown> & {
  data?: unknown[];
  [key: string]: unknown;
}>;

describe('defaultNormalize', () => {
  let mockCdeebee: CdeebeeState<unknown>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    mockCdeebee = {
      settings: {
        modules: ['storage'],
        fileKey: 'file',
        bodyKey: 'body',
        primaryKey: 'id',
        mergeWithData: {},
        listStrategy: {},
      },
      storage: {},
      request: {
        active: [],
        errors: {},
        done: {},
      },
    };
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe('replace strategy', () => {
    it('should normalize response with replace strategy', () => {
      const response = {
        userList: {
          data: [
            { id: '1', name: 'John' },
            { id: '2', name: 'Jane' },
          ],
          id: 'id',
        },
      };

      const strategyList: CdeebeeListStrategy<{ userList: string }> = {
        userList: 'replace',
      };

      const result = defaultNormalize(mockCdeebee, response, strategyList);

      expect(result.userList).toEqual({
        '1': { id: '1', name: 'John' },
        '2': { id: '2', name: 'Jane' },
      });
    });

    it('should replace existing data with new data', () => {
      mockCdeebee.storage = {
        userList: {
          '1': { id: '1', name: 'Old John' },
          '3': { id: '3', name: 'Bob' },
        },
      };

      const response = {
        userList: {
          data: [
            { id: '1', name: 'New John' },
            { id: '2', name: 'Jane' },
          ],
          id: 'id',
        },
      };

      const strategyList: CdeebeeListStrategy<unknown> = {
        userList: 'replace',
      };

      const result = defaultNormalize(mockCdeebee, response, strategyList);

      expect(result.userList).toEqual({
        '1': { id: '1', name: 'New John' },
        '2': { id: '2', name: 'Jane' },
      });
      expect(result.userList).not.toHaveProperty('3');
    });
  });

  describe('merge strategy', () => {
    it('should merge new data with existing state', () => {
      mockCdeebee.storage = {
        userList: {
          '1': { id: '1', name: 'John', age: 30 },
          '3': { id: '3', name: 'Bob' },
        },
      };

      const response = {
        userList: {
          data: [
            { id: '1', name: 'John Updated', age: 31 },
            { id: '2', name: 'Jane' },
          ],
          id: 'id',
        },
      };

      const strategyList: CdeebeeListStrategy<unknown> = {
        userList: 'merge',
      };

      const result = defaultNormalize(mockCdeebee, response, strategyList);

      expect(result.userList).toHaveProperty('1');
      expect(result.userList).toHaveProperty('2');
      expect(result.userList).toHaveProperty('3');
      expect((result.userList as Record<string, unknown>)['1']).toMatchObject({
        id: '1',
        name: 'John Updated',
        age: 31,
      });
    });

    it('should create new storage when no existing state', () => {
      const response = {
        userList: {
          data: [
            { id: '1', name: 'John' },
            { id: '2', name: 'Jane' },
          ],
          id: 'id',
        },
      };

      const strategyList: CdeebeeListStrategy<unknown> = {
        userList: 'merge',
      };

      const result = defaultNormalize(mockCdeebee, response, strategyList);

      expect(result.userList).toEqual({
        '1': { id: '1', name: 'John' },
        '2': { id: '2', name: 'Jane' },
      });
    });
  });

  describe('unknown strategy', () => {
    it('should fall back to merge strategy for unknown strategy', () => {
      const response = {
        userList: { data: [ { id: '1', name: 'John' }, ], id: 'id', },
      };

      const strategyList: CdeebeeListStrategy<unknown> = {
        userList: 'unknown',
      };

      const result = defaultNormalize(mockCdeebee, response, strategyList);

      expect(result.userList).toEqual({ '1': { id: '1', name: 'John' }, });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown strategy')
      );
    });
  });

  describe('edge cases', () => {
    it('should skip normalization when primaryKey is not a string', () => {
      const response = {
        userList: {
          data: [ { id: '1', name: 'John' }, ],
          id: 123, // not a string
        },
      };

      const strategyList: CdeebeeListStrategy<unknown> = {
        userList: 'replace',
      };

      const result = defaultNormalize(mockCdeebee, response, strategyList);

      expect(result.userList).toEqual(response.userList);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Primary key')
      );
    });

    it('should remove keys with null values', () => {
      const response = {
        userList: {
          data: [{ id: '1', name: 'John' }],
          id: 'id',
        },
        invalid: null,
      } as unknown as IResponse;

      const strategyList: CdeebeeListStrategy<unknown> = {
        userList: 'replace',
      };

      const result = defaultNormalize(mockCdeebee, response, strategyList);

      expect(result).toHaveProperty('userList');
      expect(result).not.toHaveProperty('invalid');
    });

    it('should remove keys with undefined values', () => {
      const response = {
        userList: {
          data: [{ id: '1', name: 'John' }],
          id: 'id',
        },
        invalid: undefined,
      } as unknown as IResponse;

      const strategyList: CdeebeeListStrategy<unknown> = {
        userList: 'replace',
      };

      const result = defaultNormalize(mockCdeebee, response, strategyList);

      expect(result).toHaveProperty('userList');
      expect(result).not.toHaveProperty('invalid');
    });

    it('should remove keys with string values', () => {
      const response = {
        userList: {
          data: [{ id: '1', name: 'John' }],
          id: 'id',
        },
        message: 'some string',
      } as unknown as IResponse;

      const strategyList: CdeebeeListStrategy<unknown> = {
        userList: 'replace',
      };

      const result = defaultNormalize(mockCdeebee, response, strategyList);

      expect(result).toHaveProperty('userList');
      expect(result).not.toHaveProperty('message');
    });

    it('should skip normalization when response value has no data property', () => {
      const response = {
        userList: {
          id: 'id',
          // no data property
        },
      };

      const strategyList: CdeebeeListStrategy<unknown> = {
        userList: 'replace',
      };

      const result = defaultNormalize(mockCdeebee, response, strategyList);

      expect(result.userList).toEqual(response.userList);
    });

    it('should skip normalization when response value has no primaryKey property', () => {
      const response = {
        userList: {
          data: [{ id: '1', name: 'John' }],
          // no id property matching primaryKey
        },
      };

      const strategyList: CdeebeeListStrategy<unknown> = {
        userList: 'replace',
      };

      const result = defaultNormalize(mockCdeebee, response, strategyList);

      expect(result.userList).toEqual(response.userList);
    });

    it('should skip elements without primaryKey value', () => {
      const response = {
        userList: {
          data: [
            { id: '1', name: 'John' },
            { name: 'Jane' }, // no id
            { id: '3', name: 'Bob' },
          ],
          id: 'id',
        },
      };

      const strategyList: CdeebeeListStrategy<unknown> = {
        userList: 'replace',
      };

      const result = defaultNormalize(mockCdeebee, response, strategyList);

      expect(result.userList).toEqual({
        '1': { id: '1', name: 'John' },
        '3': { id: '3', name: 'Bob' },
      });
      expect(result.userList).not.toHaveProperty('undefined');
    });

    it('should handle empty data array', () => {
      const response = {
        userList: {
          data: [],
          id: 'id',
        },
      };

      const strategyList: CdeebeeListStrategy<unknown> = {
        userList: 'replace',
      };

      const result = defaultNormalize(mockCdeebee, response, strategyList);

      expect(result.userList).toEqual({});
    });
  });

  describe('multiple keys', () => {
    it('should handle multiple keys with different strategies', () => {
      mockCdeebee.storage = {
        userList: {
          '1': { id: '1', name: 'Old John' },
        },
        postList: {
          '1': { id: '1', title: 'Old Post' },
        },
      };

      const response = {
        userList: {
          data: [{ id: '1', name: 'New John' }],
          id: 'id',
        },
        postList: {
          data: [{ id: '2', title: 'New Post' }],
          id: 'id',
        },
      };

      const strategyList: CdeebeeListStrategy<unknown> = {
        userList: 'replace',
        postList: 'merge',
      };

      const result = defaultNormalize(mockCdeebee, response, strategyList);

      expect(result.userList).toEqual({
        '1': { id: '1', name: 'New John' },
      });
      expect(result.postList).toHaveProperty('1');
      expect(result.postList).toHaveProperty('2');
    });

    it('should handle keys without strategy (undefined strategy)', () => {
      const response = {
        userList: { data: [{ id: '1', name: 'John' }], id: 'id', },
      };

      const strategyList: CdeebeeListStrategy<unknown> = {};

      const result = defaultNormalize(mockCdeebee, response, strategyList);

      // Should fall back to merge
      expect(result.userList).toEqual({
        '1': { id: '1', name: 'John' },
      });
    });
  });

  describe('custom primaryKey', () => {
    it('should use custom primaryKey from settings', () => {
      mockCdeebee.settings.primaryKey = 'uuid';

      const response = {
        userList: {
          data: [
            { uuid: 'user-1', name: 'John' },
            { uuid: 'user-2', name: 'Jane' },
          ],
          uuid: 'uuid',
        },
      };

      const strategyList: CdeebeeListStrategy<unknown> = {
        userList: 'replace',
      };

      const result = defaultNormalize(mockCdeebee, response, strategyList);

      expect(result.userList).toEqual({
        'user-1': { uuid: 'user-1', name: 'John' },
        'user-2': { uuid: 'user-2', name: 'Jane' },
      });
    });
  });

  describe('complex data structures', () => {
    it('should handle nested objects in data elements', () => {
      const response = {
        userList: {
          data: [ { id: '1', name: 'John', profile: { age: 30, city: 'NYC', }, }, ],
          id: 'id',
        },
      };

      const strategyList: CdeebeeListStrategy<unknown> = {
        userList: 'replace',
      };

      const result = defaultNormalize(mockCdeebee, response, strategyList);

      expect(result.userList).toEqual({ '1': { id: '1', name: 'John', profile: { age: 30, city: 'NYC', }, } });
    });

    it('should handle deep merge correctly', () => {
      mockCdeebee.storage = {
        userList: { '1': { id: '1', name: 'John', profile: { age: 30, city: 'NYC', }, } },
      };

      const response = {
        userList: { data: [ { id: '1', name: 'John Updated', profile: { age: 31, }, }, ], id: 'id' },
      };

      const strategyList: CdeebeeListStrategy<unknown> = {
        userList: 'merge',
      };

      const result = defaultNormalize(mockCdeebee, response, strategyList);

      const user1 = (result.userList as Record<string, unknown>)['1'] as Record<string, unknown>;
      expect(user1.name).toBe('John Updated');
      expect(user1.profile).toMatchObject({
        age: 31,
        city: 'NYC', // should be preserved from merge
      });
    });
  });
});


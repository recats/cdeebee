import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defaultNormalize } from '../../../lib/reducer/storage';
import { type CdeebeeState, type CdeebeeListStrategy } from '../../../lib/reducer/types';

type IResponse = Record<string, Record<string, unknown>>;

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
        mergeWithData: {},
        mergeWithHeaders: {},
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
    it('should use data array with primaryKey and replace strategy', () => {
      const response = {
        userList: {
          data: [
            { id: '1', name: 'John' },
            { id: '2', name: 'Jane' },
          ],
          primaryKey: 'id',
        },
      } as unknown as IResponse;

      const strategyList: CdeebeeListStrategy<{ userList: string }> = {
        userList: 'replace',
      };

      const result = defaultNormalize(mockCdeebee, response, strategyList);

      expect(result.userList).toEqual({
        '1': { id: '1', name: 'John' },
        '2': { id: '2', name: 'Jane' },
      });
    });

    it('should replace existing data with new data from array format', () => {
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
          primaryKey: 'id',
        },
      } as unknown as IResponse;

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
    it('should merge new data with existing state from array format', () => {
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
          primaryKey: 'id',
        },
      } as unknown as IResponse;

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

    it('should create new storage when no existing state from array format', () => {
      const response = {
        userList: {
          data: [
            { id: '1', name: 'John' },
            { id: '2', name: 'Jane' },
          ],
          primaryKey: 'id',
        },
      } as unknown as IResponse;

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
        userList: {
          data: [
            { id: '1', name: 'John' },
          ],
          primaryKey: 'id',
        },
      } as unknown as IResponse;

      const strategyList: CdeebeeListStrategy<unknown> = {
        userList: 'unknown' as any,
      };

      const result = defaultNormalize(mockCdeebee, response, strategyList);

      expect(result.userList).toEqual({
        '1': { id: '1', name: 'John' },
      });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown strategy')
      );
    });
  });

  describe('edge cases', () => {
    it('should remove keys with null values', () => {
      const response = {
        userList: {
          data: [
            { id: '1', name: 'John' },
          ],
          primaryKey: 'id',
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
          data: [
            { id: '1', name: 'John' },
          ],
          primaryKey: 'id',
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
          data: [
            { id: '1', name: 'John' },
          ],
          primaryKey: 'id',
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

    it('should handle non-normalized objects as-is', () => {
      const response = {
        userList: {
          '1': { id: '1', name: 'John' },
        },
        config: {
          theme: 'dark',
          language: 'en',
        },
      };

      const strategyList: CdeebeeListStrategy<unknown> = {
        userList: 'replace',
      };

      const result = defaultNormalize(mockCdeebee, response, strategyList);

      expect(result.userList).toEqual({
        '1': { id: '1', name: 'John' },
      });
      expect(result.config).toEqual({
        theme: 'dark',
        language: 'en',
      });
    });

    it('should replace existing data with empty object when using replace strategy', () => {
      mockCdeebee.storage = {
        userList: {
          '1': { id: '1', name: 'John' },
          '2': { id: '2', name: 'Jane' },
        },
      };

      const response = {
        userList: {},
      };

      const strategyList: CdeebeeListStrategy<unknown> = {
        userList: 'replace',
      };

      const result = defaultNormalize(mockCdeebee, response, strategyList);

      expect(result.userList).toEqual({});
      expect(Object.keys(result.userList as Record<string, unknown>)).toHaveLength(0);
    });

    it('should preserve existing data when empty object comes with merge strategy', () => {
      mockCdeebee.storage = {
        userList: {
          '1': { id: '1', name: 'John' },
          '2': { id: '2', name: 'Jane' },
        },
      };

      const response = {
        userList: {},
      };

      const strategyList: CdeebeeListStrategy<unknown> = {
        userList: 'merge',
      };

      const result = defaultNormalize(mockCdeebee, response, strategyList);

      expect(result.userList).toEqual({
        '1': { id: '1', name: 'John' },
        '2': { id: '2', name: 'Jane' },
      });
      expect(Object.keys(result.userList as Record<string, unknown>)).toHaveLength(2);
      expect((result.userList as Record<string, unknown>)['1']).toEqual({ id: '1', name: 'John' });
      expect((result.userList as Record<string, unknown>)['2']).toEqual({ id: '2', name: 'Jane' });
    });

    it('should handle empty objects in single request: merge preserves data, replace erases data', () => {
      mockCdeebee.storage = {
        userList: {
          '1': { id: '1', name: 'John' },
          '2': { id: '2', name: 'Jane' },
        },
        postList: {
          '1': { id: '1', title: 'Post 1' },
          '2': { id: '2', title: 'Post 2' },
        },
      };

      const response = {
        userList: {},
        postList: {},
      };

      const strategyList: CdeebeeListStrategy<unknown> = {
        userList: 'merge',
        postList: 'replace',
      };

      const result = defaultNormalize(mockCdeebee, response, strategyList);

      expect(result.userList).toEqual({
        '1': { id: '1', name: 'John' },
        '2': { id: '2', name: 'Jane' },
      });
      expect(Object.keys(result.userList as Record<string, unknown>)).toHaveLength(2);

      expect(result.postList).toEqual({});
      expect(Object.keys(result.postList as Record<string, unknown>)).toHaveLength(0);
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
          '1': { id: '1', name: 'New John' },
        },
        postList: {
          '2': { id: '2', title: 'New Post' },
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
        userList: {
          '1': { id: '1', name: 'John' },
        },
      };

      const strategyList: CdeebeeListStrategy<unknown> = {};

      const result = defaultNormalize(mockCdeebee, response, strategyList);

      // Should fall back to merge
      expect(result.userList).toEqual({
        '1': { id: '1', name: 'John' },
      });
    });
  });

  describe('complex data structures', () => {
    it('should handle nested objects in normalized data', () => {
      const response = {
        userList: {
          '1': { id: '1', name: 'John', profile: { age: 30, city: 'NYC' } },
        },
      };

      const strategyList: CdeebeeListStrategy<unknown> = {
        userList: 'replace',
      };

      const result = defaultNormalize(mockCdeebee, response, strategyList);

      expect(result.userList).toEqual({
        '1': { id: '1', name: 'John', profile: { age: 30, city: 'NYC' } },
      });
    });

    it('should handle deep merge correctly', () => {
      mockCdeebee.storage = {
        userList: {
          '1': { id: '1', name: 'John', profile: { age: 30, city: 'NYC' } },
        },
      };

      const response = {
        userList: {
          '1': { id: '1', name: 'John Updated', profile: { age: 31 } },
        },
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

    it('should handle storage that is not a record', () => {
      mockCdeebee.storage = 'not an object' as unknown as Record<string, unknown>;
      const response: IResponse = {
        userList: {
          '1': { id: '1', name: 'John' },
        },
      };

      const result = defaultNormalize(mockCdeebee, response, {});

      expect(result).toEqual({
        userList: {
          '1': { id: '1', name: 'John' },
        },
      });
    });
  });

  describe('data with primaryKey format', () => {
    it('should convert data array with primaryKey to normalized object structure', () => {
      const response = {
        sessionList: {
          data: [
            {
              sessionID: 1,
              token: 'da6ec385bc7e4f84a510c3ecca07f3',
              expiresAt: '2034-03-28T22:36:09',
            },
          ],
          primaryKey: 'sessionID',
        },
      } as unknown as IResponse;

      const strategyList: CdeebeeListStrategy<unknown> = {
        sessionList: 'replace',
      };

      const result = defaultNormalize(mockCdeebee, response, strategyList);

      expect(result.sessionList).toEqual({
        '1': {
          sessionID: 1,
          token: 'da6ec385bc7e4f84a510c3ecca07f3',
          expiresAt: '2034-03-28T22:36:09',
        },
      });
    });

    it('should handle multiple items in data array with primaryKey', () => {
      const response = {
        sessionList: {
          data: [
            {
              sessionID: 1,
              token: 'token1',
              expiresAt: '2034-03-28T22:36:09',
            },
            {
              sessionID: 2,
              token: 'token2',
              expiresAt: '2034-03-29T22:36:09',
            },
          ],
          primaryKey: 'sessionID',
        },
      } as unknown as IResponse;

      const strategyList: CdeebeeListStrategy<unknown> = {
        sessionList: 'replace',
      };

      const result = defaultNormalize(mockCdeebee, response, strategyList);

      expect(result.sessionList).toEqual({
        '1': {
          sessionID: 1,
          token: 'token1',
          expiresAt: '2034-03-28T22:36:09',
        },
        '2': {
          sessionID: 2,
          token: 'token2',
          expiresAt: '2034-03-29T22:36:09',
        },
      });
    });

    it('should merge data array with primaryKey with existing data using merge strategy', () => {
      mockCdeebee.storage = {
        sessionList: {
          '1': {
            sessionID: 1,
            token: 'old-token',
            expiresAt: '2034-03-27T22:36:09',
          },
        },
      };

      const response = {
        sessionList: {
          data: [
            {
              sessionID: 1,
              token: 'new-token',
              expiresAt: '2034-03-28T22:36:09',
            },
            {
              sessionID: 2,
              token: 'token2',
              expiresAt: '2034-03-29T22:36:09',
            },
          ],
          primaryKey: 'sessionID',
        },
      } as unknown as IResponse;

      const strategyList: CdeebeeListStrategy<unknown> = {
        sessionList: 'merge',
      };

      const result = defaultNormalize(mockCdeebee, response, strategyList);

      expect(result.sessionList).toEqual({
        '1': {
          sessionID: 1,
          token: 'new-token',
          expiresAt: '2034-03-28T22:36:09',
        },
        '2': {
          sessionID: 2,
          token: 'token2',
          expiresAt: '2034-03-29T22:36:09',
        },
      });
    });

    it('should replace existing data when using replace strategy with data array', () => {
      mockCdeebee.storage = {
        sessionList: {
          '1': {
            sessionID: 1,
            token: 'old-token',
            expiresAt: '2034-03-27T22:36:09',
          },
          '3': {
            sessionID: 3,
            token: 'token3',
            expiresAt: '2034-03-30T22:36:09',
          },
        },
      };

      const response = {
        sessionList: {
          data: [
            {
              sessionID: 1,
              token: 'new-token',
              expiresAt: '2034-03-28T22:36:09',
            },
          ],
          primaryKey: 'sessionID',
        },
      } as unknown as IResponse;

      const strategyList: CdeebeeListStrategy<unknown> = {
        sessionList: 'replace',
      };

      const result = defaultNormalize(mockCdeebee, response, strategyList);

      expect(result.sessionList).toEqual({
        '1': {
          sessionID: 1,
          token: 'new-token',
          expiresAt: '2034-03-28T22:36:09',
        },
      });
      expect(result.sessionList).not.toHaveProperty('3');
    });

    it('should handle empty data array with primaryKey', () => {
      const response = {
        sessionList: {
          data: [],
          primaryKey: 'sessionID',
        },
      } as unknown as IResponse;

      const strategyList: CdeebeeListStrategy<unknown> = {
        sessionList: 'replace',
      };

      const result = defaultNormalize(mockCdeebee, response, strategyList);

      expect(result.sessionList).toEqual({});
    });

    it('should handle string primaryKey values', () => {
      const response = {
        userList: {
          data: [
            {
              id: 'user-1',
              name: 'John',
            },
            {
              id: 'user-2',
              name: 'Jane',
            },
          ],
          primaryKey: 'id',
        },
      } as unknown as IResponse;

      const strategyList: CdeebeeListStrategy<unknown> = {
        userList: 'replace',
      };

      const result = defaultNormalize(mockCdeebee, response, strategyList);

      expect(result.userList).toEqual({
        'user-1': {
          id: 'user-1',
          name: 'John',
        },
        'user-2': {
          id: 'user-2',
          name: 'Jane',
        },
      });
    });
  });
});

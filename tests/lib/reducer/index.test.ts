import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';

import { factory } from '../../../lib/reducer/index';
import { request } from '../../../lib/reducer/request';
import { type CdeebeeSettings, type CdeebeeListStrategy, CdeebeeState } from '../../../lib/reducer/types';

// Mock fetch globally
global.fetch = vi.fn();

// Helper to create store with proper middleware configuration for tests
const createTestStore = (reducer: ReturnType<typeof factory<Record<string, unknown>>>['reducer']) => {
  return configureStore({
    reducer: {
      cdeebee: reducer as any,
    },
    middleware: getDefaultMiddleware =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredPaths: ['cdeebee.settings.normalize'],
        },
      }),
  });
};

describe('factory', () => {
  let settings: CdeebeeSettings<Record<string, unknown>>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    settings = {
      modules: ['history', 'listener', 'storage', 'cancelation'],
      fileKey: 'file',
      bodyKey: 'value',
      primaryKey: 'id',
      mergeWithData: {},
      listStrategy: {},
    };
  });

  it('should create a slice with correct name', () => {
    const slice = factory(settings);
    expect(slice.name).toBe('cdeebee');
  });

  it('should merge initial settings with provided settings', () => {
      const customSettings: CdeebeeSettings<Record<string, unknown>> = {
      modules: ['history'],
      fileKey: 'customFile',
      bodyKey: 'customBody',
      primaryKey: 'customId',
      mergeWithData: { custom: 'data' },
      listStrategy: { list: 'merge' },
    };

    const slice = factory(customSettings);
    const store = createTestStore(slice.reducer);

    const state = store.getState().cdeebee as CdeebeeState<Record<string, unknown>>;
    expect(state.settings.fileKey).toBe('customFile');
    expect(state.settings.bodyKey).toBe('customBody');
    expect(state.settings.primaryKey).toBe('customId');
  });

  it('should have correct initial state structure', () => {
    const slice = factory(settings);
    const store = createTestStore(slice.reducer);

    const state = store.getState().cdeebee as CdeebeeState<Record<string, unknown>>;
    expect(state).toHaveProperty('settings');
    expect(state).toHaveProperty('storage');
    expect(state).toHaveProperty('request');
    expect(state.request).toHaveProperty('active');
    expect(state.request).toHaveProperty('errors');
    expect(state.request).toHaveProperty('done');
    expect(Array.isArray(state.request.active)).toBe(true);
    expect(typeof state.request.errors).toBe('object');
    expect(typeof state.request.done).toBe('object');
  });

  describe('listener module', () => {
    it('should track active requests when listener module is enabled', async () => {
      const slice = factory(settings);
      const store = configureStore({
        reducer: {
          cdeebee: slice.reducer,
        },
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: 'test' }),
      } as Response);

      const options = { api: '/api/test' };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dispatch = store.dispatch as any;
      const promise = dispatch(request(options));

      let state = store.getState().cdeebee;
      expect(state.request.active.length).toBeGreaterThan(0);
      expect(state.request.active[0]).toHaveProperty('api', '/api/test');
      expect(state.request.active[0]).toHaveProperty('requestId');

      await promise;

      state = store.getState().cdeebee;
      expect(state.request.active.length).toBe(0);
    });

    it('should not track active requests when listener module is disabled', async () => {
      const settingsWithoutListener: CdeebeeSettings<Record<string, unknown>> = {
        ...settings,
        modules: ['history', 'storage', 'cancelation'],
      };

      const slice = factory(settingsWithoutListener);
      const store = configureStore({
        reducer: {
          cdeebee: slice.reducer,
        },
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: 'test' }),
      } as Response);

      const options = { api: '/api/test' };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dispatch = store.dispatch as any;
      await dispatch(request(options));

      const state = store.getState().cdeebee;
      expect(state.request.active.length).toBe(0);
    });
  });

  describe('history module', () => {
    it('should track successful requests when history module is enabled', async () => {
      const slice = factory(settings);
      const store = configureStore({
        reducer: {
          cdeebee: slice.reducer,
        },
      });

      const mockResponse = { data: 'test' };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const options = { api: '/api/test' };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dispatch = store.dispatch as any;
      await dispatch(request(options));

      const state = store.getState().cdeebee;
      expect(state.request.done['/api/test']).toBeDefined();
      expect(state.request.done['/api/test'].length).toBe(1);
      expect(state.request.done['/api/test'][0]).toHaveProperty('api', '/api/test');
      expect(state.request.done['/api/test'][0]).toHaveProperty('requestId');
      expect(state.request.done['/api/test'][0]).toHaveProperty('request');
    });

    it('should track failed requests when history module is enabled', async () => {
      const slice = factory(settings);
      const store = configureStore({
        reducer: {
          cdeebee: slice.reducer,
        },
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const options = { api: '/api/test' };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dispatch = store.dispatch as any;
      await dispatch(request(options));

      const state = store.getState().cdeebee;
      expect(state.request.errors['/api/test']).toBeDefined();
      expect(state.request.errors['/api/test'].length).toBe(1);
      expect(state.request.errors['/api/test'][0]).toHaveProperty('api', '/api/test');
      expect(state.request.errors['/api/test'][0]).toHaveProperty('requestId');
    });

    it('should not track history when history module is disabled', async () => {
      const settingsWithoutHistory: CdeebeeSettings<Record<string, unknown>> = {
        ...settings,
        modules: ['listener', 'storage', 'cancelation'],
      };

      const slice = factory(settingsWithoutHistory);
      const store = configureStore({
        reducer: {
          cdeebee: slice.reducer,
        },
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: 'test' }),
      } as Response);

      const options = { api: '/api/test' };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dispatch = store.dispatch as any;
      await dispatch(request(options));

      const state = store.getState().cdeebee;
      expect(state.request.done['/api/test']).toBeUndefined();
    });

    it('should accumulate multiple requests for the same API', async () => {
      const slice = factory(settings);
      const store = configureStore({
        reducer: {
          cdeebee: slice.reducer,
        },
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ data: 'test' }),
      } as Response);

      const options = { api: '/api/test' };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dispatch = store.dispatch as any;
      await dispatch(request(options));
      await store.dispatch(request(options));
      await store.dispatch(request(options));

      const state = store.getState().cdeebee;
      expect(state.request.done['/api/test'].length).toBe(3);
    });
  });

  describe('cancelation module', () => {
    it('should abort previous requests when cancelation module is enabled', async () => {
      const slice = factory(settings);
      const store = configureStore({
        reducer: {
          cdeebee: slice.reducer,
        },
      });

      let resolveFirstRequest: (value: Response) => void;
      const firstRequestPromise = new Promise<Response>(resolve => {
        resolveFirstRequest = resolve;
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(() => firstRequestPromise);

      const options = { api: '/api/test' };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dispatch = store.dispatch as any;
      const firstRequest = dispatch(request(options));

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: 'second' }),
      } as Response);

      const secondRequest = dispatch(request(options));

      resolveFirstRequest!({
        ok: true,
        json: async () => ({ data: 'first' }),
      } as Response);

      await Promise.allSettled([firstRequest, secondRequest]);
    });

    it('should not abort requests when cancelation module is disabled', async () => {
      const settingsWithoutCancelation: CdeebeeSettings<Record<string, unknown>> = {
        ...settings,
        modules: ['history', 'listener', 'storage'],
      };

      const slice = factory(settingsWithoutCancelation);
      const store = configureStore({
        reducer: {
          cdeebee: slice.reducer,
        },
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ data: 'test' }),
      } as Response);

      const options = { api: '/api/test' };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dispatch = store.dispatch as any;
      await dispatch(request(options));
      await store.dispatch(request(options));

      const state = store.getState().cdeebee;
      expect(state.request.done['/api/test']?.length).toBe(2);
    });
  });

  describe('storage module', () => {
    it('should normalize and store data when storage module is enabled', async () => {
      const slice = factory(settings);
      const store = configureStore({
        reducer: {
          cdeebee: slice.reducer,
        },
      });

      const mockResponse = {
        userList: {
          data: [
            { id: '1', name: 'John' },
            { id: '2', name: 'Jane' },
          ],
          id: 'id',
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const options = { api: '/api/userList' };
      await store.dispatch(request(options));

      const state = store.getState().cdeebee;
      expect(state.storage).toBeDefined();
      expect((state.storage as Record<string, unknown>).userList).toBeDefined();
      expect((state.storage as Record<string, unknown>).userList).toHaveProperty('1');
      expect((state.storage as Record<string, unknown>).userList).toHaveProperty('2');
    });

    it('should use replace strategy from settings', async () => {
      const settingsWithStrategy: CdeebeeSettings<Record<string, unknown>> = {
        ...settings,
        listStrategy: {
          userList: 'replace',
        },
      };

      const slice = factory(settingsWithStrategy);
      const store = configureStore({
        reducer: {
          cdeebee: slice.reducer,
        },
      });

      const mockResponse = {
        userList: {
          data: [
            { id: '1', name: 'John' },
            { id: '2', name: 'Jane' },
          ],
          id: 'id',
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const options = { api: '/api/userList' };
      await store.dispatch(request(options));

      const state = store.getState().cdeebee;
      const userList = (state.storage as Record<string, unknown>).userList as Record<string, unknown>;
      expect(userList).toEqual({
        '1': { id: '1', name: 'John' },
        '2': { id: '2', name: 'Jane' },
      });
    });

    it('should use merge strategy from settings', async () => {
      const settingsWithStrategy: CdeebeeSettings<Record<string, unknown>> = {
        ...settings,
        listStrategy: {
          userList: 'merge',
        },
      };

      const slice = factory(settingsWithStrategy);
      const store = configureStore({
        reducer: {
          cdeebee: slice.reducer,
        },
      });

      // First request - initial data
      const firstResponse = {
        userList: {
          data: [
            { id: '1', name: 'John' },
            { id: '3', name: 'Bob' },
          ],
          id: 'id',
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => firstResponse,
      } as Response);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dispatch = store.dispatch as any;
      await dispatch(request({ api: '/api/userList' }));

      // Second request - merge new data
      const secondResponse = {
        userList: {
          data: [
            { id: '1', name: 'John Updated' },
            { id: '2', name: 'Jane' },
          ],
          id: 'id',
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => secondResponse,
      } as Response);

      await dispatch(request({ api: '/api/userList' }));

      const state = store.getState().cdeebee;
      const userList = (state.storage as Record<string, unknown>).userList as Record<string, unknown>;
      
      // Should have all three userList (merged)
      expect(userList).toHaveProperty('1');
      expect(userList).toHaveProperty('2');
      expect(userList).toHaveProperty('3');
      // User 1 should be updated
      expect((userList['1'] as Record<string, unknown>).name).toBe('John Updated');
    });

    it('should use listStrategy from request options over settings', async () => {
      const settingsWithStrategy: CdeebeeSettings<Record<string, unknown>> = {
        ...settings,
        listStrategy: {
          userList: 'merge',
        },
      };

      const slice = factory(settingsWithStrategy);
      const store = configureStore({
        reducer: {
          cdeebee: slice.reducer,
        },
      });

      const mockResponse = {
        userList: {
          data: [
            { id: '1', name: 'John' },
          ],
          id: 'id',
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const options = {
        api: '/api/userList',
        listStrategy: {
          userList: 'replace' as const,
        } as CdeebeeListStrategy<Record<string, unknown>>,
      };

      await store.dispatch(request(options));

      const state = store.getState().cdeebee;
      const userList = (state.storage as Record<string, unknown>).userList as Record<string, unknown>;
      expect(userList).toEqual({
        '1': { id: '1', name: 'John' },
      });
    });

    it('should use custom normalize function from request options over settings', async () => {
      const settingsNormalize = vi.fn() as CdeebeeSettings<Record<string, unknown>>['normalize'];
      const optionsNormalize = vi.fn((_, result) => {
        return { fromOptions: true, original: result };
      }) as CdeebeeSettings<Record<string, unknown>>['normalize'];

      const settingsWithNormalize: CdeebeeSettings<Record<string, unknown>> = {
        ...settings,
        normalize: settingsNormalize,
      };

      const slice = factory(settingsWithNormalize);
      const store = configureStore({
        reducer: {
          cdeebee: slice.reducer,
        },
      });

      const mockResponse = { data: 'test' };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const options = {
        api: '/api/test',
        normalize: optionsNormalize,
      };

      await store.dispatch(request(options));

      expect(settingsNormalize).not.toHaveBeenCalled();
      expect(optionsNormalize).toHaveBeenCalledTimes(1);

      const state = store.getState().cdeebee;
      expect(state.storage).toHaveProperty('fromOptions', true);
    });

    it('should not normalize data when storage module is disabled', async () => {
      const settingsWithoutStorage: CdeebeeSettings<Record<string, unknown>> = {
        ...settings,
        modules: ['history', 'listener', 'cancelation'],
      };

      const slice = factory(settingsWithoutStorage);
      const store = configureStore({
        reducer: {
          cdeebee: slice.reducer,
        },
      });

      const mockResponse = {
        userList: {
          data: [{ id: '1', name: 'John' }],
          id: 'id',
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const options = { api: '/api/userList' };
      await store.dispatch(request(options));

      const state = store.getState().cdeebee;
      expect(state.storage).toEqual({});
    });

    it('should handle multiple APIs with different strategies', async () => {
      const settingsWithStrategies: CdeebeeSettings<Record<string, unknown>> = {
        ...settings,
        listStrategy: {
          userList: 'replace',
          postList: 'merge',
        },
      };

      const slice = factory(settingsWithStrategies);
      const store = createTestStore(slice.reducer);

      // First request for userList
      const userListResponse = {
        userList: {
          data: [{ id: '1', name: 'John' }],
          id: 'id',
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true, json: async () => userListResponse } as Response);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dispatch = store.dispatch as any;
      await dispatch(request({ api: '/api/userList' }));

      const postListResponse = {
        postList: {
          data: [{ id: '1', title: 'Post 1' }],
          id: 'id',
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true, json: async () => postListResponse, } as Response);

      await dispatch(request({ api: '/api/postList' }));

      const state = store.getState().cdeebee as CdeebeeState<Record<string, unknown>>;
      const storage = state.storage as Record<string, unknown>;
      
      expect(storage.userList).toBeDefined();
      expect(storage.postList).toBeDefined();
      expect((storage.userList as Record<string, unknown>)).toHaveProperty('1');
      expect((storage.postList as Record<string, unknown>)).toHaveProperty('1');
    });

    it('should handle empty response', async () => {
      const slice = factory(settings);
      const store = configureStore({
        reducer: {
          cdeebee: slice.reducer,
        },
      });

      const mockResponse = {};
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const options = { api: '/api/test' };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dispatch = store.dispatch as any;
      await dispatch(request(options));

      const state = store.getState().cdeebee;
      expect(state.storage).toBeDefined();
    });

    it('should handle response with invalid data structure', async () => {
      const slice = factory(settings);
      const store = configureStore({
        reducer: {
          cdeebee: slice.reducer,
        },
      });

      const mockResponse = {
        invalid: null,
        message: 'some string',
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const options = { api: '/api/test' };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dispatch = store.dispatch as any;
      await dispatch(request(options));

      const state = store.getState().cdeebee;
      const storage = state.storage as Record<string, unknown>;
      // Invalid keys should be removed
      expect(storage).not.toHaveProperty('invalid');
      expect(storage).not.toHaveProperty('message');
    });

    it('should use defaultNormalize when no custom normalize is provided', async () => {
      const slice = factory(settings);
      const store = configureStore({
        reducer: {
          cdeebee: slice.reducer,
        },
      });

      const mockResponse = {
        userList: {
          data: [
            { id: '1', name: 'John' },
            { id: '2', name: 'Jane' },
          ],
          id: 'id',
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const options = { api: '/api/userList' };
      await store.dispatch(request(options));

      const state = store.getState().cdeebee;
      const userList = (state.storage as Record<string, unknown>).userList as Record<string, unknown>;
      
      // defaultNormalize should normalize the data
      expect(userList).toHaveProperty('1');
      expect(userList).toHaveProperty('2');
      expect((userList['1'] as Record<string, unknown>).name).toBe('John');
      expect((userList['2'] as Record<string, unknown>).name).toBe('Jane');
    });
  });
});


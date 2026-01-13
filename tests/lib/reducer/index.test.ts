import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type CdeebeeSettings, type CdeebeeListStrategy, CdeebeeState } from '../../../lib/reducer/types';
import { factory } from '../../../lib/reducer/index';
import { request } from '../../../lib/reducer/request';
import { createMockResponse, createTestStore, defaultTestSettings, mockFetch, mockFetchAlways } from '../test-helpers';

describe('factory', () => {
  let settings: CdeebeeSettings<Record<string, unknown>>;

  beforeEach(() => {
    vi.clearAllMocks();
    settings = defaultTestSettings();
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
      mergeWithData: { custom: 'data' },
      mergeWithHeaders: {},
      listStrategy: { list: 'merge' },
    };

    const store = createTestStore(customSettings);

    const state = store.getState().cdeebee as CdeebeeState<Record<string, unknown>>;
    expect(state.settings.fileKey).toBe('customFile');
    expect(state.settings.bodyKey).toBe('customBody');
  });

  it('should have correct initial state structure', () => {
    const store = createTestStore(settings);

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
      const store = createTestStore(settings);

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        createMockResponse({ json: async () => ({ data: 'test' }) })
      );

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

      const store = createTestStore(settingsWithoutListener);

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        createMockResponse({ json: async () => ({ data: 'test' }) })
      );

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
      const store = createTestStore(settings);

      const mockResponse = { data: 'test' };
      mockFetch(createMockResponse({ json: async () => mockResponse }));

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
      const store = createTestStore(settings);

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        createMockResponse({ ok: false, status: 500 })
      );

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

      const store = createTestStore(settingsWithoutHistory);

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        createMockResponse({ json: async () => ({ data: 'test' }) })
      );

      const options = { api: '/api/test' };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dispatch = store.dispatch as any;
      await dispatch(request(options));

      const state = store.getState().cdeebee;
      expect(state.request.done['/api/test']).toBeUndefined();
    });

    it('should accumulate multiple requests for the same API', async () => {
      const store = createTestStore(settings);

      mockFetchAlways(createMockResponse({ json: async () => ({ data: 'test' }) }));

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
      const store = createTestStore(settings);

      let resolveFirstRequest: (value: Response) => void;
      const firstRequestPromise = new Promise<Response>(resolve => {
        resolveFirstRequest = resolve;
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(() => firstRequestPromise);

      const options = { api: '/api/test' };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dispatch = store.dispatch as any;
      const firstRequest = dispatch(request(options));

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        createMockResponse({ json: async () => ({ data: 'second' }) })
      );

      const secondRequest = dispatch(request(options));

      resolveFirstRequest!(
        createMockResponse({ json: async () => ({ data: 'first' }) })
      );

      await Promise.allSettled([firstRequest, secondRequest]);
    });

    it('should not abort requests when cancelation module is disabled', async () => {
      const settingsWithoutCancelation: CdeebeeSettings<Record<string, unknown>> = {
        ...settings,
        modules: ['history', 'listener', 'storage'],
      };

      const store = createTestStore(settingsWithoutCancelation);

      mockFetchAlways(createMockResponse({ json: async () => ({ data: 'test' }) }));

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
      const store = createTestStore(settings);

      const mockResponse = {
        userList: {
          '1': { id: '1', name: 'John' },
          '2': { id: '2', name: 'Jane' },
        },
      };

      mockFetch(createMockResponse({ json: async () => mockResponse }));

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

      const store = createTestStore(settingsWithStrategy);

      const mockResponse = {
        userList: {
          '1': { id: '1', name: 'John' },
          '2': { id: '2', name: 'Jane' },
        },
      };

      mockFetch(createMockResponse({ json: async () => mockResponse }));

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

      const store = createTestStore(settingsWithStrategy);

      // First request - initial data
      const firstResponse = {
        userList: {
          '1': { id: '1', name: 'John' },
          '3': { id: '3', name: 'Bob' },
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        createMockResponse({ json: async () => firstResponse })
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dispatch = store.dispatch as any;
      await dispatch(request({ api: '/api/userList' }));

      // Second request - merge new data
      const secondResponse = {
        userList: {
          '1': { id: '1', name: 'John Updated' },
          '2': { id: '2', name: 'Jane' },
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        createMockResponse({ json: async () => secondResponse })
      );

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

      const store = createTestStore(settingsWithStrategy);

      const mockResponse = {
        userList: {
          '1': { id: '1', name: 'John' },
        },
      };

      mockFetch(createMockResponse({ json: async () => mockResponse }));

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

      const store = createTestStore(settingsWithNormalize);

      const mockResponse = { data: 'test' };
      mockFetch(createMockResponse({ json: async () => mockResponse }));

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

      const store = createTestStore(settingsWithoutStorage);

      const mockResponse = {
        userList: {
          '1': { id: '1', name: 'John' },
        },
      };

      mockFetch(createMockResponse({ json: async () => mockResponse }));

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

      const store = createTestStore(settingsWithStrategies);

      // First request for userList
      const userListResponse = {
        userList: {
          '1': { id: '1', name: 'John' },
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        createMockResponse({ json: async () => userListResponse })
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dispatch = store.dispatch as any;
      await dispatch(request({ api: '/api/userList' }));

      const postListResponse = {
        postList: {
          '1': { id: '1', title: 'Post 1' },
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        createMockResponse({ json: async () => postListResponse })
      );

      await dispatch(request({ api: '/api/postList' }));

      const state = store.getState().cdeebee as CdeebeeState<Record<string, unknown>>;
      const storage = state.storage as Record<string, unknown>;
      
      expect(storage.userList).toBeDefined();
      expect(storage.postList).toBeDefined();
      expect((storage.userList as Record<string, unknown>)).toHaveProperty('1');
      expect((storage.postList as Record<string, unknown>)).toHaveProperty('1');
    });

    it('should handle empty response', async () => {
      const store = createTestStore(settings);

      const mockResponse = {};
      mockFetch(createMockResponse({ json: async () => mockResponse }));

      const options = { api: '/api/test' };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dispatch = store.dispatch as any;
      await dispatch(request(options));

      const state = store.getState().cdeebee;
      expect(state.storage).toBeDefined();
    });

    it('should handle response with invalid data structure', async () => {
      const store = createTestStore(settings);

      const mockResponse = {
        invalid: null,
        message: 'some string',
      };

      mockFetch(createMockResponse({ json: async () => mockResponse }));

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
      const store = createTestStore(settings);

      const mockResponse = {
        userList: {
          '1': { id: '1', name: 'John' },
          '2': { id: '2', name: 'Jane' },
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        createMockResponse({
          contentType: 'application/json',
          json: async () => mockResponse,
        })
      );

      const options = { api: '/api/userList' };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dispatch = store.dispatch as any;
      await dispatch(request(options));

      const state = store.getState().cdeebee;
      const userList = (state.storage as Record<string, unknown>).userList as Record<string, unknown>;
      
      // defaultNormalize should normalize the data
      expect(userList).toHaveProperty('1');
      expect(userList).toHaveProperty('2');
      expect((userList['1'] as Record<string, unknown>).name).toBe('John');
      expect((userList['2'] as Record<string, unknown>).name).toBe('Jane');
    });

    it('should not store result in storage when ignore option is true', async () => {
      const initialStorage = { existing: 'data' };
      const storeWithStorage = createTestStore(settings, initialStorage);

      const mockResponse = {
        newData: {
          '1': { id: '1', name: 'New' },
        },
      };

      mockFetch(
        createMockResponse({
          contentType: 'application/json',
          json: async () => mockResponse,
        })
      );

      const options = { api: '/api/test', ignore: true };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dispatch = storeWithStorage.dispatch as any;
      await dispatch(request(options));

      const state = storeWithStorage.getState().cdeebee;
      const storage = state.storage as Record<string, unknown>;
      
      // Storage should remain unchanged when ignore is true
      expect(storage).toEqual(initialStorage);
      expect(storage).not.toHaveProperty('newData');
    });

    it('should not store text/CSV responses in storage', async () => {
      const csvData = 'RecordID,DspID,BundleID\n39021,6,27483';
      const initialStorage = { existing: 'data' };
      const storeWithStorage = createTestStore(settings, initialStorage);

      mockFetch(
        createMockResponse({
          contentType: 'text/csv',
          json: async () => {
            throw new Error('Not JSON');
          },
          text: async () => csvData,
        })
      );

      const options = { api: '/api/export' };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dispatch = storeWithStorage.dispatch as any;
      await dispatch(request(options));

      const state = storeWithStorage.getState().cdeebee;
      const storage = state.storage as Record<string, unknown>;
      
      // Text responses should not be stored (they're not objects)
      expect(storage).toEqual(initialStorage);
    });
  });

  describe('historyClear reducer', () => {
    it('should clear history for a specific API', async () => {
      const store = createTestStore(settings);

      // Create some history first
      mockFetchAlways(createMockResponse({ json: async () => ({ data: 'test' }) }));

      const dispatch = store.dispatch as any;
      await dispatch(request({ api: '/api/test1' }));
      await dispatch(request({ api: '/api/test2' }));

      // Verify history exists
      let state = store.getState().cdeebee;
      expect(state.request.done['/api/test1']).toBeDefined();
      expect(state.request.done['/api/test2']).toBeDefined();

      // Clear history for specific API
      const slice = factory(settings);
      dispatch(slice.actions.historyClear('/api/test1'));

      state = store.getState().cdeebee;
      expect(state.request.done['/api/test1']).toBeUndefined();
      expect(state.request.done['/api/test2']).toBeDefined();
    });

    it('should clear error history for a specific API', async () => {
      const store = createTestStore(settings);

      // Create some error history
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        createMockResponse({ ok: false, status: 500 })
      );

      const dispatch = store.dispatch as any;
      await dispatch(request({ api: '/api/test' }));

      // Verify error history exists
      let state = store.getState().cdeebee;
      expect(state.request.errors['/api/test']).toBeDefined();
      expect(state.request.errors['/api/test'].length).toBe(1);

      // Clear error history
      const slice = factory(settings);
      dispatch(slice.actions.historyClear('/api/test'));

      state = store.getState().cdeebee;
      expect(state.request.errors['/api/test']).toBeUndefined();
    });

    it('should clear all history when no API is provided', async () => {
      const store = createTestStore(settings);

      // Create history for multiple APIs
      mockFetchAlways(createMockResponse({ json: async () => ({ data: 'test' }) }));

      const dispatch = store.dispatch as any;
      await dispatch(request({ api: '/api/test1' }));
      await dispatch(request({ api: '/api/test2' }));
      await dispatch(request({ api: '/api/test3' }));

      // Verify history exists
      let state = store.getState().cdeebee;
      expect(state.request.done['/api/test1']).toBeDefined();
      expect(state.request.done['/api/test2']).toBeDefined();
      expect(state.request.done['/api/test3']).toBeDefined();

      // Clear all history
      const slice = factory(settings);
      dispatch(slice.actions.historyClear());

      state = store.getState().cdeebee;
      expect(state.request.done).toEqual({});
      expect(state.request.errors).toEqual({});
    });

    it('should clear both success and error history when no API is provided', async () => {
      const store = createTestStore(settings);

      // Create success history
      mockFetch(createMockResponse({ json: async () => ({ data: 'test' }) }));
      const dispatch = store.dispatch as any;
      await dispatch(request({ api: '/api/success' }));

      // Create error history
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        createMockResponse({ ok: false, status: 500 })
      );
      await dispatch(request({ api: '/api/error' }));

      // Verify both types of history exist
      let state = store.getState().cdeebee;
      expect(state.request.done['/api/success']).toBeDefined();
      expect(state.request.errors['/api/error']).toBeDefined();

      // Clear all history
      const slice = factory(settings);
      dispatch(slice.actions.historyClear());

      state = store.getState().cdeebee;
      expect(state.request.done).toEqual({});
      expect(state.request.errors).toEqual({});
    });

    it('should auto-clear history before request when historyClear option is true', async () => {
      const store = createTestStore(settings);

      // Create initial history
      mockFetch(createMockResponse({ json: async () => ({ data: 'first' }) }));
      const dispatch = store.dispatch as any;
      await dispatch(request({ api: '/api/test' }));

      // Verify history exists
      let state = store.getState().cdeebee;
      expect(state.request.done['/api/test']).toBeDefined();
      expect(state.request.done['/api/test'].length).toBe(1);

      // Make another request with historyClear: true
      mockFetch(createMockResponse({ json: async () => ({ data: 'second' }) }));
      await dispatch(request({ api: '/api/test', historyClear: true }));

      // History should only have the second request
      state = store.getState().cdeebee;
      expect(state.request.done['/api/test']).toBeDefined();
      expect(state.request.done['/api/test'].length).toBe(1);
      expect(state.request.done['/api/test'][0].request).toHaveProperty('result');
    });

    it('should not auto-clear history when historyClear option is false', async () => {
      const store = createTestStore(settings);

      // Create initial history
      mockFetchAlways(createMockResponse({ json: async () => ({ data: 'test' }) }));
      const dispatch = store.dispatch as any;
      await dispatch(request({ api: '/api/test' }));
      await dispatch(request({ api: '/api/test', historyClear: false }));

      // Both requests should be in history
      const state = store.getState().cdeebee;
      expect(state.request.done['/api/test']).toBeDefined();
      expect(state.request.done['/api/test'].length).toBe(2);
    });

    it('should not clear history when history module is disabled', async () => {
      const settingsWithoutHistory: CdeebeeSettings<Record<string, unknown>> = {
        ...settings,
        modules: ['listener', 'storage', 'cancelation'],
      };

      const store = createTestStore(settingsWithoutHistory);

      // Try to make a request with historyClear: true
      mockFetch(createMockResponse({ json: async () => ({ data: 'test' }) }));
      const dispatch = store.dispatch as any;
      await dispatch(request({ api: '/api/test', historyClear: true }));

      // History should not be tracked at all
      const state = store.getState().cdeebee;
      expect(state.request.done).toEqual({});
      expect(state.request.errors).toEqual({});
    });
  });

  describe('set reducer', () => {
    it('should update a single top-level key in storage', () => {
      const slice = factory(settings);
      const store = createTestStore(settings);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dispatch = store.dispatch as any;
      dispatch(slice.actions.set([
        { key: ['testKey'], value: 'testValue' },
      ]));

      const state = store.getState().cdeebee as CdeebeeState<Record<string, unknown>>;
      expect(state.storage).toHaveProperty('testKey');
      expect((state.storage as Record<string, unknown>).testKey).toBe('testValue');
    });

    it('should update multiple top-level keys in storage', () => {
      const slice = factory(settings);
      const store = createTestStore(settings);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dispatch = store.dispatch as any;
      dispatch(slice.actions.set([
        { key: ['key1'], value: 'value1' },
        { key: ['key2'], value: 'value2' },
      ]));

      const state = store.getState().cdeebee as CdeebeeState<Record<string, unknown>>;
      const storage = state.storage as Record<string, unknown>;
      expect(storage.key1).toBe('value1');
      expect(storage.key2).toBe('value2');
    });

    it('should update nested keys in storage', () => {
      const store = createTestStore(settings, {
        campaignList: {
          '123': { name: 'Old Name', id: '123' },
        },
      });
      const slice = factory(settings, {
        campaignList: {
          '123': { name: 'Old Name', id: '123' },
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dispatch = store.dispatch as any;
      dispatch(slice.actions.set([
         
        { key: ['campaignList', '123', 'name'], value: 'New Name' },
      ] as any));

      const state = store.getState().cdeebee as CdeebeeState<Record<string, unknown>>;
      const campaignList = (state.storage as Record<string, unknown>).campaignList as Record<string, unknown>;
      const campaign = campaignList['123'] as Record<string, unknown>;
      
      expect(campaign.name).toBe('New Name');
      expect(campaign.id).toBe('123');
    });

    it('should create nested structure if it does not exist', () => {
      const slice = factory(settings);
      const store = createTestStore(settings);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dispatch = store.dispatch as any;
      dispatch(slice.actions.set([
         
        { key: ['campaignList', '123', 'name'], value: 'Campaign Name' },
      ] as any));

      const state = store.getState().cdeebee as CdeebeeState<Record<string, unknown>>;
      const campaignList = (state.storage as Record<string, unknown>).campaignList as Record<string, unknown>;
      const campaign = campaignList['123'] as Record<string, unknown>;
      
      expect(campaign.name).toBe('Campaign Name');
    });

    it('should update multiple nested keys in different paths', () => {
      const store = createTestStore(settings, {
        campaignList: {
          '123': { name: 'Campaign 1', status: 'draft' },
          '456': { name: 'Campaign 2', status: 'active' },
        },
      });
      const slice = factory(settings, {
        campaignList: {
          '123': { name: 'Campaign 1', status: 'draft' },
          '456': { name: 'Campaign 2', status: 'active' },
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dispatch = store.dispatch as any;
      dispatch(slice.actions.set([
         
        { key: ['campaignList', '123', 'name'], value: 'Updated Campaign 1' },
         
        { key: ['campaignList', '456', 'status'], value: 'paused' },
      ] as any));

      const state = store.getState().cdeebee as CdeebeeState<Record<string, unknown>>;
      const campaignList = (state.storage as Record<string, unknown>).campaignList as Record<string, unknown>;
      const campaign1 = campaignList['123'] as Record<string, unknown>;
      const campaign2 = campaignList['456'] as Record<string, unknown>;
      
      expect(campaign1.name).toBe('Updated Campaign 1');
      expect(campaign1.status).toBe('draft');
      expect(campaign2.name).toBe('Campaign 2');
      expect(campaign2.status).toBe('paused');
    });

    it('should preserve existing storage data when updating', () => {
      const store = createTestStore(settings, {
        existingKey: 'existingValue',
        campaignList: {
          '123': { name: 'Old', status: 'active', id: '123' },
        },
      });
      const slice = factory(settings, {
        existingKey: 'existingValue',
        campaignList: {
          '123': { name: 'Old', status: 'active', id: '123' },
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dispatch = store.dispatch as any;
      dispatch(slice.actions.set([ { key: ['campaignList', '123', 'name'], value: 'New' } ] as any));

      const state = store.getState().cdeebee as CdeebeeState<Record<string, unknown>>;
      const storage = state.storage as Record<string, unknown>;
      
      expect(storage.existingKey).toBe('existingValue');
      const campaign = (storage.campaignList as Record<string, unknown>)['123'] as Record<string, unknown>;
      expect(campaign.name).toBe('New');
      expect(campaign.status).toBe('active');
      expect(campaign.id).toBe('123');
    });

    it('should handle numeric keys in path', () => {
      const store = createTestStore(settings, {
        items: [{ id: 1, name: 'Item 1' }, { id: 2, name: 'Item 2' }],
      });
      const slice = factory(settings, {
        items: [{ id: 1, name: 'Item 1' }, { id: 2, name: 'Item 2' }],
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dispatch = store.dispatch as any;
      dispatch(slice.actions.set([ { key: ['items', 0, 'name'], value: 'Updated Item 1' } ] as any));

      const state = store.getState().cdeebee as CdeebeeState<Record<string, unknown>>;
      const items = (state.storage as Record<string, unknown>).items as Array<Record<string, unknown>>;
      
      expect(items[0].name).toBe('Updated Item 1');
      expect(items[1].name).toBe('Item 2');
    });

    it('should handle deep nested paths', () => {
      const slice = factory(settings);
      const store = createTestStore(settings);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dispatch = store.dispatch as any;
      dispatch(slice.actions.set([ { key: ['level1', 'level2', 'level3', 'level4', 'value'], value: 'deep value' } ] as any));

      const state = store.getState().cdeebee as CdeebeeState<Record<string, unknown>>;
      const level1 = (state.storage as Record<string, unknown>).level1 as Record<string, unknown>;
      const level2 = level1.level2 as Record<string, unknown>;
      const level3 = level2.level3 as Record<string, unknown>;
      const level4 = level3.level4 as Record<string, unknown>;
      
      expect(level4.value).toBe('deep value');
    });

    it('should handle empty value list', () => {
      const store = createTestStore(settings, { existing: 'value' });
      const slice = factory(settings, { existing: 'value' });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dispatch = store.dispatch as any;
      dispatch(slice.actions.set([]));

      const state = store.getState().cdeebee as CdeebeeState<Record<string, unknown>>;
      expect((state.storage as Record<string, unknown>).existing).toBe('value');
    });
  });
});


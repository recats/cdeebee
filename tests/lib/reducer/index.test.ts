import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';

import { factory } from '../../../lib/reducer/index';
import { request } from '../../../lib/reducer/request';
import { type CdeebeeSettings } from '../../../lib/reducer/types';

// Mock fetch globally
global.fetch = vi.fn();

describe('factory', () => {
  let settings: CdeebeeSettings;

  beforeEach(() => {
    vi.clearAllMocks();
    
    settings = {
      modules: ['history', 'listener', 'state', 'cancelation'],
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
    const customSettings: CdeebeeSettings = {
      modules: ['history'],
      fileKey: 'customFile',
      bodyKey: 'customBody',
      primaryKey: 'customId',
      mergeWithData: { custom: 'data' },
      listStrategy: { list: 'merge' },
    };

    const slice = factory(customSettings);
    const store = configureStore({
      reducer: {
        cdeebee: slice.reducer,
      },
    });

    const state = store.getState().cdeebee;
    expect(state.settings.fileKey).toBe('customFile');
    expect(state.settings.bodyKey).toBe('customBody');
    expect(state.settings.primaryKey).toBe('customId');
  });

  it('should have correct initial state structure', () => {
    const slice = factory(settings);
    const store = configureStore({
      reducer: {
        cdeebee: slice.reducer,
      },
    });

    const state = store.getState().cdeebee;
    expect(state).toHaveProperty('settings');
    expect(state).toHaveProperty('state');
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
      const promise = store.dispatch(request(options));

      let state = store.getState().cdeebee;
      expect(state.request.active.length).toBeGreaterThan(0);
      expect(state.request.active[0]).toHaveProperty('api', '/api/test');
      expect(state.request.active[0]).toHaveProperty('requestId');

      await promise;

      state = store.getState().cdeebee;
      expect(state.request.active.length).toBe(0);
    });

    it('should not track active requests when listener module is disabled', async () => {
      const settingsWithoutListener: CdeebeeSettings = {
        ...settings,
        modules: ['history', 'state', 'cancelation'],
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
      await store.dispatch(request(options));

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
      await store.dispatch(request(options));

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
      await store.dispatch(request(options));

      const state = store.getState().cdeebee;
      expect(state.request.errors['/api/test']).toBeDefined();
      expect(state.request.errors['/api/test'].length).toBe(1);
      expect(state.request.errors['/api/test'][0]).toHaveProperty('api', '/api/test');
      expect(state.request.errors['/api/test'][0]).toHaveProperty('requestId');
    });

    it('should not track history when history module is disabled', async () => {
      const settingsWithoutHistory: CdeebeeSettings = {
        ...settings,
        modules: ['listener', 'state', 'cancelation'],
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
      await store.dispatch(request(options));

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
      await store.dispatch(request(options));
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
      const firstRequest = store.dispatch(request(options));

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: 'second' }),
      } as Response);

      const secondRequest = store.dispatch(request(options));

      resolveFirstRequest!({
        ok: true,
        json: async () => ({ data: 'first' }),
      } as Response);

      await Promise.allSettled([firstRequest, secondRequest]);
    });

    it('should not abort requests when cancelation module is disabled', async () => {
      const settingsWithoutCancelation: CdeebeeSettings = {
        ...settings,
        modules: ['history', 'listener', 'state'],
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
      await store.dispatch(request(options));
      await store.dispatch(request(options));

      const state = store.getState().cdeebee;
      expect(state.request.done['/api/test']?.length).toBe(2);
    });
  });
});


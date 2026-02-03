import { describe, it, expect, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { factory } from '../../lib/reducer/index';
import { createCdeebeeHooks } from '../../lib/hooks/index';
import { type CdeebeeState } from '../../lib/reducer/types';

interface TestStorage {
  userList: Record<string, { id: string; name: string }>;
  postList: Record<number, { id: number; title: string }>;
}

interface RootState {
  cdeebee: CdeebeeState<TestStorage>;
}

describe('cdeebee hooks selector logic', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    const slice = factory<TestStorage>(
      {
        modules: ['storage', 'listener', 'history'],
        fileKey: 'file',
        bodyKey: 'value',
      },
      {
        userList: {},
        postList: {},
      }
    );

    store = configureStore({
      reducer: {
        cdeebee: slice.reducer,
      },
    });

    // Verify createCdeebeeHooks works without errors
    createCdeebeeHooks<RootState, TestStorage>(state => state.cdeebee);
  });

  describe('useLoading selector logic', () => {
    it('should return false when no APIs are loading', () => {
      const state = store.getState();
      const isLoading = state.cdeebee.request.active.some(q =>
        ['/api/users'].includes(q.api)
      );
      expect(isLoading).toBe(false);
    });

    it('should return true when an API in the list is loading', () => {
      store.dispatch({
        type: 'cdeebee/request/pending',
        meta: { arg: { api: '/api/users' }, requestId: 'req-1' },
      });

      const state = store.getState();
      const isLoading = state.cdeebee.request.active.some(q =>
        ['/api/users', '/api/posts'].includes(q.api)
      );
      expect(isLoading).toBe(true);
    });

    it('should return false when a different API is loading', () => {
      store.dispatch({
        type: 'cdeebee/request/pending',
        meta: { arg: { api: '/api/comments' }, requestId: 'req-1' },
      });

      const state = store.getState();
      const isLoading = state.cdeebee.request.active.some(q =>
        ['/api/users', '/api/posts'].includes(q.api)
      );
      expect(isLoading).toBe(false);
    });
  });

  describe('useRequestHistory selector logic', () => {
    it('should return empty array when no history exists', () => {
      const state = store.getState();
      const history = state.cdeebee.request.done['/api/users'] ?? [];
      expect(history).toEqual([]);
    });

    it('should return request history for specific API', () => {
      const mockResult = { data: 'test' };
      store.dispatch({
        type: 'cdeebee/request/fulfilled',
        payload: { result: mockResult },
        meta: { arg: { api: '/api/users' }, requestId: 'req-1' },
      });

      const state = store.getState();
      const history = state.cdeebee.request.done['/api/users'] ?? [];
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual({
        api: '/api/users',
        request: { result: mockResult },
        requestId: 'req-1',
      });
    });
  });

  describe('useRequestErrors selector logic', () => {
    it('should return empty array when no errors exist', () => {
      const state = store.getState();
      const errors = state.cdeebee.request.errors['/api/users'] ?? [];
      expect(errors).toEqual([]);
    });

    it('should return error history for specific API', () => {
      const mockError = { message: 'Network error' };
      store.dispatch({
        type: 'cdeebee/request/rejected',
        error: mockError,
        meta: { arg: { api: '/api/users' }, requestId: 'req-1' },
      });

      const state = store.getState();
      const errors = state.cdeebee.request.errors['/api/users'] ?? [];
      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual({
        api: '/api/users',
        request: mockError,
        requestId: 'req-1',
      });
    });
  });

  describe('useStorageList selector logic', () => {
    it('should return empty object when list is not populated', () => {
      const state = store.getState();
      expect(state.cdeebee.storage.userList).toEqual({});
    });

    it('should return the list from storage', () => {
      const users = {
        '1': { id: '1', name: 'John' },
        '2': { id: '2', name: 'Jane' },
      };

      store.dispatch({
        type: 'cdeebee/set',
        payload: [{ key: ['userList'], value: users }],
      });

      const state = store.getState();
      expect(state.cdeebee.storage.userList).toEqual(users);
    });
  });

  describe('useStorage selector logic', () => {
    it('should return the entire storage', () => {
      const state = store.getState();
      expect(state.cdeebee.storage).toHaveProperty('userList');
      expect(state.cdeebee.storage).toHaveProperty('postList');
    });

    it('should return updated storage after changes', () => {
      const users = { '1': { id: '1', name: 'John' } };
      store.dispatch({
        type: 'cdeebee/set',
        payload: [{ key: ['userList'], value: users }],
      });

      const state = store.getState();
      expect(state.cdeebee.storage.userList).toEqual(users);
    });
  });

  describe('useIsLoading selector logic', () => {
    it('should return false when no requests are active', () => {
      const state = store.getState();
      expect(state.cdeebee.request.active.length).toBe(0);
    });

    it('should return true when any request is active', () => {
      store.dispatch({
        type: 'cdeebee/request/pending',
        meta: { arg: { api: '/api/users' }, requestId: 'req-1' },
      });

      const state = store.getState();
      expect(state.cdeebee.request.active.length).toBeGreaterThan(0);
    });
  });

  describe('useLastResultIdList selector logic', () => {
    it('should return empty array when no result IDs exist for API', () => {
      const state = store.getState();
      const resultIds = state.cdeebee.request.lastResultIdList['/api/users'] ?? [];
      expect(resultIds).toEqual([]);
    });

    it('should return result IDs after fulfilled request with primaryKey data', () => {
      // Simulate a fulfilled request with normalized data
      store.dispatch({
        type: 'cdeebee/request/fulfilled',
        payload: {
          result: {
            userList: {
              data: [
                { id: '1', name: 'John' },
                { id: '2', name: 'Jane' },
              ],
              primaryKey: 'id',
            },
          },
        },
        meta: { arg: { api: '/api/users' }, requestId: 'req-1' },
      });

      const state = store.getState();
      expect(state.cdeebee.request.lastResultIdList['/api/users']).toEqual(['1', '2']);
    });

    it('should not have lastResultIdList when response has no primaryKey format', () => {
      // Response without primaryKey format
      store.dispatch({
        type: 'cdeebee/request/fulfilled',
        payload: {
          result: {
            userList: {
              '1': { id: '1', name: 'John' },
            },
          },
        },
        meta: { arg: { api: '/api/users' }, requestId: 'req-1' },
      });

      const state = store.getState();
      expect(state.cdeebee.request.lastResultIdList['/api/users']).toEqual([]);
    });
  });

  describe('createCdeebeeHooks with custom selector', () => {
    it('should create hooks factory that has all expected properties', () => {
      interface CustomRootState {
        customPath: CdeebeeState<TestStorage>;
      }

      const customHooks = createCdeebeeHooks<CustomRootState, TestStorage>(
        state => state.customPath
      );

      // Verify all hook functions are created
      expect(customHooks).toHaveProperty('useLoading');
      expect(customHooks).toHaveProperty('useRequestHistory');
      expect(customHooks).toHaveProperty('useRequestErrors');
      expect(customHooks).toHaveProperty('useStorageList');
      expect(customHooks).toHaveProperty('useStorage');
      expect(customHooks).toHaveProperty('useIsLoading');
      expect(customHooks).toHaveProperty('useLastResultIdList');

      // Verify they're all functions
      expect(typeof customHooks.useLoading).toBe('function');
      expect(typeof customHooks.useStorageList).toBe('function');
      expect(typeof customHooks.useLastResultIdList).toBe('function');
    });
  });

  describe('request lifecycle with active tracking', () => {
    it('should add request to active on pending', () => {
      store.dispatch({
        type: 'cdeebee/request/pending',
        meta: { arg: { api: '/api/users' }, requestId: 'req-1' },
      });

      const state = store.getState();
      expect(state.cdeebee.request.active).toContainEqual({
        api: '/api/users',
        requestId: 'req-1',
      });
    });

    it('should remove request from active on fulfilled', () => {
      store.dispatch({
        type: 'cdeebee/request/pending',
        meta: { arg: { api: '/api/users' }, requestId: 'req-1' },
      });

      let state = store.getState();
      expect(state.cdeebee.request.active).toHaveLength(1);

      store.dispatch({
        type: 'cdeebee/request/fulfilled',
        payload: { result: {} },
        meta: { arg: { api: '/api/users' }, requestId: 'req-1' },
      });

      state = store.getState();
      expect(state.cdeebee.request.active).toHaveLength(0);
    });

    it('should remove request from active on rejected', () => {
      store.dispatch({
        type: 'cdeebee/request/pending',
        meta: { arg: { api: '/api/users' }, requestId: 'req-1' },
      });

      let state = store.getState();
      expect(state.cdeebee.request.active).toHaveLength(1);

      store.dispatch({
        type: 'cdeebee/request/rejected',
        error: { message: 'Error' },
        meta: { arg: { api: '/api/users' }, requestId: 'req-1' },
      });

      state = store.getState();
      expect(state.cdeebee.request.active).toHaveLength(0);
    });
  });
});

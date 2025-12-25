import {  createSlice, current } from '@reduxjs/toolkit';

import { type CdeebeeSettings, type CdeebeeState, type CdeebeeValueList } from './types';
import { checkModule, mergeDeepRight, batchingUpdate } from './helpers';
import { abortQuery } from './abortController';
import { request } from './request';
import { defaultNormalize } from './storage';

const initialState: CdeebeeState<unknown> = {
  settings: {
    modules: ['history', 'listener', 'storage', 'cancelation'],
    fileKey: 'file',
    bodyKey: 'value',
    listStrategy: {},
    mergeWithData: {},
    mergeWithHeaders: {},
  },
  storage: {},
  request: {
    active: [],
    errors: {},
    done: {}
  },
};

export const factory = <T>(settings: CdeebeeSettings<T>, storage?: T) => {
  const slice = createSlice({
    name: 'cdeebee',
    initialState: mergeDeepRight(initialState, { settings, storage: storage ?? {} }) as CdeebeeState<T>,
    reducers: {
      set(state, action: { payload: CdeebeeValueList<T> }) {
        // Directly mutate state.storage using Immer Draft
        // This is more performant than creating a new object
        // Immer will track changes and create minimal updates
        batchingUpdate(state.storage as Record<string, unknown>, action.payload);
      }
    },
    extraReducers: builder => {
      builder
        .addCase(request.pending, (state, action) => {
          const api = action.meta.arg.api;
          const requestId = action.meta.requestId;

          checkModule(state.settings, 'cancelation', () => {
            abortQuery(api, requestId);
          });
          checkModule(state.settings, 'listener', () => {
            state.request.active.push({ api, requestId });
          });
        })
        .addCase(request.fulfilled, (state, action) => {
          const requestId = action.meta.requestId;
          const api = action.meta.arg.api;

          checkModule(state.settings, 'listener', () => {
            state.request.active = state.request.active.filter(q => !(q.api === api && q.requestId === requestId));
          });
          checkModule(state.settings, 'history', () => {
            if (!state.request.done[api])  state.request.done[api] = [];
            state.request.done[api].push({ api, request: action.payload, requestId });
          });
          checkModule(state.settings, 'storage', () => {
            const strategyList = action.meta.arg.listStrategy ?? state.settings.listStrategy ?? {};
            const normalize = action.meta.arg.normalize ?? state.settings.normalize ?? defaultNormalize;

            const currentState = current(state) as CdeebeeState<T>;
            const normalizedData = normalize(currentState, action.payload.result, strategyList);

            // Normalize already handles merge/replace and preserves keys not in response
            // Simply apply the result
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (state.storage as any) = normalizedData;
          });
        })
        .addCase(request.rejected, (state, action) => {
          const requestId = action.meta.requestId;
          const api = action.meta.arg.api;
          
          checkModule(state.settings, 'listener', () => {
            state.request.active = state.request.active.filter(q => !(q.api === api && q.requestId === requestId));
          });
          checkModule(state.settings, 'history', () => {
            if (!state.request.errors[api])  state.request.errors[api] = [];
            state.request.errors[api].push({ requestId: requestId, api, request: action.error });
          });
        });
    },
  });

  return slice;
};

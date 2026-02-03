import { createSlice, current, type PayloadAction } from '@reduxjs/toolkit';

import { type CdeebeeSettings, type CdeebeeState, type CdeebeeValueList, type CdeebeeListStrategy } from './types';
import { checkModule, mergeDeepRight, batchingUpdate, extractLastResultIdList } from './helpers';
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
    done: {},
    lastResultIdList: {},
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
      },
      historyClear(state, action: PayloadAction<string | undefined>) {
        const api = action.payload;

        if (api) {
          delete state.request.done[api];
          delete state.request.errors[api];
        } else {
          state.request.done = {};
          state.request.errors = {};
        }
      }
    },
    extraReducers: builder => {
      builder
        .addCase(request.pending, (state, action) => {
          const api = action.meta.arg.api;
          const requestId = action.meta.requestId;

          if (action.meta.arg.historyClear) {
            checkModule(state.settings, 'history', () => {
              delete state.request.done[api];
              delete state.request.errors[api];
            });
          }

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
            if (!state.request.done[api]) state.request.done[api] = [];
            state.request.done[api].push({ api, request: action.payload, requestId });
          });
          checkModule(state.settings, 'storage', () => {
            if (action.meta.arg.ignore) {
              return;
            }

            const strategyList = (action.meta.arg.listStrategy ?? state.settings.listStrategy ?? {}) as CdeebeeListStrategy<T>;
            const normalize = action.meta.arg.normalize ?? state.settings.normalize ?? defaultNormalize;

            const currentState = current(state) as CdeebeeState<T>;
            // Type assertion is safe here because we've already checked isRecord
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const normalizedData = normalize(currentState, action.payload.result as any, strategyList);

            // Normalize already handles merge/replace/skip and preserves keys not in response
            // Simply apply the result
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (state.storage as any) = normalizedData;

            // Extract and store result IDs for filtering per list
            state.request.lastResultIdList[api] = extractLastResultIdList(action.payload.result);
          });
        })
        .addCase(request.rejected, (state, action) => {
          const requestId = action.meta.requestId;
          const api = action.meta.arg.api;

          checkModule(state.settings, 'listener', () => {
            state.request.active = state.request.active.filter(q => !(q.api === api && q.requestId === requestId));
          });
          checkModule(state.settings, 'history', () => {
            if (!state.request.errors[api]) state.request.errors[api] = [];
            state.request.errors[api].push({ requestId: requestId, api, request: action.error });
          });
        });
    },
  });

  return slice;
};

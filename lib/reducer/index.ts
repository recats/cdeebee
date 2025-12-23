import 'abortcontroller-polyfill/dist/abortcontroller-polyfill-only';
import {  createSlice } from '@reduxjs/toolkit';
import { mergeDeepRight } from 'ramda';

import { type CdeebeeSettings, type CdeebeeState } from './types';
import { checkModule } from './helpers';
import { abortQuery } from './abortController';
import { request } from './request';

const initialState: CdeebeeState<unknown> = {
  settings: {
    modules: ['history', 'listener', 'state', 'cancelation'],
    fileKey: 'file',
    bodyKey: 'value',
    primaryKey: 'primaryKey',
    listStrategy: {},
    mergeWithData: {},
  },
  state: {},
  request: {
    active: [],
    errors: {},
    done: {}
  },
};

export const factory = <T>(initial: CdeebeeSettings) => {
  const slice = createSlice({
    name: 'cdeebee',
    initialState: mergeDeepRight(initialState, { settings: initial }) as CdeebeeState<T>,
    reducers: {
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
            state.request.done[api].push({ api, settings: state.settings, request: action.payload, requestId });
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
            state.request.errors[api].push({ requestId: requestId, api, settings: state.settings, request: action.error });
          });
        });
    },
  });

  return slice;
};

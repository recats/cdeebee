import type { Action, ThunkAction } from '@reduxjs/toolkit';
import { combineSlices, configureStore } from '@reduxjs/toolkit';

import { factory } from '@recats/cdeebee';

interface Storage {
  campaignList: Record<number, { campaignID: number, campaign: string, timestamp: string }>;
  bundleList: Record<number, { bundleID: number, bundle: string, timestamp: string }>;
}

// Create cdeebee slice with default or custom initial state
export const cdeebeeSlice = factory<Storage>(
  {
    modules: ['history', 'listener', 'storage', 'queryQueue'],
    fileKey: 'file',
    bodyKey: 'value',
    listStrategy: {
      bundleList: 'merge',
      campaignList: 'replace',
    },
    mergeWithHeaders: {},
    mergeWithData: {
      sessionToken: '',
    },
  },
  {
    campaignList: {
      123: { campaignID: 123, campaign: 'Holiday Campaign', timestamp: '2025-12-01T10:15:30.000Z' },
    },
    bundleList: {
      961: { t: 1 } as unknown as { bundleID: number; bundle: string; timestamp: string },
    },
  }
);

// `combineSlices` automatically combines the reducers using
// their `reducerPath`s, therefore we no longer need to call `combineReducers`.
const rootReducer = combineSlices(cdeebeeSlice);
// Infer the `RootState` type from the root reducer
export type RootState = ReturnType<typeof rootReducer>;

// `makeStore` encapsulates the store configuration to allow
// creating unique store instances, which is particularly important for
// server-side rendering (SSR) scenarios. In SSR, separate store instances
// are needed for each request to prevent cross-request state pollution.
export const makeStore = () => {
  return configureStore({
    reducer: (state, action) => {
      // Handle custom setModules action for demo
      if (action.type === 'cdeebee/setModules' && 'payload' in action) {
        const currentState = rootReducer(state, { type: '@@INIT' });
        if (currentState && 'cdeebee' in currentState) {
          return {
            ...currentState,
            cdeebee: {
              ...currentState.cdeebee,
              settings: {
                ...currentState.cdeebee.settings,
                modules: action.payload as string[],
              },
            },
          };
        }
      }
      return rootReducer(state, action);
    },
    // Adding the api middleware enables caching, invalidation, polling,
    // and other useful features of `rtk-query`.
    middleware: getDefaultMiddleware => {
      return getDefaultMiddleware();
    },
  });
};

// Infer the return type of `makeStore`
export type AppStore = ReturnType<typeof makeStore>;
// Infer the `AppDispatch` type from the store itself
export type AppDispatch = AppStore['dispatch'];
export type AppThunk<ThunkReturnType = void> = ThunkAction<
  ThunkReturnType,
  RootState,
  unknown,
  Action
>;

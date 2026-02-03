import { useSelector } from 'react-redux';
import { type CdeebeeState } from '../reducer/types';

/**
 * Standalone hook that can be used without createCdeebeeHooks.
 * Assumes the cdeebee slice is at state.cdeebee.
 *
 * @param apiList - Array of API endpoints to check
 * @returns true if any of the APIs are currently active/loading
 *
 * @example
 * const isLoading = useLoading(['/api/forums', '/api/threads']);
 */
export function useLoading<Storage = unknown>(apiList: string[]): boolean {
  return useSelector((state: { cdeebee: CdeebeeState<Storage> }) => {
    return state.cdeebee.request.active.some(q => apiList.includes(q.api));
  });
}

/**
 * Standalone hook that can be used without createCdeebeeHooks.
 * Assumes the cdeebee slice is at state.cdeebee.
 *
 * @param api - The API endpoint
 * @returns Array of successful request history entries
 */
export function useRequestHistory<Storage = unknown>(api: string) {
  return useSelector((state: { cdeebee: CdeebeeState<Storage> }) => {
    return state.cdeebee.request.done[api] ?? [];
  });
}

/**
 * Standalone hook that can be used without createCdeebeeHooks.
 * Assumes the cdeebee slice is at state.cdeebee.
 *
 * @param api - The API endpoint
 * @returns Array of error history entries
 */
export function useRequestErrors<Storage = unknown>(api: string) {
  return useSelector((state: { cdeebee: CdeebeeState<Storage> }) => {
    return state.cdeebee.request.errors[api] ?? [];
  });
}

/**
 * Standalone hook that can be used without createCdeebeeHooks.
 * Assumes the cdeebee slice is at state.cdeebee.
 *
 * @param listName - The name of the list in storage
 * @returns The list data
 */
export function useStorageList<Storage, K extends keyof Storage>(listName: K): Storage[K] {
  return useSelector((state: { cdeebee: CdeebeeState<Storage> }) => {
    return state.cdeebee.storage[listName];
  });
}

/**
 * Standalone hook that can be used without createCdeebeeHooks.
 * Assumes the cdeebee slice is at state.cdeebee.
 *
 * @returns The complete storage object
 */
export function useStorage<Storage>(): Storage {
  return useSelector((state: { cdeebee: CdeebeeState<Storage> }) => {
    return state.cdeebee.storage;
  });
}

/**
 * Standalone hook that can be used without createCdeebeeHooks.
 * Assumes the cdeebee slice is at state.cdeebee.
 *
 * @returns true if any request is active
 */
export function useIsLoading<Storage = unknown>(): boolean {
  return useSelector((state: { cdeebee: CdeebeeState<Storage> }) => {
    return state.cdeebee.request.active.length > 0;
  });
}

/**
 * Standalone hook that can be used without createCdeebeeHooks.
 * Assumes the cdeebee slice is at state.cdeebee.
 *
 * Get the list of IDs returned by the last successful request to an API.
 * Useful for filtering storage data to show only results from a specific request.
 *
 * @param api - The API endpoint
 * @returns Array of primary key IDs from the last response
 *
 * @example
 * const productList = useStorageList('productList');
 * const lastIds = useLastResultIdList('/api/search');
 * const displayResults = lastIds.map(id => productList[id]).filter(Boolean);
 */
export function useLastResultIdList<Storage = unknown>(api: string): string[] {
  return useSelector((state: { cdeebee: CdeebeeState<Storage> }) => {
    return state.cdeebee.request.lastResultIdList[api] ?? [];
  });
}

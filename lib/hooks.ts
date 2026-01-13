import { useSelector } from 'react-redux';
import { type CdeebeeState } from './reducer/types';

/**
 * Generic hook factory that creates a selector hook for cdeebee state.
 * This allows the hooks to work with any Redux root state structure.
 *
 * @template RootState - The shape of the Redux root state
 * @template Storage - The shape of the cdeebee storage
 * @param selectCdeebee - Function to select the cdeebee slice from root state
 * @returns An object containing all cdeebee hooks
 */
export function createCdeebeeHooks<RootState, Storage>(
  selectCdeebee: (state: RootState) => CdeebeeState<Storage>
) {
  /**
   * Check if any of the specified APIs are currently loading.
   *
   * @param apiList - Array of API endpoints to check
   * @returns true if any of the APIs are currently active/loading
   *
   * @example
   * const isLoading = useLoading(['/api/forums', '/api/threads']);
   * if (isLoading) return <Spinner />;
   */
  function useLoading(apiList: string[]): boolean {
    return useSelector((state: RootState) => {
      const cdeebee = selectCdeebee(state);
      return cdeebee.request.active.some(q => apiList.includes(q.api));
    });
  }

  /**
   * Get the successful request history for a specific API endpoint.
   *
   * @param api - The API endpoint
   * @returns Array of successful request history entries
   *
   * @example
   * const history = useRequestHistory('/api/forums');
   * console.log(`Made ${history.length} successful requests`);
   */
  function useRequestHistory(api: string) {
    return useSelector((state: RootState) => {
      const cdeebee = selectCdeebee(state);
      return cdeebee.request.done[api] ?? [];
    });
  }

  /**
   * Get the error history for a specific API endpoint.
   *
   * @param api - The API endpoint
   * @returns Array of error history entries
   *
   * @example
   * const errors = useRequestErrors('/api/forums');
   * if (errors.length > 0) {
   *   console.error('Last error:', errors[errors.length - 1]);
   * }
   */
  function useRequestErrors(api: string) {
    return useSelector((state: RootState) => {
      const cdeebee = selectCdeebee(state);
      return cdeebee.request.errors[api] ?? [];
    });
  }

  /**
   * Get a specific list from storage with full type safety.
   *
   * @param listName - The name of the list in storage
   * @returns The list data
   *
   * @example
   * const forums = useStorageList('forumList');
   * const forumArray = Object.values(forums);
   */
  function useStorageList<K extends keyof Storage>(listName: K): Storage[K] {
    return useSelector((state: RootState) => {
      const cdeebee = selectCdeebee(state);
      return cdeebee.storage[listName];
    });
  }

  /**
   * Get the entire cdeebee storage.
   *
   * @returns The complete storage object
   *
   * @example
   * const storage = useStorage();
   * console.log(Object.keys(storage)); // ['forumList', 'threadList', ...]
   */
  function useStorage(): Storage {
    return useSelector((state: RootState) => {
      const cdeebee = selectCdeebee(state);
      return cdeebee.storage;
    });
  }

  /**
   * Check if any request is currently loading (across all APIs).
   *
   * @returns true if any request is active
   *
   * @example
   * const isAnythingLoading = useIsLoading();
   * if (isAnythingLoading) return <GlobalSpinner />;
   */
  function useIsLoading(): boolean {
    return useSelector((state: RootState) => {
      const cdeebee = selectCdeebee(state);
      return cdeebee.request.active.length > 0;
    });
  }

  return {
    useLoading,
    useRequestHistory,
    useRequestErrors,
    useStorageList,
    useStorage,
    useIsLoading,
  };
}

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

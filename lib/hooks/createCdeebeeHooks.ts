import { useSelector } from 'react-redux';
import { type CdeebeeState } from '../reducer/types';

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

  /**
   * Get the list of IDs returned by the last successful request to an API for a specific list.
   * Useful for filtering storage data to show only results from a specific request.
   *
   * @param api - The API endpoint
   * @param listName - The name of the list in storage (typed from Storage)
   * @returns Array of primary key IDs from the last response for that list
   *
   * @example
   * const productList = useStorageList('productList');
   * const lastIDList = useLastResultIdList('/api/search', 'productList');
   * const displayResults = lastIDList.map(id => productList[id]).filter(Boolean);
   */
  function useLastResultIdList<K extends keyof Storage>(api: string, listName: K): string[] {
    return useSelector((state: RootState) => {
      const cdeebee = selectCdeebee(state);
      return cdeebee.request.lastResultIdList[api]?.[listName as string] ?? [];
    });
  }

  return {
    useLoading,
    useRequestHistory,
    useRequestErrors,
    useStorageList,
    useStorage,
    useIsLoading,
    useLastResultIdList,
  };
}

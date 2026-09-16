import { useCallback, useSyncExternalStore } from 'react';
import type { CdeebeeListener, CdeebeeSubscription } from '../core/types';

export function usePluginState<R>(subscribe: CdeebeeSubscription['subscribe'], getSnapshot: () => R, keyList: string[]): R {
  const key = keyList.join('\0');
  const subscribeToKeyList = useCallback((listener: CdeebeeListener) => subscribe(listener, keyList), [subscribe, key]);
  return useSyncExternalStore(subscribeToKeyList, getSnapshot, getSnapshot);
}

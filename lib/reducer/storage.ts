import { type CdeebeeListStrategy, type CdeebeeState } from './types';
import { isRecord, mergeDeepRight, omit } from './helpers';

type ResponseValue = Record<string, unknown>;

type IResponse = Record<string, ResponseValue>;

type StorageData = Record<string, unknown>;

export function defaultNormalize<T>(
  cdeebee: CdeebeeState<T>,
  response: IResponse,
  strategyList: CdeebeeListStrategy<T> 
): Record<string, ResponseValue> {
  const keyList = Object.keys(response);
  const currentStorage = isRecord(cdeebee.storage) ? (cdeebee.storage as Record<string, unknown>) : {};
  
  // Start with existing storage to preserve keys not in response
  const result = { ...currentStorage } as Record<string, ResponseValue>;
  const keyListToOmit = new Set<string>();

  for (const key of keyList) {
    const responseValue = response[key];

    if (responseValue === null || responseValue === undefined || typeof responseValue === 'string') {
      keyListToOmit.add(key);
      continue;
    }

    const isNormalized = isRecord(responseValue) && Object.keys(responseValue).length > 0;

    if (isNormalized) {
      const strategy = strategyList[key as keyof T] ?? 'merge';
      const existingValue = key in currentStorage ? (currentStorage[key] as StorageData) : {};

      if (strategy === 'replace') {
        // Replace: completely replace the value
        result[key] = responseValue as ResponseValue;
      } else if (strategy === 'merge') {
        // Merge: merge with existing value
        result[key] = mergeDeepRight(existingValue, responseValue as StorageData) as ResponseValue;
      } else {
        // Unknown strategy: warn and fall back to merge
        console.warn(`Cdeebee: Unknown strategy "${strategy}" for key "${key}". Skipping normalization.`);
        result[key] = mergeDeepRight(existingValue, responseValue as StorageData) as ResponseValue;
      }
    } else {
      // Not a normalized object, store as-is
      result[key] = responseValue;
    }
  }

  return keyListToOmit.size > 0 ? omit(Array.from(keyListToOmit), result) : result;
}

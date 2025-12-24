import { type CdeebeeListStrategy, type CdeebeeState } from './types';
import { hasDataProperty, hasProperty, isRecord, mergeDeepRight, omit } from './helpers';

type ResponseValue = Record<string, unknown> & {
  data?: unknown[];
  [key: string]: unknown;
};

type IResponse = Record<string, ResponseValue>;

type StorageData = Record<string, unknown>;

export function defaultNormalize<T>(
  cdeebee: CdeebeeState<T>,
  response: IResponse,
  strategyList: CdeebeeListStrategy<T> 
): Record<string, ResponseValue> {
  const keyList = Object.keys(response);
  const primaryKey = cdeebee.settings.primaryKey;
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

    if (hasDataProperty(responseValue) && hasProperty(responseValue, primaryKey)) {
      const primaryKeyValue = responseValue[primaryKey];
      
      if (typeof primaryKeyValue !== 'string') {
        console.warn(`Cdeebee: Primary key "${primaryKey}" is not a string for API "${key}". Skipping normalization.`);
        result[key] = responseValue;
        continue;
      }

      // Pre-allocate storage data object
      const newStorageData: StorageData = {};
      const dataArray = responseValue.data;
      const dataLength = dataArray.length;

      for (let i = 0; i < dataLength; i++) {
        const element = dataArray[i];
        if (isRecord(element) && element[primaryKeyValue]) {
          const elementKey = element[primaryKeyValue] as string;
          newStorageData[elementKey] = element;
        }
      }

      const strategy = strategyList[key as keyof T] ?? 'merge';
      const existingValue = key in currentStorage ? (currentStorage[key] as StorageData) : {};

      if (strategy === 'replace') {
        // Replace: completely replace the value
        result[key] = newStorageData as ResponseValue;
      } else if (strategy === 'merge') {
        // Merge: merge with existing value
        result[key] = mergeDeepRight(existingValue, newStorageData) as ResponseValue;
      } else {
        // Unknown strategy: warn and fall back to merge
        console.warn(`Cdeebee: Unknown strategy "${strategy}" for key "${key}". Skipping normalization.`);
        result[key] = mergeDeepRight(existingValue, newStorageData) as ResponseValue;
      }
    } else {
      result[key] = responseValue;
    }
  }

  return keyListToOmit.size > 0 ? omit(Array.from(keyListToOmit), result) : result;
}

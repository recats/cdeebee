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
  
  const result = { ...currentStorage } as Record<string, ResponseValue>;
  const keyListToOmit = new Set<string>();

  for (const key of keyList) {
    const responseValue = response[key];

    if (responseValue === null || responseValue === undefined || typeof responseValue === 'string') {
      keyListToOmit.add(key);
      continue;
    }

    const isNormalized = isRecord(responseValue);
    const strategy = strategyList[key as keyof T] ?? 'merge';

    if (isNormalized) {
      const existingValue = key in currentStorage ? (currentStorage[key] as StorageData) : {};

      if (strategy === 'replace') {
        result[key] = responseValue as ResponseValue;
      } else if (strategy === 'merge') {
        result[key] = mergeDeepRight(existingValue, responseValue as StorageData) as ResponseValue;
      } else {
        console.warn(`Cdeebee: Unknown strategy "${strategy}" for key "${key}". Skipping normalization.`);
        result[key] = mergeDeepRight(existingValue, responseValue as StorageData) as ResponseValue;
      }
    } else {
      result[key] = responseValue;
    }
  }

  return keyListToOmit.size > 0 ? omit(Array.from(keyListToOmit), result) : result;
}

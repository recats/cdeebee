import { type CdeebeeListStrategy, type CdeebeeState } from './types';
import { isRecord, mergeDeepRight, omit } from './helpers';

type ResponseValue = Record<string, unknown>;

type IResponse = Record<string, ResponseValue>;

type StorageData = Record<string, unknown>;

function isDataWithPrimaryKey(value: unknown): value is { data: unknown[]; primaryKey: string } {
  return (
    isRecord(value) &&
    Array.isArray(value.data) &&
    typeof value.primaryKey === 'string'
  );
}
function normalizeDataWithPrimaryKey(data: unknown[], primaryKey: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  for (const item of data) {
    if (isRecord(item) && primaryKey in item) {
      const key = String(item[primaryKey]);
      result[key] = item;
    }
  }
  
  return result;
}

function applyStrategy(
  existingValue: StorageData,
  newValue: StorageData | ResponseValue,
  strategy: string,
  key: string
): ResponseValue {
  if (strategy === 'replace') {
    return newValue as ResponseValue;
  } else if (strategy === 'merge') {
    return mergeDeepRight(existingValue, newValue as StorageData) as ResponseValue;
  } else {
    console.warn(`Cdeebee: Unknown strategy "${strategy}" for key "${key}". Skipping normalization.`);
    return mergeDeepRight(existingValue, newValue as StorageData) as ResponseValue;
  }
}

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

    const strategy = strategyList[key as keyof T] ?? 'merge';
    const existingValue = key in currentStorage ? (currentStorage[key] as StorageData) : {};

    if (isDataWithPrimaryKey(responseValue)) {
      const normalizedValue = normalizeDataWithPrimaryKey(responseValue.data, responseValue.primaryKey);
      result[key] = applyStrategy(existingValue, normalizedValue, strategy, key);
      continue;
    }

    if (isRecord(responseValue)) {
      result[key] = applyStrategy(existingValue, responseValue as StorageData, strategy, key);
    } else {
      result[key] = responseValue;
    }
  }

  return keyListToOmit.size > 0 ? omit(Array.from(keyListToOmit), result) : result;
}

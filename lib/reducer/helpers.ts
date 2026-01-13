import { type WritableDraft } from '@reduxjs/toolkit';
import { type CdeebeeSettings, type CdeebeeModule, CdeebeeValueList } from './types';

export function checkModule(settings: CdeebeeSettings<unknown> | WritableDraft<CdeebeeSettings<unknown>>, module: CdeebeeModule, result: () => void) {
  if (settings.modules.includes(module)) {
    result();
  }
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export  function hasDataProperty(value: unknown): value is Record<string, unknown> & { data: unknown[] } {
  return isRecord(value) && Array.isArray(value.data);
}

export  function hasProperty(value: unknown, prop: string): boolean {
  return isRecord(value) && Object.prototype.hasOwnProperty.call(value, prop);
}

export function mergeDeepRight<T>(
  left: T,
  right: Partial<T> | Record<string, unknown>
): T {
  if (!isRecord(left) || !isRecord(right)) {
    return right as T;
  }

  const result = { ...left } as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;

  for (const key in rightRecord) {
    if (Object.prototype.hasOwnProperty.call(rightRecord, key)) {
      const leftValue = result[key];
      const rightValue = rightRecord[key];

      if (
        isRecord(leftValue) &&
        isRecord(rightValue) &&
        !Array.isArray(leftValue) &&
        !Array.isArray(rightValue)
      ) {
        result[key] = mergeDeepRight(leftValue, rightValue);
      } else {
        result[key] = rightValue;
      }
    }
  }

  return result as T;
}

export function omit<T extends Record<string, unknown>>(keys: string[], obj: T): Omit<T, keyof T> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result as Omit<T, keyof T>;
}

export function assocPath<T>(path: (string | number)[], value: unknown, obj: T): T {
  if (path.length === 0) {
    return value as T;
  }

  const [first, ...rest] = path;
  const firstKey = String(first);
  const result = Array.isArray(obj) ? [...obj] : { ...obj } as Record<string, unknown>;

  if (rest.length === 0) {
    (result as Record<string, unknown>)[firstKey] = value;
  } else {
    const currentValue = (result as Record<string, unknown>)[firstKey];
    (result as Record<string, unknown>)[firstKey] = assocPath(rest, value, currentValue ?? {});
  }

  return result as T;
}

export function batchingUpdate<T extends Record<string, unknown>>(
  state: T,
  valueList: CdeebeeValueList<T>
): void {
  for (let i = 0; i < valueList.length; i++) {
    const item = valueList[i] as { key: readonly (string | number)[]; value: unknown };
    const path = item.key;
    const value = item.value;
    
    if (path.length === 0) {
      continue;
    }

    let current: Record<string, unknown> | unknown[] = state as Record<string, unknown>;
    
    for (let j = 0; j < path.length - 1; j++) {
      const pathKey = path[j];
      
      if (Array.isArray(current)) {
        const index = typeof pathKey === 'number' ? pathKey : Number(pathKey);
        if (!(index in current) || !isRecord(current[index])) {
          current[index] = {};
        }
        current = current[index] as Record<string, unknown>;
      } else {
        const key = String(pathKey);
        if (!(key in current)) {
          const nextIsNumeric = typeof path[j + 1] === 'number' || (!isNaN(Number(path[j + 1])) && String(Number(path[j + 1])) === String(path[j + 1]));
          current[key] = nextIsNumeric ? [] : {};
        }
        const next = current[key];
        current = (Array.isArray(next) ? next : (isRecord(next) ? next : {})) as Record<string, unknown> | unknown[];
      }
    }
    
    if (Array.isArray(current)) {
      continue; // Can't update array element directly
    }
    current[String(path[path.length - 1])] = value;
  }
}

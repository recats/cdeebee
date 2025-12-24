import { type CdeebeeSettings, type CdeebeeModule } from './types';

export function checkModule(settings: CdeebeeSettings<unknown>, module: CdeebeeModule, result: () => void) {
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

export function omit<T extends Record<string, unknown>>(
  keys: string[],
  obj: T
): Omit<T, keyof T> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result as Omit<T, keyof T>;
}


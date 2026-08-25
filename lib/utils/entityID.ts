import type { EntityID } from './keyBy';

/** Object keys are always strings; restore integer ids (`'5'` → `5`) while leaving `'007'`, `'1e3'`, non-numeric keys as strings. */
export function toEntityID(key: string): EntityID {
  const n = Number(key);
  return Number.isInteger(n) && String(n) === key ? n : key;
}

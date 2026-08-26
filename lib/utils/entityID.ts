import type { EntityID } from './keyBy';

export function toEntityID(key: string): EntityID {
  const n = Number(key);
  return Number.isInteger(n) && String(n) === key ? n : key;
}

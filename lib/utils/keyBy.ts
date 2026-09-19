import { isRecord } from './isRecord';
import { createRecord } from './record';

export type EntityID = string | number;

export function keyBy<E>(entityList: E[], primaryKey: string): Record<EntityID, E> {
  const result = createRecord<E>();
  for (let i = 0; i < entityList.length; i += 1) {
    const entity = entityList[i];
    if (!isRecord(entity)) continue;
    const entityID = entity[primaryKey];
    if (typeof entityID !== 'string' && typeof entityID !== 'number') continue;
    result[entityID] = entity;
  }
  return result;
}

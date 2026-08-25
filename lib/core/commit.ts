import { shallowEqual } from '../utils/shallowEqual';
import { isRecord } from '../utils/isRecord';
import { isDev } from '../utils/env';
import { toEntityID } from '../utils/entityID';
import type { CdeebeeChangeSet, CdeebeeChangedList, CdeebeeEntity, CdeebeeList, CdeebeePrimaryKeyList, CdeebeeStorage, CdeebeeStorageShape, EntityID, ListName } from './types';

interface ListChange {
  upsertList?: CdeebeeEntity[];
  removeIDList?: EntityID[];
  replaceList?: Record<EntityID, CdeebeeEntity>;
}

const readEntityID = (entity: unknown, primaryKey: string, listName: string): EntityID | undefined => {
  if (!isRecord(entity)) return undefined;
  const entityID = entity[primaryKey];
  if (typeof entityID === 'string' || typeof entityID === 'number') return entityID;
  if (isDev()) console.error(`[cdeebee] entity in "${listName}" has no "${primaryKey}"`, entity);
  return undefined;
};

function applyListChange(
  prevList: CdeebeeList,
  change: ListChange,
  primaryKey: string,
  listName: string,
): { list: CdeebeeList; entityIDList: EntityID[] } {
  const entityIDList: EntityID[] = [];
  let list = prevList;
  let copied = false;

  if (change.replaceList) {
    const nextList: CdeebeeList = {};
    let changed = false;
    const replaceKeyList = Object.keys(change.replaceList);
    for (let i = 0; i < replaceKeyList.length; i += 1) {
      const key = replaceKeyList[i];
      const nextEntity = change.replaceList[key];
      const prevEntity = prevList[key];
      if (prevEntity !== undefined && shallowEqual(prevEntity, nextEntity)) {
        nextList[key] = prevEntity;
      } else {
        nextList[key] = nextEntity;
        entityIDList.push(toEntityID(key));
        changed = true;
      }
    }
    const prevKeyList = Object.keys(prevList);
    for (let i = 0; i < prevKeyList.length; i += 1) {
      if (!(prevKeyList[i] in nextList)) {
        entityIDList.push(toEntityID(prevKeyList[i]));
        changed = true;
      }
    }
    if (changed) {
      list = nextList;
      copied = true;
    }
  }

  if (change.upsertList) {
    for (let i = 0; i < change.upsertList.length; i += 1) {
      const nextEntity = change.upsertList[i];
      const entityID = readEntityID(nextEntity, primaryKey, listName);
      if (entityID === undefined) continue;
      const prevEntity = list[entityID];
      if (prevEntity !== undefined && shallowEqual(prevEntity, nextEntity)) continue;
      if (!copied) { list = { ...list }; copied = true; }
      list[entityID] = nextEntity;
      entityIDList.push(entityID);
    }
  }

  if (change.removeIDList) {
    for (let i = 0; i < change.removeIDList.length; i += 1) {
      const entityID = change.removeIDList[i];
      if (!(entityID in list)) continue;
      if (!copied) { list = { ...list }; copied = true; }
      delete list[entityID];
      entityIDList.push(entityID);
    }
  }

  return { list, entityIDList };
}

export function applyChangeSet<S extends CdeebeeStorageShape<S>>(
  storage: S,
  changeSet: CdeebeeChangeSet<S>,
  primaryKeyList: CdeebeePrimaryKeyList<S>,
): { storage: S; changedList: CdeebeeChangedList<S>[] } {
  const changedList: CdeebeeChangedList<S>[] = [];
  let nextStorage = storage;
  let copied = false;

  const listNameList = Object.keys(changeSet) as ListName<S>[];
  for (let i = 0; i < listNameList.length; i += 1) {
    const listName = listNameList[i];
    const change = changeSet[listName] as ListChange | undefined;
    if (!change) continue;
    const prevList: CdeebeeList = storage[listName] ?? {};
    const primaryKey = primaryKeyList[listName] as string;
    const { list, entityIDList } = applyListChange(prevList, change, primaryKey, listName);
    if (list === prevList) continue;
    if (!copied) { nextStorage = { ...storage }; copied = true; }
    (nextStorage as CdeebeeStorage)[listName] = list;
    if (entityIDList.length > 0) changedList.push({ listName, entityIDList });
  }

  return { storage: nextStorage, changedList };
}

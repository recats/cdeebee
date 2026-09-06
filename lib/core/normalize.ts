import { isRecord } from '../utils/isRecord';
import { keyBy } from '../utils/keyBy';
import { isDev } from '../utils/env';
import { toEntityID } from '../utils/entityID';
import type { CdeebeeChangeSet, CdeebeeEntity, CdeebeeListChange, CdeebeeNormalizeContext, CdeebeePrimaryKeyList, EntityID, ListName } from './types';

export interface CdeebeeListEnvelope {
  data: CdeebeeEntity[];
  primaryKey: string;
}

export function isListEnvelope(value: unknown): value is CdeebeeListEnvelope {
  return isRecord(value) && Array.isArray(value.data) && typeof value.primaryKey === 'string';
}

export function defaultNormalize<S>(response: unknown, ctx: CdeebeeNormalizeContext<S>): CdeebeeChangeSet<S> {
  const changeSet: Record<string, CdeebeeListChange> = {};
  if (!isRecord(response)) return changeSet as CdeebeeChangeSet<S>;

  const keyList = Object.keys(response);
  for (let i = 0; i < keyList.length; i += 1) {
    const listName = keyList[i] as ListName<S>;
    const value = response[listName];
    if (!isListEnvelope(value)) continue;

    const settingsPrimaryKey = ctx.primaryKeyList[listName];
    if (settingsPrimaryKey !== undefined && settingsPrimaryKey !== value.primaryKey && isDev()) {
      console.warn(`[cdeebee] "${listName}" primaryKey mismatch: settings "${settingsPrimaryKey}", response "${value.primaryKey}"`);
    }
    const primaryKey = settingsPrimaryKey ?? value.primaryKey;
    const strategy = ctx.strategyList[listName] ?? 'patch';

    if (strategy === 'skip') continue;
    if (strategy === 'replaceList') {
      changeSet[listName] = { replaceList: keyBy(value.data, primaryKey) };
    } else if (strategy === 'upsert') {
      changeSet[listName] = { upsertList: value.data };
    } else {
      changeSet[listName] = { patchList: value.data };
    }
  }

  return changeSet as CdeebeeChangeSet<S>;
}

export function extractResultIDList<S>(
  changeSet: CdeebeeChangeSet<S>,
  primaryKeyList: CdeebeePrimaryKeyList<S>,
): Record<string, EntityID[]> {
  const result: Record<string, EntityID[]> = {};
  const listNameList = Object.keys(changeSet) as ListName<S>[];
  for (let i = 0; i < listNameList.length; i += 1) {
    const listName = listNameList[i];
    const change = changeSet[listName] as CdeebeeListChange | undefined;
    if (!change) continue;
    const primaryKey = primaryKeyList[listName];
    const entityIDList: EntityID[] = [];
    const writeList = [...(change.upsertList ?? []), ...(change.patchList ?? [])];
    if (primaryKey) {
      for (let j = 0; j < writeList.length; j += 1) {
        const entity = writeList[j];
        const entityID = isRecord(entity) ? entity[primaryKey] : undefined;
        if (typeof entityID === 'string' || typeof entityID === 'number') entityIDList.push(toEntityID(String(entityID)));
      }
    }
    if (change.replaceList) {
      const keyList = Object.keys(change.replaceList);
      for (let j = 0; j < keyList.length; j += 1) {
        entityIDList.push(toEntityID(keyList[j]));
      }
    }
    // An explicitly empty result clears history IDs; an absent result leaves them unchanged.
    if (change.upsertList !== undefined || change.patchList !== undefined || change.replaceList !== undefined) {
      result[listName] = entityIDList;
    }
  }
  return result;
}

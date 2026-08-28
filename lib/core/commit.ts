import { shallowEqual } from '../utils/shallowEqual';
import { isRecord } from '../utils/isRecord';
import { isDev } from '../utils/env';
import { toEntityID } from '../utils/entityID';
import type {
  CdeebeeChangeSet, CdeebeeChangedList, CdeebeeEntity, CdeebeeEntityMeta, CdeebeeList, CdeebeePrimaryKeyList,
  CdeebeeStorage, CdeebeeStorageShape, CdeebeeVersionKeyList, EntityID, ListName,
} from './types';

interface ListChange {
  upsertList?: CdeebeeEntity[];
  patchList?: CdeebeeEntity[];
  setList?: CdeebeeEntity[];
  removeIDList?: EntityID[];
  replaceList?: Record<EntityID, CdeebeeEntity>;
}

export type EntityMetaList = Map<EntityID, CdeebeeEntityMeta>;

export interface ApplyChangeSetOptions<S> {
  metaList: Map<string, EntityMetaList>;
  seq: number;
  versionKeyList?: CdeebeeVersionKeyList<S>;
}

type Freshness = 'newer' | 'older';
type WriteMode = 'upsert' | 'patch' | 'set';

const readEntityID = (entity: unknown, primaryKey: string, listName: string): EntityID | undefined => {
  if (!isRecord(entity)) return undefined;
  const entityID = entity[primaryKey];
  if (typeof entityID === 'string' || typeof entityID === 'number') return entityID;
  if (isDev()) console.error(`[cdeebee] entity in "${listName}" has no "${primaryKey}"`, entity);
  return undefined;
};

export const readVersion = (entity: unknown, versionKey: string | undefined): number | undefined => {
  if (versionKey === undefined || !isRecord(entity)) return undefined;
  const value = entity[versionKey];
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
};

const isHole = (value: unknown): boolean => value === undefined || (Array.isArray(value) && value.length === 0);

export function fill(base: CdeebeeEntity, donor: CdeebeeEntity): CdeebeeEntity {
  let result: Record<string, unknown> = base as Record<string, unknown>;
  const donorRecord = donor as Record<string, unknown>;
  const keyList = Object.keys(donorRecord);
  for (let i = 0; i < keyList.length; i += 1) {
    const key = keyList[i];
    const donorValue = donorRecord[key];
    if (isHole(donorValue) || !isHole(result[key])) continue;
    if (result === base) result = { ...result };
    result[key] = donorValue;
  }
  return result;
}

const compareFreshness = (prevMeta: CdeebeeEntityMeta | undefined, version: number | undefined, seq: number): Freshness => {
  if (prevMeta === undefined) return 'newer';
  if (prevMeta.version !== undefined && version !== undefined && version !== prevMeta.version) {
    return version > prevMeta.version ? 'newer' : 'older';
  }
  return seq >= prevMeta.seq ? 'newer' : 'older';
};

interface EntityWrite {
  entity: CdeebeeEntity;
  meta: CdeebeeEntityMeta;
}

export function mergeEntity(
  prevEntity: CdeebeeEntity | undefined,
  prevMeta: CdeebeeEntityMeta | undefined,
  nextEntity: CdeebeeEntity,
  mode: WriteMode,
  version: number | undefined,
  seq: number,
): EntityWrite | undefined {
  const freshness = compareFreshness(prevMeta, version, seq);
  const sameVersion = prevMeta?.version !== undefined && version !== undefined && version === prevMeta.version;

  if (freshness === 'newer') {
    if (mode === 'upsert' || mode === 'set' || prevEntity === undefined) {
      const complete = mode === 'upsert' ? true : mode === 'set' ? (prevMeta?.complete ?? false) : false;
      return {
        entity: nextEntity,
        meta: { version: version ?? prevMeta?.version, seq, complete },
      };
    }
    return {
      entity: fill(nextEntity, prevEntity),
      meta: { version: version ?? prevMeta?.version, seq, complete: sameVersion ? (prevMeta?.complete ?? false) : false },
    };
  }

  if (prevMeta === undefined || prevEntity === undefined) return undefined;
  if (prevMeta.complete) return undefined;
  const filled = fill(prevEntity, nextEntity);
  const versionKnown = prevMeta.version !== undefined && version !== undefined;
  const complete = mode === 'upsert' && (!versionKnown || sameVersion);
  if (filled === prevEntity && complete === prevMeta.complete) return undefined;
  return { entity: filled, meta: { ...prevMeta, complete } };
}

function applyListChange<S>(
  prevList: CdeebeeList,
  change: ListChange,
  primaryKey: string,
  listName: string,
  meta: EntityMetaList,
  options: ApplyChangeSetOptions<S>,
): { list: CdeebeeList; entityIDList: EntityID[] } {
  const entityIDList: EntityID[] = [];
  const versionKey = (options.versionKeyList as Record<string, string | undefined> | undefined)?.[listName];
  const { seq } = options;
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
      const version = readVersion(nextEntity, versionKey);
      if (prevEntity !== undefined && compareFreshness(meta.get(toEntityID(key)), version, seq) === 'older') {
        nextList[key] = prevEntity;
        continue;
      }
      meta.set(toEntityID(key), { version, seq, complete: true });
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
      const key = prevKeyList[i];
      if (key in nextList) continue;
      if (compareFreshness(meta.get(toEntityID(key)), undefined, seq) === 'older') {
        nextList[key] = prevList[key];
        continue;
      }
      meta.delete(toEntityID(key));
      entityIDList.push(toEntityID(key));
      changed = true;
    }
    if (changed) {
      list = nextList;
      copied = true;
    }
  }

  const applyWriteList = (writeList: CdeebeeEntity[], mode: WriteMode) => {
    for (let i = 0; i < writeList.length; i += 1) {
      const nextEntity = writeList[i];
      const entityID = readEntityID(nextEntity, primaryKey, listName);
      if (entityID === undefined) continue;
      const metaID = toEntityID(String(entityID));
      const write = mergeEntity(list[entityID], meta.get(metaID), nextEntity, mode, readVersion(nextEntity, versionKey), seq);
      if (write === undefined) continue;
      meta.set(metaID, write.meta);
      const prevEntity = list[entityID];
      if (prevEntity !== undefined && shallowEqual(prevEntity, write.entity)) continue;
      if (!copied) { list = { ...list }; copied = true; }
      list[entityID] = write.entity;
      entityIDList.push(entityID);
    }
  };

  if (change.upsertList) applyWriteList(change.upsertList, 'upsert');
  if (change.patchList) applyWriteList(change.patchList, 'patch');
  if (change.setList) applyWriteList(change.setList, 'set');

  if (change.removeIDList) {
    for (let i = 0; i < change.removeIDList.length; i += 1) {
      const entityID = change.removeIDList[i];
      meta.delete(toEntityID(String(entityID)));
      if (!(entityID in list)) continue;
      if (!copied) { list = { ...list }; copied = true; }
      delete list[entityID];
      entityIDList.push(entityID);
    }
  }

  return { list, entityIDList };
}

const defaultOptions = <S>(): ApplyChangeSetOptions<S> => ({ metaList: new Map(), seq: 0 });

export function applyChangeSet<S extends CdeebeeStorageShape<S>>(
  storage: S,
  changeSet: CdeebeeChangeSet<S>,
  primaryKeyList: CdeebeePrimaryKeyList<S>,
  options: ApplyChangeSetOptions<S> = defaultOptions<S>(),
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
    let meta = options.metaList.get(listName);
    if (meta === undefined) { meta = new Map(); options.metaList.set(listName, meta); }
    const { list, entityIDList } = applyListChange(prevList, change, primaryKey, listName, meta, options);
    if (list === prevList) continue;
    if (!copied) { nextStorage = { ...storage }; copied = true; }
    (nextStorage as CdeebeeStorage)[listName] = list;
    if (entityIDList.length > 0) changedList.push({ listName, entityIDList });
  }

  return { storage: nextStorage, changedList };
}

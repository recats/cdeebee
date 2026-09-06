import { shallowEqual } from '../utils/shallowEqual';
import { isRecord } from '../utils/isRecord';
import { isDev } from '../utils/env';
import { toEntityID } from '../utils/entityID';
import type {
  CdeebeeChangeSet, CdeebeeChangedList, CdeebeeEntity, CdeebeeEntityMeta, CdeebeeList, CdeebeeListChange, CdeebeePrimaryKeyList,
  CdeebeeStorage, CdeebeeStorageShape, CdeebeeVersionKeyList, EntityID, ListName,
} from './types';

interface EntityMeta extends CdeebeeEntityMeta {
  /** Last removal, retained when an entity is re-added. */
  removedSeq?: number;
}

export type EntityMetaList = Map<EntityID, EntityMeta>;

export interface ApplyChangeSetOptions<S> {
  metaList: Map<string, EntityMetaList>;
  /** per-list sequence of the last `replaceList` / `clearList` */
  listSeqMap: Map<string, number>;
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

/** gate for writes that find no stored entity, and for removals. Equal sequence passes, so the parts of one commit apply in order. */
const isStale = (prevMeta: CdeebeeEntityMeta | undefined, listSeq: number | undefined, seq: number): boolean => (
  (prevMeta !== undefined && seq < prevMeta.seq) || (listSeq !== undefined && seq < listSeq)
);

const tombstone = (seq: number): CdeebeeEntityMeta => ({ seq, complete: false, deleted: true });

const writeMeta = (version: number | undefined, seq: number, complete: boolean, removedSeq: number | undefined): EntityMeta => {
  const meta: EntityMeta = { version, seq, complete };
  if (removedSeq !== undefined) meta.removedSeq = removedSeq;
  return meta;
};

interface EntityWrite {
  entity: CdeebeeEntity;
  meta: EntityMeta;
}

export function mergeEntity(
  prevEntity: CdeebeeEntity | undefined,
  prevMeta: EntityMeta | undefined,
  nextEntity: CdeebeeEntity,
  mode: WriteMode,
  version: number | undefined,
  seq: number,
  listSeq?: number,
): EntityWrite | undefined {
  const removedSeq = prevMeta?.deleted ? prevMeta.seq : prevMeta?.removedSeq;
  if (removedSeq !== undefined && seq < removedSeq) return undefined;
  if (prevEntity === undefined) {
    if (listSeq !== undefined && seq < listSeq) return undefined;
    return { entity: nextEntity, meta: writeMeta(version, seq, mode === 'upsert', listSeq === undefined ? removedSeq : Math.max(removedSeq ?? listSeq, listSeq)) };
  }
  const sameVersion = prevMeta?.version !== undefined && version !== undefined && version === prevMeta.version;

  if (prevMeta === undefined || compareFreshness(prevMeta, version, seq) === 'newer') {
    if (mode === 'upsert' || mode === 'set') {
      const complete = mode === 'upsert' ? true : (prevMeta?.complete ?? false);
      return { entity: nextEntity, meta: writeMeta(version ?? prevMeta?.version, seq, complete, removedSeq) };
    }
    return {
      entity: fill(nextEntity, prevEntity),
      meta: writeMeta(version ?? prevMeta?.version, seq, sameVersion ? (prevMeta?.complete ?? false) : false, removedSeq),
    };
  }

  if (prevMeta.complete) return undefined;
  const filled = fill(prevEntity, nextEntity);
  const versionKnown = prevMeta.version !== undefined && version !== undefined;
  const complete = mode === 'upsert' && (!versionKnown || sameVersion);
  if (filled === prevEntity && complete === prevMeta.complete) return undefined;
  return { entity: filled, meta: { ...prevMeta, complete } };
}

function applyListChange<S>(
  prevList: CdeebeeList,
  change: CdeebeeListChange,
  primaryKey: string,
  listName: ListName<S>,
  meta: EntityMetaList,
  options: ApplyChangeSetOptions<S>,
): { list: CdeebeeList; entityIDList: EntityID[] } {
  const entityIDList: EntityID[] = [];
  const versionKey = options.versionKeyList?.[listName];
  const { seq } = options;
  let list = prevList;
  let copied = false;
  let listSeq = options.listSeqMap.get(listName);

  if (change.replaceList) {
    const previousListSeq = listSeq;
    listSeq = Math.max(listSeq ?? seq, seq);
    options.listSeqMap.set(listName, listSeq);
    const staleReset = seq < listSeq;
    const nextList: CdeebeeList = {};
    let changed = false;
    const replaceKeyList = Object.keys(change.replaceList);
    for (let i = 0; i < replaceKeyList.length; i += 1) {
      const key = replaceKeyList[i];
      const metaID = toEntityID(key);
      const nextEntity = change.replaceList[key];
      const prevEntity = prevList[key];
      const prevMeta = meta.get(metaID);
      const removedSeq = prevMeta?.deleted ? prevMeta.seq : prevMeta?.removedSeq;
      if ((removedSeq !== undefined && seq < removedSeq)
        || (prevEntity === undefined && isStale(prevMeta, listSeq, seq))) {
        if (prevEntity !== undefined) nextList[key] = prevEntity;
        continue;
      }
      const version = readVersion(nextEntity, versionKey);
      if (prevEntity !== undefined && compareFreshness(prevMeta, version, seq) === 'older') {
        nextList[key] = prevEntity;
        continue;
      }
      meta.set(metaID, writeMeta(version, seq, true, prevEntity === undefined && previousListSeq !== undefined ? Math.max(removedSeq ?? previousListSeq, previousListSeq) : removedSeq));
      if (prevEntity !== undefined && shallowEqual(prevEntity, nextEntity)) {
        nextList[key] = prevEntity;
      } else {
        nextList[key] = nextEntity;
        entityIDList.push(metaID);
        changed = true;
      }
    }
    const prevKeyList = Object.keys(prevList);
    for (let i = 0; i < prevKeyList.length; i += 1) {
      const key = prevKeyList[i];
      if (key in nextList) continue;
      const metaID = toEntityID(key);
      if (staleReset || compareFreshness(meta.get(metaID), undefined, seq) === 'older') {
        nextList[key] = prevList[key];
        continue;
      }
      meta.delete(metaID);
      entityIDList.push(metaID);
      changed = true;
    }
    // listSeq now rejects everything these tombstones did.
    const boundary = listSeq;
    meta.forEach((entityMeta, metaID) => {
      if (entityMeta.deleted && entityMeta.seq <= boundary) meta.delete(metaID);
    });
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
      const prevEntity = list[entityID];
      const write = mergeEntity(prevEntity, meta.get(metaID), nextEntity, mode, readVersion(nextEntity, versionKey), seq, listSeq);
      if (write === undefined) continue;
      meta.set(metaID, write.meta);
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
      const metaID = toEntityID(String(entityID));
      const prevMeta = meta.get(metaID);
      if (isStale(prevMeta, listSeq, seq)) continue;
      // Absent ids are tombstoned too: an earlier-sent fetch must not re-add what this removal deleted.
      if (!prevMeta?.deleted || prevMeta.seq < seq) meta.set(metaID, tombstone(seq));
      if (!(entityID in list)) continue;
      if (!copied) { list = { ...list }; copied = true; }
      delete list[entityID];
      entityIDList.push(entityID);
    }
  }

  return { list, entityIDList };
}

const defaultOptions = <S>(): ApplyChangeSetOptions<S> => ({ metaList: new Map(), listSeqMap: new Map(), seq: 0 });

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
    const change = changeSet[listName] as CdeebeeListChange | undefined;
    if (!change) continue;
    // Without server versions, every operation before the reset can be skipped.
    // Equal sequences must pass for composite commits and same-sequence writes.
    const listSeq = options.listSeqMap.get(listName);
    const versionKey = options.versionKeyList?.[listName];
    if (versionKey === undefined && listSeq !== undefined && options.seq < listSeq) continue;
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

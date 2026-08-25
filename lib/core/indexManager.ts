import { isRecord } from '../utils/isRecord';
import { toEntityID } from '../utils/entityID';
import type { CdeebeeChangedList, CdeebeeIndexList, CdeebeeList, CdeebeeStorage, EntityID, ListName } from './types';

type Bucket = Map<unknown, Set<EntityID>>;
const EMPTY: ReadonlySet<EntityID> = new Set();

export class IndexManager<S> {
  private fieldListByList = new Map<ListName<S>, string[]>();
  private bucketMap = new Map<string, Bucket>();

  constructor(indexList: CdeebeeIndexList<S> | undefined) {
    if (!indexList) return;
    const listNameList = Object.keys(indexList) as ListName<S>[];
    for (let i = 0; i < listNameList.length; i += 1) {
      const fieldList = indexList[listNameList[i]] as string[] | undefined;
      if (fieldList && fieldList.length > 0) this.fieldListByList.set(listNameList[i], fieldList);
    }
  }

  private key(listName: ListName<S>, fieldName: string): string {
    return `${listName} ${fieldName}`;
  }

  private bucket(listName: ListName<S>, fieldName: string): Bucket {
    const key = this.key(listName, fieldName);
    let bucket = this.bucketMap.get(key);
    if (!bucket) { bucket = new Map(); this.bucketMap.set(key, bucket); }
    return bucket;
  }

  private add(bucket: Bucket, value: unknown, entityID: EntityID): void {
    let set = bucket.get(value);
    if (!set) { set = new Set(); bucket.set(value, set); }
    set.add(entityID);
  }

  private remove(bucket: Bucket, value: unknown, entityID: EntityID): void {
    const set = bucket.get(value);
    if (!set) return;
    set.delete(entityID);
    if (set.size === 0) bucket.delete(value);
  }

  private rebuildList(listName: ListName<S>, list: CdeebeeList | undefined): void {
    const fieldList = this.fieldListByList.get(listName);
    if (!fieldList) return;
    for (let f = 0; f < fieldList.length; f += 1) {
      const bucket: Bucket = new Map();
      this.bucketMap.set(this.key(listName, fieldList[f]), bucket);
      if (!list) continue;
      const keyList = Object.keys(list);
      for (let i = 0; i < keyList.length; i += 1) {
        const entity = list[keyList[i]];
        if (isRecord(entity)) this.add(bucket, entity[fieldList[f]], toEntityID(keyList[i]));
      }
    }
  }

  has(listName: ListName<S>, fieldName: string): boolean {
    return this.fieldListByList.get(listName)?.includes(fieldName) ?? false;
  }

  rebuild(storage: S): void {
    this.fieldListByList.forEach((_fieldList, listName) => {
      this.rebuildList(listName, (storage as CdeebeeStorage)[listName]);
    });
  }

  update(prevStorage: S, nextStorage: S, changedList: CdeebeeChangedList<S>[]): void {
    for (let c = 0; c < changedList.length; c += 1) {
      const { listName, entityIDList } = changedList[c];
      const fieldList = this.fieldListByList.get(listName);
      if (!fieldList) continue;
      const nextList = (nextStorage as CdeebeeStorage)[listName];
      if (entityIDList === '*') { this.rebuildList(listName, nextList); continue; }
      const prevList = (prevStorage as CdeebeeStorage)[listName];
      for (let f = 0; f < fieldList.length; f += 1) {
        const bucket = this.bucket(listName, fieldList[f]);
        for (let i = 0; i < entityIDList.length; i += 1) {
          const entityID = toEntityID(String(entityIDList[i]));
          const prevEntity = prevList?.[entityID];
          const nextEntity = nextList?.[entityID];
          // an unchanged indexed value keeps its slot, so bucket iteration order stays stable
          if (isRecord(prevEntity) && isRecord(nextEntity) && Object.is(prevEntity[fieldList[f]], nextEntity[fieldList[f]])) continue;
          if (isRecord(prevEntity)) this.remove(bucket, prevEntity[fieldList[f]], entityID);
          if (isRecord(nextEntity)) this.add(bucket, nextEntity[fieldList[f]], entityID);
        }
      }
    }
  }

  get(listName: ListName<S>, fieldName: string, value: unknown): ReadonlySet<EntityID> {
    return this.bucketMap.get(this.key(listName, fieldName))?.get(value) ?? EMPTY;
  }
}

import type { CdeebeeChangedList, CdeebeeDependency, CdeebeeListener, CdeebeeSubscription, EntityID, ListName } from './types';

type ListenerSet = Set<CdeebeeListener>;

const toKey = (entityID: EntityID): string => String(entityID);

class FlushScheduler {
  private pending: ListenerSet = new Set();
  private scheduled = false;

  add(listener: CdeebeeListener): void {
    this.pending.add(listener);
    if (!this.scheduled) {
      this.scheduled = true;
      queueMicrotask(() => this.flush());
    }
  }

  flush(): void {
    this.scheduled = false;
    if (this.pending.size === 0) return;
    const listenerList = Array.from(this.pending);
    this.pending.clear();
    let firstError: unknown;
    let hasError = false;
    for (let i = 0; i < listenerList.length; i += 1) {
      try {
        listenerList[i]();
      } catch (error) {
        if (!hasError) { hasError = true; firstError = error; }
      }
    }
    if (hasError) throw firstError;
  }
}

export class SubscriptionManager<S> {
  private globalSet: ListenerSet = new Set();
  private listMap = new Map<ListName<S>, ListenerSet>();
  private entityMap = new Map<ListName<S>, Map<string, ListenerSet>>();
  private scheduler = new FlushScheduler();

  subscribe(listener: CdeebeeListener, dependencyList?: CdeebeeDependency<S>[]): () => void {
    if (!dependencyList) {
      this.globalSet.add(listener);
      return () => { this.globalSet.delete(listener); };
    }

    for (let i = 0; i < dependencyList.length; i += 1) {
      const { listName, entityID } = dependencyList[i];
      if (entityID === undefined) {
        let set = this.listMap.get(listName);
        if (!set) { set = new Set(); this.listMap.set(listName, set); }
        set.add(listener);
      } else {
        let byID = this.entityMap.get(listName);
        if (!byID) { byID = new Map(); this.entityMap.set(listName, byID); }
        const key = toKey(entityID);
        let set = byID.get(key);
        if (!set) { set = new Set(); byID.set(key, set); }
        set.add(listener);
      }
    }

    return () => {
      for (let i = 0; i < dependencyList.length; i += 1) {
        const { listName, entityID } = dependencyList[i];
        if (entityID === undefined) {
          const set = this.listMap.get(listName);
          if (set) { set.delete(listener); if (set.size === 0) this.listMap.delete(listName); }
        } else {
          const byID = this.entityMap.get(listName);
          const key = toKey(entityID);
          const set = byID?.get(key);
          if (byID && set) {
            set.delete(listener);
            if (set.size === 0) byID.delete(key);
            if (byID.size === 0) this.entityMap.delete(listName);
          }
        }
      }
    };
  }

  notify(changedList: CdeebeeChangedList<S>[]): void {
    if (changedList.length === 0) return;
    this.globalSet.forEach(listener => this.scheduler.add(listener));

    for (let i = 0; i < changedList.length; i += 1) {
      const { listName, entityIDList } = changedList[i];
      this.listMap.get(listName)?.forEach(listener => this.scheduler.add(listener));

      const byID = this.entityMap.get(listName);
      if (!byID) continue;
      if (entityIDList === '*') {
        byID.forEach(set => set.forEach(listener => this.scheduler.add(listener)));
      } else {
        for (let j = 0; j < entityIDList.length; j += 1) {
          byID.get(toKey(entityIDList[j]))?.forEach(listener => this.scheduler.add(listener));
        }
      }
    }
  }

  flush(): void {
    this.scheduler.flush();
  }
}

export function createSubscription(): CdeebeeSubscription {
  const globalSet: ListenerSet = new Set();
  const keyMap = new Map<string, ListenerSet>();
  const scheduler = new FlushScheduler();
  const enqueue = (key: string) => keyMap.get(key)?.forEach(listener => scheduler.add(listener));

  return {
    subscribe: (listener, keyList) => {
      if (!keyList) {
        globalSet.add(listener);
        return () => { globalSet.delete(listener); };
      }
      for (let i = 0; i < keyList.length; i += 1) {
        let set = keyMap.get(keyList[i]);
        if (!set) { set = new Set(); keyMap.set(keyList[i], set); }
        set.add(listener);
      }
      return () => {
        for (let i = 0; i < keyList.length; i += 1) {
          const set = keyMap.get(keyList[i]);
          if (set) { set.delete(listener); if (set.size === 0) keyMap.delete(keyList[i]); }
        }
      };
    },
    notify: keyList => {
      globalSet.forEach(listener => scheduler.add(listener));
      if (typeof keyList === 'string') enqueue(keyList);
      else for (let i = 0; i < keyList.length; i += 1) enqueue(keyList[i]);
    },
    flush: () => scheduler.flush(),
  };
}

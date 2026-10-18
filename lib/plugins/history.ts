import { createSubscription } from '../core/subscription';
import { extractResultIDList } from '../core/normalize';
import { keepIfShallowEqual } from '../utils/shallowEqual';
import { createRecord } from '../utils/record';
import type { CdeebeeErrorKind, CdeebeeListener, CdeebeePlugin, CdeebeeRequestContext, EntityID } from '../core/types';

export interface CdeebeeHistoryError {
  kind: CdeebeeErrorKind;
  message: string;
  status?: number;
  response?: unknown;
}

export interface CdeebeeHistoryEntry {
  requestID: string;
  api: string;
  seq: number;
  startedAt: number;
  endedAt: number;
  response?: unknown;
  error?: CdeebeeHistoryError;
}

export interface CdeebeeHistoryState {
  doneList: Record<string, CdeebeeHistoryEntry[]>;
  errorList: Record<string, CdeebeeHistoryEntry[]>;
  lastResultIDList: Record<string, Record<string, EntityID[]>>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- `unknown` would reject a bare `CdeebeeHistoryOptions` value passed to `history<Storage>()`
export interface CdeebeeHistoryOptions<S = any> {
  maxHistorySize?: number;
  ignoreAbort?: boolean;
  key?: (ctx: CdeebeeRequestContext<S>) => string;
}

const DEFAULT_MAX_HISTORY_SIZE = 20;

export interface CdeebeeHistoryPlugin<S> extends CdeebeePlugin<S> {
  name: 'history';
  getState: () => CdeebeeHistoryState;
  subscribe: (listener: CdeebeeListener, keyList?: string[]) => () => void;
  clear: (key?: string) => void;
  getLast: (key: string) => CdeebeeHistoryEntry | undefined;
}

const insert = (
  record: Record<string, CdeebeeHistoryEntry[]>,
  key: string,
  entry: CdeebeeHistoryEntry,
  maxHistorySize: number,
): Record<string, CdeebeeHistoryEntry[]> => {
  const prevList = record[key] ?? [];
  let index = prevList.length;
  while (index > 0 && prevList[index - 1].seq > entry.seq) index -= 1;
  const capped = maxHistorySize !== 0 && Number.isFinite(maxHistorySize);
  if (capped && index === 0 && prevList.length >= maxHistorySize) return record;
  let entryList = [...prevList.slice(0, index), entry, ...prevList.slice(index)];
  if (capped && entryList.length > maxHistorySize) entryList = entryList.slice(-maxHistorySize);
  return Object.assign(createRecord(record), { [key]: entryList });
};

const omitKey = <V>(record: Record<string, V>, key: string): Record<string, V> => {
  const next = createRecord(record);
  delete next[key];
  return next;
};

const removeBefore = (
  record: Record<string, CdeebeeHistoryEntry[]>,
  key: string,
  seq: number,
): Record<string, CdeebeeHistoryEntry[]> => {
  const entryList = record[key];
  if (!entryList || entryList[0].seq >= seq) return record;
  if (entryList[entryList.length - 1].seq < seq) return omitKey(record, key);
  const index = entryList.findIndex(entry => entry.seq >= seq);
  return Object.assign(createRecord(record), { [key]: entryList.slice(index) });
};

const keepIDList = (prev: Record<string, EntityID[]> | undefined, next: Record<string, EntityID[]>): Record<string, EntityID[]> => {
  if (prev === undefined) return next;
  const listNameList = Object.keys(next);
  let same = listNameList.length === Object.keys(prev).length;
  for (let i = 0; i < listNameList.length; i += 1) {
    const listName = listNameList[i];
    next[listName] = keepIfShallowEqual(prev[listName], next[listName]);
    if (next[listName] !== prev[listName]) same = false;
  }
  return same ? prev : next;
};

export function history<S>(options: CdeebeeHistoryOptions<S> = {}): CdeebeeHistoryPlugin<S> {
  const emptyState = (): CdeebeeHistoryState => ({ doneList: createRecord(), errorList: createRecord(), lastResultIDList: createRecord() });
  let state = emptyState();
  const orderMap = new Map<string, { floor: number; result: number; pending: number; latest: number }>();
  let requestKeyMap = new WeakMap<CdeebeeRequestContext<S>, string>();
  const subscription = createSubscription();
  const maxHistorySize = options.maxHistorySize ?? DEFAULT_MAX_HISTORY_SIZE;
  if (maxHistorySize !== Infinity && (!Number.isSafeInteger(maxHistorySize) || maxHistorySize < 0)) {
    throw new RangeError('[cdeebee] maxHistorySize must be a non-negative safe integer or Infinity');
  }
  const ignoreAbort = options.ignoreAbort ?? true;
  const keyOf = options.key ?? ((ctx: CdeebeeRequestContext<S>) => ctx.api);

  const orderOf = (key: string) => {
    let order = orderMap.get(key);
    if (!order) {
      order = { floor: 0, result: -1, pending: 0, latest: -1 };
      orderMap.set(key, order);
    }
    return order;
  };

  const forgetIfUnused = (key: string) => {
    if (orderMap.get(key)?.pending === 0 && !(key in state.doneList) && !(key in state.errorList) && !(key in state.lastResultIDList)) {
      orderMap.delete(key);
    }
  };

  const raiseFloor = (key: string, seq: number) => {
    if (seq > (orderMap.get(key)?.floor ?? 0)) orderOf(key).floor = seq;
  };

  const addDone = (key: string, ctx: CdeebeeRequestContext<S>, entry: CdeebeeHistoryEntry) => {
    const doneList = insert(state.doneList, key, entry, maxHistorySize);
    let lastResultIDList = state.lastResultIDList;
    const order = orderOf(key);
    const resultIDList = ctx.seq > order.result && ctx.changeSet !== undefined
      ? extractResultIDList(ctx.changeSet, ctx.db.settings.primaryKeyList)
      : undefined;
    if (resultIDList !== undefined && Object.keys(resultIDList).length > 0) {
      order.result = ctx.seq;
      const nextIDList = keepIDList(lastResultIDList[key], resultIDList);
      if (nextIDList !== lastResultIDList[key]) lastResultIDList = Object.assign(createRecord(lastResultIDList), { [key]: nextIDList });
    }
    if (doneList !== state.doneList || lastResultIDList !== state.lastResultIDList) state = { ...state, doneList, lastResultIDList };
  };

  const addError = (key: string, entry: CdeebeeHistoryEntry) => {
    const errorList = insert(state.errorList, key, entry, maxHistorySize);
    if (errorList !== state.errorList) state = { ...state, errorList };
  };

  const onSettled = (ctx: CdeebeeRequestContext<S>) => {
    const key = requestKeyMap.get(ctx);
    if (key === undefined) return;
    try {
      if (ctx.seq < (orderMap.get(key)?.floor ?? 0)) return;
      if (ctx.error && ignoreAbort && ctx.error.kind === 'abort') return;
      const base = { requestID: ctx.requestID, api: ctx.api, seq: ctx.seq, startedAt: ctx.startedAt, endedAt: Date.now() };
      const prevState = state;
      if (ctx.error) {
        const { kind, message, status, response } = ctx.error;
        addError(key, { ...base, error: { kind, message, status, response } });
      } else {
        addDone(key, ctx, { ...base, response: ctx.response });
      }
      if (state !== prevState) subscription.notify(key);
    } finally {
      if (requestKeyMap.delete(ctx)) orderOf(key).pending -= 1;
      forgetIfUnused(key);
    }
  };

  const keyListOf = () => [...new Set([...Object.keys(state.doneList), ...Object.keys(state.errorList), ...Object.keys(state.lastResultIDList)])];

  const removeAll = () => {
    const keyList = keyListOf();
    state = emptyState();
    subscription.notify(keyList);
    for (const key of keyList) forgetIfUnused(key);
  };

  const remove = (key: string, beforeSeq = Infinity) => {
    const doneList = removeBefore(state.doneList, key, beforeSeq);
    const errorList = removeBefore(state.errorList, key, beforeSeq);
    const lastResultIDList = key in state.lastResultIDList && (orderMap.get(key)?.result ?? -1) < beforeSeq
      ? omitKey(state.lastResultIDList, key)
      : state.lastResultIDList;
    if (doneList !== state.doneList || errorList !== state.errorList || lastResultIDList !== state.lastResultIDList) {
      state = { doneList, errorList, lastResultIDList };
      subscription.notify(key);
    }
    forgetIfUnused(key);
  };

  const clear = (key?: string) => {
    for (const clearedKey of key === undefined ? orderMap.keys() : [key]) {
      raiseFloor(clearedKey, (orderMap.get(clearedKey)?.latest ?? -1) + 1);
    }
    if (key === undefined) removeAll();
    else remove(key);
  };

  return {
    name: 'history',
    onRequestStart: ctx => {
      const keyMap = requestKeyMap;
      const key = keyOf(ctx);
      if (keyMap !== requestKeyMap) return;
      keyMap.set(ctx, key);
      const order = orderOf(key);
      order.pending += 1;
      order.latest = Math.max(order.latest, ctx.seq);
    },
    onReset: () => {
      orderMap.clear();
      requestKeyMap = new WeakMap();
      removeAll();
    },
    onRequest: ctx => {
      if (!ctx.options.historyClear) return;
      const key = requestKeyMap.get(ctx);
      if (key === undefined) return;
      raiseFloor(key, ctx.seq);
      remove(key, ctx.seq);
    },
    onSettled,
    getState: () => state,
    getLast: key => {
      const entryList = state.doneList[key];
      return entryList === undefined ? undefined : entryList[entryList.length - 1];
    },
    subscribe: subscription.subscribe,
    clear,
  };
}

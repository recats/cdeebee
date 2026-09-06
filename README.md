# cdeebee

cdeebee is a standalone normalized data store with a typed request pipeline: it keeps API responses in keyed lists (like tables in a relational database), runs every fetch through a small plugin chain, and exposes React hooks that re-render only the component that actually needs the changed data. There is no Redux underneath — `createCdeebee` builds and owns its own state.

## Installation

```sh
pnpm add @recats/cdeebee
```

Peer dependency: `react >= 19`. If you only need the store and request pipeline (no React), import from `@recats/cdeebee/core` — that entry point has no React dependency at all and can be used in workers, tests, or non-React apps.

## Quick start

```ts
import { createCdeebee, history, cancelation, queryQueue, devtools } from '@recats/cdeebee/core';
import { createCdeebeeHooks } from '@recats/cdeebee';

interface Storage {
  campaignList: Record<number, CampaignDto>;
  reklList: Record<number, ReklDto>;
  sessionList: Record<string, SessionDto>;
}

export const db = createCdeebee<Storage>({
  fetch: {
    baseUrl: import.meta.env.REACT_APP_API,
    mergeWithData: () => ({ sessionToken: getSessionToken() }),
    headerList: { 'X-Client': 'dsp' },
  },
  primaryKeyList: { campaignList: 'campaignID', reklList: 'reklID', sessionList: 'sessionToken' },
  strategyList: { sessionList: 'replaceList' },
  indexList: { campaignList: ['reklID'] },
  pluginList: [queryQueue(), history({ maxHistorySize: 50 }), cancelation({ apiList: ['/campaign/stats'] }), devtools({ name: 'dsp' })],
  initialStorage: typeof window !== 'undefined' ? window.__PRELOADED_STATE__?.storage : undefined,
});

export const { useEntity, useList, useEntityList, useListSelector, useEntityListBy, useLoading, useIsLoading, useStore, useRequestHistory, useRequestErrorList, useLastResultIDList, useLastResponse } = createCdeebeeHooks(db);
```

```ts
// request: resolves with the full response, storage updates itself, errors reject
const response = await db.request<CleanServerResponse, CampaignListRequestDto>({ api: '/campaign/list', data: { page: 1 } });
navigate(campaignLink.edit(response.campaignList.data[0].campaignID));
```

`db` is a plain object — it can live in a module-level file like above, be passed through context, or be constructed per test. `createCdeebeeHooks(db)` returns a set of hooks bound to that instance; call it once per store.

### Custom fetch

`settings.fetch.fetch` injects the fetch implementation used for every request — it defaults to `globalThis.fetch`. Pass your own to run in an environment without a global `fetch`, to point tests at a stub without touching the global, or to wrap the real `fetch` with instrumentation (timing, logging, auth refresh). A stub must return a `Response`-like object with `ok`, `status` and `text()` (and `blob()` for blob requests): JSON is read through `text()` so an empty body is distinguishable from a malformed one.

```ts
createCdeebee<Storage>({
  fetch: { fetch: instrumentedFetch },
  primaryKeyList: { campaignList: 'campaignID' },
});
```

## Storage model

An API response is expected to carry one or more list envelopes shaped `{ data: [...], primaryKey: 'fieldName' }`. On a successful request, each envelope is normalized into `storage.<listName>[entityID]` — keyed by the entity's primary key. Any other key on the response (not a list envelope) is not stored; it is only available on the value the request promise resolves with.

`primaryKeyList` (passed to `createCdeebee`) is the source of truth for each list's primary key field, not the response's own `primaryKey`. If they disagree, cdeebee warns in development (`console.warn`) and uses the configured key.

## Strategies

Each list is merged into storage according to a strategy, resolved as `options.strategyList[list] ?? settings.apiStrategyList[api][list] ?? settings.strategyList[list] ?? 'patch'`:

| Strategy | Behavior |
|---|---|
| `patch` (default) | Each entity in the response overrides only the fields it carries. A missing key or an empty array is read as "this endpoint did not compute it" and the stored value is kept. Entities absent from the response are kept. |
| `upsert` | Each entity in the response replaces the stored one whole — every field, including omitted ones and `[]`, is authoritative. Entities absent from the response are kept. |
| `replaceList` | The whole list is replaced with only the entities in the response — except entities the store wrote at a later send or newer version, which are kept as they are (see Freshness). |
| `skip` | The list is left untouched. |

The split is by endpoint, not by list: most endpoints return an entity in a *thin* shape (a stats endpoint listing items without their relation lists, a verify endpoint listing what the user can see), and a few return it *full* (get-with-relations, save). Declare the full ones once in `settings.apiStrategyList`; everything else patches by default and can never wipe a field it did not compute:

```ts
createCdeebee<Storage>({
  apiStrategyList: {
    '/item/list': { itemList: 'upsert' },
    '/item/save': { itemList: 'upsert' },
  },
});
```

Save and full-fetch endpoints **must** be `upsert`: with `patch`, a field the server cleared (sent as an omitted key or `[]`) would keep its stale value.

## Freshness and completeness

Two responses can carry the same entity and disagree — because one is thin and the other full, or because the server changed between them. cdeebee keeps two facts per stored entity and resolves every write with them, so the result does not depend on the order responses arrive:

- **version** — the server's own version of the entity, read through `settings.versionKeyList` (`{ itemList: 'updatedAt' }`; numbers as-is, ISO timestamps parsed to ms). When absent, the **send order** of the request stands in: the response to a later-issued request wins.
- **complete** — set once an `upsert`/`replaceList` write landed at the current version; from then on an older write is dropped instead of merged.

| incoming write | stored entity | result |
|---|---|---|
| newer, `upsert` | any | replaced whole, `complete` |
| newer, `patch` | any | incoming fields win, holes filled from stored; `complete` only if the version did not change |
| older | `complete` | dropped |
| older | incomplete | stored fields win, incoming fills the holes; `complete` if it was an `upsert` at the same version |

`db.getEntityMeta(listName, entityID)` returns a detached `{ version, seq, complete }` for debugging and tests. `seq` is the latest send that confirmed the entity exists; write ordering and removal boundaries stay internal, and a removed entity has no meta, like one never seen. Local mutations (`setEntity`) replace the entity whole at a fresh sequence (an edit can clear an array or unset a field) and keep its completeness flag, so a slow response to an earlier request cannot overwrite what the user just typed. `replaceList` is checked per entity the same way: a stale list response neither overrides nor removes entities written by a later send.

Without `versionKeyList`, send order is the only ordering signal; it cannot detect when the server processes requests in a different order. `queryQueue` sends requests concurrently and orders response processing within each queue. It does not serialize server execution; await each `db.request()` before sending the next when that ordering is required.

`primaryKeyList` and `versionKeyList` only accept string or number fields (optional allowed; `unknown` and `any` pass). Arrays, objects and booleans are rejected at compile time. Entities with a `[key: string]: unknown` index signature lose precise key checking — prefer closed DTO types.

## Local mutations

Storage can also be changed without a request, through the same commit path (so subscribers and plugins see them the same way):

- `db.setEntity(listName, entityID, patch)` — a plain object `patch` is shallow-merged over the previous entity; a `(prevEntity) => nextEntity` updater function replaces the entity with its return value. Either way, cdeebee always sets the primary key field on the result to `entityID`, so an updater does not need to (and cannot accidentally omit or override) it.
- `db.removeEntityList(listName, entityIDList)` — removes entities by id.
- `db.clearList(listName)` — empties a list.
- `db.replaceList(listName, entityRecord)` — replaces a whole list with a keyed record.
- `db.commit(changeSet, meta)` — the low-level primitive all of the above call; use it directly to touch several lists atomically in one `{ listName: { upsertList, removeIDList, replaceList } }` change set.

### Deletions and resets

A removal leaves a sequence tombstone and a reset (`clearList` / `replaceList`) leaves a list boundary, so a response to an earlier-sent request cannot bring removed entities back — including ids that were absent at the reset. A later write can re-add an entity, but responses sent before its removal still cannot fill or overwrite it, even with a newer server version. An entity that a `replaceList` kept was never removed: its server version keeps precedence over send order. A reset drops the tombstones it makes redundant, so only removals sent after the last reset keep one.

**Optimistic deletion:** call `db.removeEntityList` *before* sending the delete request and keep pending/deleting flags outside the store. Anything that confirms the entity at a later send — a local `setEntity`, or a list fetch sent after the delete but answered first — turns the delete response into a no-op (development logs a `console.warn`); only a `replaceList` omitting the row, a `clearList` or a local removal evicts it afterwards. Await the delete before the follow-up list fetch: `queryQueue` orders response processing, not server execution. There is no automatic rollback.

**Bulk edits:** pass all updated entities in one `db.commit({ listName: { setList: entityList } }, { source: 'set' })`. `setList` replaces each entity whole, so include the primary key and every field to keep. One commit copies each affected list once and notifies once; a loop of `setEntity` calls copies the list on every call, which matters on large lists keyed by UUIDs.

## Request options

`db.request<Response, Data>(options)`:

| Option | Type | Description |
|---|---|---|
| `api` | `string` | Endpoint path, joined to `settings.fetch.baseUrl` unless it is already an absolute URL. |
| `data` | `Data` | Request payload; merged with `settings.fetch.mergeWithData`. Omitted from the request body for `GET`. |
| `method` | `'GET' \| 'POST' \| 'PUT' \| 'DELETE' \| 'PATCH'` | Defaults to `'POST'`. |
| `headerList` | `Record<string, string>` | Merged over `settings.fetch.headerList`. |
| `fileList` | `File[]` | When present, the request body is sent as `FormData` (files under `fileKey`, the JSON payload under `bodyKey`) and no `Content-Type` header is sent — the browser sets the multipart boundary. |
| `responseType` | `'json' \| 'text' \| 'blob'` | Defaults to `'json'`. An empty JSON body (HTTP 204/205, or a 200 with no content) resolves to `undefined` — `normalize` receives it as-is (the default one commits nothing); invalid JSON rejects with a parse error. `text` resolves `''` and `blob` an empty `Blob` in that case. |
| `strategyList` | `Partial<Record<listName, strategy>>` | Per-request strategy override. |
| `normalize` | `(response, ctx) => ChangeSet` | Per-request normalize override; falls back to `settings.normalize`, then the built-in `defaultNormalize`. |
| `ignoreStorage` | `boolean` | Skip normalizing and committing the response entirely; the request still resolves with the raw response. |
| `signal` | `AbortSignal` | External abort signal, in addition to the one cdeebee manages internally. |
| `historyClear` | `boolean` | Clear the `history` plugin's entries for this `api` before the request starts — the classic "reset the form's server error on resubmit". |
| `meta` | `Record<string, unknown>` | Free-form data for your plugins, exposed as `ctx.meta` (defaults to `{}`), e.g. `meta: { silentError: true }`. |

The library always sets an `ui-request-id` header to the request's internal id; it cannot be overridden by `headerList`. For JSON bodies, callers may set their own `Content-Type` via `headerList`.

## Errors

A rejected request throws a `CdeebeeRequestError`:

```ts
interface CdeebeeRequestError extends Error {
  kind: 'http' | 'network' | 'abort' | 'parse';
  api: string;
  requestID: string;
  status?: number;
  response?: unknown;
}
```

- `'http'` — the server responded with a non-ok status; `status` and the parsed body (`response`) are set.
- `'network'` — `fetch` itself threw (offline, DNS, CORS, ...).
- `'abort'` — the request was aborted (external `signal`, `cancelation` plugin, or a plugin returning `false` from `onRequest`), including an abort that happens while a non-ok response body is still being parsed.
- `'parse'` — the response body could not be parsed as the requested `responseType`.

`isAbortError(error)` is a type guard for the `'abort'` kind, useful for silencing expected cancellations:

```ts
try {
  // storage.campaignList is updated by the request itself — nothing to copy by hand.
  // Only non-list data (rawResponse, extension, ...) lives on the resolved response.
  const response = await db.request<CleanServerResponse>({ api: '/campaign/stats', data });
  setGroupedStats(response.rawResponse.groupedStats);
} catch (error) {
  if (isAbortError(error)) return;
  toastError('Failed to load campaign stats');
}
```

## Hooks

All hooks are returned from `createCdeebeeHooks(db)` and only re-render a component when the data it actually reads changes.

| Hook | Re-renders on |
|---|---|
| `useEntity(listName, entityID)` | that one entity |
| `useList(listName)` | any change to the list |
| `useEntityList(listName, entityIDList)` | any of the listed entities |
| `useListSelector(listName, selector, depList?)` | the list or `depList`, re-running `selector`; keeps the previous array reference when the result is shallow-equal. `selector` runs again only when the list or `depList` changes, so list every prop it closes over, like `useMemo`; for one entity by id use `useEntity` |
| `useEntityListBy(listName, fieldName, value)` | the list, reading through an index configured in `settings.indexList`; `fieldName` is typed to the entity's own keys and it throws if that `(listName, fieldName)` pair was not indexed. Order is index insertion order (first seen), stable across edits that do not change the indexed field; not sorted |
| `useLoading(apiList)` | whether any api in `apiList` is currently in flight |
| `useIsLoading()` | whether any request at all is currently in flight |
| `useStore(selector, equalityFn?)` | the whole state (storage + `activeRequestList`), through `selector`; `equalityFn` defaults to `Object.is` |
| `useRequestHistory(api)` | successful request history for `api` (requires the `history` plugin) |
| `useRequestErrorList(api)` | failed request history for `api` (requires the `history` plugin) |
| `useLastResultIDList(api, listName)` | the IDs for `listName` from the latest successful normalized response containing lists; explicitly empty lists clear IDs, responses without lists retain them (requires the `history` plugin) |
| `useLastResponse<R>(api)` | the newest successful response for `api` (`undefined` before the first one); use it for the non-list parts of a response (`extension`, `rawResponse`) instead of keeping a copy in your own state (requires the `history` plugin) |

`useStore` is a last resort — a selector over the whole state is easy to over-subscribe with. An inline selector runs on every render; when it derives an object or array, pass `shallowEqual` (exported from the package) or another `equalityFn` so the reference stays stable for `useEffect` / `React.memo`. `equalityFn` must fully define equivalence: it is applied across renders and prop changes, so comparing only a length is not enough. A common parent/rows split:

```tsx
function CampaignTable() {
  const idList = useListSelector('campaignList', Object.keys);
  return <>{idList.map(id => <CampaignRow key={id} campaignID={Number(id)} />)}</>;
}

function CampaignRow({ campaignID }: { campaignID: number }) {
  const campaign = useEntity('campaignList', campaignID);
  return <tr>{campaign?.title}</tr>;
}
```

`CampaignTable` only re-renders when the set of ids changes; each `CampaignRow` only re-renders when its own entity changes.

## Plugins

Every request runs through the pipeline in this order:

```
onRequest → fetch (+ onRetry loop) → onResponse → commit → onCommit → onSettled → resolve
         ↘ failure ─────────────────────────────────────→ onError → onSettled → reject
```

`onRequest`/`onResponse` throwing (or `onRequest` returning `false`) aborts the request and rejects the promise. `onError`/`onSettled` failures are isolated: they are logged with `console.error` and never change the request's outcome. The abort signal is re-checked after every `onResponse` hook and right before the response is committed, so an abort that lands after the network call still completes is honored — the response is never stored. A `signal` that is already aborted when `db.request` is called rejects immediately, before any `onRequest` hook runs. Per-request data for plugins travels in `options.meta` and is read as `ctx.meta`.

```ts
interface CdeebeePlugin<Storage> {
  name: string;
  setup?: (db: CdeebeeInstance<Storage>) => void;
  onRequest?: (ctx: CdeebeeRequestContext<Storage>) => void | false | Promise<void | false>;
  onResponse?: (ctx: CdeebeeRequestContext<Storage>) => void | Promise<void>;
  onRetry?: (ctx: CdeebeeRequestContext<Storage>) => number | false;
  onError?: (ctx: CdeebeeRequestContext<Storage>) => void | Promise<void>;
  onSettled?: (ctx: CdeebeeRequestContext<Storage>) => void | Promise<void>;
  onCommit?: (changeSet: CdeebeeChangeSet<Storage>, meta: CdeebeeCommitMeta, changedList: CdeebeeChangedList<Storage>[]) => void;
  getState?: () => unknown;
}
```

Built-ins, all importable from `@recats/cdeebee/core` (or `@recats/cdeebee`):

| Plugin | Options | Behavior |
|---|---|---|
| `history(options?)` | `{ maxHistorySize?, ignoreAbort? }` | Records done/error entries and `lastResultIDList` per api; exposes `getState()`, `getLast(api)`, `subscribe(listener, apiList?)`, `clear(api?)`; honors the `historyClear` request option. Required by `useRequestHistory`, `useRequestErrorList`, `useLastResultIDList`, `useLastResponse`. Every entry retains the full parsed `response` object, so history is capped at `maxHistorySize` entries per api — `20` by default; pass `maxHistorySize: 0` for unbounded. Aborted requests are not recorded in `errorList` unless `ignoreAbort: false`. |
| `cancelation(options?)` | `{ apiList?, mode?: 'previous' \| 'latest' }` | Deduplicates concurrent calls to the same api: `'previous'` (default) aborts the in-flight call and lets the new one proceed; `'latest'` skips the new call while one is in flight. Restricted to `apiList` when given. |
| `queryQueue(options?)` | `{ apiList?, key?: (ctx) => string }` | Sends matching requests concurrently and processes successful responses in send order within each key. Uses one shared queue by default; `apiList` restricts participation. Failed or aborted entries preserve predecessor ordering. Aborting a waiting response rejects promptly. |
| `retry(options)` | `{ count, backoffMs?, when? }` | Retries a failed request up to `count` times (`when` defaults to network errors only); `backoffMs` is a fixed delay or `(attempt) => ms`. |
| `devtools(options?)` | `{ name? }` | Connects to the Redux DevTools browser extension if present and streams every commit and settled request as an action. Use one `devtools()` instance per store. |

`history` records the normalized change set as proposed, not what freshness checks kept, so `lastResultIDList` can name ids no longer in storage (a list cleared while a request was in flight); `useEntityList` omits them. Responses without list envelopes keep the previous ids, while `getLast()` / `useLastResponse()` always reflect the latest successful response.

Plugin order is the order of `pluginList` for every hook. List `queryQueue` first — an async `onSettled` in an earlier plugin delays the queue release, and with it every request waiting behind the current one.

Use independent queue keys when unrelated responses should not block each other:

```ts
queryQueue<Storage>({ key: ctx => ctx.api }); // one queue per API
queryQueue<Storage>({ key: ctx => String(ctx.meta.resourceKey ?? ctx.api) }); // group related endpoints
```

Requests that must be ordered together must return the same key. Queue keys control response processing only; they do not deduplicate requests or change entity freshness checks. `key` runs inside `onRequest`, so it must not throw.

App-level plugins are just objects matching the interface. Some examples:

```ts
const apiVersion = (): CdeebeePlugin<Storage> => ({
  name: 'apiVersion',
  onResponse: ctx => {
    if (ctx.response === undefined) return;   // 204 / empty body
    const { apiVersion, expectedUiVersion } = ctx.response as CleanServerResponse;
    forceUpdateOnStaleUiVersion(BUILD_VERSION, expectedUiVersion);
    if (apiVersion !== getApiVersion()) { setApiVersion(apiVersion); resetWindowCache(true); }
  },
});

const toast = (apiList: string[]): CdeebeePlugin<Storage> => ({
  name: 'toast',
  onSettled: ctx => {
    if (!apiList.includes(ctx.api)) return;
    if (ctx.meta.silentError) return;   // opt out per request: db.request({ api, data, meta: { silentError: true } })
    if (ctx.error) toastError(ErrorLocalize[(ctx.error.response as CleanServerResponse | undefined)?.responseStatus ?? '']?.text ?? 'Something went wrong');
    else toastSuccess('Changes saved');
  },
});

const internalError = (): CdeebeePlugin<Storage> => {
  const lastRequestIDList: string[] = [];
  return {
    name: 'internalError',
    onRequest: ctx => { lastRequestIDList.unshift(ctx.requestID); lastRequestIDList.splice(3); },
    onError: ctx => { if (ctx.error?.kind === 'http' && (ctx.error.status ?? 0) >= 500) showInternalErrorModal([...lastRequestIDList]); },
  };
};
```

## SSR

Pass server-rendered data as `settings.initialStorage` when constructing the store. To hand the client the same snapshot, serialize `db.getSnapshot().state.storage` into the page (e.g. `window.__PRELOADED_STATE__`) and read it back when constructing the client-side store, as in the quick start example above.

## Consistency guarantees

1. **Atomic commit**: one response produces one change set across all lists, one new snapshot, one flush — readers never see a half-applied response.
2. **Immutable snapshot**: `db.getState()` returns the same object until a commit, so `useSyncExternalStore` never tears; `getSnapshot()` is a fresh serializable wrapper (`{ state, pluginStateList }`) for SSR/devtools, built on every call.
3. **Ordering**: `queryQueue` processes successful responses in send order within each queue key. Entity freshness checks apply with or without the plugin: versions take precedence when both are known and differ, otherwise send sequence decides.
4. **Abort → no commit**: an aborted or plugin-skipped request never touches storage, `activeRequestList` is cleaned up, and the promise rejects with `kind: 'abort'`.
5. **Local edits vs. responses**: local edits receive a fresh sequence. Deletions and list resets prevent earlier requests from resurrecting removed entities. There is no rollback in v4.0.
6. **Batching**: request commits inside one microtask notify once; local mutations (`setEntity`/`removeEntityList`/`clearList`/`replaceList`) notify synchronously so controlled inputs never lose their caret. React 18+ coalesces renders either way.
7. **Notify only on real change**: entities are compared with a shallow equality check, so unchanged entities keep their reference and their listeners are not notified.

## Migration from 3.x

Moving from the Redux-based 3.x api (`factory`, `configureStore`, `dispatch(request(...))`) to the standalone v4 store is a mechanical rewrite — see [`MIGRATION.md`](MIGRATION.md) for the full mapping and a step-by-step plan.

## License

MIT

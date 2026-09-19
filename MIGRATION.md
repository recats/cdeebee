# Migrating from cdeebee 3.x to 4.x

cdeebee 4 owns its normalized store and request pipeline. Replace the Redux factory, dispatch calls, middleware, and selectors with a store instance, promises, plugins, and hooks bound to that instance.

## Store setup

Replace `factory(settings, storage)`, `combineSlices`, and `configureStore` with `createCdeebee<Storage>(settings)`. Construct the store once per client application or once per server request. Create separate stateful plugin instances for each store.

| 3.x | 4.x |
|---|---|
| `factory(settings, storage)` | `createCdeebee({ ...settings, initialStorage: storage })` |
| `settings.modules: ['history', 'listener', 'storage', 'cancelation', 'queryQueue']` | `pluginList: [history(), cancelation(), queryQueue()]`; storage and subscriptions are built in |
| `settings.mergeWithHeaders` | `settings.fetch.headerList` |
| `settings.mergeWithData` | `settings.fetch.mergeWithData` |
| `settings.fileKey` / `settings.bodyKey` | `settings.fetch.fileKey` / `settings.fetch.bodyKey` |
| `settings.maxHistorySize` | `history({ maxHistorySize })` |
| Redux DevTools integration | `devtools()` plugin |

Import the store and plugins from `@recats/cdeebee/core`. React hooks are exported from `@recats/cdeebee` and require React 19 or newer. React is an optional peer dependency; core-only consumers do not need it.

`primaryKeyList` defines the complete storage schema. Declare every list that should be stored. The default normalizer ignores undeclared envelopes, but they remain accessible in the returned response. Direct commits and custom normalizers must name declared lists.

Pass preloaded data through `initialStorage`. Initial entities receive their configured server version, sequence zero, and `complete: false`: older responses can fill missing fields but cannot overwrite defined fields. This transfers data, not request history, tombstones, or completeness metadata.

## Requests and errors

Replace dispatch calls with promises:

```ts
// 3.x
dispatch(request({ api, body, onResult, ignore, listStrategy }));

// 4.x
const response = await db.request({
  api,
  data: body,
  ignoreStorage: ignore,
  strategyList,
});
onResult(response);
```

Map the old strategy names as described below. Move success handling after `await` and rejection handling into `catch`. To branch on a result instead, use `db.requestSettled(options)`, which resolves `{ ok: true, response }` or `{ ok: false, error }` for request errors.

Replace the rejected-action payload `{ status, statusText, data }` with `CdeebeeRequestError { kind, status, response }`. Handle these error kinds:

| Kind | Meaning |
|---|---|
| `http` | Non-success HTTP status; includes the parsed error body when available |
| `network` | Fetch failed |
| `abort` | Request canceled or skipped by a plugin; use `isAbortError(error)` to recognize it |
| `parse` | Response body could not be parsed |
| `request` | URL, dynamic settings, or request-body preparation failed before fetch |
| `plugin` | `onRequest`, `onResponse`, or `onRetry` failed, including an invalid retry delay |
| `normalize` | Normalization failed or produced a change set with undeclared lists |

Read `rawResponse`, `extension`, and other non-list data from the returned response or `useLastResponse(api)` with the history plugin. Remove `requestManager.requestByApiUrl` access and synthetic storage lists such as `RAW_GroupedStats`.

Header names are merged case-insensitively. Per-request headers override settings; `ui-request-id` is always library-owned, and multipart requests omit `Content-Type` so the runtime can set the boundary.

## Merge strategies and normalizers

Replace `settings.listStrategy` with `settings.strategyList` and per-request `listStrategy` with `strategyList`. Configure endpoint-specific rules in `settings.apiStrategyList`.

| Strategy | Behavior in 4.x |
|---|---|
| `patch` | Default for thin responses: incoming fields win, while missing fields and empty arrays retain stored values |
| `upsert` | Full entities replace stored entities, including omitted fields and empty arrays |
| `replaceList` | Replaces the list, subject to entity freshness and deletion boundaries |
| `skip` | Leaves the list untouched |

Use `patch` for old `merge` call sites that return thin entities. Use `upsert` for full-fetch and save endpoints so cleared fields do not keep stale values. Choose `upsert` or `replaceList` for old `replace` call sites according to whether entities absent from the response should remain.

| 3.x normalizer | Replacement |
|---|---|
| `deepFullMerge` | `patch` for thin entities, `upsert` for full entities; nested objects are not recursively merged |
| `deepDifferenceMerge` / `__entity` | Remove the old mechanism; express writes and removals through a change set |
| `normalizeAndGetExtension` | Read `extension` from the response; derive fields such as `clientPosition` in a custom `normalize` |
| `normalizeAndReplaceRawResponse` | Read the transient data from the response or `useLastResponse` |
| `applyListPropertyFallback` | Use `upsert` for authoritative full entities; preserve domain-specific field rules in a custom normalizer when needed |

Set `versionKeyList` for entities with a server version or timestamp, for example `{ itemList: 'updatedAt' }`. Otherwise request send order determines freshness. `queryQueue` orders response processing, not server execution; await dependent mutations when the server must process them in sequence.

## Local writes and subscriptions

| 3.x | 4.x |
|---|---|
| `slice.actions.set(valueList)` | `db.setEntity` or one `db.commit` for a batch |
| `state.cdeebee.storage.xList` | `db.getState().storage.xList` |
| `state.cdeebee.request.active` | `db.getState().activeRequestList` |
| `slice.actions.historyClear(api)` | Retain the `history()` plugin instance and call its `clear(api)` method |
| `historyClear: true` | Same request option |

`setEntity(listName, id, patch)` shallow-merges an object patch. An updater function returns the whole replacement entity. For bulk edits, use one `db.commit({ listName: { setList: entityList } }, { source: 'set' })`; each entity must include its primary key and all fields to retain.

Use `removeEntityList`, `clearList`, or `replaceList` for removals and resets of individual lists. Deletion boundaries prevent older in-flight responses from restoring removed entities. Optimistic rollback is application-owned.

Storage and history dictionaries have no prototype. Replace `record.hasOwnProperty(key)` with `Object.hasOwn(record, key)`; `Object.keys`, `Object.values`, and JSON serialization work as usual. Treat stored entities, arrays, and index sets as read-only. Equality is shallow, so newly parsed nested objects count as changed even when their contents match.

## React hooks

Call `createCdeebeeHooks(db)` once per store instead of passing a Redux selector.

| 3.x | 4.x |
|---|---|
| `useStorageList(list)` | `useList(list)` |
| `useStorage()` | `useStore(selector, equalityFn?)`; prefer a narrower hook where possible |
| `useRequestHistory` | `useRequestHistory` with the history plugin |
| `useRequestErrors` | `useRequestErrorList` with the history plugin |
| `useLastResultIdList(api, list)` | `useLastResultIDList(api, list)` with the history plugin |

Use `useEntity(listName, id)` for one entity and `useEntityList(listName, idList)` for a selection. `useListSelector` accepts a dependency list for values captured by the selector. Indexed selections use `useEntityListBy` or `useEntityListIn`; declare the indexed fields in `settings.indexList` first. `useLoading` accepts one API string or an array; `useIsLoading` watches all requests.

`useLastResultIDList` returns `EntityID[]`, not `string[]`: canonical numeric strings such as `'5'` become `5`, while strings such as `'005'` remain strings. `useEntityList` omits IDs no longer present in storage.

## Plugins and session changes

Move Redux middleware for `cdeebee/request/*` actions into plugins. Use `onRequest` to prepare or skip requests, `onResponse` to process or reject responses before storage, and `onRetry` to decide whether to retry. Use `onError` and `onSettled` for notifications and cleanup.

`onCommit` and `onReset` are synchronous observers. Their errors, like failures in `onError` and `onSettled`, are logged and isolated. Throwing from `onCommit` does not reject an already successful save; use `onResponse` or `normalize` to reject data before it is written.

Call `db.reset()` after updating credentials when logging out or switching accounts. It empties storage, loading, and built-in plugin state, invalidates old requests, and preserves subscriptions. It does not restore `initialStorage`. Stateful custom plugins implement `onReset()` to clear their state and release resources: old requests receive no further error/settled hooks. Asynchronous hooks already running must check `ctx.controller.signal` before their own side effects after an `await`.

Cancellation defaults to grouping by API. For independent consumers of one endpoint, use a stable key such as `cancelation({ key: ctx => JSON.stringify([ctx.api, ctx.meta.editorID]) })`. List `queryQueue` before other plugins whose response processing must wait for the queue.

Retry counts must be non-negative safe integers and delays finite and non-negative. Abort and request-preparation errors are never retried. History retains at most 20 entries per API by default; `maxHistorySize: 0` or `Infinity` explicitly makes it unbounded. Storage has no automatic eviction: applications decide when to remove heavy details or reset the store.

Compare the migrated application's load, save, clear-field, cancellation, and account-switch flows with its previous behavior. The [README](README.md) contains complete setup and plugin examples and the storage consistency contract.

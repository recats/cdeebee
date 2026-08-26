# Migrating from cdeebee 3.x to 4.0

cdeebee 4.0 removes the Redux dependency entirely. `createCdeebee` now builds and owns its own store — there is no slice, no `configureStore`, and no `combineSlices`. The public shape (normalized lists, request pipeline, hooks) is the same idea, but every entry point changed name or signature.

## API mapping

| 3.x | 4.0 |
|---|---|
| `factory(settings, storage)` + `combineSlices` + `configureStore` | `createCdeebee(settings)` — no Redux |
| `settings.modules: ['history', 'listener', 'storage', 'cancelation', 'queryQueue']` | `pluginList: [history(), cancelation(), queryQueue()]`; listener and storage are always on |
| `settings.mergeWithHeaders` / `mergeWithData` / `fileKey` / `bodyKey` | `settings.fetch.headerList` / `mergeWithData` / `fileKey` / `bodyKey` |
| `settings.listStrategy` (`merge`/`replace`/`skip`) | `settings.strategyList` (`upsert`/`replaceList`/`skip`); `merge` → `upsert` (entity replaced whole, no deep merge) |
| `settings.maxHistorySize` | `history({ maxHistorySize })` |
| `dispatch(request({ api, body, onResult, ignore, listStrategy }))` | `await db.request({ api, data, ignoreStorage, strategyList })`; `onResult` → code after `await` / `catch` |
| `request.rejected` payload `{ status, statusText, data }` | `CdeebeeRequestError { kind, status, response }` |
| `slice.actions.set(valueList)` | `db.setEntity` / `db.commit`; `batchingUpdate` remains as a utility for your own state |
| `slice.actions.historyClear(api)` / `historyClear: true` | `historyClear: true` request option (same semantics) or `db.getPlugin('history').clear(api)` |
| `state.cdeebee.storage.xList` | `db.getState().storage.xList` / `useList('xList')` |
| `state.cdeebee.request.active` | `db.getState().activeRequestList` / `useLoading(apiList)` |
| `useStorageList(list)` / `useStorage()` | `useList(list)` / `useStore(s => s.storage)` |
| `useRequestHistory` / `useRequestErrors` / `useLastResultIdList` | `useRequestHistory` / `useRequestErrorList` / `useLastResultIDList` / `useLastResponse` (history plugin required) |
| `useLastResultIdList(api, list): string[]` | `useLastResultIDList(api, list): EntityID[]` — ids keep their original type (`string \| number`), numeric-looking ones come back as numbers |
| `requestManager.requestByApiUrl[api]` | gone — read the value from the resolved promise (`const response = await db.request(...)`) |
| `rawResponse` (e.g. `RAW_GroupedStats` in storage) | read from the resolved promise; transient response data is never stored |
| `extension` | read from the resolved promise; derived fields (e.g. `clientPosition`) via a per-request `normalize` |
| `createCdeebeeHooks(selector)` | `createCdeebeeHooks(db)` |
| Redux middleware on `cdeebee/request/*` action types | plugins: `onRequest` / `onResponse` / `onError` / `onSettled` / `onCommit` |
| Redux DevTools via store | `devtools()` plugin |

## Normalizer mapping

| 3.x normalizer | 4.0 |
|---|---|
| `deepFullMerge` | `upsert` |
| `deepDifferenceMerge` (`__entity`) | removed together with `__entity` |
| `normalizeAndGetExtension` | `extension` read from the resolved response; `clientPosition` via a custom `normalize` |
| `normalizeAndReplaceRawResponse` | `rawResponse.groupedStats` read from the resolved response |
| `applyListPropertyFallback` | unnecessary — the entity is replaced whole |

## Step by step

1. **Replace store setup.** Delete the `configureStore`/`combineSlices` wiring and the `factory(settings, storage)` call. Call `createCdeebee<Storage>(settings)` once and export the resulting `db`. Move `mergeWithHeaders`/`mergeWithData`/`fileKey`/`bodyKey` under `settings.fetch`.
2. **Replace `dispatch(request(...))` call sites** with `await db.request(...)`. Anything that previously ran inside `onResult` runs after the `await` (success) or in a `catch` block (failure); a rejected request now throws a `CdeebeeRequestError` instead of resolving with a rejected action.
3. **Move Redux middleware into plugins.** Any middleware that inspected `cdeebee/request/*` action types becomes a plugin implementing `onRequest`/`onResponse`/`onError`/`onSettled`/`onCommit` — see the README's plugin examples (`apiVersion`, `toast`, `internalError`) for the shape.
4. **Rename hooks** at call sites: `useStorageList` → `useList`, `useStorage` → `useStore(s => s.storage)`, `useRequestErrors` → `useRequestErrorList`, `useLastResultIdList` → `useLastResultIDList`. `createCdeebeeHooks` now takes the `db` instance instead of a state selector.
5. **Delete `normalize` helpers that deep-merged.** `upsert` (the new default, replacing `merge`) replaces the whole entity instead of deep-merging it. If a call site relied on deep merge, write a custom `normalize` that spreads the previous entity from `ctx.storage` under the incoming one (see the README's "Strategies" section).
6. **Run the app with `devtools()` attached** and compare snapshots against the 3.x Redux DevTools trace for the same flows, to catch any strategy or ordering regression before removing the old store.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

cdeebee is a standalone normalized data store with a typed request pipeline. It keeps API responses in keyed lists (like tables in a relational database), runs every request through a small ordered plugin chain, and exposes React hooks that re-render only the component whose data actually changed. There is no Redux dependency — `createCdeebee` builds and owns its own state.

## Development Commands

```bash
pnpm build              # Build library using Vite
pnpm lint               # Lint lib/ and tests/ with ESLint
pnpm lint:ts            # Type-check lib/ and tests/ with TypeScript (no emit)
pnpm lint:all           # Run both linters
pnpm test               # Run tests in watch mode with Vitest
pnpm test:run           # Run tests once
pnpm test:coverage      # Run tests with coverage report
```

Run a single test file:
```bash
pnpm test tests/lib/core/commit.test.ts
```

Test files are in `tests/lib/` mirroring the `lib/` structure. `vitest.config.ts` sets `environment: 'node'` by default — core, plugin, and utils tests run without a DOM. A React test needs its own `// @vitest-environment jsdom` directive at the top of the file and must use a `.tsx` extension.

## Architecture

```
lib/
  core/      createCdeebee.ts, commit.ts, subscription.ts, indexManager.ts, normalize.ts,
             fetchClient.ts, requestError.ts, pipeline.ts, types.ts
  plugins/   history.ts, cancelation.ts, queryQueue.ts, retry.ts, devtools.ts
  react/     createCdeebeeHooks.ts
  utils/     batchingUpdate.ts, shallowEqual.ts, keyBy.ts, entityID.ts, isRecord.ts, env.ts, requestID.ts
  core.ts    entry point re-exporting core/ + plugins/ (no React import, ever)
  index.ts   entry point re-exporting core.ts + react/ (the full package)
```

Two package entry points: `@recats/cdeebee` (`lib/index.ts`, everything) and `@recats/cdeebee/core` (`lib/core.ts`, no React). Keeping the core entry React-free is load-bearing — see "Build note" below.

### Key concepts

- **One immutable snapshot.** `db.getState()` returns `{ storage, activeRequestList }`; a new object is only produced when something actually changed. `db.getSnapshot()` additionally includes each plugin's `getState()` under `pluginStateList`, for devtools/SSR.
- **`commit` is the single write path.** Every mutation — a request response, `setEntity`, `removeEntityList`, `clearList`, `replaceList` — funnels through `db.commit(changeSet, meta)` in `lib/core/createCdeebee.ts`, which calls `applyChangeSet` (`lib/core/commit.ts`) once and produces at most one new storage object and one `changedList`.
- **`ChangeSet`.** `{ [listName]: { upsertList?, removeIDList?, replaceList? } }`. `applyChangeSet` compares each incoming entity with `shallowEqual` against the existing one and keeps the old reference when nothing changed, so unaffected entities and unaffected lists never get new references.
- **Keyed subscriptions + microtask flush.** `SubscriptionManager` (`lib/core/subscription.ts`) tracks listeners at three granularities — global, per-list, per-entity — and batches notifications: a listener is enqueued into a `FlushScheduler` and actually called once per microtask (`db.flush()` flushes synchronously, used by tests). Commits with `meta.source === 'set'` (the local mutations) flush synchronously inside `commit`, so a controlled input bound to `useEntity` never loses its caret; request commits stay microtask-batched. `RequestSubscriptionManager` does the same for `activeRequestList`, keyed by api.
- **`IndexManager`** (`lib/core/indexManager.ts`) maintains secondary indexes declared in `settings.indexList` incrementally on every commit (`rebuild`/`update`/`get`/`has`), so `db.getIndex(listName, fieldName, value)` and `useEntityListBy` are O(1) lookups instead of a scan.
- **Request pipeline order** (`lib/core/pipeline.ts`, `runRequest`): an abort check for an already-aborted `options.signal` → `onRequest` (any plugin returning `false` throws an abort) → `fetchWithRetry` (retries only while some plugin's `onRetry` returns a delay) → `onResponse` (the abort signal is re-checked after every hook) → an abort re-check → normalize + `commit` (skipped when `ignoreStorage`) → `onSettled`. On any failure: `onError` then `onSettled`. `onRequest`/`onResponse` throwing aborts the request and rejects it; `onError`/`onSettled` failures are isolated — caught and `console.error`'d, never change the outcome.
- **Error kinds** (`CdeebeeErrorKind`): `'http'` (non-ok response, body parsed first), `'network'` (fetch itself threw), `'abort'` (external signal, `cancelation`, a plugin's `false`, or an abort mid-parse of a non-ok body), `'parse'` (body could not be parsed as `responseType`).

### Strategies

Resolved per list as `options.strategyList[list] ?? settings.strategyList[list] ?? 'upsert'`:
- **`upsert`** (default): each response entity replaces the corresponding entity whole (no deep merge); entities not in the response are kept.
- **`replaceList`**: the list becomes exactly the response's entities.
- **`skip`**: the list is untouched.

There is no deep-merge strategy; a partial update has to be assembled explicitly in a custom `normalize` (spread `ctx.storage.<list>[id]` under the incoming partial entity).

### Hooks (`lib/react/createCdeebeeHooks.ts`)

| Hook | Re-renders on |
|---|---|
| `useEntity(listName, entityID)` | that one entity |
| `useList(listName)` | any change to the list |
| `useEntityList(listName, entityIDList)` | any of the listed entities |
| `useListSelector(listName, selector, depList?)` | the list, re-running `selector`; keeps the previous array reference when the result is shallow-equal |
| `useEntityListBy(listName, fieldName, value)` | the list, via an `IndexManager` index; throws if `(listName, fieldName)` is not in `settings.indexList` |
| `useLoading(apiList)` | any api in `apiList` being in flight |
| `useIsLoading()` | any request at all being in flight |
| `useStore(selector, equalityFn?)` | full state through `selector` (`equalityFn` defaults to `Object.is`); last resort — prefer a more specific hook |
| `useRequestHistory(api)` / `useRequestErrorList(api)` / `useLastResultIDList(api, listName)` / `useLastResponse(api)` | the `history` plugin's state for `api`; throw if `history()` is not in `settings.pluginList` |

All hooks are built on `useSyncExternalStore`, so they are safe to use with concurrent React features.

## Important Implementation Notes

### Build note

`react` is the only external dependency in `vite.config.mjs` (`rollupOptions.external`). `lib/core.ts` (and everything it transitively imports) must never import React — `lib/index.ts` is the only file allowed to. Verify after a build with `grep -c "from \"react\"\|require(\"react\")" dist/core.js dist/core.cjs`, which must both print `0`.

### FormData / headers

File uploads (`options.fileList`) send a `FormData` body: files under `settings.fetch.fileKey` (default `'file'`), the JSON payload under `settings.fetch.bodyKey` (default `'value'`); `Content-Type` is stripped so the browser can set the multipart boundary. For JSON bodies, callers may set their own `Content-Type` via `headerList`. The `ui-request-id` header is always set by the library to the request's internal id and cannot be overridden. `settings.fetch.fetch` overrides the fetch implementation used for every request (default `globalThis.fetch`) — useful in environments without a global `fetch`, in tests, or to wrap the real one with instrumentation.

### History

The `history` plugin (`lib/plugins/history.ts`) records `doneList`/`errorList`/`lastResultIDList` keyed by api on `onSettled`. Each entry retains the full parsed `response` object, so the cap matters: `maxHistorySize` defaults to `20` entries per api, and `maxHistorySize: 0` (or `Infinity`) makes it unbounded. `lastResultIDList[api]` is left untouched by `ignoreStorage` requests (there is no change set to read ids from). Aborted requests are not recorded unless `ignoreAbort: false`. Clear it with `db.getPlugin('history').clear(api?)`.

### Entity ids

Entity ids are normalized through `toEntityID` (`lib/utils/entityID.ts`) wherever they appear in index buckets and change sets, so `'5'` and `5` are treated as the same id — including the ids `extractResultIDList` collects for the history plugin's `lastResultIDList`.

## Code Style

Enforced by ESLint:
- Semicolons required
- Single quotes (with `avoidEscape`)
- Arrow parens only when needed
- Spaces inside object braces
- Max 1 consecutive blank line
- `@typescript-eslint/no-explicit-any`: warn (not error)

## Naming Conventions

- Use plural form for list-type variable names without trailing 's': `lastIDList` (not `lastIDLists`), `resultIDList` (not `resultIDLists`)
- Storage list names should end with `List`: `productList`, `userList`, `categoryList`
- Entity id fields and parameters use `ID` (not `Id`): `entityID`, `campaignID`, `lastResultIDList`

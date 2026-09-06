# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

cdeebee is a standalone normalized data store with a typed request pipeline. It keeps API responses in keyed lists (like tables in a relational database), runs every request through a small ordered plugin chain, and exposes React hooks that re-render only the component whose data actually changed. There is no Redux dependency — `createCdeebee` builds and owns its own state.

## Development Commands

```bash
pnpm build              # Build library using Vite
pnpm lint               # Lint lib/ and tests/ with ESLint
pnpm lint:ts            # Type-check lib/ and tests/ (no emit); tests/package/fixtures are checked by test:package
pnpm lint:all           # Run both linters
pnpm test               # Run tests in watch mode with Vitest
pnpm test:run           # Run tests once
pnpm test:package       # Build, pack, check ESM/CJS entry points, and compile strict TypeScript consumers
pnpm test:coverage      # Run tests with coverage report
pnpm bench              # Run benchmarks (tests/bench/*.bench.ts, tinybench via vitest bench)
pnpm bench:compare      # Same, printing the delta against bench/baseline.json
pnpm bench:save         # Rewrite bench/baseline.json — only after an intended perf change
```

Performance is guarded twice: `tests/lib/perf.test.ts` asserts listener counts and coarse time budgets (order-of-magnitude only, so CI stays stable), and `tests/bench/store.bench.ts` measures the commit paths on 10k entities. Before merging anything that touches `lib/core`, run `pnpm bench:compare` and look at the mean deltas; a real regression shows as a consistent slowdown across runs, not a single noisy sample.

Run a single test file:
```bash
pnpm test tests/lib/core/commit.test.ts
```

Test files are in `tests/lib/` mirroring the `lib/` structure; `tests/package/` holds the packed-package smoke test (`smoke.mjs` plus the strict TypeScript consumer fixtures it compiles); `tests/bench/` holds the benchmarks and `baseline.test.ts`, which guards `bench/baseline.json` against machine-specific paths. `vitest.config.ts` sets `environment: 'node'` by default — core, plugin, and utils tests run without a DOM. A React test needs its own `// @vitest-environment jsdom` directive at the top of the file and must use a `.tsx` extension.

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

Resolved per list as `options.strategyList[list] ?? settings.apiStrategyList[api][list] ?? settings.strategyList[list] ?? 'patch'`:
- **`patch`** (default): incoming fields override, missing keys and `[]` are holes filled from the stored entity. For thin endpoints.
- **`upsert`**: the entity is replaced whole. For full-fetch and save endpoints — declared in `settings.apiStrategyList`.
- **`replaceList`**: the list becomes exactly the response's entities.
- **`skip`**: the list is untouched.

### Freshness and completeness (`lib/core/commit.ts`)

Per stored entity `applyChangeSet` keeps an internal `EntityMeta` (owned by `createCdeebee`, mutated in place per commit):

- `version` — the server's version, read through `settings.versionKeyList` (`readVersion`: numbers as-is, ISO strings via `Date.parse`).
- `seq` — the highest send sequence that confirmed the entity exists. Gates removals.
- `writeSeq` — the send sequence of the data currently stored. Breaks ties between equal or unknown versions.
- `complete` — set by `upsert` / `replaceList` at the current version; a complete entity drops older writes instead of filling holes.
- `deleted` — tombstone written by `removeIDList`; `removedSeq` — the last removal boundary, retained when the entity is re-added.

`db.getEntityMeta` returns a detached `{ version, seq, complete }` and `undefined` for tombstones. A per-list `listSeqMap` records the sequence of the last `replaceList` / `clearList`; it is a required option so tests exercise the same rules as the store. Sequences come from `internal.nextSeq()`: `runRequest` takes one at send time and stamps it into `CdeebeeCommitMeta.seq`, local mutations take a fresh one in `commit`, and a caller-supplied `meta.seq` above the counter advances it.

Decision order for one write, sent at `seq`:

1. `seq < removedSeq` — dropped. A response sent before the entity's removal cannot fill or overwrite it, even with a newer version.
2. Entity absent — `isStale(prevMeta, listSeq, seq)`: dropped when sent before the tombstone or the list's last reset, otherwise written as new (`complete` only for `upsert`) with the list boundary carried as `removedSeq`. Equal sequence passes, so the parts of one commit apply in order.
3. Entity stored — `mergeEntity`: versions compare first, `writeSeq` only when versions are equal or unknown. Newer: `upsert` / `set` replace whole, `patch` = `fill(incoming, stored)`. Older: dropped when complete, otherwise `fill(stored, incoming)`. Either way `seq` becomes `max(seq, stored)`: even a write that lost by version confirms the entity existed at its send. `fill` treats `undefined` and `[]` as holes.

Per operation:

- `setEntity` emits `setList`: the entity is replaced whole at a fresh sequence (a local edit can clear an array or unset a field) while `complete` is carried over, so a local edit never marks a thin entity complete.
- `replaceList`: stored entities merge through `mergeEntity` in `upsert` mode exactly like `upsertList`; absent ids follow rule 2 with the *previous* list boundary as `removedSeq` (a replacement that carries an entity is not its removal). Entities missing from the replacement are deleted unless `isStale`, so a reset sent before a later reset never deletes. The new `listSeq` prunes every tombstone at or below it, which bounds tombstones by removals sent after the last reset.
- `removeIDList`: skipped when `isStale` (development logs a `console.warn` if the entity is stored). Otherwise a tombstone `{ seq, writeSeq: seq, complete: false, deleted: true }`, also for ids not in the list, so an earlier-sent fetch cannot re-add them.

Accepted limitations: tombstones on lists that never reset live for the store lifetime (request completion is not a safe GC boundary, `db.commit` accepts any `seq`); a removal carries no version, so with reversed server processing the outcome depends on whether the removal applied before the version-newer response arrived.

Tests: `tests/lib/core/merge.test.ts` pins each rule pairwise; `tests/lib/core/fuzz.test.ts` shuffles random commit sequences (composite commits, monotonic server versions) into random arrival orders and checks they agree with each other and, in send order, with a naive store. Reversed server processing is covered by merge and queryQueue tests, not by the fuzz.

### Hooks (`lib/react/createCdeebeeHooks.ts`)

| Hook | Re-renders on |
|---|---|
| `useEntity(listName, entityID)` | that one entity |
| `useList(listName)` | any change to the list |
| `useEntityList(listName, entityIDList)` | any of the listed entities |
| `useListSelector(listName, selector, depList?)` | the list or `depList`, re-running `selector`; keeps the previous array reference when the result is shallow-equal. Props the selector closes over belong in `depList`, like `useMemo` |
| `useEntityListBy(listName, fieldName, value)` | the list, via an `IndexManager` index; throws if `(listName, fieldName)` is not in `settings.indexList` |
| `useLoading(apiList)` | any api in `apiList` being in flight |
| `useIsLoading()` | any request at all being in flight |
| `useStore(selector, equalityFn?)` | full state through `selector` (`equalityFn` defaults to `Object.is`); last resort — prefer a more specific hook |
| `useRequestHistory(api)` / `useRequestErrorList(api)` / `useLastResultIDList(api, listName)` / `useLastResponse(api)` | the `history` plugin's state for `api`; throw if `history()` is not in `settings.pluginList` |

All hooks are built on `useSyncExternalStore`, so they are safe to use with concurrent React features.

## Important Implementation Notes

### Build note

`react` is the only external dependency in `vite.config.mjs` (`rollupOptions.external`). `lib/core.ts` (and everything it transitively imports) must never import React — `lib/index.ts` is the only file allowed to. `pnpm test:package` guards this: it packs the build and loads the core entry with no `react` in `node_modules`.

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

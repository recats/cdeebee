# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

cdeebee is a Redux-based data management library that provides a normalized data storage system similar to relational databases. It's built on top of Redux Toolkit and focuses on reducing boilerplate for data fetching, normalization, and state management.

## Development Commands

```bash
pnpm build              # Build library using Vite
pnpm lint               # Lint TypeScript files with ESLint
pnpm lint:ts            # Type-check with TypeScript (no emit)
pnpm lint:all           # Run both linters
pnpm test               # Run tests in watch mode with Vitest
pnpm test:run           # Run tests once
pnpm test:coverage      # Run tests with coverage report
```

Run a single test file:
```bash
pnpm test tests/lib/reducer/storage.test.ts
```

Tests use Vitest with jsdom environment. Test files are in `tests/lib/` mirroring the `lib/` structure.

## Architecture

### Modular System

The library is composed of independent modules that can be enabled/disabled:
- `storage`: Normalizes and stores API responses
- `history`: Tracks request history (successful and failed requests)
- `listener`: Tracks active requests for loading states
- `cancelation`: Manages automatic request cancellation for duplicate API calls
- `queryQueue`: Processes requests sequentially to maintain order

### Key Files

- **`lib/reducer/index.ts`**: Redux slice factory. `factory()` creates a slice with configured modules. Reducer actions: `set` (path-based storage updates) and `historyClear`.
- **`lib/reducer/request.ts`**: `request` async thunk handling all API calls — FormData for uploads, merged headers/body (supports dynamic functions), abort signals, response types (json/text/blob), queryQueue integration. Body is omitted for GET requests. On error, `rejectWithValue` returns `{ status, statusText, data }`.
- **`lib/reducer/storage.ts`**: `defaultNormalize()` — detects `{ data: [...], primaryKey: 'string' }` format, normalizes into keyed objects, applies merge strategies per list.
- **`lib/reducer/queryQueue.ts`**: Sequential request queue using promise chaining.
- **`lib/reducer/abortController.ts`**: AbortController management for request cancellation per API endpoint.
- **`lib/reducer/helpers.ts`**: Utilities — `checkModule()`, `mergeDeepRight()`, `batchingUpdate()` (Immer mutations for `set` action), `extractLastResultIdList()`, `isRecord()`.
- **`lib/reducer/types.ts`**: TypeScript definitions including `CdeebeeValueList<T>` (path-based type-safe batch updates).
- **`lib/hooks/selectors.ts`**: Standalone selector hooks assuming state at `state.cdeebee`.
- **`lib/hooks/createCdeebeeHooks.ts`**: Factory for custom state paths — returns same hooks as `selectors.ts` but with configurable selector.

### Hooks

- `useLoading(apiList)`: Check if any APIs in the list are currently loading
- `useIsLoading()`: Check if any request is loading globally
- `useStorageList(listName)`: Get a specific list from storage with type safety
- `useStorage()`: Get the entire storage object
- `useRequestHistory(api)`: Get successful request history for a specific API
- `useRequestErrors(api)`: Get error history for a specific API
- `useLastResultIdList(api, listName)`: Get IDs returned by last request for a specific list

### Merge Strategies

Three strategies per list (set globally via `listStrategy` or overridden per-request with `Partial<>`):
- **`merge`** (default): Deep merges new data with existing, preserving keys not in response
- **`replace`**: Completely replaces the list with new data
- **`skip`**: Preserves existing data unchanged

### Settings

`factory<T>(settings, storage?)` accepts `CdeebeeSettings<T>`:
- `modules`: Which modules to enable
- `mergeWithHeaders` / `mergeWithData`: Static objects or dynamic functions (called per request, useful for auth tokens)
- `listStrategy`: Default merge strategy per list
- `normalize`: Custom normalization function (defaults to `defaultNormalize`)
- `maxHistorySize`: Optional limit on history entries per API (prevents unbounded growth)
- `fileKey` / `bodyKey`: Keys for FormData uploads (defaults: `'file'` / `'value'`)

**Note**: Dynamic functions for `mergeWithHeaders`/`mergeWithData` require configuring `serializableCheck.ignoredPaths` in your Redux store.

## Important Implementation Notes

### State Mutation with Immer

`batchingUpdate()` and `defaultNormalize` directly mutate state via Immer Draft objects. This is safe because Redux Toolkit uses Immer internally.

### Request Behavior

- `onResult` callback is **always called** regardless of success or failure
- On HTTP errors, response body is parsed first, then rejected with `{ status, statusText, data }` (serializable)
- GET requests do not send a body
- File uploads: `Content-Type` is omitted (browser sets `multipart/form-data` boundary automatically)

### History Management

History tracks `state.request.done` and `state.request.errors`. Clear via `historyClear: true` in request options (auto) or dispatching the `historyClear` action (manual). History is capped when `maxHistorySize` is set.

### Result ID List

`lastResultIdList` tracks which IDs were returned per API per list. Use with `merge` strategy + `useLastResultIdList(api, listName)` to show only current results while preserving accumulated data.

### Build Configuration

**CRITICAL**: `vite.config.mjs` must mark `react`, `react-redux`, `@reduxjs/toolkit`, and `redux` as external. These are peer dependencies — bundling them causes "Invalid hook call" / "Cannot read properties of null (reading 'useContext')" errors.

## Code Style

Enforced by ESLint:
- Semicolons required
- Single quotes (with `avoidEscape`)
- Arrow parens only when needed
- Spaces inside object braces
- Max 1 consecutive blank line
- `@typescript-eslint/no-explicit-any`: warn (not error)

## Naming Conventions

- Use plural form for list-type variable names without trailing 's': `lastIdList` (not `lastIdLists`), `resultIdList` (not `resultIdLists`)
- Storage list names should end with `List`: `productList`, `userList`, `categoryList`

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

cdeebee is a Redux-based data management library that provides a normalized data storage system similar to relational databases. It's built on top of Redux Toolkit and focuses on reducing boilerplate for data fetching, normalization, and state management.

## Development Commands

### Building
```bash
pnpm build              # Build library using Vite
```

### Linting
```bash
pnpm lint              # Lint TypeScript files with ESLint
pnpm lint:ts           # Type-check with TypeScript (no emit)
pnpm lint:all          # Run both linters
```

### Testing
```bash
pnpm test              # Run tests in watch mode with Vitest
pnpm test:run          # Run tests once
pnpm test:coverage     # Run tests with coverage report
```

To run a single test file:
```bash
pnpm test tests/lib/reducer/storage.test.ts
```

## Architecture

### Core Concepts

**Normalized Storage**: Data is stored in a normalized structure where each "list" (similar to a database table) is a JavaScript object with keys representing primary keys. API responses with format `{ data: [...], primaryKey: 'id' }` are automatically normalized into `{ '1': {...}, '2': {...} }` structures.

**Modular System**: The library is composed of independent modules that can be enabled/disabled:
- `storage`: Normalizes and stores API responses
- `history`: Tracks request history (successful and failed requests)
- `listener`: Tracks active requests for loading states
- `cancelation`: Manages automatic request cancellation for duplicate API calls
- `queryQueue`: Processes requests sequentially to maintain order

### Key Files and Structure

**`lib/reducer/index.ts`**: Entry point for the Redux slice factory. The `factory()` function creates a Redux slice with the configured modules and returns it. The reducer handles three async thunk states (pending, fulfilled, rejected) for the request thunk. It also provides two synchronous reducer actions:
- `set`: Manually update storage values using path-based updates
- `historyClear`: Clear request history (success and error) for a specific API or all APIs

**`lib/reducer/request.ts`**: Contains the `request` async thunk that handles all API calls. This is where:
- FormData is built for file uploads
- Headers are merged (global + per-request), supports dynamic functions
- The fetch API is called with appropriate abort signals
- Response types (json/text/blob) are handled
- The queryQueue integration happens (requests are enqueued if module is enabled)

**`lib/reducer/storage.ts`**: Contains the `defaultNormalize()` function which is the core normalization logic. It:
- Detects data with `{ data: [...], primaryKey: 'string' }` format
- Normalizes arrays into keyed objects using the specified primary key
- Applies merge strategies ('merge', 'replace', 'skip') per list
- Preserves existing keys not in the response when using 'merge' strategy

**`lib/reducer/queryQueue.ts`**: Implements a sequential request queue using promise chaining. Ensures that even if a later request completes faster than an earlier one, they are stored in the order they were dispatched.

**`lib/reducer/abortController.ts`**: Manages AbortController instances for request cancellation. Automatically cancels previous requests to the same API endpoint when enabled.

**`lib/reducer/helpers.ts`**: Utility functions including:
- `checkModule()`: Conditional execution based on enabled modules
- `mergeDeepRight()`: Deep merge for objects (right takes precedence)
- `batchingUpdate()`: Mutates Redux state using Immer for the `set` action
- `extractResultIdList()`: Extracts primary key IDs from API responses with `{ data: [...], primaryKey: 'id' }` format
- Type guards (`isRecord()`, etc.)

**`lib/reducer/types.ts`**: TypeScript type definitions including complex path-based types for type-safe batch updates via `CdeebeeValueList<T>`.

**`lib/hooks/`**: React hooks folder for accessing cdeebee state. Structure:
- `index.ts`: Re-exports all hooks
- `selectors.ts`: Standalone selector hooks (useLoading, useStorage, etc.)
- `createCdeebeeHooks.ts`: Factory for custom state paths

Available selector hooks:
- `useLoading(apiList)`: Check if any APIs in the list are currently loading
- `useIsLoading()`: Check if any request is loading globally
- `useStorageList(listName)`: Get a specific list from storage with type safety
- `useStorage()`: Get the entire storage object
- `useRequestHistory(api)`: Get successful request history for a specific API
- `useRequestErrors(api)`: Get error history for a specific API
- `useLastResultIdList(api, listName)`: Get the IDs returned by the last request for a specific list to filter storage data

All hooks use `react-redux`'s `useSelector` internally and are fully typed for TypeScript.

### Data Flow

1. User dispatches `request()` thunk with API options
2. Request enters `pending` state → modules handle accordingly:
   - If `historyClear: true` option is set, history for this API is cleared (only if history module enabled)
   - Cancelation module aborts previous requests to same API (if enabled)
   - Listener module adds request to active list (if enabled)
3. If `queryQueue` enabled, request is enqueued; otherwise executes immediately
4. Fetch executes with merged headers/body and abort signal
5. Response is parsed based on `responseType` (json/text/blob)
6. `onResult` callback is called (if provided) with response data
7. Request enters `fulfilled` or `rejected` state:
   - Fulfilled → listener removes active request, history records it, storage normalizes and merges data
   - Rejected → listener removes active request, history records error
8. Redux state is updated with new storage data (if not `ignore: true`)

### Merge Strategies

The normalization system supports three strategies per list:
- **`merge`** (default): Deep merges new data with existing, preserving keys not in response
- **`replace`**: Completely replaces the list with new data
- **`skip`**: Doesn't update the list, preserving existing data unchanged (useful for immutable reference data)

Strategies can be set globally in settings (requires all lists) or overridden per-request (accepts `Partial<>` - only specify lists you want to override):
```typescript
// Global setting - must provide strategy for all lists
factory<Storage>({
  listStrategy: {
    forumList: 'merge',
    threadList: 'replace',
    postList: 'skip',
  }
})

// Per-request - can be partial
dispatch(request({
  api: '/api/data',
  listStrategy: { forumList: 'replace' } // Only override forumList
}))
```

### Dynamic Headers and Data

`mergeWithHeaders` and `mergeWithData` support both static objects and dynamic functions. Functions are called on each request, useful for auth tokens:

```typescript
factory<Storage>({
  modules: ['storage', 'history', 'listener'],
  // Static (evaluated once at factory creation)
  mergeWithHeaders: { 'X-App': 'myapp' },

  // OR Dynamic (evaluated on each request)
  mergeWithHeaders: () => ({
    'Authorization': `Bearer ${getSessionToken()}`,
  }),

  // Same for mergeWithData
  mergeWithData: () => ({
    timestamp: Date.now(),
  }),
})
```

**Note**: When using functions, Redux will warn about non-serializable values in state. Configure your store's `serializableCheck.ignoredPaths` to include `cdeebee.settings.mergeWithHeaders` and `cdeebee.settings.mergeWithData`.

### Testing

Tests use Vitest with jsdom environment. Test files are in `tests/lib/` mirroring the `lib/` structure. Tests cover:
- Storage normalization and merge strategies
- Request lifecycle (pending, fulfilled, rejected)
- QueryQueue sequential processing
- AbortController cancellation
- History clearing (manual and automatic)
- Silent request option
- Dynamic mergeWithHeaders/mergeWithData
- Helper functions and type guards
- React hooks (`tests/lib/hooks.test.ts`): Tests the selector logic for all hooks by dispatching Redux actions and verifying state selections

## Important Implementation Notes

### State Mutation with Immer

The `set` reducer and the `defaultNormalize` function work with Immer Draft objects. The `batchingUpdate()` helper directly mutates state objects, which is safe because Redux Toolkit uses Immer internally. This approach is more performant than creating new objects.

### Primary Key Normalization

When the API returns `{ data: [...], primaryKey: 'fieldName' }`, the normalization extracts the field value and converts it to a string for use as the object key. This ensures consistent key types regardless of whether the primary key is a number or string in the source data.

### Request Callbacks

The `onResult` callback is **always called** regardless of success or failure. It receives the parsed response data (or error) directly. This allows components to handle responses without needing to check Redux state.

### History Management

The history module tracks both successful requests (`state.request.done`) and failed requests (`state.request.errors`). History can be cleared in two ways:

1. **Automatic clearing**: Set `historyClear: true` in request options to clear history for that API before the request starts (happens in the `pending` state)
2. **Manual clearing**: Dispatch the `historyClear` action with an API string to clear history for that API, or without arguments to clear all history

History clearing is module-aware and only executes when the `history` module is enabled. It deletes both success and error history for the specified API endpoint.

### File Uploads

When `files` array is provided, the request automatically switches to FormData. The body is serialized to JSON and attached with the key specified by `bodyKey` (default: 'value'). Files are attached with keys specified by `fileKey` (default: 'file').

### Sequential vs Parallel Processing

- Without `queryQueue`: Requests execute in parallel, may complete out of order
- With `queryQueue`: Requests execute sequentially in dispatch order, guaranteed to complete and store in order
- This is important when request order matters for data consistency (e.g., optimistic updates followed by server sync)

### Browser Navigation and Replace Strategy

When using `replace` strategy with navigation (e.g., search pages), data can become stale on browser back. Solutions:

1. **Use `merge` + `useLastResultIdList`** (recommended): Data accumulates with `merge` strategy, but `useLastResultIdList(api, listName)` returns the IDs from the last request for that list. Filter storage by these IDs to show only current results. This preserves data across navigation while showing correct results.
2. **Use `merge` strategy**: Data accumulates instead of replacing (may show stale data from previous searches)
3. **Clear and refetch**: Use `historyClear` and refetch on route change

### Result ID List

The `lastResultIdList` state (`state.request.lastResultIdList`) tracks which primary key IDs were returned by each API's last successful request, organized per list. This is populated automatically when API responses use the `{ data: [...], primaryKey: 'id' }` format.

```typescript
// State structure
state.request.lastResultIdList = {
  '/api/search': {
    'productList': ['101', '102', '103'],  // IDs from last search for productList
    'categoryList': ['1', '2'],            // IDs from last search for categoryList
  },
  '/api/products': {
    'productList': ['1', '2'],             // IDs from last products request
  },
}
```

This enables the pattern: use `merge` strategy (data never lost), filter by `lastResultIdList[api][listName]` (show only current results).


### Build Configuration and External Dependencies

**CRITICAL**: The `vite.config.mjs` must mark `react`, `react-redux`, `@reduxjs/toolkit`, and `redux` as external dependencies. This prevents them from being bundled with the library and avoids the "Invalid hook call" error.

The external array in Vite config should include:
```js
external: ['@reduxjs/toolkit', 'redux', 'react', 'react-redux']
```

These dependencies are:
- Listed in `peerDependencies` (the consuming app provides them)
- Listed in `devDependencies` (for development and testing)
- **NOT bundled** with the library distribution

If hooks are being bundled, users will get "Cannot read properties of null (reading 'useContext')" errors because there will be multiple React instances.


## Naming Conventions

- Use plural form for list-type variable names without trailing 's': `lastIdList` (not `lastIdLists`), `resultIdList` (not `resultIdLists`)
- Storage list names should end with `List`: `productList`, `userList`, `categoryList`

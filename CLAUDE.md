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

**`lib/reducer/index.ts`**: Entry point for the Redux slice factory. The `factory()` function creates a Redux slice with the configured modules and returns it. The reducer handles three async thunk states (pending, fulfilled, rejected) for the request thunk.

**`lib/reducer/request.ts`**: Contains the `request` async thunk that handles all API calls. This is where:
- FormData is built for file uploads
- Headers are merged (global + per-request)
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
- Type guards (`isRecord()`, `hasDataProperty()`, etc.)

**`lib/reducer/types.ts`**: TypeScript type definitions including complex path-based types for type-safe batch updates via `CdeebeeValueList<T>`.

### Data Flow

1. User dispatches `request()` thunk with API options
2. Request enters `pending` state → modules handle accordingly (cancelation, listener updates)
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

Strategies can be set globally in settings or overridden per-request.

### Testing

Tests use Vitest with jsdom environment. Test files are in `tests/lib/` mirroring the `lib/` structure. Tests cover:
- Storage normalization and merge strategies
- Request lifecycle (pending, fulfilled, rejected)
- QueryQueue sequential processing
- AbortController cancellation
- Helper functions and type guards

## Important Implementation Notes

### State Mutation with Immer

The `set` reducer and the `defaultNormalize` function work with Immer Draft objects. The `batchingUpdate()` helper directly mutates state objects, which is safe because Redux Toolkit uses Immer internally. This approach is more performant than creating new objects.

### Primary Key Normalization

When the API returns `{ data: [...], primaryKey: 'fieldName' }`, the normalization extracts the field value and converts it to a string for use as the object key. This ensures consistent key types regardless of whether the primary key is a number or string in the source data.

### Request Callbacks

The `onResult` callback is **always called** regardless of success or failure. It receives the parsed response data (or error) directly. This allows components to handle responses without needing to check Redux state.

### File Uploads

When `files` array is provided, the request automatically switches to FormData. The body is serialized to JSON and attached with the key specified by `bodyKey` (default: 'value'). Files are attached with keys specified by `fileKey` (default: 'file').

### Sequential vs Parallel Processing

- Without `queryQueue`: Requests execute in parallel, may complete out of order
- With `queryQueue`: Requests execute sequentially in dispatch order, guaranteed to complete and store in order
- This is important when request order matters for data consistency (e.g., optimistic updates followed by server sync)

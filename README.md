# cdeebee

A Redux-based data management library that provides a uniform way to access, fetch, update, and manage application data with minimal boilerplate code.

## Installation

```sh
npm i @recats/cdeebee@beta
# or
yarn add @recats/cdeebee@beta
# or
pnpm add @recats/cdeebee@beta
```

## What is cdeebee?

cdeebee is a data management library built on top of Redux Toolkit that aims to:
- Provide a uniform way of accessing data
- Decrease boilerplate code when working with data fetching, updating, committing, and rollbacking
- Manage normalized data structures similar to relational databases
- Handle API requests with built-in normalization, error handling, and request cancellation

## Core Concepts

### Normalized Storage

cdeebee stores data in a normalized structure similar to a relational database. Data is organized into **lists** (tables) where each list is a JavaScript object with keys representing primary keys (IDs) of entities.

For example, a forum application might have this structure:

```typescript
{
  forumList: {},
  threadList: {},
  postList: {}
}
```

After fetching data from the API (which returns data in the format `{ data: [...], primaryKey: 'id' }`), cdeebee automatically normalizes it and the storage might look like:

```typescript
{
  forumList: {
    1: { id: 1, title: 'Milky Way Galaxy' }
  },
  threadList: {
    10001: { id: 10001, title: 'Solar system', forumID: 1 }
  },
  postList: {
    2: { id: 2, title: 'Earth', threadID: 10001 }
  }
}
```

**Note:** The API should return list data in the format `{ data: [...], primaryKey: 'fieldName' }`. cdeebee automatically converts this format into the normalized storage structure shown above. See the [API Response Format](#api-response-format) section for details.

### Modules

cdeebee uses a modular architecture with the following modules:

- **`storage`**: Automatically normalizes and stores API responses
- **`history`**: Tracks request history (successful and failed requests)
- **`listener`**: Tracks active requests for loading states
- **`cancelation`**: Manages request cancellation (automatically cancels previous requests to the same API)
- **`queryQueue`**: Processes requests sequentially in the order they were sent, ensuring they complete and are stored in the correct sequence

## Quick Start

### 1. Setup Redux Store

```typescript
import { configureStore, combineSlices } from '@reduxjs/toolkit';
import { factory } from '@recats/cdeebee';

// Define your storage structure
interface Storage {
  forumList: Record<number, { id: number; title: string }>;
  threadList: Record<number, { id: number; title: string; forumID: number }>;
  postList: Record<number, { id: number; title: string; threadID: number }>;
}

// Create cdeebee slice
export const cdeebeeSlice = factory<Storage>(
  {
    modules: ['history', 'listener', 'cancelation', 'storage', 'queryQueue'],
    fileKey: 'file',
    bodyKey: 'value',
    listStrategy: {
      forumList: 'merge',
      threadList: 'replace',
    },
    mergeWithData: {
      sessionToken: 'your-session-token',
    },
    mergeWithHeaders: {
      'Authorization': 'Bearer token',
    },
  },
  {
    // Optional initial storage state
    forumList: {},
    threadList: {},
    postList: {},
  }
);

// Combine with other reducers
const rootReducer = combineSlices(cdeebeeSlice);

export const store = configureStore({
  reducer: rootReducer,
});
```

### 2. Make API Requests

```typescript
import { request } from '@recats/cdeebee';
import { useAppDispatch } from './hooks';

function MyComponent() {
  const dispatch = useAppDispatch();

  const fetchForums = () => {
    dispatch(request({
      api: '/api/forums',
      method: 'POST',
      body: { filter: 'active' },
      onResult: (result) => {
        // onResult is always called with the response data
        // For JSON responses, result is already parsed
        console.log('Request completed:', result);
      },
    }));
  };

  return <button onClick={fetchForums}>Load Forums</button>;
}
```

### 3. Access Data and Loading States with Hooks

cdeebee provides React hooks to easily access data and track loading states:

```typescript
import { useLoading, useStorageList } from '@recats/cdeebee';

function ForumsList() {
  // Check if specific APIs are loading
  const isLoading = useLoading(['/api/forums']);

  // Get data from storage with full type safety
  const forums = useStorageList<Storage, 'forumList'>('forumList');

  return (
    <div>
      {isLoading && <p>Loading...</p>}
      {Object.values(forums).map(forum => (
        <div key={forum.id}>{forum.title}</div>
      ))}
    </div>
  );
}
```

**Available hooks:**

- `useLoading(apiList: string[])` - Check if any of the specified APIs are loading
- `useIsLoading()` - Check if any request is loading
- `useStorageList(listName)` - Get a specific list from storage
- `useStorage()` - Get the entire storage
- `useRequestHistory(api)` - Get successful request history for an API
- `useRequestErrors(api)` - Get error history for an API
- `useLastResultIdList(api)` - Get the IDs returned by the last request to an API (for filtering storage)

See the [React Hooks](#react-hooks) section for detailed documentation.

## Configuration

### Settings

The `factory` function accepts a settings object with the following options:

```typescript
interface CdeebeeSettings<T> {
  modules: CdeebeeModule[];           // Active modules: 'history' | 'listener' | 'storage' | 'cancelation' | 'queryQueue'
  fileKey: string;                    // Key name for file uploads in FormData
  bodyKey: string;                    // Key name for request body in FormData
  listStrategy?: CdeebeeListStrategy<T>; // Merge strategy per list: 'merge' | 'replace' | 'skip'
  mergeWithData?: Record<string, unknown> | (() => Record<string, unknown>);   // Data to merge with every request body (static or dynamic)
  mergeWithHeaders?: Record<string, string> | (() => Record<string, string>);  // Headers to merge with every request (static or dynamic)
  normalize?: (storage, result, strategyList) => T; // Custom normalization function
}
```

### Request Options

```typescript
interface CdeebeeRequestOptions<T> {
  api: string;                        // API endpoint URL
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;                     // Request body
  headers?: Record<string, string>;   // Additional headers (merged with mergeWithHeaders)
  files?: File[];                     // Files to upload
  fileKey?: string;                   // Override default fileKey
  bodyKey?: string;                   // Override default bodyKey
  listStrategy?: CdeebeeListStrategy<T>; // Override list strategy for this request
  normalize?: (storage, result, strategyList) => T; // Override normalization
  onResult?: (response: T) => void;  // Callback called with response data (always called, even on errors)
  ignore?: boolean;                   // Skip storing result in storage
  responseType?: 'json' | 'text' | 'blob'; // Response parsing type (default: 'json')
  historyClear?: boolean;             // Auto-clear history for this API before making the request
}
```

## Data Merging Strategies

cdeebee supports three strategies for merging data:

- **`merge`**: Merges new data with existing data, preserving existing keys not in the response
- **`replace`**: Completely replaces the list with new data
- **`skip`**: Skips updating the list entirely, preserving existing data unchanged

```typescript
listStrategy: {
  forumList: 'merge',    // New forums are merged with existing ones
  threadList: 'replace', // Thread list is completely replaced
  userList: 'skip',      // User list is never updated, existing data is preserved
}
```

## Dynamic Headers and Data

`mergeWithHeaders` and `mergeWithData` support both static objects and dynamic functions. Functions are called on each request, making them ideal for auth tokens:

```typescript
const cdeebeeSlice = factory<Storage>({
  modules: ['storage', 'history', 'listener'],

  // Static headers (evaluated once at factory creation)
  mergeWithHeaders: { 'X-App': 'myapp' },

  // OR Dynamic headers (evaluated on each request)
  mergeWithHeaders: () => ({
    'Authorization': `Bearer ${getSessionToken()}`,
  }),

  // Same for mergeWithData
  mergeWithData: () => ({
    timestamp: Date.now(),
    clientVersion: APP_VERSION,
  }),
});
```

**Note**: When using functions, Redux will warn about non-serializable values in state. Configure your store's `serializableCheck.ignoredPaths` to include `cdeebee.settings.mergeWithHeaders` and `cdeebee.settings.mergeWithData`.

## API Response Format

cdeebee expects API responses in a format where list data is provided as arrays with a `primaryKey` field. The library automatically normalizes this data into the storage structure.

### List Format

For lists (collections of entities), the API should return data in the following format:

```typescript
{
  forumList: {
    data: [
      { id: 1, title: 'Forum 1' },
      { id: 2, title: 'Forum 2' },
    ],
    primaryKey: 'id',
  },
  threadList: {
    data: [
      { id: 101, title: 'Thread 1', forumID: 1 },
      { id: 102, title: 'Thread 2', forumID: 1 },
    ],
    primaryKey: 'id',
  }
}
```

cdeebee automatically converts this format into normalized storage:

```typescript
{
  forumList: {
    1: { id: 1, title: 'Forum 1' },
    2: { id: 2, title: 'Forum 2' },
  },
  threadList: {
    101: { id: 101, title: 'Thread 1', forumID: 1 },
    102: { id: 102, title: 'Thread 2', forumID: 1 },
  }
}
```

The `primaryKey` field specifies which property of each item should be used as the key in the normalized structure. The `primaryKey` value is converted to a string to ensure consistent key types.

**Example:**

If your API returns:
```typescript
{
  sessionList: {
    data: [
      {
        sessionID: 1,
        token: 'da6ec385bc7e4f84a510c3ecca07f3',
        expiresAt: '2034-03-28T22:36:09'
      }
    ],
    primaryKey: 'sessionID',
  }
}
```

It will be automatically normalized to:
```typescript
{
  sessionList: {
    '1': {
      sessionID: 1,
      token: 'da6ec385bc7e4f84a510c3ecca07f3',
      expiresAt: '2034-03-28T22:36:09'
    }
  }
}
```

### Non-List Data

For non-list data (configuration objects, simple values, etc.), you can return them as regular objects:

```typescript
{
  config: {
    theme: 'dark',
    language: 'en',
  },
  userPreferences: {
    notifications: true,
  }
}
```

These will be stored as-is in the storage.

## Advanced Usage

### File Uploads

```typescript
const file = new File(['content'], 'document.pdf', { type: 'application/pdf' });

dispatch(request({
  api: '/api/upload',
  method: 'POST',
  files: [file],
  body: { description: 'My document' },
  fileKey: 'file',    // Optional: override default
  bodyKey: 'metadata', // Optional: override default
}));
```

### Handling Different Response Types

By default, cdeebee parses responses as JSON. For other response types (CSV, text files, images, etc.), use the `responseType` option:

```typescript
// CSV/text response
dispatch(request({
  api: '/api/export',
  responseType: 'text',
  ignore: true, // Don't store in storage
  onResult: (csvData) => {
    // csvData is a string
    downloadCSV(csvData);
  },
}));

// Binary file (image, PDF, etc.)
dispatch(request({
  api: '/api/image/123',
  responseType: 'blob',
  ignore: true,
  onResult: (blob) => {
    // blob is a Blob object
    const url = URL.createObjectURL(blob);
    setImageUrl(url);
  },
}));

// JSON (default)
dispatch(request({
  api: '/api/data',
  // responseType: 'json' is default
  onResult: (data) => {
    console.log(data); // Already parsed JSON
  },
}));
```

### Ignoring Storage Updates

Use the `ignore` option to prevent storing the response in storage while still receiving it in the `onResult` callback:

```typescript
// Export CSV without storing in storage
dispatch(request({
  api: '/api/export',
  responseType: 'text',
  ignore: true,
  onResult: (csvData) => {
    // Handle CSV data directly
    downloadFile(csvData, 'export.csv');
  },
}));
```

### Custom Headers

```typescript
// Global headers (in settings)
mergeWithHeaders: {
  'Authorization': 'Bearer token',
  'X-Custom-Header': 'value',
}

// Per-request headers (override global)
dispatch(request({
  api: '/api/data',
  headers: {
    'Authorization': 'Bearer different-token', // Overrides global
    'X-Request-ID': '123',                      // Additional header
  },
}));
```

### Request Cancellation

When the `cancelation` module is enabled, cdeebee automatically cancels previous requests to the same API endpoint when a new request is made:

```typescript
// First request
dispatch(request({ api: '/api/data', body: { query: 'slow' } }));

// Second request to same API - first one is automatically cancelled
dispatch(request({ api: '/api/data', body: { query: 'fast' } }));
```

### Sequential Request Processing (queryQueue)

When the `queryQueue` module is enabled, all requests are processed sequentially in the order they were sent. This ensures that:

- Requests complete in the exact order they were dispatched
- Data is stored in the store in the correct sequence
- Even if a faster request is sent after a slower one, it will wait for the previous request to complete

This is particularly useful when you need to maintain data consistency and ensure that updates happen in the correct order.

```typescript
// Enable queryQueue module
const cdeebeeSlice = factory<Storage>({
  modules: ['history', 'listener', 'storage', 'queryQueue'],
  // ... other settings
});

// Send multiple requests - they will be processed sequentially
dispatch(request({ api: '/api/data', body: { id: 1 } }));  // Completes first
dispatch(request({ api: '/api/data', body: { id: 2 } }));  // Waits for #1, then completes
dispatch(request({ api: '/api/data', body: { id: 3 } }));  // Waits for #2, then completes

// Even if request #3 is faster, it will still complete last
// All requests are stored in the store in order: 1 → 2 → 3
```

**Note:** The `queryQueue` module processes requests sequentially across all APIs. If you need parallel processing for different APIs, you would need separate cdeebee instances or disable the module for those specific requests.

### Manual State Updates

You can manually update the storage using the `set` action:

```typescript
import { batchingUpdate } from '@recats/cdeebee';

// Update multiple values at once
const updates = [
  { key: ['forumList', '1', 'title'], value: 'New Title' },
  { key: ['forumList', '1', 'views'], value: 100 },
  { key: ['threadList', '101', 'title'], value: 'Updated Thread' },
];

dispatch(cdeebeeSlice.actions.set(updates));
```

### Accessing Request History

You can access request history using hooks or selectors:

```typescript
import { useRequestHistory, useRequestErrors } from '@recats/cdeebee';

// Using hooks (recommended)
const apiHistory = useRequestHistory('/api/forums');
const apiErrors = useRequestErrors('/api/forums');

// Or using selectors
const doneRequests = useAppSelector(state => state.cdeebee.request.done);
const errors = useAppSelector(state => state.cdeebee.request.errors);
```

### Clearing Request History

Clear old success/error history when needed (useful for forms that get reopened):

```typescript
// Automatic: clear before request
dispatch(request({
  api: '/api/posts',
  historyClear: true,  // Clears old history for this API
  body: formData,
}));

// Manual: clear anytime
dispatch(cdeebeeSlice.actions.historyClear('/api/posts'));  // Specific API
dispatch(cdeebeeSlice.actions.historyClear());              // All APIs
```

## React Hooks

cdeebee provides a comprehensive set of React hooks for accessing state without writing selectors. These hooks assume your cdeebee slice is at `state.cdeebee` (which is the default when using `combineSlices`).

### Loading State Hooks

#### `useLoading(apiList: string[])`

Check if any of the specified APIs are currently loading.

```typescript
import { useLoading } from '@recats/cdeebee';

function MyComponent() {
  // Check if any of these APIs are loading
  const isLoading = useLoading(['/api/forums', '/api/threads']);

  if (isLoading) return <Spinner />;

  return <div>Content</div>;
}
```

#### `useIsLoading()`

Check if any request is currently loading across all APIs.

```typescript
import { useIsLoading } from '@recats/cdeebee';

function GlobalSpinner() {
  const isAnythingLoading = useIsLoading();

  return isAnythingLoading ? <GlobalSpinner /> : null;
}
```

### Storage Hooks

#### `useStorageList<Storage, K>(listName: K)`

Get a specific list from storage with full type safety.

```typescript
import { useStorageList } from '@recats/cdeebee';

interface MyStorage {
  forumList: Record<string, { id: string; title: string }>;
}

function ForumsList() {
  const forums = useStorageList<MyStorage, 'forumList'>('forumList');

  return (
    <div>
      {Object.values(forums).map(forum => (
        <div key={forum.id}>{forum.title}</div>
      ))}
    </div>
  );
}
```

#### `useStorage<Storage>()`

Get the entire cdeebee storage.

```typescript
import { useStorage } from '@recats/cdeebee';

interface MyStorage {
  forumList: Record<string, Forum>;
  threadList: Record<string, Thread>;
}

function DataDebug() {
  const storage = useStorage<MyStorage>();

  return <pre>{JSON.stringify(storage, null, 2)}</pre>;
}
```

### History Hooks

#### `useRequestHistory(api: string)`

Get successful request history for a specific API endpoint.

```typescript
import { useRequestHistory } from '@recats/cdeebee';

function RequestStats({ api }: { api: string }) {
  const history = useRequestHistory(api);

  return (
    <div>
      Total successful requests to {api}: {history.length}
    </div>
  );
}
```

#### `useRequestErrors(api: string)`

Get error history for a specific API endpoint.

```typescript
import { useRequestErrors } from '@recats/cdeebee';

function ErrorDisplay({ api }: { api: string }) {
  const errors = useRequestErrors(api);

  if (errors.length === 0) return null;

  const lastError = errors[errors.length - 1];
  return <div className="error">Last error: {lastError.request.message}</div>;
}
```

### Result ID List Hook

#### `useLastResultIdList(api: string)`

Get the list of IDs returned by the last successful request to an API. This is useful for filtering storage data when using `merge` strategy, so you can display only the results from the current search/request.

```typescript
import { useStorageList, useLastResultIdList } from '@recats/cdeebee';

interface MyStorage {
  productList: Record<string, { id: string; name: string; price: number }>;
}

function SearchResults() {
  // Get all products from storage (accumulated via merge strategy)
  const products = useStorageList<MyStorage, 'productList'>('productList');

  // Get only the IDs from the last search request
  const lastSearchIds = useLastResultIdList('/api/search');

  // Filter to show only results from current search
  const displayResults = lastSearchIds
    .map(id => products[id])
    .filter(Boolean);

  return (
    <div>
      {displayResults.map(product => (
        <div key={product.id}>{product.name} - ${product.price}</div>
      ))}
    </div>
  );
}
```

**Why use this?** When using `replace` strategy with search/filter pages, navigating away and using browser back loses the previous results. With `merge` strategy + `useLastResultIdList`:
- Data accumulates in storage (never lost on navigation)
- `lastResultIdList` tracks which IDs belong to the current request
- Filter storage by those IDs to display the correct results

### Advanced: Custom State Path

If you're **not** using `combineSlices` or have cdeebee at a custom path in your state (not `state.cdeebee`), use `createCdeebeeHooks`:

```typescript
// hooks.ts - Create once in your app
import { createCdeebeeHooks } from '@recats/cdeebee';
import type { RootState, MyStorage } from './store';

// Tell the hooks where to find cdeebee in your state
export const {
  useLoading,
  useStorageList,
  useStorage,
  useRequestHistory,
  useRequestErrors,
  useIsLoading,
  useLastResultIdList,
} = createCdeebeeHooks<RootState, MyStorage>(
  state => state.myCustomPath  // Your custom path
);
```

**Note:** Most users won't need `createCdeebeeHooks` because `combineSlices` automatically places the slice at `state.cdeebee`.

## TypeScript Support

cdeebee is fully typed. Define your storage type and get full type safety:

```typescript
interface MyStorage {
  userList: Record<string, { id: string; name: string; email: string }>;
  postList: Record<number, { id: number; title: string; userId: string }>;
}

const slice = factory<MyStorage>(settings);

// TypeScript knows the structure
const users = useSelector(state => state.cdeebee.storage.userList);
// users: Record<string, { id: string; name: string; email: string }>
```

## Exports

```typescript
// Main exports
export { factory } from '@recats/cdeebee';           // Create cdeebee slice
export { request } from '@recats/cdeebee';            // Request thunk
export { batchingUpdate } from '@recats/cdeebee';     // Batch update helper
export { defaultNormalize } from '@recats/cdeebee';   // Default normalization function

// React hooks
export {
  createCdeebeeHooks,  // Hook factory for custom state paths
  useLoading,          // Check if APIs are loading
  useIsLoading,        // Check if any request is loading
  useStorageList,      // Get a list from storage
  useStorage,          // Get entire storage
  useRequestHistory,   // Get successful request history
  useRequestErrors,    // Get error history
  useLastResultIdList,     // Get IDs from last request (for filtering storage)
} from '@recats/cdeebee';

// Types
export type {
  CdeebeeState,
  CdeebeeSettings,
  CdeebeeRequestOptions,
  CdeebeeValueList,
  CdeebeeActiveRequest,
  CdeebeeModule,
} from '@recats/cdeebee';
```

## Examples

See the `example/` directory in the repository for a complete working example with Next.js.

## License

MIT

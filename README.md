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

### 3. Access Data and Loading States

```typescript
import { useAppSelector } from './hooks';

function ForumsList() {
  const forums = useAppSelector(state => state.cdeebee.storage.forumList);
  const activeRequests = useAppSelector(state => state.cdeebee.request.active);
  const isLoading = activeRequests.some(req => req.api === '/api/forums');

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

## Configuration

### Settings

The `factory` function accepts a settings object with the following options:

```typescript
interface CdeebeeSettings<T> {
  modules: CdeebeeModule[];           // Active modules: 'history' | 'listener' | 'storage' | 'cancelation' | 'queryQueue'
  fileKey: string;                    // Key name for file uploads in FormData
  bodyKey: string;                    // Key name for request body in FormData
  listStrategy?: CdeebeeListStrategy<T>; // Merge strategy per list: 'merge' | 'replace' | 'skip'
  mergeWithData?: unknown;            // Data to merge with every request body
  mergeWithHeaders?: Record<string, string>; // Headers to merge with every request
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

```typescript
const doneRequests = useAppSelector(state => state.cdeebee.request.done);
const errors = useAppSelector(state => state.cdeebee.request.errors);

// Get history for specific API
const apiHistory = doneRequests['/api/forums'] || [];
const apiErrors = errors['/api/forums'] || [];
```

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

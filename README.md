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

After fetching data, the storage might look like:

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

### Modules

cdeebee uses a modular architecture with the following modules:

- **`storage`**: Automatically normalizes and stores API responses
- **`history`**: Tracks request history (successful and failed requests)
- **`listener`**: Tracks active requests for loading states
- **`cancelation`**: Manages request cancellation (automatically cancels previous requests to the same API)

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
    modules: ['history', 'listener', 'cancelation', 'storage'],
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
  modules: CdeebeeModule[];           // Active modules: 'history' | 'listener' | 'storage' | 'cancelation'
  fileKey: string;                    // Key name for file uploads in FormData
  bodyKey: string;                    // Key name for request body in FormData
  listStrategy?: CdeebeeListStrategy<T>; // Merge strategy per list: 'merge' | 'replace'
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
  onResult?: (response: T) => void;  // Callback called with response data on success
}
```

## Data Merging Strategies

cdeebee supports two strategies for merging data:

- **`merge`**: Merges new data with existing data, preserving existing keys not in the response
- **`replace`**: Completely replaces the list with new data

```typescript
listStrategy: {
  forumList: 'merge',    // New forums are merged with existing ones
  threadList: 'replace', // Thread list is completely replaced
}
```

## API Response Format

cdeebee expects API responses in a normalized format where data is already organized as objects with keys representing entity IDs:

```typescript
{
  forumList: {
    1: { id: 1, title: 'Forum 1' },
    2: { id: 2, title: 'Forum 2' },
  },
  threadList: {
    101: { id: 101, title: 'Thread 1', forumID: 1 },
  }
}
```

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
} from '@recats/cdeebee';
```

## Examples

See the `example/` directory in the repository for a complete working example with Next.js.

## License

MIT

# cdeebee

[![npm](https://img.shields.io/npm/v/@recats/cdeebee.svg)](https://www.npmjs.com/package/@recats/cdeebee)
![Recats Digital](https://img.shields.io/badge/recats-digital-1abc9c.svg?style=flat)

```sh
npm i @recats/cdeebee
# or
yarn add @recats/cdeebee
```
# cdeebee
cdeebee is an alpha version of library which goals are:
- Provide uniform way of access to data
- Decrease boilerplate code amount when working with data fetching, updating, committing and rollbacking

The library is highly linked with Redux library and uses Redux as an internal storage

cdeebee works like traditional relational database and stores data lists in JS object (*list*) with keys as table names

For instance simple example how to structure forum case:
```js
{
  forumList: { },
  threadList: { },
  postList: { }
}
```

Each *list* is JS object with keys ~~~ primary keys (ID) of objects
For instance for the sample above the whole cdeebee inside Redux will look like for the forum devoted to the discussion about Universe
```js
{
  forumList: { 1: { title: ‘Milky Way Galaxy’ } },
  threadList: { 10001: { title: ‘Solar system’, forumID: 1 } },
  postList: {  2: { title: ‘Earth’, threadID: 10001 } }
}

```

There are several standard functions to work with this structure:
1. Edit field set of object
2. Create new object
3. Remove object
4. Commit changes
5. Revert changes
6. Set new entity for the key
7. Atomic update for many lists (this option is used when client receives new data from API)

In addition it’s highly recommended to adopt API to work with cdeebee. But otherwise you could use normalizr before using cdeebee to change your data structure from tree-like JSON to normalised lists

Finally there is a set of tools to work with API:
- makeRequest function with is making request to server and manage queue with active requests
- data normalisation and updating in cdeebee
- necessary set of callbacks (preSuccess, postSuccess, preError)

## Install
```js
# reducer/index.js
import { storage, requestManager } from '@recats/cdeebee';

export default combineReducers({
  cdeebeee: storage,
  requestManager, ## optional (checkNetworkActivity, cancelationRequest)
})


# Usage
# actions/*.js
import { cdeebeeRequest, cdeebeeMergeStrategy } from '@recats/cdeebee';

export function ****(fn: () => void) {
  return (dispatch: Function, getState: Function) => {
    const postUpdate = () => fn();
    cdeebeeRequest({
      api: apiUrl.requestCdeebeee,

      data?: { cdeebee: 'cool' },
      mergeStrategy?: $Keys<typeof cdeebeeMergeStrategy> # default cdeebeeMergeStrategy.merge,
      headers?: Object,
      files?: string,
      method?: 'POST' | 'GET' | 'PUT' | 'DELETE',
      requestCancel?: boolean,
      normalize?: (response: Object) => Object | Array<Object>,
      preUpdate?: (payload: Object) => void,
      postUpdate?: (payload: Object) => void,
      preError?: (payload: Object) => void,
      postError?: (payload: Object) => void,
    })(dispatch, getState);
  };
}
```

## Methods
```js
helpers,
storage,
requestManager,
cdeebeeRequest,
cdeebeeTypes,
cdeebeeActions,
```


## Actions
```js
type Options = {
  preChange: (entityList: string, entityID: string | number, list?: string, dispatch: Function, getState: Function) => void,
  postChange: (entityList: string, entityID: string | number, list?: string, dispatch: Function, getState: Function) => void,
}

# setKeyValue
import { cdeebeeActions } form '@recats/cdeebee';

this.props.cdeebeeActions.setKeyValue(listName: string, id: string | number, entity: Array<string> | string, value: any, options?: Options)

# commitEntity
this.props.cdeebeeActions.setKeyValue(listName: string, id: string | number, entity: Array<string> | string, value: any)

# resetEntity
this.props.cdeebeeActions.setKeyValue(listName: string, id: string | number, options?: Options)
```

## Helpers
```js
import { heleprs } form '@recats/cdeebee';

# cancelationRequest
helpers.cancelationRequest(activeRequest: Array<Object>) => Object;

# checkNetworkActivity
helpers.checkNetworkActivity(activeRequest: Array<Object>, apiUrl: string | Array<string>) => boolean;

# getSubEntity element in cdeebee list
helpers.getSubEntity(entity: Object) => object;

# getEntityState element in cdeebee list
helpers.getEntityState(entity: Object) => string;

# commitEntity element in cdeebee list
helpers.commitEntity(entity: Object) => void;

# resetEntity element in cdeebee list
helpers.resetEntity(entity: Object) => void;
```

### SessionToken
  SessionToken must be saved in sessionToken cookie

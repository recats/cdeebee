import { createCdeebee, createSubscription, queryQueue, type CdeebeePlugin, type CdeebeeQueryQueueOptions, type CdeebeeSubscription } from '@recats/cdeebee/core';

interface Storage { userList: Record<number, { userID: number; name: string }> }
const options: CdeebeeQueryQueueOptions<Storage> = { key: ctx => ctx.api };
const bareOptions: CdeebeeQueryQueueOptions = { apiList: ['/x'] };
export const db = createCdeebee<Storage>({
  fetch: {},
  primaryKeyList: { userList: 'userID' },
  pluginList: [queryQueue(options), queryQueue<Storage>(bareOptions), queryQueue(bareOptions)],
});
db.setEntity('userList', 1, { name: 'Ada' });
const name: string = db.getState().storage.userList[1].name;
void name;
// @ts-expect-error entity fields must retain their declared types
db.setEntity('userList', 1, { name: 123 });
// @ts-expect-error list names must be checked
db.setEntity('missingList', 1, { name: 'Ada' });

interface TypedStorage {
  itemList: Record<number, { itemID: number; updatedAt?: string; tags: string[]; active: boolean }>;
}
createCdeebee<TypedStorage>({
  fetch: {}, primaryKeyList: { itemList: 'itemID' }, versionKeyList: { itemList: 'updatedAt' },
});
interface LooseStorage { rowList: Record<string, { rowID: unknown; name: string }> }
createCdeebee<LooseStorage>({ fetch: {}, primaryKeyList: { rowList: 'rowID' } }); // `unknown` id fields are accepted
createCdeebee<TypedStorage>({
  fetch: {},
  // @ts-expect-error arrays cannot identify entities
  primaryKeyList: { itemList: 'tags' },
});
createCdeebee<TypedStorage>({
  fetch: {}, primaryKeyList: { itemList: 'itemID' },
  // @ts-expect-error booleans are not supported server versions
  versionKeyList: { itemList: 'active' },
});

const subscription: CdeebeeSubscription = createSubscription();
const unsubscribe: () => void = subscription.subscribe(() => {}, ['/x']);
unsubscribe();
subscription.notify('/x');
subscription.notify(['/x', '/y']);
subscription.flush();
// @ts-expect-error keys are strings
subscription.notify(1);
export const counter = (): CdeebeePlugin<Storage> & { subscribe: CdeebeeSubscription['subscribe']; getState: () => number } => {
  let count = 0;
  return { name: 'counter', subscribe: subscription.subscribe, getState: () => count, onSettled: ctx => { count += 1; subscription.notify(ctx.api); } };
};

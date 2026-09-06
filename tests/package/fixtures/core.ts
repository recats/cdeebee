import { createCdeebee, queryQueue, type CdeebeeQueryQueueOptions } from '@recats/cdeebee/core';

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

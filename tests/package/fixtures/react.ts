import { createCdeebeeHooks } from '@recats/cdeebee';
import { db } from './core';

const hooks = createCdeebeeHooks(db);
export function useName(userID: number): string | undefined {
  const entity = hooks.useEntity('userList', userID);
  // @ts-expect-error selected entities must retain their declared types
  const invalid: number | undefined = entity?.name;
  void invalid;
  return entity?.name;
}

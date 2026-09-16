import { createCdeebeeHooks, usePluginState } from '@recats/cdeebee';
import { counter, db } from './core';

const hooks = createCdeebeeHooks(db);
export function useName(userID: number): string | undefined {
  const entity = hooks.useEntity('userList', userID);
  // @ts-expect-error selected entities must retain their declared types
  const invalid: number | undefined = entity?.name;
  void invalid;
  return entity?.name;
}

const plugin = counter();
export function useSettledCount(api: string): number {
  const count: number = usePluginState(plugin.subscribe, plugin.getState, [api]);
  // @ts-expect-error the snapshot type flows from getSnapshot
  const invalid: string = usePluginState(plugin.subscribe, plugin.getState, [api]);
  void invalid;
  return count;
}

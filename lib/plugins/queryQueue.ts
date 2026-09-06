import type { CdeebeePlugin, CdeebeeRequestContext } from '../core/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- `unknown` would reject a bare `CdeebeeQueryQueueOptions` value passed to `queryQueue<Storage>()`
export interface CdeebeeQueryQueueOptions<S = any> {
  apiList?: string[];
  /** Groups requests into independent queues. Runs inside `onRequest`, so it must not throw. */
  key?: (ctx: CdeebeeRequestContext<S>) => string;
}

interface QueueTicket {
  previous: Promise<void>;
  release: () => void;
}

// Resolves early on abort: runRequest re-checks the signal after every onResponse hook and throws the abort error itself.
const waitForPrevious = (previous: Promise<void>, signal: AbortSignal): Promise<void> => new Promise(resolve => {
  const onAbort = () => resolve();
  if (signal.aborted) { onAbort(); return; }
  signal.addEventListener('abort', onAbort, { once: true });
  previous.then(() => {
    signal.removeEventListener('abort', onAbort);
    resolve();
  });
});

export function queryQueue<S>(options: CdeebeeQueryQueueOptions<S> = {}): CdeebeePlugin<S> {
  const tailMap = new Map<string, Promise<void>>();
  const ticketMap = new Map<string, QueueTicket>();
  const applies = (api: string) => !options.apiList || options.apiList.includes(api);

  return {
    name: 'queryQueue',
    onRequest: ctx => {
      if (!applies(ctx.api)) return;
      const key = options.key?.(ctx) ?? '';
      const previous = tailMap.get(key) ?? Promise.resolve();
      let release!: () => void;
      const current = new Promise<void>(resolve => { release = resolve; });
      // A failed/canceled ticket can settle early, but cannot release its predecessors.
      const tail = previous.then(() => current);
      ticketMap.set(ctx.requestID, { previous, release });
      tailMap.set(key, tail);
      void tail.then(() => { if (tailMap.get(key) === tail) tailMap.delete(key); });
    },
    onResponse: async ctx => {
      const ticket = ticketMap.get(ctx.requestID);
      if (ticket) await waitForPrevious(ticket.previous, ctx.controller.signal);
    },
    onSettled: ctx => {
      const ticket = ticketMap.get(ctx.requestID);
      if (!ticket) return;
      ticketMap.delete(ctx.requestID);
      ticket.release();
    },
  };
}

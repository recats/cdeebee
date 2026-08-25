import type { CdeebeePlugin } from '../core/types';

export interface CdeebeeQueryQueueOptions {
  apiList?: string[];
}

interface Ticket {
  previous: Promise<void>;
  release: () => void;
}

export function queryQueue<S>(options: CdeebeeQueryQueueOptions = {}): CdeebeePlugin<S> {
  let tail: Promise<void> = Promise.resolve();
  const ticketMap = new Map<string, Ticket>();
  const applies = (api: string) => !options.apiList || options.apiList.includes(api);

  return {
    name: 'queryQueue',
    onRequest: ctx => {
      if (!applies(ctx.api)) return;
      let release!: () => void;
      const current = new Promise<void>(resolve => { release = resolve; });
      ticketMap.set(ctx.requestID, { previous: tail, release });
      tail = current;
    },
    onResponse: async ctx => {
      const ticket = ticketMap.get(ctx.requestID);
      if (ticket) await ticket.previous;
    },
    onSettled: ctx => {
      const ticket = ticketMap.get(ctx.requestID);
      if (!ticket) return;
      ticketMap.delete(ctx.requestID);
      ticket.release();
    },
  };
}

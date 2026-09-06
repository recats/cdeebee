import type { CdeebeeInstance, CdeebeePlugin, CdeebeeSnapshot } from '../core/types';

export interface CdeebeeDevtoolsOptions {
  name?: string;
}

interface DevtoolsConnection<S> {
  init: (snapshot: CdeebeeSnapshot<S>) => void;
  send: (action: { type: string; meta?: unknown }, snapshot: CdeebeeSnapshot<S>) => void;
}

interface DevtoolsExtension<S> {
  connect: (options: { name: string }) => DevtoolsConnection<S>;
}

export function devtools<S>(options: CdeebeeDevtoolsOptions = {}): CdeebeePlugin<S> {
  let session: { connection: DevtoolsConnection<S>; db: CdeebeeInstance<S> } | undefined;

  return {
    name: 'devtools',
    setup: instance => {
      const extension = (globalThis as { __REDUX_DEVTOOLS_EXTENSION__?: DevtoolsExtension<S> }).__REDUX_DEVTOOLS_EXTENSION__;
      if (!extension) return;
      const connection = extension.connect({ name: options.name ?? 'cdeebee' });
      session = { connection, db: instance };
      connection.init(instance.getSnapshot());
    },
    onCommit: (_changeSet, meta) => {
      if (session === undefined) return;
      const { connection, db } = session;
      connection.send({ type: meta.label ?? meta.source, meta }, db.getSnapshot());
    },
    onSettled: ctx => {
      if (session === undefined) return;
      const { connection, db } = session;
      const type = `request:${ctx.api}:${ctx.error ? ctx.error.kind : 'done'}`;
      connection.send({ type, meta: { api: ctx.api, requestID: ctx.requestID, status: ctx.status } }, db.getSnapshot());
    },
  };
}

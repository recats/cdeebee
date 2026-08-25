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
  let connection: DevtoolsConnection<S> | undefined;
  let db: CdeebeeInstance<S> | undefined;

  return {
    name: 'devtools',
    setup: instance => {
      db = instance;
      const extension = (globalThis as { __REDUX_DEVTOOLS_EXTENSION__?: DevtoolsExtension<S> }).__REDUX_DEVTOOLS_EXTENSION__;
      if (!extension) return;
      connection = extension.connect({ name: options.name ?? 'cdeebee' });
      connection.init(instance.getSnapshot());
    },
    onCommit: (_changeSet, meta) => {
      if (!connection || !db) return;
      connection.send({ type: meta.label ?? meta.source, meta }, db.getSnapshot());
    },
    onSettled: ctx => {
      if (!connection || !db) return;
      const type = `request:${ctx.api}:${ctx.error ? ctx.error.kind : 'done'}`;
      connection.send({ type, meta: { api: ctx.api, requestID: ctx.requestID, status: ctx.status } }, db.getSnapshot());
    },
  };
}

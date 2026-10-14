import assert from 'node:assert/strict';
import process from 'node:process';
import { setImmediate } from 'node:timers/promises';
import { createCdeebee, history } from '@recats/cdeebee/core';

assert.equal(typeof globalThis.gc, 'function', 'run with --expose-gc');
const plugin = history();
let releasePending;
const pendingResponse = new Promise(resolve => { releasePending = resolve; });
const response = { ok: true, status: 200, text: async () => '{}' };
const db = createCdeebee({
  primaryKeyList: {},
  fetch: { fetch: async api => api === '/pending' ? pendingResponse : response },
  pluginList: [plugin],
});

const exercise = async count => {
  for (let i = 0; i < count; i += 1) {
    const api = `/items/${i}`;
    await db.request({ api });
    if (i % 2) plugin.clear(api);
    else plugin.clear();
  }
};

await exercise(2000);
db.reset();
const pending = db.request({ api: '/pending' });
await setImmediate();
globalThis.gc();
const before = process.memoryUsage().heapUsed;
await exercise(100_000);
globalThis.gc();
const retained = process.memoryUsage().heapUsed - before;
assert.equal(Object.keys(plugin.getState().doneList).length, 0);
assert.ok(retained < 3 * 1024 * 1024, `cleared history retained ${retained} bytes after 100,000 keys`);
releasePending(response);
await pending;
plugin.clear();

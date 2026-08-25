import { describe, it, expect, vi } from 'vitest';
import { SubscriptionManager, RequestSubscriptionManager } from '../../../lib/core/subscription';

interface S { userList: Record<number, { id: number }>; postList: Record<number, { id: number }> }

const tick = () => new Promise<void>(resolve => queueMicrotask(resolve));

describe('SubscriptionManager', () => {
  it('entity listener fires only for its entityID', async () => {
    const m = new SubscriptionManager<S>();
    const one = vi.fn();
    const two = vi.fn();
    m.subscribe(one, [{ listName: 'userList', entityID: 1 }]);
    m.subscribe(two, [{ listName: 'userList', entityID: 2 }]);
    m.notify([{ listName: 'userList', entityIDList: [1] }]);
    await tick();
    expect(one).toHaveBeenCalledTimes(1);
    expect(two).not.toHaveBeenCalled();
  });

  it('list listener fires for any change in that list only', async () => {
    const m = new SubscriptionManager<S>();
    const userListener = vi.fn();
    const postListener = vi.fn();
    m.subscribe(userListener, [{ listName: 'userList' }]);
    m.subscribe(postListener, [{ listName: 'postList' }]);
    m.notify([{ listName: 'userList', entityIDList: [7] }]);
    await tick();
    expect(userListener).toHaveBeenCalledTimes(1);
    expect(postListener).not.toHaveBeenCalled();
  });

  it('global listener fires for everything', async () => {
    const m = new SubscriptionManager<S>();
    const global = vi.fn();
    m.subscribe(global);
    m.notify([{ listName: 'postList', entityIDList: [1] }]);
    await tick();
    expect(global).toHaveBeenCalledTimes(1);
  });

  it("'*' fires all entity listeners of the list", async () => {
    const m = new SubscriptionManager<S>();
    const one = vi.fn();
    const other = vi.fn();
    m.subscribe(one, [{ listName: 'userList', entityID: 1 }]);
    m.subscribe(other, [{ listName: 'postList', entityID: 1 }]);
    m.notify([{ listName: 'userList', entityIDList: '*' }]);
    await tick();
    expect(one).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
  });

  it('batches multiple notify calls into one flush and dedupes listeners', async () => {
    const m = new SubscriptionManager<S>();
    const listener = vi.fn();
    m.subscribe(listener, [{ listName: 'userList' }, { listName: 'postList' }]);
    m.notify([{ listName: 'userList', entityIDList: [1] }]);
    m.notify([{ listName: 'postList', entityIDList: [1] }]);
    expect(listener).not.toHaveBeenCalled();
    await tick();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('flush() runs pending notifications synchronously', () => {
    const m = new SubscriptionManager<S>();
    const listener = vi.fn();
    m.subscribe(listener, [{ listName: 'userList' }]);
    m.notify([{ listName: 'userList', entityIDList: [1] }]);
    m.flush();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe removes the listener from every key', async () => {
    const m = new SubscriptionManager<S>();
    const listener = vi.fn();
    const unsubscribe = m.subscribe(listener, [{ listName: 'userList', entityID: 1 }, { listName: 'postList' }]);
    unsubscribe();
    m.notify([{ listName: 'userList', entityIDList: [1] }, { listName: 'postList', entityIDList: [1] }]);
    await tick();
    expect(listener).not.toHaveBeenCalled();
  });

  it('entity ids are matched as strings and numbers alike', async () => {
    const m = new SubscriptionManager<S>();
    const listener = vi.fn();
    m.subscribe(listener, [{ listName: 'userList', entityID: '1' }]);
    m.notify([{ listName: 'userList', entityIDList: [1] }]);
    await tick();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('a throwing listener does not starve the others; the error is rethrown from flush()', () => {
    const m = new SubscriptionManager<S>();
    const bad = vi.fn(() => { throw new Error('boom'); });
    const good = vi.fn();
    m.subscribe(bad, [{ listName: 'userList' }]);
    m.subscribe(good, [{ listName: 'userList' }]);
    m.notify([{ listName: 'userList', entityIDList: [1] }]);
    expect(() => m.flush()).toThrow('boom');
    expect(good).toHaveBeenCalledTimes(1);
    // scheduler is not wedged afterwards
    m.notify([{ listName: 'userList', entityIDList: [2] }]);
    expect(() => m.flush()).toThrow('boom');
    expect(good).toHaveBeenCalledTimes(2);
  });
});

describe('RequestSubscriptionManager', () => {
  it('fires listeners keyed by api and global listeners', async () => {
    const m = new RequestSubscriptionManager();
    const byApi = vi.fn();
    const other = vi.fn();
    const global = vi.fn();
    m.subscribe(byApi, ['/a']);
    m.subscribe(other, ['/b']);
    m.subscribe(global);
    m.notify('/a');
    await tick();
    expect(byApi).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
    expect(global).toHaveBeenCalledTimes(1);
  });
});

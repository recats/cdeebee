// @vitest-environment jsdom
import { StrictMode, type PropsWithChildren } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createSubscription } from '../../../lib/core/subscription';
import { usePluginState } from '../../../lib/react/usePluginState';

const makePlugin = () => {
  let state: Record<string, number> = {};
  const subscription = createSubscription();
  return {
    subscribe: subscription.subscribe,
    getState: () => state,
    set: (key: string, value: number) => {
      state = { ...state, [key]: value };
      subscription.notify(key);
    },
  };
};

const strictWrapper = ({ children }: PropsWithChildren) => <StrictMode>{children}</StrictMode>;

describe('usePluginState', () => {
  it('re-renders for its own key only and reads the snapshot inline', async () => {
    const plugin = makePlugin();
    let renders = 0;
    const { result } = renderHook(() => { renders += 1; return usePluginState(plugin.subscribe, () => plugin.getState()['/a'], ['/a']); });
    expect(result.current).toBeUndefined();
    await act(async () => { plugin.set('/b', 1); });
    expect(renders).toBe(1);
    await act(async () => { plugin.set('/a', 2); });
    expect(result.current).toBe(2);
    expect(renders).toBe(2);
  });

  it('resubscribes when the key list changes and stops listening to the old key', async () => {
    const plugin = makePlugin();
    const subscribe = vi.fn(plugin.subscribe);
    plugin.set('/a', 1);
    plugin.set('/b', 2);
    const { result, rerender } = renderHook(({ key }: { key: string }) => usePluginState(subscribe, () => plugin.getState()[key], [key]), { initialProps: { key: '/a' } });
    expect(result.current).toBe(1);
    expect(subscribe).toHaveBeenCalledTimes(1);
    rerender({ key: '/b' });
    expect(result.current).toBe(2);
    expect(subscribe).toHaveBeenCalledTimes(2);
    let renders = 0;
    const probe = renderHook(() => { renders += 1; return usePluginState(subscribe, () => plugin.getState()['/b'], ['/b']); });
    await act(async () => { plugin.set('/a', 10); });
    expect(renders).toBe(1);
    expect(probe.result.current).toBe(2);
  });

  it('does not resubscribe for a new array with the same keys', () => {
    const plugin = makePlugin();
    const subscribe = vi.fn(plugin.subscribe);
    const { rerender } = renderHook(({ keyList }: { keyList: string[] }) => usePluginState(subscribe, () => plugin.getState()['/a'], keyList), { initialProps: { keyList: ['/a', '/b'] } });
    rerender({ keyList: ['/a', '/b'] });
    rerender({ keyList: ['/a', '/b'] });
    expect(subscribe).toHaveBeenCalledTimes(1);
    rerender({ keyList: ['/b', '/a'] });
    expect(subscribe).toHaveBeenCalledTimes(2);
  });

  it('subscribes to every key in the list', async () => {
    const plugin = makePlugin();
    const { result } = renderHook(() => usePluginState(plugin.subscribe, () => `${plugin.getState()['/a'] ?? 0}|${plugin.getState()['/b'] ?? 0}`, ['/a', '/b']));
    await act(async () => { plugin.set('/a', 1); });
    expect(result.current).toBe('1|0');
    await act(async () => { plugin.set('/b', 2); });
    expect(result.current).toBe('1|2');
  });

  it('cleans up its subscription on unmount under StrictMode', async () => {
    const plugin = makePlugin();
    let active = 0;
    const subscribe = (...args: Parameters<typeof plugin.subscribe>) => {
      const unsubscribe = plugin.subscribe(...args);
      active += 1;
      return () => { active -= 1; unsubscribe(); };
    };
    const { unmount } = renderHook(() => usePluginState(subscribe, () => plugin.getState()['/a'], ['/a']), { wrapper: strictWrapper });
    expect(active).toBe(1);
    unmount();
    expect(active).toBe(0);
    await act(async () => { plugin.set('/a', 1); });
    expect(active).toBe(0);
  });

  it('renders on the server from the snapshot without subscribing', () => {
    const plugin = makePlugin();
    plugin.set('/a', 7);
    const subscribe = vi.fn(plugin.subscribe);
    const Probe = () => <span>{usePluginState(subscribe, () => plugin.getState()['/a'], ['/a'])}</span>;
    expect(renderToString(<Probe />)).toBe('<span>7</span>');
    expect(subscribe).not.toHaveBeenCalled();
  });
});

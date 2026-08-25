import { describe, it, expect } from 'vitest';
import { batchingUpdate } from '../../../lib/utils/batchingUpdate';

describe('batchingUpdate', () => {
  it('should update a single top-level key', () => {
    const state: Record<string, unknown> = { a: 1, b: 2 };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const valueList: any = [
      { key: ['a'], value: 10 },
    ];

    batchingUpdate(state, valueList);

    expect(state.a).toBe(10);
    expect(state.b).toBe(2);
  });

  it('should update multiple top-level keys', () => {
    const state: Record<string, unknown> = { a: 1, b: 2, c: 3 };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const valueList: any = [
      { key: ['a'], value: 10 },
      { key: ['b'], value: 20 },
    ];

    batchingUpdate(state, valueList);

    expect(state.a).toBe(10);
    expect(state.b).toBe(20);
    expect(state.c).toBe(3);
  });

  it('should update nested keys', () => {
    const state: Record<string, unknown> = {
      campaignList: {
        '123': { name: 'Old Name', id: '123' },
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const valueList: any = [
      { key: ['campaignList', '123', 'name'], value: 'New Name' },
    ];

    batchingUpdate(state, valueList);

    const campaign = (state.campaignList as Record<string, unknown>)['123'] as Record<string, unknown>;
    expect(campaign.name).toBe('New Name');
    expect(campaign.id).toBe('123');
  });

  it('should create nested structure if it does not exist', () => {
    const state: Record<string, unknown> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const valueList: any = [
      { key: ['campaignList', '123', 'name'], value: 'Campaign Name' },
    ];

    batchingUpdate(state, valueList);

    const campaign = (state.campaignList as Record<string, unknown>)['123'] as Record<string, unknown>;
    expect(campaign.name).toBe('Campaign Name');
  });

  it('should update multiple nested keys', () => {
    const state: Record<string, unknown> = {
      campaignList: {
        '123': { name: 'Old Name', status: 'draft' },
        '456': { name: 'Another', status: 'active' },
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const valueList: any = [
      { key: ['campaignList', '123', 'name'], value: 'Updated Name' },
      { key: ['campaignList', '456', 'status'], value: 'paused' },
    ];

    batchingUpdate(state, valueList);

    const campaign1 = (state.campaignList as Record<string, unknown>)['123'] as Record<string, unknown>;
    const campaign2 = (state.campaignList as Record<string, unknown>)['456'] as Record<string, unknown>;

    expect(campaign1.name).toBe('Updated Name');
    expect(campaign1.status).toBe('draft');
    expect(campaign2.name).toBe('Another');
    expect(campaign2.status).toBe('paused');
  });

  it('should handle numeric keys in path', () => {
    const state: Record<string, unknown> = {
      items: [{ id: 1, name: 'Item 1' }, { id: 2, name: 'Item 2' }],
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const valueList: any = [
      { key: ['items', 0, 'name'], value: 'Updated Item 1' },
    ];

    batchingUpdate(state, valueList);

    const items = state.items as Array<Record<string, unknown>>;
    expect(items[0].name).toBe('Updated Item 1');
    expect(items[1].name).toBe('Item 2');
  });

  it('should handle empty path (skip)', () => {
    const state: Record<string, unknown> = { a: 1, b: 2 };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const valueList: any = [
      { key: [], value: 'ignored' },
      { key: ['a'], value: 10 },
    ];

    batchingUpdate(state, valueList);

    expect(state.a).toBe(10);
    expect(state.b).toBe(2);
  });

  it('should preserve other properties when updating nested values', () => {
    const state: Record<string, unknown> = {
      campaignList: {
        '123': { name: 'Old', status: 'active', id: '123' },
      },
      otherData: { value: 'preserved' },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const valueList: any = [
      { key: ['campaignList', '123', 'name'], value: 'New' },
    ];

    batchingUpdate(state, valueList);

    const campaign = (state.campaignList as Record<string, unknown>)['123'] as Record<string, unknown>;
    expect(campaign.name).toBe('New');
    expect(campaign.status).toBe('active');
    expect(campaign.id).toBe('123');
    expect(state.otherData).toEqual({ value: 'preserved' });
  });

  it('should handle deep nested paths', () => {
    const state: Record<string, unknown> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const valueList: any = [
      { key: ['level1', 'level2', 'level3', 'level4', 'value'], value: 'deep value' },
    ];

    batchingUpdate(state, valueList);

    const level1 = state.level1 as Record<string, unknown>;
    const level2 = level1.level2 as Record<string, unknown>;
    const level3 = level2.level3 as Record<string, unknown>;
    const level4 = level3.level4 as Record<string, unknown>;

    expect(level4.value).toBe('deep value');
  });

  it('should mutate state in place', () => {
    const state: Record<string, unknown> = { a: 1 };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const valueList: any = [
      { key: ['a'], value: 2 },
    ];

    batchingUpdate(state, valueList);

    // Should mutate the same object reference
    expect(state.a).toBe(2);
  });

  it('should update array element directly when path ends at array index', () => {
    const state: Record<string, unknown> = {
      items: [{ id: 1 }, { id: 2 }],
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const valueList: any = [
      { key: ['items', 0], value: 'replaced' },
    ];

    batchingUpdate(state, valueList);

    const items = state.items as Array<unknown>;
    expect(Array.isArray(state.items)).toBe(true);
    expect(items[0]).toBe('replaced');
    expect(items[1]).toEqual({ id: 2 });
  });

  it('should handle path where intermediate step is array but final is object', () => {
    const state: Record<string, unknown> = {
      items: [{ id: 1, name: 'Item 1' }, { id: 2, name: 'Item 2' }],
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const valueList: any = [
      { key: ['items', 0, 'name'], value: 'Updated Item 1' },
    ];

    batchingUpdate(state, valueList);

    const items = state.items as Array<Record<string, unknown>>;
    expect(items[0].name).toBe('Updated Item 1');
  });
});

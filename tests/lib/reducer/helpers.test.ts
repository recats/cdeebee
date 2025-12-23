import { describe, it, expect, vi } from 'vitest';
import { checkModule } from '../../../lib/reducer/helpers';
import { type CdeebeeSettings, type CdeebeeModule } from '../../../lib/reducer/types';

describe('checkModule', () => {
  it('should execute result callback when module is included in settings', () => {
    const settings: CdeebeeSettings = {
      modules: ['history', 'listener'] as CdeebeeModule[],
      fileKey: 'file',
      bodyKey: 'body',
      primaryKey: 'id',
      mergeWithData: {},
      listStrategy: {},
    };

    const resultCallback = vi.fn();
    checkModule(settings, 'history', resultCallback);

    expect(resultCallback).toHaveBeenCalledTimes(1);
  });

  it('should not execute result callback when module is not included in settings', () => {
    const settings: CdeebeeSettings = {
      modules: ['history', 'listener'] as CdeebeeModule[],
      fileKey: 'file',
      bodyKey: 'body',
      primaryKey: 'id',
      mergeWithData: {},
      listStrategy: {},
    };

    const resultCallback = vi.fn();
    checkModule(settings, 'cancelation', resultCallback);

    expect(resultCallback).not.toHaveBeenCalled();
  });

  it('should work with all module types', () => {
    const settings: CdeebeeSettings = {
      modules: ['history', 'listener', 'state', 'cancelation'] as CdeebeeModule[],
      fileKey: 'file',
      bodyKey: 'body',
      primaryKey: 'id',
      mergeWithData: {},
      listStrategy: {},
    };

    const modules: CdeebeeModule[] = ['history', 'listener', 'state', 'cancelation'];
    
    modules.forEach(module => {
      const resultCallback = vi.fn();
      checkModule(settings, module, resultCallback);
      expect(resultCallback).toHaveBeenCalledTimes(1);
    });
  });

  it('should handle empty modules array', () => {
    const settings: CdeebeeSettings = {
      modules: [] as CdeebeeModule[],
      fileKey: 'file',
      bodyKey: 'body',
      primaryKey: 'id',
      mergeWithData: {},
      listStrategy: {},
    };

    const resultCallback = vi.fn();
    checkModule(settings, 'history', resultCallback);

    expect(resultCallback).not.toHaveBeenCalled();
  });
});


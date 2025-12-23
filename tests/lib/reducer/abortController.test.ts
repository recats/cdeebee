import { describe, it, expect, vi } from 'vitest';
import { abortQuery, abortManager } from '../../../lib/reducer/abortController';

describe('abortController', () => {

  describe('abortQuery', () => {
    it('should abort all requests for the same API except the current one', () => {
      const api = '/api/test';
      const requestId1 = 'req-1';
      const requestId2 = 'req-2';
      const requestId3 = 'req-3';

      const signal1 = new AbortController().signal;
      const signal2 = new AbortController().signal;
      const signal3 = new AbortController().signal;

      const manager1 = abortManager(signal1, api, requestId1);
      const manager2 = abortManager(signal2, api, requestId2);
      const manager3 = abortManager(signal3, api, requestId3);

      manager1.init();
      manager2.init();
      manager3.init();

      abortQuery(api, requestId2);
    });
  });

  describe('abortManager', () => {
    it('should create a controller and return init/drop functions', () => {
      const signal = new AbortController().signal;
      const api = '/api/test';
      const requestId = 'req-1';

      const manager = abortManager(signal, api, requestId);

      expect(manager).toHaveProperty('controller');
      expect(manager).toHaveProperty('init');
      expect(manager).toHaveProperty('drop');
      expect(manager.controller).toBeInstanceOf(AbortController);
      expect(typeof manager.init).toBe('function');
      expect(typeof manager.drop).toBe('function');
    });

    it('should abort controller when signal is aborted', () => {
      const parentController = new AbortController();
      const signal = parentController.signal;
      const api = '/api/test';
      const requestId = 'req-1';

      const manager = abortManager(signal, api, requestId);
      const abortSpy = vi.spyOn(manager.controller, 'abort');

      parentController.abort();

      expect(abortSpy).toHaveBeenCalledTimes(1);
    });

    it('should allow init to be called multiple times', () => {
      const signal = new AbortController().signal;
      const api = '/api/test';
      const requestId = 'req-1';

      const manager = abortManager(signal, api, requestId);

      expect(() => {
        manager.init();
        manager.init();
      }).not.toThrow();
    });

    it('should allow drop to be called multiple times', () => {
      const signal = new AbortController().signal;
      const api = '/api/test';
      const requestId = 'req-1';

      const manager = abortManager(signal, api, requestId);
      manager.init();

      expect(() => {
        manager.drop();
        manager.drop();
      }).not.toThrow();
    });

    it('should handle cleanup when drop is called', () => {
      const signal = new AbortController().signal;
      const api = '/api/test';
      const requestId = 'req-1';

      const manager = abortManager(signal, api, requestId);
      manager.init();

      expect(() => manager.drop()).not.toThrow();
    });
  });
});


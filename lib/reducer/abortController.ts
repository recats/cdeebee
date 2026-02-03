interface RequestController {
  requestId: string;
  controller: AbortController;
  api: string;
}

class AbortControllerStore {
  private byRequestId = new Map<string, RequestController>();
  private byApi = new Map<string, Set<string>>();

  add(api: string, requestId: string, controller: AbortController): void {
    const item: RequestController = { requestId, controller, api };
    this.byRequestId.set(requestId, item);

    if (!this.byApi.has(api)) {
      this.byApi.set(api, new Set());
    }
    this.byApi.get(api)!.add(requestId);
  }

  delete(requestId: string): void {
    const item = this.byRequestId.get(requestId);
    if (!item) return;

    this.byRequestId.delete(requestId);
    const apiSet = this.byApi.get(item.api);
    if (apiSet) {
      apiSet.delete(requestId);
      if (apiSet.size === 0) {
        this.byApi.delete(item.api);
      }
    }
  }

  abortAllForApi(api: string, excludeRequestId: string): void {
    const requestIDList = this.byApi.get(api);
    if (!requestIDList) return;

    requestIDList.forEach(requestId => {
      if (requestId !== excludeRequestId) {
        const item = this.byRequestId.get(requestId);
        if (item) {
          item.controller.abort();
          this.delete(requestId);
        }
      }
    });
  }
}

const abortStore = new AbortControllerStore();

export function abortQuery(api: string, currentRequestId: string): void {
  abortStore.abortAllForApi(api, currentRequestId);
}

export function abortManager(signal: AbortSignal, api: string, requestId: string) {
  const controller = new AbortController();

  const cleanup = () => {
    abortStore.delete(requestId);
  };

  signal.addEventListener('abort', () => {
    controller.abort();
    cleanup();
  });

  return {
    controller,
    init: () => abortStore.add(api, requestId, controller),
    drop: cleanup,
  };
}

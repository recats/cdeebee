class QueryQueue {
  private currentPromise: Promise<unknown> = Promise.resolve();
  private queueLength = 0;

  async enqueue<T>(task: () => Promise<T>): Promise<T> {
    this.queueLength++;

    const previousPromise = this.currentPromise;

    this.currentPromise = previousPromise
      .then(() => task(), () => task())
      .finally(() => {
        this.queueLength--;
      });

    return this.currentPromise as Promise<T>;
  }

  getQueueLength(): number {
    return this.queueLength;
  }

  clear(): void {
    this.queueLength = 0;
  }
}

export const queryQueue = new QueryQueue();


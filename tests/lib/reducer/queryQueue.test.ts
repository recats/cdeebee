import { describe, it, expect, beforeEach } from 'vitest';
import { queryQueue } from '../../../lib/reducer/queryQueue';

describe('queryQueue', () => {
  beforeEach(() => {
    queryQueue.clear();
  });

  describe('sequential execution', () => {
    it('should execute tasks sequentially in order', async () => {
      const executionOrder: number[] = [];
      
      const task1 = async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        executionOrder.push(1);
        return 'task1';
      };
      
      const task2 = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        executionOrder.push(2);
        return 'task2';
      };
      
      const task3 = async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
        executionOrder.push(3);
        return 'task3';
      };

      const promise1 = queryQueue.enqueue(task1);
      const promise2 = queryQueue.enqueue(task2);
      const promise3 = queryQueue.enqueue(task3);

      const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);

      expect(result1).toBe('task1');
      expect(result2).toBe('task2');
      expect(result3).toBe('task3');

      expect(executionOrder).toEqual([1, 2, 3]);
    });

    it('should wait for previous task to complete before starting next', async () => {
      const startTimes: number[] = [];
      const endTimes: number[] = [];

      const task1 = async () => {
        startTimes.push(Date.now());
        await new Promise(resolve => setTimeout(resolve, 100));
        endTimes.push(Date.now());
        return 'task1';
      };

      const task2 = async () => {
        startTimes.push(Date.now());
        await new Promise(resolve => setTimeout(resolve, 50));
        endTimes.push(Date.now());
        return 'task2';
      };

      const promise1 = queryQueue.enqueue(task1);
      const promise2 = queryQueue.enqueue(task2);

      await Promise.all([promise1, promise2]);

      expect(startTimes[1]).toBeGreaterThanOrEqual(endTimes[0]);
    });
  });

  describe('error handling', () => {
    it('should continue processing queue even if a task fails', async () => {
      const executionOrder: string[] = [];

      const task1 = async () => {
        executionOrder.push('task1-start');
        throw new Error('Task 1 failed');
      };

      const task2 = async () => {
        executionOrder.push('task2-start');
        await new Promise(resolve => setTimeout(resolve, 10));
        executionOrder.push('task2-end');
        return 'task2-success';
      };

      const task3 = async () => {
        executionOrder.push('task3-start');
        return 'task3-success';
      };

      const promise1 = queryQueue.enqueue(task1).catch(() => 'task1-error');
      const promise2 = queryQueue.enqueue(task2);
      const promise3 = queryQueue.enqueue(task3);

      const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);

      expect(result1).toBe('task1-error');
      
      expect(result2).toBe('task2-success');
      expect(result3).toBe('task3-success');

      expect(executionOrder).toEqual(['task1-start', 'task2-start', 'task2-end', 'task3-start']);
    });

    it('should handle rejected promises correctly', async () => {
      const task1 = async () => {
        throw new Error('Rejected');
      };

      const task2 = async () => {
        return 'success';
      };

      const promise1 = queryQueue.enqueue(task1).catch(err => err.message);
      const promise2 = queryQueue.enqueue(task2);

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1).toBe('Rejected');
      expect(result2).toBe('success');
    });
  });

  describe('queue length', () => {
    it('should track queue length correctly', async () => {
      expect(queryQueue.getQueueLength()).toBe(0);

      const task1 = queryQueue.enqueue(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'task1';
      });

      expect(queryQueue.getQueueLength()).toBeGreaterThan(0);

      const task2 = queryQueue.enqueue(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'task2';
      });

      expect(queryQueue.getQueueLength()).toBeGreaterThan(1);

      await Promise.all([task1, task2]);

      expect(queryQueue.getQueueLength()).toBe(0);
    });

    it('should decrease queue length after task completion', async () => {
      const task1 = queryQueue.enqueue(async () => {
        await new Promise(resolve => setTimeout(resolve, 30));
        return 'task1';
      });

      const initialLength = queryQueue.getQueueLength();
      expect(initialLength).toBe(1);

      await task1;

      expect(queryQueue.getQueueLength()).toBe(0);
    });
  });

  describe('clear', () => {
    it('should reset queue length to 0', () => {
      queryQueue.enqueue(async () => 'task1');
      queryQueue.enqueue(async () => 'task2');

      expect(queryQueue.getQueueLength()).toBeGreaterThan(0);

      queryQueue.clear();

      expect(queryQueue.getQueueLength()).toBe(0);
    });

    it('should not affect currently executing tasks', async () => {
      const executionLog: string[] = [];

      const task1 = queryQueue.enqueue(async () => {
        executionLog.push('task1-start');
        await new Promise(resolve => setTimeout(resolve, 50));
        executionLog.push('task1-end');
        return 'task1';
      });

      queryQueue.clear();

      await task1;

      expect(executionLog).toEqual(['task1-start', 'task1-end']);
    });
  });

  describe('return values', () => {
    it('should return correct values from tasks', async () => {
      const task1 = queryQueue.enqueue(async () => 42);
      const task2 = queryQueue.enqueue(async () => 'hello');
      const task3 = queryQueue.enqueue(async () => ({ key: 'value' }));

      const [result1, result2, result3] = await Promise.all([task1, task2, task3]);

      expect(result1).toBe(42);
      expect(result2).toBe('hello');
      expect(result3).toEqual({ key: 'value' });
    });
  });

  describe('multiple rapid enqueues', () => {
    it('should handle many tasks enqueued rapidly', async () => {
      const promises: Promise<number>[] = [];

      for (let i = 0; i < 10; i++) {
        const taskNumber = i;
        promises.push(
          queryQueue.enqueue(async () => {
            await new Promise(resolve => setTimeout(resolve, 10));
            return taskNumber;
          })
        );
      }

      const allResultList = await Promise.all(promises);

      expect(allResultList).toHaveLength(10);
      
      expect(allResultList).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });
  });

  describe('real-world scenario: sequential API calls', () => {
    it('should process API-like requests sequentially', async () => {
      const callOrder: number[] = [];
      const responses: string[] = [];

      const makeRequest = (id: number, delay: number) => {
        return queryQueue.enqueue(async () => {
          callOrder.push(id);
          await new Promise(resolve => setTimeout(resolve, delay));
          const response = `Response-${id}`;
          responses.push(response);
          return response;
        });
      };

      const request1 = makeRequest(1, 100);
      const request2 = makeRequest(2, 50);  // Faster but should wait
      const request3 = makeRequest(3, 30);
      const request4 = makeRequest(4, 20);
      const request5 = makeRequest(5, 10);  // Fastest but should be last

      const resultList = await Promise.all([request1, request2, request3, request4, request5]);

      expect(resultList).toHaveLength(5);
      expect(resultList).toEqual(['Response-1', 'Response-2', 'Response-3', 'Response-4', 'Response-5']);

      expect(callOrder).toEqual([1, 2, 3, 4, 5]);

      expect(responses).toEqual(['Response-1', 'Response-2', 'Response-3', 'Response-4', 'Response-5']);
    });
  });
});


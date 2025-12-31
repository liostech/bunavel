import { describe, test, expect, beforeEach } from "bun:test";
import { Queue } from "../../src/core/queue/Queue";
import { BaseJob } from "../../src/core/queue/Job";
import { SyncQueueDriver } from "../../src/core/queue/SyncQueueDriver";
import { MemoryQueueDriver } from "../../src/core/queue/MemoryQueueDriver";

describe("Queue System", () => {
  describe("BaseJob", () => {
    test("should have default retry configuration", () => {
      class TestJob extends BaseJob {
        async handle() {}
      }

      const job = new TestJob();
      expect(job.tries).toBe(3);
      expect(job.retryAfter).toBe(60);
    });

    test("should allow custom retry configuration", () => {
      class TestJob extends BaseJob {
        override tries = 5;
        override retryAfter = 120;

        override async handle() {}
      }

      const job = new TestJob();
      expect(job.tries).toBe(5);
      expect(job.retryAfter).toBe(120);
    });
  });

  describe("SyncQueueDriver", () => {
    let driver: SyncQueueDriver;
    let executionLog: string[];

    beforeEach(() => {
      driver = new SyncQueueDriver();
      executionLog = [];
    });

    test("should execute job immediately", async () => {
      class TestJob extends BaseJob {
        constructor(private log: string[]) {
          super();
        }

        async handle() {
          this.log.push("executed");
        }
      }

      await driver.push(new TestJob(executionLog));
      expect(executionLog).toEqual(["executed"]);
    });

    test("should execute delayed job after delay", async () => {
      class TestJob extends BaseJob {
        constructor(private log: string[]) {
          super();
        }

        async handle() {
          this.log.push("executed");
        }
      }

      await driver.push(new TestJob(executionLog), "default", 0.1);
      expect(executionLog).toEqual([]);

      // Wait for the delay
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(executionLog).toEqual(["executed"]);
    });

    test("should handle job failure", async () => {
      const errors: Error[] = [];

      class TestJob extends BaseJob {
        async handle() {
          throw new Error("Job failed");
        }

        override async failed(error: Error) {
          errors.push(error);
        }
      }

      await driver.push(new TestJob());
      expect(errors.length).toBe(1);
      expect(errors[0]!.message).toBe("Job failed");
    });

    test("should execute multiple jobs in order", async () => {
      class TestJob extends BaseJob {
        constructor(
          private log: string[],
          private value: string
        ) {
          super();
        }

        async handle() {
          this.log.push(this.value);
        }
      }

      await driver.pushMany([
        new TestJob(executionLog, "first"),
        new TestJob(executionLog, "second"),
        new TestJob(executionLog, "third"),
      ]);

      expect(executionLog).toEqual(["first", "second", "third"]);
    });

    test("should always report size as 0", async () => {
      const size = await driver.size();
      expect(size).toBe(0);
    });

    test("should always return null when popping", async () => {
      const job = await driver.pop();
      expect(job).toBeNull();
    });
  });

  describe("MemoryQueueDriver", () => {
    let driver: MemoryQueueDriver;

    beforeEach(() => {
      driver = new MemoryQueueDriver();
    });

    test("should push job to queue", async () => {
      class TestJob extends BaseJob {
        async handle() {}
      }

      const id = await driver.push(new TestJob());
      expect(id).toContain("mem-");
      expect(await driver.size()).toBe(1);
    });

    test("should push multiple jobs to queue", async () => {
      class TestJob extends BaseJob {
        async handle() {}
      }

      const ids = await driver.pushMany([
        new TestJob(),
        new TestJob(),
        new TestJob(),
      ]);

      expect(ids.length).toBe(3);
      expect(await driver.size()).toBe(3);
    });

    test("should pop job from queue", async () => {
      class TestJob extends BaseJob {
        async handle() {}
      }

      await driver.push(new TestJob());
      const job = await driver.pop();

      expect(job).not.toBeNull();
      expect(job!.job).toBeInstanceOf(TestJob);
      expect(await driver.size()).toBe(0);
    });

    test("should respect delayed jobs", async () => {
      class TestJob extends BaseJob {
        async handle() {}
      }

      await driver.push(new TestJob(), "default", 1);
      const job1 = await driver.pop();
      expect(job1).toBeNull();

      // Wait for the delay
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const job2 = await driver.pop();
      expect(job2).not.toBeNull();
      expect(job2?.job).toBeInstanceOf(TestJob);
    });

    test("should handle multiple queues", async () => {
      class TestJob extends BaseJob {
        async handle() {}
      }

      await driver.push(new TestJob(), "queue1");
      await driver.push(new TestJob(), "queue2");

      expect(await driver.size("queue1")).toBe(1);
      expect(await driver.size("queue2")).toBe(1);
      expect(await driver.size()).toBe(2);
    });

    test("should delete job by id", async () => {
      class TestJob extends BaseJob {
        async handle() {}
      }

      const id = await driver.push(new TestJob());
      expect(await driver.size()).toBe(1);

      const deleted = await driver.delete(id);
      expect(deleted).toBe(true);
      expect(await driver.size()).toBe(0);
    });

    test("should return false when deleting non-existent job", async () => {
      const deleted = await driver.delete("non-existent");
      expect(deleted).toBe(false);
    });

    test("should clear specific queue", async () => {
      class TestJob extends BaseJob {
        async handle() {}
      }

      await driver.push(new TestJob(), "queue1");
      await driver.push(new TestJob(), "queue2");

      await driver.clear("queue1");
      expect(await driver.size("queue1")).toBe(0);
      expect(await driver.size("queue2")).toBe(1);
    });

    test("should clear all queues", async () => {
      class TestJob extends BaseJob {
        async handle() {}
      }

      await driver.push(new TestJob(), "queue1");
      await driver.push(new TestJob(), "queue2");

      await driver.clear();
      expect(await driver.size()).toBe(0);
    });
  });

  describe("Queue Manager", () => {
    let queue: Queue;
    let executionLog: string[];

    beforeEach(() => {
      queue = new Queue({ driver: new MemoryQueueDriver() });
      executionLog = [];
    });

    test("should dispatch job to default queue", async () => {
      class TestJob extends BaseJob {
        async handle() {}
      }

      const id = await queue.dispatch(new TestJob());
      expect(id).toContain("mem-");
      expect(await queue.size()).toBe(1);
    });

    test("should dispatch job to specific queue", async () => {
      class TestJob extends BaseJob {
        async handle() {}
      }

      await queue.dispatch(new TestJob(), "custom");
      expect(await queue.size("custom")).toBe(1);
    });

    test("should dispatch job with delay", async () => {
      class TestJob extends BaseJob {
        async handle() {}
      }

      await queue.later(1, new TestJob());
      expect(await queue.size()).toBe(1);
    });

    test("should dispatch multiple jobs", async () => {
      class TestJob extends BaseJob {
        async handle() {}
      }

      const ids = await queue.dispatchMany([
        new TestJob(),
        new TestJob(),
        new TestJob(),
      ]);

      expect(ids.length).toBe(3);
      expect(await queue.size()).toBe(3);
    });

    test("should process job from queue", async () => {
      class TestJob extends BaseJob {
        constructor(private log: string[]) {
          super();
        }

        async handle() {
          this.log.push("executed");
        }
      }

      await queue.dispatch(new TestJob(executionLog));
      expect(executionLog).toEqual([]);

      const processed = await queue.processNext();
      expect(processed).toBe(true);
      expect(executionLog).toEqual(["executed"]);
      expect(await queue.size()).toBe(0);
    });

    test("should return false when no job to process", async () => {
      const processed = await queue.processNext();
      expect(processed).toBe(false);
    });

    test("should handle job failure with retry", async () => {
      let attempts = 0;

      class TestJob extends BaseJob {
        override tries = 2;
        override retryAfter = 0.1;

        override async handle() {
          attempts++;
          throw new Error("Job failed");
        }
      }

      await queue.dispatch(new TestJob());
      await queue.processNext();

      expect(attempts).toBe(1);
      expect(await queue.size()).toBe(1);
    });

    test("should call failed handler after max retries", async () => {
      let attempts = 0;
      let failedCalled = false;

      class TestJob extends BaseJob {
        override tries = 2;
        override retryAfter = 0.1; // Short retry delay for testing

        override async handle() {
          attempts++;
          throw new Error("Job failed");
        }

        override async failed() {
          failedCalled = true;
        }
      }

      const job = new TestJob();
      await queue.dispatch(job);

      // Process twice (initial + 1 retry)
      await queue.processNext();
      await new Promise((resolve) => setTimeout(resolve, 150));
      await queue.processNext();

      expect(attempts).toBe(2);
      expect(failedCalled).toBe(true);
      expect(await queue.size()).toBe(0);
    });

    test("should start and stop worker", async () => {
      class TestJob extends BaseJob {
        constructor(private log: string[]) {
          super();
        }

        async handle() {
          this.log.push("executed");
        }
      }

      await queue.dispatch(new TestJob(executionLog));
      queue.startWorker({ interval: 100 });

      // Wait for worker to process
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(executionLog).toEqual(["executed"]);
      expect(await queue.size()).toBe(0);

      queue.stopWorker();
    });

    test("should not start multiple workers", () => {
      queue.startWorker();
      queue.startWorker(); // Should be ignored

      queue.stopWorker();
    });

    test("should clear queue", async () => {
      class TestJob extends BaseJob {
        async handle() {}
      }

      await queue.dispatchMany([new TestJob(), new TestJob(), new TestJob()]);
      expect(await queue.size()).toBe(3);

      await queue.clear();
      expect(await queue.size()).toBe(0);
    });

    test("should get driver instance", () => {
      const driver = queue.getDriver();
      expect(driver).toBeInstanceOf(MemoryQueueDriver);
    });
  });

  describe("Queue with SyncDriver", () => {
    let queue: Queue;
    let executionLog: string[];

    beforeEach(() => {
      queue = new Queue({ driver: new SyncQueueDriver() });
      executionLog = [];
    });

    test("should execute job immediately on dispatch", async () => {
      class TestJob extends BaseJob {
        constructor(private log: string[]) {
          super();
        }

        async handle() {
          this.log.push("executed");
        }
      }

      await queue.dispatch(new TestJob(executionLog));
      expect(executionLog).toEqual(["executed"]);
    });

    test("should execute multiple jobs immediately", async () => {
      class TestJob extends BaseJob {
        constructor(
          private log: string[],
          private value: string
        ) {
          super();
        }

        async handle() {
          this.log.push(this.value);
        }
      }

      await queue.dispatchMany([
        new TestJob(executionLog, "first"),
        new TestJob(executionLog, "second"),
      ]);

      expect(executionLog).toEqual(["first", "second"]);
    });
  });
});

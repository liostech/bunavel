import type { Job } from "./Job";
import type { QueueDriver } from "./QueueDriver";
import { BaseJob } from "./Job";

interface QueueConfig {
  driver: QueueDriver;
  defaultQueue?: string;
}

/**
 * Queue manager
 * Provides a unified API for dispatching jobs
 */
export class Queue {
  private driver: QueueDriver;
  private defaultQueue: string;
  private worker: NodeJS.Timeout | null = null;

  constructor(config: QueueConfig) {
    this.driver = config.driver;
    this.defaultQueue = config.defaultQueue ?? "default";
  }

  /**
   * Dispatch a job to the queue
   */
  async dispatch(job: Job, queueName?: string): Promise<string> {
    return this.driver.push(job, queueName ?? this.defaultQueue);
  }

  /**
   * Dispatch a job immediately (same as dispatch with no delay)
   */
  async dispatchNow(job: Job, queueName?: string): Promise<string> {
    return this.driver.push(job, queueName ?? this.defaultQueue, 0);
  }

  /**
   * Dispatch a job with a delay
   */
  async later(delay: number, job: Job, queueName?: string): Promise<string> {
    return this.driver.push(job, queueName ?? this.defaultQueue, delay);
  }

  /**
   * Dispatch multiple jobs to the queue
   */
  async dispatchMany(jobs: Job[], queueName?: string): Promise<string[]> {
    return this.driver.pushMany(jobs, queueName ?? this.defaultQueue);
  }

  /**
   * Get the size of the queue
   */
  async size(queueName?: string): Promise<number> {
    return this.driver.size(queueName ?? this.defaultQueue);
  }

  /**
   * Clear all jobs from the queue
   */
  async clear(queueName?: string): Promise<void> {
    return this.driver.clear(queueName ?? this.defaultQueue);
  }

  /**
   * Start a worker to process jobs
   */
  startWorker(options?: { interval?: number; queueName?: string }): void {
    if (this.worker) {
      return;
    }

    const interval = options?.interval ?? 1000; // Default: 1 second
    const queueName = options?.queueName ?? this.defaultQueue;

    this.worker = setInterval(async () => {
      const queuedJob = await this.driver.pop(queueName);
      if (!queuedJob) {
        return;
      }

      try {
        await queuedJob.job.handle();
        await this.driver.delete(queuedJob.id);
      } catch (error) {
        queuedJob.attempts++;

        // Check if we should retry
        const maxAttempts =
          queuedJob.job instanceof BaseJob ? queuedJob.job.tries : 3;

        if (queuedJob.attempts < maxAttempts) {
          // Re-queue the job with retry delay
          const retryAfter =
            queuedJob.job instanceof BaseJob ? queuedJob.job.retryAfter : 60;
          await this.driver.pushQueued(queuedJob, retryAfter);
        } else {
          // Max attempts reached, call failed handler
          if (queuedJob.job.failed) {
            await queuedJob.job.failed(error as Error);
          }
        }
      }
    }, interval);
  }

  /**
   * Stop the worker
   */
  stopWorker(): void {
    if (this.worker) {
      clearInterval(this.worker);
      this.worker = null;
    }
  }

  /**
   * Process a single job from the queue
   */
  async processNext(queueName?: string): Promise<boolean> {
    const queuedJob = await this.driver.pop(queueName ?? this.defaultQueue);
    if (!queuedJob) {
      return false;
    }

    try {
      await queuedJob.job.handle();
      await this.driver.delete(queuedJob.id);
      return true;
    } catch (error) {
      queuedJob.attempts++;

      // Check if we should retry
      const maxAttempts =
        queuedJob.job instanceof BaseJob ? queuedJob.job.tries : 3;

      if (queuedJob.attempts < maxAttempts) {
        // Re-queue the job with retry delay
        const retryAfter =
          queuedJob.job instanceof BaseJob ? queuedJob.job.retryAfter : 60;
        await this.driver.pushQueued(queuedJob, retryAfter);
      } else {
        // Max attempts reached, call failed handler
        if (queuedJob.job.failed) {
          await queuedJob.job.failed(error as Error);
        }
      }

      return false;
    }
  }

  /**
   * Get the driver instance
   */
  getDriver(): QueueDriver {
    return this.driver;
  }
}

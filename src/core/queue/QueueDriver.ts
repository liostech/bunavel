import type { Job } from "./Job";

export interface QueuedJob {
  id: string;
  job: Job;
  attempts: number;
  availableAt: number;
  queueName: string;
}

/**
 * Queue driver interface
 */
export interface QueueDriver {
  /**
   * Push a job onto the queue
   */
  push(job: Job, queueName?: string, delay?: number): Promise<string>;

  /**
   * Push a queued job back onto the queue (for retries)
   */
  pushQueued(queuedJob: QueuedJob, delay?: number): Promise<string>;

  /**
   * Push multiple jobs onto the queue
   */
  pushMany(jobs: Job[], queueName?: string): Promise<string[]>;

  /**
   * Pop the next job off the queue
   */
  pop(queueName?: string): Promise<QueuedJob | null>;

  /**
   * Delete a job from the queue
   */
  delete(id: string): Promise<boolean>;

  /**
   * Get the size of the queue
   */
  size(queueName?: string): Promise<number>;

  /**
   * Clear all jobs from the queue
   */
  clear(queueName?: string): Promise<void>;
}

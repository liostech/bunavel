import type { Job } from "./Job";
import type { QueueDriver, QueuedJob } from "./QueueDriver";

/**
 * Memory queue driver
 * Stores jobs in memory with support for delayed execution
 */
export class MemoryQueueDriver implements QueueDriver {
  private queues: Map<string, QueuedJob[]> = new Map();
  private jobCounter: number = 0;

  /**
   * Push a job onto the queue
   */
  async push(job: Job, queueName: string = "default", delay: number = 0): Promise<string> {
    const id = `mem-${++this.jobCounter}`;
    const availableAt = Date.now() + delay * 1000;

    const queuedJob: QueuedJob = {
      id,
      job,
      attempts: 0,
      availableAt,
      queueName,
    };

    if (!this.queues.has(queueName)) {
      this.queues.set(queueName, []);
    }

    this.queues.get(queueName)!.push(queuedJob);
    return id;
  }

  /**
   * Push a queued job back onto the queue (for retries)
   */
  async pushQueued(queuedJob: QueuedJob, delay: number = 0): Promise<string> {
    queuedJob.availableAt = Date.now() + delay * 1000;

    if (!this.queues.has(queuedJob.queueName)) {
      this.queues.set(queuedJob.queueName, []);
    }

    this.queues.get(queuedJob.queueName)!.push(queuedJob);
    return queuedJob.id;
  }

  /**
   * Push multiple jobs onto the queue
   */
  async pushMany(jobs: Job[], queueName: string = "default"): Promise<string[]> {
    const ids: string[] = [];
    for (const job of jobs) {
      const id = await this.push(job, queueName);
      ids.push(id);
    }
    return ids;
  }

  /**
   * Pop the next job off the queue
   * Returns only jobs that are available (availableAt <= now)
   */
  async pop(queueName: string = "default"): Promise<QueuedJob | null> {
    const queue = this.queues.get(queueName);
    if (!queue || queue.length === 0) {
      return null;
    }

    const now = Date.now();
    const availableIndex = queue.findIndex((job) => job.availableAt <= now);

    if (availableIndex === -1) {
      return null;
    }

    const job = queue[availableIndex];
    queue.splice(availableIndex, 1);
    return job ?? null;
  }

  /**
   * Delete a job from the queue
   */
  async delete(id: string): Promise<boolean> {
    for (const queue of this.queues.values()) {
      const index = queue.findIndex((job) => job.id === id);
      if (index !== -1) {
        queue.splice(index, 1);
        return true;
      }
    }
    return false;
  }

  /**
   * Get the size of the queue
   */
  async size(queueName?: string): Promise<number> {
    if (queueName) {
      return this.queues.get(queueName)?.length ?? 0;
    }

    // Return total size of all queues
    let total = 0;
    for (const queue of this.queues.values()) {
      total += queue.length;
    }
    return total;
  }

  /**
   * Clear all jobs from the queue
   */
  async clear(queueName?: string): Promise<void> {
    if (queueName) {
      this.queues.delete(queueName);
    } else {
      this.queues.clear();
    }
  }

  /**
   * Get all queued jobs (for testing/debugging)
   */
  getQueuedJobs(queueName: string = "default"): QueuedJob[] {
    return this.queues.get(queueName) ?? [];
  }
}

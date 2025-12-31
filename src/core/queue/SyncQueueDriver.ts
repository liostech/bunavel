import type { Job } from "./Job";
import type { QueueDriver, QueuedJob } from "./QueueDriver";

/**
 * Sync queue driver
 * Executes jobs immediately (synchronously)
 */
export class SyncQueueDriver implements QueueDriver {
  /**
   * Push a job onto the queue (executes immediately)
   */
  async push(job: Job, queueName?: string, delay?: number): Promise<string> {
    // If delayed, schedule it
    if (delay && delay > 0) {
      setTimeout(async () => {
        await this.executeJob(job);
      }, delay * 1000);
      return "delayed-" + Date.now();
    }

    // Execute immediately
    await this.executeJob(job);
    return "sync-" + Date.now();
  }

  /**
   * Push a queued job back onto the queue (for retries)
   */
  async pushQueued(queuedJob: QueuedJob, delay?: number): Promise<string> {
    return this.push(queuedJob.job, queuedJob.queueName, delay);
  }

  /**
   * Push multiple jobs onto the queue
   */
  async pushMany(jobs: Job[], queueName?: string): Promise<string[]> {
    const ids: string[] = [];
    for (const job of jobs) {
      const id = await this.push(job, queueName);
      ids.push(id);
    }
    return ids;
  }

  /**
   * Pop the next job off the queue (not applicable for sync)
   */
  async pop(queueName?: string): Promise<QueuedJob | null> {
    return null;
  }

  /**
   * Delete a job from the queue (not applicable for sync)
   */
  async delete(id: string): Promise<boolean> {
    return true;
  }

  /**
   * Get the size of the queue (always 0 for sync)
   */
  async size(queueName?: string): Promise<number> {
    return 0;
  }

  /**
   * Clear all jobs from the queue (not applicable for sync)
   */
  async clear(queueName?: string): Promise<void> {
    // Nothing to clear
  }

  /**
   * Execute a job
   */
  private async executeJob(job: Job): Promise<void> {
    try {
      await job.handle();
    } catch (error) {
      if (job.failed) {
        await job.failed(error as Error);
      } else {
        console.error("Job failed:", error);
      }
    }
  }
}

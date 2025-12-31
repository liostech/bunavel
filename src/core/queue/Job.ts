/**
 * Job interface
 * All jobs should implement this interface
 */
export interface Job {
  /**
   * Handle the job
   */
  handle(): void | Promise<void>;

  /**
   * Handle job failure
   */
  failed?(error: Error): void | Promise<void>;
}

/**
 * Base Job class
 */
export abstract class BaseJob implements Job {
  /**
   * Number of times to retry the job
   */
  public tries: number = 3;

  /**
   * Number of seconds to delay before retrying
   */
  public retryAfter: number = 60;

  /**
   * Handle the job
   */
  abstract handle(): void | Promise<void>;

  /**
   * Handle job failure
   */
  async failed?(error: Error): Promise<void>;
}

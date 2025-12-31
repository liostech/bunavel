/**
 * Base Event class
 * All events should extend this class
 */
export abstract class Event {
  /**
   * The time the event occurred
   */
  public readonly timestamp: number;

  constructor() {
    this.timestamp = Date.now();
  }
}

import type { Event } from "./Event";

/**
 * Event listener interface
 */
export interface Listener<T extends Event = Event> {
  /**
   * Handle the event
   */
  handle(event: T): void | Promise<void>;
}

/**
 * Base Listener class
 */
export abstract class BaseListener<T extends Event = Event> implements Listener<T> {
  /**
   * Handle the event
   */
  abstract handle(event: T): void | Promise<void>;
}

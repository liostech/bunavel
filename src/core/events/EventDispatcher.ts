import type { Event } from "./Event";
import type { Listener } from "./Listener";

type EventConstructor<T extends Event = Event> = new (...args: any[]) => T;
type ListenerConstructor<T extends Event = Event> = new (...args: any[]) => Listener<T>;

/**
 * Event Dispatcher
 * Manages event listeners and dispatches events
 */
export class EventDispatcher {
  private listeners: Map<string, Array<Listener<any> | ListenerConstructor<any>>> = new Map();
  private wildcardListeners: Array<Listener<any>> = [];

  /**
   * Register an event listener
   */
  listen<T extends Event>(
    event: EventConstructor<T> | string,
    listener: Listener<T> | ListenerConstructor<T> | ((event: T) => void | Promise<void>)
  ): void {
    const eventName = typeof event === "string" ? event : event.name;

    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }

    // If listener is a function, wrap it in a listener object
    let listenerInstance: Listener<T> | ListenerConstructor<T>;
    if (typeof listener === "function" && listener.prototype?.handle === undefined) {
      const fn = listener as (event: T) => void | Promise<void>;
      listenerInstance = {
        handle: fn,
      } as Listener<T>;
    } else {
      listenerInstance = listener as Listener<T> | ListenerConstructor<T>;
    }

    this.listeners.get(eventName)!.push(listenerInstance);
  }

  /**
   * Register multiple listeners for an event
   */
  listenMany<T extends Event>(
    event: EventConstructor<T> | string,
    listeners: Array<Listener<T> | ListenerConstructor<T> | ((event: T) => void | Promise<void>)>
  ): void {
    for (const listener of listeners) {
      this.listen(event, listener);
    }
  }

  /**
   * Register a wildcard listener that listens to all events
   */
  listenAll(listener: Listener<any> | ((event: Event) => void | Promise<void>)): void {
    // If listener is a function, wrap it in a listener object
    if (typeof listener === "function") {
      const fn = listener as (event: Event) => void | Promise<void>;
      listener = {
        handle: fn,
      } as Listener<Event>;
    }

    this.wildcardListeners.push(listener);
  }

  /**
   * Dispatch an event to all registered listeners
   */
  async dispatch<T extends Event>(event: T | EventConstructor<T>, payload?: any): Promise<void> {
    let eventInstance: T;
    let eventName: string;

    // Handle both event instances and event constructors
    if (typeof event === "function") {
      eventInstance = new event(payload);
      eventName = event.name;
    } else {
      eventInstance = event;
      eventName = event.constructor.name;
    }

    // Get listeners for this specific event
    const eventListeners = this.listeners.get(eventName) || [];

    // Call all registered listeners
    for (const listener of eventListeners) {
      try {
        // If listener is a constructor, instantiate it
        if (typeof listener === "function" && listener.prototype?.handle !== undefined) {
          const listenerInstance = new (listener as ListenerConstructor<T>)();
          await listenerInstance.handle(eventInstance);
        } else {
          await (listener as Listener<T>).handle(eventInstance);
        }
      } catch (error) {
        console.error(`Error handling event ${eventName}:`, error);
      }
    }

    // Call wildcard listeners
    for (const listener of this.wildcardListeners) {
      try {
        await listener.handle(eventInstance);
      } catch (error) {
        console.error(`Error in wildcard listener for event ${eventName}:`, error);
      }
    }
  }

  /**
   * Dispatch an event synchronously (fire and forget)
   */
  fire<T extends Event>(event: T | EventConstructor<T>, payload?: any): void {
    this.dispatch(event, payload).catch((error) => {
      console.error("Error dispatching event:", error);
    });
  }

  /**
   * Remove all listeners for an event
   */
  forget(event: EventConstructor<Event> | string): void {
    const eventName = typeof event === "string" ? event : event.name;
    this.listeners.delete(eventName);
  }

  /**
   * Remove all registered listeners
   */
  flush(): void {
    this.listeners.clear();
    this.wildcardListeners = [];
  }

  /**
   * Check if an event has listeners
   */
  hasListeners(event: EventConstructor<Event> | string): boolean {
    const eventName = typeof event === "string" ? event : event.name;
    return (this.listeners.get(eventName)?.length ?? 0) > 0 || this.wildcardListeners.length > 0;
  }

  /**
   * Get all listeners for an event
   */
  getListeners(event: EventConstructor<Event> | string): Array<Listener<any> | ListenerConstructor<any>> {
    const eventName = typeof event === "string" ? event : event.name;
    return this.listeners.get(eventName) || [];
  }
}

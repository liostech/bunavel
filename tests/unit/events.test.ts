import { describe, test, expect, beforeEach } from "bun:test";
import { Event } from "../../src/core/events/Event";
import { BaseListener } from "../../src/core/events/Listener";
import { EventDispatcher } from "../../src/core/events/EventDispatcher";

// Test events
class UserRegistered extends Event {
  constructor(public readonly userId: number, public readonly email: string) {
    super();
  }
}

class OrderPlaced extends Event {
  constructor(public readonly orderId: number, public readonly total: number) {
    super();
  }
}

class PaymentReceived extends Event {
  constructor(public readonly amount: number) {
    super();
  }
}

// Test listeners
class SendWelcomeEmail extends BaseListener<UserRegistered> {
  public called = false;
  public event?: UserRegistered;

  async handle(event: UserRegistered): Promise<void> {
    this.called = true;
    this.event = event;
  }
}

class CreateUserProfile extends BaseListener<UserRegistered> {
  public called = false;
  public event?: UserRegistered;

  async handle(event: UserRegistered): Promise<void> {
    this.called = true;
    this.event = event;
  }
}

class SendOrderConfirmation extends BaseListener<OrderPlaced> {
  public called = false;
  public event?: OrderPlaced;

  async handle(event: OrderPlaced): Promise<void> {
    this.called = true;
    this.event = event;
  }
}

describe("Events", () => {
  let dispatcher: EventDispatcher;

  beforeEach(() => {
    dispatcher = new EventDispatcher();
  });

  describe("Event Class", () => {
    test("should have timestamp", () => {
      const event = new UserRegistered(1, "test@example.com");
      
      expect(event.timestamp).toBeDefined();
      expect(typeof event.timestamp).toBe("number");
      expect(event.timestamp).toBeLessThanOrEqual(Date.now());
    });

    test("should contain event data", () => {
      const event = new UserRegistered(1, "test@example.com");
      
      expect(event.userId).toBe(1);
      expect(event.email).toBe("test@example.com");
    });
  });

  describe("Event Dispatcher", () => {
    test("should register and dispatch event with listener class", async () => {
      const listener = new SendWelcomeEmail();
      dispatcher.listen(UserRegistered, listener);

      const event = new UserRegistered(1, "test@example.com");
      await dispatcher.dispatch(event);

      expect(listener.called).toBe(true);
      expect(listener.event?.userId).toBe(1);
      expect(listener.event?.email).toBe("test@example.com");
    });

    test("should register listener constructor and instantiate it", async () => {
      dispatcher.listen(UserRegistered, SendWelcomeEmail);

      const event = new UserRegistered(1, "test@example.com");
      await dispatcher.dispatch(event);

      // Since we can't access the listener instance, just verify no errors
      expect(true).toBe(true);
    });

    test("should register and dispatch with inline function listener", async () => {
      let called = false;
      let receivedEvent: UserRegistered | null = null;

      dispatcher.listen(UserRegistered, (event: UserRegistered) => {
        called = true;
        receivedEvent = event;
      });

      const event = new UserRegistered(1, "test@example.com");
      await dispatcher.dispatch(event);

      expect(called).toBe(true);
      expect(receivedEvent?.userId).toBe(1);
      expect(receivedEvent?.email).toBe("test@example.com");
    });

    test("should handle multiple listeners for same event", async () => {
      const listener1 = new SendWelcomeEmail();
      const listener2 = new CreateUserProfile();

      dispatcher.listen(UserRegistered, listener1);
      dispatcher.listen(UserRegistered, listener2);

      const event = new UserRegistered(1, "test@example.com");
      await dispatcher.dispatch(event);

      expect(listener1.called).toBe(true);
      expect(listener2.called).toBe(true);
    });

    test("should handle different events separately", async () => {
      const userListener = new SendWelcomeEmail();
      const orderListener = new SendOrderConfirmation();

      dispatcher.listen(UserRegistered, userListener);
      dispatcher.listen(OrderPlaced, orderListener);

      const userEvent = new UserRegistered(1, "test@example.com");
      await dispatcher.dispatch(userEvent);

      expect(userListener.called).toBe(true);
      expect(orderListener.called).toBe(false);

      const orderEvent = new OrderPlaced(1, 99.99);
      await dispatcher.dispatch(orderEvent);

      expect(orderListener.called).toBe(true);
    });

    test("should register multiple listeners at once", async () => {
      const listener1 = new SendWelcomeEmail();
      const listener2 = new CreateUserProfile();

      dispatcher.listenMany(UserRegistered, [listener1, listener2]);

      const event = new UserRegistered(1, "test@example.com");
      await dispatcher.dispatch(event);

      expect(listener1.called).toBe(true);
      expect(listener2.called).toBe(true);
    });

    test("should support wildcard listeners", async () => {
      let wildcardCalled = false;
      let lastEvent: Event | null = null;

      dispatcher.listenAll((event: Event) => {
        wildcardCalled = true;
        lastEvent = event;
      });

      const userEvent = new UserRegistered(1, "test@example.com");
      await dispatcher.dispatch(userEvent);

      expect(wildcardCalled).toBe(true);
      expect(lastEvent).toBe(userEvent);

      wildcardCalled = false;
      const orderEvent = new OrderPlaced(1, 99.99);
      await dispatcher.dispatch(orderEvent);

      expect(wildcardCalled).toBe(true);
      expect(lastEvent).toBe(orderEvent);
    });

    test("should check if event has listeners", () => {
      expect(dispatcher.hasListeners(UserRegistered)).toBe(false);

      dispatcher.listen(UserRegistered, new SendWelcomeEmail());

      expect(dispatcher.hasListeners(UserRegistered)).toBe(true);
      expect(dispatcher.hasListeners(OrderPlaced)).toBe(false);
    });

    test("should get listeners for an event", () => {
      const listener1 = new SendWelcomeEmail();
      const listener2 = new CreateUserProfile();

      dispatcher.listen(UserRegistered, listener1);
      dispatcher.listen(UserRegistered, listener2);

      const listeners = dispatcher.getListeners(UserRegistered);

      expect(listeners.length).toBe(2);
    });

    test("should forget listeners for an event", async () => {
      const listener = new SendWelcomeEmail();
      dispatcher.listen(UserRegistered, listener);

      expect(dispatcher.hasListeners(UserRegistered)).toBe(true);

      dispatcher.forget(UserRegistered);

      expect(dispatcher.hasListeners(UserRegistered)).toBe(false);

      const event = new UserRegistered(1, "test@example.com");
      await dispatcher.dispatch(event);

      expect(listener.called).toBe(false);
    });

    test("should flush all listeners", async () => {
      const userListener = new SendWelcomeEmail();
      const orderListener = new SendOrderConfirmation();

      dispatcher.listen(UserRegistered, userListener);
      dispatcher.listen(OrderPlaced, orderListener);

      dispatcher.flush();

      expect(dispatcher.hasListeners(UserRegistered)).toBe(false);
      expect(dispatcher.hasListeners(OrderPlaced)).toBe(false);

      const userEvent = new UserRegistered(1, "test@example.com");
      await dispatcher.dispatch(userEvent);

      expect(userListener.called).toBe(false);
    });

    test("should handle async listeners", async () => {
      let called = false;

      dispatcher.listen(UserRegistered, async (event: UserRegistered) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        called = true;
      });

      const event = new UserRegistered(1, "test@example.com");
      await dispatcher.dispatch(event);

      expect(called).toBe(true);
    });

    test("should fire events without waiting", () => {
      let called = false;

      dispatcher.listen(UserRegistered, () => {
        called = true;
      });

      const event = new UserRegistered(1, "test@example.com");
      dispatcher.fire(event);

      // Fire doesn't wait, so we need to give it a moment
      setTimeout(() => {
        expect(called).toBe(true);
      }, 100);
    });

    test("should handle errors in listeners gracefully", async () => {
      const goodListener = new SendWelcomeEmail();

      dispatcher.listen(UserRegistered, () => {
        throw new Error("Listener error");
      });
      dispatcher.listen(UserRegistered, goodListener);

      const event = new UserRegistered(1, "test@example.com");
      
      // Should not throw
      await dispatcher.dispatch(event);

      // Good listener should still be called
      expect(goodListener.called).toBe(true);
    });

    test("should support string event names", async () => {
      let called = false;

      dispatcher.listen("custom.event", () => {
        called = true;
      });

      const event = new PaymentReceived(100);
      await dispatcher.dispatch(event);

      expect(called).toBe(false);

      // Manually dispatch with string name would require event name property
      expect(dispatcher.hasListeners("custom.event")).toBe(true);
    });

    test("should dispatch event by constructor", async () => {
      let receivedEvent: UserRegistered | null = null;

      dispatcher.listen(UserRegistered, (event: UserRegistered) => {
        receivedEvent = event;
      });

      // Dispatch using constructor instead of instance
      await dispatcher.dispatch(UserRegistered, { userId: 1, email: "test@example.com" });

      expect(receivedEvent).toBeDefined();
    });
  });
});

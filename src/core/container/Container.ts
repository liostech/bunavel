type Factory<T> = () => T;

export class Container {
  private bindings: Map<string, Factory<any>> = new Map();
  private instances: Map<string, any> = new Map();
  private singletons: Set<string> = new Set();

  /**
   * Register a binding in the container
   */
  public bind<T>(key: string, factory: Factory<T>): void {
    this.bindings.set(key, factory);
  }

  /**
   * Register a singleton binding in the container
   */
  public singleton<T>(key: string, factory: Factory<T>): void {
    this.bind(key, factory);
    this.singletons.add(key);
  }

  /**
   * Resolve a binding from the container
   */
  public make<T>(key: string): T {
    // Return cached instance if singleton
    if (this.singletons.has(key) && this.instances.has(key)) {
      return this.instances.get(key) as T;
    }

    // Get factory
    const factory = this.bindings.get(key);
    if (!factory) {
      throw new Error(`No binding found for key: ${key}`);
    }

    // Create instance
    const instance = factory();

    // Cache if singleton
    if (this.singletons.has(key)) {
      this.instances.set(key, instance);
    }

    return instance as T;
  }

  /**
   * Check if a binding exists
   */
  public has(key: string): boolean {
    return this.bindings.has(key);
  }

  /**
   * Remove a binding
   */
  public forget(key: string): void {
    this.bindings.delete(key);
    this.instances.delete(key);
    this.singletons.delete(key);
  }

  /**
   * Get all registered bindings
   */
  public getBindings(): string[] {
    return Array.from(this.bindings.keys());
  }
}

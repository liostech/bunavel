import type { Model } from "../database/Model";
import { Hash } from "../support/Hash";
import type { UserProvider } from "./UserProvider";

export interface EloquentUserProviderOptions {
  usernameField?: string;
  passwordField?: string;
}

/**
 * Default UserProvider, backed by any Bunavel Model subclass
 */
export class EloquentUserProvider<TUser extends Model = Model> implements UserProvider<TUser> {
  private modelClass: typeof Model;
  private usernameField: string;
  private passwordField: string;

  constructor(modelClass: typeof Model, options: EloquentUserProviderOptions = {}) {
    this.modelClass = modelClass;
    this.usernameField = options.usernameField ?? "email";
    this.passwordField = options.passwordField ?? "password";
  }

  public retrieveById(id: string | number): TUser | null {
    return this.modelClass.find<TUser>(id);
  }

  public retrieveByCredentials(credentials: Record<string, any>): TUser | null {
    const value = credentials[this.usernameField];
    if (value === undefined) {
      return null;
    }

    const row = this.modelClass.where(this.usernameField, "=", value).first();
    return row ? this.modelClass.hydrate<TUser>(row) : null;
  }

  public async validateCredentials(user: TUser, credentials: Record<string, any>): Promise<boolean> {
    const hashed = user.get(this.passwordField);
    if (!hashed) {
      return false;
    }
    return Hash.check(credentials.password, hashed);
  }
}

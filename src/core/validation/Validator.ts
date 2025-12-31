export type ValidationRule = 
  | "required"
  | "email"
  | "string"
  | "number"
  | "boolean"
  | "array"
  | "object"
  | "url"
  | { min: number }
  | { max: number }
  | { pattern: RegExp }
  | { in: any[] }
  | { custom: (value: any) => boolean | Promise<boolean> };

export interface ValidationRules {
  [field: string]: ValidationRule[];
}

export interface ValidationErrors {
  [field: string]: string[];
}

export class Validator {
  private data: Record<string, any>;
  private rules: ValidationRules;
  private errors: ValidationErrors = {};
  private customMessages: Record<string, string> = {};

  constructor(data: Record<string, any>, rules: ValidationRules, customMessages?: Record<string, string>) {
    this.data = data;
    this.rules = rules;
    if (customMessages) {
      this.customMessages = customMessages;
    }
  }

  /**
   * Validate the data
   */
  public async validate(): Promise<boolean> {
    this.errors = {};

    for (const [field, rules] of Object.entries(this.rules)) {
      const value = this.data[field];

      for (const rule of rules) {
        const isValid = await this.validateRule(field, value, rule);
        if (!isValid) {
          break; // Stop validating this field on first error
        }
      }
    }

    return Object.keys(this.errors).length === 0;
  }

  /**
   * Validate a single rule
   */
  private async validateRule(field: string, value: any, rule: ValidationRule): Promise<boolean> {
    if (rule === "required") {
      if (value === undefined || value === null || value === "") {
        this.addError(field, this.getMessage(field, "required", "The {field} field is required."));
        return false;
      }
    } else if (rule === "email") {
      if (value && !this.isEmail(value)) {
        this.addError(field, this.getMessage(field, "email", "The {field} must be a valid email address."));
        return false;
      }
    } else if (rule === "string") {
      if (value !== undefined && typeof value !== "string") {
        this.addError(field, this.getMessage(field, "string", "The {field} must be a string."));
        return false;
      }
    } else if (rule === "number") {
      if (value !== undefined && typeof value !== "number") {
        this.addError(field, this.getMessage(field, "number", "The {field} must be a number."));
        return false;
      }
    } else if (rule === "boolean") {
      if (value !== undefined && typeof value !== "boolean") {
        this.addError(field, this.getMessage(field, "boolean", "The {field} must be a boolean."));
        return false;
      }
    } else if (rule === "array") {
      if (value !== undefined && !Array.isArray(value)) {
        this.addError(field, this.getMessage(field, "array", "The {field} must be an array."));
        return false;
      }
    } else if (rule === "object") {
      if (value !== undefined && (typeof value !== "object" || Array.isArray(value))) {
        this.addError(field, this.getMessage(field, "object", "The {field} must be an object."));
        return false;
      }
    } else if (rule === "url") {
      if (value && !this.isUrl(value)) {
        this.addError(field, this.getMessage(field, "url", "The {field} must be a valid URL."));
        return false;
      }
    } else if (typeof rule === "object") {
      if ("min" in rule) {
        if (value !== undefined) {
          const length = typeof value === "string" ? value.length : value;
          if (length < rule.min) {
            this.addError(field, this.getMessage(field, "min", `The {field} must be at least ${rule.min}.`));
            return false;
          }
        }
      } else if ("max" in rule) {
        if (value !== undefined) {
          const length = typeof value === "string" ? value.length : value;
          if (length > rule.max) {
            this.addError(field, this.getMessage(field, "max", `The {field} must not exceed ${rule.max}.`));
            return false;
          }
        }
      } else if ("pattern" in rule) {
        if (value && !rule.pattern.test(value)) {
          this.addError(field, this.getMessage(field, "pattern", "The {field} format is invalid."));
          return false;
        }
      } else if ("in" in rule) {
        if (value !== undefined && !rule.in.includes(value)) {
          this.addError(field, this.getMessage(field, "in", `The {field} must be one of: ${rule.in.join(", ")}.`));
          return false;
        }
      } else if ("custom" in rule) {
        const isValid = await rule.custom(value);
        if (!isValid) {
          this.addError(field, this.getMessage(field, "custom", "The {field} is invalid."));
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Add an error message
   */
  private addError(field: string, message: string): void {
    if (!this.errors[field]) {
      this.errors[field] = [];
    }
    this.errors[field]!.push(message);
  }

  /**
   * Get error message
   */
  private getMessage(field: string, rule: string, defaultMessage: string): string {
    const customKey = `${field}.${rule}`;
    const message = this.customMessages[customKey] || defaultMessage;
    return message.replace("{field}", field);
  }

  /**
   * Check if value is valid email
   */
  private isEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  /**
   * Check if value is valid URL
   */
  private isUrl(value: string): boolean {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get validation errors
   */
  public getErrors(): ValidationErrors {
    return this.errors;
  }

  /**
   * Check if validation failed
   */
  public fails(): boolean {
    return Object.keys(this.errors).length > 0;
  }

  /**
   * Check if validation passed
   */
  public passes(): boolean {
    return !this.fails();
  }

  /**
   * Get validated data (only fields that passed validation)
   */
  public validated(): Record<string, any> {
    const validatedData: Record<string, any> = {};
    for (const field of Object.keys(this.rules)) {
      if (!this.errors[field]) {
        validatedData[field] = this.data[field];
      }
    }
    return validatedData;
  }
}

/**
 * Helper function to create validator
 */
export function validate(
  data: Record<string, any>,
  rules: ValidationRules,
  customMessages?: Record<string, string>
): Validator {
  return new Validator(data, rules, customMessages);
}

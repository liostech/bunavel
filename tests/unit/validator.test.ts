import { describe, test, expect } from "bun:test";
import { Validator, validate } from "../../src/core/validation/Validator";

describe("Validator", () => {
  describe("Required Rule", () => {
    test("should pass when field is present", async () => {
      const validator = validate({ name: "John" }, { name: ["required"] });
      const isValid = await validator.validate();

      expect(isValid).toBe(true);
      expect(validator.getErrors()).toEqual({});
    });

    test("should fail when field is missing", async () => {
      const validator = validate({}, { name: ["required"] });
      const isValid = await validator.validate();

      expect(isValid).toBe(false);
      expect(validator.getErrors().name).toBeDefined();
    });

    test("should fail when field is null", async () => {
      const validator = validate({ name: null }, { name: ["required"] });
      const isValid = await validator.validate();

      expect(isValid).toBe(false);
    });

    test("should fail when field is empty string", async () => {
      const validator = validate({ name: "" }, { name: ["required"] });
      const isValid = await validator.validate();

      expect(isValid).toBe(false);
    });
  });

  describe("Email Rule", () => {
    test("should pass for valid email", async () => {
      const validator = validate(
        { email: "test@example.com" },
        { email: ["email"] }
      );
      const isValid = await validator.validate();

      expect(isValid).toBe(true);
    });

    test("should fail for invalid email", async () => {
      const validator = validate({ email: "invalid" }, { email: ["email"] });
      const isValid = await validator.validate();

      expect(isValid).toBe(false);
      expect(validator.getErrors().email).toBeDefined();
    });

    test("should pass when field is optional and missing", async () => {
      const validator = validate({}, { email: ["email"] });
      const isValid = await validator.validate();

      expect(isValid).toBe(true);
    });
  });

  describe("Type Rules", () => {
    test("should validate string type", async () => {
      const validator = validate({ name: "John" }, { name: ["string"] });
      expect(await validator.validate()).toBe(true);

      const validator2 = validate({ name: 123 }, { name: ["string"] });
      expect(await validator2.validate()).toBe(false);
    });

    test("should validate number type", async () => {
      const validator = validate({ age: 25 }, { age: ["number"] });
      expect(await validator.validate()).toBe(true);

      const validator2 = validate({ age: "25" }, { age: ["number"] });
      expect(await validator2.validate()).toBe(false);
    });

    test("should validate boolean type", async () => {
      const validator = validate({ active: true }, { active: ["boolean"] });
      expect(await validator.validate()).toBe(true);

      const validator2 = validate({ active: "true" }, { active: ["boolean"] });
      expect(await validator2.validate()).toBe(false);
    });

    test("should validate array type", async () => {
      const validator = validate({ tags: ["a", "b"] }, { tags: ["array"] });
      expect(await validator.validate()).toBe(true);

      const validator2 = validate({ tags: "abc" }, { tags: ["array"] });
      expect(await validator2.validate()).toBe(false);
    });
  });

  describe("Min/Max Rules", () => {
    test("should validate minimum length for string", async () => {
      const validator = validate({ name: "John" }, { name: [{ min: 3 }] });
      expect(await validator.validate()).toBe(true);

      const validator2 = validate({ name: "Jo" }, { name: [{ min: 3 }] });
      expect(await validator2.validate()).toBe(false);
    });

    test("should validate maximum length for string", async () => {
      const validator = validate({ name: "John" }, { name: [{ max: 10 }] });
      expect(await validator.validate()).toBe(true);

      const validator2 = validate(
        { name: "VeryLongName" },
        { name: [{ max: 5 }] }
      );
      expect(await validator2.validate()).toBe(false);
    });

    test("should validate minimum value for number", async () => {
      const validator = validate({ age: 18 }, { age: [{ min: 18 }] });
      expect(await validator.validate()).toBe(true);

      const validator2 = validate({ age: 17 }, { age: [{ min: 18 }] });
      expect(await validator2.validate()).toBe(false);
    });
  });

  describe("Pattern Rule", () => {
    test("should validate pattern match", async () => {
      const validator = validate(
        { username: "john_doe" },
        { username: [{ pattern: /^[a-z_]+$/ }] }
      );
      expect(await validator.validate()).toBe(true);

      const validator2 = validate(
        { username: "John123" },
        { username: [{ pattern: /^[a-z_]+$/ }] }
      );
      expect(await validator2.validate()).toBe(false);
    });
  });

  describe("In Rule", () => {
    test("should validate value is in array", async () => {
      const validator = validate(
        { role: "admin" },
        { role: [{ in: ["admin", "user", "guest"] }] }
      );
      expect(await validator.validate()).toBe(true);

      const validator2 = validate(
        { role: "superadmin" },
        { role: [{ in: ["admin", "user", "guest"] }] }
      );
      expect(await validator2.validate()).toBe(false);
    });
  });

  describe("Custom Rule", () => {
    test("should validate with custom function", async () => {
      const validator = validate(
        { value: 10 },
        { value: [{ custom: (val) => val > 5 }] }
      );
      expect(await validator.validate()).toBe(true);

      const validator2 = validate(
        { value: 3 },
        { value: [{ custom: (val) => val > 5 }] }
      );
      expect(await validator2.validate()).toBe(false);
    });

    test("should support async custom validation", async () => {
      const validator = validate(
        { email: "test@example.com" },
        {
          email: [
            {
              custom: async (val) => {
                // Simulate async check (e.g., database lookup)
                await new Promise((resolve) => setTimeout(resolve, 1));
                return val !== "taken@example.com";
              },
            },
          ],
        }
      );
      expect(await validator.validate()).toBe(true);
    });
  });

  describe("Multiple Rules", () => {
    test("should validate all rules", async () => {
      const validator = validate(
        { email: "test@example.com" },
        { email: ["required", "email", "string"] }
      );
      expect(await validator.validate()).toBe(true);
    });

    test("should fail on first invalid rule", async () => {
      const validator = validate(
        { email: "" },
        { email: ["required", "email"] }
      );
      await validator.validate();

      // Should only have one error (required), not email validation
      expect(validator.getErrors().email?.length).toBe(1);
    });
  });

  describe("Multiple Fields", () => {
    test("should validate multiple fields", async () => {
      const validator = validate(
        { name: "John", email: "john@example.com", age: 25 },
        {
          name: ["required", "string"],
          email: ["required", "email"],
          age: ["required", "number"],
        }
      );
      expect(await validator.validate()).toBe(true);
    });

    test("should collect errors for all invalid fields", async () => {
      const validator = validate(
        { name: "", email: "invalid", age: "not-a-number" },
        {
          name: ["required"],
          email: ["email"],
          age: ["number"],
        }
      );
      await validator.validate();

      const errors = validator.getErrors();
      expect(errors.name).toBeDefined();
      expect(errors.email).toBeDefined();
      expect(errors.age).toBeDefined();
    });
  });

  describe("Helper Methods", () => {
    test("fails() should return true when validation fails", async () => {
      const validator = validate({}, { name: ["required"] });
      await validator.validate();

      expect(validator.fails()).toBe(true);
    });

    test("passes() should return true when validation passes", async () => {
      const validator = validate({ name: "John" }, { name: ["required"] });
      await validator.validate();

      expect(validator.passes()).toBe(true);
    });

    test("validated() should return only validated fields", async () => {
      const validator = validate(
        { name: "John", email: "john@example.com", extra: "field" },
        { name: ["required"], email: ["required", "email"] }
      );
      await validator.validate();

      const validated = validator.validated();
      expect(validated).toEqual({
        name: "John",
        email: "john@example.com",
      });
      expect(validated.extra).toBeUndefined();
    });
  });

  describe("Custom Error Messages", () => {
    test("should use custom error messages", async () => {
      const validator = new Validator(
        { name: "" },
        { name: ["required"] },
        { "name.required": "Please provide your name" }
      );
      await validator.validate();

      const errors = validator.getErrors();
      expect(errors.name?.[0]).toBe("Please provide your name");
    });
  });
});

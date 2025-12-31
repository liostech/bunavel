import { Controller } from "../../src/core/Controller";
import { HttpRequest } from "../../src/core/http/Request";
import { HttpResponse } from "../../src/core/http/Response";
import { validate } from "../../src/core/validation/Validator";
import { User } from "../models/User";

export class AuthController extends Controller {
  /**
   * Register a new user
   */
  public async register(request: Request): Promise<Response> {
    const httpRequest = new HttpRequest(request);
    const body = await httpRequest.json<{ name: string; email: string; password: string }>();

    // Validate input
    const validator = validate(body, {
      name: ["required", "string", { min: 2 }],
      email: ["required", "email"],
      password: ["required", "string", { min: 6 }],
    });

    if (!(await validator.validate())) {
      return HttpResponse.validationError(validator.getErrors());
    }

    // Check if user already exists
    const existingUser = User.findByEmail(body.email);
    if (existingUser) {
      return HttpResponse.error("User with this email already exists", 409);
    }

    // Create user
    const user = new User();
    user.fill({
      name: body.name,
      email: body.email,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    
    await user.setPassword(body.password);
    user.save();

    return HttpResponse.created({
      message: "User registered successfully",
      user: user.toJson(),
    });
  }

  /**
   * Login user
   */
  public async login(request: Request): Promise<Response> {
    const httpRequest = new HttpRequest(request);
    const body = await httpRequest.json<{ email: string; password: string }>();

    // Validate input
    const validator = validate(body, {
      email: ["required", "email"],
      password: ["required", "string"],
    });

    if (!(await validator.validate())) {
      return HttpResponse.validationError(validator.getErrors());
    }

    // Find user
    const user = User.findByEmail(body.email);
    if (!user) {
      return HttpResponse.unauthorized("Invalid credentials");
    }

    // Verify password
    const isValid = await user.verifyPassword(body.password);
    if (!isValid) {
      return HttpResponse.unauthorized("Invalid credentials");
    }

    // Generate token (simple implementation - in production use JWT)
    const token = this.generateToken(user.get("id"));

    return HttpResponse.json({
      message: "Login successful",
      user: user.toJson(),
      token,
    });
  }

  /**
   * Get user profile
   */
  public async profile(request: Request, params: Record<string, string>): Promise<Response> {
    const userId = params.id;
    
    if (!userId) {
      return HttpResponse.error("User ID is required", 400);
    }
    
    const user = User.find(userId);
    if (!user) {
      return HttpResponse.notFound("User not found");
    }

    return HttpResponse.json({
      user: user.toJson(),
    });
  }

  /**
   * Generate authentication token (simple implementation)
   */
  private generateToken(userId: any): string {
    const data = `${userId}:${Date.now()}`;
    const hasher = new Bun.CryptoHasher("sha256");
    hasher.update(data);
    return hasher.digest("hex");
  }
}

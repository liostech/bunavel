import { Controller } from "../../src/core/Controller";
import { HttpRequest } from "../../src/core/http/Request";
import { HttpResponse } from "../../src/core/http/Response";
import { validate } from "../../src/core/validation/Validator";
import { Auth } from "../../src/core/auth/Auth";
import { User } from "../models/User";

export class AuthController extends Controller {
  /**
   * Register a new user
   */
  public async register(request: Request): Promise<Response> {
    const httpRequest = new HttpRequest(request);
    const body = await httpRequest.json<{ name: string; email: string; password: string }>();

    const validator = validate(body, {
      name: ["required", "string", { min: 2 }],
      email: ["required", "email"],
      password: ["required", "string", { min: 6 }],
    });

    if (!(await validator.validate())) {
      return HttpResponse.validationError(validator.getErrors());
    }

    const existingUser = User.findByEmail(body.email);
    if (existingUser) {
      return HttpResponse.error("User with this email already exists", 409);
    }

    const user = new User();
    user.fill({
      name: body.name,
      email: body.email,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await user.setPassword(body.password);
    user.save();

    const token = Auth.login(user);

    return HttpResponse.created({
      message: "User registered successfully",
      user: user.toJson(),
      token,
    });
  }

  /**
   * Login user
   */
  public async login(request: Request): Promise<Response> {
    const httpRequest = new HttpRequest(request);
    const body = await httpRequest.json<{ email: string; password: string }>();

    const validator = validate(body, {
      email: ["required", "email"],
      password: ["required", "string"],
    });

    if (!(await validator.validate())) {
      return HttpResponse.validationError(validator.getErrors());
    }

    const token = await Auth.attempt({ email: body.email, password: body.password });
    if (!token) {
      return HttpResponse.unauthorized("Invalid credentials");
    }

    const user = User.findByEmail(body.email)!;

    return HttpResponse.json({
      message: "Login successful",
      user: user.toJson(),
      token,
    });
  }

  /**
   * Get the currently authenticated user
   */
  public async me(request: Request): Promise<Response> {
    const user = Auth.user(request);
    if (!user) {
      return HttpResponse.unauthorized();
    }

    return HttpResponse.json({ user: user.toJson() });
  }

  /**
   * Log the current user out
   */
  public async logout(request: Request): Promise<Response> {
    Auth.logout(request);
    return HttpResponse.json({ message: "Logged out successfully" });
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
}

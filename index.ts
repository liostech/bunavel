import { Application } from "./src/core/Application";
import { registerRoutes } from "./routes/web";
import { LoggerMiddleware } from "./app/middleware/LoggerMiddleware";

// Create application instance
const app = new Application();

// Configure the application
app.setConfig({
  name: "Bunavel",
  env: "development",
  debug: true,
});

// Register middleware
app.use(new LoggerMiddleware());

// Register routes
registerRoutes(app.getRouter());

// Start the server
const port = Number(process.env.PORT) || 3000;
app.serve(port);

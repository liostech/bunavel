import { Application } from "./src/core/Application";
import { registerRoutes } from "./routes/web";
import { LoggerMiddleware } from "./app/middleware/LoggerMiddleware";
import { DatabaseConnection } from "./src/core/database/Connection";
import { Model } from "./src/core/database/Model";
import { Cache } from "./src/core/cache/Cache";
import { Auth } from "./src/core/auth/Auth";
import { TokenGuard } from "./src/core/auth/TokenGuard";
import { EloquentUserProvider } from "./src/core/auth/EloquentUserProvider";
import { User } from "./app/models/User";

// Create application instance
const app = new Application();

// Configure the application
app.setConfig({
  name: "Bunavel",
  env: "development",
  debug: true,
});

// Connect to the database (run `bun run artisan migrate` first) and
// configure the auth guard
const connection = new DatabaseConnection({
  driver: "sqlite",
  connection: { filename: "./database.sqlite" },
});
connection.connect();
Model.setConnection(connection);

const authCache = new Cache({ driver: "memory" });
Auth.setGuard(new TokenGuard(new EloquentUserProvider(User), authCache));

// Register middleware
app.use(new LoggerMiddleware());

// Register routes
registerRoutes(app.getRouter());

// Start the server
const port = Number(process.env.PORT) || 3000;
app.serve(port);

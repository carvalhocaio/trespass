import { serve } from "@hono/node-server";
import { auth } from "@trespass/auth";
import { env } from "@trespass/env/server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { logger } from "./lib/logger";

import { requireAuth } from "./middleware/auth";
import { issuesRoute } from "./routes/issues";
import { reposRoute } from "./routes/repos";
import { scansRoute } from "./routes/scans";
import { secretsRoute } from "./routes/secrets";
import type { AppEnv } from "./types";

export function createApp() {
  const app = new Hono();

  app.use(honoLogger());
  app.use(
    "/*",
    cors({
      origin: env.CORS_ORIGIN,
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    })
  );

  // Auth handler (Better-Auth handles its own session)
  app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

  // Protected API routes — all require a valid session
  const api = new Hono<AppEnv>().use("/*", requireAuth);

  api.route("/me/secrets", secretsRoute);
  api.route("/repos", reposRoute);
  api.route("/scans", scansRoute);
  api.route("/github", issuesRoute);

  app.route("/api", api);

  app.get("/", (c) => c.text("OK"));
  app.get("/health", (c) => c.json({ ok: true }));

  return app;
}

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "unhandledRejection");
});

process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "uncaughtException");
  process.exit(1);
});

if (process.env.SERVER_STANDALONE === "true") {
  const app = createApp();
  const port = Number(process.env.PORT ?? 3000);
  serve({ fetch: app.fetch, port }, (info) => {
    process.stdout.write(`Server running on http://localhost:${info.port}\n`);
  });
}

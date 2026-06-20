import { serve } from "@hono/node-server";
import { auth } from "@trespass/auth";
import { env } from "@trespass/env/server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { requireAuth } from "./middleware/auth";
import { reposRoute } from "./routes/repos";
import { scansRoute } from "./routes/scans";
import { secretsRoute } from "./routes/secrets";
import type { AppEnv } from "./types";

export function createApp() {
  const app = new Hono();

  app.use(logger());
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

  app.route("/api", api);

  app.get("/", (c) => c.text("OK"));
  app.get("/api/health", (c) => c.json({ ok: true }));

  return app;
}

process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
  process.exit(1);
});

if (process.env.SERVER_STANDALONE === "true") {
  const app = createApp();
  const port = Number(process.env.PORT ?? 3000);
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`Server running on http://localhost:${info.port}`);
  });
}

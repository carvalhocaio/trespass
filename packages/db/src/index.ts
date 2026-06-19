import { env } from "@trespass/env/server";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

// Single shared pool — max 3 to stay within Neon free tier (5 total connections).
// idleTimeoutMillis < Neon's 5-min auto-suspend so we proactively close idle
// connections before Neon drops them, avoiding ETIMEDOUT on reconnect.
// connectionTimeoutMillis gives Neon time to wake from a cold start.
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 3,
  idleTimeoutMillis: 240_000,
  connectionTimeoutMillis: 30_000,
});

export function createDb() {
  return drizzle(pool, { schema });
}

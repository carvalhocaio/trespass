import { auth } from "@trespass/auth";
import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";

import type { AppEnv } from "../types";

/**
 * Validates the Better-Auth session cookie on every /api/* request.
 * Injects `session` and `user` into the Hono context.
 */
export async function requireAuth(
  c: Context<AppEnv>,
  next: Next
): Promise<void> {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session?.user) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  c.set("session", session.session);
  c.set("user", session.user);

  await next();
}

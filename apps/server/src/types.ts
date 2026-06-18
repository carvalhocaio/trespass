import type { auth } from "@trespass/auth";

type AuthSession = typeof auth.$Infer.Session;

/** Hono context variables injected by the requireAuth middleware */
export interface AppEnv {
  Variables: {
    user: AuthSession["user"];
    session: AuthSession["session"];
  };
}

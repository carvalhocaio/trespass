import { createDb } from "@trespass/db";
import {
  account,
  session as sessionTable,
  user,
  verification,
} from "@trespass/db/schema/auth";
import { env } from "@trespass/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

export function createAuth() {
  const db = createDb();

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user, session: sessionTable, account, verification },
    }),
    trustedOrigins: [env.CORS_ORIGIN],
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: {
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
      },
    },
    user: {
      additionalFields: {
        githubId: {
          type: "number",
          required: false,
          input: false,
          fieldName: "githubId",
        },
        githubLogin: {
          type: "string",
          required: false,
          input: false,
          fieldName: "githubLogin",
        },
      },
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    advanced: {
      defaultCookieAttributes: {
        sameSite: "lax",
        secure: true,
        httpOnly: true,
      },
    },
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5,
      },
    },
    // AES-256-GCM, keyed from BETTER_AUTH_SECRET.
    account: {
      encryptOAuthTokens: true,
    },
  });
}

export const auth = createAuth();

export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session;

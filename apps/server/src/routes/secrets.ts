import { createCrypto } from "@trespass/crypto";
import { createDb } from "@trespass/db";
import { userSecret } from "@trespass/db/schema/app";
import { env } from "@trespass/env/server";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { nanoid } from "nanoid";
import { z } from "zod";

import type { AppEnv } from "../types";

const crypto = createCrypto(env.SECRET_ENCRYPTION_KEY);
const db = createDb();

const secretsUpdateSchema = z.object({
  githubPat: z.string().min(1).optional(),
  llmProvider: z.enum(["openai", "anthropic", "google"]).optional(),
  llmApiKey: z.string().min(1).optional(),
  llmModel: z.string().min(1).optional(),
});

export const secretsRoute = new Hono<AppEnv>()
  // GET /api/me/secrets/status — returns flags only, never plaintext
  .get("/status", async (c) => {
    const user = c.get("user");
    const db2 = createDb();

    const [secret] = await db2
      .select()
      .from(userSecret)
      .where(eq(userSecret.userId, user.id))
      .limit(1);

    return c.json({
      hasPat: !!secret?.githubPatEnc,
      hasLlmKey: !!secret?.llmApiKeyEnc,
      llmProvider: secret?.llmProvider ?? null,
      llmModel: secret?.llmModel ?? null,
    });
  })
  // PUT /api/me/secrets — upsert encrypted credentials
  .put("/", async (c) => {
    const user = c.get("user");
    const body = await c.req.json().catch(() => null);
    const parsed = secretsUpdateSchema.safeParse(body);

    if (!parsed.success) {
      throw new HTTPException(400, {
        message: parsed.error.issues[0]?.message ?? "Invalid request body",
      });
    }

    const { githubPat, llmProvider, llmApiKey, llmModel } = parsed.data;

    const [existing] = await db
      .select({ id: userSecret.id })
      .from(userSecret)
      .where(eq(userSecret.userId, user.id))
      .limit(1);

    const patch: Partial<typeof userSecret.$inferInsert> = {};
    if (githubPat !== undefined) {
      patch.githubPatEnc = crypto.encrypt(githubPat);
    }
    if (llmProvider !== undefined) {
      patch.llmProvider = llmProvider;
    }
    if (llmApiKey !== undefined) {
      patch.llmApiKeyEnc = crypto.encrypt(llmApiKey);
    }
    if (llmModel !== undefined) {
      patch.llmModel = llmModel;
    }

    if (existing) {
      await db
        .update(userSecret)
        .set(patch)
        .where(eq(userSecret.userId, user.id));
    } else {
      await db.insert(userSecret).values({
        id: nanoid(),
        userId: user.id,
        ...patch,
      });
    }

    return c.json({ ok: true });
  });

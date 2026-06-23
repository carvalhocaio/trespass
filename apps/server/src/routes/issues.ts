import { createCrypto } from "@trespass/crypto";
import { createDb } from "@trespass/db";
import { userSecret } from "@trespass/db/schema/app";
import { env } from "@trespass/env/server";
import { checkForDuplicateIssue, createOctokit } from "@trespass/github";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import type { AppEnv } from "../types";

const crypto = createCrypto(env.SECRET_ENCRYPTION_KEY);

export const issuesRoute = new Hono<AppEnv>().get(
  "/:owner/:repo/issues/check",
  async (c) => {
    const user = c.get("user");
    const owner = c.req.param("owner");
    const repo = c.req.param("repo");
    const title = c.req.query("title");

    if (!title) {
      throw new HTTPException(400, {
        message: "Missing required query param: title",
      });
    }

    const db = createDb();
    const [secret] = await db
      .select()
      .from(userSecret)
      .where(eq(userSecret.userId, user.id))
      .limit(1);

    if (!secret?.githubPatEnc) {
      return c.json({ duplicate: false, issueNumber: null, issueUrl: null });
    }

    const pat = crypto.decrypt(secret.githubPatEnc);
    const octokit = createOctokit(pat);
    const result = await checkForDuplicateIssue(octokit, owner, repo, title);

    return c.json(result);
  }
);

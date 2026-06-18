import { createCrypto } from "@trespass/crypto";
import { createDb } from "@trespass/db";
import { repository, userSecret } from "@trespass/db/schema/app";
import { env } from "@trespass/env/server";
import { createOctokit, listUserRepos } from "@trespass/github";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { nanoid } from "nanoid";

import type { AppEnv } from "../types";

const crypto = createCrypto(env.SECRET_ENCRYPTION_KEY);

export const reposRoute = new Hono<AppEnv>()
  // GET /api/repos — list repos synced to DB for this user
  .get("/", async (c) => {
    const user = c.get("user");
    const db = createDb();

    const repos = await db
      .select()
      .from(repository)
      .where(eq(repository.userId, user.id))
      .orderBy(repository.updatedAt);

    return c.json(repos);
  })
  // POST /api/repos/sync — fetch repos from GitHub and upsert to DB
  .post("/sync", async (c) => {
    const user = c.get("user");
    const db = createDb();

    const [secret] = await db
      .select()
      .from(userSecret)
      .where(eq(userSecret.userId, user.id))
      .limit(1);

    if (!secret?.githubPatEnc) {
      throw new HTTPException(422, {
        message:
          "GitHub PAT not configured. Add it in Settings before syncing.",
      });
    }

    const pat = crypto.decrypt(secret.githubPatEnc);
    const octokit = createOctokit(pat);
    const githubRepos = await listUserRepos(octokit);

    if (githubRepos.length === 0) {
      return c.json({ synced: 0 });
    }

    await db
      .insert(repository)
      .values(
        githubRepos.map((r) => ({
          id: nanoid(),
          userId: user.id,
          githubId: r.githubId,
          name: r.name,
          fullName: r.fullName,
          description: r.description,
          isPrivate: r.isPrivate,
          defaultBranch: r.defaultBranch,
          language: r.language,
          htmlUrl: r.htmlUrl,
        }))
      )
      .onConflictDoUpdate({
        target: [repository.userId, repository.githubId],
        set: {
          name: repository.name,
          fullName: repository.fullName,
          description: repository.description,
          isPrivate: repository.isPrivate,
          defaultBranch: repository.defaultBranch,
          language: repository.language,
          htmlUrl: repository.htmlUrl,
          updatedAt: new Date(),
        },
      });

    return c.json({ synced: githubRepos.length });
  });

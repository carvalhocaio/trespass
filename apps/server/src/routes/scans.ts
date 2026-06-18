import { createCrypto } from "@trespass/crypto";
import { createDb } from "@trespass/db";
import { finding, repository, scan, userSecret } from "@trespass/db/schema/app";
import { env } from "@trespass/env/server";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { nanoid } from "nanoid";
import { z } from "zod";
import { runScan } from "../services/scanner/index";
import type { AppEnv } from "../types";

const crypto = createCrypto(env.SECRET_ENCRYPTION_KEY);

const createScanSchema = z.object({
  repoId: z.string().min(1),
});

export const scansRoute = new Hono<AppEnv>()
  // GET /api/scans — list all scans for user (most recent first)
  .get("/", async (c) => {
    const user = c.get("user");
    const db = createDb();

    const scans = await db
      .select({
        id: scan.id,
        status: scan.status,
        summary: scan.summary,
        startedAt: scan.startedAt,
        finishedAt: scan.finishedAt,
        createdAt: scan.createdAt,
        repo: {
          id: repository.id,
          name: repository.name,
          fullName: repository.fullName,
        },
      })
      .from(scan)
      .leftJoin(repository, eq(scan.repoId, repository.id))
      .where(eq(scan.userId, user.id))
      .orderBy(desc(scan.createdAt))
      .limit(50);

    return c.json(scans);
  })
  // GET /api/scans/:id — full scan result with findings
  .get("/:id", async (c) => {
    const user = c.get("user");
    const scanId = c.req.param("id");
    const db = createDb();

    const [row] = await db
      .select({
        id: scan.id,
        repoId: scan.repoId,
        status: scan.status,
        progress: scan.progress,
        summary: scan.summary,
        error: scan.error,
        startedAt: scan.startedAt,
        finishedAt: scan.finishedAt,
        repo: {
          fullName: repository.fullName,
          htmlUrl: repository.htmlUrl,
        },
      })
      .from(scan)
      .leftJoin(repository, eq(scan.repoId, repository.id))
      .where(and(eq(scan.id, scanId), eq(scan.userId, user.id)))
      .limit(1);

    if (!row) {
      throw new HTTPException(404, { message: "Scan not found" });
    }

    const findings = await db
      .select()
      .from(finding)
      .where(eq(finding.scanId, scanId))
      .orderBy(finding.severity, finding.file);

    return c.json({ scan: row, findings });
  })
  // POST /api/scans — start a new scan (async — returns immediately)
  .post("/", async (c) => {
    const user = c.get("user");
    const body = await c.req.json().catch(() => null);
    const parsed = createScanSchema.safeParse(body);

    if (!parsed.success) {
      throw new HTTPException(400, {
        message: parsed.error.issues[0]?.message ?? "Invalid request body",
      });
    }

    const db = createDb();

    // Validate repo ownership
    const [repo] = await db
      .select()
      .from(repository)
      .where(
        and(
          eq(repository.id, parsed.data.repoId),
          eq(repository.userId, user.id)
        )
      )
      .limit(1);

    if (!repo) {
      throw new HTTPException(404, { message: "Repository not found" });
    }

    // Load secrets
    const [secret] = await db
      .select()
      .from(userSecret)
      .where(eq(userSecret.userId, user.id))
      .limit(1);

    if (!secret?.githubPatEnc) {
      throw new HTTPException(422, {
        message: "GitHub PAT not configured. Add it in Settings.",
      });
    }

    const pat = crypto.decrypt(secret.githubPatEnc);

    // Build optional LLM config
    const llmConfig =
      secret.llmApiKeyEnc && secret.llmProvider && secret.llmModel
        ? {
            provider: secret.llmProvider,
            apiKey: crypto.decrypt(secret.llmApiKeyEnc),
            model: secret.llmModel,
          }
        : null;

    // Create the scan row
    const scanId = nanoid();
    const [newScan] = await db
      .insert(scan)
      .values({
        id: scanId,
        userId: user.id,
        repoId: repo.id,
        status: "queued",
      })
      .returning();

    // Fire-and-forget — scan runs in background
    const [owner, repoName] = repo.fullName.split("/") as [string, string];
    setImmediate(() => {
      runScan({
        scanId,
        repoId: repo.id,
        userId: user.id,
        owner,
        repoName,
        defaultBranch: repo.defaultBranch,
        pat,
        llmConfig,
      }).catch(async (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        await createDb()
          .update(scan)
          .set({ status: "error", error: message, finishedAt: new Date() })
          .where(eq(scan.id, scanId));
      });
    });

    return c.json({ scan: newScan }, 201);
  });

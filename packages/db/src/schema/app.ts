import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const scanStatusEnum = pgEnum("scan_status", [
  "queued",
  "running",
  "done",
  "error",
]);

export const severityEnum = pgEnum("severity", [
  "critical",
  "high",
  "medium",
  "low",
  "info",
]);

export const findingCategoryEnum = pgEnum("finding_category", [
  "secret",
  "dependency",
  "sast",
  "llm",
]);

export const llmProviderEnum = pgEnum("llm_provider", [
  "openai",
  "anthropic",
  "google",
]);

// ─── userSecret ───────────────────────────────────────────────────────────────
// One row per user. Stores encrypted credentials. Never returned as plaintext.

export const userSecret = pgTable("user_secret", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  // GitHub PAT — AES-256-GCM ciphertext (iv:data:tag). Null = not configured.
  githubPatEnc: text("github_pat_enc"),
  // LLM config — provider + encrypted key + model
  llmProvider: llmProviderEnum("llm_provider"),
  llmApiKeyEnc: text("llm_api_key_enc"),
  llmModel: text("llm_model"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// ─── repository ───────────────────────────────────────────────────────────────

export const repository = pgTable(
  "repository",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    githubId: integer("github_id").notNull(),
    name: text("name").notNull(),
    fullName: text("full_name").notNull(),
    description: text("description"),
    isPrivate: boolean("is_private").default(false).notNull(),
    defaultBranch: text("default_branch").default("main").notNull(),
    language: text("language"),
    htmlUrl: text("html_url").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("repository_userId_githubId_unique").on(
      table.userId,
      table.githubId
    ),
    index("repository_userId_idx").on(table.userId),
  ]
);

// ─── scan ─────────────────────────────────────────────────────────────────────
// One scan = one full security analysis run against one repository.

export const scan = pgTable(
  "scan",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    repoId: text("repo_id")
      .notNull()
      .references(() => repository.id, { onDelete: "cascade" }),
    status: scanStatusEnum("status").default("queued").notNull(),
    progress:
      jsonb("progress").$type<
        {
          detail: null | string;
          key: string;
          label: string;
          status: "done" | "error" | "running" | "warn";
        }[]
      >(),
    // Counts by severity — populated when status = done
    summary: jsonb("summary").$type<{
      critical: number;
      high: number;
      medium: number;
      low: number;
      info: number;
      total: number;
      filesScanned: number;
      llmEnriched: boolean;
    }>(),
    error: text("error"),
    startedAt: timestamp("started_at"),
    finishedAt: timestamp("finished_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("scan_userId_idx").on(table.userId),
    index("scan_repoId_idx").on(table.repoId),
    index("scan_status_idx").on(table.status),
  ]
);

// ─── finding ──────────────────────────────────────────────────────────────────
// One finding = one security issue identified during a scan.

export const finding = pgTable(
  "finding",
  {
    id: text("id").primaryKey(),
    scanId: text("scan_id")
      .notNull()
      .references(() => scan.id, { onDelete: "cascade" }),
    repoId: text("repo_id")
      .notNull()
      .references(() => repository.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    category: findingCategoryEnum("category").notNull(),
    severity: severityEnum("severity").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    // File path relative to repo root
    file: text("file"),
    // 1-indexed line number
    line: integer("line"),
    // Code snippet (max 2KB — enough for context, bounded to prevent abuse)
    snippet: text("snippet"),
    // Remediation advice — may be LLM-generated
    remediation: text("remediation"),
    // Whether this finding was enriched by the LLM reviewer
    llmEnriched: boolean("llm_enriched").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("finding_scanId_idx").on(table.scanId),
    index("finding_userId_idx").on(table.userId),
    index("finding_severity_idx").on(table.severity),
  ]
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const userSecretRelations = relations(userSecret, ({ one }) => ({
  user: one(user, { fields: [userSecret.userId], references: [user.id] }),
}));

export const repositoryRelations = relations(repository, ({ one, many }) => ({
  user: one(user, { fields: [repository.userId], references: [user.id] }),
  scans: many(scan),
}));

export const scanRelations = relations(scan, ({ one, many }) => ({
  user: one(user, { fields: [scan.userId], references: [user.id] }),
  repository: one(repository, {
    fields: [scan.repoId],
    references: [repository.id],
  }),
  findings: many(finding),
}));

export const findingRelations = relations(finding, ({ one }) => ({
  scan: one(scan, { fields: [finding.scanId], references: [scan.id] }),
  repository: one(repository, {
    fields: [finding.repoId],
    references: [repository.id],
  }),
  user: one(user, { fields: [finding.userId], references: [user.id] }),
}));

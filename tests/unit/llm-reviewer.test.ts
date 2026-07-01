import { logger } from "@server/lib/logger";
import { reviewFileWithLlm } from "@server/services/scanner/llm-reviewer";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@server/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    fatal: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

const OPENAI_CONFIG = {
  apiKey: "test-key",
  model: "gpt-4o-mini",
  provider: "openai" as const,
};

describe("reviewFileWithLlm — provider error path", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("degrades gracefully and returns the provider error without throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => "rate limited",
      })
    );

    const result = await reviewFileWithLlm(
      "src/app.ts",
      "const x = 1;",
      OPENAI_CONFIG
    );

    expect(result.findings).toEqual([]);
    expect(result.error).toContain("OpenAI API error");
  });

  it("logs a structured error with provider and status on non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "internal error",
      })
    );

    await reviewFileWithLlm("src/app.ts", "const x = 1;", OPENAI_CONFIG);

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "openai", status: 500 }),
      "LLM API error"
    );
  });
});

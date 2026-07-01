import {
  reviewFileWithLlm,
  UnsupportedModelError,
} from "@server/services/scanner/llm-reviewer";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@server/lib/logger", () => ({
  logger: { error: vi.fn(), fatal: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

type Provider = "openai" | "anthropic" | "google";

function config(provider: Provider, model = "gpt-4o-mini") {
  return { apiKey: "k", model, provider };
}

/** Wraps a findings JSON payload in the given provider's response envelope. */
function providerResponse(provider: Provider, content: string): unknown {
  if (provider === "openai") {
    return { choices: [{ message: { content } }] };
  }
  if (provider === "anthropic") {
    return { content: [{ type: "text", text: content }] };
  }
  return { candidates: [{ content: { parts: [{ text: content }] } }] };
}

function okFetch(body: unknown) {
  return vi.fn().mockResolvedValue({ ok: true, json: async () => body });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("reviewFileWithLlm — parsing and mapping", () => {
  it("maps findings and offsets line numbers (openai)", async () => {
    const payload = JSON.stringify({
      findings: [
        {
          title: "Hardcoded secret",
          severity: "high",
          description: "d",
          line: 5,
          snippet: "s",
          remediation: "r",
        },
        {
          title: "No line",
          severity: "low",
          description: "d",
          line: null,
          remediation: "r",
        },
      ],
    });
    vi.stubGlobal("fetch", okFetch(providerResponse("openai", payload)));

    const result = await reviewFileWithLlm(
      "src/app.ts",
      "const x = 1;",
      config("openai")
    );

    expect(result.error).toBeNull();
    expect(result.findings).toHaveLength(2);
    expect(result.findings[0]).toMatchObject({ line: 5, file: "src/app.ts" });
    expect(result.findings[1]?.line).toBeNull();
    expect(result.findings[1]?.snippet).toBeNull();
  });

  it("strips markdown code fences before parsing", async () => {
    const fenced = `\`\`\`json\n${JSON.stringify({ findings: [] })}\n\`\`\``;
    vi.stubGlobal("fetch", okFetch(providerResponse("openai", fenced)));

    const result = await reviewFileWithLlm("a.ts", "x", config("openai"));
    expect(result.findings).toEqual([]);
    expect(result.error).toBeNull();
  });

  it("returns {} and no findings when the response has no JSON object", async () => {
    vi.stubGlobal("fetch", okFetch(providerResponse("openai", "no json here")));

    const result = await reviewFileWithLlm("a.ts", "x", config("openai"));
    expect(result.findings).toEqual([]);
  });

  it("skips a chunk whose JSON fails schema validation", async () => {
    const bad = JSON.stringify({ findings: [{ title: "missing fields" }] });
    vi.stubGlobal("fetch", okFetch(providerResponse("openai", bad)));

    const result = await reviewFileWithLlm("a.ts", "x", config("openai"));
    expect(result.findings).toEqual([]);
    expect(result.error).toBeNull();
  });

  it("adds a test-file context note without changing behavior", async () => {
    vi.stubGlobal(
      "fetch",
      okFetch(providerResponse("openai", JSON.stringify({ findings: [] })))
    );

    const result = await reviewFileWithLlm(
      "src/__tests__/app.test.ts",
      "x",
      config("openai")
    );
    expect(result.error).toBeNull();
  });

  it("chunks large files and caps at MAX_CHUNKS calls", async () => {
    const fetchMock = okFetch(
      providerResponse("openai", JSON.stringify({ findings: [] }))
    );
    vi.stubGlobal("fetch", fetchMock);

    // 6001 chars/chunk cap × >5 chunks worth of content.
    const content = "a\n".repeat(20_000);
    await reviewFileWithLlm("big.ts", content, config("openai"));

    expect(fetchMock).toHaveBeenCalledTimes(5);
  });
});

describe("reviewFileWithLlm — providers", () => {
  it("parses anthropic text blocks", async () => {
    const payload = JSON.stringify({ findings: [] });
    vi.stubGlobal("fetch", okFetch(providerResponse("anthropic", payload)));

    const result = await reviewFileWithLlm(
      "a.ts",
      "x",
      config("anthropic", "claude-3-5-sonnet")
    );
    expect(result.error).toBeNull();
  });

  it("parses google candidates", async () => {
    const payload = JSON.stringify({ findings: [] });
    vi.stubGlobal("fetch", okFetch(providerResponse("google", payload)));

    const result = await reviewFileWithLlm(
      "a.ts",
      "x",
      config("google", "gemini-1.5-pro")
    );
    expect(result.error).toBeNull();
  });

  it("rejects google model names with URL metacharacters", async () => {
    vi.stubGlobal("fetch", okFetch({}));

    const result = await reviewFileWithLlm(
      "a.ts",
      "x",
      config("google", "../../evil?x=1")
    );
    expect(result.error).toContain("Invalid model identifier");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("captures anthropic HTTP errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => "overloaded",
      })
    );

    const result = await reviewFileWithLlm(
      "a.ts",
      "x",
      config("anthropic", "claude-3-5-sonnet")
    );
    expect(result.error).toContain("Anthropic API error");
  });

  it("captures google HTTP errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => "bad request",
      })
    );

    const result = await reviewFileWithLlm(
      "a.ts",
      "x",
      config("google", "gemini-1.5-pro")
    );
    expect(result.error).toContain("Google Gemini API error");
  });

  it("errors on an unsupported provider", async () => {
    vi.stubGlobal("fetch", okFetch({}));

    const result = await reviewFileWithLlm("a.ts", "x", {
      apiKey: "k",
      model: "m",
      provider: "cohere" as unknown as Provider,
    });
    expect(result.error).toContain("Unsupported LLM provider");
  });

  it("falls back to empty JSON when a provider returns no content", async () => {
    vi.stubGlobal("fetch", okFetch({ choices: [] }));

    const result = await reviewFileWithLlm("a.ts", "x", config("openai"));
    expect(result.findings).toEqual([]);
    expect(result.error).toBeNull();
  });

  it("falls back to empty JSON when anthropic omits a text block", async () => {
    vi.stubGlobal("fetch", okFetch({ content: [{ type: "image" }] }));

    const result = await reviewFileWithLlm(
      "a.ts",
      "x",
      config("anthropic", "claude-3-5-sonnet")
    );
    expect(result.findings).toEqual([]);
  });

  it("falls back to empty JSON when google returns no candidates", async () => {
    vi.stubGlobal("fetch", okFetch({ candidates: [] }));

    const result = await reviewFileWithLlm(
      "a.ts",
      "x",
      config("google", "gemini-1.5-pro")
    );
    expect(result.findings).toEqual([]);
  });

  it("stringifies non-Error rejections", async () => {
    // fetch itself rejects with a non-Error value.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue("plain string failure"));

    const result = await reviewFileWithLlm("a.ts", "x", config("openai"));
    expect(result.error).toBe("plain string failure");
  });
});

describe("UnsupportedModelError", () => {
  it("carries the offending model name", () => {
    const err = new UnsupportedModelError("bad/model");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("UnsupportedModelError");
    expect(err.message).toContain("bad/model");
  });
});

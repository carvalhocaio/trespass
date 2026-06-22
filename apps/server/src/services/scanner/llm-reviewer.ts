import { z } from "zod";

export interface LlmConfig {
  apiKey: string;
  model: string;
  provider: "openai" | "anthropic" | "google";
}

export interface LlmFinding {
  description: string;
  file: string;
  line: number | null;
  remediation: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  snippet: string | null;
  title: string;
}

const llmFindingSchema = z.object({
  title: z.string(),
  severity: z.enum(["critical", "high", "medium", "low", "info"]),
  description: z.string(),
  line: z.number().nullable().optional(),
  snippet: z.string().nullable().optional(),
  remediation: z.string(),
});

const llmResponseSchema = z.object({
  findings: z.array(llmFindingSchema),
});

const LLM_CALL_TIMEOUT_MS = 60_000;

function fetchWithTimeout(
  url: string,
  init: RequestInit,
  ms: number
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() =>
    clearTimeout(timer)
  );
}

const SYSTEM_PROMPT = `You are a senior application security engineer performing a code security review.
Analyze the provided code snippet for security vulnerabilities, anti-patterns, and risks.

You MUST respond with ONLY a valid JSON object in this exact format:
{
  "findings": [
    {
      "title": "Short, specific vulnerability title",
      "severity": "critical|high|medium|low|info",
      "description": "Clear explanation of why this is a security risk",
      "line": <line number or null>,
      "snippet": "Relevant code excerpt (max 150 chars) or null",
      "remediation": "Specific, actionable fix"
    }
  ]
}

Severity guide:
- critical: Direct exploit, data breach risk, RCE, credential exposure
- high: Significant vulnerability with clear attack vector
- medium: Security weakness that increases risk
- low: Minor issue, defense-in-depth
- info: Observation, best practice suggestion

If no vulnerabilities are found, return: {"findings": []}
Return ONLY the JSON — no markdown, no explanation, no code blocks.`;

async function callOpenAI(
  config: LlmConfig,
  userMessage: string
): Promise<string> {
  const res = await fetchWithTimeout(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0.1,
        max_tokens: 2048,
        response_format: { type: "json_object" },
      }),
    },
    LLM_CALL_TIMEOUT_MS
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  return data.choices[0]?.message.content ?? "{}";
}

async function callAnthropic(
  config: LlmConfig,
  userMessage: string
): Promise<string> {
  const res = await fetchWithTimeout(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    },
    LLM_CALL_TIMEOUT_MS
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as {
    content: { type: string; text: string }[];
  };
  return data.content.find((b) => b.type === "text")?.text ?? "{}";
}

async function callGoogle(
  config: LlmConfig,
  userMessage: string
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`;

  const res = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": config.apiKey,
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
        },
      }),
    },
    LLM_CALL_TIMEOUT_MS
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Gemini API error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as {
    candidates: { content: { parts: { text: string }[] } }[];
  };
  return data.candidates[0]?.content.parts[0]?.text ?? "{}";
}

function callLlm(config: LlmConfig, userMessage: string): Promise<string> {
  switch (config.provider) {
    case "openai":
      return callOpenAI(config, userMessage);
    case "anthropic":
      return callAnthropic(config, userMessage);
    case "google":
      return callGoogle(config, userMessage);
    default:
      throw new Error(`Unsupported LLM provider: ${config.provider}`);
  }
}

/** Max characters per file chunk sent to the LLM */
const CHUNK_CHARS = 6000;
/** Max chunks per file — caps LLM calls at ~30 KB per file */
const MAX_CHUNKS = 5;

/**
 * Sends suspicious file content to the configured LLM for security review.
 * Chunks large files to stay within context limits.
 * Returns an empty array if the LLM call fails (graceful degrade).
 */
export async function reviewFileWithLlm(
  filePath: string,
  content: string,
  config: LlmConfig
): Promise<LlmFinding[]> {
  const chunks: string[] = [];
  for (let i = 0; i < content.length; i += CHUNK_CHARS) {
    chunks.push(content.slice(i, i + CHUNK_CHARS));
    if (chunks.length === MAX_CHUNKS) {
      break;
    }
  }

  const findings: LlmFinding[] = [];

  for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
    const chunk = chunks[chunkIdx] ?? "";
    const lineOffset = content
      .slice(0, chunkIdx * CHUNK_CHARS)
      .split("\n").length;

    const userMessage = [
      `File: ${filePath}`,
      `Lines: ${lineOffset}–${lineOffset + chunk.split("\n").length}`,
      "",
      "```",
      chunk,
      "```",
    ].join("\n");

    try {
      const raw = await callLlm(config, userMessage);
      const parsed = llmResponseSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) {
        continue;
      }

      for (const f of parsed.data.findings) {
        findings.push({
          title: f.title,
          severity: f.severity,
          description: f.description,
          file: filePath,
          line: f.line == null ? null : f.line + lineOffset - 1,
          snippet: f.snippet ?? null,
          remediation: f.remediation,
        });
      }
    } catch {
      // Graceful degrade — LLM errors don't fail the whole scan
    }
  }

  return findings;
}

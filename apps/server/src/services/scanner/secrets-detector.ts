export interface SecretMatch {
  description: string;
  inComment: boolean;
  line: number;
  remediation: string;
  severity: "critical" | "high" | "medium" | "low";
  snippet: string;
  title: string;
}

interface SecretPattern {
  description: string;
  name: string;
  regex: RegExp;
  remediation: string;
  severity: SecretMatch["severity"];
}

const PATTERNS: SecretPattern[] = [
  {
    name: "AWS Access Key",
    regex: /\bAKIA[0-9A-Z]{16}\b/,
    severity: "critical",
    description: "AWS Access Key ID found in source code.",
    remediation:
      "Revoke this key immediately at AWS IAM, then use environment variables or AWS Secrets Manager.",
  },
  {
    name: "OpenAI API Key",
    regex: /\bsk-[A-Za-z0-9]{32,}\b/,
    severity: "critical",
    description: "OpenAI API key found in source code.",
    remediation:
      "Revoke at platform.openai.com/api-keys and store the key in environment variables.",
  },
  {
    name: "Anthropic API Key",
    regex: /\bsk-ant-[A-Za-z0-9\-_]{32,}\b/,
    severity: "critical",
    description: "Anthropic API key found in source code.",
    remediation:
      "Revoke at console.anthropic.com and store the key in environment variables.",
  },
  {
    name: "GitHub Personal Access Token",
    regex: /\bghp_[A-Za-z0-9]{36}\b/,
    severity: "critical",
    description: "GitHub Personal Access Token found in source code.",
    remediation:
      "Revoke at github.com/settings/tokens and store using a secrets manager or environment variable.",
  },
  {
    name: "GitHub OAuth Token",
    regex: /\bgho_[A-Za-z0-9]{36}\b/,
    severity: "critical",
    description: "GitHub OAuth token found in source code.",
    remediation: "Revoke at github.com/settings/applications.",
  },
  {
    name: "GitHub Actions Token",
    regex: /\bghs_[A-Za-z0-9]{36}\b/,
    severity: "critical",
    description: "GitHub Actions token found in source code.",
    remediation: "Rotate the token in GitHub Actions secrets.",
  },
  {
    name: "Stripe Secret Key",
    regex: /\bsk_live_[A-Za-z0-9]{24,}\b/,
    severity: "critical",
    description: "Stripe live secret key found in source code.",
    remediation:
      "Revoke at dashboard.stripe.com/apikeys and use environment variables.",
  },
  {
    name: "Stripe Publishable Key",
    regex: /\bpk_live_[A-Za-z0-9]{24,}\b/,
    severity: "medium",
    description: "Stripe live publishable key found in source code.",
    remediation:
      "While publishable keys are less sensitive, avoid committing them. Use environment variables.",
  },
  {
    name: "Google API Key",
    regex: /\bAIza[0-9A-Za-z\-_]{35}\b/,
    severity: "high",
    description: "Google API key found in source code.",
    remediation:
      "Restrict the key in Google Cloud Console and store it in environment variables.",
  },
  {
    name: "Twilio API Key",
    regex: /\bSK[0-9a-fA-F]{32}\b/,
    severity: "critical",
    description: "Twilio API key found in source code.",
    remediation: "Revoke at console.twilio.com and store in env vars.",
  },
  {
    name: "PEM Private Key",
    regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
    severity: "critical",
    description: "Private key (PEM format) found in source code.",
    remediation:
      "Revoke and regenerate this key pair. Never commit private keys. Store them in a secrets manager.",
  },
  {
    name: "Generic Password Assignment",
    regex: /(?:password|passwd|pwd)\s*[=:]\s*['"][^'"]{6,}['"]/i,
    severity: "high",
    description: "Hardcoded password found in source code.",
    remediation:
      "Remove the password and use environment variables or a secrets manager.",
  },
  {
    name: "Generic Secret Assignment",
    regex: /(?:secret|api_key|apikey|access_token)\s*[=:]\s*['"][^'"]{8,}['"]/i,
    severity: "high",
    description: "Hardcoded secret or API key found in source code.",
    remediation: "Use environment variables or a dedicated secrets manager.",
  },
  {
    name: "Database Connection String",
    regex: /(?:postgres|mysql|mongodb|redis):\/\/[^:]+:[^@]+@[a-zA-Z0-9.\-_]+/i,
    severity: "critical",
    description: "Database connection string with credentials found in source.",
    remediation:
      "Remove credentials from the connection string and use environment variables.",
  },
  {
    name: "JWT Secret",
    regex: /jwt[_-]?secret\s*[=:]\s*['"][^'"]{8,}['"]/i,
    severity: "high",
    description: "JWT secret found in source code.",
    remediation:
      "Use a randomly generated secret from environment variables. Rotate the existing secret.",
  },
  {
    name: "Slack Token",
    regex: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/,
    severity: "critical",
    description: "Slack token found in source code.",
    remediation: "Revoke at api.slack.com/apps and store in environment vars.",
  },
  {
    name: "Cloudinary URL",
    regex: /cloudinary:\/\/[0-9]+:[A-Za-z0-9_-]+@[a-zA-Z0-9]+/,
    severity: "high",
    description: "Cloudinary API credentials found in source code.",
    remediation: "Regenerate credentials at cloudinary.com and use env vars.",
  },
];

// Patterns to skip (common false positives)
const IGNORE_PATTERNS = [
  /example/i,
  /placeholder/i,
  /your[_-]?key/i,
  /xxx+/i,
  /0{20,}/,
  /test/i,
  /fake/i,
  /dummy/i,
];

function isFalsePositive(match: string): boolean {
  return IGNORE_PATTERNS.some((p) => p.test(match));
}

/** Lines longer than this are truncated before regex scanning to prevent ReDoS on minified files. */
const MAX_LINE_LENGTH = 10_000;

function isCommentLine(line: string): boolean {
  const trimmed = line.trimStart();
  return (
    trimmed.startsWith("//") ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("*")
  );
}

/**
 * Scans a single file's content for hardcoded secrets.
 * Returns one finding per matched line (deduped by pattern+line).
 */
export function scanFileForSecrets(
  content: string,
  filePath: string
): SecretMatch[] {
  const lines = content.split("\n");
  const matches: SecretMatch[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    /* v8 ignore next -- i is always in range; `?? ""` never triggers. */
    const line = lines[i] ?? "";

    const scannedLine =
      line.length > MAX_LINE_LENGTH ? line.slice(0, MAX_LINE_LENGTH) : line;

    const inComment = isCommentLine(scannedLine);

    for (const pattern of PATTERNS) {
      pattern.regex.lastIndex = 0;
      const matchResult = pattern.regex.exec(scannedLine);
      if (!matchResult) {
        continue;
      }

      const matchedValue = matchResult[0];
      if (isFalsePositive(matchedValue)) {
        continue;
      }

      const dedupeKey = `${filePath}:${i + 1}:${pattern.name}`;
      /* v8 ignore start -- defensive: pattern names are unique, so a given
         (file, line, pattern) can only be seen once per scan. */
      if (seen.has(dedupeKey)) {
        continue;
      }
      /* v8 ignore stop */
      seen.add(dedupeKey);

      matches.push({
        title: `${pattern.name} exposed in ${filePath}`,
        description: pattern.description,
        inComment,
        severity: pattern.severity,
        line: i + 1,
        snippet: scannedLine.trim().slice(0, 200),
        remediation: pattern.remediation,
      });
    }
  }

  return matches;
}

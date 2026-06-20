export interface SastMatch {
  description: string;
  line: number;
  remediation: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  snippet: string;
  title: string;
}

interface SastPattern {
  description: string;
  /** File extensions this pattern applies to (undefined = all) */
  extensions?: string[];
  id: string;
  regex: RegExp;
  remediation: string;
  severity: SastMatch["severity"];
  title: string;
}

const PATTERNS: SastPattern[] = [
  // ─── Injection ────────────────────────────────────────────────────────────
  {
    id: "sql-string-concat",
    title: "Potential SQL Injection (string concatenation)",
    description:
      "SQL query built with string concatenation may allow an attacker to inject arbitrary SQL.",
    severity: "critical",
    remediation:
      "Use parameterized queries or an ORM (e.g., Drizzle, Prisma, SQLAlchemy). Never interpolate user input directly into SQL strings.",
    regex: /(?:query|sql|execute|exec)\s*[=(]\s*[`'"]/i,
    extensions: ["ts", "js", "py", "php", "java", "go", "rb"],
  },
  {
    id: "eval-usage",
    title: "Dangerous eval() Usage",
    description:
      "eval() executes arbitrary code and is a critical injection vector when fed user-controlled input.",
    severity: "critical",
    remediation:
      "Remove eval(). Use JSON.parse() for JSON, Function() only with trusted static strings, or restructure logic to avoid dynamic execution.",
    regex: /(?<!["'`])\beval\s*\(/,
    extensions: ["ts", "js", "mjs", "cjs"],
  },
  {
    id: "command-injection",
    title: "Potential Command Injection",
    description:
      "Shell command execution with dynamic input may allow command injection.",
    severity: "critical",
    remediation:
      "Avoid passing user input to shell commands. Use safe alternatives (e.g., Node.js `child_process.execFile` with an argument array, not a shell string).",
    regex:
      /(?:exec|spawn|execSync|spawnSync|system|popen|subprocess\.run)\s*\(/,
    extensions: ["ts", "js", "py", "rb", "go"],
  },
  {
    id: "xss-dangerouslysetinnerhtml",
    title: "XSS via dangerouslySetInnerHTML",
    description:
      "dangerouslySetInnerHTML bypasses React's XSS protection. Unsanitized content can execute arbitrary scripts.",
    severity: "high",
    remediation:
      "Sanitize HTML with DOMPurify before passing to dangerouslySetInnerHTML, or restructure to avoid raw HTML injection entirely.",
    regex: /dangerouslySetInnerHTML/,
    extensions: ["tsx", "jsx", "ts", "js"],
  },
  {
    id: "xss-innerhtml",
    title: "Potential XSS via innerHTML Assignment",
    description:
      "Direct innerHTML assignment with dynamic content is an XSS vector.",
    severity: "high",
    remediation:
      "Use textContent for plain text or sanitize HTML with DOMPurify before setting innerHTML.",
    regex: /\.innerHTML\s*=/,
    extensions: ["ts", "js", "tsx", "jsx"],
  },
  // ─── Path traversal ───────────────────────────────────────────────────────
  {
    id: "path-traversal",
    title: "Potential Path Traversal",
    description:
      "File path operations with unvalidated user input may allow an attacker to read arbitrary files.",
    severity: "high",
    remediation:
      "Validate and sanitize file paths. Use path.resolve() + check that the result starts with the expected base directory.",
    regex:
      /(?:readFile|writeFile|createReadStream|open)\s*\(\s*(?:req|request|params|query|body)/,
    extensions: ["ts", "js", "py"],
  },
  // ─── Cryptography ─────────────────────────────────────────────────────────
  {
    id: "weak-hash-md5",
    title: "Weak Hash Algorithm (MD5)",
    description:
      "MD5 is cryptographically broken and must not be used for passwords or security-sensitive hashing.",
    severity: "high",
    remediation:
      "Use bcrypt, Argon2, or scrypt for passwords. Use SHA-256 or SHA-3 for integrity checks.",
    regex: /(?:md5|MD5)\s*\(/,
    extensions: ["ts", "js", "py", "php", "java", "go", "rb"],
  },
  {
    id: "weak-hash-sha1",
    title: "Weak Hash Algorithm (SHA-1)",
    description:
      "SHA-1 is deprecated for security use due to known collision attacks.",
    severity: "medium",
    remediation:
      "Use SHA-256 or SHA-3 for integrity. Use bcrypt/Argon2/scrypt for passwords.",
    regex: /(?:sha1|SHA1|sha-1|SHA-1)\s*\(/,
    extensions: ["ts", "js", "py", "php", "java", "go", "rb"],
  },
  {
    id: "random-not-crypto",
    title: "Non-Cryptographic Random for Security Context",
    description:
      "Math.random() is not cryptographically secure and must not be used for tokens, IDs, or secrets.",
    severity: "high",
    remediation:
      "Use crypto.randomBytes() (Node.js), secrets.token_bytes() (Python), or crypto.getRandomValues() (browser).",
    regex: /Math\.random\s*\(\s*\)/,
    extensions: ["ts", "js", "tsx", "jsx"],
  },
  // ─── Authentication ───────────────────────────────────────────────────────
  {
    id: "hardcoded-jwt-none",
    title: "JWT Algorithm 'none' Accepted",
    description:
      "Accepting the 'none' algorithm in JWT verification allows tokens without signature verification.",
    severity: "critical",
    remediation:
      "Explicitly whitelist allowed algorithms (e.g., ['HS256', 'RS256']). Never allow 'none'.",
    regex: /algorithms?\s*[=:]\s*\[?\s*['"]none['"]/i,
  },
  {
    id: "cors-wildcard",
    title: "CORS Wildcard on Credentialed Route",
    description:
      "Allowing all origins (*) on routes that accept credentials weakens CORS protection.",
    severity: "medium",
    remediation:
      "Specify an explicit list of trusted origins instead of '*'. Wildcards cannot be used with credentials:true.",
    regex: /origin\s*:\s*['"]?\*/,
    extensions: ["ts", "js"],
  },
  {
    id: "disable-ssl-verify",
    title: "TLS/SSL Verification Disabled",
    description:
      "Disabling certificate verification exposes connections to man-in-the-middle attacks.",
    severity: "critical",
    remediation:
      "Never disable SSL verification in production. If testing with a self-signed cert, use a proper CA bundle instead.",
    regex:
      /(?:rejectUnauthorized|verify)\s*[=:]\s*false|ssl_verify\s*=\s*False/,
  },
  // ─── LLM-specific ─────────────────────────────────────────────────────────
  {
    id: "llm-user-in-system-prompt",
    title: "User Input Interpolated into System Prompt",
    description:
      "Interpolating user-controlled content into the system prompt is the primary prompt injection vector (OWASP LLM01).",
    severity: "high",
    remediation:
      "Never interpolate user content into the system prompt. Use the user/assistant message turns for user input. Apply input validation if dynamic system prompts are required.",
    regex:
      /system\s*[=:]\s*[`].*\$\{.*(?:req|request|input|user|body|query|param)/,
    extensions: ["ts", "js", "tsx", "jsx", "py"],
  },
  {
    id: "llm-dynamic-tool-call",
    title: "Dynamic Tool/Function Name from User Input",
    description:
      "Constructing tool or function call names from user input can allow an attacker to invoke unintended tools.",
    severity: "high",
    remediation:
      "Whitelist allowed tool names explicitly. Never derive a tool name from user-controlled content.",
    regex: /tool(?:s|_name|Name)\s*[=:]\s*(?:req|request|input|body|query)/i,
    extensions: ["ts", "js", "py"],
  },
  // ─── Miscellaneous ────────────────────────────────────────────────────────
  {
    id: "debug-console-log",
    title: "console.log / debugger Left in Code",
    description:
      "Debug statements committed to production code leak internal state.",
    severity: "info",
    remediation: "Remove debug statements before merging to main.",
    regex: /\b(?:debugger|console\.log)\b/,
    extensions: ["ts", "js", "tsx", "jsx"],
  },
  {
    id: "todo-fixme-security",
    title: "TODO/FIXME with Security Keyword",
    description:
      "A TODO or FIXME comment flags a known security concern that was deferred.",
    severity: "low",
    remediation: "Address this security concern before shipping to production.",
    regex: /(?:TODO|FIXME|HACK)\s*.*?(?:secur|auth|inject|xss|csrf|vuln)/i,
  },
];

function getExtension(filePath: string): string {
  return filePath.split(".").pop()?.toLowerCase() ?? "";
}

/**
 * Scans a single file for common security anti-patterns.
 */
export function scanFileForPatterns(
  content: string,
  filePath: string
): SastMatch[] {
  const ext = getExtension(filePath);
  const lines = content.split("\n");
  const matches: SastMatch[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";

    for (const pattern of PATTERNS) {
      if (pattern.extensions && !pattern.extensions.includes(ext)) {
        continue;
      }

      if (!pattern.regex.test(line)) {
        continue;
      }

      const dedupeKey = `${filePath}:${i + 1}:${pattern.id}`;
      if (seen.has(dedupeKey)) {
        continue;
      }
      seen.add(dedupeKey);

      matches.push({
        title: pattern.title,
        description: pattern.description,
        severity: pattern.severity,
        line: i + 1,
        snippet: line.trim().slice(0, 300),
        remediation: pattern.remediation,
      });
    }
  }

  return matches;
}

<script setup lang="ts">
import {
  ArrowLeft,
  KeyRound,
  Package,
  ShieldAlert,
  Sparkles,
} from "lucide-vue-next";

useHead({ title: "About — Trespass" });
</script>

<template>
  <div class="container mx-auto px-4 py-8 max-w-4xl">
    <div class="flex items-center gap-3 mb-6">
      <Button
        variant="ghost"
        size="sm"
        as-child
        class="text-muted-foreground hover:text-foreground"
      >
        <NuxtLink to="/">
          <ArrowLeft class="h-4 w-4 mr-1" />
          Back
        </NuxtLink>
      </Button>
    </div>

    <!-- Hero -->
    <div class="mb-10">
      <h1 class="text-2xl font-bold font-mono text-foreground">
        About Trespass
      </h1>
      <p class="text-sm text-muted-foreground mt-1.5 max-w-2xl">
        Trespass runs four analysis layers against your GitHub repositories —
        static pattern matching, dependency auditing, SAST, and optional
        AI-powered review — to surface secrets, vulnerabilities, and security
        anti-patterns before they reach production.
      </p>
    </div>

    <!-- Scanner layers -->
    <div class="grid gap-5">
      <!-- Secrets Detection -->
      <div class="rounded-xl border border-border/50 bg-card p-6">
        <div class="flex items-center gap-3 mb-4">
          <div
            class="flex h-9 w-9 items-center justify-center rounded-lg border border-border/50 bg-background"
          >
            <KeyRound class="h-4 w-4 text-primary" />
          </div>
          <div class="flex items-center gap-2">
            <h2 class="font-mono font-semibold text-foreground">
              Secrets Detection
            </h2>
            <Badge variant="outline" class="font-mono text-xs">
              16 patterns
            </Badge>
          </div>
        </div>
        <p class="text-sm text-muted-foreground mb-4">
          Regex + entropy matching against hardcoded credentials, including
          secrets inside code comments. Ignores placeholders, example values,
          and dummy strings to reduce false positives.
        </p>
        <ul
          class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs font-mono text-muted-foreground"
        >
          <li class="flex items-center gap-1.5">
            <span class="text-primary">·</span>
            AWS Access Key
          </li>
          <li class="flex items-center gap-1.5">
            <span class="text-primary">·</span>
            OpenAI / Anthropic / Google API Keys
          </li>
          <li class="flex items-center gap-1.5">
            <span class="text-primary">·</span>
            GitHub PAT, OAuth & Actions tokens
          </li>
          <li class="flex items-center gap-1.5">
            <span class="text-primary">·</span>
            Stripe secret & publishable keys
          </li>
          <li class="flex items-center gap-1.5">
            <span class="text-primary">·</span>
            Twilio & Slack tokens
          </li>
          <li class="flex items-center gap-1.5">
            <span class="text-primary">·</span>
            PEM private keys (RSA, EC, DSA, OpenSSH)
          </li>
          <li class="flex items-center gap-1.5">
            <span class="text-primary">·</span>
            Database connection strings (Postgres, MySQL, MongoDB, Redis)
          </li>
          <li class="flex items-center gap-1.5">
            <span class="text-primary">·</span>
            JWT secrets & generic password/API key assignments
          </li>
        </ul>
      </div>

      <!-- SAST -->
      <div class="rounded-xl border border-border/50 bg-card p-6">
        <div class="flex items-center gap-3 mb-4">
          <div
            class="flex h-9 w-9 items-center justify-center rounded-lg border border-border/50 bg-background"
          >
            <ShieldAlert class="h-4 w-4 text-primary" />
          </div>
          <div class="flex items-center gap-2">
            <h2 class="font-mono font-semibold text-foreground">
              SAST Patterns
            </h2>
            <Badge variant="outline" class="font-mono text-xs">
              21 patterns
            </Badge>
          </div>
        </div>
        <p class="text-sm text-muted-foreground mb-4">
          Static analysis across TypeScript, JavaScript, Python, Go, Ruby, PHP,
          and Java — organized by attack category.
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div>
            <p
              class="text-foreground/70 mb-1.5 uppercase tracking-wide text-[10px]"
            >
              Injection
            </p>
            <ul class="space-y-1 text-muted-foreground">
              <li class="flex gap-1.5">
                <span class="text-primary">·</span>
                SQL injection via string concatenation
              </li>
              <li class="flex gap-1.5">
                <span class="text-primary">·</span>
                Dangerous
                <code class="text-foreground/80">eval()</code>
                usage
              </li>
              <li class="flex gap-1.5">
                <span class="text-primary">·</span>
                Command injection (exec, spawn, subprocess)
              </li>
            </ul>
          </div>
          <div>
            <p
              class="text-foreground/70 mb-1.5 uppercase tracking-wide text-[10px]"
            >
              XSS
            </p>
            <ul class="space-y-1 text-muted-foreground">
              <li class="flex gap-1.5">
                <span class="text-primary">·</span>
                <code class="text-foreground/80">dangerouslySetInnerHTML</code>
              </li>
              <li class="flex gap-1.5">
                <span class="text-primary">·</span>
                <code class="text-foreground/80">.innerHTML</code>
                direct assignment
              </li>
            </ul>
          </div>
          <div>
            <p
              class="text-foreground/70 mb-1.5 uppercase tracking-wide text-[10px]"
            >
              Cryptography
            </p>
            <ul class="space-y-1 text-muted-foreground">
              <li class="flex gap-1.5">
                <span class="text-primary">·</span>
                MD5 & SHA-1 usage
              </li>
              <li class="flex gap-1.5">
                <span class="text-primary">·</span>
                <code class="text-foreground/80">Math.random()</code>
                in security contexts
              </li>
            </ul>
          </div>
          <div>
            <p
              class="text-foreground/70 mb-1.5 uppercase tracking-wide text-[10px]"
            >
              Authentication
            </p>
            <ul class="space-y-1 text-muted-foreground">
              <li class="flex gap-1.5">
                <span class="text-primary">·</span>
                JWT algorithm
                <code class="text-foreground/80">'none'</code>
                accepted
              </li>
              <li class="flex gap-1.5">
                <span class="text-primary">·</span>
                CORS wildcard on credentialed routes
              </li>
              <li class="flex gap-1.5">
                <span class="text-primary">·</span>
                TLS/SSL verification disabled
              </li>
            </ul>
          </div>
          <div class="sm:col-span-2">
            <p
              class="text-foreground/70 mb-1.5 uppercase tracking-wide text-[10px]"
            >
              LLM-specific (OWASP LLM01)
            </p>
            <ul class="space-y-1 text-muted-foreground">
              <li class="flex gap-1.5">
                <span class="text-primary">·</span>
                User input interpolated into system prompts (prompt injection)
              </li>
              <li class="flex gap-1.5">
                <span class="text-primary">·</span>
                Dynamic tool/function names derived from user input
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Dependency Auditing -->
      <div class="rounded-xl border border-border/50 bg-card p-6">
        <div class="flex items-center gap-3 mb-4">
          <div
            class="flex h-9 w-9 items-center justify-center rounded-lg border border-border/50 bg-background"
          >
            <Package class="h-4 w-4 text-primary" />
          </div>
          <div class="flex items-center gap-2">
            <h2 class="font-mono font-semibold text-foreground">
              Dependency Auditing
            </h2>
          </div>
        </div>
        <p class="text-sm text-muted-foreground mb-4">
          Queries the
          <a
            href="https://osv.dev"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary underline-offset-2 hover:underline"
            >OSV.dev</a
          >
          database in batches for known CVEs across npm and PyPI ecosystems.
          Returns installed version, fixed-in version, CVE ID, and an upgrade
          recommendation for each finding.
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div>
            <p
              class="text-foreground/70 mb-1.5 uppercase tracking-wide text-[10px]"
            >
              Ecosystems
            </p>
            <ul class="space-y-1 text-muted-foreground">
              <li class="flex gap-1.5">
                <span class="text-primary">·</span>
                npm — via
                <code class="text-foreground/80">package.json</code>
              </li>
              <li class="flex gap-1.5">
                <span class="text-primary">·</span>
                PyPI — via
                <code class="text-foreground/80">requirements.txt</code>
              </li>
            </ul>
          </div>
          <div>
            <p
              class="text-foreground/70 mb-1.5 uppercase tracking-wide text-[10px]"
            >
              CVSS v3 severity mapping
            </p>
            <ul class="space-y-1 text-muted-foreground">
              <li class="flex gap-1.5">
                <span class="text-destructive">·</span>
                Critical — score ≥ 9.0
              </li>
              <li class="flex gap-1.5">
                <span class="text-orange-400">·</span>
                High — score ≥ 7.0
              </li>
              <li class="flex gap-1.5">
                <span class="text-yellow-400">·</span>
                Medium — score ≥ 4.0
              </li>
              <li class="flex gap-1.5">
                <span class="text-muted-foreground">·</span>
                Low — score &lt; 4.0
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- LLM Review -->
      <div class="rounded-xl border border-border/50 bg-card p-6">
        <div class="flex items-center gap-3 mb-4">
          <div
            class="flex h-9 w-9 items-center justify-center rounded-lg border border-border/50 bg-background"
          >
            <Sparkles class="h-4 w-4 text-primary" />
          </div>
          <div class="flex items-center gap-2">
            <h2 class="font-mono font-semibold text-foreground">
              LLM Code Review
            </h2>
            <Badge
              variant="outline"
              class="font-mono text-xs text-muted-foreground"
            >
              optional
            </Badge>
          </div>
        </div>
        <p class="text-sm text-muted-foreground mb-4">
          Context-aware security review using your own API key — never stored in
          plaintext. Opt-in per scan. Files flagged by static analysis are
          prioritized and sent to the model for enriched findings and
          remediation advice.
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div>
            <p
              class="text-foreground/70 mb-1.5 uppercase tracking-wide text-[10px]"
            >
              Providers
            </p>
            <ul class="space-y-1 text-muted-foreground">
              <li class="flex gap-1.5">
                <span class="text-primary">·</span>
                OpenAI
              </li>
              <li class="flex gap-1.5">
                <span class="text-primary">·</span>
                Anthropic
              </li>
              <li class="flex gap-1.5">
                <span class="text-primary">·</span>
                Google Gemini
              </li>
            </ul>
          </div>
          <div>
            <p
              class="text-foreground/70 mb-1.5 uppercase tracking-wide text-[10px]"
            >
              Limits & behavior
            </p>
            <ul class="space-y-1 text-muted-foreground">
              <li class="flex gap-1.5">
                <span class="text-primary">·</span>
                Up to 30 files per scan, 5 concurrent
              </li>
              <li class="flex gap-1.5">
                <span class="text-primary">·</span>
                3-minute hard timeout
              </li>
              <li class="flex gap-1.5">
                <span class="text-primary">·</span>
                Confidence threshold &gt;80% to report
              </li>
              <li class="flex gap-1.5">
                <span class="text-primary">·</span>
                Prioritizes
                <code class="text-foreground/80">auth</code>,
                <code class="text-foreground/80">secret</code>,
                <code class="text-foreground/80">token</code>,
                <code class="text-foreground/80">api</code>
                files
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- File coverage -->
    <div class="mt-8 rounded-xl border border-border/50 bg-card p-6">
      <h2 class="font-mono font-semibold text-foreground mb-3">
        File coverage
      </h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs font-mono">
        <div>
          <p
            class="text-foreground/70 mb-2 uppercase tracking-wide text-[10px]"
          >
            Scanned extensions
          </p>
          <p class="text-muted-foreground leading-relaxed">
            <code class="text-foreground/80">.ts .tsx .js .jsx .mjs .cjs</code>
            · <code class="text-foreground/80">.py</code> ·
            <code class="text-foreground/80">.go .rb .php .java</code>
            ·
            <code class="text-foreground/80"
              >.env .yaml .yml .json .toml .sh .bash</code
            >
          </p>
        </div>
        <div>
          <p
            class="text-foreground/70 mb-2 uppercase tracking-wide text-[10px]"
          >
            Ignored paths
          </p>
          <p class="text-muted-foreground leading-relaxed">
            <code class="text-foreground/80"
              >node_modules/ dist/ build/ .next/ .nuxt/ vendor/ __pycache__/
              .venv/</code
            >
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

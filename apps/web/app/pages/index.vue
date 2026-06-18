<script setup lang="ts">
import {
  AlertTriangle,
  ArrowRight,
  Bug,
  ChevronRight,
  Code2,
  Github,
  Lock,
  Package,
  Shield,
  Sparkles,
  Zap,
} from "lucide-vue-next";

useHead({
  title: "Trespass — GitHub Repository Security Scanner",
  meta: [
    {
      name: "description",
      content:
        "Scan your GitHub repositories for secrets, CVEs, and code vulnerabilities before attackers find them first.",
    },
  ],
});

const { $authClient } = useNuxtApp();
const {
  public: { version },
} = useRuntimeConfig();
const session = $authClient.useSession();

const scanCategories = [
  {
    icon: Lock,
    label: "Secrets Detection",
    desc: "API keys, tokens, passwords, and credentials hardcoded in your source.",
    color: "text-red-400",
    bg: "bg-red-400/10",
  },
  {
    icon: Package,
    label: "Dependency CVEs",
    desc: "Known vulnerabilities in npm, PyPI, Go, and Cargo dependencies via OSV.dev.",
    color: "text-orange-400",
    bg: "bg-orange-400/10",
  },
  {
    icon: Code2,
    label: "SAST Patterns",
    desc: "SQL injection, eval(), XSS vectors, command injection, and weak crypto.",
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
  },
  {
    icon: Sparkles,
    label: "LLM Code Review",
    desc: "Optional AI-powered deep-dive on flagged files using your own API key.",
    color: "text-primary",
    bg: "bg-primary/10",
  },
];

const steps = [
  {
    n: "01",
    label: "Connect",
    desc: "Log in with GitHub. Add a Personal Access Token to scan private repositories.",
  },
  {
    n: "02",
    label: "Scan",
    desc: "Select a repository and launch a scan. We analyze secrets, deps, and code patterns.",
  },
  {
    n: "03",
    label: "Fix",
    desc: "Review findings sorted by severity. Each finding comes with a remediation guide.",
  },
];
</script>

<template>
  <div>
    <!-- ── Hero ──────────────────────────────────────────────────────────────── -->
    <section class="relative overflow-hidden">
      <!-- Grid background -->
      <div
        class="absolute inset-0 bg-[linear-gradient(to_right,oklch(0.22_0_0/0.5)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.22_0_0/0.5)_1px,transparent_1px)] bg-[size:40px_40px]"
      />
      <!-- Radial glow center -->
      <div
        class="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,oklch(0.69_0.185_147/0.12),transparent)]"
      />

      <div class="relative container mx-auto px-4 py-28 text-center">
        <!-- Badge -->
        <div
          class="inline-flex items-center gap-2 mb-8 px-3 py-1 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-mono"
        >
          <span class="relative flex h-2 w-2">
            <span
              class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"
            />
            <span
              class="relative inline-flex rounded-full h-2 w-2 bg-primary"
            />
          </span>
          Open Source · Free Forever
        </div>

        <!-- Headline -->
        <h1
          class="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-tight"
        >
          <span class="text-foreground">Find vulnerabilities</span>
          <br>
          <span class="text-primary font-mono">
            <GlitchText text="before attackers do." />
          </span>
        </h1>

        <p
          class="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          Trespass scans your GitHub repositories for hardcoded secrets, known
          CVEs, and dangerous code patterns — with optional LLM-powered deep
          analysis.
        </p>

        <!-- CTA -->
        <div
          class="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Button
            v-if="!session.data"
            size="lg"
            as-child
            class="bg-primary text-primary-foreground hover:bg-primary/90 font-mono text-sm px-8 gap-2 group"
          >
            <NuxtLink to="/login">
              <Github class="h-4 w-4" />
              Sign in with GitHub
              <ArrowRight
                class="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition-transform"
              />
            </NuxtLink>
          </Button>
          <Button
            v-else
            size="lg"
            as-child
            class="bg-primary text-primary-foreground hover:bg-primary/90 font-mono text-sm px-8 gap-2 group"
          >
            <NuxtLink to="/dashboard">
              <Zap class="h-4 w-4" />
              Go to Dashboard
              <ArrowRight
                class="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition-transform"
              />
            </NuxtLink>
          </Button>

          <Button
            variant="outline"
            size="lg"
            as-child
            class="border-border/50 text-muted-foreground hover:text-foreground font-mono text-sm px-8"
          >
            <a
              href="https://github.com/carvalhocaio/trespass"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center gap-2"
            >
              <Github class="h-4 w-4" />
              View on GitHub
            </a>
          </Button>
        </div>

        <!-- Terminal preview -->
        <div class="mt-16 max-w-2xl mx-auto">
          <div
            class="rounded-xl border border-border/50 bg-card overflow-hidden shadow-2xl shadow-primary/5"
          >
            <div
              class="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-background/50"
            >
              <div class="flex gap-1.5">
                <div class="h-3 w-3 rounded-full bg-red-500/70" />
                <div class="h-3 w-3 rounded-full bg-yellow-500/70" />
                <div class="h-3 w-3 rounded-full bg-green-500/70" />
              </div>
              <span class="text-xs font-mono text-muted-foreground ml-2">
                trespass scan carvalhocaio/myapp
              </span>
            </div>
            <div class="p-4 font-mono text-xs text-left space-y-1.5">
              <p class="text-muted-foreground">$ trespass scan .</p>
              <p>
                <span class="text-primary">✓</span>
                <span class="text-muted-foreground ml-2"
                  >Fetching file tree... 214 files</span
                >
              </p>
              <p>
                <span class="text-primary">✓</span>
                <span class="text-muted-foreground ml-2"
                  >Auditing dependencies... 127 packages</span
                >
              </p>
              <p>
                <span class="text-yellow-400">⚠</span>
                <span class="text-muted-foreground ml-2">
                  Scanning code patterns... 3 files flagged
                </span>
              </p>
              <p>
                <span class="text-red-400">✗</span>
                <span class="text-foreground ml-2 font-semibold">
                  2 CRITICAL · 5 HIGH · 11 MEDIUM
                </span>
              </p>
              <p class="text-muted-foreground/50">
                Run complete in 4.2s
                <span class="animate-pulse">▋</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ── How It Works ──────────────────────────────────────────────────────── -->
    <section class="py-24 border-t border-border/30">
      <div class="container mx-auto px-4">
        <div class="text-center mb-16">
          <h2 class="text-3xl font-bold font-mono text-foreground mb-3">
            How it works
          </h2>
          <p class="text-muted-foreground">Three steps to a security report.</p>
        </div>

        <div class="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div v-for="step in steps" :key="step.n" class="relative text-center">
            <div
              class="inline-flex items-center justify-center h-12 w-12 rounded-full border border-primary/30 bg-primary/10 mb-4 text-primary font-mono font-bold text-sm"
            >
              {{ step.n }}
            </div>
            <h3 class="font-semibold text-foreground mb-2">{{ step.label }}</h3>
            <p class="text-sm text-muted-foreground leading-relaxed">
              {{ step.desc }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Scan Categories ────────────────────────────────────────────────────── -->
    <section class="py-24 border-t border-border/30">
      <div class="container mx-auto px-4">
        <div class="text-center mb-16">
          <h2 class="text-3xl font-bold font-mono text-foreground mb-3">
            What we scan
          </h2>
          <p class="text-muted-foreground">
            Four layers of security analysis in a single run.
          </p>
        </div>

        <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
          <SpotlightCard v-for="cat in scanCategories" :key="cat.label">
            <div class="p-6">
              <div
                class="inline-flex items-center justify-center h-10 w-10 rounded-lg mb-4"
                :class="cat.bg"
              >
                <component :is="cat.icon" class="h-5 w-5" :class="cat.color" />
              </div>
              <h3 class="font-semibold text-sm text-foreground mb-2">
                {{ cat.label }}
              </h3>
              <p class="text-xs text-muted-foreground leading-relaxed">
                {{ cat.desc }}
              </p>
            </div>
          </SpotlightCard>
        </div>
      </div>
    </section>

    <!-- ── CTA bottom ────────────────────────────────────────────────────────── -->
    <section class="py-24 border-t border-border/30">
      <div class="container mx-auto px-4 text-center">
        <Shield class="h-12 w-12 text-primary mx-auto mb-6 opacity-80" />
        <h2 class="text-3xl font-bold font-mono text-foreground mb-4">
          Ready to secure your repos?
        </h2>
        <p class="text-muted-foreground mb-8 max-w-md mx-auto">
          Connect your GitHub account and get your first security report in
          under a minute.
        </p>
        <Button
          size="lg"
          as-child
          class="bg-primary text-primary-foreground hover:bg-primary/90 font-mono text-sm px-10 gap-2 group"
        >
          <NuxtLink to="/login">
            <Github class="h-4 w-4" />
            Get started — it's free
            <ChevronRight
              class="h-4 w-4 group-hover:translate-x-0.5 transition-transform"
            />
          </NuxtLink>
        </Button>
      </div>
    </section>

    <!-- ── Footer ─────────────────────────────────────────────────────────────── -->
    <footer class="border-t border-border/30 py-8">
      <div
        class="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4"
      >
        <div class="flex items-center gap-2 text-muted-foreground text-sm">
          <Shield class="h-4 w-4 text-primary" />
          <span
            class="font-mono font-bold text-xs tracking-widest text-foreground"
            >TRESPASS</span
          >
          <span>·</span>
          <span>Open source security scanner</span>
          <span>·</span>
          <span class="font-mono text-xs text-muted-foreground/60"
            >v{{ version }}</span
          >
        </div>
        <div class="flex items-center gap-4 text-xs text-muted-foreground">
          <a
            href="https://github.com/carvalhocaio/trespass"
            target="_blank"
            rel="noopener noreferrer"
            class="hover:text-foreground transition-colors flex items-center gap-1"
          >
            <Github class="h-3.5 w-3.5" />
            GitHub
          </a>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Code2,
  ExternalLink,
  Github,
  KeyRound,
  Loader2,
  Package,
  Play,
  Shield,
  Sparkles,
  Square,
} from "lucide-vue-next";
import { toast } from "vue-sonner";

useHead({ title: "Scan Results — Trespass" });
definePageMeta({ middleware: ["auth"] });

const route = useRoute();
const config = useRuntimeConfig();
const BASE = config.public.serverUrl;

type Severity = "critical" | "high" | "medium" | "low" | "info";
type Category = "secret" | "dependency" | "sast" | "llm";

interface Finding {
  category: Category;
  description: string;
  file: string | null;
  id: string;
  line: number | null;
  llmEnriched: boolean;
  remediation: string;
  severity: Severity;
  snippet: string | null;
  title: string;
}

interface ScanSummary {
  critical: number;
  filesScanned: number;
  high: number;
  info: number;
  llmEnriched: boolean;
  low: number;
  medium: number;
  total: number;
}

interface ProgressStep {
  detail: null | string;
  key: string;
  label: string;
  status: "done" | "error" | "running" | "warn";
}

interface Scan {
  error: string | null;
  finishedAt: string | null;
  id: string;
  progress: ProgressStep[] | null;
  repo: { fullName: string; htmlUrl: string | null };
  repoId: string;
  startedAt: string | null;
  status: "queued" | "running" | "done" | "error" | "cancelled";
  summary: ScanSummary | null;
}

const scan = ref<Scan | null>(null);
const findings = ref<Finding[]>([]);
const loading = ref(true);
const expandedId = ref<string | null>(null);

let pollInterval: ReturnType<typeof setInterval> | null = null;

async function fetchScan() {
  try {
    const res = await $fetch<{ scan: Scan; findings: Finding[] }>(
      `${BASE}/api/scans/${route.params.id}`,
      { credentials: "include" }
    );
    scan.value = res.scan;
    findings.value = res.findings;

    const isTerminal =
      res.scan.status === "done" ||
      res.scan.status === "error" ||
      res.scan.status === "cancelled";
    if (isTerminal && pollInterval) {
      clearInterval(pollInterval);
    }
  } catch {
    /* ignore polling errors */
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await fetchScan();
  if (scan.value?.status === "queued" || scan.value?.status === "running") {
    pollInterval = setInterval(fetchScan, 3000);
  }
});

onUnmounted(() => {
  if (pollInterval) {
    clearInterval(pollInterval);
  }
});

const rescanning = ref(false);

async function rescan() {
  if (!scan.value) {
    return;
  }
  rescanning.value = true;
  try {
    const res = await $fetch<{ scan: { id: string } }>(`${BASE}/api/scans`, {
      method: "POST",
      body: { repoId: scan.value.repoId },
      credentials: "include",
    });
    navigateTo(`/scans/${res.scan.id}`);
  } catch {
    rescanning.value = false;
  }
}

const stopping = ref(false);

async function stopScan() {
  if (!scan.value) {
    return;
  }
  stopping.value = true;
  try {
    await $fetch(`${BASE}/api/scans/${scan.value.id}/cancel`, {
      method: "POST",
      credentials: "include",
    });
    toast.success("Scan stopped");
    await fetchScan();
  } catch {
    toast.error("Failed to stop scan");
  } finally {
    stopping.value = false;
  }
}

function openIssue(f: Finding) {
  const repo = scan.value?.repo.fullName;
  if (!repo) {
    return;
  }

  const title = `[Security] ${f.title}`;

  const lines: (string | null)[] = [
    `## 🔒 Security Finding: ${f.title}`,
    "",
    `**Severity:** \`${f.severity.toUpperCase()}\`  `,
    `**Category:** ${f.category}  `,
    f.file ? `**File:** \`${f.file}${f.line ? `:${f.line}` : ""}\`` : null,
    "",
    "### Description",
    f.description,
  ];

  if (f.snippet) {
    lines.push("", "### Code", "```", f.snippet, "```");
  }

  lines.push(
    "",
    "### Remediation",
    f.remediation ?? "See finding description.",
    "",
    "---",
    "*Reported by [Trespass](https://github.com/carvalhocaio/trespass) security scanner*"
  );

  const body = lines.filter((l) => l !== null).join("\n");
  const url = `https://github.com/${repo}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

const severityOrder: Severity[] = ["critical", "high", "medium", "low", "info"];

const findingsBySeverity = computed(() => {
  const out: Record<Severity, Finding[]> = {
    critical: [],
    high: [],
    medium: [],
    low: [],
    info: [],
  };
  for (const f of findings.value) {
    out[f.severity].push(f);
  }
  return out;
});

const categoryIcon: Record<Category, unknown> = {
  secret: KeyRound,
  dependency: Package,
  sast: Code2,
  llm: Sparkles,
};

const severityColors: Record<
  Severity,
  { text: string; bg: string; border: string }
> = {
  critical: {
    text: "text-red-400",
    bg: "bg-red-400/10",
    border: "border-red-400/30",
  },
  high: {
    text: "text-orange-400",
    bg: "bg-orange-400/10",
    border: "border-orange-400/30",
  },
  medium: {
    text: "text-yellow-400",
    bg: "bg-yellow-400/10",
    border: "border-yellow-400/30",
  },
  low: {
    text: "text-blue-400",
    bg: "bg-blue-400/10",
    border: "border-blue-400/30",
  },
  info: {
    text: "text-muted-foreground",
    bg: "bg-muted",
    border: "border-border",
  },
};

function elapsed(start: string | null, end: string | null): string {
  if (!start) {
    return "";
  }
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const sec = Math.round((e - s) / 1000);
  return sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m ${sec % 60}s`;
}
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
        <NuxtLink to="/dashboard">
          <ArrowLeft class="h-4 w-4 mr-1" />
          Back
        </NuxtLink>
      </Button>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="space-y-4">
      <div
        class="h-24 rounded-xl border border-border/50 bg-card animate-pulse"
      />
      <div
        class="h-48 rounded-xl border border-border/50 bg-card animate-pulse"
      />
    </div>

    <template v-else-if="scan">
      <!-- Scan header -->
      <div class="mb-8">
        <div class="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 class="text-2xl font-bold font-mono text-foreground">
              {{ scan.repo.fullName }}
            </h1>
            <div
              class="flex items-center gap-3 mt-1.5 text-xs font-mono text-muted-foreground"
            >
              <span class="flex items-center gap-1">
                <Clock class="h-3.5 w-3.5" />
                {{ elapsed(scan.startedAt, scan.finishedAt) }}
              </span>
              <span v-if="scan.summary?.filesScanned">
                {{ scan.summary.filesScanned }}
                files scanned
              </span>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <Button
              v-if="scan.status === 'queued' || scan.status === 'running'"
              size="sm"
              class="bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/30 font-mono text-xs gap-1.5"
              :disabled="stopping"
              @click="stopScan"
            >
              <Square class="h-3 w-3" />
              {{ stopping ? "Stopping..." : "Stop scan" }}
            </Button>
            <Button
              v-else
              size="sm"
              class="bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30 font-mono text-xs gap-1.5"
              :disabled="rescanning"
              @click="rescan"
            >
              <Play class="h-3.5 w-3.5" />
              {{ rescanning ? "Starting..." : "Re-scan" }}
            </Button>
            <a
              v-if="scan.repo.htmlUrl"
              :href="scan.repo.htmlUrl"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                variant="outline"
                size="sm"
                class="border-border/50 font-mono text-xs gap-1.5"
              >
                <ExternalLink class="h-3.5 w-3.5" />
                GitHub
              </Button>
            </a>
          </div>
        </div>

        <!-- Terminal progress -->
        <div
          v-if="scan.status === 'queued' || scan.status === 'running' || (scan.status === 'done' && scan.progress?.length)"
          class="rounded-xl border border-border/60 bg-[#0d0d0d] overflow-hidden font-mono text-sm"
        >
          <!-- Title bar -->
          <div
            class="flex items-center gap-2 px-4 py-2.5 border-b border-border/40 bg-[#161616]"
          >
            <span class="h-3 w-3 rounded-full bg-red-500/80" />
            <span class="h-3 w-3 rounded-full bg-yellow-500/80" />
            <span class="h-3 w-3 rounded-full bg-green-500/80" />
            <span class="ml-3 text-xs text-muted-foreground">
              trespass scan {{ scan.repo.fullName }}
            </span>
          </div>

          <!-- Output lines -->
          <div class="px-5 py-4 space-y-1.5">
            <p class="text-muted-foreground text-xs mb-3">$ trespass scan .</p>

            <!-- Queued placeholder -->
            <div
              v-if="scan.status === 'queued'"
              class="flex items-center gap-2 text-xs text-muted-foreground"
            >
              <Loader2 class="h-3.5 w-3.5 animate-spin shrink-0" />
              <span>Waiting to start...</span>
            </div>

            <!-- Progress steps -->
            <div
              v-for="step in (scan.progress ?? [])"
              :key="step.key"
              class="flex items-start gap-2 text-xs leading-relaxed"
            >
              <span class="shrink-0 w-3.5 text-center mt-px">
                <Loader2
                  v-if="step.status === 'running'"
                  class="h-3 w-3 animate-spin text-primary inline"
                />
                <CheckCircle2
                  v-else-if="step.status === 'done'"
                  class="h-3 w-3 text-green-400 inline"
                />
                <AlertTriangle
                  v-else-if="step.status === 'warn'"
                  class="h-3 w-3 text-yellow-400 inline"
                />
                <span v-else class="text-red-400">✗</span>
              </span>
              <span
                :class="step.status === 'running' ? 'text-foreground' : 'text-muted-foreground'"
              >
                {{ step.label }}
                <span v-if="step.detail" class="text-foreground/70">
                  {{ step.detail }}</span
                >
                <span
                  v-if="step.status === 'running'"
                  class="inline-block w-1.5 h-3 bg-primary/70 ml-0.5 animate-pulse align-middle"
                />
              </span>
            </div>

            <!-- Summary line when done -->
            <template v-if="scan.status === 'done' && scan.summary">
              <div
                class="mt-3 pt-3 border-t border-border/30 text-xs font-bold tracking-wide"
              >
                <span v-if="scan.summary.critical > 0" class="text-red-400"
                  >✗
                </span>
                <span v-else class="text-green-400">✓ </span>
                <span v-if="scan.summary.critical > 0" class="text-red-400"
                  >{{ scan.summary.critical }}
                  CRITICAL</span
                >
                <span
                  v-if="scan.summary.critical > 0 && scan.summary.high > 0"
                  class="text-muted-foreground"
                >
                  ·
                </span>
                <span v-if="scan.summary.high > 0" class="text-orange-400"
                  >{{ scan.summary.high }}
                  HIGH</span
                >
                <span
                  v-if="(scan.summary.critical > 0 || scan.summary.high > 0) && scan.summary.medium > 0"
                  class="text-muted-foreground"
                >
                  ·
                </span>
                <span v-if="scan.summary.medium > 0" class="text-yellow-400"
                  >{{ scan.summary.medium }}
                  MEDIUM</span
                >
                <span
                  v-if="scan.summary.critical === 0 && scan.summary.high === 0 && scan.summary.medium === 0"
                  class="text-green-400"
                  >All clear</span
                >
              </div>
              <p class="text-xs text-muted-foreground mt-1">
                Run complete in {{ elapsed(scan.startedAt, scan.finishedAt) }}
              </p>
            </template>
          </div>
        </div>

        <div
          v-else-if="scan.status === 'error'"
          class="p-4 rounded-xl border border-destructive/30 bg-destructive/10"
        >
          <p
            class="text-sm font-medium text-destructive flex items-center gap-2"
          >
            <AlertTriangle class="h-4 w-4" />
            Scan failed
          </p>
          <p class="text-xs text-muted-foreground mt-1 font-mono">
            {{ scan.error }}
          </p>
        </div>

        <div
          v-else-if="scan.status === 'cancelled'"
          class="p-4 rounded-xl border border-border/60 bg-secondary/30"
        >
          <p
            class="text-sm font-medium text-muted-foreground flex items-center gap-2"
          >
            <Square class="h-4 w-4" />
            Scan stopped
          </p>
          <p class="text-xs text-muted-foreground mt-1 font-mono">
            This scan was stopped before it finished. Re-scan to run it again.
          </p>
        </div>

        <div v-else-if="scan.summary" class="grid grid-cols-5 gap-2">
          <div
            v-for="s in severityOrder"
            :key="s"
            class="p-3 rounded-xl border text-center"
            :class="[severityColors[s].bg, severityColors[s].border]"
          >
            <div
              class="text-2xl font-bold font-mono"
              :class="severityColors[s].text"
            >
              {{ scan.summary[s] ?? 0 }}
            </div>
            <div
              class="text-[10px] uppercase font-mono text-muted-foreground mt-0.5"
            >
              {{ s }}
            </div>
          </div>
        </div>

        <div
          v-else-if="scan.status === 'done'"
          class="flex items-center gap-3 p-4 rounded-xl border border-primary/20 bg-primary/5"
        >
          <CheckCircle2 class="h-5 w-5 text-primary" />
          <p class="text-sm font-medium text-foreground">
            No issues found — clean repository!
          </p>
        </div>
      </div>

      <!-- Findings by severity -->
      <div v-if="findings.length > 0" class="space-y-6">
        <div v-for="sev in severityOrder" :key="sev">
          <template v-if="findingsBySeverity[sev].length > 0">
            <div class="flex items-center gap-2 mb-3">
              <Badge
                :class="[severityColors[sev].text, severityColors[sev].bg, severityColors[sev].border, 'border font-mono text-xs uppercase']"
              >
                {{ sev }}
              </Badge>
              <span class="text-xs text-muted-foreground font-mono">
                {{ findingsBySeverity[sev].length }}
                finding{{ findingsBySeverity[sev].length > 1 ? "s" : "" }}
              </span>
            </div>

            <div class="space-y-2">
              <div
                v-for="f in findingsBySeverity[sev]"
                :key="f.id"
                class="rounded-xl border border-border/50 bg-card overflow-hidden"
              >
                <!-- Finding header -->
                <button
                  type="button"
                  class="w-full p-4 flex items-start gap-3 text-left hover:bg-secondary/30 transition-colors"
                  @click="expandedId = expandedId === f.id ? null : f.id"
                >
                  <div
                    class="shrink-0 h-7 w-7 rounded-md flex items-center justify-center mt-0.5"
                    :class="[severityColors[f.severity].bg]"
                  >
                    <component
                      :is="categoryIcon[f.category]"
                      class="h-3.5 w-3.5"
                      :class="severityColors[f.severity].text"
                    />
                  </div>

                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="font-medium text-sm text-foreground"
                        >{{ f.title }}</span
                      >
                      <Badge
                        v-if="f.llmEnriched"
                        variant="outline"
                        class="text-[10px] px-1.5 py-0 border-primary/30 text-primary shrink-0"
                      >
                        AI
                      </Badge>
                    </div>
                    <div
                      v-if="f.file"
                      class="flex items-center gap-1 mt-0.5 text-xs font-mono text-muted-foreground"
                    >
                      <Code2 class="h-3 w-3" />
                      {{ f.file }}
                      <span v-if="f.line">:{{ f.line }}</span>
                    </div>
                  </div>

                  <ChevronRight
                    class="shrink-0 h-4 w-4 text-muted-foreground transition-transform"
                    :class="{ 'rotate-90': expandedId === f.id }"
                  />
                </button>

                <!-- Expanded details -->
                <div
                  v-if="expandedId === f.id"
                  class="px-4 pb-4 space-y-3 border-t border-border/50"
                >
                  <p class="text-sm text-muted-foreground pt-3 leading-relaxed">
                    {{ f.description }}
                  </p>

                  <div
                    v-if="f.snippet"
                    class="rounded-lg bg-background border border-border/50 overflow-hidden"
                  >
                    <div
                      class="px-3 py-1.5 border-b border-border/50 flex items-center justify-between"
                    >
                      <span class="text-xs font-mono text-muted-foreground">
                        {{ f.file }}<span v-if="f.line">:{{ f.line }}</span>
                      </span>
                    </div>
                    <pre
                      class="p-3 text-xs font-mono text-foreground overflow-x-auto leading-relaxed"
                    >{{ f.snippet }}</pre>
                  </div>

                  <div
                    class="p-3 rounded-lg bg-primary/5 border border-primary/20"
                  >
                    <p
                      class="text-xs font-mono text-primary mb-1 font-semibold"
                    >
                      REMEDIATION
                    </p>
                    <p class="text-sm text-foreground leading-relaxed">
                      {{ f.remediation }}
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    class="w-full gap-2 font-mono text-xs border-border/50 text-muted-foreground hover:text-foreground"
                    @click.stop="openIssue(f)"
                  >
                    <Github class="h-3.5 w-3.5" />
                    Open GitHub Issue
                  </Button>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </template>
  </div>
</template>

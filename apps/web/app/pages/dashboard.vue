<script setup lang="ts">
import {
  AlertTriangle,
  GitBranch,
  Play,
  RefreshCw,
  Search,
  Settings2,
  Shield,
  ShieldAlert,
  ShieldCheck,
} from "lucide-vue-next";
import { toast } from "vue-sonner";

useHead({ title: "Dashboard — Trespass" });

definePageMeta({ middleware: ["auth"] });

const { $authClient } = useNuxtApp();
const config = useRuntimeConfig();
const session = $authClient.useSession();

const BASE = config.public.serverUrl;

interface ScanSummary {
  critical: number;
  high: number;
  low: number;
  medium: number;
  total: number;
}

interface Repo {
  fullName: string;
  id: string;
  isPrivate: boolean;
  language: string | null;
  lastScan?: {
    id: string;
    status: string;
    summary: ScanSummary | null;
    finishedAt: string | null;
  };
  name: string;
}

const repos = ref<Repo[]>([]);
const search = ref("");
const loadingRepos = ref(true);
const syncing = ref(false);
const scanningId = ref<string | null>(null);

const hasLlm = ref(false);
const llmModel = ref<string | null>(null);
const pendingScanRepo = ref<Repo | null>(null);
const scanDialogOpen = ref(false);

const filteredRepos = computed(() => {
  const q = search.value.toLowerCase();
  if (!q) {
    return repos.value;
  }
  return repos.value.filter((r) => r.fullName.toLowerCase().includes(q));
});

async function fetchRepos() {
  try {
    const res = await $fetch<Repo[]>(`${BASE}/api/repos`, {
      credentials: "include",
    });
    repos.value = res ?? [];
  } catch {
    toast.error("Failed to load repositories");
  } finally {
    loadingRepos.value = false;
  }
}

async function syncRepos() {
  syncing.value = true;
  try {
    await $fetch(`${BASE}/api/repos/sync`, {
      method: "POST",
      credentials: "include",
    });
    toast.success("Repositories synced");
    await fetchRepos();
  } catch {
    toast.error(
      "Sync failed — make sure your GitHub PAT is configured in Settings"
    );
  } finally {
    syncing.value = false;
  }
}

function startScan(repo: Repo) {
  if (!hasLlm.value) {
    executeScan(repo, false);
    return;
  }
  pendingScanRepo.value = repo;
  scanDialogOpen.value = true;
}

async function executeScan(repo: Repo, withLlm: boolean) {
  scanningId.value = repo.id;
  scanDialogOpen.value = false;
  try {
    const res = await $fetch<{ scan: { id: string } }>(`${BASE}/api/scans`, {
      method: "POST",
      body: { repoId: repo.id, includeLlm: withLlm },
      credentials: "include",
    });
    navigateTo(`/scans/${res.scan.id}`);
  } catch {
    toast.error("Failed to start scan");
    scanningId.value = null;
  }
}

async function fetchSecretStatus() {
  try {
    const status = await $fetch<{
      hasLlmKey: boolean;
      llmModel: string | null;
    }>(`${BASE}/api/me/secrets/status`, { credentials: "include" });
    hasLlm.value = status.hasLlmKey;
    llmModel.value = status.llmModel;
  } catch {
    // non-critical — scan still works without LLM flag
  }
}

onMounted(() => {
  fetchRepos();
  fetchSecretStatus();
});

function severityColor(s: string) {
  return (
    {
      critical: "text-red-400",
      high: "text-orange-400",
      medium: "text-yellow-400",
      low: "text-blue-400",
    }[s] ?? "text-muted-foreground"
  );
}
</script>

<template>
  <div class="container mx-auto px-4 py-8 max-w-5xl">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold font-mono text-foreground">Dashboard</h1>
        <p class="text-sm text-muted-foreground mt-0.5">
          Welcome back,
          <span class="text-foreground">{{ session.data?.user.name }}</span>
        </p>
      </div>
      <div class="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          class="border-border/50 font-mono text-xs gap-2"
          :disabled="syncing"
          @click="syncRepos"
        >
          <RefreshCw class="h-3.5 w-3.5" :class="{ 'animate-spin': syncing }" />
          {{ syncing ? "Syncing..." : "Sync Repos" }}
        </Button>
        <Button
          size="sm"
          as-child
          class="bg-primary text-primary-foreground hover:bg-primary/90 font-mono text-xs gap-2"
        >
          <NuxtLink to="/settings">
            <Settings2 class="h-3.5 w-3.5" />
            Configure
          </NuxtLink>
        </Button>
      </div>
    </div>

    <div v-if="!loadingRepos && repos.length > 0" class="relative mb-4">
      <Search
        class="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none"
      />
      <Input
        v-model="search"
        placeholder="Filter repositories..."
        class="pl-9 font-mono text-sm bg-background border-border/50"
      />
    </div>

    <!-- Loading skeleton -->
    <div v-if="loadingRepos" class="grid gap-3">
      <div
        v-for="i in 3"
        :key="i"
        class="h-20 rounded-xl border border-border/50 bg-card animate-pulse"
      />
    </div>

    <!-- Empty state -->
    <div
      v-else-if="repos.length === 0"
      class="text-center py-16 border border-border/50 rounded-xl bg-card"
    >
      <Shield class="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
      <h3 class="font-mono font-semibold text-foreground mb-2">
        No repositories
      </h3>
      <p class="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
        Add a GitHub PAT in Settings, then sync your repositories to start
        scanning.
      </p>
      <div class="flex items-center justify-center gap-3">
        <Button
          variant="outline"
          size="sm"
          as-child
          class="border-border/50 font-mono text-xs"
        >
          <NuxtLink to="/settings">Add PAT</NuxtLink>
        </Button>
        <Button
          size="sm"
          class="bg-primary text-primary-foreground hover:bg-primary/90 font-mono text-xs gap-2"
          :disabled="syncing"
          @click="syncRepos"
        >
          <RefreshCw class="h-3.5 w-3.5" :class="{ 'animate-spin': syncing }" />
          Sync Repos
        </Button>
      </div>
    </div>

    <!-- No search match -->
    <div
      v-else-if="filteredRepos.length === 0"
      class="text-center py-12 text-sm text-muted-foreground font-mono"
    >
      No repositories match "{{ search }}"
    </div>

    <!-- Repo list -->
    <div v-else class="space-y-3">
      <SpotlightCard
        v-for="repo in filteredRepos"
        :key="repo.id"
        class="cursor-pointer"
      >
        <div class="p-4 flex items-center justify-between gap-4">
          <div class="flex items-center gap-3 min-w-0">
            <div
              class="shrink-0 h-9 w-9 rounded-lg border border-border/50 bg-secondary flex items-center justify-center"
            >
              <GitBranch class="h-4 w-4 text-muted-foreground" />
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span
                  class="font-mono font-medium text-sm text-foreground truncate"
                >
                  {{ repo.fullName }}
                </span>
                <Badge
                  v-if="repo.isPrivate"
                  variant="outline"
                  class="text-[10px] px-1.5 py-0 border-border/50 text-muted-foreground shrink-0"
                >
                  private
                </Badge>
              </div>
              <div class="flex items-center gap-2 mt-0.5">
                <span
                  v-if="repo.language"
                  class="text-xs text-muted-foreground font-mono"
                >
                  {{ repo.language }}
                </span>
              </div>
            </div>
          </div>

          <!-- Last scan status -->
          <div class="shrink-0 flex items-center gap-3">
            <template v-if="repo.lastScan?.summary">
              <div class="hidden sm:flex items-center gap-2 text-xs font-mono">
                <span
                  v-if="repo.lastScan.summary.critical > 0"
                  class="text-red-400"
                >
                  {{ repo.lastScan.summary.critical }}C
                </span>
                <span
                  v-if="repo.lastScan.summary.high > 0"
                  class="text-orange-400"
                >
                  {{ repo.lastScan.summary.high }}H
                </span>
                <span
                  v-if="repo.lastScan.summary.medium > 0"
                  class="text-yellow-400"
                >
                  {{ repo.lastScan.summary.medium }}M
                </span>
                <span
                  v-if="
                    repo.lastScan.summary.critical === 0 &&
                    repo.lastScan.summary.high === 0 &&
                    repo.lastScan.summary.medium === 0
                  "
                  class="text-primary"
                >
                  Clean
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                as-child
                class="font-mono text-xs text-muted-foreground hover:text-foreground"
              >
                <NuxtLink :to="`/scans/${repo.lastScan.id}`">View →</NuxtLink>
              </Button>
            </template>
            <template v-else-if="repo.lastScan?.status === 'running'">
              <span class="text-xs text-primary font-mono animate-pulse"
                >Scanning...</span
              >
              <Button
                variant="ghost"
                size="sm"
                as-child
                class="font-mono text-xs text-muted-foreground hover:text-foreground"
              >
                <NuxtLink :to="`/scans/${repo.lastScan.id}`">View →</NuxtLink>
              </Button>
            </template>
            <template v-else>
              <Button
                size="sm"
                class="shrink-0 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30 font-mono text-xs gap-1.5"
                :disabled="scanningId === repo.id"
                @click="startScan(repo)"
              >
                <Play class="h-3.5 w-3.5" />
                {{ scanningId === repo.id ? "Starting..." : "Scan" }}
              </Button>
            </template>
          </div>
        </div>
      </SpotlightCard>
    </div>
  </div>

  <ScanLlmDialog
    :open="scanDialogOpen"
    :title="`Scan — ${pendingScanRepo?.name}`"
    :llm-model="llmModel"
    :disabled="scanningId === pendingScanRepo?.id"
    @update:open="scanDialogOpen = $event"
    @skip="pendingScanRepo && executeScan(pendingScanRepo, false)"
    @include="pendingScanRepo && executeScan(pendingScanRepo, true)"
  />
</template>

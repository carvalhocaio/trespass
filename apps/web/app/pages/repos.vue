<script setup lang="ts">
import {
  GitBranch,
  Lock,
  Play,
  RefreshCw,
  Search,
  Shield,
} from "lucide-vue-next";
import { toast } from "vue-sonner";

useHead({ title: "Repositories — Trespass" });
definePageMeta({ middleware: ["auth"] });

const config = useRuntimeConfig();
const BASE = config.public.serverUrl;
const route = useRoute();

interface Repo {
  defaultBranch: string;
  fullName: string;
  id: string;
  isPrivate: boolean;
  language: string | null;
  name: string;
}

const repos = ref<Repo[]>([]);
const search = ref("");
const loading = ref(true);
const syncing = ref(false);
const scanningId = ref<string | null>(null);

const filteredRepos = computed(() => {
  const q = search.value.toLowerCase();
  if (!q) {
    return repos.value;
  }
  return repos.value.filter((r) => r.fullName.toLowerCase().includes(q));
});

async function fetchRepos() {
  loading.value = true;
  try {
    const res = await $fetch<Repo[]>(`${BASE}/api/repos`, {
      credentials: "include",
    });
    repos.value = res ?? [];

    if (route.query.scan) {
      const target = repos.value.find((r) => r.id === route.query.scan);
      if (target) {
        await startScan(target);
      }
    }
  } catch {
    toast.error("Failed to load repositories");
  } finally {
    loading.value = false;
  }
}

async function syncRepos() {
  syncing.value = true;
  try {
    await $fetch(`${BASE}/api/repos/sync`, {
      method: "POST",
      credentials: "include",
    });
    toast.success("Synced");
    await fetchRepos();
  } catch {
    toast.error("Sync failed — check your GitHub PAT in Settings");
  } finally {
    syncing.value = false;
  }
}

async function startScan(repo: Repo) {
  scanningId.value = repo.id;
  try {
    const res = await $fetch<{ scan: { id: string } }>(`${BASE}/api/scans`, {
      method: "POST",
      body: { repoId: repo.id },
      credentials: "include",
    });
    toast.success(`Scan started for ${repo.name}`);
    navigateTo(`/scans/${res.scan.id}`);
  } catch {
    toast.error("Failed to start scan");
    scanningId.value = null;
  }
}

onMounted(fetchRepos);
</script>

<template>
  <div class="container mx-auto px-4 py-8 max-w-4xl">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold font-mono text-foreground">
          Repositories
        </h1>
        <p class="text-sm text-muted-foreground mt-0.5">
          Select a repository to start a security scan.
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        class="border-border/50 font-mono text-xs gap-2"
        :disabled="syncing"
        @click="syncRepos"
      >
        <RefreshCw class="h-3.5 w-3.5" :class="{ 'animate-spin': syncing }" />
        Sync
      </Button>
    </div>

    <div v-if="!loading && repos.length > 0" class="relative mb-4">
      <Search
        class="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none"
      />
      <Input
        v-model="search"
        placeholder="Filter repositories..."
        class="pl-9 font-mono text-sm bg-background border-border/50"
      />
    </div>

    <div v-if="loading" class="grid gap-3">
      <div
        v-for="i in 5"
        :key="i"
        class="h-16 rounded-xl border border-border/50 bg-card animate-pulse"
      />
    </div>

    <div
      v-else-if="repos.length === 0"
      class="text-center py-16 border border-border/50 rounded-xl bg-card"
    >
      <Shield class="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
      <h3 class="font-mono font-semibold text-foreground mb-2">
        No repositories found
      </h3>
      <p class="text-sm text-muted-foreground mb-4">
        Add a GitHub PAT in Settings, then sync.
      </p>
      <Button variant="outline" size="sm" as-child class="font-mono text-xs">
        <NuxtLink to="/settings">Go to Settings</NuxtLink>
      </Button>
    </div>

    <div
      v-else-if="filteredRepos.length === 0"
      class="text-center py-12 text-sm text-muted-foreground font-mono"
    >
      No repositories match "{{ search }}"
    </div>

    <div v-else class="space-y-2">
      <SpotlightCard v-for="repo in filteredRepos" :key="repo.id">
        <div class="p-4 flex items-center justify-between gap-4">
          <div class="flex items-center gap-3 min-w-0">
            <GitBranch class="h-4 w-4 text-muted-foreground shrink-0" />
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-mono text-sm text-foreground truncate">
                  {{ repo.fullName }}
                </span>
                <Lock
                  v-if="repo.isPrivate"
                  class="h-3 w-3 text-muted-foreground shrink-0"
                />
              </div>
              <div
                class="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground font-mono"
              >
                <span v-if="repo.language">{{ repo.language }}</span>
                <span>{{ repo.defaultBranch }}</span>
              </div>
            </div>
          </div>

          <Button
            size="sm"
            class="shrink-0 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30 font-mono text-xs gap-1.5"
            :disabled="scanningId === repo.id"
            @click="startScan(repo)"
          >
            <Play class="h-3.5 w-3.5" />
            {{ scanningId === repo.id ? "Starting..." : "Scan" }}
          </Button>
        </div>
      </SpotlightCard>
    </div>
  </div>
</template>

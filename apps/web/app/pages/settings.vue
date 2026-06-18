<script setup lang="ts">
import { Eye, EyeOff, KeyRound, Lock, Save } from "lucide-vue-next";
import { toast } from "vue-sonner";

useHead({ title: "Settings — Trespass" });
definePageMeta({ middleware: ["auth"] });

const config = useRuntimeConfig();
const BASE = config.public.serverUrl;

interface SecretsStatus {
  hasLlmKey: boolean;
  hasPat: boolean;
  llmModel: string | null;
  llmProvider: string | null;
}

const status = ref<SecretsStatus | null>(null);
const loadingStatus = ref(true);

const pat = ref("");
const showPat = ref(false);
const llmProvider = ref<"openai" | "anthropic" | "google">("openai");
const llmApiKey = ref("");
const llmModel = ref("");
const savingSecrets = ref(false);

const defaultModels: Record<string, string> = {
  openai: "gpt-4o",
  anthropic: "claude-sonnet-4-6",
  google: "gemini-2.0-flash",
};

watch(llmProvider, (p) => {
  llmModel.value = defaultModels[p] ?? "";
});

async function fetchStatus() {
  try {
    const res = await $fetch<SecretsStatus>(`${BASE}/api/me/secrets/status`, {
      credentials: "include",
    });
    status.value = res;
    if (res.llmProvider) {
      llmProvider.value = res.llmProvider as typeof llmProvider.value;
    }
    if (res.llmModel) {
      llmModel.value = res.llmModel;
    }
  } catch {
    toast.error("Failed to load settings");
  } finally {
    loadingStatus.value = false;
  }
}

async function saveSecrets() {
  savingSecrets.value = true;
  try {
    const body: Record<string, string> = {};
    if (pat.value) {
      body.githubPat = pat.value;
    }
    if (llmApiKey.value) {
      body.llmProvider = llmProvider.value;
      body.llmApiKey = llmApiKey.value;
      body.llmModel = llmModel.value || defaultModels[llmProvider.value] || "";
    }

    await $fetch(`${BASE}/api/me/secrets`, {
      method: "PUT",
      body,
      credentials: "include",
    });

    toast.success("Settings saved");
    pat.value = "";
    llmApiKey.value = "";
    await fetchStatus();
  } catch {
    toast.error("Failed to save settings");
  } finally {
    savingSecrets.value = false;
  }
}

onMounted(fetchStatus);
</script>

<template>
  <div class="container mx-auto px-4 py-8 max-w-2xl">
    <div class="mb-8">
      <h1 class="text-2xl font-bold font-mono text-foreground">Settings</h1>
      <p class="text-sm text-muted-foreground mt-0.5">
        Configure your API keys and tokens. All secrets are encrypted at rest.
      </p>
    </div>

    <div v-if="loadingStatus" class="space-y-4">
      <div
        class="h-40 rounded-xl border border-border/50 bg-card animate-pulse"
      />
      <div
        class="h-52 rounded-xl border border-border/50 bg-card animate-pulse"
      />
    </div>

    <form v-else class="space-y-6" @submit.prevent="saveSecrets">
      <!-- GitHub PAT -->
      <Card class="border-border/50">
        <CardHeader class="pb-3">
          <CardTitle class="font-mono text-sm flex items-center gap-2">
            <KeyRound class="h-4 w-4 text-primary" />
            GitHub Personal Access Token
          </CardTitle>
          <CardDescription>
            Required to scan private repositories. Needs
            <code class="text-primary font-mono text-xs">repo</code>
            scope.
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-3">
          <div
            v-if="status?.hasPat"
            class="flex items-center gap-2 p-2.5 rounded-md bg-primary/10 border border-primary/20 text-primary text-xs font-mono"
          >
            <Lock class="h-3.5 w-3.5" />
            PAT configured — enter a new one to replace it
          </div>
          <div class="relative">
            <Input
              v-model="pat"
              :type="showPat ? 'text' : 'password'"
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              class="bg-background border-border/50 font-mono text-sm pr-10"
            />
            <button
              type="button"
              class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              @click="showPat = !showPat"
            >
              <EyeOff v-if="showPat" class="h-4 w-4" />
              <Eye v-else class="h-4 w-4" />
            </button>
          </div>
        </CardContent>
      </Card>

      <!-- LLM config -->
      <Card class="border-border/50">
        <CardHeader class="pb-3">
          <CardTitle class="font-mono text-sm flex items-center gap-2">
            <KeyRound class="h-4 w-4 text-primary" />
            LLM Configuration
            <Badge
              variant="outline"
              class="text-[10px] px-1.5 py-0 border-primary/30 text-primary"
            >
              optional
            </Badge>
          </CardTitle>
          <CardDescription>
            Enables AI-powered code review on flagged files. Uses your own API
            key — we never store it in plaintext.
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div
            v-if="status?.hasLlmKey"
            class="flex items-center gap-2 p-2.5 rounded-md bg-primary/10 border border-primary/20 text-primary text-xs font-mono"
          >
            <Lock class="h-3.5 w-3.5" />
            LLM key configured ({{ status.llmProvider }}
            / {{ status.llmModel }})
          </div>

          <div class="space-y-1.5">
            <Label class="text-xs font-mono text-muted-foreground"
              >PROVIDER</Label
            >
            <div class="flex gap-2">
              <button
                v-for="p in ['openai', 'anthropic', 'google']"
                :key="p"
                type="button"
                class="px-3 py-1.5 rounded-md border text-xs font-mono transition-colors"
                :class="
                  llmProvider === p
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border/50 text-muted-foreground hover:border-border'
                "
                @click="llmProvider = p as typeof llmProvider"
              >
                {{ p }}
              </button>
            </div>
          </div>

          <div class="space-y-1.5">
            <Label for="llm-key" class="text-xs font-mono text-muted-foreground"
              >API KEY</Label
            >
            <Input
              id="llm-key"
              v-model="llmApiKey"
              type="password"
              placeholder="sk-..."
              class="bg-background border-border/50 font-mono text-sm"
            />
          </div>

          <div class="space-y-1.5">
            <Label
              for="llm-model"
              class="text-xs font-mono text-muted-foreground"
              >MODEL</Label
            >
            <Input
              id="llm-model"
              v-model="llmModel"
              type="text"
              :placeholder="defaultModels[llmProvider]"
              class="bg-background border-border/50 font-mono text-sm"
            />
          </div>
        </CardContent>
      </Card>

      <Button
        type="submit"
        class="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-mono text-sm gap-2"
        :disabled="savingSecrets || !(pat || llmApiKey)"
      >
        <Save class="h-4 w-4" />
        {{ savingSecrets ? "Saving..." : "Save Settings" }}
      </Button>
    </form>
  </div>
</template>

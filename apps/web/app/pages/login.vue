<script setup lang="ts">
import { Github, Lock, Shield } from "lucide-vue-next";

useHead({ title: "Sign In — Trespass" });

const { $authClient } = useNuxtApp();
const session = $authClient.useSession();

watchEffect(() => {
  if (!session?.value.isPending && session?.value.data) {
    navigateTo("/dashboard", { replace: true });
  }
});

const loading = ref(false);
const authError = ref("");

async function handleGithub() {
  loading.value = true;
  authError.value = "";
  const { origin } = useRequestURL();
  try {
    await $authClient.signIn.social({
      provider: "github",
      callbackURL: `${origin}/dashboard`,
    });
  } catch (e: unknown) {
    authError.value = e instanceof Error ? e.message : "GitHub sign-in failed";
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4">
    <!-- Radial glow -->
    <div
      class="absolute inset-0 bg-[radial-gradient(ellipse_50%_35%_at_50%_50%,oklch(0.69_0.185_147/0.07),transparent)] pointer-events-none"
    />

    <div class="w-full max-w-xs relative flex flex-col items-center gap-6">
      <!-- Logo -->
      <div class="flex flex-col items-center gap-3">
        <div
          class="flex items-center justify-center h-14 w-14 rounded-full border border-primary/20 bg-primary/10"
        >
          <Shield class="h-7 w-7 text-primary" />
        </div>
        <div class="text-center">
          <p
            class="text-xs font-mono tracking-widest text-muted-foreground/60 uppercase mb-1"
          >
            Trespass
          </p>
          <h1 class="text-xl font-bold font-mono text-foreground">
            Welcome back
          </h1>
          <p class="text-sm text-muted-foreground mt-0.5">
            Sign in to your account
          </p>
        </div>
      </div>

      <!-- Actions -->
      <div class="w-full flex flex-col gap-3">
        <Button
          class="w-full gap-2 font-mono bg-[#24292f] hover:bg-[#24292f]/90 text-white border border-[#30363d]"
          :disabled="loading"
          @click="handleGithub"
        >
          <Github class="h-4 w-4" />
          {{ loading ? "Redirecting..." : "Continue with GitHub" }}
        </Button>

        <div
          v-if="authError"
          class="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-xs"
        >
          <Lock class="h-3.5 w-3.5 shrink-0" />
          {{ authError }}
        </div>

        <p class="text-center text-xs text-muted-foreground/50">
          By continuing, you agree to our terms of service.
        </p>
      </div>
    </div>
  </div>
</template>

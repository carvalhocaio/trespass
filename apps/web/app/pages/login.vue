<script setup lang="ts">
import { Github, Lock, Shield } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { z } from "zod";

useHead({ title: "Sign In — Trespass" });

const { $authClient } = useNuxtApp();
const session = $authClient.useSession();

watchEffect(() => {
  if (!session?.value.isPending && session?.value.data) {
    navigateTo("/dashboard", { replace: true });
  }
});

const mode = ref<"signin" | "signup">("signin");
const loading = ref(false);
const githubLoading = ref(false);

const form = reactive({ name: "", email: "", password: "" });
const formError = ref("");

const signInSchema = z.object({
  email: z.email("Invalid email"),
  password: z.string().min(8, "Min 8 characters"),
});

const signUpSchema = z.object({
  name: z.string().min(2, "Min 2 characters"),
  email: z.email("Invalid email"),
  password: z.string().min(8, "Min 8 characters"),
});

async function handleGithub() {
  githubLoading.value = true;
  formError.value = "";
  try {
    await $authClient.signIn.social({
      provider: "github",
      callbackURL: "/dashboard",
    });
  } catch (e: unknown) {
    formError.value = e instanceof Error ? e.message : "GitHub sign-in failed";
    githubLoading.value = false;
  }
}

async function handleSubmit() {
  formError.value = "";
  loading.value = true;

  try {
    if (mode.value === "signin") {
      const parsed = signInSchema.safeParse(form);
      if (!parsed.success) {
        formError.value = parsed.error.issues[0]?.message ?? "Validation error";
        return;
      }
      await $authClient.signIn.email(
        { email: parsed.data.email, password: parsed.data.password },
        {
          onSuccess: () => navigateTo("/dashboard", { replace: true }),
          onError: (e: { error: { message: string } }) => {
            formError.value = e.error.message;
          },
        }
      );
    } else {
      const parsed = signUpSchema.safeParse(form);
      if (!parsed.success) {
        formError.value = parsed.error.issues[0]?.message ?? "Validation error";
        return;
      }
      await $authClient.signUp.email(
        {
          name: parsed.data.name,
          email: parsed.data.email,
          password: parsed.data.password,
        },
        {
          onSuccess: () => {
            toast.success("Account created! Sign in to continue.");
            mode.value = "signin";
          },
          onError: (e: { error: { message: string } }) => {
            formError.value = e.error.message;
          },
        }
      );
    }
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div
    class="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4 py-12"
  >
    <!-- Background glow -->
    <div
      class="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_50%,oklch(0.69_0.185_147/0.05),transparent)] pointer-events-none"
    />

    <div class="w-full max-w-md relative">
      <!-- Logo -->
      <div class="text-center mb-8">
        <div
          class="inline-flex items-center justify-center h-14 w-14 rounded-full border border-primary/30 bg-primary/10 mb-4"
        >
          <Shield class="h-7 w-7 text-primary" />
        </div>
        <h1 class="text-2xl font-bold font-mono text-foreground">
          {{ mode === "signin" ? "Welcome back" : "Create account" }}
        </h1>
        <p class="text-sm text-muted-foreground mt-1">
          {{ mode === "signin" ? "Sign in to your Trespass account" : "Start securing your repositories" }}
        </p>
      </div>

      <Card class="border-border/50">
        <CardContent class="pt-6 pb-6 space-y-4">
          <!-- GitHub OAuth -->
          <Button
            class="w-full gap-2 font-mono bg-[#24292f] hover:bg-[#24292f]/90 text-white border border-[#30363d]"
            :disabled="githubLoading"
            @click="handleGithub"
          >
            <Github class="h-4 w-4" />
            {{ githubLoading ? "Redirecting..." : "Continue with GitHub" }}
          </Button>

          <div class="relative">
            <div class="absolute inset-0 flex items-center">
              <Separator class="w-full" />
            </div>
            <div class="relative flex justify-center text-xs">
              <span class="bg-card px-2 text-muted-foreground"
                >or continue with email</span
              >
            </div>
          </div>

          <!-- Email form -->
          <form class="space-y-3" @submit.prevent="handleSubmit">
            <div v-if="mode === 'signup'" class="space-y-1.5">
              <Label for="name" class="text-xs font-mono text-muted-foreground"
                >NAME</Label
              >
              <Input
                id="name"
                v-model="form.name"
                type="text"
                placeholder="Your name"
                class="bg-background border-border/50 font-mono text-sm"
                autocomplete="name"
              />
            </div>

            <div class="space-y-1.5">
              <Label for="email" class="text-xs font-mono text-muted-foreground"
                >EMAIL</Label
              >
              <Input
                id="email"
                v-model="form.email"
                type="email"
                placeholder="you@example.com"
                class="bg-background border-border/50 font-mono text-sm"
                autocomplete="email"
              />
            </div>

            <div class="space-y-1.5">
              <Label
                for="password"
                class="text-xs font-mono text-muted-foreground"
                >PASSWORD</Label
              >
              <Input
                id="password"
                v-model="form.password"
                type="password"
                placeholder="••••••••"
                class="bg-background border-border/50 font-mono text-sm"
                autocomplete="current-password"
              />
            </div>

            <div
              v-if="formError"
              class="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm"
            >
              <Lock class="h-3.5 w-3.5 shrink-0" />
              {{ formError }}
            </div>

            <Button
              type="submit"
              class="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-mono text-sm"
              :disabled="loading"
            >
              <template v-if="loading">...</template>
              <template v-else-if="mode === 'signin'">Sign In</template>
              <template v-else>Create Account</template>
            </Button>
          </form>

          <p class="text-center text-xs text-muted-foreground">
            <template v-if="mode === 'signin'">
              No account?
              <button
                type="button"
                class="text-primary hover:underline font-medium"
                @click="() => { mode = 'signup'; formError = ''; }"
              >
                Sign up
              </button>
            </template>
            <template v-else>
              Already have an account?
              <button
                type="button"
                class="text-primary hover:underline font-medium"
                @click="() => { mode = 'signin'; formError = ''; }"
              >
                Sign in
              </button>
            </template>
          </p>
        </CardContent>
      </Card>
    </div>
  </div>
</template>

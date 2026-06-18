<script setup lang="ts">
import { Shield } from "lucide-vue-next";

import UserMenu from "./UserMenu.vue";

const route = useRoute();

const navLinks = [{ label: "Dashboard", to: "/dashboard" }];
</script>

<template>
  <header
    class="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-sm"
  >
    <div class="container mx-auto px-4 h-14 flex items-center justify-between">
      <div class="flex items-center gap-6">
        <NuxtLink to="/" class="flex items-center gap-2 group">
          <Shield
            class="h-5 w-5 text-primary group-hover:text-primary/80 transition-colors"
          />
          <span
            class="font-mono font-bold text-sm tracking-wider text-foreground group-hover:text-primary transition-colors"
          >
            TRESPASS
          </span>
        </NuxtLink>

        <nav class="hidden md:flex items-center gap-1">
          <NuxtLink
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
            :class="
              route.path.startsWith(link.to)
                ? 'text-primary bg-primary/10'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            "
          >
            {{ link.label }}
          </NuxtLink>
        </nav>
      </div>

      <UserMenu />
    </div>
  </header>
</template>

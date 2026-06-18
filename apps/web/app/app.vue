<script setup lang="ts">
import { Toaster } from "vue-sonner";
</script>

<template>
  <NuxtAnnouncer />
  <NuxtRouteAnnouncer />
  <NuxtLoadingIndicator color="#22c55e" />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <ClientOnly>
    <Toaster position="bottom-right" rich-colors />
  </ClientOnly>
</template>

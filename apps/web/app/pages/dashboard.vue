<script setup lang="ts">
const { $authClient, $orpc } = useNuxtApp();

definePageMeta({
  middleware: ["auth"],
});

const session = $authClient.useSession();
</script>

<template>
  <UContainer class="py-8">
    <UPageHeader
      title="Dashboard"
      :description="session?.data?.user ? `Welcome back, ${session.data.user.name}!` : 'Loading...'"
    />

    <div class="mt-6 space-y-4"></div>
  </UContainer>
</template>

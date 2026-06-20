<script setup lang="ts"></script>

<template>
  <div class="min-h-screen flex flex-col">
    <Header />
    <main class="flex-1 bg-card">
      <slot />
    </main>
  </div>
</template>

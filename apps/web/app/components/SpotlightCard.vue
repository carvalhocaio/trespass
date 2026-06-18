<script setup lang="ts">
const cardRef = ref<HTMLDivElement | null>(null);
const mouseX = ref(0);
const mouseY = ref(0);
const isHovering = ref(false);

function onMouseMove(e: MouseEvent) {
  if (!cardRef.value) {
    return;
  }
  const rect = cardRef.value.getBoundingClientRect();
  mouseX.value = e.clientX - rect.left;
  mouseY.value = e.clientY - rect.top;
}
</script>

<template>
  <div
    ref="cardRef"
    class="relative rounded-xl border border-border/50 bg-card overflow-hidden transition-border duration-300 hover:border-primary/30"
    @mousemove="onMouseMove"
    @mouseenter="isHovering = true"
    @mouseleave="isHovering = false"
  >
    <!-- Spotlight overlay -->
    <div
      class="pointer-events-none absolute inset-0 transition-opacity duration-300 rounded-xl"
      :style="{
        opacity: isHovering ? 1 : 0,
        background: `radial-gradient(350px circle at ${mouseX}px ${mouseY}px, oklch(0.69 0.185 147 / 0.07), transparent 80%)`,
      }"
    />
    <slot />
  </div>
</template>

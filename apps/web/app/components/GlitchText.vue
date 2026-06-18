<script setup lang="ts">
const props = defineProps<{ text: string }>();

const chars =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&!?<>";
const displayed = ref(props.text);
let interval: ReturnType<typeof setInterval> | null = null;

function startGlitch() {
  let i = 0;
  if (interval) {
    clearInterval(interval);
  }

  interval = setInterval(() => {
    displayed.value = props.text
      .split("")
      .map((char, idx) => {
        if (idx < i) {
          return char;
        }
        return chars[Math.floor(Math.random() * chars.length)] ?? char;
      })
      .join("");

    if (i >= props.text.length) {
      if (interval) {
        clearInterval(interval);
      }
      displayed.value = props.text;
    }
    i += 0.5;
  }, 30);
}
</script>

<template>
  <span class="font-mono cursor-default select-none" @mouseenter="startGlitch"
    >{{ displayed }}</span
  >
</template>

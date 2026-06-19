<script setup lang="ts">
defineProps<{
  open: boolean;
  title: string;
  llmModel: string | null;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  skip: [];
  include: [];
}>();
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-w-sm" :show-close-button="false">
      <DialogHeader>
        <DialogTitle class="font-mono">{{ title }}</DialogTitle>
        <DialogDescription>
          Include LLM review
          <span v-if="llmModel" class="font-mono text-foreground"
            >({{ llmModel }})</span
          >
          in this scan?
        </DialogDescription>
      </DialogHeader>

      <DialogFooter class="gap-2 sm:gap-2">
        <Button
          variant="outline"
          size="sm"
          class="font-mono"
          :disabled="disabled"
          @click="emit('skip')"
        >
          No, skip
        </Button>
        <Button
          size="sm"
          class="bg-primary text-primary-foreground hover:bg-primary/90 font-mono"
          :disabled="disabled"
          @click="emit('include')"
        >
          Yes, include
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

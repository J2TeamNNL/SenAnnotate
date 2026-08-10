<script setup lang="ts">
defineProps<{ label: string; variant?: string }>()
</script>

<template>
  <button class="base-button">{{ label }}</button>
</template>

<style scoped>
.base-button {
  display: block;
  width: 100%;
  margin-bottom: 8px;
  padding: 8px 12px;
  border: 1px solid #d0d4da;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
}
</style>

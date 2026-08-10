<script setup lang="ts">
import BaseButton from './BaseButton.vue'
</script>

<template>
  <aside class="sidebar">
    <h2 class="sidebar__title">Navigation</h2>
    <BaseButton label="Save changes" variant="primary" />
    <BaseButton label="Discard" />
  </aside>
</template>

<style scoped>
.sidebar {
  width: 220px;
  padding: 20px;
  background: #f4f5f7;
  border-right: 1px solid #e2e4e8;
}
.sidebar__title {
  margin: 0 0 12px;
  font-size: 13px;
  text-transform: uppercase;
  color: #64748b;
}
</style>

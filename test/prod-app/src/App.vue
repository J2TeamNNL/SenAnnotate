<script setup lang="ts">
import TheSidebar from './components/TheSidebar.vue'
</script>

<template>
  <div class="layout">
    <TheSidebar />
    <main class="content">
      <h1 id="headline">Dashboard</h1>
      <p class="intro">A production build, used to measure what survives minification.</p>
    </main>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  min-height: 100vh;
}
.content {
  flex: 1;
  padding: 32px;
}
</style>

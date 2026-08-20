<template>
  <div class="admin-layout flex">
    <AdminSidebar class="admin-layout-sidebar" />
    <main class="admin-main flex-1 p-6">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import AdminSidebar from './AdminSidebar.vue';
</script>

<style scoped>
.admin-layout {
  min-height: calc(100vh - 70px);
  background: var(--gray-50);
}
.admin-main {
  max-width: 1300px;
  margin: 0 auto;
}
</style>

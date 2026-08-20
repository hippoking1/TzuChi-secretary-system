<template>
  <div class="app-root flex flex-col min-h-screen">
    <OfflineIndicator />
    <AppHeader />
    <main class="app-content flex-1">
      <router-view />
    </main>
    <AppFooter />
    <ToastNotification />
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import AppHeader from '@/components/layout/AppHeader.vue';
import AppFooter from '@/components/layout/AppFooter.vue';
import OfflineIndicator from '@/components/shared/OfflineIndicator.vue';
import ToastNotification from '@/components/ui/ToastNotification.vue';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();

onMounted(async () => {
  await authStore.init();
});
</script>

<style>
@import '@/styles/variables.css';
@import '@/styles/base.css';
@import '@/styles/components.css';
@import '@/styles/responsive.css';

.min-h-screen {
  min-height: 100vh;
}
</style>

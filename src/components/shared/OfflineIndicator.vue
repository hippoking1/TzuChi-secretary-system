<template>
  <div v-if="!isOnline" class="offline-banner">
    <span>⚠️ 目前為離線狀態，已啟用本機離線快取，恢復連線後將自動同步。</span>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const isOnline = ref(navigator.onLine);

function updateOnlineStatus() {
  isOnline.value = navigator.onLine;
}

onMounted(() => {
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
});

onUnmounted(() => {
  window.removeEventListener('online', updateOnlineStatus);
  window.removeEventListener('offline', updateOnlineStatus);
});
</script>

<style scoped>
.offline-banner {
  background-color: var(--warning);
  color: #78350f;
  text-align: center;
  padding: 0.5rem 1rem;
  font-weight: 600;
  font-size: 0.85rem;
  position: sticky;
  top: 0;
  z-index: 1000;
}
</style>

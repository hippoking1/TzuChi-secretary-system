<template>
  <div v-if="active" class="loading-overlay">
    <div class="spinner-box">
      <div class="spinner"></div>
      <p class="spinner-text">{{ text }}</p>
    </div>
  </div>
</template>

<script setup>
defineProps({
  active: { type: Boolean, default: false },
  text: { type: String, default: '資料讀取中...' }
});
</script>

<style scoped>
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9998;
}

.spinner-box {
  background: #ffffff;
  padding: 2rem 2.5rem;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.spinner {
  width: 44px;
  height: 44px;
  border: 4px solid var(--gray-200);
  border-top-color: var(--primary-500);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.spinner-text {
  color: var(--gray-700);
  font-weight: 600;
  font-size: 0.95rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>

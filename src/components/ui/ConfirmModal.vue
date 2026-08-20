<template>
  <div v-if="isOpen" class="modal-backdrop" @click="handleBackdropClick">
    <div class="modal-content" role="dialog" aria-modal="true" @click.stop>
      <div class="modal-header">
        <h3 class="modal-title">{{ title }}</h3>
        <button class="modal-close" @click="cancel">×</button>
      </div>
      <div class="modal-body">
        <p>{{ message }}</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" @click="cancel">{{ cancelText }}</button>
        <button class="btn" :class="isDanger ? 'btn-danger' : 'btn-primary'" @click="confirm">
          {{ confirmText }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue';

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  title: { type: String, default: '確認操作' },
  message: { type: String, default: '您確定要執行此操作嗎？' },
  confirmText: { type: String, default: '確定' },
  cancelText: { type: String, default: '取消' },
  isDanger: { type: Boolean, default: false }
});

const emit = defineEmits(['confirm', 'cancel']);

function confirm() { emit('confirm'); }
function cancel() { emit('cancel'); }

function handleBackdropClick() { cancel(); }

function handleKeyDown(e) {
  if (e.key === 'Escape' && props.isOpen) {
    cancel();
  }
}

onMounted(() => window.addEventListener('keydown', handleKeyDown));
onUnmounted(() => window.removeEventListener('keydown', handleKeyDown));
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(15, 23, 42, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9990;
  padding: 1rem;
}

.modal-content {
  background: #ffffff;
  border-radius: var(--radius-lg);
  max-width: 480px;
  width: 100%;
  box-shadow: var(--shadow-xl);
  overflow: hidden;
  animation: modalIn 0.2s ease-out;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--gray-200);
}

.modal-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--gray-800);
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--gray-400);
  cursor: pointer;
}
.modal-close:hover { color: var(--gray-700); }

.modal-body {
  padding: 1.5rem;
  color: var(--gray-600);
  font-size: 0.95rem;
  line-height: 1.6;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  background: var(--gray-50);
  border-top: 1px solid var(--gray-200);
}

@keyframes modalIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
</style>

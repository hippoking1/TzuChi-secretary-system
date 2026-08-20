import { ref } from 'vue';

const toasts = ref([]);

export function useToast() {
  function show(message, type = 'info', duration = 3500) {
    const id = Date.now() + Math.random().toString(36).substring(2, 7);
    toasts.value.push({ id, message, type });
    if (duration > 0) {
      setTimeout(() => {
        remove(id);
      }, duration);
    }
  }

  function remove(id) {
    toasts.value = toasts.value.filter(t => t.id !== id);
  }

  return {
    toasts,
    show,
    success: (msg, dur) => show(msg, 'success', dur),
    error: (msg, dur) => show(msg, 'danger', dur),
    warning: (msg, dur) => show(msg, 'warning', dur),
    info: (msg, dur) => show(msg, 'info', dur),
    remove
  };
}

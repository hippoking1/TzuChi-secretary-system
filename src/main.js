import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { registerSW } from 'virtual:pwa-register';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);

app.mount('#app');

// 自動更新 Service Worker 策略 (有新版本時自動背景啟用並無感刷新，無需清除 Cookie)
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('[PWA] 檢測到系統新版本，自動套用最新版...');
    updateSW(true);
  },
  onOfflineReady() {
    console.log('[PWA] 系統已就緒可離線運行');
  }
});

// 當使用者重新回到視窗時，自動檢查伺服器是否有新版本發佈
if (typeof window !== 'undefined' && 'addEventListener' in window) {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      updateSW();
    }
  });
}

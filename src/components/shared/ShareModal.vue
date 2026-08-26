<template>
  <div v-if="show" class="modal-backdrop" @click="close">
    <div class="modal-content share-modal-box" @click.stop>
      <div class="modal-header">
        <h3 class="modal-title">📤 分享活動報名連結</h3>
        <button class="modal-close" @click="close">×</button>
      </div>

      <div class="modal-body text-center">
        <!-- 活動基本簡介卡片 -->
        <div class="event-summary-card mb-4 text-left">
          <div class="badge badge-info mb-1">{{ event?.category || '活動' }}</div>
          <h4 class="font-bold text-base text-gray-900 mb-1">{{ event?.title }}</h4>
          <p class="text-xs text-muted">
            🗓️ {{ event?.eventDate }} {{ event?.eventStartTime }} ~ {{ event?.eventEndTime }} | 📍 {{ event?.location }}
          </p>
        </div>

        <!-- QR Code 報名碼 -->
        <div class="qr-code-wrapper mb-4">
          <img 
            :src="qrCodeUrl" 
            alt="報名 QR Code" 
            class="qr-image"
          />
          <p class="text-xs text-muted mt-2">手機掃描上方 QR Code 即可直接進入報名頁面</p>
        </div>

        <!-- 網址複製列 -->
        <div class="share-url-bar flex items-center gap-2 mb-4">
          <input 
            type="text" 
            readonly 
            :value="registrationUrl" 
            class="form-input form-input-sm share-input" 
            @focus="$event.target.select()"
          />
          <button class="btn btn-sm btn-primary whitespace-nowrap" @click="copyLink">
            📋 複製連結
          </button>
        </div>

        <!-- 快捷分享按鈕群 -->
        <div class="share-actions-grid grid grid-cols-2 gap-3">
          <button class="btn btn-line-share flex items-center justify-center gap-2" @click="shareToLine">
            <span class="line-icon">💬</span> 分享至 LINE
          </button>

          <button class="btn btn-outline flex items-center justify-center gap-2" @click="copyFullText">
            <span>📝</span> 複製活動文案
          </button>

          <button v-if="canNativeShare" class="btn btn-outline-primary col-span-2 flex items-center justify-center gap-2" @click="nativeShare">
            <span>📱</span> 使用手機原生分享
          </button>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-outline btn-sm" @click="close">關閉</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useToast } from '@/composables/useToast';

const props = defineProps({
  show: { type: Boolean, default: false },
  event: { type: Object, default: null }
});

const emit = defineEmits(['update:show', 'close']);
const toast = useToast();

const registrationUrl = computed(() => {
  if (!props.event?.id) return window.location.href;
  const baseUrl = window.location.origin + window.location.pathname;
  // 支援 Hash 模式路由
  return `${baseUrl}#/register/${props.event.id}`;
});

const qrCodeUrl = computed(() => {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(registrationUrl.value)}`;
});

const canNativeShare = computed(() => {
  return typeof navigator !== 'undefined' && !!navigator.share;
});

const shareMessageText = computed(() => {
  const e = props.event;
  if (!e) return '';
  return `【慈濟活動線上報名】\n活動名稱：${e.title}\n舉辦日期：${e.eventDate} ${e.eventStartTime || ''} ~ ${e.eventEndTime || ''}\n舉辦地點：${e.location || '待定'}\n誠摯邀請師兄師姊與會眾大德共同參與！\n\n👉 立即線上報名：${registrationUrl.value}`;
});

function close() {
  emit('update:show', false);
  emit('close');
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(registrationUrl.value);
    toast.success('已成功複製報名連結！');
  } catch {
    toast.info('請手動選取網址進行複製');
  }
}

async function copyFullText() {
  try {
    await navigator.clipboard.writeText(shareMessageText.value);
    toast.success('已複製完整活動報名文案，可直接貼至 LINE 記事本或群組！');
  } catch {
    copyLink();
  }
}

function shareToLine() {
  const text = encodeURIComponent(shareMessageText.value);
  const lineShareUrl = `https://line.me/R/msg/text/?${text}`;
  window.open(lineShareUrl, '_blank');
}

async function nativeShare() {
  if (!canNativeShare.value) return;
  try {
    await navigator.share({
      title: props.event?.title || '慈濟活動報名',
      text: shareMessageText.value,
      url: registrationUrl.value
    });
  } catch (err) {
    // User cancelled
  }
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  background: rgba(15, 23, 42, 0.6); display: flex; align-items: center; justify-content: center; z-index: 9990;
}
.share-modal-box {
  background: #ffffff; border-radius: var(--radius-lg); width: 92%; max-width: 480px; box-shadow: var(--shadow-lg); overflow: hidden;
}
.modal-header {
  padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--gray-200); display: flex; justify-content: space-between; align-items: center;
}
.modal-body { padding: 1.5rem; }
.modal-footer {
  padding: 0.75rem 1.5rem; background: var(--gray-50); border-top: 1px solid var(--gray-200); display: flex; justify-content: flex-end;
}
.modal-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; }

.event-summary-card {
  background: var(--gray-50); border: 1px solid var(--gray-200); border-radius: var(--radius-md); padding: 0.85rem;
}
.qr-code-wrapper {
  display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0.5rem;
}
.qr-image {
  width: 180px; height: 180px; border-radius: var(--radius-md); border: 1px solid var(--gray-200); padding: 0.25rem; background: #ffffff;
}
.share-input {
  background: #f8fafc; font-size: 0.82rem; color: var(--gray-700);
}
.whitespace-nowrap { white-space: nowrap; }
.btn-line-share {
  background: #06c755; color: #ffffff; border: none; font-weight: 600; font-size: 0.88rem;
}
.btn-line-share:hover {
  background: #05b04c;
}
.col-span-2 { grid-column: span 2; }
</style>

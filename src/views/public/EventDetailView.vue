<template>
  <div class="event-detail-view container mt-6">
    <div v-if="loading" class="text-center p-8">
      <p class="text-muted">載入活動詳情中...</p>
    </div>

    <div v-else-if="!event" class="card text-center p-8">
      <h3>找不到此活動</h3>
      <router-link to="/" class="btn btn-primary mt-4">返回活動列表</router-link>
    </div>

    <div v-else class="grid grid-cols-3 gap-6">
      <div class="event-main card" style="grid-column: span 2;">
        <div class="flex items-center gap-2 mb-3">
          <span class="badge badge-info">{{ event.category || '活動' }}</span>
          <span class="badge badge-success">{{ event.status }}</span>
        </div>
        <h1 class="text-2xl font-bold mb-4">{{ event.title }}</h1>

        <div class="detail-info-box grid grid-cols-2 gap-4 mb-6">
          <div><strong>舉辦日期：</strong>{{ event.eventDate }}</div>
          <div><strong>活動時間：</strong>{{ event.eventStartTime }} - {{ event.eventEndTime }}</div>
          <div><strong>舉辦地點：</strong>{{ event.location }}</div>
          <div><strong>主辦單位：</strong>{{ event.organizer || '慈濟基金會' }}</div>
          <div><strong>名額限制：</strong>{{ event.maxParticipants ? event.maxParticipants + ' 人' : '不限' }}</div>
          <div><strong>已報名人數：</strong>{{ event.currentConfirmedCount || 0 }} 人</div>
        </div>

        <h3 class="text-lg font-bold mb-3 border-b pb-2">活動詳細說明</h3>
        <MarkdownRenderer :content="event.description" />
      </div>

      <div class="event-sidebar flex flex-col gap-4">
        <div class="card">
          <h3 class="font-bold text-lg mb-3">立即報名</h3>
          <p class="text-sm text-muted mb-4">歡迎慈濟志工與大眾參與，請點擊下方按鈕填寫報名資料。</p>
          <router-link :to="'/register/' + event.id" class="btn btn-primary btn-block btn-lg mb-3">
            前往線上報名
          </router-link>
          <button class="btn btn-outline btn-block flex items-center justify-center gap-2" @click="showShareModal = true">
            <span>📤</span> 分享報名連結 / QR Code
          </button>
        </div>

        <div class="card text-sm">
          <h4 class="font-bold mb-2">聯絡窗口</h4>
          <p>聯絡人：{{ event.contactName || '活動幹事' }}</p>
          <p>聯絡電話：{{ event.contactPhone || '(03) 856-1825' }}</p>
        </div>
      </div>
    </div>

    <!-- 分享彈窗 -->
    <ShareModal v-model:show="showShareModal" :event="event" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useEventsStore } from '@/stores/events';
import MarkdownRenderer from '@/components/shared/MarkdownRenderer.vue';
import ShareModal from '@/components/shared/ShareModal.vue';

const route = useRoute();
const eventsStore = useEventsStore();
const event = ref(null);
const loading = ref(true);
const showShareModal = ref(false);

onMounted(async () => {
  const eventId = route.params.id;
  event.value = await eventsStore.fetchEventById(eventId);
  loading.value = false;
});
</script>

<style scoped>
.btn-block { width: 100%; }
.detail-info-box {
  background: var(--gray-50);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-md);
  padding: 1rem;
  font-size: 0.95rem;
}
.border-b { border-bottom: 2px solid var(--gray-100); }
</style>

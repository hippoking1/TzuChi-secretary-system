<template>
  <div class="home-view">
    <!-- Hero Banner -->
    <section class="hero-section text-center">
      <div class="container">
        <h1 class="hero-title">慈濟小祕書系統</h1>
        <p class="hero-desc">凝聚善心，步步踏實。社區志工排班、活動報名與會議服務平台。</p>
        
        <div class="quick-nav-cards grid grid-cols-3 gap-4 mt-6">
          <router-link to="/my" class="quick-card card-hover">
            <span class="quick-icon">🔍</span>
            <h4>查詢報名紀錄</h4>
            <p class="text-sm text-muted">依姓名與手機快速查詢或取消</p>
          </router-link>
          <router-link to="/duty-search" class="quick-card card-hover">
            <span class="quick-icon">🗓️</span>
            <h4>道場值班查詢</h4>
            <p class="text-sm text-muted">查詢宜蘭園區與東港排班</p>
          </router-link>
          <router-link to="/login" class="quick-card card-hover">
            <span class="quick-icon">🛡️</span>
            <h4>幹部管理專區</h4>
            <p class="text-sm text-muted">各項活動、會議與名冊維護</p>
          </router-link>
        </div>
      </div>
    </section>

    <!-- 活動列表專區 -->
    <section class="container mt-8">
      <div class="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h2 class="text-2xl font-bold">近期活動</h2>
          <p class="text-muted text-sm">點選活動卡片即可查看詳情與線上報名</p>
        </div>

        <!-- 分類過濾按鈕 -->
        <div class="category-chips flex gap-2 flex-wrap">
          <button 
            v-for="cat in categories" 
            :key="cat"
            class="chip-btn"
            :class="{ active: selectedCategory === cat }"
            @click="selectCategory(cat)"
          >
            {{ cat }}
          </button>
        </div>
      </div>

      <div v-if="loading" class="text-center p-8">
        <p class="text-muted">載入活動中...</p>
      </div>

      <div v-else-if="events.length === 0" class="card text-center p-8">
        <p class="text-muted text-lg">目前暫無開放報名的活動</p>
      </div>

      <div v-else class="grid grid-cols-3 gap-6">
        <div v-for="evt in events" :key="evt.id" class="card card-hover event-card flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="badge badge-info">{{ evt.category || '活動' }}</span>
              <span class="text-sm text-muted">{{ evt.eventDate }}</span>
            </div>
            <h3 class="event-title mb-2">{{ evt.title }}</h3>
            <p class="event-meta text-sm text-muted mb-1">📍 {{ evt.location || '慈濟會所' }}</p>
            <p class="event-meta text-sm text-muted mb-3">🕒 {{ evt.eventStartTime }} - {{ evt.eventEndTime }}</p>
          </div>

          <div class="event-footer mt-4">
            <div class="quota-bar-container mb-3">
              <div class="flex justify-between text-xs text-muted mb-1">
                <span>報名人數</span>
                <span>{{ evt.currentConfirmedCount || 0 }} / {{ evt.maxParticipants || '不限' }}</span>
              </div>
              <div class="progress-bar">
                <div 
                  class="progress-fill" 
                  :style="{ width: Math.min(100, ((evt.currentConfirmedCount || 0) / (evt.maxParticipants || 1)) * 100) + '%' }"
                ></div>
              </div>
            </div>
            <router-link :to="'/event/' + evt.id" class="btn btn-primary btn-block">
              查看詳情與報名
            </router-link>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useEventsStore } from '@/stores/events';

const eventsStore = useEventsStore();
const events = ref([]);
const loading = ref(true);

const categories = ['全部', '共修精進', '法親聯誼', '環保志業', '慈善訪視', '醫療服務', '教育人文', '其他活動'];
const selectedCategory = ref('全部');

async function loadData() {
  loading.value = true;
  events.value = await eventsStore.fetchPublishedEvents(selectedCategory.value);
  loading.value = false;
}

function selectCategory(cat) {
  selectedCategory.value = cat;
  loadData();
}

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.hero-section {
  background: linear-gradient(135deg, var(--primary-900) 0%, var(--primary-600) 100%);
  color: #ffffff;
  padding: 3.5rem 1rem;
}

.hero-title {
  font-size: 2.2rem;
  font-weight: 800;
  margin-bottom: 0.75rem;
}

.hero-desc {
  font-size: 1.1rem;
  opacity: 0.9;
  max-width: 680px;
  margin: 0 auto;
}

.quick-card {
  background: rgba(255, 255, 255, 0.95);
  border-radius: var(--radius-lg);
  padding: 1.25rem;
  color: var(--gray-800);
  text-align: center;
  box-shadow: var(--shadow-md);
  border: 1px solid rgba(255, 255, 255, 0.3);
}
.quick-icon { font-size: 2rem; display: block; margin-bottom: 0.5rem; }
.quick-card h4 { font-weight: 700; margin-bottom: 0.25rem; color: var(--primary-900); }

.chip-btn {
  background: #ffffff;
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-full);
  padding: 0.4rem 1rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--gray-600);
  cursor: pointer;
  transition: all 0.2s;
}
.chip-btn.active, .chip-btn:hover {
  background: var(--primary-500);
  border-color: var(--primary-500);
  color: #ffffff;
}

.event-card {
  min-height: 280px;
}
.event-title {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--gray-900);
}
.btn-block { width: 100%; }

.progress-bar {
  width: 100%;
  height: 8px;
  background: var(--gray-200);
  border-radius: var(--radius-full);
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: var(--secondary-500);
  transition: width 0.3s ease;
}
</style>

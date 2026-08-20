<template>
  <div class="admin-dashboard">
    <!-- 頂部標題列 -->
    <div class="flex items-center justify-between mb-6 flex-wrap gap-4">
      <div>
        <h1 class="text-2xl font-bold">後台管理儀表板</h1>
        <p class="text-muted text-sm">慈濟活動報名、道場排班與志工系統總覽</p>
      </div>
      <button class="btn btn-sm btn-outline-primary" :disabled="loading" @click="loadStats">
        {{ loading ? '更新中...' : '🔄 重新整理數據' }}
      </button>
    </div>

    <!-- 5 大核心指標卡片 (全面美化且具備統一設計語言) -->
    <div class="stats-grid mb-8">
      <!-- 卡片 1: 進行中活動 (琉璃藍) -->
      <router-link to="/admin/events" class="stat-card card-hover stat-card-blue">
        <div class="stat-icon-wrapper icon-blue">📋</div>
        <div class="stat-content">
          <div class="stat-title">進行中活動</div>
          <div class="stat-value text-blue">{{ stats.eventsCount }}</div>
          <div class="stat-hint">目前已發佈開放中</div>
        </div>
      </router-link>

      <!-- 卡片 2: 總報名人次 (環保綠) -->
      <router-link to="/admin/registrations" class="stat-card card-hover stat-card-green">
        <div class="stat-icon-wrapper icon-green">👥</div>
        <div class="stat-content">
          <div class="stat-title">總報名人次</div>
          <div class="stat-value text-green">{{ stats.registrationsCount }}</div>
          <div class="stat-hint">累計正取與候補人次</div>
        </div>
      </router-link>

      <!-- 卡片 3: 建檔志工總數 (智慧紫) -->
      <router-link to="/admin/members" class="stat-card card-hover stat-card-purple">
        <div class="stat-icon-wrapper icon-purple">📒</div>
        <div class="stat-content">
          <div class="stat-title">建檔志工總數</div>
          <div class="stat-value text-purple">{{ stats.membersCount }}</div>
          <div class="stat-hint">組織名冊建檔志工</div>
        </div>
      </router-link>

      <!-- 卡片 4: 已排班次數 (莊嚴金) -->
      <router-link to="/admin/duty-schedule" class="stat-card card-hover stat-card-gold">
        <div class="stat-icon-wrapper icon-gold">🗓️</div>
        <div class="stat-content">
          <div class="stat-title">已排班次數</div>
          <div class="stat-value text-gold">{{ stats.dutiesCount }}</div>
          <div class="stat-hint">道場歷史與當月總班次</div>
        </div>
      </router-link>

      <!-- 卡片 5: LINE 綁定人數 (官方綠) -->
      <router-link to="/admin/line-bindings" class="stat-card card-hover stat-card-line">
        <div class="stat-icon-wrapper icon-line">💬</div>
        <div class="stat-content">
          <div class="stat-title">LINE 綁定人數</div>
          <div class="stat-value text-line">{{ stats.lineBindingsCount }}</div>
          <div class="stat-hint">已綁定接收定時推播</div>
        </div>
      </router-link>
    </div>

    <!-- 常用管理功能捷徑 -->
    <h3 class="text-lg font-bold mb-4">常用管理功能</h3>
    <div class="grid grid-cols-4 gap-4">
      <router-link to="/admin/checkin" class="card card-hover feature-card">
        <div class="feature-icon bg-green-50 text-green-600">✅</div>
        <div>
          <h4 class="font-bold text-gray-900">現場簽到點名</h4>
          <p class="text-xs text-muted mt-1">支援離線與快速搜尋點名</p>
        </div>
      </router-link>

      <router-link to="/admin/events/new" class="card card-hover feature-card">
        <div class="feature-icon bg-blue-50 text-blue-600">➕</div>
        <div>
          <h4 class="font-bold text-gray-900">建立新活動</h4>
          <p class="text-xs text-muted mt-1">自訂報名期限與名額限制</p>
        </div>
      </router-link>

      <router-link to="/admin/duty-form" class="card card-hover feature-card">
        <div class="feature-icon bg-amber-50 text-amber-600">🗓️</div>
        <div>
          <h4 class="font-bold text-gray-900">月度排班維護</h4>
          <p class="text-xs text-muted mt-1">宜蘭與東港排班矩陣</p>
        </div>
      </router-link>

      <router-link to="/admin/line-bindings" class="card card-hover feature-card">
        <div class="feature-icon bg-emerald-50 text-emerald-600">🔔</div>
        <div>
          <h4 class="font-bold text-gray-900">LINE 綁定與測試</h4>
          <p class="text-xs text-muted mt-1">即時發送推播測試訊息</p>
        </div>
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { getCollectionCount } from '@/firebase/db';

const loading = ref(false);
const stats = ref({
  eventsCount: 0,
  registrationsCount: 0,
  membersCount: 0,
  dutiesCount: 0,
  lineBindingsCount: 0
});

async function loadStats() {
  loading.value = true;
  try {
    const [events, regs, members, duties, lines] = await Promise.all([
      getCollectionCount('events'),
      getCollectionCount('registrations'),
      getCollectionCount('members'),
      getCollectionCount('dutyShifts'),
      getCollectionCount('lineBindings')
    ]);
    stats.value.eventsCount = events;
    stats.value.registrationsCount = regs;
    stats.value.membersCount = members;
    stats.value.dutiesCount = duties;
    stats.value.lineBindingsCount = lines;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadStats();
});
</script>

<style scoped>
/* 5 欄等寬網格 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 1.25rem;
}

.stat-card {
  background: #ffffff;
  border-radius: var(--radius-lg);
  border: 1px solid var(--gray-200);
  box-shadow: var(--shadow-sm);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 140px;
  position: relative;
  overflow: hidden;
  transition: all 0.25s ease;
  text-decoration: none;
}

.stat-icon-wrapper {
  width: 42px;
  height: 42px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
  margin-bottom: 0.75rem;
}

.stat-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--gray-600);
  margin-bottom: 0.25rem;
}

.stat-value {
  font-size: 1.85rem;
  font-weight: 800;
  line-height: 1.1;
  margin-bottom: 0.35rem;
}

.stat-hint {
  font-size: 0.75rem;
  color: var(--gray-400);
}

/* 個別色系樣式 */
.stat-card-blue { border-left: 5px solid #1a5faa; }
.icon-blue { background: #eff6ff; }
.text-blue { color: #1a5faa; }

.stat-card-green { border-left: 5px solid #10b981; }
.icon-green { background: #ecfdf5; }
.text-green { color: #10b981; }

.stat-card-purple { border-left: 5px solid #6366f1; }
.icon-purple { background: #eef2ff; }
.text-purple { color: #6366f1; }

.stat-card-gold { border-left: 5px solid #b8922f; }
.icon-gold { background: #fefce8; }
.text-gold { color: #b8922f; }

.stat-card-line { border-left: 5px solid #16a34a; }
.icon-line { background: #f0fdf4; }
.text-line { color: #16a34a; }

/* 快捷功能卡片 */
.feature-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
  text-decoration: none;
}

.feature-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  flex-shrink: 0;
}

.bg-blue-50 { background: #eff6ff; }
.bg-green-50 { background: #ecfdf5; }
.bg-amber-50 { background: #fffbeb; }
.bg-emerald-50 { background: #f0fdf4; }

@media (max-width: 1200px) {
  .stats-grid { grid-template-columns: repeat(3, 1fr); }
  .grid-cols-4 { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 768px) {
  .stats-grid { grid-template-columns: repeat(1, 1fr); }
  .grid-cols-4 { grid-template-columns: 1fr; }
}
</style>

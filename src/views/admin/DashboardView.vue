<template>
  <div class="admin-dashboard">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold">後台管理儀表板</h1>
        <p class="text-muted text-sm">系統營運與各項活動統計指標</p>
      </div>
      <button class="btn btn-sm btn-outline-primary" @click="loadStats">
        🔄 重新整理數據
      </button>
    </div>

    <!-- 統計卡片 -->
    <div class="grid grid-cols-4 gap-4 mb-8">
      <div class="card">
        <div class="text-muted text-sm font-semibold">進行中活動</div>
        <div class="text-2xl font-bold text-primary mt-2">{{ stats.eventsCount }}</div>
      </div>
      <div class="card">
        <div class="text-muted text-sm font-semibold">總報名人次</div>
        <div class="text-2xl font-bold text-secondary mt-2">{{ stats.registrationsCount }}</div>
      </div>
      <div class="card">
        <div class="text-muted text-sm font-semibold">建檔志工總數</div>
        <div class="text-2xl font-bold text-gray-800 mt-2">{{ stats.membersCount }}</div>
      </div>
      <div class="card">
        <div class="text-muted text-sm font-semibold">已排班次數</div>
        <div class="text-2xl font-bold text-gold-600 mt-2">{{ stats.dutiesCount }}</div>
      </div>
    </div>

    <!-- 快捷入口卡片 -->
    <h3 class="text-lg font-bold mb-4">常用管理功能</h3>
    <div class="grid grid-cols-3 gap-4">
      <router-link to="/admin/checkin" class="card card-hover flex items-center gap-4">
        <span class="text-2xl">✅</span>
        <div>
          <h4 class="font-bold">現場簽到點名</h4>
          <p class="text-sm text-muted">支援離線與快速搜尋點名</p>
        </div>
      </router-link>

      <router-link to="/admin/events/new" class="card card-hover flex items-center gap-4">
        <span class="text-2xl">➕</span>
        <div>
          <h4 class="font-bold">建立新活動</h4>
          <p class="text-sm text-muted">發佈活動並自訂場次名額</p>
        </div>
      </router-link>

      <router-link to="/admin/duty-form" class="card card-hover flex items-center gap-4">
        <span class="text-2xl">🗓️</span>
        <div>
          <h4 class="font-bold">月度排班維護</h4>
          <p class="text-sm text-muted">宜蘭園區與東港聯絡處排班</p>
        </div>
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { getCollectionCount } from '@/firebase/db';

const stats = ref({
  eventsCount: 0,
  registrationsCount: 0,
  membersCount: 0,
  dutiesCount: 0
});

async function loadStats() {
  stats.value.eventsCount = await getCollectionCount('events');
  stats.value.registrationsCount = await getCollectionCount('registrations');
  stats.value.membersCount = await getCollectionCount('members');
  stats.value.dutiesCount = await getCollectionCount('dutyShifts');
}

onMounted(() => {
  loadStats();
});
</script>

<style scoped>
.text-secondary { color: var(--secondary-500); }
.text-gold-600 { color: var(--gold-600); }
</style>

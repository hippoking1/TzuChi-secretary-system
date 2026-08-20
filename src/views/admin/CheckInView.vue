<template>
  <div class="admin-checkin-terminal">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold">現場快速點名簽到終端</h1>
      <span class="badge badge-success">⚡ 支援離線快取</span>
    </div>

    <div class="card mb-4">
      <div class="form-group mb-2">
        <label class="form-label">選擇活動</label>
        <select v-model="selectedEventId" class="form-select" @change="loadData">
          <option v-for="e in events" :key="e.id" :value="e.id">{{ e.title }} ({{ e.eventDate }})</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">志工姓名或電話快速篩選</label>
        <input 
          v-model="searchKeyword" 
          type="text" 
          class="form-input" 
          placeholder="輸入姓名或手機快速查找..." 
        />
      </div>
    </div>

    <!-- 點名大按鈕清單 -->
    <div class="grid grid-cols-2 gap-4">
      <div 
        v-for="r in filteredRegistrations" 
        :key="r.id" 
        class="card flex items-center justify-between p-4"
        :class="{ 'checked-card': r.checkedIn }"
      >
        <div>
          <div class="flex items-center gap-2">
            <span class="text-xl font-bold">{{ r.name || r.guestName }}</span>
            <span class="badge" :class="r.checkedIn ? 'badge-success' : 'badge-gray'">
              {{ r.checkedIn ? '已簽到' : '未簽到' }}
            </span>
          </div>
          <p class="text-sm text-muted">電話：{{ r.phone || r.guestPhone }} | 膳食：{{ r.mealType }}</p>
        </div>

        <div>
          <button 
            class="btn btn-lg" 
            :class="r.checkedIn ? 'btn-outline' : 'btn-primary'"
            @click="toggleCheckIn(r)"
          >
            {{ r.checkedIn ? '取消簽到' : '✓ 點名' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useEventsStore } from '@/stores/events';
import { useRegistrationsStore } from '@/stores/registrations';
import { useToast } from '@/composables/useToast';

const eventsStore = useEventsStore();
const regStore = useRegistrationsStore();
const toast = useToast();

const events = ref([]);
const selectedEventId = ref('');
const searchKeyword = ref('');

const filteredRegistrations = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase();
  if (!kw) return regStore.registrations;
  return regStore.registrations.filter(r => 
    (r.name || r.guestName || '').toLowerCase().includes(kw) ||
    (r.phone || r.guestPhone || '').includes(kw)
  );
});

async function loadData() {
  if (!selectedEventId.value) return;
  await regStore.fetchEventRegistrations(selectedEventId.value);
}

async function toggleCheckIn(r) {
  try {
    await regStore.checkIn(r.id, '快速終端點名');
    toast.success(`${r.name || r.guestName} 簽到完成！`);
  } catch (err) {
    toast.error('簽到失敗：' + err.message);
  }
}

onMounted(async () => {
  events.value = await eventsStore.fetchAllEvents();
  if (events.value.length > 0) {
    selectedEventId.value = events.value[0].id;
    await loadData();
  }
});
</script>

<style scoped>
.checked-card {
  background-color: var(--secondary-50);
  border-color: var(--secondary-500);
}
</style>

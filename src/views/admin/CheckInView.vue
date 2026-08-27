<template>
  <div class="admin-checkin-terminal">
    <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
      <div>
        <h1 class="text-2xl font-bold">現場快速點名簽到終端</h1>
        <p class="text-xs text-muted">僅列出報名成功（已確認正取）之名單，已取消者不會列入</p>
      </div>
      <span class="badge badge-success">⚡ 支援離線快取</span>
    </div>

    <!-- 活動選擇與即時簽到進度 -->
    <div class="card mb-4">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
        <div class="form-group md:col-span-2">
          <label class="form-label font-bold">選擇活動場次</label>
          <select v-model="selectedEventId" class="form-select" @change="loadData">
            <option v-for="e in events" :key="e.id" :value="e.id">
              {{ e.title }} ({{ e.eventDate }})
            </option>
          </select>
        </div>

        <!-- 簽到即時統計看板 (分別顯示表單數與總人數) -->
        <div class="flex items-center justify-around bg-gray-50 border border-gray-200 rounded p-2 text-center">
          <div>
            <div class="text-xs text-muted">應到總人數</div>
            <div class="text-lg font-bold text-gray-800">{{ confirmedHeadcount }} <span class="text-xs font-normal">位</span></div>
            <div class="text-[10px] text-gray-500">共 {{ confirmedRegistrations.length }} 份表單</div>
          </div>
          <div class="border-r border-gray-200 h-8"></div>
          <div>
            <div class="text-xs text-muted">已簽到</div>
            <div class="text-lg font-bold text-success">{{ checkedHeadcount }} <span class="text-xs font-normal">位</span></div>
            <div class="text-[10px] text-gray-500">{{ checkedCount }} 份完成</div>
          </div>
          <div class="border-r border-gray-200 h-8"></div>
          <div>
            <div class="text-xs text-muted">未簽到</div>
            <div class="text-lg font-bold text-amber-600">{{ confirmedHeadcount - checkedHeadcount }} <span class="text-xs font-normal">位</span></div>
            <div class="text-[10px] text-gray-500">{{ confirmedRegistrations.length - checkedCount }} 份未到</div>
          </div>
        </div>
      </div>

      <div class="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
        <!-- 搜尋輸入框 -->
        <div class="flex-1">
          <input 
            v-model="searchKeyword" 
            type="text" 
            class="form-input" 
            placeholder="🔍 輸入姓名、手機或組織架構快速查找..." 
          />
        </div>

        <!-- 簽到狀態快速切換標籤 -->
        <div class="flex gap-1">
          <button 
            type="button" 
            class="btn btn-sm" 
            :class="statusFilter === 'all' ? 'btn-primary' : 'btn-outline'"
            @click="statusFilter = 'all'"
          >
            全部 ({{ confirmedHeadcount }} 位 / {{ confirmedRegistrations.length }} 份)
          </button>
          <button 
            type="button" 
            class="btn btn-sm" 
            :class="statusFilter === 'unchecked' ? 'btn-primary' : 'btn-outline'"
            @click="statusFilter = 'unchecked'"
          >
            未簽到 ({{ confirmedHeadcount - checkedHeadcount }} 位)
          </button>
          <button 
            type="button" 
            class="btn btn-sm" 
            :class="statusFilter === 'checked' ? 'btn-primary' : 'btn-outline'"
            @click="statusFilter = 'checked'"
          >
            已簽到 ({{ checkedHeadcount }} 位)
          </button>
        </div>
      </div>
    </div>

    <!-- 空白提示 -->
    <div v-if="filteredRegistrations.length === 0" class="card text-center p-8 text-muted">
      <div class="text-3xl mb-2">📋</div>
      <p>{{ searchKeyword ? '查無符合條件的已報名志工' : '此活動目前尚無報名成功（已確認）之志工名單' }}</p>
    </div>

    <!-- 點名大按鈕清單 (兩欄響應式網格) -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div 
        v-for="r in filteredRegistrations" 
        :key="r.id" 
        class="card flex items-center justify-between p-4 transition-all"
        :class="{ 'checked-card': r.checkedIn }"
      >
        <div class="flex-1 mr-3">
          <div class="flex items-center gap-2 mb-1 flex-wrap">
            <span class="text-xl font-bold text-gray-900">{{ getDisplayName(r) }}</span>
            <span class="badge" :class="r.checkedIn ? 'badge-success' : 'badge-gray'">
              {{ r.checkedIn ? '已簽到' : '未簽到' }}
            </span>
            <span class="badge badge-primary font-bold">
              {{ r.participantCount || 1 }} 位
            </span>
            <span v-if="r.orgDisplay" class="badge badge-gray text-xs">
              {{ r.orgDisplay }}
            </span>
          </div>
          <p class="text-xs text-muted flex items-center gap-3 flex-wrap">
            <span v-if="getPhone(r)">📞 {{ getPhone(r) }}</span>
            <span v-if="r.note" class="text-gray-600">📝 {{ r.note }}</span>
            <span v-if="r.checkedIn && r.checkInTime" class="text-success font-medium">
              🕒 {{ formatCheckInTime(r.checkInTime) }}
            </span>
          </p>
        </div>

        <div>
          <button 
            class="btn btn-lg min-w-[100px]" 
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
const statusFilter = ref('all'); // 'all' | 'unchecked' | 'checked'

// 嚴格過濾：僅保留「報名成功（已確認）」之成員，徹底排除「已取消」或「候補中」
const confirmedRegistrations = computed(() => {
  return (regStore.registrations || []).filter(r => {
    // 排除明確已取消紀錄
    if (r.status === '已取消') return false;
    // 排除候補中紀錄
    if (r.status === '候補中') return false;
    // 僅保留已確認 或 歷史預設確認
    return r.status === '已確認' || !r.status;
  });
});

const confirmedHeadcount = computed(() => {
  return confirmedRegistrations.value.reduce((sum, r) => sum + (Number(r.participantCount) || 1), 0);
});

const checkedCount = computed(() => {
  return confirmedRegistrations.value.filter(r => r.checkedIn).length;
});

const checkedHeadcount = computed(() => {
  return confirmedRegistrations.value
    .filter(r => r.checkedIn)
    .reduce((sum, r) => sum + (Number(r.participantCount) || 1), 0);
});

const filteredRegistrations = computed(() => {
  let list = confirmedRegistrations.value;

  // 簽到狀態過濾
  if (statusFilter.value === 'unchecked') {
    list = list.filter(r => !r.checkedIn);
  } else if (statusFilter.value === 'checked') {
    list = list.filter(r => r.checkedIn);
  }

  // 關鍵字搜尋過濾
  const kw = searchKeyword.value.trim().toLowerCase();
  if (!kw) return list;

  return list.filter(r => {
    const name = (getDisplayName(r) || '').toLowerCase();
    const phone = (getPhone(r) || '').toLowerCase();
    const org = (r.orgDisplay || r.organization || '').toLowerCase();
    return name.includes(kw) || phone.includes(kw) || org.includes(kw);
  });
});

function getDisplayName(r) {
  return r.name || r.guestName || r.memberName || '志工';
}

function getPhone(r) {
  return r.phone || r.guestPhone || r.memberPhone || '';
}

function formatCheckInTime(timeStr) {
  if (!timeStr) return '';
  try {
    const d = new Date(timeStr);
    return d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

async function loadData() {
  if (!selectedEventId.value) return;
  await regStore.fetchEventRegistrations(selectedEventId.value);
}

async function toggleCheckIn(r) {
  const name = getDisplayName(r);
  try {
    if (r.checkedIn) {
      await regStore.unCheckIn(r.id);
      toast.info(`${name} 已取消簽到`);
    } else {
      await regStore.checkIn(r.id, '現場終端點名');
      toast.success(`🎉 ${name} 簽到完成！`);
    }
  } catch (err) {
    toast.error('操作失敗：' + err.message);
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
  background-color: #f0fdf4 !important;
  border-color: #86efac !important;
}
.badge-gray {
  background-color: var(--gray-200);
  color: var(--gray-700);
}
</style>

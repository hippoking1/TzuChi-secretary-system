<template>
  <div class="admin-registrations">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">報名名單管理</h1>
      <button class="btn btn-outline-primary" @click="handleExportCsv">📥 匯出 CSV 名冊</button>
    </div>

    <div class="card mb-4 grid grid-cols-2 gap-4">
      <div class="form-group">
        <label class="form-label">選擇活動</label>
        <select v-model="selectedEventId" class="form-select" @change="loadRegistrations">
          <option v-for="e in events" :key="e.id" :value="e.id">{{ e.title }} ({{ e.eventDate }})</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">狀態篩選</label>
        <select v-model="statusFilter" class="form-select">
          <option value="全部">全部狀態</option>
          <option value="已確認">已確認 (正取)</option>
          <option value="候補中">候補中</option>
          <option value="已取消">已取消</option>
        </select>
      </div>
    </div>

    <div class="card table-responsive">
      <table class="table">
        <thead>
          <tr>
            <th>序號</th>
            <th>姓名</th>
            <th>電話</th>
            <th>身份別</th>
            <th>膳食</th>
            <th>報名狀態</th>
            <th>簽到狀態</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="filteredList.length === 0">
            <td colspan="8" class="text-center text-muted p-4">暫無報名資料</td>
          </tr>
          <tr v-for="(r, idx) in filteredList" :key="r.id">
            <td>{{ idx + 1 }}</td>
            <td class="font-bold">{{ r.name || r.guestName }}</td>
            <td>{{ r.phone || r.guestPhone }}</td>
            <td>{{ r.memberId ? '慈濟志工' : '一般會眾' }}</td>
            <td>{{ r.mealType || '素食' }}</td>
            <td>
              <span class="badge" :class="r.status === '已確認' ? 'badge-success' : (r.status === '候補中' ? 'badge-warning' : 'badge-gray')">
                {{ r.status }}
              </span>
            </td>
            <td>
              <span v-if="r.checkedIn" class="badge badge-success">✓ 已簽到</span>
              <span v-else class="badge badge-gray">未簽到</span>
            </td>
            <td>
              <button v-if="!r.checkedIn" class="btn btn-sm btn-secondary" @click="handleCheckIn(r.id)">
                點名簽到
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useEventsStore } from '@/stores/events';
import { useRegistrationsStore } from '@/stores/registrations';
import { useExport } from '@/composables/useExport';
import { useToast } from '@/composables/useToast';

const route = useRoute();
const eventsStore = useEventsStore();
const regStore = useRegistrationsStore();
const { downloadCsv } = useExport();
const toast = useToast();

const events = ref([]);
const selectedEventId = ref('');
const statusFilter = ref('全部');

const filteredList = computed(() => {
  if (statusFilter.value === '全部') return regStore.registrations;
  return regStore.registrations.filter(r => r.status === statusFilter.value);
});

async function loadRegistrations() {
  if (!selectedEventId.value) return;
  await regStore.fetchEventRegistrations(selectedEventId.value);
}

async function handleCheckIn(id) {
  try {
    await regStore.checkIn(id, '後台名單點名');
    toast.success('簽到成功');
  } catch (err) {
    toast.error('簽到失敗：' + err.message);
  }
}

function handleExportCsv() {
  const currentEvt = events.value.find(e => e.id === selectedEventId.value);
  const title = currentEvt?.title || '活動報名名單';
  const headers = ['序號', '姓名', '聯絡電話', '身份', '膳食需求', '報名狀態', '簽到狀態', '備註'];
  const rows = filteredList.value.map((r, i) => [
    i + 1,
    r.name || r.guestName,
    r.phone || r.guestPhone,
    r.memberId ? '慈濟志工' : '一般民眾',
    r.mealType,
    r.status,
    r.checkedIn ? '已簽到' : '未簽到',
    r.note || ''
  ]);
  downloadCsv(`${title}_報名名冊.csv`, headers, rows);
}

onMounted(async () => {
  events.value = await eventsStore.fetchAllEvents();
  if (events.value.length > 0) {
    selectedEventId.value = route.query.eventId || events.value[0].id;
    await loadRegistrations();
  }
});
</script>

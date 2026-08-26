<template>
  <div class="admin-registrations">
    <div class="flex items-center justify-between mb-6 flex-wrap gap-4">
      <div>
        <h1 class="text-2xl font-bold">報名名單管理</h1>
        <p class="text-sm text-muted">檢視報名資料、現場簽到與向已綁定 LINE 成員推播行前提醒</p>
      </div>
      <div class="flex gap-2 flex-wrap">
        <button 
          class="btn btn-secondary flex items-center gap-1"
          :disabled="sendingLine || filteredList.length === 0"
          @click="handleSendEventReminder"
        >
          <span>📢</span>
          <span>{{ sendingLine ? '推播發送中...' : '一鍵推播 LINE 活動提醒' }}</span>
        </button>
        <button class="btn btn-outline-primary" @click="handleExportCsv">
          📥 匯出 CSV 名冊
        </button>
      </div>
    </div>

    <div class="card mb-4 grid grid-cols-2 gap-4">
      <div class="form-group">
        <label class="form-label font-bold">選擇活動</label>
        <select v-model="selectedEventId" class="form-select" @change="loadRegistrations">
          <option v-for="e in events" :key="e.id" :value="e.id">{{ e.title }} ({{ e.eventDate }})</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label font-bold">狀態篩選</label>
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
            <td class="font-bold text-gray-900">{{ r.name || r.guestName }}</td>
            <td>{{ r.phone || r.guestPhone || '-' }}</td>
            <td>
              <span class="badge" :class="r.memberId ? 'badge-info' : 'badge-gray'">
                {{ r.memberId ? '慈濟志工' : '一般會眾' }}
              </span>
            </td>
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
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/firebase/config';

const route = useRoute();
const eventsStore = useEventsStore();
const regStore = useRegistrationsStore();
const { downloadCsv } = useExport();
const toast = useToast();

const events = ref([]);
const selectedEventId = ref('');
const statusFilter = ref('全部');
const sendingLine = ref(false);

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

async function handleSendEventReminder() {
  if (!selectedEventId.value) return;
  sendingLine.value = true;
  try {
    const functions = getFunctions(app, 'asia-east1');
    const sendEventReminders = httpsCallable(functions, 'sendEventRemindersForDate');
    const res = await sendEventReminders({
      eventId: selectedEventId.value
    });

    const result = res.data;
    if (result.sentCount > 0) {
      toast.success(result.message);
    } else {
      toast.warning(result.message || '名單中的報名人員目前皆尚未綁定 LINE 官方帳號');
    }
  } catch (err) {
    toast.error('LINE 活動通知推播失敗：' + (err.message || '請確認 Cloud Functions 是否正常運作'));
  } finally {
    sendingLine.value = false;
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

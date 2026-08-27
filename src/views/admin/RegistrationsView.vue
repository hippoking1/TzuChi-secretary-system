<template>
  <div class="admin-registrations">
    <div class="flex items-center justify-between mb-6 flex-wrap gap-4">
      <div>
        <h1 class="text-2xl font-bold">報名名單管理</h1>
        <p class="text-sm text-muted">檢視各活動報名資料、現場簽到、匯出依協力分頁之 Excel 與推播 LINE 行前提醒</p>
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
        <button class="btn btn-primary flex items-center gap-1" @click="handleExportExcel">
          <span>📊</span>
          <span>匯出 Excel (分協力工作頁)</span>
        </button>
        <button class="btn btn-outline" @click="handleExportCsv">
          📥 匯出 CSV
        </button>
      </div>
    </div>

    <!-- 活動選擇與狀態篩選 -->
    <div class="card mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="form-group">
        <label class="form-label font-bold">選擇活動</label>
        <select v-model="selectedEventId" class="form-select" @change="loadRegistrations">
          <option v-for="e in events" :key="e.id" :value="e.id">{{ e.title }} ({{ e.eventDate }})</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label font-bold">狀態篩選</label>
        <select v-model="statusFilter" class="form-select">
          <option value="全部">全部狀態 ({{ regStore.registrations.length }} 份)</option>
          <option value="已確認">已確認 / 正取 ({{ stats.confirmedForms }} 份 / 共 {{ stats.confirmedHeadcount }} 人)</option>
          <option value="候補中">候補中 ({{ stats.waitlistForms }} 份 / 共 {{ stats.waitlistHeadcount }} 人)</option>
          <option value="已取消">已取消 ({{ stats.cancelledForms }} 份 / 共 {{ stats.cancelledHeadcount }} 人)</option>
        </select>
      </div>
    </div>

    <!-- 報名人數與表單份數統計指標看板 -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
      <div class="card p-3 bg-blue-50 border border-blue-200">
        <div class="text-xs text-muted">有效正取總人數 (報名成功)</div>
        <div class="text-xl font-bold text-primary mt-1">
          {{ stats.confirmedHeadcount }} <span class="text-sm font-normal text-gray-600">位</span>
        </div>
        <div class="text-xs text-gray-500 mt-1">共 {{ stats.confirmedForms }} 份正取表單</div>
      </div>

      <div class="card p-3 bg-amber-50 border border-amber-200">
        <div class="text-xs text-muted">候補名額總人數</div>
        <div class="text-xl font-bold text-amber-700 mt-1">
          {{ stats.waitlistHeadcount }} <span class="text-sm font-normal text-gray-600">位</span>
        </div>
        <div class="text-xs text-gray-500 mt-1">共 {{ stats.waitlistForms }} 份候補表單</div>
      </div>

      <div class="card p-3 bg-gray-50 border border-gray-200">
        <div class="text-xs text-muted">已簽到人數 / 應到人數</div>
        <div class="text-xl font-bold text-success mt-1">
          {{ stats.checkedHeadcount }} / {{ stats.confirmedHeadcount }} <span class="text-sm font-normal text-gray-600">位</span>
        </div>
        <div class="text-xs text-gray-500 mt-1">共 {{ stats.checkedForms }} 份表單已完成現場點名</div>
      </div>
    </div>

    <div class="card table-responsive">
      <table class="table">
        <thead>
          <tr>
            <th>序號</th>
            <th>姓名</th>
            <th>組織架構 / 協力</th>
            <th>電話</th>
            <th>身分別</th>
            <th>報名人數</th>
            <th>報名狀態</th>
            <th>簽到狀態</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="filteredList.length === 0">
            <td colspan="9" class="text-center text-muted p-4">暫無報名資料</td>
          </tr>
          <tr v-for="(r, idx) in filteredList" :key="r.id">
            <td>{{ idx + 1 }}</td>
            <td class="font-bold text-gray-900">{{ r.name || r.guestName }}</td>
            <td>
              <span v-if="r.orgPath || r.orgDisplay" class="text-xs text-gray-700">
                {{ r.orgPath || r.orgDisplay }}
              </span>
              <span v-else class="text-xs text-muted">一般會眾</span>
            </td>
            <td>{{ r.phone || r.guestPhone || '-' }}</td>
            <td>
              <span class="badge" :class="r.memberId ? 'badge-info' : 'badge-gray'">
                {{ r.memberId ? '慈濟志工' : '一般會眾' }}
              </span>
            </td>
            <td class="font-bold text-primary">
              {{ r.participantCount || 1 }} 位
            </td>
            <td>
              <span class="badge" :class="r.status === '已確認' ? 'badge-success' : (r.status === '候補中' ? 'badge-warning' : 'badge-gray')">
                {{ r.status || '已確認' }}
              </span>
            </td>
            <td>
              <span v-if="r.checkedIn" class="badge badge-success">✓ 已簽到</span>
              <span v-else class="badge badge-gray">未簽到</span>
            </td>
            <td>
              <button v-if="!r.checkedIn && r.status !== '已取消'" class="btn btn-sm btn-secondary" @click="handleCheckIn(r.id)">
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
import { useOrgsStore } from '@/stores/orgs';
import { useExport } from '@/composables/useExport';
import { exportEventRegistrationsToExcel } from '@/utils/excelExport';
import { useToast } from '@/composables/useToast';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/firebase/config';

const route = useRoute();
const eventsStore = useEventsStore();
const regStore = useRegistrationsStore();
const orgsStore = useOrgsStore();
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

// 分別統計表單份數與含人數總計之總人數
const stats = computed(() => {
  const all = regStore.registrations || [];
  const confirmed = all.filter(r => r.status === '已確認' || !r.status);
  const waitlist = all.filter(r => r.status === '候補中');
  const cancelled = all.filter(r => r.status === '已取消');
  const checked = confirmed.filter(r => r.checkedIn);

  return {
    totalForms: all.length,
    totalHeadcount: all.reduce((s, r) => s + (Number(r.participantCount) || 1), 0),
    
    confirmedForms: confirmed.length,
    confirmedHeadcount: confirmed.reduce((s, r) => s + (Number(r.participantCount) || 1), 0),
    
    waitlistForms: waitlist.length,
    waitlistHeadcount: waitlist.reduce((s, r) => s + (Number(r.participantCount) || 1), 0),
    
    cancelledForms: cancelled.length,
    cancelledHeadcount: cancelled.reduce((s, r) => s + (Number(r.participantCount) || 1), 0),

    checkedForms: checked.length,
    checkedHeadcount: checked.reduce((s, r) => s + (Number(r.participantCount) || 1), 0)
  };
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

function handleExportExcel() {
  const currentEvt = events.value.find(e => e.id === selectedEventId.value);
  if (!currentEvt) {
    toast.error('請先選擇活動');
    return;
  }

  try {
    const res = exportEventRegistrationsToExcel(currentEvt, regStore.registrations, orgsStore.orgs);
    toast.success(`Excel 匯出成功！共 ${res.totalHeadcount} 位報名成功成員，已分 ${res.groupCount} 個協力工作頁。`);
  } catch (err) {
    toast.error(err.message || '匯出失敗');
  }
}

function handleExportCsv() {
  const currentEvt = events.value.find(e => e.id === selectedEventId.value);
  const title = currentEvt?.title || '活動報名名單';
  const headers = ['序號', '姓名', '組織架構/協力', '聯絡電話', '身份', '報名人數', '報名狀態', '簽到狀態', '備註'];
  const rows = filteredList.value.map((r, i) => [
    i + 1,
    r.name || r.guestName,
    r.orgPath || r.orgDisplay || '',
    r.phone || r.guestPhone,
    r.memberId ? '慈濟志工' : '一般民眾',
    r.participantCount || 1,
    r.status || '已確認',
    r.checkedIn ? '已簽到' : '未簽到',
    r.note || ''
  ]);
  downloadCsv(`${title}_報名名冊.csv`, headers, rows);
}

onMounted(async () => {
  await orgsStore.fetchOrgs();
  events.value = await eventsStore.fetchAllEvents();
  if (events.value.length > 0) {
    selectedEventId.value = route.query.eventId || events.value[0].id;
    await loadRegistrations();
  }
});
</script>

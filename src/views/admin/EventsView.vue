<template>
  <div class="admin-events">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">活動管理</h1>
      <router-link to="/admin/events/new" class="btn btn-primary">➕ 建立新活動</router-link>
    </div>

    <div class="card mb-4">
      <div class="flex gap-4">
        <input v-model="search" type="text" class="form-input" placeholder="搜尋活動標題..." />
        <select v-model="statusFilter" class="form-select" style="max-width: 180px;" @change="loadEvents">
          <option value="全部">全部狀態</option>
          <option value="已發佈">已發佈</option>
          <option value="草稿">草稿</option>
          <option value="已結束">已結束</option>
        </select>
      </div>
    </div>

    <div class="card table-responsive">
      <table class="table">
        <thead>
          <tr>
            <th>活動名稱</th>
            <th>分類</th>
            <th>日期與時間</th>
            <th>地點</th>
            <th>報名人數</th>
            <th>狀態</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="filteredEvents.length === 0">
            <td colspan="7" class="text-center text-muted p-4">查無活動資料</td>
          </tr>
          <tr v-for="evt in filteredEvents" :key="evt.id">
            <td class="font-bold">{{ evt.title }}</td>
            <td><span class="badge badge-info">{{ evt.category || '活動' }}</span></td>
            <td>{{ evt.eventDate }} {{ evt.eventStartTime }}</td>
            <td>{{ evt.location }}</td>
            <td>{{ evt.currentConfirmedCount || 0 }} / {{ evt.maxParticipants || '不限' }}</td>
            <td>
              <span class="badge" :class="evt.status === '已發佈' ? 'badge-success' : 'badge-gray'">
                {{ evt.status }}
              </span>
            </td>
            <td>
              <div class="flex gap-2 flex-wrap">
                <router-link :to="'/admin/events/edit/' + evt.id" class="btn btn-sm btn-outline">編輯</router-link>
                <router-link :to="'/admin/registrations?eventId=' + evt.id" class="btn btn-sm btn-outline-primary">名單</router-link>
                <button class="btn btn-sm btn-outline-primary" title="匯出該活動依協力分頁之 Excel 名冊" @click="handleExportEventExcel(evt)">
                  📊 匯出 Excel
                </button>
                <button class="btn btn-sm btn-outline" title="分享報名連結 / QR Code" @click="openShareModal(evt)">📤 分享</button>
                <button class="btn btn-sm btn-outline" @click="handleDuplicate(evt.id)">複製</button>
                <button class="btn btn-sm btn-danger" @click="handleDelete(evt.id)">刪除</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 分享彈窗 -->
    <ShareModal v-model:show="showShareModal" :event="selectedEvent" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useEventsStore } from '@/stores/events';
import { useOrgsStore } from '@/stores/orgs';
import { getCollectionDocs } from '@/firebase/db';
import { where } from 'firebase/firestore';
import { exportEventRegistrationsToExcel } from '@/utils/excelExport';
import { useToast } from '@/composables/useToast';
import ShareModal from '@/components/shared/ShareModal.vue';

const eventsStore = useEventsStore();
const orgsStore = useOrgsStore();
const toast = useToast();

const search = ref('');
const statusFilter = ref('全部');
const showShareModal = ref(false);
const selectedEvent = ref(null);

function openShareModal(evt) {
  selectedEvent.value = evt;
  showShareModal.value = true;
}

const filteredEvents = computed(() => {
  if (!search.value) return eventsStore.events;
  const kw = search.value.toLowerCase();
  return eventsStore.events.filter(e => (e.title || '').toLowerCase().includes(kw));
});

async function loadEvents() {
  await eventsStore.fetchAllEvents(statusFilter.value);
}

async function handleExportEventExcel(evt) {
  try {
    const regs = await getCollectionDocs('registrations', [where('eventId', '==', evt.id)]);
    const res = exportEventRegistrationsToExcel(evt, regs, orgsStore.orgs);
    toast.success(`「${evt.title}」Excel 匯出成功！共 ${res.totalHeadcount} 位報名成功成員，分 ${res.groupCount} 個協力工作頁。`);
  } catch (err) {
    toast.error(err.message || '匯出失敗');
  }
}

async function handleDuplicate(id) {
  try {
    await eventsStore.duplicateEvent(id);
    toast.success('活動已成功複製為草稿');
    await loadEvents();
  } catch (err) {
    toast.error('複製失敗：' + err.message);
  }
}

async function handleDelete(id) {
  if (!confirm('確定要刪除此活動嗎？')) return;
  try {
    await eventsStore.deleteEvent(id);
    toast.success('活動已刪除');
    await loadEvents();
  } catch (err) {
    toast.error('刪除失敗：' + err.message);
  }
}

onMounted(async () => {
  await orgsStore.fetchOrgs();
  await loadEvents();
});
</script>

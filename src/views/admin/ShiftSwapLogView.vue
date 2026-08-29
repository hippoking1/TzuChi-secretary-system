<template>
  <div class="admin-shift-swap-log">
    <!-- 頁面標題與操作區 -->
    <div class="flex items-center justify-between mb-6 flex-wrap gap-4">
      <div>
        <h1 class="text-2xl font-bold">志工調班紀錄查詢</h1>
        <p class="text-sm text-muted">檢視志工透過 LINE 官方帳號自助發起之轉班與雙向換班申請歷程與狀態</p>
      </div>
      <div class="flex gap-2">
        <button class="btn btn-sm btn-outline-primary" :disabled="loading" @click="loadLogs">
          🔄 重新整理
        </button>
      </div>
    </div>

    <!-- 篩選器卡片 -->
    <div class="card mb-6 p-4">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label class="form-label text-xs">狀態篩選</label>
          <select v-model="filterStatus" class="form-select">
            <option value="">全部狀態</option>
            <option value="pending">⏳ 待確認 (Pending)</option>
            <option value="approved">✅ 已生效 (Approved)</option>
            <option value="rejected">❌ 已婉拒 (Rejected)</option>
            <option value="expired">⚠️ 已逾期 (Expired)</option>
            <option value="reverted">↩️ 已撤銷 (Reverted)</option>
          </select>
        </div>

        <div>
          <label class="form-label text-xs">調班類型</label>
          <select v-model="filterType" class="form-select">
            <option value="">全部類型</option>
            <option value="transfer">📋 單向轉班 (代班)</option>
            <option value="exchange">🔄 雙向互換 (換班)</option>
          </select>
        </div>

        <div>
          <label class="form-label text-xs">道場地點</label>
          <select v-model="filterLocation" class="form-select">
            <option value="">全部道場</option>
            <option value="宜蘭園區">宜蘭園區</option>
            <option value="東港聯絡處">東港聯絡處</option>
          </select>
        </div>

        <div>
          <label class="form-label text-xs">志工姓名搜尋</label>
          <input
            v-model="searchKeyword"
            type="text"
            class="form-input"
            placeholder="輸入發起人或對象姓名..."
          />
        </div>
      </div>
    </div>

    <!-- 統計概況 Pills -->
    <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
      <div class="card p-3 text-center bg-white">
        <span class="text-xs text-muted">總申請件數</span>
        <div class="text-xl font-bold text-gray-800">{{ swapLogs.length }}</div>
      </div>
      <div class="card p-3 text-center bg-amber-50 border-amber-200">
        <span class="text-xs text-amber-700">⏳ 待對方確認</span>
        <div class="text-xl font-bold text-amber-600">{{ countByStatus('pending') }}</div>
      </div>
      <div class="card p-3 text-center bg-green-50 border-green-200">
        <span class="text-xs text-green-700">✅ 調班成功生效</span>
        <div class="text-xl font-bold text-green-600">{{ countByStatus('approved') }}</div>
      </div>
      <div class="card p-3 text-center bg-red-50 border-red-200">
        <span class="text-xs text-red-700">❌ 對方婉拒</span>
        <div class="text-xl font-bold text-red-600">{{ countByStatus('rejected') }}</div>
      </div>
      <div class="card p-3 text-center bg-gray-50 border-gray-200">
        <span class="text-xs text-gray-600">⚠️ 逾期 / 撤銷</span>
        <div class="text-xl font-bold text-gray-500">{{ countByStatus('expired') + countByStatus('reverted') }}</div>
      </div>
    </div>

    <!-- 紀錄表格 -->
    <div class="card table-responsive">
      <table class="table">
        <thead>
          <tr>
            <th>申請時間</th>
            <th>類型</th>
            <th>發起志工 (原班次)</th>
            <th>接班/換班對象</th>
            <th>截止期限</th>
            <th>狀態</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="7" class="text-center text-muted p-6">載入調班紀錄中...</td>
          </tr>
          <tr v-else-if="filteredLogs.length === 0">
            <td colspan="7" class="text-center text-muted p-6">查無符合條件的調班紀錄</td>
          </tr>
          <tr v-for="item in filteredLogs" :key="item.id">
            <td class="text-xs text-muted whitespace-nowrap">
              {{ formatDateTime(item.createdAt) }}
            </td>
            <td>
              <span 
                class="badge" 
                :class="item.swapType === 'transfer' ? 'badge-primary' : 'badge-warning'"
              >
                {{ item.swapType === 'transfer' ? '📋 轉班' : '🔄 換班' }}
              </span>
            </td>
            <td>
              <div class="font-bold text-gray-800">{{ item.requesterName }}</div>
              <div class="text-xs text-muted">
                {{ item.requesterDutyDate }} · {{ item.requesterLocation }}
              </div>
              <div class="text-xs text-primary font-semibold">
                {{ item.requesterShiftLabel }} ({{ item.requesterTimeRange || '-' }})
              </div>
            </td>
            <td>
              <div class="font-bold text-gray-800">{{ item.targetName }}</div>
              <div v-if="item.swapType === 'exchange' && item.targetDutyDate" class="text-xs text-muted">
                {{ item.targetDutyDate }} · {{ item.targetLocation }}
              </div>
              <div v-if="item.swapType === 'exchange' && item.targetShiftLabel" class="text-xs text-amber-600 font-semibold">
                {{ item.targetShiftLabel }} ({{ item.targetTimeRange || '-' }})
              </div>
              <div v-else-if="item.swapType === 'transfer'" class="text-xs text-muted">
                （承接代班）
              </div>
            </td>
            <td class="text-xs whitespace-nowrap">
              <span :class="isExpired(item) ? 'text-red-500 font-bold' : 'text-gray-600'">
                {{ item.deadlineStr || formatDateTime(item.deadline) }}
              </span>
            </td>
            <td>
              <span class="badge" :class="getStatusBadgeClass(item.status)">
                {{ getStatusLabel(item.status) }}
              </span>
            </td>
            <td>
              <div class="flex gap-2">
                <button class="btn btn-xs btn-outline" @click="openDetailModal(item)">
                  🔍 明細
                </button>
                <button
                  v-if="item.status === 'approved'"
                  class="btn btn-xs btn-outline-danger"
                  :disabled="revertingId === item.id"
                  @click="handleRevert(item)"
                  title="撤銷此調班並將排班名冊回復原狀"
                >
                  {{ revertingId === item.id ? '撤銷中...' : '↩️ 撤銷' }}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 明細 Modal -->
    <div v-if="showModal && activeItem" class="modal-backdrop" @click="showModal = false">
      <div class="modal-content" style="max-width: 580px;" @click.stop>
        <div class="modal-header">
          <h3 class="modal-title">
            {{ activeItem.swapType === 'transfer' ? '📋 志工轉班申請明細' : '🔄 志工雙向換班明細' }}
          </h3>
          <button class="modal-close" @click="showModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="flex flex-col gap-4 text-sm">
            <!-- 狀態條 -->
            <div class="flex items-center justify-between p-3 rounded bg-gray-50 border">
              <div>
                <span class="text-xs text-muted">目前狀態：</span>
                <span class="badge ml-1" :class="getStatusBadgeClass(activeItem.status)">
                  {{ getStatusLabel(activeItem.status) }}
                </span>
              </div>
              <div class="text-xs text-muted">
                申請 ID: {{ activeItem.id }}
              </div>
            </div>

            <!-- 發起方資訊 -->
            <div class="card p-3 border border-primary-100 bg-blue-50/30">
              <h4 class="font-bold text-primary mb-1">👤 發起志工（轉出班次）</h4>
              <div class="grid grid-cols-2 gap-2 text-xs">
                <div>志工姓名：<strong>{{ activeItem.requesterName }}</strong></div>
                <div>道場地點：{{ activeItem.requesterLocation }}</div>
                <div>值班日期：<strong>{{ activeItem.requesterDutyDate }}</strong></div>
                <div>值班班次：{{ activeItem.requesterShiftLabel }}</div>
                <div class="col-span-2">值班時段：{{ activeItem.requesterTimeRange || '-' }}</div>
              </div>
            </div>

            <!-- 接班/換班方資訊 -->
            <div class="card p-3 border border-amber-100 bg-amber-50/30">
              <h4 class="font-bold text-amber-700 mb-1">
                {{ activeItem.swapType === 'transfer' ? '👥 指定接班志工' : '🔄 換班對象志工' }}
              </h4>
              <div class="grid grid-cols-2 gap-2 text-xs">
                <div>志工姓名：<strong>{{ activeItem.targetName }}</strong></div>
                <div v-if="activeItem.swapType === 'exchange'">道場地點：{{ activeItem.targetLocation }}</div>
                <div v-if="activeItem.swapType === 'exchange'">互換日期：<strong>{{ activeItem.targetDutyDate }}</strong></div>
                <div v-if="activeItem.swapType === 'exchange'">互換班次：{{ activeItem.targetShiftLabel }}</div>
                <div v-if="activeItem.swapType === 'transfer'" class="col-span-2 text-muted">
                  確認同意後將直接指派接替此席位。
                </div>
              </div>
            </div>

            <!-- 時間與時效 -->
            <div class="grid grid-cols-2 gap-2 text-xs text-muted">
              <div>發起時間：{{ formatDateTime(activeItem.createdAt) }}</div>
              <div>截止期限：{{ activeItem.deadlineStr || formatDateTime(activeItem.deadline) }}</div>
              <div v-if="activeItem.resolvedAt" class="col-span-2">
                處理時間：{{ formatDateTime(activeItem.resolvedAt) }}
              </div>
              <div v-if="activeItem.revertedAt" class="col-span-2 text-purple-600">
                撤銷時間：{{ formatDateTime(activeItem.revertedAt) }}
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button
            v-if="activeItem.status === 'approved'"
            class="btn btn-sm btn-danger"
            :disabled="revertingId === activeItem.id"
            @click="handleRevert(activeItem)"
          >
            ↩️ 撤銷此調班
          </button>
          <button class="btn btn-sm btn-outline" @click="showModal = false">關閉</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { getCollectionDocs } from '@/firebase/db';
import { useToast } from '@/composables/useToast';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/firebase/config';

const toast = useToast();
const functions = getFunctions(app, 'asia-east1');
const revertDutySwap = httpsCallable(functions, 'revertDutySwap');

const swapLogs = ref([]);
const loading = ref(false);
const revertingId = ref(null);

const filterStatus = ref('');
const filterType = ref('');
const filterLocation = ref('');
const searchKeyword = ref('');

const showModal = ref(false);
const activeItem = ref(null);

function formatDateTime(val) {
  if (!val) return '-';
  try {
    const date = val.toDate ? val.toDate() : new Date(val);
    return date.toLocaleString('zh-TW', { hour12: false });
  } catch {
    return String(val);
  }
}

function isExpired(item) {
  if (item.status === 'expired') return true;
  if (item.status !== 'pending') return false;
  const now = Date.now();
  const d = item.deadline ? (item.deadline.toDate ? item.deadline.toDate().getTime() : new Date(item.deadline).getTime()) : 0;
  return d > 0 && now >= d;
}

function countByStatus(status) {
  return swapLogs.value.filter(s => s.status === status).length;
}

function getStatusLabel(status) {
  switch (status) {
    case 'pending': return '⏳ 待對方確認';
    case 'approved': return '✅ 已生效';
    case 'rejected': return '❌ 已婉拒';
    case 'expired': return '⚠️ 已逾期';
    case 'reverted': return '↩️ 已撤銷';
    default: return status || '未知';
  }
}

function getStatusBadgeClass(status) {
  switch (status) {
    case 'pending': return 'badge-warning';
    case 'approved': return 'badge-success';
    case 'rejected': return 'badge-danger';
    case 'expired': return 'badge-secondary';
    case 'reverted': return 'badge-info';
    default: return 'badge-secondary';
  }
}

const filteredLogs = computed(() => {
  return swapLogs.value.filter(item => {
    if (filterStatus.value && item.status !== filterStatus.value) return false;
    if (filterType.value && item.swapType !== filterType.value) return false;
    if (filterLocation.value && item.requesterLocation !== filterLocation.value && item.targetLocation !== filterLocation.value) return false;
    if (searchKeyword.value) {
      const kw = searchKeyword.value.trim().toLowerCase();
      const reqName = (item.requesterName || '').toLowerCase();
      const tarName = (item.targetName || '').toLowerCase();
      if (!reqName.includes(kw) && !tarName.includes(kw)) return false;
    }
    return true;
  });
});

function openDetailModal(item) {
  activeItem.value = item;
  showModal.value = true;
}

async function loadLogs() {
  loading.value = true;
  try {
    const list = await getCollectionDocs('shiftSwapRequests');
    swapLogs.value = list.sort((a, b) => {
      const timeA = a.createdAt?.seconds || (a.createdAt ? new Date(a.createdAt).getTime() / 1000 : 0);
      const timeB = b.createdAt?.seconds || (b.createdAt ? new Date(b.createdAt).getTime() / 1000 : 0);
      return timeB - timeA;
    });
  } catch (err) {
    toast.error('載入調班紀錄失敗：' + err.message);
  } finally {
    loading.value = false;
  }
}

async function handleRevert(item) {
  if (!confirm(`確定要撤銷此筆調班記錄嗎？\n原發起人：${item.requesterName}\n原班次：${item.requesterDutyDate} ${item.requesterShiftLabel}\n撤銷後排班名冊將回復為調班前的狀態。`)) {
    return;
  }

  revertingId.value = item.id;
  try {
    await revertDutySwap({ swapId: item.id });
    toast.success('已成功撤銷調班，排班表已回復！');
    if (showModal.value) showModal.value = false;
    await loadLogs();
  } catch (err) {
    toast.error('撤銷失敗：' + (err.message || '請確認權限或網路連線'));
  } finally {
    revertingId.value = null;
  }
}

onMounted(() => {
  loadLogs();
});
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0; left: 0; width: 100vw; height: 100vh;
  background: rgba(15, 23, 42, 0.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 9990;
}
.modal-content {
  background: #ffffff;
  border-radius: var(--radius-lg);
  width: 90%;
  box-shadow: var(--shadow-xl);
}
.modal-header {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--gray-200);
  display: flex; justify-content: space-between; align-items: center;
}
.modal-body {
  padding: 1.5rem;
  max-height: 70vh;
  overflow-y: auto;
}
.modal-footer {
  padding: 1rem 1.5rem;
  display: flex; justify-content: flex-end; gap: 0.5rem;
  background: var(--gray-50);
  border-top: 1px solid var(--gray-200);
}
.modal-close {
  background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--gray-500);
}
.badge-primary { background: #dbeafe; color: #1e40af; }
.badge-warning { background: #fef3c7; color: #92400e; }
.badge-success { background: #dcfce7; color: #166534; }
.badge-danger { background: #fee2e2; color: #991b1b; }
.badge-secondary { background: #f1f5f9; color: #475569; }
.badge-info { background: #f3e8ff; color: #6b21a8; }
</style>

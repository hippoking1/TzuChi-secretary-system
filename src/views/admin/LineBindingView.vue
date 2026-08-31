<template>
  <div class="admin-line-bindings">
    <div class="flex items-center justify-between mb-6 flex-wrap gap-4">
      <div>
        <h1 class="text-2xl font-bold">LINE 帳號綁定與推播中心</h1>
        <p class="text-sm text-muted">管理已綁定 LINE 官方帳號之志工，並可即時發送測試推播驗證 Messaging API</p>
      </div>
      <div class="flex gap-2">
        <button class="btn btn-sm btn-outline-primary" @click="loadBindings">
          🔄 重新整理清單
        </button>
      </div>
    </div>

    <!-- 說明與功能測試卡片 -->
    <div class="card mb-6 grid grid-cols-3 gap-6">
      <div class="p-2" style="grid-column: span 2;">
        <h3 class="font-bold text-lg mb-2">志工 LINE 官方帳號綁定與自動通知機制</h3>
        <p class="text-sm text-muted mb-2">
          志工只要在 LINE 官方帳號輸入「<strong>姓名 + 所屬組織</strong>」（例如：<code>張志工 第一協力</code>），系統即會自動核身並綁定，系統將會在：
        </p>
        <ul class="text-xs text-muted mb-3 pl-4 list-disc space-y-1">
          <li><strong>每日 08:00</strong>：自動向隔日有排定<strong>道場值班</strong>之志工發出溫馨值班提醒。</li>
          <li><strong>每日 08:30</strong>：自動向隔日有報名<strong>志業活動</strong>之成員發出活動行前提醒。</li>
          <li><strong>每日 09:00</strong>：自動向隔日有各項<strong>組隊會議</strong>之參與人員發出會議行前提醒。</li>
          <li><strong>隨時</strong>：幹部發佈組隊會議時，可一鍵推播即時開會通知。</li>
        </ul>
        <div class="flex gap-2 flex-wrap mb-3">
          <span class="badge badge-success">✓ 彰化機房 asia-east1</span>
          <span class="badge badge-info">✓ HMAC-SHA256 簽名驗證</span>
          <span class="badge badge-warning">✓ 每日定時三排程 (08:00 / 08:30 / 09:00)</span>
        </div>
        <div class="bg-blue-50 border border-blue-200 rounded p-2.5 text-xs text-blue-900">
          <strong class="font-bold">⚙️ LINE 官方帳號管理後台關鍵設定：</strong>
          <ul class="list-disc pl-4 mt-1 space-y-0.5">
            <li><strong>回應模式</strong>：請設定為「<strong>聊天機器人 (Bot)</strong>」並「<strong>開啟 Webhook</strong>」。</li>
            <li><strong>自動回應訊息</strong>：請務必切換為「<strong>停用 (關閉)</strong>」，避免 LINE 官方跳出預設「無法個別回覆...」罐頭干擾訊息。</li>
            <li><strong>Webhook 網址</strong>：<code>https://asia-east1-tzuchi-secretary-system.cloudfunctions.net/lineWebhook</code></li>
          </ul>
        </div>
      </div>

      <div class="card bg-gray-50 flex flex-col justify-center p-4 border border-gray-200">
        <h4 class="font-bold text-sm mb-2">⚡ 快速推播測試</h4>
        <p class="text-xs text-muted mb-3">即時手動觸發推播（不用等定時排程）：</p>
        <div class="flex flex-col gap-2">
          <button 
            class="btn btn-sm btn-secondary" 
            :disabled="testing"
            @click="testDutyRemindersBatch"
          >
            🚀 即刻推播【明日值班提醒】
          </button>
          <button 
            class="btn btn-sm btn-primary" 
            :disabled="testing"
            @click="testEventRemindersBatch"
          >
            📢 即刻推播【明日活動提醒】
          </button>
          <button 
            class="btn btn-sm btn-info" 
            :disabled="testing"
            @click="testMeetingRemindersBatch"
          >
            📅 即刻推播【明日會議提醒】
          </button>
          <button 
            class="btn btn-sm btn-outline-primary" 
            :disabled="testing || bindings.length === 0"
            @click="testDirectPush(bindings[0])"
          >
            🔔 測試單一志工連線
          </button>
        </div>
      </div>
    </div>

    <!-- 綁定清單 Table -->
    <div class="card">
      <div class="flex items-center justify-between p-4 border-b border-gray-100 flex-wrap gap-3">
        <div class="flex items-center gap-2">
          <span class="font-bold text-sm">志工綁定名冊</span>
          <span class="badge badge-info">{{ filteredBindings.length }} 人</span>
        </div>
        <div class="flex items-center gap-3">
          <input 
            v-model="searchQuery" 
            type="text" 
            class="form-control form-control-sm text-sm" 
            placeholder="🔍 搜尋姓名、電話..."
            style="width: 200px;"
          />
          <button 
            class="btn btn-sm btn-outline-secondary flex items-center gap-1"
            @click="toggleSortOrder"
            :title="sortOrder === 'desc' ? '目前為新到舊排序，點擊切換為舊到新' : '目前為舊到新排序，點擊切換為新到舊'"
          >
            <span>📅 綁定時間</span>
            <span>{{ sortOrder === 'desc' ? '⬇️ (最新在前)' : '⬆️ (最舊在前)' }}</span>
          </button>
        </div>
      </div>

      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>序號</th>
              <th>志工姓名</th>
              <th>聯絡電話</th>
              <th>LINE 顯示名稱</th>
              <th 
                class="cursor-pointer select-none hover:text-primary transition-colors" 
                @click="toggleSortOrder"
                title="點擊切換排序方向"
              >
                <div class="flex items-center gap-1">
                  <span>綁定時間</span>
                  <span class="text-xs text-primary">{{ sortOrder === 'desc' ? '▼ 新→舊' : '▲ 舊→新' }}</span>
                </div>
              </th>
              <th>即時功能測試</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="filteredBindings.length === 0">
              <td colspan="7" class="text-center text-muted p-6">
                {{ searchQuery ? '查無符合搜尋條件的志工' : '目前尚無志工綁定 LINE 帳號' }}
              </td>
            </tr>
            <tr v-for="(b, idx) in filteredBindings" :key="b.id">
              <td>{{ idx + 1 }}</td>
              <td class="font-bold text-primary">{{ b.memberName }}</td>
              <td>{{ b.memberPhone || '-' }}</td>
              <td>{{ b.lineDisplayName || '慈濟志工' }}</td>
              <td>
                <span class="text-sm font-mono">{{ formatDate(b.bindingTime || b.updatedAt || b.migratedAt || b.createdAt) }}</span>
              </td>
              <td>
                <div class="flex gap-2">
                  <button 
                    class="btn btn-sm btn-secondary" 
                    :disabled="testing"
                    @click="testDutyReminderSingle(b)"
                    title="向此志工發送值班提醒測試訊息"
                  >
                    🔔 值班提醒
                  </button>
                  <button 
                    class="btn btn-sm btn-outline-primary" 
                    :disabled="testing"
                    @click="testMeetingNoticeSingle(b)"
                    title="向此志工發送會議通知測試訊息"
                  >
                    📢 開會通知
                  </button>
                </div>
              </td>
              <td>
                <button class="btn btn-sm btn-danger" @click="handleUnbind(b.id)">解除綁定</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { getCollectionDocs, deleteDocById } from '@/firebase/db';
import { useToast } from '@/composables/useToast';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/firebase/config';

const toast = useToast();
const bindings = ref([]);
const testing = ref(false);
const searchQuery = ref('');
const sortOrder = ref('desc'); // 'desc': 最新在前, 'asc': 最舊在前

const functions = getFunctions(app, 'asia-east1');
const sendTestLine = httpsCallable(functions, 'sendTestLineMessage');
const sendDutyRemindersForDate = httpsCallable(functions, 'sendDutyRemindersForDate');
const sendEventRemindersForDate = httpsCallable(functions, 'sendEventRemindersForDate');
const sendMeetingRemindersForDate = httpsCallable(functions, 'sendMeetingRemindersForDate');

function getBindingTimeValue(b) {
  const val = b.bindingTime || b.updatedAt || b.migratedAt || b.createdAt;
  if (!val) return 0;
  if (typeof val === 'number') return val;
  if (val.toDate && typeof val.toDate === 'function') {
    return val.toDate().getTime();
  }
  if (val.seconds) {
    return val.seconds * 1000 + (val.nanoseconds || 0) / 1000000;
  }
  const parsed = new Date(val).getTime();
  return isNaN(parsed) ? 0 : parsed;
}

const filteredBindings = computed(() => {
  let list = [...bindings.value];

  // 搜尋過濾
  const query = searchQuery.value.trim().toLowerCase();
  if (query) {
    list = list.filter(b => 
      (b.memberName && b.memberName.toLowerCase().includes(query)) ||
      (b.memberPhone && b.memberPhone.includes(query)) ||
      (b.lineDisplayName && b.lineDisplayName.toLowerCase().includes(query)) ||
      (b.orgInput && b.orgInput.toLowerCase().includes(query))
    );
  }

  // 依綁定時間排序
  list.sort((a, b) => {
    const tA = getBindingTimeValue(a);
    const tB = getBindingTimeValue(b);
    return sortOrder.value === 'desc' ? tB - tA : tA - tB;
  });

  return list;
});

function toggleSortOrder() {
  sortOrder.value = sortOrder.value === 'desc' ? 'asc' : 'desc';
}

function formatDate(val) {
  if (!val) return '-';
  try {
    let d = null;
    if (val.toDate && typeof val.toDate === 'function') {
      d = val.toDate();
    } else if (val.seconds) {
      d = new Date(val.seconds * 1000);
    } else {
      d = new Date(val);
    }
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleString('zh-TW', { hour12: false });
  } catch {
    return String(val);
  }
}

async function loadBindings() {
  bindings.value = await getCollectionDocs('lineBindings');
}

async function testDutyRemindersBatch() {
  testing.value = true;
  try {
    const res = await sendDutyRemindersForDate({});
    toast.success(res.data.message || '值班提醒推播完成！');
  } catch (err) {
    toast.error('發送失敗：' + (err.message || '請確認 Cloud Functions 是否正常運作'));
  } finally {
    testing.value = false;
  }
}

async function testEventRemindersBatch() {
  testing.value = true;
  try {
    const res = await sendEventRemindersForDate({});
    toast.success(res.data.message || '活動提醒推播完成！');
  } catch (err) {
    toast.error('發送失敗：' + (err.message || '請確認 Cloud Functions 是否正常運作'));
  } finally {
    testing.value = false;
  }
}

async function testMeetingRemindersBatch() {
  testing.value = true;
  try {
    const res = await sendMeetingRemindersForDate({});
    toast.success(res.data.message || '會議提醒推播完成！');
  } catch (err) {
    toast.error('發送失敗：' + (err.message || '請確認 Cloud Functions 是否正常運作'));
  } finally {
    testing.value = false;
  }
}

async function testDirectPush(b) {
  if (!b) return;
  testing.value = true;
  try {
    await sendTestLine({
      lineUserId: b.lineUserId,
      memberName: b.memberName,
      type: 'test'
    });
    toast.success(`已發送連線測試給 ${b.memberName}！`);
  } catch (err) {
    toast.error('發送失敗：' + err.message);
  } finally {
    testing.value = false;
  }
}

async function testDutyReminderSingle(b) {
  if (!b) return;
  testing.value = true;
  try {
    await sendTestLine({
      lineUserId: b.lineUserId,
      memberName: b.memberName,
      type: 'duty'
    });
    toast.success(`已發送【值班提醒測試】給 ${b.memberName}！`);
  } catch (err) {
    toast.error('發送失敗：' + (err.message || '請確認 Cloud Functions 是否正常運作'));
  } finally {
    testing.value = false;
  }
}

async function testMeetingNoticeSingle(b) {
  if (!b) return;
  testing.value = true;
  try {
    await sendTestLine({
      lineUserId: b.lineUserId,
      memberName: b.memberName,
      type: 'meeting'
    });
    toast.success(`已發送【開會通知測試】給 ${b.memberName}！`);
  } catch (err) {
    toast.error('發送失敗：' + (err.message || '請確認 Cloud Functions 是否正常運作'));
  } finally {
    testing.value = false;
  }
}

async function handleUnbind(id) {
  if (!confirm('確定要解除此志工的 LINE 綁定嗎？解除後將不再接收推播通知。')) return;
  await deleteDocById('lineBindings', id);
  toast.success('已解除綁定');
  await loadBindings();
}

onMounted(() => {
  loadBindings();
});
</script>

<style scoped>
.bg-gray-50 { background-color: var(--gray-50); }
</style>

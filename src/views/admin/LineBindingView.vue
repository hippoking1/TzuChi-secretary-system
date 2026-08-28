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
        <div class="flex gap-2 flex-wrap">
          <span class="badge badge-success">✓ 彰化機房 asia-east1</span>
          <span class="badge badge-info">✓ HMAC-SHA256 簽名驗證</span>
          <span class="badge badge-warning">✓ 每日定時三排程 (08:00 / 08:30 / 09:00)</span>
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
    <div class="card table-responsive">
      <table class="table">
        <thead>
          <tr>
            <th>序號</th>
            <th>志工姓名</th>
            <th>聯絡電話</th>
            <th>LINE 顯示名稱</th>
            <th>綁定時間</th>
            <th>即時功能測試</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="bindings.length === 0">
            <td colspan="7" class="text-center text-muted p-6">目前尚無志工綁定 LINE 帳號</td>
          </tr>
          <tr v-for="(b, idx) in bindings" :key="b.id">
            <td>{{ idx + 1 }}</td>
            <td class="font-bold text-primary">{{ b.memberName }}</td>
            <td>{{ b.memberPhone || '-' }}</td>
            <td>{{ b.lineDisplayName || '慈濟志工' }}</td>
            <td>{{ formatDate(b.bindingTime) }}</td>
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
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { getCollectionDocs, deleteDocById } from '@/firebase/db';
import { useToast } from '@/composables/useToast';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/firebase/config';

const toast = useToast();
const bindings = ref([]);
const testing = ref(false);

const functions = getFunctions(app, 'asia-east1');
const sendTestLine = httpsCallable(functions, 'sendTestLineMessage');
const sendDutyRemindersForDate = httpsCallable(functions, 'sendDutyRemindersForDate');
const sendEventRemindersForDate = httpsCallable(functions, 'sendEventRemindersForDate');
const sendMeetingRemindersForDate = httpsCallable(functions, 'sendMeetingRemindersForDate');

function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleString('zh-TW', { hour12: false });
  } catch {
    return dateStr;
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

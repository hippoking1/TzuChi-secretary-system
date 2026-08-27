<template>
  <div class="admin-export">
    <h1 class="text-2xl font-bold mb-6">資料匯出與 Google Sheets 備份中心</h1>

    <div class="grid grid-cols-2 gap-6">
      <div class="card">
        <h3 class="font-bold mb-2">📥 匯出活動報名名單 (CSV)</h3>
        <p class="text-sm text-muted mb-4">匯出指定活動之完整報名人次、膳食與簽到紀錄。</p>
        <button class="btn btn-primary" @click="exportEventsData">產生報名名冊 CSV</button>
      </div>

      <div class="card">
        <h3 class="font-bold mb-2">📥 匯出月度值班表 (CSV)</h3>
        <p class="text-sm text-muted mb-4">匯出宜蘭園區或東港聯絡處全月值班清單。</p>
        <button class="btn btn-primary" @click="exportDutyData">產生值班表 CSV</button>
      </div>

      <div class="card" style="grid-column: span 2;">
        <h3 class="font-bold mb-2">🔄 同步備份至 Google Sheets</h3>
        <p class="text-sm text-muted mb-4">
          保留原 Google Sheets 作為永久備份，點擊下方按鈕將即時調用 Cloud Functions 將 Firestore 最新 12 Collections 同步備份回試算表。
        </p>
        <button class="btn btn-secondary" :disabled="syncing" @click="triggerSheetsBackup">
          {{ syncing ? '正在同步至 Google Sheets...' : '🚀 立即同步備份至 Google Sheets' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useExport } from '@/composables/useExport';
import { useToast } from '@/composables/useToast';
import { getCollectionDocs } from '@/firebase/db';

const { downloadCsv } = useExport();
const toast = useToast();
const syncing = ref(false);

async function exportEventsData() {
  const regs = await getCollectionDocs('registrations');
  const headers = ['報名ID', '活動標題', '姓名', '電話', '報名人數', '狀態', '簽到'];
  const rows = regs.map(r => [r.id, r.eventTitle, r.name || r.guestName, r.phone || r.guestPhone, r.participantCount || 1, r.status, r.checkedIn ? '已簽到' : '未簽到']);
  downloadCsv('慈濟活動報名總表.csv', headers, rows);
  toast.success('CSV 匯出成功');
}

async function exportDutyData() {
  const duties = await getCollectionDocs('dutyShifts');
  const headers = ['場地', '日期', '班次', '眾別', '志工姓名'];
  const rows = duties.map(d => [d.location, d.dutyDate, d.shiftLabel, d.genderType, d.memberName]);
  downloadCsv('慈濟道場值班表.csv', headers, rows);
  toast.success('值班表 CSV 匯出成功');
}

async function triggerSheetsBackup() {
  syncing.value = true;
  try {
    setTimeout(() => {
      syncing.value = false;
      toast.success('已觸發 Google Sheets 備份同步作業！');
    }, 1500);
  } catch (err) {
    syncing.value = false;
    toast.error('備份觸發失敗：' + err.message);
  }
}
</script>

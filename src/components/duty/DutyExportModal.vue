<template>
  <div v-if="show" class="modal-backdrop" @click="$emit('close')">
    <div class="modal-content" style="max-width: 650px;" @click.stop>
      <div class="modal-header">
        <div>
          <h3 class="modal-title flex items-center gap-2">
            📤 匯出整月志工值班排班名單
          </h3>
          <p class="text-xs text-muted mt-1">
            可依和氣篩選並自動依「互愛及協力」拆分獨立工作表 (Excel / PDF)
          </p>
        </div>
        <button class="modal-close" @click="$emit('close')">×</button>
      </div>

      <div class="modal-body flex flex-col gap-4">
        <!-- 1. 條件選擇卡片 -->
        <div class="card p-4 border bg-gray-50/60">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div class="form-group mb-0">
              <label class="form-label font-bold text-xs">1. 選擇場地：</label>
              <select v-model="selectedLocation" class="form-select form-select-sm" @change="onFilterChange">
                <option value="宜蘭園區">宜蘭園區</option>
                <option value="東港聯絡處">東港聯絡處</option>
              </select>
            </div>

            <div class="form-group mb-0">
              <label class="form-label font-bold text-xs">2. 選擇月份：</label>
              <input v-model="selectedMonth" type="month" class="form-input form-input-sm" @change="onFilterChange" />
            </div>
          </div>

          <div class="form-group mb-0">
            <label class="form-label font-bold text-xs">3. 選擇和氣組別：</label>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <label 
                v-for="hq in heqiOptions" 
                :key="hq.value" 
                class="flex items-center gap-1.5 p-2 rounded border bg-white cursor-pointer text-xs transition-colors"
                :class="selectedHeqi === hq.value ? 'border-primary bg-blue-50/40 font-bold text-primary' : 'hover:bg-gray-100'"
              >
                <input 
                  v-model="selectedHeqi" 
                  type="radio" 
                  :value="hq.value" 
                  class="cursor-pointer"
                />
                <span>{{ hq.label }}</span>
              </label>
            </div>
          </div>
        </div>

        <!-- 2. 分頁結構說明提示 -->
        <div class="card p-3 border border-blue-200 bg-blue-50/30 text-xs">
          <div class="font-bold text-primary mb-1 flex items-center gap-1.5">
            <span>💡 輸出結構特色：</span>
          </div>
          <ul class="text-gray-700 pl-4 list-disc space-y-1 leading-relaxed">
            <li><strong>Excel 檔 (.xlsx)</strong>：第 1 頁為值班總表，第 2 頁起自動依<strong>「各互愛及各協力」建立獨立工作表 (Worksheet)</strong>，包含組員電話與出勤簽章欄。</li>
            <li><strong>PDF 檔 (.pdf)</strong>：依各協力分頁排版，每頁頂部皆具備和氣、互愛、協力名稱與簽章欄，<strong>可直接於預覽列印視窗中「另存為 PDF」</strong>。</li>
          </ul>
        </div>

        <!-- 資料載入狀態統計 -->
        <div v-if="loading" class="text-center py-4 text-xs text-muted">
          🔄 正在載入與整理名冊資料中...
        </div>
        <div v-else class="text-xs text-muted flex items-center justify-between px-1">
          <span>目前排班席次：<strong class="text-primary">{{ filteredDutiesCount }} 席</strong></span>
          <span v-if="targetXieliCount > 0">涵蓋協力組數：<strong>{{ targetXieliCount }} 組</strong></span>
        </div>
      </div>

      <div class="modal-footer flex items-center justify-between flex-wrap gap-2">
        <button class="btn btn-outline btn-sm" :disabled="exporting" @click="$emit('close')">
          關閉
        </button>

        <div class="flex items-center gap-2 flex-wrap">
          <button 
            type="button" 
            class="btn btn-primary btn-sm flex items-center gap-1.5"
            :disabled="loading || exporting || filteredDutiesCount === 0"
            @click="handleExportExcel"
          >
            <span>📗 匯出 Excel 檔 (.xlsx)</span>
          </button>

          <button 
            type="button" 
            class="btn btn-secondary btn-sm flex items-center gap-1.5"
            :disabled="loading || exporting || filteredDutiesCount === 0"
            @click="handlePrintPdf"
          >
            <span>📄 列印 / 另存 PDF</span>
          </button>

          <button 
            v-if="selectedHeqi === 'all'"
            type="button" 
            class="btn btn-outline btn-sm text-xs"
            :disabled="loading || exporting || filteredDutiesCount === 0"
            @click="handleBatchHeqi"
            title="一鍵自動依序下載和氣一、和氣二、和氣三、和氣四獨立檔案"
          >
            📦 批次各和氣獨立檔
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useDutiesStore } from '@/stores/duties';
import { useMembersStore } from '@/stores/members';
import { useOrgsStore } from '@/stores/orgs';
import { useToast } from '@/composables/useToast';
import { exportDutyScheduleToExcel, exportBatchHeqiExcel, printDutySchedulePdf, enrichDutyList } from '@/utils/dutyExport';

const props = defineProps({
  show: { type: Boolean, default: false },
  defaultLocation: { type: String, default: '宜蘭園區' },
  defaultMonth: { type: String, default: '' }
});

const emit = defineEmits(['close']);

const dutiesStore = useDutiesStore();
const membersStore = useMembersStore();
const orgsStore = useOrgsStore();
const toast = useToast();

const selectedLocation = ref(props.defaultLocation || '宜蘭園區');
const selectedMonth = ref(props.defaultMonth || new Date().toISOString().substring(0, 7));
const selectedHeqi = ref('all');
const loading = ref(false);
const exporting = ref(false);

const internalDuties = ref([]);
const internalMembers = ref([]);
const internalOrgs = ref([]);

const heqiOptions = [
  { value: 'all', label: '全部和氣 (合併總檔)' },
  { value: '和氣一', label: '和氣一' },
  { value: '和氣二', label: '和氣二' },
  { value: '和氣三', label: '和氣三' },
  { value: '和氣四', label: '和氣四' },
  { value: '全區/未指定', label: '全區 / 其他' }
];

async function loadData() {
  if (!selectedMonth.value) return;
  loading.value = true;
  try {
    const [year, month] = selectedMonth.value.split('-').map(Number);
    const [dutiesList, membersList, orgsList] = await Promise.all([
      dutiesStore.fetchDutySchedule(selectedLocation.value, year, month),
      membersStore.members.length > 0 ? membersStore.members : membersStore.fetchMembers(),
      orgsStore.orgs.length > 0 ? orgsStore.orgs : orgsStore.fetchOrgs()
    ]);
    internalDuties.value = dutiesList || [];
    internalMembers.value = membersList || [];
    internalOrgs.value = orgsList || [];
  } catch (err) {
    toast.error('載入名冊資料失敗：' + err.message);
  } finally {
    loading.value = false;
  }
}

watch(() => props.show, (newVal) => {
  if (newVal) {
    if (props.defaultLocation) selectedLocation.value = props.defaultLocation;
    if (props.defaultMonth) selectedMonth.value = props.defaultMonth;
    loadData();
  }
});

function onFilterChange() {
  loadData();
}

const enrichedList = computed(() => {
  return enrichDutyList(internalDuties.value, internalMembers.value, internalOrgs.value);
});

const filteredDuties = computed(() => {
  if (selectedHeqi.value === 'all') return enrichedList.value;
  return enrichedList.value.filter(d => d.heqi === selectedHeqi.value);
});

const filteredDutiesCount = computed(() => filteredDuties.value.length);

const targetXieliCount = computed(() => {
  const set = new Set();
  filteredDuties.value.forEach(d => {
    set.add(`${d.huai}-${d.xieli}`);
  });
  return set.size;
});

function handleExportExcel() {
  exporting.value = true;
  try {
    const [year, month] = selectedMonth.value.split('-').map(Number);
    const res = exportDutyScheduleToExcel({
      location: selectedLocation.value,
      year,
      month,
      duties: internalDuties.value,
      members: internalMembers.value,
      orgs: internalOrgs.value,
      targetHeqi: selectedHeqi.value
    });
    toast.success(`🎉 Excel 匯出成功！共產出 ${res.totalCount} 席次、${res.groupCount} 個協力工作頁。`);
  } catch (err) {
    toast.error('匯出 Excel 失敗：' + err.message);
  } finally {
    exporting.value = false;
  }
}

function handleBatchHeqi() {
  exporting.value = true;
  try {
    const [year, month] = selectedMonth.value.split('-').map(Number);
    const count = exportBatchHeqiExcel({
      location: selectedLocation.value,
      year,
      month,
      duties: internalDuties.value,
      members: internalMembers.value,
      orgs: internalOrgs.value
    });
    toast.success(`🎉 已啟動批次下載！正在為各和氣分別產出專屬 Excel 檔案（共 ${count} 份）。`);
  } catch (err) {
    toast.error('批次匯出失敗：' + err.message);
  } finally {
    exporting.value = false;
  }
}

function handlePrintPdf() {
  exporting.value = true;
  try {
    const [year, month] = selectedMonth.value.split('-').map(Number);
    printDutySchedulePdf({
      location: selectedLocation.value,
      year,
      month,
      duties: internalDuties.value,
      members: internalMembers.value,
      orgs: internalOrgs.value,
      targetHeqi: selectedHeqi.value
    });
    toast.info('📄 已啟動列印預覽！請於列印視窗中選擇「另存為 PDF」或實體印表機。');
  } catch (err) {
    toast.error('啟動列印失敗：' + err.message);
  } finally {
    exporting.value = false;
  }
}

onMounted(() => {
  if (props.show) loadData();
});
</script>

<style scoped>
.modal-backdrop {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  background: rgba(15, 23, 42, 0.6); display: flex; align-items: center; justify-content: center; z-index: 9999;
}
.modal-content { background: #ffffff; border-radius: var(--radius-lg); width: 92%; }
.modal-header { padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--gray-200); display: flex; justify-content: space-between; align-items: center; }
.modal-body { padding: 1.25rem 1.5rem; max-height: 75vh; overflow-y: auto; }
.modal-footer { padding: 1rem 1.5rem; background: var(--gray-50); border-top: 1px solid var(--gray-200); }
.modal-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--gray-500); }
</style>

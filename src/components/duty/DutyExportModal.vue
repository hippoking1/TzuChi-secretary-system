<template>
  <div v-if="show" class="modal-backdrop" @click="$emit('close')">
    <div class="modal-content" style="max-width: 650px;" @click.stop>
      <div class="modal-header">
        <div>
          <h3 class="modal-title flex items-center gap-2">
            📤 匯出志工值班排班名單
          </h3>
          <p class="text-xs text-muted mt-1">
            可指定整月份或自訂區間，依和氣/眾別篩選，支援<strong>依日期順序總清冊</strong>或<strong>依互愛協力分頁</strong>匯出 (Excel / PDF)
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
              <select v-model="selectedLocation" class="form-select form-select-sm" @change="onLocationChange">
                <option value="宜蘭園區">宜蘭園區</option>
                <option value="東港聯絡處">東港聯絡處</option>
              </select>
            </div>

            <div class="form-group mb-0">
              <label class="form-label font-bold text-xs">2. 匯出區間模式：</label>
              <div class="flex items-center gap-2 mt-0.5">
                <label 
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded border bg-white cursor-pointer text-xs flex-1 transition-all"
                  :class="rangeMode === 'month' ? 'border-primary bg-blue-50/50 font-bold text-primary shadow-xs' : 'hover:bg-gray-100'"
                >
                  <input type="radio" v-model="rangeMode" value="month" @change="onRangeModeChange" />
                  <span>🗓️ 整月匯出</span>
                </label>
                <label 
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded border bg-white cursor-pointer text-xs flex-1 transition-all"
                  :class="rangeMode === 'custom' ? 'border-primary bg-blue-50/50 font-bold text-primary shadow-xs' : 'hover:bg-gray-100'"
                >
                  <input type="radio" v-model="rangeMode" value="custom" @change="onRangeModeChange" />
                  <span>📅 自訂區間</span>
                </label>
              </div>
            </div>
          </div>

          <!-- 整月模式選擇月份 -->
          <div v-if="rangeMode === 'month'" class="form-group mb-3 p-2.5 rounded bg-blue-50/30 border border-blue-200">
            <div class="flex items-center justify-between flex-wrap gap-2">
              <label class="form-label font-bold text-xs text-primary m-0">🗓️ 選擇匯出月份：</label>
              <span class="text-[11px] text-muted">
                （將匯出 {{ exportStartDate }} ~ {{ exportEndDate }} 全月所有班次）
              </span>
            </div>
            <div class="flex items-center gap-2 mt-1.5">
              <input v-model="selectedMonth" type="month" class="form-input form-input-sm" style="max-width: 200px;" @change="onMonthChange" />
              <button type="button" class="btn btn-xs btn-outline" @click="setMonthQuick(0)">本月</button>
              <button type="button" class="btn btn-xs btn-outline" @click="setMonthQuick(1)">下月</button>
            </div>
          </div>

          <!-- 自訂區間模式 -->
          <div v-else class="form-group mb-3 p-2.5 rounded bg-amber-50/40 border border-amber-200">
            <div class="flex items-center justify-between flex-wrap gap-2 mb-1.5">
              <label class="form-label font-bold text-xs text-amber-900 m-0">📅 設定自訂匯出區間：</label>
              <div class="flex items-center gap-1">
                <button type="button" class="btn btn-xs btn-outline" @click="setCustomQuick('current_month')">當月全月</button>
                <button type="button" class="btn btn-xs btn-outline" @click="setCustomQuick('first_half')">上半月 (1~15日)</button>
                <button type="button" class="btn btn-xs btn-outline" @click="setCustomQuick('second_half')">下半月 (16~底)</button>
              </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <span class="text-[11px] text-muted block mb-0.5">開始日期 (Start Date)：</span>
                <input v-model="exportStartDate" type="date" class="form-input form-input-sm font-bold" @change="onCustomDateChange" />
              </div>
              <div>
                <span class="text-[11px] text-muted block mb-0.5">結束日期 (End Date)：</span>
                <input v-model="exportEndDate" type="date" class="form-input form-input-sm font-bold" @change="onCustomDateChange" />
              </div>
            </div>
          </div>

          <div class="form-group mb-3">
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

          <div class="form-group mb-3">
            <label class="form-label font-bold text-xs">4. 選擇志工眾別：</label>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label 
                v-for="g in genderOptions" 
                :key="g.value" 
                class="flex items-center gap-1.5 p-2 rounded border bg-white cursor-pointer text-xs transition-colors"
                :class="selectedGender === g.value ? 'border-primary bg-blue-50/40 font-bold text-primary' : 'hover:bg-gray-100'"
              >
                <input 
                  v-model="selectedGender" 
                  type="radio" 
                  :value="g.value" 
                  class="cursor-pointer"
                />
                <span>{{ g.icon }} {{ g.label }}</span>
              </label>
            </div>
          </div>

          <div class="form-group mb-0">
            <label class="form-label font-bold text-xs">5. 匯出排序與版面方式：</label>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label 
                class="flex items-center gap-1.5 p-2 rounded border bg-white cursor-pointer text-xs transition-colors"
                :class="exportOrderMode === 'date' ? 'border-primary bg-blue-50/40 font-bold text-primary' : 'hover:bg-gray-100'"
              >
                <input 
                  v-model="exportOrderMode" 
                  type="radio" 
                  value="date" 
                  class="cursor-pointer"
                />
                <span>📅 依日期順序排列 (不分組織別，排程總清冊)</span>
              </label>

              <label 
                class="flex items-center gap-1.5 p-2 rounded border bg-white cursor-pointer text-xs transition-colors"
                :class="exportOrderMode === 'org' ? 'border-primary bg-blue-50/40 font-bold text-primary' : 'hover:bg-gray-100'"
              >
                <input 
                  v-model="exportOrderMode" 
                  type="radio" 
                  value="org" 
                  class="cursor-pointer"
                />
                <span>🏢 依互愛及協力分組 (分頁工作表)</span>
              </label>
            </div>
          </div>
        </div>

        <!-- 2. 分頁結構說明提示 -->
        <div class="card p-3 border border-blue-200 bg-blue-50/30 text-xs">
          <div class="font-bold text-primary mb-1 flex items-center justify-between">
            <span>💡 輸出結構特色：</span>
            <span class="text-[11px] font-normal text-muted">
              目前模式：<span class="text-primary font-bold">{{ exportOrderMode === 'date' ? '📅 依日期順序排列 (不論組織別)' : '🏢 依互愛協力分組' }}</span>
            </span>
          </div>
          <ul v-if="exportOrderMode === 'date'" class="text-gray-700 pl-4 list-disc space-y-1 leading-relaxed">
            <li><strong>Excel 檔 (.xlsx)</strong>：不論組織別，完全依照<strong>「值班日期」</strong>由先至後排列匯出單一完整排班總名冊，包含班次、時段、眾別、姓名、所屬組織與簽章欄，適合現場櫃台每日出勤核對。</li>
            <li><strong>PDF 檔 (.pdf)</strong>：依日期先後排程連續產出出勤簽到清冊，不按組織拆頁，支援自動跨頁表頭重現，便於整份列印張貼於公佈欄。</li>
          </ul>
          <ul v-else class="text-gray-700 pl-4 list-disc space-y-1 leading-relaxed">
            <li><strong>Excel 檔 (.xlsx)</strong>：第 1 頁為值班總表，第 2 頁起自動依<strong>「各互愛及各協力」建立獨立工作表 (Worksheet)</strong>，包含出勤簽章與備註欄。</li>
            <li><strong>PDF 檔 (.pdf)</strong>：依各協力分頁排版，每頁頂部皆具備和氣、互愛、協力名稱與簽章欄，<strong>可直接於預覽列印視窗中「另存為 PDF」</strong>。</li>
          </ul>
        </div>

        <!-- 資料載入狀態統計 -->
        <div v-if="loading" class="text-center py-4 text-xs text-muted">
          🔄 正在載入與整理名冊資料中...
        </div>
        <div v-else class="text-xs text-muted flex items-center justify-between px-1 flex-wrap gap-2">
          <span>目前排班席次：<strong class="text-primary">{{ filteredDutiesCount }} 席</strong></span>
          <span v-if="targetXieliCount > 0">涵蓋協力組數：<strong>{{ targetXieliCount }} 組</strong></span>
          <span>匯出區間：<strong class="text-gray-800">{{ exportStartDate }} ~ {{ exportEndDate }}</strong></span>
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
  defaultMonth: { type: String, default: '' },
  defaultStartDate: { type: String, default: '' },
  defaultEndDate: { type: String, default: '' }
});

const emit = defineEmits(['close']);

const dutiesStore = useDutiesStore();
const membersStore = useMembersStore();
const orgsStore = useOrgsStore();
const toast = useToast();

const rangeMode = ref('month'); // 'month' | 'custom'
const selectedLocation = ref(props.defaultLocation || '宜蘭園區');
const selectedMonth = ref(props.defaultMonth || new Date().toISOString().substring(0, 7));
const exportStartDate = ref('');
const exportEndDate = ref('');

const selectedHeqi = ref('all');
const selectedGender = ref('all');
const exportOrderMode = ref('date'); // 'date' (依日期順序，不分組織別) | 'org' (依互愛協力分組)
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

const genderOptions = [
  { value: 'all', label: '全部志工 (不限)', icon: '👥' },
  { value: '男', label: '僅男眾 (男眾班)', icon: '👨' },
  { value: '女', label: '僅女眾 (女眾班)', icon: '👩' }
];

function updateDatesFromMonth(ym) {
  if (!ym) return;
  const [y, m] = ym.split('-').map(Number);
  const lastD = new Date(y, m, 0).getDate();
  exportStartDate.value = `${y}-${String(m).padStart(2, '0')}-01`;
  exportEndDate.value = `${y}-${String(m).padStart(2, '0')}-${String(lastD).padStart(2, '0')}`;
}

async function loadData() {
  if (!exportStartDate.value || !exportEndDate.value) {
    if (selectedMonth.value) {
      updateDatesFromMonth(selectedMonth.value);
    } else {
      return;
    }
  }

  // 防呆：起訖顛倒自動校正
  if (exportStartDate.value > exportEndDate.value) {
    const tmp = exportStartDate.value;
    exportStartDate.value = exportEndDate.value;
    exportEndDate.value = tmp;
  }

  loading.value = true;
  try {
    const [dutiesList, membersList, orgsList] = await Promise.all([
      dutiesStore.fetchDutyScheduleByRange(selectedLocation.value, exportStartDate.value, exportEndDate.value),
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
    if (props.defaultStartDate && props.defaultEndDate) {
      rangeMode.value = 'custom';
      exportStartDate.value = props.defaultStartDate;
      exportEndDate.value = props.defaultEndDate;
      selectedMonth.value = props.defaultStartDate.substring(0, 7);
    } else {
      rangeMode.value = 'month';
      if (props.defaultMonth) selectedMonth.value = props.defaultMonth;
      updateDatesFromMonth(selectedMonth.value);
    }
    loadData();
  }
});

function onLocationChange() {
  loadData();
}

function onRangeModeChange() {
  if (rangeMode.value === 'month') {
    updateDatesFromMonth(selectedMonth.value);
  }
  loadData();
}

function onMonthChange() {
  updateDatesFromMonth(selectedMonth.value);
  loadData();
}

function onCustomDateChange() {
  if (exportStartDate.value && exportEndDate.value) {
    loadData();
  }
}

function setMonthQuick(offsetMonths = 0) {
  const now = new Date();
  now.setMonth(now.getMonth() + offsetMonths);
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  selectedMonth.value = ym;
  updateDatesFromMonth(ym);
  loadData();
}

function setCustomQuick(type) {
  const ym = selectedMonth.value || new Date().toISOString().substring(0, 7);
  const [y, m] = ym.split('-').map(Number);
  const lastD = new Date(y, m, 0).getDate();

  if (type === 'current_month') {
    exportStartDate.value = `${y}-${String(m).padStart(2, '0')}-01`;
    exportEndDate.value = `${y}-${String(m).padStart(2, '0')}-${String(lastD).padStart(2, '0')}`;
  } else if (type === 'first_half') {
    exportStartDate.value = `${y}-${String(m).padStart(2, '0')}-01`;
    exportEndDate.value = `${y}-${String(m).padStart(2, '0')}-15`;
  } else if (type === 'second_half') {
    exportStartDate.value = `${y}-${String(m).padStart(2, '0')}-16`;
    exportEndDate.value = `${y}-${String(m).padStart(2, '0')}-${String(lastD).padStart(2, '0')}`;
  }
  loadData();
}

const enrichedList = computed(() => {
  return enrichDutyList(internalDuties.value, internalMembers.value, internalOrgs.value);
});

const filteredDuties = computed(() => {
  let list = enrichedList.value;
  if (exportStartDate.value) {
    list = list.filter(d => d.dutyDate >= exportStartDate.value);
  }
  if (exportEndDate.value) {
    list = list.filter(d => d.dutyDate <= exportEndDate.value);
  }
  if (selectedHeqi.value !== 'all') {
    list = list.filter(d => d.heqi === selectedHeqi.value);
  }
  if (selectedGender.value !== 'all') {
    list = list.filter(d => d.genderType === selectedGender.value);
  }
  return list;
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
    const [year, month] = selectedMonth.value ? selectedMonth.value.split('-').map(Number) : [null, null];
    const res = exportDutyScheduleToExcel({
      location: selectedLocation.value,
      year,
      month,
      startDate: exportStartDate.value,
      endDate: exportEndDate.value,
      duties: internalDuties.value,
      members: internalMembers.value,
      orgs: internalOrgs.value,
      targetHeqi: selectedHeqi.value,
      targetGender: selectedGender.value,
      mode: exportOrderMode.value
    });
    if (exportOrderMode.value === 'date') {
      toast.success(`🎉 Excel 匯出成功！已依照日期順序產出 ${res.totalCount} 席次排班名冊 (${exportStartDate.value} ~ ${exportEndDate.value})。`);
    } else {
      toast.success(`🎉 Excel 匯出成功！共產出 ${res.totalCount} 席次、${res.groupCount} 個協力工作頁 (${exportStartDate.value} ~ ${exportEndDate.value})。`);
    }
  } catch (err) {
    toast.error('匯出 Excel 失敗：' + err.message);
  } finally {
    exporting.value = false;
  }
}

function handleBatchHeqi() {
  exporting.value = true;
  try {
    const [year, month] = selectedMonth.value ? selectedMonth.value.split('-').map(Number) : [null, null];
    const count = exportBatchHeqiExcel({
      location: selectedLocation.value,
      year,
      month,
      startDate: exportStartDate.value,
      endDate: exportEndDate.value,
      duties: internalDuties.value,
      members: internalMembers.value,
      orgs: internalOrgs.value,
      targetGender: selectedGender.value,
      mode: exportOrderMode.value
    });
    const modeDesc = exportOrderMode.value === 'date' ? '依日期順序' : '依協力分頁';
    toast.success(`🎉 已啟動批次下載！正在為各和氣分別產出${modeDesc}專屬 Excel 檔案（共 ${count} 份，區間：${exportStartDate.value} ~ ${exportEndDate.value}）。`);
  } catch (err) {
    toast.error('批次匯出失敗：' + err.message);
  } finally {
    exporting.value = false;
  }
}

function handlePrintPdf() {
  exporting.value = true;
  try {
    const [year, month] = selectedMonth.value ? selectedMonth.value.split('-').map(Number) : [null, null];
    printDutySchedulePdf({
      location: selectedLocation.value,
      year,
      month,
      startDate: exportStartDate.value,
      endDate: exportEndDate.value,
      duties: internalDuties.value,
      members: internalMembers.value,
      orgs: internalOrgs.value,
      targetHeqi: selectedHeqi.value,
      targetGender: selectedGender.value,
      mode: exportOrderMode.value
    });
    const modeDesc = exportOrderMode.value === 'date' ? '依日期順序' : '依協力分頁';
    toast.info(`📄 已啟動列印預覽（${modeDesc}）！請於列印視窗中選擇「另存為 PDF」或實體印表機。`);
  } catch (err) {
    toast.error('啟動列印失敗：' + err.message);
  } finally {
    exporting.value = false;
  }
}

onMounted(() => {
  if (props.show) {
    if (props.defaultStartDate && props.defaultEndDate) {
      rangeMode.value = 'custom';
      exportStartDate.value = props.defaultStartDate;
      exportEndDate.value = props.defaultEndDate;
    } else {
      updateDatesFromMonth(selectedMonth.value);
    }
    loadData();
  }
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

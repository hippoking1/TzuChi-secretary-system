<template>
  <div class="duty-search-view container mt-6">
    <!-- 頂部標題與說明 -->
    <div class="text-center mb-6">
      <h1 class="text-3xl font-bold text-gray-900 m-0">道場志工值班查詢與全月行事曆</h1>
      <p class="text-muted text-sm mt-2">
        提供全月排班行事曆以供查閱同仁協調調換班，亦可查詢個人專屬值班時段
      </p>
    </div>

    <!-- 模式切換 Tabs -->
    <div class="flex justify-center mb-6">
      <div class="tab-pill-group">
        <button 
          type="button"
          class="tab-pill-btn" 
          :class="{ 'tab-pill-active': activeTab === 'calendar' }"
          @click="activeTab = 'calendar'"
        >
          🗓️ 全月志工值班行事曆 (查閱調換班)
        </button>
        <button 
          type="button"
          class="tab-pill-btn" 
          :class="{ 'tab-pill-active': activeTab === 'personal' }"
          @click="activeTab = 'personal'"
        >
          👤 查詢個人值班時段
        </button>
      </div>
    </div>

    <!-- ────────────────────────────────────────── -->
    <!-- TAB 1: 全月所有志工值班行事曆 -->
    <!-- ────────────────────────────────────────── -->
    <div v-if="activeTab === 'calendar'" class="calendar-tab-content">
      <!-- 控制列：場地、月份、搜尋與匯出 -->
      <div class="card p-4 mb-4 bg-white shadow-sm border border-gray-200">
        <div class="flex items-center justify-between flex-wrap gap-4">
          <div class="flex items-center gap-3 flex-wrap">
            <div class="form-group mb-0">
              <label class="form-label font-bold text-xs">1. 值班場地：</label>
              <select v-model="selectedLocation" class="form-select form-select-sm" style="min-width: 130px;" @change="loadCalendarSchedule">
                <option value="宜蘭園區">宜蘭園區</option>
                <option value="東港聯絡處">東港聯絡處</option>
              </select>
            </div>

            <div class="form-group mb-0">
              <label class="form-label font-bold text-xs">2. 選擇月份：</label>
              <input v-model="selectedMonth" type="month" class="form-input form-input-sm" style="min-width: 140px;" @change="loadCalendarSchedule" />
            </div>

            <div class="form-group mb-0">
              <label class="form-label font-bold text-xs">3. 快速查找志工姓名：</label>
              <input 
                v-model="searchVolunteerQuery" 
                type="text" 
                class="form-input form-input-sm" 
                placeholder="輸入姓名高亮標示..." 
                style="min-width: 160px;"
              />
            </div>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <button 
              type="button" 
              class="btn btn-outline btn-sm flex items-center gap-1.5"
              @click="showExportModal = true"
            >
              <span>📤 匯出排班名冊 (Excel/PDF)</span>
            </button>
            <button 
              type="button" 
              class="btn btn-primary btn-sm flex items-center gap-1.5"
              :disabled="loading"
              @click="loadCalendarSchedule"
            >
              <span>{{ loading ? '載入中...' : '🔄 重新載入' }}</span>
            </button>
          </div>
        </div>

        <!-- 志工調換班提示 Banner -->
        <div class="mt-3 p-2.5 rounded bg-blue-50/60 border border-blue-200 text-xs text-blue-900 flex items-center justify-between flex-wrap gap-2">
          <div>
            <strong>💡 調班換班提示：</strong>
            若您因事無法值班，可點擊日曆日期檢視當日值班志工名單與單位，並至<strong>【慈濟小秘書】LINE 官方帳號</strong>點選<strong>【調班換班】</strong>發起委託代班或互換申請！
          </div>
          <span class="badge badge-info">
            本月共 {{ monthAssignedCount }} 席次已排定
          </span>
        </div>
      </div>

      <!-- 載入中骨架屏 -->
      <div v-if="loading" class="card text-center p-8">
        <p class="text-muted text-base">正在載入 {{ selectedLocation }} 全月排班行事曆...</p>
      </div>

      <!-- 月曆卡片 -->
      <div v-else class="card calendar-card table-responsive p-3 bg-white border border-gray-200 shadow-sm">
        <div class="calendar-wrapper">
          <div class="calendar-grid-header">
            <div v-for="d in ['週日', '週一', '週二', '週三', '週四', '週五', '週六']" :key="d" class="cal-day-head">
              {{ d }}
            </div>
          </div>

          <div class="calendar-grid-body">
            <div 
              v-for="(cell, i) in calendarCells" 
              :key="i" 
              class="cal-cell"
              :class="{ 
                'empty-cell': !cell.date, 
                'weekend-cell': cell.isWeekend,
                'has-matched-member': cell.hasMatch
              }"
              @click="cell.date && openDayDetails(cell)"
            >
              <div v-if="cell.date" class="cell-inner">
                <div class="cell-top-bar flex items-center justify-between mb-1">
                  <span class="cell-day-num" :class="{ 'text-gold': cell.isWeekend }">
                    {{ cell.day }}
                  </span>
                  <span v-if="cell.shifts.length > 0" class="shift-count-badge">
                    {{ cell.shifts.filter(s => !!s.memberName).length }} / {{ cell.shifts.length }}
                  </span>
                </div>

                <!-- 班次清單 -->
                <div class="cell-shifts-list">
                  <div 
                    v-for="shift in cell.shifts.slice(0, 6)" 
                    :key="shift.id" 
                    class="shift-chip"
                    :class="[
                      shift.genderType === '男' ? 'chip-male' : 'chip-female',
                      isMatchSearch(shift.memberName) ? 'chip-highlight-match' : ''
                    ]"
                    :title="`${shift.shiftLabel} (${shift.timeRange || ''}): ${shift.memberName || '未指派'}`"
                  >
                    <span class="chip-label">{{ shift.shiftLabel.replace('班', '') }}</span>
                    <span class="chip-name font-bold">{{ shift.memberName || '未指派' }}</span>
                  </div>

                  <div v-if="cell.shifts.length > 6" class="more-chip">
                    + 還有 {{ cell.shifts.length - 6 }} 席...
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ────────────────────────────────────────── -->
    <!-- TAB 2: 查詢個人值班 -->
    <!-- ────────────────────────────────────────── -->
    <div v-else class="personal-tab-content">
      <div class="card max-w-2xl mx-auto shadow-sm">
        <h2 class="text-xl font-bold text-center mb-1">個人值班時段速查</h2>
        <p class="text-center text-muted text-xs mb-5">請依序選擇所屬組織與志工姓名，快速列出該月份您的值班紀錄</p>

        <div class="form-group">
          <label class="form-label required text-xs">1. 選擇和氣 / 互愛 / 協力</label>
          <OrgCascader v-model="selectedOrgId" @change="onOrgChange" />
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="form-group mb-0">
            <label class="form-label required text-xs">2. 選擇志工姓名</label>
            <select v-model="selectedMemberId" class="form-select form-select-sm" :disabled="!selectedOrgId">
              <option value="">-- 請選擇志工 --</option>
              <option v-for="m in memberList" :key="m.id" :value="m.id">{{ m.name }}</option>
            </select>
          </div>

          <div class="form-group mb-0">
            <label class="form-label required text-xs">3. 查詢月份</label>
            <input v-model="selectedMonth" type="month" class="form-input form-input-sm" />
          </div>
        </div>

        <button class="btn btn-primary btn-block mt-5" :disabled="!selectedMemberId || loading" @click="handlePersonalSearch">
          {{ loading ? '查詢中...' : '🔍 查詢個人值班' }}
        </button>
      </div>

      <!-- 個人值班結果卡片 -->
      <div v-if="hasSearched" class="mt-8 max-w-4xl mx-auto">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold text-lg m-0">
            📋 {{ selectedMemberName }} 值班清單 ({{ selectedMonth }})
          </h3>
          <span class="badge badge-primary">共 {{ personalResults.length }} 班次</span>
        </div>

        <div v-if="personalResults.length === 0" class="card text-center p-8 text-muted">
          該月份尚無您的排班紀錄
        </div>
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div v-for="d in personalResults" :key="d.id" class="card p-4 border hover:shadow-md transition-shadow">
            <div class="flex justify-between items-center mb-2">
              <span class="badge badge-info">{{ d.location }}</span>
              <span class="font-bold text-sm text-gray-800">{{ d.dutyDate }} ({{ getDayOfWeek(d.dutyDate) }})</span>
            </div>
            <p class="font-bold text-primary text-base m-0">
              {{ d.shiftLabel }} ({{ d.genderType }}眾)
            </p>
            <p class="text-sm font-semibold text-gray-700 mt-2">
              🕒 值班時間：{{ d.timeRange || dutiesStore.getShiftTimeRange(d.location, d.shiftId, d.shiftLabel) || '詳洽幹事' }}
            </p>
            <div class="mt-3 pt-2 border-t flex justify-between items-center text-xs text-muted">
              <span>席位：第 {{ d.slotIndex }} 席</span>
              <span class="badge badge-success">已排班</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ────────────────────────────────────────── -->
    <!-- 當日值班詳情 Modal (點擊月曆格子彈出) -->
    <!-- ────────────────────────────────────────── -->
    <div v-if="showDayModal" class="modal-backdrop" @click="showDayModal = false">
      <div class="modal-content" style="max-width: 600px;" @click.stop>
        <div class="modal-header">
          <div>
            <h3 class="modal-title flex items-center gap-2">
              🗓️ {{ selectedDayCell?.date }} ({{ selectedDayCell?.dayOfWeek }}) 值班名單
            </h3>
            <p class="text-xs text-muted mt-1">
              道場：{{ selectedLocation }} ｜ 共 {{ selectedDayCell?.shifts?.length }} 席位
            </p>
          </div>
          <button class="modal-close" @click="showDayModal = false">×</button>
        </div>

        <div class="modal-body">
          <!-- 換班教學提示 -->
          <div class="card p-3 mb-3 bg-amber-50/60 border border-amber-200 text-xs text-amber-900 leading-relaxed">
            <strong>🤝 想找同伴調換班？</strong>
            若您需在當日找人代班或換班，請記下上方志工姓名，並直接使用<strong>【慈濟小秘書 LINE Bot】</strong>常駐選單發起【調班換班】申請，系統將即時通知對方確認！
          </div>

          <div class="flex flex-col gap-2.5">
            <div 
              v-for="s in selectedDayCell?.shifts" 
              :key="s.id" 
              class="card p-3 flex items-center justify-between border"
              :class="s.genderType === '男' ? 'border-blue-200 bg-blue-50/20' : 'border-rose-200 bg-rose-50/20'"
            >
              <div>
                <div class="flex items-center gap-2 mb-1">
                  <span class="badge text-xs" :class="s.genderType === '男' ? 'badge-info' : 'badge-danger'">
                    {{ s.genderType }}眾
                  </span>
                  <strong class="text-sm text-gray-800">{{ s.shiftLabel }}</strong>
                  <span class="text-xs text-muted">({{ s.timeRange || dutiesStore.getShiftTimeRange(selectedLocation, s.shiftId, s.shiftLabel) }})</span>
                </div>
                <!-- 志工所屬組織與聯絡資訊 -->
                <p class="text-xs text-muted m-0">
                  所屬組織：{{ getMemberOrgPathText(s) || '全區/未指定' }}
                </p>
              </div>

              <div class="text-right">
                <span class="font-bold text-base" :class="s.memberName ? 'text-primary' : 'text-muted'">
                  {{ s.memberName || '（未指派）' }}
                </span>
                <span v-if="getMemberPhone(s)" class="text-xs text-gray-500 block mt-0.5">
                  📞 {{ getMemberPhone(s) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer flex items-center justify-between">
          <span class="text-xs text-muted">點選外部任意處可關閉</span>
          <button class="btn btn-outline btn-sm" @click="showDayModal = false">關閉</button>
        </div>
      </div>
    </div>

    <!-- ────────────────────────────────────────── -->
    <!-- 匯出整月排班名單 Modal (Excel & PDF) -->
    <!-- ────────────────────────────────────────── -->
    <DutyExportModal 
      :show="showExportModal" 
      :default-location="selectedLocation" 
      :default-month="selectedMonth" 
      @close="showExportModal = false" 
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import OrgCascader from '@/components/ui/OrgCascader.vue';
import DutyExportModal from '@/components/duty/DutyExportModal.vue';
import { useMembersStore } from '@/stores/members';
import { useDutiesStore } from '@/stores/duties';
import { useOrgsStore } from '@/stores/orgs';

const membersStore = useMembersStore();
const dutiesStore = useDutiesStore();
const orgsStore = useOrgsStore();

// Tab 狀態
const activeTab = ref('calendar'); // 'calendar' | 'personal'

// 全月行事曆狀態
const selectedLocation = ref('宜蘭園區');
const selectedMonth = ref(new Date().toISOString().substring(0, 7));
const searchVolunteerQuery = ref('');
const loading = ref(false);
const showDayModal = ref(false);
const selectedDayCell = ref(null);
const showExportModal = ref(false);

// 個人查詢狀態
const selectedOrgId = ref('');
const selectedMemberId = ref('');
const memberList = ref([]);
const hasSearched = ref(false);
const personalResults = ref([]);

function getDayOfWeek(dateStr) {
  if (!dateStr) return '';
  const days = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
  const [y, m, d] = dateStr.split('-').map(Number);
  return days[new Date(y, m - 1, d).getDay()];
}

// 載入全月值班行事曆
async function loadCalendarSchedule() {
  if (!selectedMonth.value) return;
  loading.value = true;
  try {
    const [year, month] = selectedMonth.value.split('-').map(Number);
    await Promise.all([
      dutiesStore.fetchDutySchedule(selectedLocation.value, year, month),
      membersStore.members.length > 0 ? membersStore.members : membersStore.fetchMembers(),
      orgsStore.orgs.length > 0 ? orgsStore.orgs : orgsStore.fetchOrgs()
    ]);
  } finally {
    loading.value = false;
  }
}

// 產生月曆 7 欄格子
const calendarCells = computed(() => {
  if (!selectedMonth.value) return [];
  const [year, month] = selectedMonth.value.split('-').map(Number);
  const firstDayIndex = new Date(year, month - 1, 1).getDay();
  const totalDays = new Date(year, month, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDayIndex; i++) {
    cells.push({ date: null });
  }

  const query = searchVolunteerQuery.value.trim().toLowerCase();

  for (let day = 1; day <= totalDays; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dateObj = new Date(year, month - 1, day);
    const dayOfWeekIdx = dateObj.getDay();
    const isWeekend = dayOfWeekIdx === 0 || dayOfWeekIdx === 6;
    const dayShifts = dutiesStore.duties.filter(d => d.dutyDate === dateStr);

    let hasMatch = false;
    if (query) {
      hasMatch = dayShifts.some(s => (s.memberName || '').toLowerCase().includes(query));
    }

    cells.push({
      day,
      date: dateStr,
      dayOfWeek: ['週日', '週一', '週二', '週三', '週四', '週五', '週六'][dayOfWeekIdx],
      isWeekend,
      shifts: dayShifts,
      hasMatch
    });
  }

  return cells;
});

const monthAssignedCount = computed(() => {
  return dutiesStore.duties.filter(d => !!d.memberName).length;
});

function isMatchSearch(name) {
  if (!searchVolunteerQuery.value || !name) return false;
  return name.toLowerCase().includes(searchVolunteerQuery.value.trim().toLowerCase());
}

function openDayDetails(cell) {
  selectedDayCell.value = cell;
  showDayModal.value = true;
}

function getMemberOrgPathText(shift) {
  if (!shift.memberId && !shift.memberName) return '';
  const m = membersStore.members.find(x => x.id === shift.memberId || x.name === shift.memberName);
  if (!m || !m.orgId) return '';
  return orgsStore.getOrgPath(m.orgId);
}

function getMemberPhone(shift) {
  if (!shift.memberId && !shift.memberName) return '';
  const m = membersStore.members.find(x => x.id === shift.memberId || x.name === shift.memberName);
  return m?.phone || '';
}

// 個人查詢分頁邏輯
async function onOrgChange(orgId) {
  if (!orgId) {
    memberList.value = [];
    return;
  }
  memberList.value = await membersStore.fetchMembers({ orgId });
}

const selectedMemberName = computed(() => {
  const found = memberList.value.find(x => x.id === selectedMemberId.value);
  return found ? found.name : '志工';
});

async function handlePersonalSearch() {
  loading.value = true;
  try {
    const [year, month] = selectedMonth.value.split('-').map(Number);
    const [yilanDuties, donggangDuties] = await Promise.all([
      dutiesStore.fetchDutySchedule('宜蘭園區', year, month),
      dutiesStore.fetchDutySchedule('東港聯絡處', year, month)
    ]);
    
    const combined = [...yilanDuties, ...donggangDuties];
    const targetMember = memberList.value.find(x => x.id === selectedMemberId.value);
    const targetName = targetMember ? targetMember.name : '';

    personalResults.value = combined.filter(d => 
      (d.memberId && d.memberId === selectedMemberId.value) || 
      (targetName && d.memberName === targetName)
    );
    hasSearched.value = true;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadCalendarSchedule();
});
</script>

<style scoped>
.duty-search-view {
  max-width: 1240px;
  margin: 0 auto;
}

/* Tab 膠囊切換鈕 */
.tab-pill-group {
  display: inline-flex;
  padding: 0.25rem;
  background: var(--gray-200);
  border-radius: var(--radius-full);
}
.tab-pill-btn {
  padding: 0.5rem 1.25rem;
  font-size: 0.9rem;
  font-weight: 600;
  border: none;
  background: transparent;
  border-radius: var(--radius-full);
  color: var(--gray-600);
  cursor: pointer;
  transition: all 0.2s ease;
}
.tab-pill-active {
  background: #ffffff;
  color: var(--primary-700);
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

/* 月曆樣式 */
.calendar-card {
  padding: 1rem;
}
.calendar-wrapper {
  min-width: 860px;
}
.calendar-grid-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  font-weight: 700;
  padding: 0.75rem 0;
  border-bottom: 2px solid var(--gray-200);
  background: #ffffff;
}
.cal-day-head {
  color: var(--gray-700);
  font-size: 0.9rem;
}
.calendar-grid-body {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
  background: var(--gray-200);
  border: 1px solid var(--gray-200);
}
.cal-cell {
  background: #ffffff;
  min-height: 120px;
  padding: 0.45rem;
  cursor: pointer;
  transition: background-color 0.15s ease, box-shadow 0.15s ease;
}
.cal-cell:hover:not(.empty-cell) {
  background: #f8fafc;
  box-shadow: inset 0 0 0 2px var(--primary-400);
}
.empty-cell {
  background: #f1f5f9;
  cursor: default;
}
.weekend-cell {
  background: #fffdf5;
}
.has-matched-member {
  background: #fefce8 !important;
  box-shadow: inset 0 0 0 2px var(--warning) !important;
}

.cell-day-num {
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--gray-800);
}
.text-gold {
  color: #b45309;
}
.shift-count-badge {
  font-size: 0.7rem;
  color: var(--gray-500);
  background: var(--gray-100);
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
}

/* 班次小標籤 */
.cell-shifts-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-top: 0.3rem;
}
.shift-chip {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.78rem;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  border: 1px solid transparent;
}
.chip-male {
  background: #eff6ff;
  color: #1e40af;
  border-color: #bfdbfe;
}
.chip-female {
  background: #fff1f2;
  color: #9f1239;
  border-color: #fecdd3;
}
.chip-highlight-match {
  background: #fde047 !important;
  color: #854d0e !important;
  border-color: #eab308 !important;
  font-weight: 900 !important;
  box-shadow: 0 1px 3px rgba(0,0,0,0.15);
}
.chip-label {
  font-size: 0.7rem;
  opacity: 0.85;
}
.chip-name {
  overflow: hidden;
  text-overflow: ellipsis;
}
.more-chip {
  font-size: 0.7rem;
  color: var(--primary-600);
  text-align: center;
  font-weight: 600;
  margin-top: 0.15rem;
}

.max-w-2xl { max-width: 680px; }
.max-w-4xl { max-width: 960px; }
.mx-auto { margin-left: auto; margin-right: auto; }
.btn-block { width: 100%; }

/* Modal 彈出視窗 */
.modal-backdrop {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  background: rgba(15, 23, 42, 0.6); display: flex; align-items: center; justify-content: center; z-index: 9990;
}
.modal-content { background: #ffffff; border-radius: var(--radius-lg); width: 92%; }
.modal-header { padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--gray-200); display: flex; justify-content: space-between; align-items: center; }
.modal-body { padding: 1.25rem 1.5rem; max-height: 75vh; overflow-y: auto; }
.modal-footer { padding: 1rem 1.5rem; background: var(--gray-50); border-top: 1px solid var(--gray-200); }
.modal-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--gray-500); }
</style>

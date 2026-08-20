<template>
  <div class="admin-duty-form">
    <!-- 頂部導航與標題 -->
    <div class="flex items-center justify-between mb-6 flex-wrap gap-4">
      <div>
        <h1 class="text-2xl font-bold">📝 編輯月度值班表</h1>
        <p class="text-sm text-muted">
          已排班進度：<strong class="text-primary">{{ assignedTotalCount }} / {{ matrixList.length }} 席</strong>
          （包含完整值班時段、各班次配額人數與所屬組織路徑）
        </p>
      </div>
      <div class="flex items-center gap-3 flex-wrap">
        <router-link to="/admin/duty-schedule" class="btn btn-outline">
          ← 返回值班月曆
        </router-link>
        <button class="btn btn-primary" :disabled="saving" @click="handleSave">
          {{ saving ? '儲存中...' : '💾 儲存本月排班表' }}
        </button>
      </div>
    </div>

    <!-- 1. 場地與月份選擇控制卡片 -->
    <div class="card mb-6 p-4">
      <div class="grid grid-cols-3 gap-4 items-end">
        <div class="form-group mb-0">
          <label class="form-label font-bold">1. 選擇場地：</label>
          <select v-model="selectedLocation" class="form-select" @change="initMatrix">
            <option value="宜蘭園區">宜蘭園區 (女眾08:00~16:00, 男眾一班16:00~18:30, 男眾二班18:30~20:30)</option>
            <option value="東港聯絡處">東港聯絡處 (女眾08:00~13:00, 男眾13:00~17:00)</option>
          </select>
        </div>

        <div class="form-group mb-0">
          <label class="form-label font-bold">2. 選擇月份：</label>
          <input v-model="selectedMonth" type="month" class="form-input" @change="initMatrix" />
        </div>

        <div>
          <button class="btn btn-secondary btn-block" :disabled="loading" @click="initMatrix">
            {{ loading ? '載入中...' : '🔄 重新整理 / 載入排班表' }}
          </button>
        </div>
      </div>

      <!-- 快速過濾列 -->
      <div class="flex items-center justify-between border-t mt-4 pt-3 flex-wrap gap-3">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-xs font-bold text-gray-600">快速過濾志工：</span>
          <select v-model="filterOrgId" class="form-select form-select-sm" style="max-width: 220px;">
            <option value="">-- 全部組織組別 --</option>
            <option v-for="org in orgsStore.orgs" :key="org.id" :value="org.id">
              {{ orgsStore.getOrgPath(org.id) || org.name }}
            </option>
          </select>
          <input 
            v-model="searchKeyword" 
            type="text" 
            class="form-input form-input-sm" 
            placeholder="搜尋姓名或電話..." 
            style="max-width: 160px;"
          />
        </div>
      </div>
    </div>

    <div v-if="loading" class="card text-center p-8">
      <p class="text-muted text-lg">載入排班表與志工資料中...</p>
    </div>

    <!-- 每日值班名單填寫 (經典版面結構) -->
    <div v-else class="days-container flex flex-col gap-6">
      <div 
        v-for="day in groupedDays" 
        :key="day.dateStr" 
        class="card day-block-card"
        :class="{ 'weekend-highlight': day.isWeekend }"
      >
        <!-- 日期標題欄 -->
        <div class="day-block-header flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-primary font-bold text-lg">🗓️ {{ day.dateStr }}</span>
            <span class="badge" :class="day.isWeekend ? 'badge-warning' : 'badge-gray'">
              {{ day.dayOfWeek }}
            </span>
          </div>
          <span class="text-xs text-muted">
            已排定 {{ day.slots.filter(s => !!s.memberName).length }} / {{ day.slots.length }} 席
          </span>
        </div>

        <!-- 班次分區網格 (女眾班、男眾一班、男眾二班) -->
        <div class="grid grid-cols-2 gap-4 mt-4">
          <div 
            v-for="shiftGroup in day.shiftGroups" 
            :key="shiftGroup.shiftId" 
            class="shift-group-box"
            :class="shiftGroup.genderType === '男' ? 'box-male' : 'box-female'"
          >
            <!-- 班次標題 (包含完整時間與人數配額) -->
            <div class="shift-group-title flex items-center justify-between mb-3">
              <span class="font-bold text-sm text-gray-800">
                {{ shiftGroup.shiftLabel }} ({{ shiftGroup.timeRange }}) - {{ shiftGroup.genderType }}眾 ({{ shiftGroup.quota }}位)
              </span>
            </div>

            <!-- 各個席位下拉選單 (支援 姓名 + 和氣/互愛/協力 完整路徑) -->
            <div class="slots-list flex flex-col gap-2">
              <div 
                v-for="slot in shiftGroup.slots" 
                :key="slot.id" 
                class="slot-row flex items-center gap-2"
              >
                <select 
                  v-model="slot.memberId" 
                  class="form-select form-select-sm flex-1"
                  @change="onSlotMemberChange(slot)"
                >
                  <option value="">-- 未指派 --</option>
                  <!-- 若已排定但不在目前過濾範圍內，顯示於首位 -->
                  <option 
                    v-if="slot.memberId && !getFilteredVolunteers(slot.genderType).some(m => m.id === slot.memberId)"
                    :value="slot.memberId"
                  >
                    ★ {{ slot.memberName }} {{ getMemberOrgPathText(slot.memberId) }}
                  </option>
                  <option 
                    v-for="m in getFilteredVolunteers(slot.genderType)" 
                    :key="m.id" 
                    :value="m.id"
                  >
                    {{ m.name }} {{ getMemberOrgPathText(m.id) }} [本月: {{ getMemberShiftCount(m.name) }}班]
                  </option>
                </select>

                <button 
                  v-if="slot.memberId || slot.memberName" 
                  class="btn btn-sm btn-outline btn-clear" 
                  @click="clearSlot(slot)" 
                  title="清空此席位"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useDutiesStore } from '@/stores/duties';
import { useMembersStore } from '@/stores/members';
import { useOrgsStore } from '@/stores/orgs';
import { useToast } from '@/composables/useToast';

const dutiesStore = useDutiesStore();
const membersStore = useMembersStore();
const orgsStore = useOrgsStore();
const toast = useToast();

const selectedLocation = ref('宜蘭園區');
const selectedMonth = ref(new Date().toISOString().substring(0, 7));
const filterOrgId = ref('');
const searchKeyword = ref('');
const loading = ref(false);
const saving = ref(false);

const matrixList = ref([]);
const allMembers = ref([]);
const maleMembers = ref([]);
const femaleMembers = ref([]);

function getDayOfWeek(dateStr) {
  const days = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
  return days[new Date(dateStr).getDay()];
}

const assignedTotalCount = computed(() => {
  return matrixList.value.filter(s => !!s.memberName).length;
});

function getMemberOrgPathText(memberId) {
  if (!memberId) return '';
  const m = allMembers.value.find(x => x.id === memberId);
  if (!m || !m.orgId) return '';
  const path = orgsStore.getOrgPath(m.orgId);
  return path ? `(${path})` : '';
}

// 過濾志工清單（支援組織、搜尋關鍵字）
function getFilteredVolunteers(gender) {
  const baseList = gender === '男' ? maleMembers.value : femaleMembers.value;
  return baseList.filter(m => {
    if (filterOrgId.value && m.orgId !== filterOrgId.value) return false;
    if (searchKeyword.value) {
      const kw = searchKeyword.value.toLowerCase();
      const matchName = (m.name || '').toLowerCase().includes(kw);
      const matchPhone = (m.phone || '').includes(kw);
      const matchCode = (m.volunteerCode || '').includes(kw);
      if (!matchName && !matchPhone && !matchCode) return false;
    }
    return true;
  });
}

function getMemberShiftCount(memberName) {
  if (!memberName) return 0;
  return matrixList.value.filter(s => s.memberName === memberName).length;
}

function onSlotMemberChange(slot) {
  const found = allMembers.value.find(m => m.id === slot.memberId);
  slot.memberName = found ? found.name : '';
  slot.orgPath = found ? orgsStore.getOrgPath(found.orgId) : '';
}

function clearSlot(slot) {
  slot.memberId = '';
  slot.memberName = '';
  slot.orgPath = '';
}

// 按日分組與班次分組（重構為舊版清楚排版）
const groupedDays = computed(() => {
  const daysMap = {};
  matrixList.value.forEach(slot => {
    if (!daysMap[slot.dutyDate]) {
      daysMap[slot.dutyDate] = {
        dateStr: slot.dutyDate,
        dayOfWeek: getDayOfWeek(slot.dutyDate),
        isWeekend: slot.isWeekend,
        slots: [],
        shiftGroupsMap: {}
      };
    }
    daysMap[slot.dutyDate].slots.push(slot);

    // 依班次 shiftId 分組
    if (!daysMap[slot.dutyDate].shiftGroupsMap[slot.shiftId]) {
      daysMap[slot.dutyDate].shiftGroupsMap[slot.shiftId] = {
        shiftId: slot.shiftId,
        shiftLabel: slot.shiftLabel,
        timeRange: slot.timeRange || dutiesStore.getShiftTimeRange(selectedLocation.value, slot.shiftId, slot.shiftLabel),
        genderType: slot.genderType,
        quota: slot.quota || (slot.genderType === '男' ? (selectedLocation.value === '東港聯絡處' ? 1 : 2) : (selectedLocation.value === '東港聯絡處' ? 2 : 4)),
        slots: []
      };
    }
    daysMap[slot.dutyDate].shiftGroupsMap[slot.shiftId].slots.push(slot);
  });

  return Object.values(daysMap).map(d => ({
    ...d,
    shiftGroups: Object.values(d.shiftGroupsMap)
  }));
});

function getShiftNormalizedKey(shiftId, label, gender) {
  if (shiftId === 'DG_F' || shiftId === 'donggang_female' || (label && label.includes('女') && gender === '女')) return 'female_1';
  if (shiftId === 'DG_M' || shiftId === 'donggang_male' || (label && label.includes('男') && gender === '男')) return 'male_1';
  if (shiftId === 'YL_F' || shiftId === 'yilan_female') return 'female_1';
  if (shiftId === 'YL_M1' || shiftId === 'yilan_male_1' || label === '男眾一班' || label === '男眾班(一)') return 'male_1';
  if (shiftId === 'YL_M2' || shiftId === 'yilan_male_2' || label === '男眾二班' || label === '男眾班(二)') return 'male_2';
  return shiftId || label || gender;
}

// 初始化排班矩陣並精準綁定現有資料庫資料
async function initMatrix() {
  loading.value = true;
  try {
    const [year, month] = selectedMonth.value.split('-').map(Number);
    const template = dutiesStore.generateMonthlyTemplate(selectedLocation.value, year, month);
    const existing = await dutiesStore.fetchDutySchedule(selectedLocation.value, year, month);

    const existingGrouped = {};
    existing.forEach(item => {
      const normKey = getShiftNormalizedKey(item.shiftId, item.shiftLabel, item.genderType);
      const key = `${item.dutyDate}_${normKey}`;
      if (!existingGrouped[key]) existingGrouped[key] = [];
      existingGrouped[key].push(item);
    });

    const nameToMemberMap = {};
    allMembers.value.forEach(m => {
      if (m.name) nameToMemberMap[m.name] = m;
    });

    matrixList.value = template.map(t => {
      const normKey = getShiftNormalizedKey(t.shiftId, t.shiftLabel, t.genderType);
      const key = `${t.dutyDate}_${normKey}`;
      const matchedItems = existingGrouped[key] || [];
      const existingItem = matchedItems[t.slotIndex - 1];

      if (existingItem) {
        let memberId = existingItem.memberId || '';
        const memberName = existingItem.memberName || '';
        
        if (memberName && nameToMemberMap[memberName]) {
          memberId = nameToMemberMap[memberName].id;
        } else if (!memberId && memberName) {
          memberId = memberName;
        }

        return {
          ...t,
          docId: existingItem.id,
          memberId,
          memberName,
          timeRange: t.timeRange || existingItem.timeRange || dutiesStore.getShiftTimeRange(selectedLocation.value, t.shiftId, t.shiftLabel)
        };
      }

      return t;
    });
  } finally {
    loading.value = false;
  }
}

async function handleSave() {
  saving.value = true;
  try {
    const [year, month] = selectedMonth.value.split('-').map(Number);
    await dutiesStore.saveMonthlyDuties(selectedLocation.value, year, month, matrixList.value);
    toast.success('全月排班表儲存成功！');
  } catch (err) {
    toast.error('儲存失敗：' + err.message);
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  loading.value = true;
  const [males, females] = await Promise.all([
    membersStore.fetchMembers({ gender: '男' }),
    membersStore.fetchMembers({ gender: '女' }),
    orgsStore.fetchOrgs()
  ]);
  maleMembers.value = males;
  femaleMembers.value = females;
  allMembers.value = [...males, ...females];
  await initMatrix();
});
</script>

<style scoped>
.btn-block { width: 100%; }
.form-select-sm, .form-input-sm {
  min-height: 38px;
  padding: 0.35rem 0.65rem;
  font-size: 0.88rem;
}
.day-block-card {
  border: 1px solid var(--gray-200);
  background: #ffffff;
}
.weekend-highlight {
  border-left: 5px solid var(--warning);
}
.day-block-header {
  border-bottom: 1px solid var(--gray-200);
  padding-bottom: 0.75rem;
}
.shift-group-box {
  background: var(--gray-50);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-md);
  padding: 1rem;
}
.box-female { border-top: 3px solid var(--accent-500); }
.box-male { border-top: 3px solid var(--primary-500); }
.btn-clear {
  padding: 0.25rem 0.5rem;
  min-height: 36px;
  font-size: 0.85rem;
}
@media (max-width: 992px) {
  .grid-cols-3 { grid-template-columns: 1fr; }
  .grid-cols-2 { grid-template-columns: 1fr; }
}
</style>

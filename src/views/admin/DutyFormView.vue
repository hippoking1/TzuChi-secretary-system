<template>
  <div class="admin-duty-form">
    <!-- 頂部導航與標題 -->
    <div class="flex items-center justify-between mb-6 flex-wrap gap-4">
      <div>
        <h1 class="text-2xl font-bold">📝 編輯月度值班表</h1>
        <p class="text-sm text-muted">
          已排班進度：<strong class="text-primary">{{ assignedTotalCount }} / {{ matrixList.length }} 席</strong>
          <span v-if="conflictList.length > 0" class="text-danger font-bold ml-2">
            ⚠️ 發現 {{ conflictList.length }} 處跨場地/時段排班衝突！
          </span>
        </p>
      </div>
      <div class="flex items-center gap-3 flex-wrap">
        <router-link to="/admin/duty-schedule" class="btn btn-outline">
          ← 返回值班月曆
        </router-link>
        <button 
          class="btn btn-primary" 
          :class="{ 'btn-danger': conflictList.length > 0 }"
          :disabled="saving" 
          @click="handleSave"
        >
          {{ saving ? '儲存中...' : (conflictList.length > 0 ? '⚠️ 存在衝突請先修正' : '💾 儲存本月排班表') }}
        </button>
      </div>
    </div>

    <!-- 衝突警告 Banner (若有跨場地重複排班) -->
    <div v-if="conflictList.length > 0" class="card conflict-banner mb-6 p-4">
      <div class="flex items-start gap-3">
        <span class="text-2xl">⚠️</span>
        <div class="flex-1">
          <h4 class="font-bold text-danger mb-1">檢測到重複排班衝突（不可同一人在同日排在不同場地）：</h4>
          <ul class="text-sm text-gray-700 pl-4 list-disc">
            <li v-for="(c, idx) in conflictList" :key="idx" class="mb-1">
              <strong>{{ c.dateStr }}</strong>：志工「<strong class="text-primary">{{ c.memberName }}</strong>」已在【<strong>{{ c.otherLocation }}</strong> - {{ c.otherShiftLabel }}】排班，不可重複排入當前場地！
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- 1. 場地與月份選擇控制卡片 (選項文字簡化) -->
    <div class="card mb-6 p-4">
      <div class="grid grid-cols-3 gap-4 items-end">
        <div class="form-group mb-0">
          <label class="form-label font-bold">1. 選擇場地：</label>
          <select v-model="selectedLocation" class="form-select" @change="initMatrix">
            <option value="宜蘭園區">宜蘭園區</option>
            <option value="東港聯絡處">東港聯絡處</option>
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

    <!-- 每日值班名單填寫 -->
    <div v-else class="days-container flex flex-col gap-6">
      <div 
        v-for="day in groupedDays" 
        :key="day.dateStr" 
        class="card day-block-card"
        :class="{ 'weekend-highlight': day.isWeekend, 'has-conflict': dayHasConflict(day.dateStr) }"
      >
        <!-- 日期標題欄 -->
        <div class="day-block-header flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-primary font-bold text-lg">🗓️ {{ day.dateStr }}</span>
            <span class="badge" :class="day.isWeekend ? 'badge-warning' : 'badge-gray'">
              {{ day.dayOfWeek }}
            </span>
            <span v-if="dayHasConflict(day.dateStr)" class="badge badge-danger">
              ⚠️ 此日期有衝突
            </span>
          </div>
          <span class="text-xs text-muted">
            已排定 {{ day.slots.filter(s => !!s.memberName).length }} / {{ day.slots.length }} 席
          </span>
        </div>

        <!-- 班次分區網格 -->
        <div class="grid grid-cols-2 gap-4 mt-4">
          <div 
            v-for="shiftGroup in day.shiftGroups" 
            :key="shiftGroup.shiftId" 
            class="shift-group-box"
            :class="shiftGroup.genderType === '男' ? 'box-male' : 'box-female'"
          >
            <!-- 班次標題 -->
            <div class="shift-group-title flex items-center justify-between mb-3">
              <span class="font-bold text-sm text-gray-800">
                {{ shiftGroup.shiftLabel }} ({{ shiftGroup.timeRange }}) - {{ shiftGroup.genderType }}眾 ({{ shiftGroup.quota }}位)
              </span>
            </div>

            <!-- 各個席位下拉選單 -->
            <div class="slots-list flex flex-col gap-2">
              <div 
                v-for="slot in shiftGroup.slots" 
                :key="slot.id" 
                class="slot-row flex items-center gap-2"
                :class="{ 'slot-conflict': slotConflictInfo(slot) }"
              >
                <div class="flex-1">
                  <select 
                    v-model="slot.memberId" 
                    class="form-select form-select-sm"
                    :class="{ 'border-danger': slotConflictInfo(slot) }"
                    @change="onSlotMemberChange(slot)"
                  >
                    <option value="">-- 未指派 --</option>
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
                  <span v-if="slotConflictInfo(slot)" class="text-xs text-danger font-bold block mt-1">
                    ⚠️ {{ slotConflictInfo(slot) }}
                  </span>
                </div>

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
const otherLocationDuties = ref([]); // 另一個場地的排班資料，用於跨場地衝突檢測
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

// 跨場地與同日排班衝突檢測演算法
const conflictList = computed(() => {
  const conflicts = [];
  const otherLocationName = selectedLocation.value === '宜蘭園區' ? '東港聯絡處' : '宜蘭園區';

  // 1. 建立另一場地的日期志工對照表 (日期 -> 志工名稱 -> 排班資料)
  const otherMap = {};
  otherLocationDuties.value.forEach(d => {
    if (d.memberName && d.dutyDate) {
      if (!otherMap[d.dutyDate]) otherMap[d.dutyDate] = {};
      otherMap[d.dutyDate][d.memberName] = d;
    }
  });

  // 2. 檢查當前編輯矩陣中是否有同日重複排入另一場地
  matrixList.value.forEach(slot => {
    if (slot.memberName && slot.dutyDate) {
      if (otherMap[slot.dutyDate] && otherMap[slot.dutyDate][slot.memberName]) {
        const otherShift = otherMap[slot.dutyDate][slot.memberName];
        conflicts.push({
          dateStr: slot.dutyDate,
          memberName: slot.memberName,
          slotId: slot.id,
          currentShiftLabel: slot.shiftLabel,
          otherLocation: otherLocationName,
          otherShiftLabel: otherShift.shiftLabel || '值班'
        });
      }
    }
  });

  return conflicts;
});

function dayHasConflict(dateStr) {
  return conflictList.value.some(c => c.dateStr === dateStr);
}

function slotConflictInfo(slot) {
  const found = conflictList.value.find(c => c.slotId === slot.id);
  if (!found) return '';
  return `已在【${found.otherLocation} - ${found.otherShiftLabel}】排班`;
}

function getMemberOrgPathText(memberId) {
  if (!memberId) return '';
  const m = allMembers.value.find(x => x.id === memberId);
  if (!m || !m.orgId) return '';
  const path = orgsStore.getOrgPath(m.orgId);
  return path ? `(${path})` : '';
}

// 過濾志工清單
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

// 按日分組與班次分組
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

// 初始化排班矩陣並同時載入另一個場地的資料進行衝突防呆
async function initMatrix() {
  loading.value = true;
  try {
    const [year, month] = selectedMonth.value.split('-').map(Number);
    const otherLocationName = selectedLocation.value === '宜蘭園區' ? '東港聯絡處' : '宜蘭園區';

    const [template, existing, otherExisting] = await Promise.all([
      Promise.resolve(dutiesStore.generateMonthlyTemplate(selectedLocation.value, year, month)),
      dutiesStore.fetchDutySchedule(selectedLocation.value, year, month),
      dutiesStore.fetchDutySchedule(otherLocationName, year, month)
    ]);

    otherLocationDuties.value = otherExisting || [];

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
  if (conflictList.value.length > 0) {
    alert(`⚠️ 排班衝突未解決！\n共有 ${conflictList.value.length} 處跨場地重複排班衝突，請先修正衝突席位再進行儲存。`);
    return;
  }

  saving.value = true;
  try {
    const [year, month] = selectedMonth.value.split('-').map(Number);
    await dutiesStore.saveMonthlyDuties(selectedLocation.value, year, month, matrixList.value);
    toast.success('全月排班表儲存成功（已通過跨場地衝突防呆驗證）！');
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
.has-conflict {
  border: 2px solid var(--danger) !important;
  background: #fef2f2;
}
.conflict-banner {
  background: #fff1f2;
  border: 1px solid #fecdd3;
  border-left: 5px solid var(--danger);
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
.border-danger {
  border-color: var(--danger) !important;
  background-color: #fff1f2 !important;
}
.btn-clear {
  padding: 0.25rem 0.5rem;
  min-height: 36px;
  font-size: 0.85rem;
}
.ml-2 { margin-left: 0.5rem; }
@media (max-width: 992px) {
  .grid-cols-3 { grid-template-columns: 1fr; }
  .grid-cols-2 { grid-template-columns: 1fr; }
}
</style>

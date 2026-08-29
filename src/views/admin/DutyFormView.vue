<template>
  <div class="admin-duty-form">
    <!-- 頂部浮動固定控制與篩選面板 -->
    <div class="sticky-duty-controls">
      <!-- 頂部操作列 (標題、進度、儲存按鈕) -->
      <div class="flex items-center justify-between p-3.5 bg-white border-b rounded-t-xl flex-wrap gap-3">
        <div>
          <div class="flex items-center gap-2 flex-wrap">
            <h1 class="text-xl font-bold m-0 text-gray-900">📝 編輯月度值班表</h1>
            <span class="badge badge-primary text-xs font-bold">
              已排班：{{ assignedTotalCount }} / {{ matrixList.length }} 席
            </span>
            <span v-if="conflictList.length > 0" class="badge badge-danger text-xs font-bold animate-pulse">
              ⚠️ {{ conflictList.length }} 處排班衝突！
            </span>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <router-link to="/admin/duty-schedule" class="btn btn-sm btn-outline">
            ← 返回月曆
          </router-link>
          <button 
            class="btn btn-sm btn-primary" 
            :class="{ 'btn-danger': conflictList.length > 0 }"
            :disabled="saving" 
            @click="handleSave"
          >
            {{ saving ? '儲存中...' : (conflictList.length > 0 ? '⚠️ 存在衝突請先修正' : '💾 儲存本月排班表') }}
          </button>
        </div>
      </div>

      <!-- 衝突警告 Banner (若有衝突時顯示) -->
      <div v-if="conflictList.length > 0" class="conflict-banner p-3 border-b">
        <div class="flex items-start gap-2 text-xs">
          <span class="text-base">⚠️</span>
          <div class="flex-1">
            <strong class="text-danger">檢測到重複排班衝突（不可同一人在同日排在不同場地）：</strong>
            <span v-for="(c, idx) in conflictList" :key="idx" class="ml-2 inline-block">
              [{{ c.dateStr }}: {{ c.memberName }} 在 {{ c.otherLocation }} 重複]
            </span>
          </div>
        </div>
      </div>

      <!-- 場地月份與快速篩選控制卡片 -->
      <div class="p-3 bg-white rounded-b-xl">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end mb-2.5">
          <div class="form-group mb-0">
            <label class="form-label font-bold text-xs mb-1">1. 選擇場地：</label>
            <select v-model="selectedLocation" class="form-select form-select-sm" @change="initMatrix">
              <option value="宜蘭園區">宜蘭園區</option>
              <option value="東港聯絡處">東港聯絡處</option>
            </select>
          </div>

          <div class="form-group mb-0">
            <label class="form-label font-bold text-xs mb-1">2. 選擇月份：</label>
            <input v-model="selectedMonth" type="month" class="form-input form-input-sm" @change="initMatrix" />
          </div>

          <div>
            <button class="btn btn-secondary btn-sm btn-block" :disabled="loading" @click="initMatrix">
              {{ loading ? '載入中...' : '🔄 重新整理 / 載入排班表' }}
            </button>
          </div>
        </div>

        <!-- 快速過濾志工列 (組織 + 搜尋) -->
        <div class="flex items-center justify-between border-t pt-2.5 flex-wrap gap-2">
          <div class="flex items-center gap-2 flex-wrap flex-1">
            <span class="text-xs font-bold text-primary flex items-center gap-1 whitespace-nowrap">
              🔍 快速過濾志工：
            </span>
            <select v-model="filterOrgId" class="form-select form-select-sm" style="max-width: 260px;">
              <option value="">-- 全部組織架構 (不限) --</option>
              <option v-for="opt in formattedOrgOptions" :key="opt.id" :value="opt.id">
                {{ opt.label }}
              </option>
            </select>

            <input 
              v-model="searchKeyword" 
              type="text" 
              class="form-input form-input-sm" 
              placeholder="搜尋姓名/電話/法號..." 
              style="max-width: 170px;"
            />
            <button v-if="filterOrgId || searchKeyword" class="btn btn-xs btn-outline" @click="clearFilters">
              重設篩選
            </button>
          </div>

          <div class="text-xs text-muted">
            <span v-if="filterOrgId || searchKeyword" class="text-primary font-bold">
              ✓ 已套用過濾條件
            </span>
          </div>
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
                    <!-- 若已指派志工不在目前過濾條件中，固定列於首位 -->
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
const otherLocationDuties = ref([]);
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

const formattedOrgOptions = computed(() => {
  const options = [];
  orgsStore.orgTree.forEach(heqi => {
    options.push({ id: heqi.id, label: `🌸 ${heqi.name} (全體)` });
    (heqi.children || []).forEach(huai => {
      options.push({ id: huai.id, label: `　├ ${huai.name} (全體)` });
      (huai.children || []).forEach(xieli => {
        options.push({ id: xieli.id, label: `　│　└ ${xieli.name}` });
      });
    });
  });
  return options;
});

function clearFilters() {
  filterOrgId.value = '';
  searchKeyword.value = '';
}

const conflictList = computed(() => {
  const conflicts = [];
  const otherLocationName = selectedLocation.value === '宜蘭園區' ? '東港聯絡處' : '宜蘭園區';

  const otherMap = {};
  otherLocationDuties.value.forEach(d => {
    if (d.memberName && d.dutyDate) {
      if (!otherMap[d.dutyDate]) otherMap[d.dutyDate] = {};
      otherMap[d.dutyDate][d.memberName] = d;
    }
  });

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

function getFilteredVolunteers(gender) {
  const baseList = gender === '男' ? maleMembers.value : femaleMembers.value;
  const allowedOrgIds = filterOrgId.value ? orgsStore.getDescendantOrgIds(filterOrgId.value) : null;
  return baseList.filter(m => {
    if (allowedOrgIds && !allowedOrgIds.includes(m.orgId)) return false;
    if (searchKeyword.value) {
      const kw = searchKeyword.value.toLowerCase();
      const matchName = (m.name || '').toLowerCase().includes(kw);
      const matchPhone = (m.phone || '').includes(kw);
      const matchCode = (m.volunteerCode || '').includes(kw);
      const matchDharma = (m.dharmaName || '').toLowerCase().includes(kw);
      if (!matchName && !matchPhone && !matchCode && !matchDharma) return false;
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
}

function clearSlot(slot) {
  slot.memberId = '';
  slot.memberName = '';
}

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

// 初始化排班矩陣：精確以標準 Slot ID (例如 宜蘭園區_2026-08-26_YL_M1_1) 進行 1-to-1 匹配
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

    // 以唯一 ID 建立對照表
    const existingMap = {};
    existing.forEach(item => {
      if (item.id) existingMap[item.id] = item;
    });

    const nameToMemberMap = {};
    allMembers.value.forEach(m => {
      if (m.name) nameToMemberMap[m.name] = m;
    });

    matrixList.value = template.map(t => {
      const existingItem = existingMap[t.id];

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
    toast.success('全月排班表儲存成功（已同步更新至資料庫）！');
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
.sticky-duty-controls {
  position: sticky;
  top: 60px; /* 緊貼在 AppHeader (sticky 約 58px) 下方 */
  z-index: 100;
  border-radius: var(--radius-xl);
  border: 1px solid var(--gray-200);
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(10px);
  box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.1), 0 2px 6px -1px rgba(0, 0, 0, 0.05);
  margin-bottom: 1.5rem;
}
@media (max-width: 992px) {
  .sticky-duty-controls {
    top: 50px;
  }
}

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
  border-top: 1px solid #fecdd3;
  border-bottom: 1px solid #fecdd3;
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
.btn-xs { padding: 0.2rem 0.5rem; font-size: 0.75rem; }
.ml-2 { margin-left: 0.5rem; }
.whitespace-nowrap { white-space: nowrap; }
@media (max-width: 992px) {
  .grid-cols-3 { grid-template-columns: 1fr; }
  .grid-cols-2 { grid-template-columns: 1fr; }
}
</style>

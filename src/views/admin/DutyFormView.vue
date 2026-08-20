<template>
  <div class="admin-duty-form">
    <!-- 頂部標題與主控制列 -->
    <div class="flex items-center justify-between mb-6 flex-wrap gap-4">
      <div>
        <h1 class="text-2xl font-bold">月度排班維護矩陣</h1>
        <p class="text-sm text-muted">
          已排班總數：<strong class="text-primary">{{ assignedTotalCount }} / {{ matrixList.length }} 席</strong>
          （載入資料庫現有排班，支援組織組別篩選與即時搜尋）
        </p>
      </div>
      <div class="flex items-center gap-3 flex-wrap">
        <select v-model="selectedLocation" class="form-select" style="min-width: 140px;" @change="initMatrix">
          <option value="東港聯絡處">東港聯絡處</option>
          <option value="宜蘭園區">宜蘭園區</option>
        </select>
        <input v-model="selectedMonth" type="month" class="form-input" style="min-width: 150px;" @change="initMatrix" />
        <button class="btn btn-primary" :disabled="saving" @click="handleSave">
          {{ saving ? '儲存中...' : '💾 儲存本月排班' }}
        </button>
      </div>
    </div>

    <!-- 智慧輔助工具列卡片 -->
    <div class="card mb-6 p-4">
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div class="flex items-center gap-3 flex-wrap">
          <span class="text-sm font-bold text-gray-700">🔍 志工篩選：</span>
          <!-- 協力組織過濾 -->
          <select v-model="filterOrgId" class="form-select form-select-sm" style="max-width: 220px;">
            <option value="">-- 全部組織組別 --</option>
            <option v-for="org in orgsStore.orgs" :key="org.id" :value="org.id">
              {{ orgsStore.getOrgPath(org.id) || org.name }}
            </option>
          </select>
          <!-- 姓名搜尋 -->
          <input 
            v-model="searchKeyword" 
            type="text" 
            class="form-input form-input-sm" 
            placeholder="搜尋志工姓名/電話..." 
            style="max-width: 180px;"
          />
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-xs text-muted">檢視模式：</span>
          <button 
            class="btn btn-sm" 
            :class="viewMode === 'daily' ? 'btn-primary' : 'btn-outline'"
            @click="viewMode = 'daily'"
          >
            📅 按日分組卡片
          </button>
          <button 
            class="btn btn-sm" 
            :class="viewMode === 'table' ? 'btn-primary' : 'btn-outline'"
            @click="viewMode = 'table'"
          >
            📋 全月資料表
          </button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="card text-center p-8">
      <p class="text-muted">載入排班資料中...</p>
    </div>

    <!-- 模式 A：按日分組卡片檢視 (推薦) -->
    <div v-else-if="viewMode === 'daily'" class="grid grid-cols-2 gap-4">
      <div 
        v-for="group in groupedDays" 
        :key="group.dateStr" 
        class="card day-card"
        :class="{ 'weekend-card': group.isWeekend }"
      >
        <div class="day-card-header flex items-center justify-between border-b pb-2 mb-3">
          <div class="flex items-center gap-2">
            <span class="font-bold text-lg">{{ group.dateStr }}</span>
            <span class="badge" :class="group.isWeekend ? 'badge-warning' : 'badge-gray'">
              {{ group.dayOfWeek }}
            </span>
          </div>
          <span class="text-xs" :class="group.slots.every(s => !!s.memberName) ? 'text-green-600 font-bold' : 'text-muted'">
            已排 {{ group.slots.filter(s => !!s.memberName).length }} / {{ group.slots.length }} 席
          </span>
        </div>

        <!-- 各班次時段槽位 -->
        <div class="day-slots-list flex flex-col gap-3">
          <div 
            v-for="slot in group.slots" 
            :key="slot.id" 
            class="slot-item flex items-center justify-between gap-2 p-2 rounded"
            :class="slot.genderType === '男' ? 'slot-male' : 'slot-female'"
          >
            <div class="slot-info">
              <span class="slot-badge badge" :class="slot.genderType === '男' ? 'badge-info' : 'badge-danger'">
                {{ slot.genderType }}眾
              </span>
              <span class="font-bold text-sm ml-1">{{ slot.shiftLabel }}</span>
              <span class="text-xs text-muted ml-1">(第 {{ slot.slotIndex }} 席)</span>
            </div>

            <div class="slot-picker flex items-center gap-2 flex-1 justify-end" style="max-width: 320px;">
              <select 
                v-model="slot.memberId" 
                class="form-select form-select-sm"
                @change="onSlotMemberChange(slot)"
              >
                <option value="">-- 未指派 --</option>
                <!-- 若目前已指派者不在過濾名單內，強制顯示在首位 -->
                <option 
                  v-if="slot.memberId && !getFilteredVolunteers(slot.genderType).some(m => m.id === slot.memberId)"
                  :value="slot.memberId"
                >
                  ★ {{ slot.memberName }} [已排定]
                </option>
                <option 
                  v-for="m in getFilteredVolunteers(slot.genderType)" 
                  :key="m.id" 
                  :value="m.id"
                >
                  {{ m.name }} {{ m.volunteerCode ? '(' + m.volunteerCode + ')' : '' }} [本月: {{ getMemberShiftCount(m.name) }}班]
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

    <!-- 模式 B：全月清單表格檢視 -->
    <div v-else class="card table-responsive">
      <table class="table">
        <thead>
          <tr>
            <th>日期</th>
            <th>星期</th>
            <th>班次</th>
            <th>眾別</th>
            <th style="min-width: 300px;">指派志工 (顯示本月累計值班數)</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="slot in matrixList" :key="slot.id">
            <td class="font-bold">{{ slot.dutyDate }}</td>
            <td>
              <span class="badge" :class="slot.isWeekend ? 'badge-warning' : 'badge-gray'">
                {{ getDayOfWeek(slot.dutyDate) }}
              </span>
            </td>
            <td>{{ slot.shiftLabel }} (第 {{ slot.slotIndex }} 席)</td>
            <td>
              <span class="badge" :class="slot.genderType === '男' ? 'badge-info' : 'badge-danger'">
                {{ slot.genderType }}眾
              </span>
            </td>
            <td>
              <select 
                v-model="slot.memberId" 
                class="form-select form-select-sm"
                @change="onSlotMemberChange(slot)"
              >
                <option value="">-- 未指派 --</option>
                <option 
                  v-if="slot.memberId && !getFilteredVolunteers(slot.genderType).some(m => m.id === slot.memberId)"
                  :value="slot.memberId"
                >
                  ★ {{ slot.memberName }} [已排定]
                </option>
                <option 
                  v-for="m in getFilteredVolunteers(slot.genderType)" 
                  :key="m.id" 
                  :value="m.id"
                >
                  {{ m.name }} {{ m.volunteerCode ? '(' + m.volunteerCode + ')' : '' }} [本月: {{ getMemberShiftCount(m.name) }}班]
                </option>
              </select>
            </td>
            <td>
              <button v-if="slot.memberId || slot.memberName" class="btn btn-sm btn-outline" @click="clearSlot(slot)">清空</button>
            </td>
          </tr>
        </tbody>
      </table>
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

const selectedLocation = ref('東港聯絡處');
const selectedMonth = ref(new Date().toISOString().substring(0, 7));
const viewMode = ref('daily');
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

// 計算志工本月已排班次數
function getMemberShiftCount(memberName) {
  if (!memberName) return 0;
  return matrixList.value.filter(s => s.memberName === memberName).length;
}

// 變更志工指派
function onSlotMemberChange(slot) {
  const found = allMembers.value.find(m => m.id === slot.memberId);
  slot.memberName = found ? found.name : '';
}

function clearSlot(slot) {
  slot.memberId = '';
  slot.memberName = '';
}

// 按日分組
const groupedDays = computed(() => {
  const map = {};
  matrixList.value.forEach(slot => {
    if (!map[slot.dutyDate]) {
      map[slot.dutyDate] = {
        dateStr: slot.dutyDate,
        dayOfWeek: getDayOfWeek(slot.dutyDate),
        isWeekend: slot.isWeekend,
        slots: []
      };
    }
    map[slot.dutyDate].slots.push(slot);
  });
  return Object.values(map);
});

// 標準化班次鍵值輔助函式
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

    // 依「日期 + 標準化班次」進行分組
    const existingGrouped = {};
    existing.forEach(item => {
      const normKey = getShiftNormalizedKey(item.shiftId, item.shiftLabel, item.genderType);
      const key = `${item.dutyDate}_${normKey}`;
      if (!existingGrouped[key]) existingGrouped[key] = [];
      existingGrouped[key].push(item);
    });

    // 建立所有志工名稱對應 Map (名稱 -> ID)
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
        
        // 若只有 memberName，自動由名冊反查填補 ID
        if (memberName && nameToMemberMap[memberName]) {
          memberId = nameToMemberMap[memberName].id;
        } else if (!memberId && memberName) {
          memberId = memberName; // fallback
        }

        return {
          ...t,
          docId: existingItem.id,
          memberId,
          memberName
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
    toast.success('全月排班已成功儲存至 Firestore！');
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
.form-select-sm, .form-input-sm {
  min-height: 36px;
  padding: 0.25rem 0.6rem;
  font-size: 0.85rem;
}
.day-card {
  border: 1px solid var(--gray-200);
  transition: all 0.2s ease;
}
.weekend-card {
  border-left: 4px solid var(--warning);
}
.slot-item {
  background: var(--gray-50);
  border: 1px solid var(--gray-200);
}
.slot-male { border-left: 3px solid var(--primary-500); }
.slot-female { border-left: 3px solid var(--accent-500); }
.btn-clear {
  padding: 0.2rem 0.5rem;
  min-height: 32px;
  font-size: 0.8rem;
}
.text-green-600 { color: #16a34a; }
@media (max-width: 900px) {
  .grid-cols-2 { grid-template-columns: 1fr; }
}
</style>

<template>
  <div class="admin-duty-form">
    <!-- 頂部浮動固定控制與篩選面板 -->
    <div class="sticky-control-panel">
      <!-- 頂部導航與標題 -->
      <div class="flex items-center justify-between mb-3 flex-wrap gap-4 bg-white/95 px-4 py-3 rounded-lg border border-gray-200 shadow-sm">
        <div>
          <h1 class="text-2xl font-bold m-0 flex items-center gap-2">📝 編輯月度值班表</h1>
          <p class="text-sm text-muted m-0 mt-1">
            已排班進度：<strong class="text-primary">{{ assignedTotalCount }} / {{ matrixList.length }} 席</strong>
            <span v-if="conflictList.length > 0" class="text-danger font-bold ml-2">
              ⚠️ 發現 {{ conflictList.length }} 處跨場地/時段排班衝突！
            </span>
          </p>
        </div>
        <div class="flex items-center gap-3 flex-wrap">
          <router-link to="/admin/duty-rules" class="btn btn-outline" title="設定組別名冊與週輪值">
            ⚙️ 規則設定
          </router-link>
          <button 
            v-if="selectedLocation === '宜蘭園區'" 
            class="btn btn-accent" 
            @click="openAutoScheduleModal"
          >
            🤖 依規則自動排班
          </button>
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

      <!-- 衝突警告 Banner -->
      <div v-if="conflictList.length > 0" class="card conflict-banner mb-3 p-3">
        <div class="flex items-start gap-3">
          <span class="text-2xl">⚠️</span>
          <div class="flex-1">
            <h4 class="font-bold text-danger mb-1 text-sm">檢測到重複排班衝突（不可同一人在同日排在不同場地）：</h4>
            <ul class="text-xs text-gray-700 pl-4 list-disc space-y-0.5">
              <li v-for="(c, idx) in conflictList" :key="idx">
                <strong>{{ c.dateStr }}</strong>：志工「<strong class="text-primary">{{ c.memberName }}</strong>」已在【<strong>{{ c.otherLocation }}</strong> - {{ c.otherShiftLabel }}】排班，不可重複排入當前場地！
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- 1. 場地與月份選擇控制卡片 -->
      <div class="card mb-4 p-4 bg-white/95 shadow-md">
        <div class="duty-control-row">
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

          <div class="form-group mb-0">
            <button class="btn btn-secondary btn-block" :disabled="loading" @click="initMatrix">
              {{ loading ? '載入中...' : '🔄 重新整理 / 載入排班表' }}
            </button>
          </div>
        </div>

        <!-- 快速過濾列 -->
        <div class="flex items-center justify-between border-t mt-4 pt-3 flex-wrap gap-3">
          <div class="flex items-center gap-2 flex-wrap flex-1">
            <span class="text-xs font-bold text-gray-700 whitespace-nowrap">🔍 快速過濾志工：</span>
            <select v-model="filterOrgId" class="form-select form-select-sm" style="max-width: 280px;">
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
              style="max-width: 180px;"
            />
            <button v-if="filterOrgId || searchKeyword" class="btn btn-xs btn-outline" @click="clearFilters">
              重設篩選
            </button>
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

    <!-- 依規則自動排班彈出視窗 (Auto Schedule Modal) -->
    <div v-if="showAutoModal" class="modal-backdrop" @click="showAutoModal = false">
      <div class="modal-content" style="max-width: 820px;" @click.stop>
        <div class="modal-header">
          <div>
            <h3 class="modal-title flex items-center gap-2">
              🤖 依規則自動排班 — {{ selectedMonth }} ({{ selectedLocation }})
            </h3>
            <p class="text-xs text-muted mt-1">
              依據「和氣週輪值」與「星期 × 整組名冊」自動產生排班建議
            </p>
          </div>
          <button class="modal-close" @click="showAutoModal = false">×</button>
        </div>

        <div class="modal-body flex flex-col gap-4">
          <!-- 當月和氣輪值週次速覽 -->
          <div class="card p-3 bg-gray-50 border">
            <h4 class="text-xs font-bold text-gray-700 mb-2">🗓️ 本月週次負責和氣歸屬：</h4>
            <div class="flex items-center gap-2 flex-wrap">
              <span 
                v-for="w in currentMonthWeekInfo" 
                :key="w.range" 
                class="badge text-xs py-1 px-2.5"
                :class="w.isHeqi2 ? 'badge-primary font-bold' : 'badge-gray'"
              >
                {{ w.range }}：{{ w.heqi }} {{ w.isHeqi2 ? '★(和氣二值週)' : '' }}
              </span>
            </div>
          </div>

          <!-- 排班選項控制 -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="card p-3 border">
              <label class="form-label font-bold text-sm mb-2">1. 選擇排班模式：</label>
              <div class="flex flex-col gap-2">
                <label class="flex items-center gap-2 text-sm cursor-pointer">
                  <input 
                    v-model="autoScheduleMode" 
                    type="radio" 
                    value="heqi_only" 
                    @change="runAutoPreview"
                  />
                  <span>
                    <strong>僅排和氣二負責週次</strong>
                    <small class="text-muted block text-xs">（符合四個和氣每週輪替規範）</small>
                  </span>
                </label>

                <label class="flex items-center gap-2 text-sm cursor-pointer">
                  <input 
                    v-model="autoScheduleMode" 
                    type="radio" 
                    value="force_heqi2" 
                    @change="runAutoPreview"
                  />
                  <span>
                    <strong>全月套用和氣二規則</strong>
                    <small class="text-muted block text-xs">（強制/測試模式：全月女眾班均由和氣二排入）</small>
                  </span>
                </label>
              </div>
            </div>

            <div class="card p-3 border">
              <label class="form-label font-bold text-sm mb-2">2. 既有排班處理方式：</label>
              <div class="flex flex-col gap-2">
                <label class="flex items-center gap-2 text-sm cursor-pointer">
                  <input 
                    v-model="overwriteStrategy" 
                    type="radio" 
                    value="overwrite" 
                    @change="runAutoPreview"
                  />
                  <span>
                    <strong>⚡ 覆蓋全部席位</strong>
                    <small class="text-muted block text-xs">（清除目標時段現有名冊，依規則完整重填）</small>
                  </span>
                </label>

                <label class="flex items-center gap-2 text-sm cursor-pointer">
                  <input 
                    v-model="overwriteStrategy" 
                    type="radio" 
                    value="empty_only" 
                    @change="runAutoPreview"
                  />
                  <span>
                    <strong>📝 僅填入空白未指派席位</strong>
                    <small class="text-muted block text-xs">（保留目前已手動排好的志工人員）</small>
                  </span>
                </label>
              </div>
            </div>
          </div>

          <!-- 衝突檢測與備用人員提示 -->
          <div v-if="autoPreviewResult?.conflicts?.length > 0" class="card conflict-banner p-3">
            <h4 class="font-bold text-danger text-sm mb-1 flex items-center gap-1">
              <span>⚠️ 偵測到 {{ autoPreviewResult.conflicts.length }} 筆與【東港聯絡處】排班衝突：</span>
            </h4>
            <p class="text-xs text-danger mb-2">
              依排班衝突處理原則：<strong>以園區排班為優先</strong>，建議於套用後前往東港聯絡處調動志工！
            </p>
            <ul class="text-xs text-gray-700 pl-4 list-disc space-y-1">
              <li v-for="(c, idx) in autoPreviewResult.conflicts" :key="idx">
                <strong>{{ c.dateStr }}</strong>：志工「<strong class="text-primary">{{ c.memberName }}</strong>」原已排在【{{ c.otherLocation }} - {{ c.otherShift }}】
              </li>
            </ul>
          </div>

          <!-- 備用人員提示（5人組取4人） -->
          <div v-if="autoPreviewResult?.standbyList?.length > 0" class="card p-3 bg-amber-50 border border-amber-200">
            <h4 class="font-bold text-amber-800 text-xs mb-1 flex items-center gap-1">
              <span>🔄 備用輪替機制已生效（組員超過 4 人，本次未排班之備用人員）：</span>
            </h4>
            <div class="flex items-center gap-2 flex-wrap">
              <span 
                v-for="(st, idx) in autoPreviewResult.standbyList" 
                :key="idx" 
                class="badge badge-warning text-xs py-1 px-2"
              >
                {{ st.dateStr }} ({{ st.teamName }}) 備用：{{ st.standbys.join('、') }}
              </span>
            </div>
          </div>

          <!-- 預覽排班成果明細 -->
          <div class="preview-results-box border rounded-lg p-3 bg-white max-h-[320px] overflow-y-auto">
            <div class="flex items-center justify-between mb-2">
              <strong class="text-sm text-gray-800">
                📋 排班預覽明細（預計排定 {{ autoPreviewResult?.scheduledDetails?.length || 0 }} 天）：
              </strong>
              <span class="text-xs text-muted">
                {{ autoScheduleMode === 'heqi_only' ? '僅和氣二週次' : '全月模式' }} / {{ overwriteStrategy === 'overwrite' ? '覆蓋全部' : '僅填空白' }}
              </span>
            </div>

            <div class="space-y-2">
              <div 
                v-for="item in autoPreviewResult?.scheduledDetails" 
                :key="item.dateStr" 
                class="card p-2.5 flex items-center justify-between border text-xs"
                :class="item.heqi === '和氣二' ? 'bg-pink-50/30' : 'bg-gray-50/50'"
              >
                <div class="flex items-center gap-2">
                  <span class="font-bold text-primary text-sm">{{ item.dateStr }}</span>
                  <span class="badge badge-info">{{ item.dayOfWeek === '0' ? '週日' : '週' + ['日','一','二','三','四','五','六'][Number(item.dayOfWeek)] }}</span>
                  <span class="badge badge-gray">{{ item.heqi }}</span>
                  <strong class="text-gray-700 ml-1">{{ item.teamName }}</strong>
                </div>

                <div class="flex items-center gap-1.5 flex-wrap">
                  <span 
                    v-for="(m, mIdx) in item.assignedMembers" 
                    :key="mIdx" 
                    class="badge badge-primary py-0.5 px-2"
                  >
                    {{ m }}
                  </span>
                  <span v-if="item.standbys?.length > 0" class="text-muted text-[11px]">
                    (備用: {{ item.standbys.join(',') }})
                  </span>
                </div>
              </div>

              <div v-if="!autoPreviewResult || autoPreviewResult.scheduledDetails.length === 0" class="text-center py-6 text-muted">
                本月在此條件下無符合排班的日期（請檢查和氣週輪值設定，或切換為全月套用模式）
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer flex items-center justify-between">
          <router-link to="/admin/duty-rules" class="btn btn-outline btn-sm">
            ⚙️ 調整組別名冊與週輪值規則
          </router-link>

          <div class="flex items-center gap-2">
            <button class="btn btn-outline btn-sm" @click="showAutoModal = false">
              取消
            </button>
            <button 
              class="btn btn-primary btn-sm" 
              :disabled="!autoPreviewResult || autoPreviewResult.scheduledDetails.length === 0"
              @click="applyAutoSchedule"
            >
              ✅ 確認套用至排班表
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useDutiesStore } from '@/stores/duties';
import { useDutyRulesStore } from '@/stores/dutyRules';
import { useMembersStore } from '@/stores/members';
import { useOrgsStore } from '@/stores/orgs';
import { useToast } from '@/composables/useToast';

const dutiesStore = useDutiesStore();
const dutyRulesStore = useDutyRulesStore();
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

// 自動排班相關狀態與邏輯
const showAutoModal = ref(false);
const autoScheduleMode = ref('force_heqi2'); // 'force_heqi2' | 'heqi_only'
const overwriteStrategy = ref('overwrite'); // 'overwrite' | 'empty_only'
const autoPreviewResult = ref(null);

const currentMonthWeekInfo = computed(() => {
  if (!selectedMonth.value) return [];
  const [year, month] = selectedMonth.value.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const weeks = [];
  let currentWeekDays = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dateObj = new Date(year, month - 1, day);
    const dayOfWeek = dateObj.getDay();
    const heqi = dutyRulesStore.getHeqiForDate(dateStr);

    currentWeekDays.push({ dateStr, dayOfWeek, heqi });

    if (dayOfWeek === 0 || day === daysInMonth) {
      const first = currentWeekDays[0].dateStr.substring(5);
      const last = currentWeekDays[currentWeekDays.length - 1].dateStr.substring(5);
      weeks.push({
        range: `${first} ~ ${last}`,
        heqi: currentWeekDays[0].heqi,
        isHeqi2: currentWeekDays[0].heqi === '和氣二',
        daysCount: currentWeekDays.length
      });
      currentWeekDays = [];
    }
  }
  return weeks;
});

function openAutoScheduleModal() {
  showAutoModal.value = true;
  runAutoPreview();
}

function runAutoPreview() {
  const [year, month] = selectedMonth.value.split('-').map(Number);
  autoPreviewResult.value = dutyRulesStore.generateAutoSchedule({
    location: selectedLocation.value,
    year,
    month,
    currentMatrix: matrixList.value,
    otherLocationDuties: otherLocationDuties.value,
    allMembers: allMembers.value,
    mode: autoScheduleMode.value,
    overwriteStrategy: overwriteStrategy.value
  });
}

function applyAutoSchedule() {
  if (!autoPreviewResult.value) return;
  matrixList.value = autoPreviewResult.value.matrixList;
  showAutoModal.value = false;
  toast.success(`🎉 已成功套用自動排班！共排定 ${autoPreviewResult.value.scheduledDetails.length} 天，請檢查後點擊「💾 儲存本月排班表」！`);
}

onMounted(async () => {
  loading.value = true;
  const [males, females] = await Promise.all([
    membersStore.fetchMembers({ gender: '男' }),
    membersStore.fetchMembers({ gender: '女' }),
    orgsStore.fetchOrgs(),
    dutyRulesStore.fetchRules('宜蘭園區'),
    dutyRulesStore.fetchWeekRotation('宜蘭園區')
  ]);
  maleMembers.value = males;
  femaleMembers.value = females;
  allMembers.value = [...males, ...females];
  await initMatrix();
});
</script>

<style scoped>
.sticky-control-panel {
  position: sticky;
  top: 60px; /* 緊貼在 AppHeader 下方 */
  z-index: 100;
  margin-bottom: 1.25rem;
}
@media (max-width: 992px) {
  .sticky-control-panel {
    top: 50px;
  }
}

.duty-control-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
  align-items: flex-end;
}
@media (max-width: 768px) {
  .duty-control-row {
    grid-template-columns: 1fr;
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

.modal-backdrop {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  background: rgba(15, 23, 42, 0.6); display: flex; align-items: center; justify-content: center; z-index: 9990;
}
.modal-content { background: #ffffff; border-radius: var(--radius-lg); width: 92%; }
.modal-header { padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--gray-200); display: flex; justify-content: space-between; align-items: center; }
.modal-body { padding: 1.25rem 1.5rem; max-height: 70vh; overflow-y: auto; }
.modal-footer { padding: 1rem 1.5rem; background: var(--gray-50); border-top: 1px solid var(--gray-200); }
.modal-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--gray-500); }
</style>

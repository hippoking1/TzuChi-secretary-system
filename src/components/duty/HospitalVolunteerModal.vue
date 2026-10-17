<template>
  <div v-if="show" class="modal-backdrop" @click="emit('close')">
    <div class="modal-content" style="max-width: 860px;" @click.stop>
      <!-- Modal Header -->
      <div class="modal-header">
        <div>
          <h3 class="modal-title flex items-center gap-2 text-lg font-bold">
            <span>🏥 預排醫院志工及日期管理</span>
            <span class="badge badge-primary text-xs">最高優先權</span>
          </h3>
          <p class="text-xs text-muted mt-1">
            排班優先順序：<strong>醫院志工 ＞ 宜蘭園區值班 ＞ 東港聯絡處值班</strong>（預排醫院志工之日期，自動排班將自動調換組別或順延接替）
          </p>
        </div>
        <button type="button" class="modal-close" @click="emit('close')">×</button>
      </div>

      <!-- Modal Body -->
      <div class="modal-body flex flex-col gap-4">
        <!-- 1. 新增預排醫院志工表單區 -->
        <div class="card p-4 border border-teal-200 bg-teal-50/30 shadow-xs">
          <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h4 class="font-bold text-sm text-teal-900 m-0 flex items-center gap-1.5">
              <span>➕ 新增預排醫院志工與日期</span>
            </h4>
            <!-- 日期選擇模式切換 -->
            <div class="flex items-center gap-1 bg-white p-1 rounded border">
              <button
                type="button"
                class="btn btn-xs"
                :class="dateSelectMode === 'range' ? 'btn-primary' : 'btn-outline border-0'"
                @click="dateSelectMode = 'range'"
              >
                📅 連續日期區間 (梯次)
              </button>
              <button
                type="button"
                class="btn btn-xs"
                :class="dateSelectMode === 'multi' ? 'btn-primary' : 'btn-outline border-0'"
                @click="dateSelectMode = 'multi'"
              >
                🗓️ 月曆點選單日/多日
              </button>
            </div>
          </div>

          <!-- 日期選擇器：模式 A (連續區間) -->
          <div v-if="dateSelectMode === 'range'" class="mb-3 p-3 bg-white rounded border">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="text-xs font-bold text-gray-700 block mb-1">開始日期：</label>
                <input v-model="rangeStartDate" type="date" class="form-input form-input-sm" />
              </div>
              <div>
                <label class="text-xs font-bold text-gray-700 block mb-1">結束日期：</label>
                <input v-model="rangeEndDate" type="date" class="form-input form-input-sm" />
              </div>
            </div>
            <div v-if="computedSelectedDates.length > 0" class="mt-2 text-xs text-teal-800 flex items-center gap-1.5 flex-wrap">
              <strong>✓ 將預排共 {{ computedSelectedDates.length }} 天：</strong>
              <span class="text-muted">{{ computedSelectedDates.join('、') }}</span>
            </div>
          </div>

          <!-- 日期選擇器：模式 B (月曆多日點選) -->
          <div v-else class="mb-3 p-3 bg-white rounded border">
            <div class="flex items-center justify-between mb-2 flex-wrap gap-2">
              <div class="flex items-center gap-2">
                <label class="text-xs font-bold text-gray-700">選擇月份：</label>
                <input v-model="activeMonth" type="month" class="form-input form-input-sm" style="max-width: 150px;" @change="loadMonthData" />
              </div>
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-xs text-muted">已勾選 <strong class="text-primary">{{ multiSelectedDates.length }}</strong> 天</span>
                <button v-if="multiSelectedDates.length > 0" type="button" class="btn btn-xs btn-outline" @click="multiSelectedDates = []">
                  清除日期
                </button>
              </div>
            </div>

            <!-- 迷你月曆點選網格 -->
            <div class="mini-cal-grid">
              <div v-for="w in ['日', '一', '二', '三', '四', '五', '六']" :key="w" class="mini-cal-head">
                {{ w }}
              </div>
              <div
                v-for="(c, idx) in miniCalendarCells"
                :key="idx"
                class="mini-cal-cell"
                :class="{
                  'mini-cal-empty': !c.dateStr,
                  'mini-cal-selected': c.dateStr && multiSelectedDates.includes(c.dateStr),
                  'mini-cal-has-hosp': c.dateStr && getDayHospitalMembers(c.dateStr).length > 0
                }"
                @click="c.dateStr && toggleMultiDate(c.dateStr)"
              >
                <template v-if="c.dateStr">
                  <span class="font-bold">{{ c.day }}</span>
                  <span v-if="getDayHospitalMembers(c.dateStr).length > 0" class="mini-cal-dot" :title="'已排: ' + getDayHospitalMembers(c.dateStr).join(', ')">
                    {{ getDayHospitalMembers(c.dateStr).length }}人
                  </span>
                </template>
              </div>
            </div>
          </div>

          <!-- 2. 組織篩選與選擇醫院志工人員 -->
          <div class="p-3 bg-white rounded border mb-3">
            <!-- 📋 快速複製批次名單區（歷月梯次複製 & 常用固定批次模板） -->
            <div class="mb-3 p-2.5 rounded border border-amber-200 bg-amber-50/40">
              <div class="flex items-center justify-between flex-wrap gap-2 mb-2">
                <span class="text-xs font-bold text-amber-900 flex items-center gap-1">
                  <span>📋 快速複製批次名單（直接帶入歷史梯次或常用固定名單）：</span>
                </span>
                <span class="text-[11px] text-muted">
                  帶入名單後仍可自由增刪個別志工，再設定新月份日期區間
                </span>
              </div>

              <!-- A. 常用固定批次名單模板膠囊按鈕列 -->
              <div v-if="batchTemplates.length > 0" class="flex items-center gap-1.5 flex-wrap mb-2">
                <span class="text-xs font-bold text-gray-700">⭐ 常用批次：</span>
                <div
                  v-for="tpl in batchTemplates"
                  :key="tpl.id"
                  class="inline-flex items-center gap-1 bg-white border border-amber-300 rounded-full px-2.5 py-0.5 text-xs shadow-2xs"
                >
                  <button
                    type="button"
                    class="font-bold text-amber-900 hover:text-primary cursor-pointer bg-transparent border-0 p-0"
                    :title="'點擊套用名單：' + (tpl.members || []).map(m => m.name).join('、')"
                    @click="applyBatchRoster(tpl.members, tpl.hospitalName, 'replace', `常用批次「${tpl.templateName}」`)"
                  >
                    📋 {{ tpl.templateName }} ({{ (tpl.members || []).length }}人)
                  </button>
                  <button
                    type="button"
                    class="chip-rm-btn text-gray-400 hover:text-danger ml-0.5"
                    title="刪除此常用批次模板"
                    @click="handleDeleteBatchTemplate(tpl)"
                  >
                    ×
                  </button>
                </div>
              </div>

              <!-- B. 從歷史已排月份 / 梯次下拉選擇複製 -->
              <div class="flex items-center gap-2 flex-wrap">
                <select
                  v-model="selectedHistoryBatchKey"
                  class="form-select form-select-sm flex-1 min-w-[240px]"
                >
                  <option value="">
                    -- 從歷月已排醫院志工梯次選擇複製 (共 {{ historicalBatchOptions.length }} 批可用) --
                  </option>
                  <option
                    v-for="opt in historicalBatchOptions"
                    :key="opt.key"
                    :value="opt.key"
                  >
                    {{ opt.label }}
                  </option>
                </select>

                <button
                  type="button"
                  class="btn btn-xs btn-primary"
                  :disabled="!selectedHistoryBatchKey"
                  @click="handleCopySelectedHistoryBatch('replace')"
                >
                  📋 複製帶入名單
                </button>
                <button
                  v-if="selectedMembersToAdd.length > 0"
                  type="button"
                  class="btn btn-xs btn-outline"
                  :disabled="!selectedHistoryBatchKey"
                  @click="handleCopySelectedHistoryBatch('append')"
                  title="保留目前已選人員並合併加入"
                >
                  ➕ 合併加入
                </button>
              </div>
            </div>

            <div class="flex items-center justify-between mb-2 flex-wrap gap-2">
              <span class="text-xs font-bold text-gray-800">🏢 篩選並選擇參與醫院志工之人員（可多選）：</span>
              <button
                v-if="filterOrgId || filterGender || searchKw"
                type="button"
                class="btn btn-xs btn-outline"
                @click="resetMemberFilter"
              >
                重設篩選
              </button>
            </div>

            <!-- 組織 / 眾別 / 關鍵字篩選列 -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2.5">
              <select v-model="filterOrgId" class="form-select form-select-sm">
                <option value="">-- 全部組織 (不限和氣/互愛/協力) --</option>
                <option v-for="opt in formattedOrgOptions" :key="opt.id" :value="opt.id">
                  {{ opt.label }}
                </option>
              </select>

              <select v-model="filterGender" class="form-select form-select-sm">
                <option value="">-- 全部眾別 (男眾 + 女眾) --</option>
                <option value="女">女眾 (師姊)</option>
                <option value="男">男眾 (師兄)</option>
              </select>

              <input
                v-model="searchKw"
                type="text"
                class="form-input form-input-sm"
                placeholder="🔍 搜尋姓名/電話/法號..."
              />
            </div>

            <!-- 下拉選擇或輸入姓名加入 -->
            <div class="flex items-center gap-2 flex-wrap">
              <select
                v-model="quickPickMemberId"
                class="form-select form-select-sm flex-1 min-w-[220px]"
                @change="onPickMember"
              >
                <option value="">-- 點選志工加入預排清單 (符合條件共 {{ filteredMembers.length }} 人) --</option>
                <option v-for="m in filteredMembers" :key="m.id" :value="m.id">
                  {{ m.name }} ({{ m.gender }}眾) {{ getMemberOrgPathText(m.id) }}
                </option>
              </select>

              <input
                v-model="manualMemberName"
                type="text"
                class="form-input form-input-sm"
                placeholder="或輸入姓名按 Enter..."
                style="width: 160px;"
                @keyup.enter="onAddManualMember"
              />
              <button
                type="button"
                class="btn btn-sm btn-outline"
                :disabled="!manualMemberName.trim()"
                @click="onAddManualMember"
              >
                ＋ 加入人員
              </button>
            </div>

            <!-- 已選待加入之志工膠囊列表 -->
            <div class="mt-3 pt-2.5 border-t">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-xs font-bold text-gray-700">待加入志工 ({{ selectedMembersToAdd.length }} 人)：</span>
                <span v-if="selectedMembersToAdd.length === 0" class="text-xs text-muted">
                  請由上方「快速複製批次名單」帶入，或從選單點選志工姓名...
                </span>
                <span
                  v-for="(m, idx) in selectedMembersToAdd"
                  :key="m.id || m.name"
                  class="selected-vol-chip"
                >
                  <strong>{{ m.name }}</strong>
                  <small v-if="m.orgText" class="text-gray-500 ml-1">{{ m.orgText }}</small>
                  <button type="button" class="chip-rm-btn" @click="selectedMembersToAdd.splice(idx, 1)">×</button>
                </span>

                <div v-if="selectedMembersToAdd.length > 0" class="ml-auto flex items-center gap-1.5">
                  <button
                    type="button"
                    class="btn btn-xs btn-outline border-amber-500 text-amber-800 hover:bg-amber-50"
                    @click="openSaveTemplateInput"
                    title="將目前這批名單儲存為常用固定批次，方便往後每月一鍵套用"
                  >
                    ⭐ 存為常用批次名單
                  </button>
                  <button
                    v-if="selectedMembersToAdd.length > 1"
                    type="button"
                    class="btn btn-xs btn-outline text-danger"
                    @click="selectedMembersToAdd = []"
                  >
                    清空已選人員
                  </button>
                </div>
              </div>

              <!-- 儲存為常用批次名單之內嵌輸入列 -->
              <div v-if="showSaveTemplateBar" class="mt-2 p-2 bg-amber-50 border border-amber-200 rounded flex items-center gap-2 flex-wrap">
                <span class="text-xs font-bold text-amber-900">批次名稱：</span>
                <input
                  v-model="newTemplateName"
                  type="text"
                  class="form-input form-input-sm flex-1 min-w-[180px]"
                  placeholder="例：和氣二固定醫院志工團"
                  @keyup.enter="handleSaveBatchTemplate"
                />
                <button
                  type="button"
                  class="btn btn-xs btn-primary"
                  :disabled="submitting || !newTemplateName.trim()"
                  @click="handleSaveBatchTemplate"
                >
                  確認儲存模板
                </button>
                <button
                  type="button"
                  class="btn btn-xs btn-outline"
                  @click="showSaveTemplateBar = false"
                >
                  取消
                </button>
              </div>
            </div>
          </div>

          <!-- 3. 院區標籤與備註 + 送出按鈕 -->
          <div class="flex items-center justify-between flex-wrap gap-3">
            <div class="flex items-center gap-2 flex-wrap flex-1">
              <label class="text-xs font-bold text-gray-700 whitespace-nowrap">服務院區/標籤：</label>
              <input
                v-model="hospitalLabel"
                type="text"
                class="form-input form-input-sm"
                style="max-width: 150px;"
                placeholder="例：花蓮慈院"
              />
              <div class="flex items-center gap-1 flex-wrap">
                <button
                  v-for="preset in ['醫院志工', '花蓮慈院', '台北慈院', '大林慈院', '台中慈院']"
                  :key="preset"
                  type="button"
                  class="badge cursor-pointer text-xs border"
                  :class="hospitalLabel === preset ? 'badge-primary font-bold' : 'badge-gray'"
                  @click="hospitalLabel = preset"
                >
                  {{ preset }}
                </button>
              </div>
            </div>

            <button
              type="button"
              class="btn btn-primary btn-sm flex items-center gap-1.5"
              :disabled="submitting || computedSelectedDates.length === 0 || selectedMembersToAdd.length === 0"
              @click="handleAddSchedules"
            >
              <span>{{ submitting ? '儲存中...' : `💾 確認新增預排 (${selectedMembersToAdd.length} 人 × ${computedSelectedDates.length} 天)` }}</span>
            </button>
          </div>
        </div>

        <!-- 2. 當月已預排醫院志工清單 -->
        <div class="card p-4 border bg-white">
          <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div class="flex items-center gap-2 flex-wrap">
              <h4 class="font-bold text-sm text-gray-800 m-0">
                📋 已預排醫院志工名冊
              </h4>
              <input
                v-model="activeMonth"
                type="month"
                class="form-input form-input-sm"
                style="max-width: 150px;"
                @change="loadMonthData"
              />
              <span class="badge badge-info text-xs">
                本月共 {{ monthHospitalList.length }} 人次 ({{ groupedByMember.length }} 位志工)
              </span>
            </div>

            <div class="flex items-center gap-2 flex-wrap">
              <button
                v-if="groupedByMember.length > 0"
                type="button"
                class="btn btn-xs btn-outline border-teal-600 text-teal-800 hover:bg-teal-50"
                @click="copyCurrentMonthRoster"
                title="將此月份所有醫院志工複製到上方「待加入志工」清單，以便快速排入其他月份"
              >
                📋 複製本月全體名單 ({{ groupedByMember.length }}人)
              </button>

              <div class="flex items-center gap-1 bg-gray-100 p-0.5 rounded border">
                <button
                  type="button"
                  class="btn btn-xs"
                  :class="listViewMode === 'byDate' ? 'btn-primary' : 'btn-outline border-0'"
                  @click="listViewMode = 'byDate'"
                >
                  依日期檢視
                </button>
                <button
                  type="button"
                  class="btn btn-xs"
                  :class="listViewMode === 'byMember' ? 'btn-primary' : 'btn-outline border-0'"
                  @click="listViewMode = 'byMember'"
                >
                  依志工檢視
                </button>
              </div>

              <button
                v-if="monthHospitalList.length > 0"
                type="button"
                class="btn btn-xs btn-outline text-danger border-danger"
                :disabled="submitting"
                @click="handleClearMonth"
              >
                🗑️ 清空本月預排
              </button>
            </div>
          </div>

          <div v-if="loadingList" class="text-center py-6 text-muted text-sm">
            正在載入醫院志工預排資料...
          </div>

          <div v-else-if="monthHospitalList.length === 0" class="text-center py-8 text-muted text-sm border rounded bg-gray-50/50">
            {{ activeMonth }} 尚無預排醫院志工紀錄，請由上方表單新增（可從「快速複製批次名單」直接帶入上月名單）。
          </div>

          <!-- 視角 A：依日期分組檢視 -->
          <div v-else-if="listViewMode === 'byDate'" class="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            <div
              v-for="group in groupedByDate"
              :key="group.dateStr"
              class="p-2.5 border rounded-lg flex items-center justify-between flex-wrap gap-2 bg-gray-50/60"
            >
              <div class="flex items-center gap-2 flex-wrap">
                <strong class="text-primary text-sm">{{ group.dateStr }}</strong>
                <span class="badge badge-gray text-xs">{{ group.dayOfWeek }}</span>
                <span class="text-xs text-muted">({{ group.items.length }} 人)</span>
                <button
                  type="button"
                  class="btn btn-xs btn-outline py-0 px-1.5 text-[11px]"
                  title="複製此日名單至上方待加入區"
                  @click="copyDateGroupRoster(group)"
                >
                  📋 複製此日名單
                </button>
              </div>

              <div class="flex items-center gap-2 flex-wrap flex-1 justify-end">
                <div
                  v-for="item in group.items"
                  :key="item.id"
                  class="hosp-record-chip"
                >
                  <span class="font-bold text-teal-900">{{ item.memberName }}</span>
                  <span v-if="getMemberShortOrg(item)" class="text-[11px] text-gray-500">{{ getMemberShortOrg(item) }}</span>
                  <span v-if="item.shiftLabel && item.shiftLabel !== '醫院志工'" class="badge badge-info text-[10px] py-0 px-1.5">
                    {{ item.shiftLabel }}
                  </span>
                  <span
                    v-if="getExistingLocationConflict(item.dutyDate, item.memberName)"
                    class="badge badge-warning text-[10px] py-0 px-1.5"
                    title="此志工當日已有道場排班，執行依規則自動排班時將以醫院志工為最優先並自動調換"
                  >
                    ⚠️ {{ getExistingLocationConflict(item.dutyDate, item.memberName) }}
                  </span>
                  <button
                    type="button"
                    class="chip-rm-btn text-danger"
                    title="刪除此筆預排"
                    @click="handleDeleteSingle(item)"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- 視角 B：依志工分組檢視 -->
          <div v-else class="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            <div
              v-for="mGroup in groupedByMember"
              :key="mGroup.memberName"
              class="p-2.5 border rounded-lg flex items-center justify-between flex-wrap gap-2 bg-gray-50/60"
            >
              <div class="flex items-center gap-2 flex-wrap">
                <strong class="text-gray-900 text-sm">👤 {{ mGroup.memberName }}</strong>
                <span v-if="mGroup.orgPath" class="text-xs text-gray-500">({{ mGroup.orgPath }})</span>
                <span class="badge badge-primary text-xs">共 {{ mGroup.items.length }} 天</span>
              </div>

              <div class="flex items-center gap-1.5 flex-wrap">
                <span
                  v-for="item in mGroup.items"
                  :key="item.id"
                  class="hosp-record-chip"
                >
                  <span>{{ item.dutyDate.substring(5) }} ({{ getDayOfWeekShort(item.dutyDate) }})</span>
                  <button
                    type="button"
                    class="chip-rm-btn text-danger"
                    title="刪除此日"
                    @click="handleDeleteSingle(item)"
                  >
                    ×
                  </button>
                </span>
                <button
                  type="button"
                  class="btn btn-xs btn-outline text-danger ml-2"
                  @click="handleDeleteMemberGroup(mGroup)"
                >
                  整批移除
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="modal-footer flex items-center justify-between">
        <span class="text-xs text-muted">
          💡 新增或修改醫院志工日期後，在「依規則自動排班」時系統將自動依「醫院志工 ＞ 宜蘭園區 ＞ 東港聯絡處」優先順序調換班組。
        </span>
        <button type="button" class="btn btn-outline btn-sm" @click="emit('close')">
          完成並關閉
        </button>
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

const props = defineProps({
  show: { type: Boolean, default: false },
  defaultMonth: { type: String, default: '' }
});

const emit = defineEmits(['close', 'updated']);

const dutiesStore = useDutiesStore();
const membersStore = useMembersStore();
const orgsStore = useOrgsStore();
const toast = useToast();

const activeMonth = ref(props.defaultMonth || new Date().toISOString().substring(0, 7));
const dateSelectMode = ref('range'); // 'range' | 'multi'
const rangeStartDate = ref('');
const rangeEndDate = ref('');
const multiSelectedDates = ref([]);

const filterOrgId = ref('');
const filterGender = ref('');
const searchKw = ref('');
const quickPickMemberId = ref('');
const manualMemberName = ref('');
const selectedMembersToAdd = ref([]);
const hospitalLabel = ref('醫院志工');

// 複製批次名單與常用批次模板狀態
const allHistoricalHospitalList = ref([]);
const selectedHistoryBatchKey = ref('');
const showSaveTemplateBar = ref(false);
const newTemplateName = ref('');

const batchTemplates = computed(() => dutiesStore.hospitalBatchTemplates || []);

const listViewMode = ref('byDate'); // 'byDate' | 'byMember'
const loadingList = ref(false);
const submitting = ref(false);

const monthHospitalList = ref([]);
const monthYilanList = ref([]);
const monthDonggangList = ref([]);
const allMembers = ref([]);

watch(() => props.defaultMonth, (val) => {
  if (val) {
    activeMonth.value = val;
    initDefaultRange(val);
  }
});

watch(() => props.show, async (isOpen) => {
  if (isOpen) {
    if (props.defaultMonth) {
      activeMonth.value = props.defaultMonth;
    }
    if (!rangeStartDate.value || !rangeStartDate.value.startsWith(activeMonth.value)) {
      initDefaultRange(activeMonth.value);
    }
    await ensureBaseData();
    await loadMonthData();
  }
});

function initDefaultRange(monthStr) {
  if (!monthStr) return;
  rangeStartDate.value = `${monthStr}-01`;
  rangeEndDate.value = `${monthStr}-01`;
}

async function ensureBaseData() {
  const tasks = [
    dutiesStore.fetchHospitalBatchTemplates(),
    dutiesStore.fetchAllHospitalVolunteerSchedules().then(res => {
      allHistoricalHospitalList.value = res || [];
    })
  ];
  if (!orgsStore.orgs || orgsStore.orgs.length === 0) {
    tasks.push(orgsStore.fetchOrgs());
  }
  if (!membersStore.members || membersStore.members.length === 0) {
    tasks.push(membersStore.fetchMembers());
  }
  await Promise.all(tasks);
  allMembers.value = membersStore.members || [];
}

async function loadMonthData() {
  if (!activeMonth.value) return;
  loadingList.value = true;
  try {
    const [year, month] = activeMonth.value.split('-').map(Number);
    const [hosp, yl, dg, allHosp] = await Promise.all([
      dutiesStore.fetchHospitalVolunteerSchedule(year, month),
      dutiesStore.getDutyScheduleByRange('宜蘭園區', `${activeMonth.value}-01`, `${activeMonth.value}-31`),
      dutiesStore.getDutyScheduleByRange('東港聯絡處', `${activeMonth.value}-01`, `${activeMonth.value}-31`),
      dutiesStore.fetchAllHospitalVolunteerSchedules()
    ]);
    monthHospitalList.value = hosp || [];
    monthYilanList.value = yl || [];
    monthDonggangList.value = dg || [];
    allHistoricalHospitalList.value = allHosp || [];
  } finally {
    loadingList.value = false;
  }
}

const formattedOrgOptions = computed(() => {
  const options = [];
  (orgsStore.orgTree || []).forEach(heqi => {
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

const memberOrgPathMap = computed(() => {
  const map = new Map();
  allMembers.value.forEach(m => {
    if (m.id && m.orgId) {
      const p = orgsStore.getOrgPath(m.orgId);
      if (p) map.set(m.id, `(${p})`);
    }
  });
  return map;
});

function getMemberOrgPathText(memberId) {
  if (!memberId) return '';
  return memberOrgPathMap.value.get(memberId) || '';
}

function getMemberShortOrg(item) {
  const found = allMembers.value.find(m => (item.memberId && m.id === item.memberId) || m.name === item.memberName);
  if (!found || !found.orgId) return '';
  const p = orgsStore.getOrgPath(found.orgId);
  if (!p) return '';
  return `(${p.split('/')[0].trim()})`;
}

// ─── 自動聚合歷史月份與連續梯次之批次名單選項 ───
function buildMemberObjFromRecord(rec) {
  const name = (rec.memberName || rec.name || '').trim();
  const found = allMembers.value.find(m => (rec.memberId && m.id === rec.memberId) || (rec.id && m.id === rec.id) || (m.name || '').trim() === name);
  return {
    id: found ? found.id : (rec.memberId || rec.id || ''),
    name,
    gender: found ? (found.gender || '女') : (rec.genderType || rec.gender || '女'),
    orgText: found ? getMemberOrgPathText(found.id) : (rec.orgText || '')
  };
}

const historicalBatchOptions = computed(() => {
  const options = [];
  const rawList = allHistoricalHospitalList.value || [];
  if (rawList.length === 0) return options;

  // 1. 依月份聚合全月不重複名單 (由新到舊)
  const monthMap = new Map();
  rawList.forEach(item => {
    if (!item.dutyDate || !item.memberName) return;
    const ym = item.dutyDate.substring(0, 7);
    if (!monthMap.has(ym)) {
      monthMap.set(ym, {
        ym,
        hospitalName: item.shiftLabel || '醫院志工',
        membersMap: new Map(),
        dates: new Set()
      });
    }
    const entry = monthMap.get(ym);
    entry.dates.add(item.dutyDate);
    const cleanName = item.memberName.trim();
    if (!entry.membersMap.has(cleanName)) {
      entry.membersMap.set(cleanName, buildMemberObjFromRecord(item));
    }
  });

  const sortedMonths = Array.from(monthMap.values()).sort((a, b) => b.ym.localeCompare(a.ym));
  sortedMonths.forEach(mEntry => {
    const membersArr = Array.from(mEntry.membersMap.values());
    const previewNames = membersArr.slice(0, 6).map(x => x.name).join('、') + (membersArr.length > 6 ? '...' : '');
    const sortedDates = Array.from(mEntry.dates).sort();
    const dateSpanText = sortedDates.length > 1
      ? `${sortedDates[0].substring(5)}~${sortedDates[sortedDates.length - 1].substring(5)}`
      : sortedDates[0]?.substring(5) || '';

    options.push({
      key: `month_${mEntry.ym}`,
      label: `📅 【${mEntry.ym} 整批名單】(${dateSpanText}・共 ${membersArr.length} 人：${previewNames})`,
      hospitalName: mEntry.hospitalName,
      members: membersArr
    });
  });

  // 2. 依單日或特定梯次聚合 (若某月內有多個不同名單梯次)
  const dateMap = new Map();
  rawList.forEach(item => {
    if (!item.dutyDate || !item.memberName) return;
    if (!dateMap.has(item.dutyDate)) {
      dateMap.set(item.dutyDate, {
        dateStr: item.dutyDate,
        hospitalName: item.shiftLabel || '醫院志工',
        membersMap: new Map()
      });
    }
    const dEntry = dateMap.get(item.dutyDate);
    const cleanName = item.memberName.trim();
    if (!dEntry.membersMap.has(cleanName)) {
      dEntry.membersMap.set(cleanName, buildMemberObjFromRecord(item));
    }
  });

  // 將連續且成員相同的日期合併成「梯次」
  const sortedDatesAsc = Array.from(dateMap.values()).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  const batches = [];
  sortedDatesAsc.forEach(dEntry => {
    const memberKey = Array.from(dEntry.membersMap.keys()).sort().join('|');
    const prev = batches[batches.length - 1];
    if (prev && prev.memberKey === memberKey && prev.hospitalName === dEntry.hospitalName) {
      prev.endDate = dEntry.dateStr;
      prev.dayCount++;
    } else {
      batches.push({
        startDate: dEntry.dateStr,
        endDate: dEntry.dateStr,
        dayCount: 1,
        hospitalName: dEntry.hospitalName,
        memberKey,
        members: Array.from(dEntry.membersMap.values())
      });
    }
  });

  batches.reverse().forEach((b, idx) => {
    const previewNames = b.members.slice(0, 5).map(x => x.name).join('、') + (b.members.length > 5 ? '...' : '');
    const rangeLabel = b.startDate === b.endDate
      ? b.startDate
      : `${b.startDate} ~ ${b.endDate.substring(5)} (${b.dayCount}天)`;
    options.push({
      key: `batch_${idx}_${b.startDate}`,
      label: `🏥 梯次【${rangeLabel}】${b.hospitalName} (共 ${b.members.length} 人：${previewNames})`,
      hospitalName: b.hospitalName,
      members: b.members
    });
  });

  return options;
});

function applyBatchRoster(members = [], targetHospitalName = '', mode = 'replace', sourceTitle = '批次名單') {
  if (!Array.isArray(members) || members.length === 0) return;
  const normalized = members.map(m => buildMemberObjFromRecord(m)).filter(m => !!m.name);

  if (mode === 'replace') {
    selectedMembersToAdd.value = normalized;
  } else {
    const existingNames = new Set(selectedMembersToAdd.value.map(x => x.name));
    normalized.forEach(m => {
      if (!existingNames.has(m.name)) {
        selectedMembersToAdd.value.push(m);
        existingNames.add(m.name);
      }
    });
  }

  if (targetHospitalName) {
    hospitalLabel.value = targetHospitalName;
  }

  toast.success(`📋 已從${sourceTitle}帶入 ${normalized.length} 位醫院志工！請確認上方預排日期後點擊確認新增。`);
}

function handleCopySelectedHistoryBatch(mode = 'replace') {
  if (!selectedHistoryBatchKey.value) return;
  const found = historicalBatchOptions.value.find(o => o.key === selectedHistoryBatchKey.value);
  if (!found) return;
  applyBatchRoster(found.members, found.hospitalName, mode, found.label.split('(')[0]);
}

function copyCurrentMonthRoster() {
  if (monthHospitalList.value.length === 0) return;
  const uniqueMap = new Map();
  let label = hospitalLabel.value;
  monthHospitalList.value.forEach(item => {
    if (item.memberName && !uniqueMap.has(item.memberName.trim())) {
      uniqueMap.set(item.memberName.trim(), buildMemberObjFromRecord(item));
      if (item.shiftLabel) label = item.shiftLabel;
    }
  });
  applyBatchRoster(Array.from(uniqueMap.values()), label, 'replace', `${activeMonth.value} 全月名單`);
}

function copyDateGroupRoster(group) {
  if (!group?.items?.length) return;
  const label = group.items[0]?.shiftLabel || hospitalLabel.value;
  applyBatchRoster(group.items, label, 'replace', `${group.dateStr} 名單`);
}

function openSaveTemplateInput() {
  showSaveTemplateBar.value = true;
  if (!newTemplateName.value) {
    newTemplateName.value = `${hospitalLabel.value || '醫院志工'}固定批次名單 (${selectedMembersToAdd.value.length}人)`;
  }
}

async function handleSaveBatchTemplate() {
  if (!newTemplateName.value.trim() || selectedMembersToAdd.value.length === 0) return;
  submitting.value = true;
  try {
    await dutiesStore.saveHospitalBatchTemplate({
      templateName: newTemplateName.value.trim(),
      hospitalName: hospitalLabel.value,
      members: selectedMembersToAdd.value
    });
    toast.success(`⭐ 已儲存常用批次名單「${newTemplateName.value.trim()}」！往後每月可一鍵點擊套用。`);
    showSaveTemplateBar.value = false;
    newTemplateName.value = '';
  } catch (err) {
    toast.error('儲存常用批次失敗：' + err.message);
  } finally {
    submitting.value = false;
  }
}

async function handleDeleteBatchTemplate(tpl) {
  if (!tpl?.id) return;
  if (!confirm(`確定要刪除常用批次模板「${tpl.templateName}」嗎？`)) return;
  try {
    await dutiesStore.deleteHospitalBatchTemplate(tpl.id);
    toast.success(`已刪除常用批次模板「${tpl.templateName}」`);
  } catch (err) {
    toast.error('刪除模板失敗：' + err.message);
  }
}

function resetMemberFilter() {
  filterOrgId.value = '';
  filterGender.value = '';
  searchKw.value = '';
}

const filteredMembers = computed(() => {
  const allowedOrgIds = filterOrgId.value ? orgsStore.getDescendantOrgIds(filterOrgId.value) : null;
  const kw = searchKw.value ? searchKw.value.toLowerCase().trim() : '';

  return allMembers.value.filter(m => {
    if (filterGender.value && m.gender !== filterGender.value) return false;
    if (allowedOrgIds && !allowedOrgIds.includes(m.orgId)) return false;
    if (kw) {
      const matchName = (m.name || '').toLowerCase().includes(kw);
      const matchPhone = (m.phone || '').includes(kw);
      const matchDharma = (m.dharmaName || '').toLowerCase().includes(kw);
      if (!matchName && !matchPhone && !matchDharma) return false;
    }
    return true;
  });
});

function onPickMember() {
  if (!quickPickMemberId.value) return;
  const found = allMembers.value.find(m => m.id === quickPickMemberId.value);
  if (found) {
    const exists = selectedMembersToAdd.value.some(x => x.id === found.id || x.name === found.name);
    if (!exists) {
      selectedMembersToAdd.value.push({
        id: found.id,
        name: found.name,
        gender: found.gender || '女',
        orgText: getMemberOrgPathText(found.id)
      });
    }
  }
  quickPickMemberId.value = '';
}

function onAddManualMember() {
  const name = manualMemberName.value.trim();
  if (!name) return;
  const found = allMembers.value.find(m => (m.name || '').trim() === name);
  const exists = selectedMembersToAdd.value.some(x => x.name === name);
  if (!exists) {
    selectedMembersToAdd.value.push({
      id: found ? found.id : '',
      name,
      gender: found ? (found.gender || '女') : (filterGender.value || '女'),
      orgText: found ? getMemberOrgPathText(found.id) : ''
    });
  }
  manualMemberName.value = '';
}

// 計算預排所選日期陣列
const computedSelectedDates = computed(() => {
  if (dateSelectMode.value === 'multi') {
    return [...multiSelectedDates.value].sort();
  }
  if (!rangeStartDate.value || !rangeEndDate.value) return [];
  const [sy, sm, sd] = rangeStartDate.value.split('-').map(Number);
  const [ey, em, ed] = rangeEndDate.value.split('-').map(Number);
  let start = new Date(sy, sm - 1, sd);
  let end = new Date(ey, em - 1, ed);
  if (start > end) {
    const t = start;
    start = end;
    end = t;
  }
  const dates = [];
  const cur = new Date(start.getTime());
  while (cur <= end && dates.length <= 62) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
});

// 迷你月曆格子
const miniCalendarCells = computed(() => {
  if (!activeMonth.value) return [];
  const [year, month] = activeMonth.value.split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1).getDay();
  const totalDays = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push({ dateStr: null });
  for (let d = 1; d <= totalDays; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, dateStr });
  }
  return cells;
});

function toggleMultiDate(dateStr) {
  const idx = multiSelectedDates.value.indexOf(dateStr);
  if (idx >= 0) {
    multiSelectedDates.value.splice(idx, 1);
  } else {
    multiSelectedDates.value.push(dateStr);
  }
}

function getDayHospitalMembers(dateStr) {
  return monthHospitalList.value
    .filter(x => x.dutyDate === dateStr && x.memberName)
    .map(x => x.memberName);
}

function getDayOfWeekShort(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return ['日', '一', '二', '三', '四', '五', '六'][new Date(y, m - 1, d).getDay()];
}

function getExistingLocationConflict(dateStr, memberName) {
  if (!dateStr || !memberName) return '';
  const hits = [];
  const inYl = monthYilanList.value.find(d => d.dutyDate === dateStr && d.memberName === memberName);
  if (inYl) hits.push(`宜蘭園區(${inYl.shiftLabel || '值班'})`);
  const inDg = monthDonggangList.value.find(d => d.dutyDate === dateStr && d.memberName === memberName);
  if (inDg) hits.push(`東港聯絡處(${inDg.shiftLabel || '值班'})`);
  return hits.length > 0 ? `已排: ${hits.join('、')}` : '';
}

const groupedByDate = computed(() => {
  const map = new Map();
  monthHospitalList.value.forEach(item => {
    if (!item.dutyDate) return;
    if (!map.has(item.dutyDate)) {
      map.set(item.dutyDate, {
        dateStr: item.dutyDate,
        dayOfWeek: '週' + getDayOfWeekShort(item.dutyDate),
        items: []
      });
    }
    map.get(item.dutyDate).items.push(item);
  });
  return Array.from(map.values()).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
});

const groupedByMember = computed(() => {
  const map = new Map();
  monthHospitalList.value.forEach(item => {
    if (!item.memberName) return;
    if (!map.has(item.memberName)) {
      const found = allMembers.value.find(m => (item.memberId && m.id === item.memberId) || m.name === item.memberName);
      const orgPath = found && found.orgId ? orgsStore.getOrgPath(found.orgId) : '';
      map.set(item.memberName, {
        memberName: item.memberName,
        orgPath,
        items: []
      });
    }
    map.get(item.memberName).items.push(item);
  });
  return Array.from(map.values());
});

async function handleAddSchedules() {
  if (computedSelectedDates.value.length === 0 || selectedMembersToAdd.value.length === 0) return;
  submitting.value = true;
  try {
    const added = await dutiesStore.addHospitalVolunteerSchedules({
      dates: computedSelectedDates.value,
      members: selectedMembersToAdd.value,
      hospitalName: hospitalLabel.value
    });
    toast.success(`🏥 已成功預排 ${selectedMembersToAdd.value.length} 位醫院志工（共 ${added.length} 人次）！`);
    selectedMembersToAdd.value = [];
    if (dateSelectMode.value === 'multi') {
      multiSelectedDates.value = [];
    }
    // 若新增的日期屬於某月份，切換並重新整理該月清單
    if (computedSelectedDates.value[0]) {
      activeMonth.value = computedSelectedDates.value[0].substring(0, 7);
    }
    await loadMonthData();
    emit('updated');
  } catch (err) {
    toast.error('新增預排醫院志工失敗：' + err.message);
  } finally {
    submitting.value = false;
  }
}

async function handleDeleteSingle(item) {
  if (!item?.id) return;
  submitting.value = true;
  try {
    await dutiesStore.deleteHospitalVolunteerSchedules([item.id]);
    toast.success(`已移除 ${item.dutyDate}「${item.memberName}」之醫院志工預排`);
    await loadMonthData();
    emit('updated');
  } catch (err) {
    toast.error('移除失敗：' + err.message);
  } finally {
    submitting.value = false;
  }
}

async function handleDeleteMemberGroup(mGroup) {
  if (!mGroup?.items?.length) return;
  if (!confirm(`確定要移除「${mGroup.memberName}」於 ${activeMonth.value} 的全部 ${mGroup.items.length} 天醫院志工預排嗎？`)) return;
  submitting.value = true;
  try {
    await dutiesStore.deleteHospitalVolunteerSchedules(mGroup.items);
    toast.success(`已移除「${mGroup.memberName}」共 ${mGroup.items.length} 天醫院志工預排`);
    await loadMonthData();
    emit('updated');
  } catch (err) {
    toast.error('移除失敗：' + err.message);
  } finally {
    submitting.value = false;
  }
}

async function handleClearMonth() {
  if (!monthHospitalList.value.length) return;
  if (!confirm(`⚠️ 確定要清空【${activeMonth.value}】整月共 ${monthHospitalList.value.length} 人次的醫院志工預排紀錄嗎？`)) return;
  submitting.value = true;
  try {
    await dutiesStore.deleteHospitalVolunteerSchedules(monthHospitalList.value);
    toast.success(`已清空 ${activeMonth.value} 全部醫院志工預排紀錄`);
    await loadMonthData();
    emit('updated');
  } catch (err) {
    toast.error('清空失敗：' + err.message);
  } finally {
    submitting.value = false;
  }
}

onMounted(async () => {
  initDefaultRange(activeMonth.value);
  if (props.show) {
    await ensureBaseData();
    await loadMonthData();
  }
});
</script>

<style scoped>
.modal-backdrop {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  background: rgba(15, 23, 42, 0.6); display: flex; align-items: center; justify-content: center; z-index: 9995;
}
.modal-content { background: #ffffff; border-radius: var(--radius-lg); width: 92%; }
.modal-header { padding: 1.15rem 1.5rem; border-bottom: 1px solid var(--gray-200); display: flex; justify-content: space-between; align-items: center; }
.modal-body { padding: 1.25rem 1.5rem; max-height: 75vh; overflow-y: auto; }
.modal-footer { padding: 0.9rem 1.5rem; background: var(--gray-50); border-top: 1px solid var(--gray-200); }
.modal-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--gray-500); }

.selected-vol-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  background: #f0fdfa;
  border: 1px solid #99f6e4;
  color: #115e59;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.8rem;
}
.hosp-record-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  padding: 0.2rem 0.55rem;
  border-radius: 6px;
  font-size: 0.78rem;
}
.chip-rm-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-weight: bold;
  font-size: 0.95rem;
  line-height: 1;
  padding: 0 0.15rem;
  color: #64748b;
}
.chip-rm-btn:hover { color: #dc2626; }

.mini-cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  text-align: center;
}
.mini-cal-head {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--gray-600);
  padding: 0.25rem 0;
}
.mini-cal-cell {
  min-height: 38px;
  border: 1px solid var(--gray-200);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  cursor: pointer;
  background: #ffffff;
  transition: all 0.12s;
}
.mini-cal-cell:hover:not(.mini-cal-empty) {
  border-color: #0d9488;
  background: #f0fdfa;
}
.mini-cal-empty {
  background: transparent;
  border-color: transparent;
  cursor: default;
}
.mini-cal-selected {
  background: #0d9488 !important;
  color: #ffffff !important;
  border-color: #0f766e !important;
}
.mini-cal-has-hosp {
  border-bottom: 3px solid #f59e0b;
}
.mini-cal-dot {
  font-size: 0.65rem;
  opacity: 0.85;
  line-height: 1;
}
</style>

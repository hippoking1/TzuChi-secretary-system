<template>
  <div class="admin-duty-rules">
    <!-- 頂部標題與控制列 -->
    <div class="flex items-center justify-between mb-6 flex-wrap gap-4">
      <div>
        <h1 class="text-2xl font-bold flex items-center gap-2">
          ⚙️ 值班自動排班規則管理
        </h1>
        <p class="text-sm text-muted">
          維護和氣週輪值次序與各星期組別名冊，排班時可一鍵套用規則自動指派
        </p>
      </div>
      <div class="flex items-center gap-3 flex-wrap">
        <router-link to="/admin/duty-form" class="btn btn-outline">
          ✏️ 前往排班表
        </router-link>
        <router-link to="/admin/duty-schedule" class="btn btn-outline">
          🗓️ 查看值班月曆
        </router-link>
      </div>
    </div>

    <!-- 1. 和氣週輪值設定卡片 -->
    <div class="card mb-6">
      <div class="card-header flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-xl">🔄</span>
          <h2 class="text-lg font-bold">1. 和氣週輪值設定（園區值班輪流負責）</h2>
        </div>
        <button class="btn btn-primary btn-sm" :disabled="savingRotation" @click="handleSaveWeekRotation">
          {{ savingRotation ? '儲存中...' : '💾 儲存週輪值設定' }}
        </button>
      </div>

      <div class="card-body">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div class="form-group mb-0">
            <label class="form-label font-bold">基準週起始日期（週一）：</label>
            <input v-model="rotationForm.baseStartDate" type="date" class="form-input" />
            <span class="text-xs text-muted">例如設定 2026-01-05 作為第一週起始點</span>
          </div>

          <div class="form-group mb-0">
            <label class="form-label font-bold">基準週起始和氣：</label>
            <select v-model="rotationForm.baseStartHeqi" class="form-select">
              <option v-for="h in rotationForm.rotationOrder" :key="h" :value="h">
                {{ h }}
              </option>
            </select>
          </div>

          <div class="form-group mb-0">
            <label class="form-label font-bold">輪值次序循環：</label>
            <div class="flex items-center gap-1 flex-wrap mt-1">
              <span 
                v-for="(h, idx) in rotationForm.rotationOrder" 
                :key="h" 
                class="badge badge-info flex items-center gap-1 text-sm py-1 px-2"
              >
                {{ idx + 1 }}. {{ h }}
                <span v-if="idx < rotationForm.rotationOrder.length - 1" class="text-xs">→</span>
              </span>
            </div>
          </div>
        </div>

        <!-- 未來數週和氣輪值預覽表格 -->
        <div class="mt-4 pt-3 border-t">
          <h4 class="text-xs font-bold text-gray-700 mb-2">🗓️ 近期週次負責和氣即時預覽：</h4>
          <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            <div 
              v-for="w in upcomingWeeksPreview" 
              :key="w.startDate" 
              class="preview-week-box"
              :class="{ 'box-highlight': w.heqi === '和氣二' }"
            >
              <div class="font-bold text-xs">{{ w.dateRange }}</div>
              <div class="heqi-tag" :class="w.heqi === '和氣二' ? 'text-primary font-bold' : 'text-gray-700'">
                {{ w.heqi }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 2. 組別排班規則維護卡片 -->
    <div class="card mb-6">
      <div class="card-header flex items-center justify-between flex-wrap gap-3">
        <div class="flex items-center gap-2">
          <span class="text-xl">📋</span>
          <div>
            <h2 class="text-lg font-bold">2. 和氣二園區女眾值班規則（星期 × 整組輪替）</h2>
            <span class="text-xs text-muted">園區女眾班席位為 4 位；組員超過 4 位將自動啟用備用跨次輪替</span>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button class="btn btn-outline btn-sm" @click="handleResetDefault">
            ↺ 還原標準預設名冊
          </button>
          <button class="btn btn-primary btn-sm" :disabled="savingRule" @click="handleSaveRule">
            {{ savingRule ? '儲存中...' : '💾 儲存組別排班規則' }}
          </button>
        </div>
      </div>

      <div class="card-body">
        <!-- 星期切換分頁 Tab -->
        <div class="weekday-tabs flex items-center gap-2 border-b pb-3 mb-4 overflow-x-auto">
          <button 
            v-for="d in weekdays" 
            :key="d.key"
            class="tab-btn"
            :class="{ 'tab-btn-active': activeWeekday === d.key }"
            @click="activeWeekday = d.key"
          >
            <span>{{ d.label }}</span>
            <span class="badge badge-sm ml-1" :class="activeWeekday === d.key ? 'badge-light' : 'badge-gray'">
              {{ (currentTeams[d.key] || []).length }}組
            </span>
          </button>
        </div>

        <!-- 該星期組別列表 -->
        <div class="teams-container flex flex-col gap-4">
          <div 
            v-for="(team, teamIdx) in (currentTeams[activeWeekday] || [])" 
            :key="teamIdx"
            class="team-card p-4 border rounded-lg bg-gray-50/50"
            :class="{ 'border-warning': team.members.length > 4 }"
          >
            <!-- 組別標題與操作按鈕 -->
            <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div class="flex items-center gap-2">
                <input 
                  v-model="team.teamName" 
                  class="form-input form-input-sm font-bold text-primary" 
                  style="max-width: 140px;"
                />
                <span class="badge" :class="team.members.length > 4 ? 'badge-warning' : 'badge-primary'">
                  共 {{ team.members.length }} 人
                </span>
                <span v-if="team.members.length > 4" class="text-xs text-warning font-bold flex items-center gap-1">
                  ⚠️ 超額 {{ team.members.length - 4 }} 人，自動啟動備用輪替機制（每次 4 人排班，多出人員下次遞補）
                </span>
                <span v-else-if="team.members.length < 4" class="text-xs text-muted">
                  （尚缺 {{ 4 - team.members.length }} 人滿編）
                </span>
              </div>

              <div class="flex items-center gap-1">
                <button 
                  class="btn btn-xs btn-outline" 
                  :disabled="teamIdx === 0" 
                  @click="moveTeam(activeWeekday, teamIdx, -1)"
                  title="上移組別"
                >
                  ↑
                </button>
                <button 
                  class="btn btn-xs btn-outline" 
                  :disabled="teamIdx === (currentTeams[activeWeekday] || []).length - 1" 
                  @click="moveTeam(activeWeekday, teamIdx, 1)"
                  title="下移組別"
                >
                  ↓
                </button>
                <button 
                  class="btn btn-xs btn-danger btn-outline ml-2" 
                  @click="removeTeam(activeWeekday, teamIdx)"
                  title="刪除此組"
                >
                  ✕ 刪除組
                </button>
              </div>
            </div>

            <!-- 組員名單 Tag 膠囊列表 -->
            <div class="members-chip-container flex flex-wrap gap-2 mb-3">
              <div 
                v-for="(member, mIdx) in team.members" 
                :key="mIdx"
                class="member-chip"
                :class="{ 'chip-overflow': mIdx >= 4 }"
              >
                <span class="chip-index">{{ mIdx + 1 }}.</span>
                <span class="chip-text">{{ member }}</span>
                <span v-if="mIdx >= 4" class="chip-badge">備用輪替</span>
                <button 
                  class="chip-delete-btn" 
                  @click="removeMember(activeWeekday, teamIdx, mIdx)"
                  title="移除志工"
                >
                  ×
                </button>
              </div>

              <span v-if="team.members.length === 0" class="text-xs text-muted py-1">
                尚未加入志工，請於下方新增
              </span>
            </div>

            <!-- 新增志工輸入列 -->
            <div class="add-member-row flex items-center gap-2 flex-wrap">
              <!-- 從志工名冊快速搜尋加入 -->
              <select 
                v-model="quickSelectedMemberId[teamIdx]" 
                class="form-select form-select-sm" 
                style="max-width: 220px;"
                @change="onSelectMember(activeWeekday, teamIdx)"
              >
                <option value="">-- 從女眾名冊選擇加入 --</option>
                <option v-for="m in femaleMembers" :key="m.id" :value="m.name">
                  {{ m.name }}
                </option>
              </select>

              <span class="text-xs text-muted">或直接手動輸入姓名：</span>
              <input 
                v-model="newMemberName[teamIdx]" 
                type="text" 
                class="form-input form-input-sm" 
                placeholder="輸入姓名按 Enter..." 
                style="max-width: 160px;"
                @keyup.enter="onAddMember(activeWeekday, teamIdx)"
              />
              <button 
                class="btn btn-sm btn-outline" 
                :disabled="!newMemberName[teamIdx]" 
                @click="onAddMember(activeWeekday, teamIdx)"
              >
                ＋ 加入
              </button>
            </div>
          </div>

          <!-- 新增組別按鈕 -->
          <div class="pt-2">
            <button class="btn btn-outline btn-block" @click="addNewTeam(activeWeekday)">
              ➕ 在{{ weekdays.find(w => w.key === activeWeekday)?.label }}新增一組
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useDutyRulesStore, DEFAULT_HEQI2_FEMALE_TEAMS, DEFAULT_WEEK_ROTATION } from '@/stores/dutyRules';
import { useMembersStore } from '@/stores/members';
import { useToast } from '@/composables/useToast';

const dutyRulesStore = useDutyRulesStore();
const membersStore = useMembersStore();
const toast = useToast();

const savingRotation = ref(false);
const savingRule = ref(false);

const weekdays = [
  { key: '1', label: '週一' },
  { key: '2', label: '週二' },
  { key: '3', label: '週三' },
  { key: '4', label: '週四' },
  { key: '5', label: '週五' },
  { key: '6', label: '週六' },
  { key: '0', label: '週日' }
];

const activeWeekday = ref('1');

// 和氣週輪值表單狀態
const rotationForm = ref({ ...DEFAULT_WEEK_ROTATION });

// 組別規則本地工作副本
const currentRule = ref(null);
const currentTeams = ref(JSON.parse(JSON.stringify(DEFAULT_HEQI2_FEMALE_TEAMS)));

// 志工名冊（女性）
const femaleMembers = ref([]);

// 輸入狀態綁定
const newMemberName = ref({});
const quickSelectedMemberId = ref({});

// 未來 8 週和氣輪值即時預覽
const upcomingWeeksPreview = computed(() => {
  const result = [];
  const baseDate = new Date();
  // 取本週週一
  const day = baseDate.getDay();
  const diff = (day - 1 + 7) % 7;
  const monday = new Date(baseDate.getTime() - diff * 86400000);

  for (let i = 0; i < 8; i++) {
    const wStart = new Date(monday.getTime() + i * 7 * 86400000);
    const wEnd = new Date(wStart.getTime() + 6 * 86400000);
    const startStr = wStart.toISOString().substring(5, 10);
    const endStr = wEnd.toISOString().substring(5, 10);
    const dateStrFull = wStart.toISOString().substring(0, 10);
    const heqi = dutyRulesStore.getHeqiForDate(dateStrFull, rotationForm.value);

    result.push({
      startDate: dateStrFull,
      dateRange: `${startStr} ~ ${endStr}`,
      heqi
    });
  }
  return result;
});

function moveTeam(weekday, idx, dir) {
  const list = currentTeams.value[weekday];
  if (!list) return;
  const targetIdx = idx + dir;
  if (targetIdx < 0 || targetIdx >= list.length) return;
  const temp = list[idx];
  list[idx] = list[targetIdx];
  list[targetIdx] = temp;
}

function removeTeam(weekday, idx) {
  if (confirm(`確定要刪除第 ${idx + 1} 組嗎？`)) {
    currentTeams.value[weekday].splice(idx, 1);
  }
}

function addNewTeam(weekday) {
  if (!currentTeams.value[weekday]) currentTeams.value[weekday] = [];
  const num = currentTeams.value[weekday].length + 1;
  const numChinese = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][num - 1] || String(num);
  currentTeams.value[weekday].push({
    teamName: `第${numChinese}組`,
    members: []
  });
}

function removeMember(weekday, teamIdx, mIdx) {
  currentTeams.value[weekday][teamIdx].members.splice(mIdx, 1);
}

function onAddMember(weekday, teamIdx) {
  const name = (newMemberName.value[teamIdx] || '').trim();
  if (!name) return;
  currentTeams.value[weekday][teamIdx].members.push(name);
  newMemberName.value[teamIdx] = '';
}

function onSelectMember(weekday, teamIdx) {
  const name = quickSelectedMemberId.value[teamIdx];
  if (!name) return;
  if (!currentTeams.value[weekday][teamIdx].members.includes(name)) {
    currentTeams.value[weekday][teamIdx].members.push(name);
  }
  quickSelectedMemberId.value[teamIdx] = '';
}

function handleResetDefault() {
  if (confirm('確定要還原成和氣二園區女眾標準預設組別名冊嗎？尚未儲存的修改將被覆蓋。')) {
    currentTeams.value = JSON.parse(JSON.stringify(DEFAULT_HEQI2_FEMALE_TEAMS));
    toast.info('已還原為標準預設名單，請記得點擊儲存！');
  }
}

async function handleSaveWeekRotation() {
  savingRotation.value = true;
  try {
    await dutyRulesStore.saveWeekRotation(rotationForm.value);
    toast.success('和氣週輪值設定儲存成功！');
  } catch (err) {
    toast.error('儲存失敗：' + err.message);
  } finally {
    savingRotation.value = false;
  }
}

async function handleSaveRule() {
  savingRule.value = true;
  try {
    const ruleData = {
      id: currentRule.value?.id || 'rule_heqi2_campus_female',
      heqiGroup: '和氣二',
      location: '宜蘭園區',
      shiftId: 'YL_F',
      shiftLabel: '女眾班',
      genderType: '女',
      ruleType: 'weekday_group_rotation',
      weekdayTeams: currentTeams.value,
      rotationPointers: currentRule.value?.rotationPointers || {},
      enabled: true
    };
    await dutyRulesStore.saveRule(ruleData);
    toast.success('和氣二排班規則儲存成功！');
  } catch (err) {
    toast.error('儲存規則失敗：' + err.message);
  } finally {
    savingRule.value = false;
  }
}

onMounted(async () => {
  const [rot, rules, females] = await Promise.all([
    dutyRulesStore.fetchWeekRotation('宜蘭園區'),
    dutyRulesStore.fetchRules('宜蘭園區'),
    membersStore.fetchMembers({ gender: '女' })
  ]);

  if (rot) {
    rotationForm.value = { ...DEFAULT_WEEK_ROTATION, ...rot };
  }

  femaleMembers.value = females;

  const foundRule = rules.find(r => r.heqiGroup === '和氣二' && r.location === '宜蘭園區' && r.shiftId === 'YL_F');
  if (foundRule) {
    currentRule.value = foundRule;
    if (foundRule.weekdayTeams) {
      currentTeams.value = JSON.parse(JSON.stringify(foundRule.weekdayTeams));
    }
  }
});
</script>

<style scoped>
.admin-duty-rules {
  max-width: 1200px;
  margin: 0 auto;
}

.preview-week-box {
  background: var(--gray-50);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-sm);
  padding: 0.5rem 0.4rem;
  text-align: center;
  transition: all 0.2s;
}

.box-highlight {
  background: #fdf2f8;
  border-color: #f472b6;
}

.heqi-tag {
  font-size: 0.82rem;
  margin-top: 0.25rem;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 1rem;
  border: 1px solid var(--gray-200);
  background: #ffffff;
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  white-space: nowrap;
}

.tab-btn-active {
  background: var(--primary-500);
  color: #ffffff;
  border-color: var(--primary-500);
}

.team-card {
  transition: border-color 0.2s;
}

.member-chip {
  display: inline-flex;
  align-items: center;
  background: #ffffff;
  border: 1px solid var(--gray-300);
  border-radius: 9999px;
  padding: 0.2rem 0.6rem;
  font-size: 0.85rem;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.chip-overflow {
  border-color: var(--warning);
  background: #fffbeb;
}

.chip-index {
  color: var(--gray-400);
  font-size: 0.72rem;
  margin-right: 0.25rem;
}

.chip-text {
  font-weight: 600;
  color: var(--gray-800);
}

.chip-badge {
  font-size: 0.65rem;
  background: var(--warning);
  color: #78350f;
  padding: 0.05rem 0.3rem;
  border-radius: 9999px;
  margin-left: 0.35rem;
  font-weight: 700;
}

.chip-delete-btn {
  background: none;
  border: none;
  color: var(--gray-400);
  margin-left: 0.4rem;
  cursor: pointer;
  font-size: 0.95rem;
  line-height: 1;
}

.chip-delete-btn:hover {
  color: var(--danger);
}

.btn-block {
  width: 100%;
}
</style>

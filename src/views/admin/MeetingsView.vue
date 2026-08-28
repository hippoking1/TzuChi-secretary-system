<template>
  <div class="admin-meetings">
    <div class="flex items-center justify-between mb-6 flex-wrap gap-4">
      <div>
        <h1 class="text-2xl font-bold">會議管理</h1>
        <p class="text-sm text-muted">發佈組隊會議、管理出席名單與發送 LINE 開會通知推播</p>
      </div>
      <router-link to="/admin/meetings/new" class="btn btn-primary">➕ 發佈新會議</router-link>
    </div>

    <div class="card table-responsive">
      <table class="table">
        <thead>
          <tr>
            <th>會議主題</th>
            <th>開會日期與時間</th>
            <th>地點</th>
            <th>召集人</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="meetingsStore.meetings.length === 0">
            <td colspan="5" class="text-center text-muted p-4">暫無會議資料</td>
          </tr>
          <tr v-for="m in meetingsStore.meetings" :key="m.id">
            <td class="font-bold text-primary">{{ m.title }}</td>
            <td>{{ m.meetingDate }} {{ m.startTime }}</td>
            <td>{{ m.location }}</td>
            <td>{{ m.organizerName || '召集幹部' }}</td>
            <td>
              <div class="flex gap-2 flex-wrap">
                <router-link :to="'/admin/meetings/edit/' + m.id" class="btn btn-sm btn-outline">
                  ✏️ 編輯
                </router-link>
                <button class="btn btn-sm btn-outline-primary" @click="openParticipantsModal(m.id)">
                  👥 出席名單與推播
                </button>
                <button class="btn btn-sm btn-danger" @click="handleDelete(m.id)">刪除</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 出席人員管理 Modal (安全視窗大小，不超出螢幕) -->
    <div v-if="showModal" class="modal-backdrop" @click="showModal = false">
      <div class="modal-content meeting-modal-dialog" @click.stop>
        <div class="modal-header">
          <div>
            <h3 class="modal-title">會議出席名單與 LINE 推播通知</h3>
            <p class="text-xs text-muted mt-1">{{ currentMeeting?.title }} ({{ currentMeeting?.meetingDate }} {{ currentMeeting?.startTime }})</p>
          </div>
          <button class="modal-close" @click="showModal = false">×</button>
        </div>
        
        <div class="modal-body">
          <div class="flex justify-between items-center mb-4 flex-wrap gap-2">
            <button class="btn btn-sm btn-outline-primary" @click="showAddMember = !showAddMember">
              {{ showAddMember ? '收起組織選單' : '➕ 加入指定組織/志工' }}
            </button>
            <button 
              class="btn btn-sm btn-secondary flex items-center gap-1" 
              :disabled="sendingLine || meetingsStore.participants.length === 0" 
              @click="sendLineNotification"
            >
              <span>💬</span>
              <span>{{ sendingLine ? '發送推播中...' : '一鍵推播 LINE 開會通知 (' + meetingsStore.participants.length + '人)' }}</span>
            </button>
          </div>

          <!-- 加入志工區塊 (支援「依幹部職稱篩選」與「依組織架構挑選」雙模式) -->
          <div v-if="showAddMember" class="card mb-4 p-4 bg-gray-50 border border-gray-200">
            <!-- 模式切換 Tabs -->
            <div class="tabs-nav justify-start mb-3">
              <button 
                type="button" 
                class="tab-btn text-xs py-1.5 px-3" 
                :class="{ active: filterMode === 'position' }" 
                @click="filterMode = 'position'"
              >
                🎖️ 依幹部職稱篩選與邀請
              </button>
              <button 
                type="button" 
                class="tab-btn text-xs py-1.5 px-3" 
                :class="{ active: filterMode === 'org' }" 
                @click="filterMode = 'org'"
              >
                🏛️ 依組織架構挑選 (和氣 / 互愛 / 協力)
              </button>
            </div>

            <!-- 模式 1: 依幹部職稱篩選 -->
            <div v-if="filterMode === 'position'">
              <div class="form-group mb-2">
                <label class="form-label font-bold text-xs">選擇幹部職稱 / 職務：</label>
                <select v-model="selectedPosition" class="form-select" @change="onPositionChange">
                  <option value="">-- 請選擇要邀請的幹部職稱 --</option>
                  <option value="__ALL_CADRES__">🌟 所有已指派幹部職稱之人員 (不限職稱)</option>
                  <option v-for="p in posStore.allPositionNames" :key="p" :value="p">
                    {{ p }}
                  </option>
                </select>
              </div>
            </div>

            <!-- 模式 2: 依組織架構篩選 -->
            <div v-else>
              <div class="form-group mb-2">
                <label class="form-label font-bold text-xs">選擇組織架構：</label>
                <OrgCascader v-model="targetOrgId" @change="onTargetOrgChange" />
              </div>
            </div>

            <!-- 志工候選名單展示 -->
            <div v-if="loadingMembers" class="text-center p-3 text-muted text-xs">
              載入志工名冊中...
            </div>

            <div v-else-if="availableMembers.length > 0" class="mt-3">
              <div class="flex items-center justify-between mb-2 flex-wrap gap-1">
                <span class="text-xs font-bold text-gray-700">
                  找到 {{ availableMembers.length }} 位符合人員（已勾選 {{ selectedMemberIds.length }} 位）：
                </span>
                <div class="flex gap-2">
                  <button type="button" class="btn btn-xs btn-outline" @click="selectAllMembers">全選</button>
                  <button type="button" class="btn btn-xs btn-outline" @click="deselectAllMembers">取消全選</button>
                </div>
              </div>

              <!-- 志工勾選網格 -->
              <div class="members-select-grid mb-3">
                <label 
                  v-for="m in availableMembers" 
                  :key="m.id" 
                  class="member-checkbox-card"
                  :class="{ selected: selectedMemberIds.includes(m.id) }"
                >
                  <input type="checkbox" :value="m.id" v-model="selectedMemberIds" />
                  <div class="flex flex-col">
                    <div class="font-bold text-sm text-gray-900 flex items-center gap-1">
                      <span>{{ m.name }}</span>
                      <span v-if="m.dharmaName" class="text-xs text-muted">({{ m.dharmaName }})</span>
                    </div>
                    <div class="text-xs text-gray-500 flex flex-wrap gap-1 mt-0.5">
                      <span v-for="r in (m.cadreRoles || m.positions || [])" :key="r" class="badge badge-info text-[10px] py-0 px-1">
                        {{ r }}
                      </span>
                    </div>
                  </div>
                </label>
              </div>

              <div class="flex justify-end gap-2">
                <button 
                  type="button" 
                  class="btn btn-sm btn-primary" 
                  :disabled="selectedMemberIds.length === 0"
                  @click="importSelectedMembers"
                >
                  ➕ 加入選取的 {{ selectedMemberIds.length }} 位人員至出席名單
                </button>
              </div>
            </div>

            <div v-else-if="selectedPosition || targetOrgId" class="text-center p-3 text-muted text-xs">
              查無符合條件之未加入人員
            </div>
          </div>

          <!-- 已加入名單 Table (具備獨立垂直捲軸與固定表頭，不超出視窗) -->
          <div class="participants-table-container">
            <table class="table mb-0">
              <thead>
                <tr>
                  <th style="width: 60px;">序號</th>
                  <th>姓名</th>
                  <th>幹部職稱 / 組織</th>
                  <th>聯絡電話</th>
                  <th>LINE 綁定</th>
                  <th style="width: 140px;">出席狀態</th>
                  <th style="width: 80px;">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="meetingsStore.participants.length === 0">
                  <td colspan="7" class="text-center text-muted p-6">目前出席名單尚無志工，請點擊上方按鈕加入</td>
                </tr>
                <tr v-for="(p, idx) in meetingsStore.participants" :key="p.id">
                  <td>{{ idx + 1 }}</td>
                  <td class="font-bold text-gray-900">{{ p.memberName }}</td>
                  <td>
                    <div v-if="(p.cadreRoles && p.cadreRoles.length) || (p.positions && p.positions.length)" class="flex flex-wrap gap-1">
                      <span v-for="r in (p.cadreRoles || p.positions)" :key="r" class="badge badge-info text-xs">
                        {{ r }}
                      </span>
                    </div>
                    <span v-else class="text-xs text-muted">{{ p.orgPath || '志工' }}</span>
                  </td>
                  <td>{{ p.memberPhone || '-' }}</td>
                  <td>
                    <span v-if="isMemberLineBound(p)" class="badge badge-success text-xs">
                      ✓ 已綁定
                    </span>
                    <span v-else class="badge badge-gray text-xs">
                      未綁定
                    </span>
                  </td>
                  <td>
                    <select 
                      v-model="p.attendance" 
                      class="form-select form-select-sm" 
                      @change="onAttendanceChange(p)"
                    >
                      <option value="未回覆">未回覆</option>
                      <option value="出席">出席</option>
                      <option value="請假">請假</option>
                      <option value="缺席">缺席</option>
                    </select>
                  </td>
                  <td>
                    <button class="btn btn-sm btn-danger" @click="removeParticipant(p.id)">移除</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-outline" @click="showModal = false">關閉</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useMeetingsStore } from '@/stores/meetings';
import { useMembersStore } from '@/stores/members';
import { useOrgsStore } from '@/stores/orgs';
import { usePositionsStore } from '@/stores/positions';
import { getCollectionDocs } from '@/firebase/db';
import OrgCascader from '@/components/ui/OrgCascader.vue';
import { useToast } from '@/composables/useToast';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/firebase/config';

const meetingsStore = useMeetingsStore();
const membersStore = useMembersStore();
const orgsStore = useOrgsStore();
const posStore = usePositionsStore();
const toast = useToast();

const showModal = ref(false);
const showAddMember = ref(false);
const filterMode = ref('position'); // 'position' | 'org'
const currentMeetingId = ref('');
const currentMeeting = ref(null);

const targetOrgId = ref('');
const selectedPosition = ref('');
const availableMembers = ref([]);
const selectedMemberIds = ref([]);
const loadingMembers = ref(false);
const sendingLine = ref(false);
const lineBoundSet = ref(new Set());

async function openParticipantsModal(id) {
  currentMeetingId.value = id;
  currentMeeting.value = await meetingsStore.fetchMeetingById(id);
  targetOrgId.value = '';
  selectedPosition.value = '';
  availableMembers.value = [];
  selectedMemberIds.value = [];
  showAddMember.value = false;
  filterMode.value = 'position';
  
  // 載入 LINE 綁定資料供狀態比對
  await loadLineBindings();
  showModal.value = true;
}

async function loadLineBindings() {
  const bindings = await getCollectionDocs('lineBindings');
  const set = new Set();
  bindings.forEach(b => {
    if (b.memberId) set.add(b.memberId);
    if (b.memberName) set.add(b.memberName);
  });
  lineBoundSet.value = set;
}

function isMemberLineBound(p) {
  return lineBoundSet.value.has(p.memberId) || lineBoundSet.value.has(p.memberName);
}

async function onPositionChange() {
  if (!selectedPosition.value) {
    availableMembers.value = [];
    selectedMemberIds.value = [];
    return;
  }
  loadingMembers.value = true;
  try {
    const allMembers = await membersStore.fetchMembers();
    const existingIds = new Set(meetingsStore.participants.map(p => p.memberId));

    let matched = [];
    if (selectedPosition.value === '__ALL_CADRES__') {
      matched = allMembers.filter(m => {
        const roles = m.cadreRoles || m.positions || [];
        return roles.length > 0 && !existingIds.has(m.id);
      });
    } else {
      matched = allMembers.filter(m => {
        const roles = m.cadreRoles || m.positions || [];
        return roles.includes(selectedPosition.value) && !existingIds.has(m.id);
      });
    }

    availableMembers.value = matched;
    selectedMemberIds.value = matched.map(m => m.id);
  } finally {
    loadingMembers.value = false;
  }
}

async function onTargetOrgChange(orgId) {
  if (!orgId) {
    availableMembers.value = [];
    selectedMemberIds.value = [];
    return;
  }
  loadingMembers.value = true;
  try {
    const descendantIds = orgsStore.getDescendantOrgIds(orgId);
    const list = await membersStore.fetchMembers({ orgIds: descendantIds });
    
    // 過濾已在名單中的志工
    const existingIds = new Set(meetingsStore.participants.map(p => p.memberId));
    availableMembers.value = list.filter(m => !existingIds.has(m.id));
    selectedMemberIds.value = availableMembers.value.map(m => m.id);
  } finally {
    loadingMembers.value = false;
  }
}

function selectAllMembers() {
  selectedMemberIds.value = availableMembers.value.map(m => m.id);
}

function deselectAllMembers() {
  selectedMemberIds.value = [];
}

async function importSelectedMembers() {
  if (selectedMemberIds.value.length === 0) return;
  const toAdd = availableMembers.value.filter(m => selectedMemberIds.value.includes(m.id));
  await meetingsStore.addParticipants(currentMeetingId.value, toAdd);
  toast.success(`已成功加入 ${toAdd.length} 位人員至會議名單！`);
  
  const existingIds = new Set(meetingsStore.participants.map(p => p.memberId));
  availableMembers.value = availableMembers.value.filter(m => !existingIds.has(m.id));
  selectedMemberIds.value = [];
}

async function removeParticipant(pId) {
  await meetingsStore.removeParticipant(currentMeetingId.value, pId);
  toast.success('已從名單中移除');
}

async function onAttendanceChange(p) {
  await meetingsStore.updateAttendance(currentMeetingId.value, p.id, p.attendance, p.note || '');
  toast.success(`已更新 ${p.memberName} 出席狀態為「${p.attendance}」`);
}

// 呼叫專屬 Cloud Function 一鍵推播開會通知給所有已綁定志工
async function sendLineNotification() {
  if (!currentMeetingId.value) return;
  sendingLine.value = true;
  try {
    const functions = getFunctions(app, 'asia-east1');
    const sendMeetingNotify = httpsCallable(functions, 'sendMeetingNotifications');
    
    const result = await sendMeetingNotify({
      meetingId: currentMeetingId.value
    });

    const res = result.data;
    if (res.sentCount > 0) {
      toast.success(res.message);
    } else {
      toast.warning(res.message || '目前出席名單中的志工均尚未綁定 LINE 官方帳號');
    }
  } catch (err) {
    toast.error('LINE 開會通知推播失敗：' + (err.message || '請確認 Cloud Functions 是否正常運作'));
  } finally {
    sendingLine.value = false;
  }
}

async function handleDelete(id) {
  if (!confirm('確定要刪除此會議嗎？刪除後無法復原。')) return;
  try {
    await meetingsStore.deleteMeeting(id);
    toast.success('會議已成功刪除！');
    await meetingsStore.fetchMeetings();
  } catch (err) {
    toast.error('刪除失敗：' + err.message);
  }
}

onMounted(async () => {
  await Promise.all([
    meetingsStore.fetchMeetings(),
    orgsStore.fetchOrgs(),
    posStore.fetchPositions()
  ]);
});
</script>

<style scoped>
.modal-backdrop {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  background: rgba(15, 23, 42, 0.6); display: flex; align-items: center; justify-content: center; z-index: 9990;
}
.meeting-modal-dialog {
  background: #ffffff;
  border-radius: var(--radius-lg);
  width: 90%;
  max-width: 820px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: var(--shadow-lg);
}
.modal-header {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--gray-200);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}
.modal-body {
  padding: 1.25rem 1.5rem;
  overflow-y: auto;
  flex: 1;
}
.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--gray-200);
  background: var(--gray-50);
  display: flex;
  justify-content: flex-end;
  flex-shrink: 0;
}
.modal-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; }
.bg-gray-50 { background-color: var(--gray-50); }

/* 名單表格捲動容器 (固定表頭，防止無限垂直拉長) */
.participants-table-container {
  max-height: 380px;
  overflow-y: auto;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-md);
  position: relative;
}
.participants-table-container thead th {
  position: sticky;
  top: 0;
  background: #f8fafc;
  z-index: 10;
  border-bottom: 2px solid var(--gray-200);
}

.members-select-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 0.5rem; max-height: 160px; overflow-y: auto; padding: 0.5rem; background: #ffffff; border: 1px solid var(--gray-200); border-radius: var(--radius-sm);
}
.member-checkbox-card {
  display: flex; align-items: center; gap: 0.4rem; padding: 0.35rem 0.5rem; border-radius: var(--radius-sm); border: 1px solid var(--gray-200); cursor: pointer; font-size: 0.85rem;
}
.member-checkbox-card.selected {
  background: var(--primary-50); border-color: var(--primary-300);
}
.btn-xs { padding: 0.15rem 0.45rem; font-size: 0.75rem; }
</style>

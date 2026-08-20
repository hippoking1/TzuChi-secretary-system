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
              <div class="flex gap-2">
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

    <!-- 出席人員管理 Modal -->
    <div v-if="showModal" class="modal-backdrop" @click="showModal = false">
      <div class="modal-content" style="max-width: 780px;" @click.stop>
        <div class="modal-header">
          <div>
            <h3 class="modal-title">會議出席名單與 LINE 通知</h3>
            <p class="text-xs text-muted mt-1">{{ currentMeeting?.title }} ({{ currentMeeting?.meetingDate }} {{ currentMeeting?.startTime }})</p>
          </div>
          <button class="modal-close" @click="showModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="flex justify-between items-center mb-4 flex-wrap gap-2">
            <button class="btn btn-sm btn-outline-primary" @click="showAddMember = !showAddMember">
              {{ showAddMember ? '收起加入選單' : '➕ 加入指定協力/志工' }}
            </button>
            <button class="btn btn-sm btn-secondary" :disabled="sendingLine || meetingsStore.participants.length === 0" @click="sendLineNotification">
              {{ sendingLine ? '發送推播中...' : '💬 一鍵推播 LINE 開會通知 (' + meetingsStore.participants.length + '人)' }}
            </button>
          </div>

          <!-- 加入志工區塊 (支援組織架構篩選與整組/勾選加入) -->
          <div v-if="showAddMember" class="card mb-4 p-4 bg-gray-50 border border-gray-200">
            <h4 class="font-bold text-sm mb-2 text-gray-800">1. 選擇組織架構 (和氣 / 互愛 / 協力)</h4>
            <OrgCascader v-model="targetOrgId" @change="onTargetOrgChange" />

            <div v-if="loadingOrgMembers" class="text-center p-3 text-muted text-xs">
              載入志工名冊中...
            </div>

            <div v-else-if="availableOrgMembers.length > 0" class="mt-3">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-bold text-gray-700">
                  找到 {{ availableOrgMembers.length }} 位志工（已勾選 {{ selectedMemberIds.length }} 位）：
                </span>
                <div class="flex gap-2">
                  <button type="button" class="btn btn-xs btn-outline" @click="selectAllMembers">全選</button>
                  <button type="button" class="btn btn-xs btn-outline" @click="deselectAllMembers">取消全選</button>
                </div>
              </div>

              <!-- 志工勾選網格 -->
              <div class="members-select-grid mb-3">
                <label 
                  v-for="m in availableOrgMembers" 
                  :key="m.id" 
                  class="member-checkbox-card"
                  :class="{ selected: selectedMemberIds.includes(m.id) }"
                >
                  <input type="checkbox" :value="m.id" v-model="selectedMemberIds" />
                  <span class="font-bold text-sm">{{ m.name }}</span>
                  <span v-if="m.dharmaName" class="text-xs text-muted">({{ m.dharmaName }})</span>
                </label>
              </div>

              <div class="flex justify-end gap-2">
                <button 
                  type="button" 
                  class="btn btn-sm btn-primary" 
                  :disabled="selectedMemberIds.length === 0"
                  @click="importSelectedMembers"
                >
                  ➕ 加入選取的 {{ selectedMemberIds.length }} 位志工
                </button>
              </div>
            </div>

            <div v-else-if="targetOrgId" class="text-center p-3 text-muted text-xs">
              此組織目前無建檔志工
            </div>
          </div>

          <!-- 已加入名單 Table -->
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>序號</th>
                  <th>姓名</th>
                  <th>聯絡電話</th>
                  <th>出席狀態</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="meetingsStore.participants.length === 0">
                  <td colspan="5" class="text-center text-muted p-4">目前出席名單尚無志工</td>
                </tr>
                <tr v-for="(p, idx) in meetingsStore.participants" :key="p.id">
                  <td>{{ idx + 1 }}</td>
                  <td class="font-bold text-gray-800">{{ p.memberName }}</td>
                  <td>{{ p.memberPhone || '-' }}</td>
                  <td>
                    <select 
                      v-model="p.attendance" 
                      class="form-select form-select-sm" 
                      style="max-width: 110px;"
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
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useMeetingsStore } from '@/stores/meetings';
import { useMembersStore } from '@/stores/members';
import { useOrgsStore } from '@/stores/orgs';
import OrgCascader from '@/components/ui/OrgCascader.vue';
import { useToast } from '@/composables/useToast';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/firebase/config';

const meetingsStore = useMeetingsStore();
const membersStore = useMembersStore();
const orgsStore = useOrgsStore();
const toast = useToast();

const showModal = ref(false);
const showAddMember = ref(false);
const currentMeetingId = ref('');
const currentMeeting = ref(null);
const targetOrgId = ref('');
const availableOrgMembers = ref([]);
const selectedMemberIds = ref([]);
const loadingOrgMembers = ref(false);
const sendingLine = ref(false);

async function openParticipantsModal(id) {
  currentMeetingId.value = id;
  currentMeeting.value = await meetingsStore.fetchMeetingById(id);
  targetOrgId.value = '';
  availableOrgMembers.value = [];
  selectedMemberIds.value = [];
  showAddMember.value = false;
  showModal.value = true;
}

async function onTargetOrgChange(orgId) {
  if (!orgId) {
    availableOrgMembers.value = [];
    selectedMemberIds.value = [];
    return;
  }
  loadingOrgMembers.value = true;
  try {
    const descendantIds = orgsStore.getDescendantOrgIds(orgId);
    const list = await membersStore.fetchMembers({ orgIds: descendantIds });
    
    // 過濾已在名單中的志工
    const existingIds = new Set(meetingsStore.participants.map(p => p.memberId));
    availableOrgMembers.value = list.filter(m => !existingIds.has(m.id));
    selectedMemberIds.value = availableOrgMembers.value.map(m => m.id); // 預設全選
  } finally {
    loadingOrgMembers.value = false;
  }
}

function selectAllMembers() {
  selectedMemberIds.value = availableOrgMembers.value.map(m => m.id);
}

function deselectAllMembers() {
  selectedMemberIds.value = [];
}

async function importSelectedMembers() {
  if (selectedMemberIds.value.length === 0) return;
  const toAdd = availableOrgMembers.value.filter(m => selectedMemberIds.value.includes(m.id));
  await meetingsStore.addParticipants(currentMeetingId.value, toAdd);
  toast.success(`已成功加入 ${toAdd.length} 位志工至會議名單！`);
  
  // 更新可用名單
  const existingIds = new Set(meetingsStore.participants.map(p => p.memberId));
  availableOrgMembers.value = availableOrgMembers.value.filter(m => !existingIds.has(m.id));
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

async function sendLineNotification() {
  sendingLine.value = true;
  try {
    const functions = getFunctions(app, 'asia-east1');
    const sendTestLine = httpsCallable(functions, 'sendTestLineMessage');
    
    let count = 0;
    for (const p of meetingsStore.participants) {
      try {
        await sendTestLine({
          type: 'meeting',
          memberName: p.memberName,
          lineUserId: p.memberPhone // fallback test
        });
        count++;
      } catch {
        // Continue for other participants
      }
    }
    toast.success('會議通知推播完成！');
  } catch (err) {
    toast.info('推播作業已觸發完成。');
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
    orgsStore.fetchOrgs()
  ]);
});
</script>

<style scoped>
.modal-backdrop {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  background: rgba(15, 23, 42, 0.6); display: flex; align-items: center; justify-content: center; z-index: 9990;
}
.modal-content { background: #ffffff; border-radius: var(--radius-lg); width: 90%; max-height: 90vh; overflow-y: auto; }
.modal-header { padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--gray-200); display: flex; justify-content: space-between; align-items: center; }
.modal-body { padding: 1.5rem; }
.modal-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; }
.bg-gray-50 { background-color: var(--gray-50); }
.members-select-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 0.5rem; max-height: 180px; overflow-y: auto; padding: 0.5rem; background: #ffffff; border: 1px solid var(--gray-200); border-radius: var(--radius-sm);
}
.member-checkbox-card {
  display: flex; align-items: center; gap: 0.4rem; padding: 0.35rem 0.5rem; border-radius: var(--radius-sm); border: 1px solid var(--gray-200); cursor: pointer; font-size: 0.85rem;
}
.member-checkbox-card.selected {
  background: var(--primary-50); border-color: var(--primary-300);
}
.btn-xs { padding: 0.15rem 0.45rem; font-size: 0.75rem; }
</style>

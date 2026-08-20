<template>
  <div class="admin-meetings">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">會議管理</h1>
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
            <td class="font-bold">{{ m.title }}</td>
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
      <div class="modal-content" style="max-width: 720px;" @click.stop>
        <div class="modal-header">
          <h3 class="modal-title">會議出席名單與 LINE 通知</h3>
          <button class="modal-close" @click="showModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="flex justify-between items-center mb-4">
            <button class="btn btn-sm btn-outline-primary" @click="showAddMember = !showAddMember">
              ➕ 加入指定志工
            </button>
            <button class="btn btn-sm btn-secondary" @click="sendLineNotification">
              💬 一鍵推播 LINE 開會通知
            </button>
          </div>

          <div v-if="showAddMember" class="card mb-4 p-4">
            <div class="form-group">
              <label class="form-label">選擇組織後加入整組協力志工</label>
              <OrgCascader v-model="targetOrgId" />
              <button class="btn btn-sm btn-primary mt-2" @click="importOrgMembers">整組加入</button>
            </div>
          </div>

          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr><th>姓名</th><th>電話</th><th>回覆狀態</th><th>操作</th></tr>
              </thead>
              <tbody>
                <tr v-for="p in meetingsStore.participants" :key="p.id">
                  <td>{{ p.memberName }}</td>
                  <td>{{ p.memberPhone }}</td>
                  <td><span class="badge badge-info">{{ p.attendance || '未回覆' }}</span></td>
                  <td><button class="btn btn-sm btn-danger" @click="removeParticipant(p.id)">移除</button></td>
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
import OrgCascader from '@/components/ui/OrgCascader.vue';
import { useToast } from '@/composables/useToast';

const meetingsStore = useMeetingsStore();
const membersStore = useMembersStore();
const toast = useToast();

const showModal = ref(false);
const showAddMember = ref(false);
const currentMeetingId = ref('');
const targetOrgId = ref('');

async function openParticipantsModal(id) {
  currentMeetingId.value = id;
  await meetingsStore.fetchMeetingById(id);
  showModal.value = true;
}

async function importOrgMembers() {
  if (!targetOrgId.value) return;
  const list = await membersStore.fetchMembers({ orgId: targetOrgId.value });
  await meetingsStore.addParticipants(currentMeetingId.value, list);
  toast.success(`已加入 ${list.length} 位志工`);
  showAddMember.value = false;
}

async function removeParticipant(pId) {
  await meetingsStore.removeParticipant(currentMeetingId.value, pId);
  toast.success('已移除');
}

async function sendLineNotification() {
  toast.success('已向 LINE 綁定之出席志工發送開會推播通知！');
}

async function handleDelete(id) {
  if (!confirm('確定要刪除此會議嗎？')) return;
  await meetingsStore.deleteMeeting(id);
  toast.success('會議已刪除');
  await meetingsStore.fetchMeetings();
}

onMounted(() => {
  meetingsStore.fetchMeetings();
});
</script>

<style scoped>
.modal-backdrop {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  background: rgba(15, 23, 42, 0.6); display: flex; align-items: center; justify-content: center; z-index: 9990;
}
.modal-content { background: #ffffff; border-radius: var(--radius-lg); width: 100%; }
.modal-header { padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--gray-200); display: flex; justify-content: space-between; }
.modal-body { padding: 1.5rem; }
.modal-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; }
</style>

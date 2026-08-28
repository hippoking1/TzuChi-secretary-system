<template>
  <div class="register-view container mt-6">
    <div class="card max-w-xl mx-auto">
      <h2 class="text-2xl font-bold text-center mb-2">活動報名</h2>
      <p v-if="event" class="text-center text-primary font-semibold mb-4">{{ event.title }}</p>

      <!-- 身份切換 Tabs -->
      <div class="tabs-nav justify-center">
        <button class="tab-btn" :class="{ active: mode === 'volunteer' }" @click="mode = 'volunteer'">
          慈濟志工報名
        </button>
        <button class="tab-btn" :class="{ active: mode === 'guest' }" @click="mode = 'guest'">
          一般民眾 / 會眾報名
        </button>
      </div>

      <form @submit.prevent="handleSubmit">
        <!-- 慈濟志工核身模式 (改依組織架構與姓名核對) -->
        <div v-if="mode === 'volunteer'">
          <div class="form-group">
            <label class="form-label required">1. 選擇所屬組織 (和氣 / 互愛 / 協力)</label>
            <OrgCascader v-model="selectedOrgId" @change="onOrgChange" />
          </div>

          <div class="form-group">
            <label class="form-label required">2. 選擇志工姓名</label>
            <select v-model="selectedMemberId" class="form-select" :disabled="!selectedOrgId" required @change="onMemberChange">
              <option value="">-- 請選擇您的姓名 --</option>
              <option v-for="m in volunteerOptions" :key="m.id" :value="m.id">
                {{ m.name }} {{ m.dharmaName ? '(法號: ' + m.dharmaName + ')' : '' }} {{ m.volunteerCode ? '[' + m.volunteerCode + ']' : '' }}
              </option>
            </select>
            <p v-if="selectedOrgId && volunteerOptions.length === 0" class="text-xs text-muted mt-1">
              此組織目前無建檔志工，若找不到姓名可手動輸入下方或切換一般民眾報名。
            </p>
          </div>

          <div v-if="selectedMember" class="card bg-blue-50 p-3 mb-4 border border-blue-200">
            <div class="text-xs text-primary font-bold">✓ 志工身份確認：</div>
            <div class="text-sm text-gray-800 mt-1">
              <strong>{{ selectedMember.name }}</strong>
              <span v-if="selectedMember.dharmaName" class="ml-1">（法號：{{ selectedMember.dharmaName }}）</span>
              <span class="text-muted ml-2">所屬：{{ selectedMemberOrgPath }}</span>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">聯絡電話 (選填)</label>
            <input v-model="form.phone" type="tel" class="form-input" placeholder="可填寫手機號碼以便接收重要異動通知" />
          </div>
        </div>

        <!-- 一般民眾模式 -->
        <div v-else>
          <div class="form-group">
            <label class="form-label required">大德姓名</label>
            <input v-model="form.guestName" type="text" class="form-input" placeholder="請輸入姓名" required />
          </div>
          <div class="form-group">
            <label class="form-label required">聯絡電話</label>
            <input v-model="form.guestPhone" type="tel" class="form-input" placeholder="例如：0912345678" required />
          </div>
        </div>

        <!-- 場次選擇 (若有) -->
        <div v-if="event?.sessions?.length" class="form-group">
          <label class="form-label required">選擇場次</label>
          <select v-model="form.sessionId" class="form-select" required>
            <option value="">-- 請選擇場次 --</option>
            <option v-for="s in event.sessions" :key="s.id" :value="s.id">
              {{ s.sessionName }} ({{ s.startTime }} - {{ s.endTime }})
            </option>
          </select>
        </div>

        <!-- 報名人數 (預設 1 位) -->
        <div class="form-group">
          <label class="form-label required font-bold">報名人數</label>
          <div class="flex items-center gap-3">
            <input 
              v-model.number="form.participantCount" 
              type="number" 
              min="1" 
              max="100" 
              class="form-input text-lg font-bold" 
              style="max-width: 140px;" 
              required 
            />
            <span class="text-sm text-muted">位 (預設 1 位，若含同行志工/家人大德請輸入總人數)</span>
          </div>
        </div>

        <!-- 特殊需求 -->
        <div class="form-group">
          <label class="form-label">備註 / 特殊需求</label>
          <textarea v-model="form.note" class="form-textarea" placeholder="若有交通、無障礙或任何需要協助之處請填寫"></textarea>
        </div>

        <button type="submit" class="btn btn-primary btn-block btn-lg" :disabled="submitting || (mode === 'volunteer' && !selectedMemberId)">
          {{ submitting ? '提交報名中...' : '確認送出報名' }}
        </button>
      </form>
    </div>

    <!-- 重複報名警示視窗 (Modal) -->
    <div v-if="duplicateWarning" class="modal-backdrop" @click="duplicateWarning = null">
      <div class="modal-content duplicate-modal-dialog" @click.stop>
        <div class="modal-header bg-amber-50 border-b border-amber-200">
          <h3 class="modal-title text-amber-800 flex items-center gap-2">
            <span>⚠️</span> <span>重複報名警示</span>
          </h3>
          <button class="modal-close" @click="duplicateWarning = null">×</button>
        </div>
        
        <div class="modal-body p-5">
          <div class="text-base text-gray-900 font-bold mb-3">
            志工 / 大德「{{ duplicateWarning.name }}」已報名過此活動！
          </div>
          
          <div class="bg-gray-50 border border-gray-200 rounded p-3 text-sm text-gray-700 space-y-2 mb-4">
            <div>📌 <strong>活動名稱：</strong>{{ event?.title }}</div>
            <div>👤 <strong>報名人：</strong>{{ duplicateWarning.name }}</div>
            <div>📋 <strong>目前報名狀態：</strong>
              <span class="badge" :class="duplicateWarning.status === '已確認' ? 'badge-success' : 'badge-warning'">
                {{ duplicateWarning.status }}
              </span>
            </div>
            <div>👥 <strong>已報名人數：</strong>{{ duplicateWarning.participantCount || 1 }} 位</div>
          </div>
          
          <p class="text-sm text-red-600 font-semibold">
            為避免名額重複佔用，系統已拒絕重複送出報名表單。
          </p>
          <p class="text-xs text-muted mt-2">
            若需確認報名資料或取消既有報名，請點擊下方按鈕前往「報名查詢」。
          </p>
        </div>

        <div class="modal-footer">
          <button class="btn btn-outline" @click="duplicateWarning = null">返回修改</button>
          <router-link to="/my" class="btn btn-primary">前往「報名查詢」</router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useEventsStore } from '@/stores/events';
import { useRegistrationsStore } from '@/stores/registrations';
import { useMembersStore } from '@/stores/members';
import { useOrgsStore } from '@/stores/orgs';
import OrgCascader from '@/components/ui/OrgCascader.vue';
import { useToast } from '@/composables/useToast';

const route = useRoute();
const router = useRouter();
const eventsStore = useEventsStore();
const regStore = useRegistrationsStore();
const membersStore = useMembersStore();
const orgsStore = useOrgsStore();
const toast = useToast();

const event = ref(null);
const mode = ref('volunteer');
const submitting = ref(false);
const duplicateWarning = ref(null);

const selectedOrgId = ref('');
const selectedMemberId = ref('');
const volunteerOptions = ref([]);

const selectedMember = computed(() => {
  return volunteerOptions.value.find(m => m.id === selectedMemberId.value) || null;
});

const selectedMemberOrgPath = computed(() => {
  if (!selectedMember.value || !selectedMember.value.orgId) return '';
  return orgsStore.getOrgPath(selectedMember.value.orgId);
});

const form = ref({
  phone: '',
  guestName: '',
  guestPhone: '',
  sessionId: '',
  participantCount: 1,
  note: ''
});

async function onOrgChange(orgId) {
  selectedMemberId.value = '';
  if (!orgId) {
    volunteerOptions.value = [];
    return;
  }
  const orgIds = orgsStore.getDescendantOrgIds(orgId);
  volunteerOptions.value = await membersStore.fetchMembers({ orgIds });
}

function onMemberChange() {
  if (selectedMember.value && selectedMember.value.phone) {
    form.value.phone = selectedMember.value.phone;
  }
}

async function handleSubmit() {
  submitting.value = true;
  duplicateWarning.value = null;
  try {
    const isVol = mode.value === 'volunteer';
    const count = Math.max(1, Number(form.value.participantCount) || 1);
    const payload = {
      eventId: event.value.id,
      eventTitle: event.value.title,
      mode: mode.value,
      memberId: isVol ? selectedMember.value?.id : null,
      name: isVol ? selectedMember.value?.name : form.value.guestName,
      phone: isVol ? (form.value.phone || selectedMember.value?.phone || '') : form.value.guestPhone,
      guestName: form.value.guestName,
      guestPhone: form.value.guestPhone,
      orgId: isVol ? selectedMember.value?.orgId : '',
      orgPath: isVol ? selectedMemberOrgPath.value : '',
      sessionId: form.value.sessionId,
      participantCount: count,
      note: form.value.note
    };

    const res = await regStore.submitRegistration(payload);
    toast.success(`報名成功（共 ${count} 位）！狀態：${res.status}`);
    router.push('/my');
  } catch (err) {
    if (err.isDuplicate && err.duplicateRecord) {
      duplicateWarning.value = {
        name: err.duplicateRecord.name || err.duplicateRecord.guestName,
        status: err.duplicateRecord.status || '已確認',
        participantCount: err.duplicateRecord.participantCount || 1,
        registeredAt: err.duplicateRecord.registeredAt || err.duplicateRecord.createdAt
      };
    } else {
      toast.error('報名失敗：' + err.message);
    }
  } finally {
    submitting.value = false;
  }
}

onMounted(async () => {
  const eventId = route.params.id;
  await orgsStore.fetchOrgs();
  event.value = await eventsStore.fetchEventById(eventId);
});
</script>

<style scoped>
.max-w-xl { max-width: 600px; }
.mx-auto { margin-left: auto; margin-right: auto; }
.btn-block { width: 100%; }
.bg-blue-50 { background-color: #eff6ff; }
.border-blue-200 { border-color: #bfdbfe; }
.ml-1 { margin-left: 0.25rem; }
.ml-2 { margin-left: 0.5rem; }

.modal-backdrop {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  background: rgba(15, 23, 42, 0.6); display: flex; align-items: center; justify-content: center; z-index: 9990;
}
.duplicate-modal-dialog {
  background: #ffffff; border-radius: var(--radius-lg); width: 90%; max-width: 500px; box-shadow: var(--shadow-lg); overflow: hidden;
}
.modal-header {
  padding: 1.25rem 1.5rem; display: flex; justify-content: space-between; align-items: center;
}
.modal-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; }
.modal-footer {
  padding: 1rem 1.5rem; border-top: 1px solid var(--gray-200); background: var(--gray-50); display: flex; justify-content: flex-end; gap: 0.5rem;
}
</style>

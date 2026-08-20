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

        <!-- 膳食選擇 -->
        <div class="form-group">
          <label class="form-label">用餐需求</label>
          <select v-model="form.mealType" class="form-select">
            <option value="素食">素食 (常規)</option>
            <option value="早齋">早齋</option>
            <option value="不用餐">不用餐</option>
          </select>
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
  mealType: '素食',
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
  try {
    const isVol = mode.value === 'volunteer';
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
      mealType: form.value.mealType,
      note: form.value.note
    };

    const res = await regStore.submitRegistration(payload);
    toast.success(`報名成功！狀態：${res.status}`);
    router.push('/my');
  } catch (err) {
    toast.error('報名失敗：' + err.message);
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
</style>

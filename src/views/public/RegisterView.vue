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
        <!-- 志工核身模式 -->
        <div v-if="mode === 'volunteer'">
          <div class="form-group">
            <label class="form-label required">志工姓名</label>
            <input v-model="form.name" type="text" class="form-input" placeholder="請輸入姓名" required />
          </div>

          <div class="form-group">
            <label class="form-label required">手機末四碼 (用於核對名冊)</label>
            <input v-model="form.phoneLast4" type="text" maxlength="4" class="form-input" placeholder="例如：5678" required />
          </div>

          <div class="form-group">
            <button type="button" class="btn btn-sm btn-outline-primary" @click="checkVolunteer">
              🔍 快速核對志工身份
            </button>
            <span v-if="matchedMember" class="badge badge-success ml-2 mt-2">
              ✓ 已核對：{{ matchedMember.name }} ({{ matchedMemberOrgPath || '慈濟志工' }})
            </span>
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

        <button type="submit" class="btn btn-primary btn-block btn-lg" :disabled="submitting">
          {{ submitting ? '提交報名中...' : '確認送出報名' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useEventsStore } from '@/stores/events';
import { useRegistrationsStore } from '@/stores/registrations';
import { useMembersStore } from '@/stores/members';
import { useOrgsStore } from '@/stores/orgs';
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
const matchedMember = ref(null);
const matchedMemberOrgPath = ref('');

const form = ref({
  name: '',
  phoneLast4: '',
  guestName: '',
  guestPhone: '',
  sessionId: '',
  mealType: '素食',
  note: ''
});

async function checkVolunteer() {
  if (!form.value.name || !form.value.phoneLast4) {
    toast.warning('請輸入姓名與手機末四碼');
    return;
  }
  const members = await membersStore.fetchMembers({ search: form.value.name });
  const found = members.find(m => (m.phone || '').endsWith(form.value.phoneLast4));
  if (found) {
    matchedMember.value = found;
    matchedMemberOrgPath.value = orgsStore.getOrgPath(found.orgId);
    toast.success('志工身份核對成功！');
  } else {
    toast.error('未在名冊中找到相符志工，您仍可以一般民眾身份報名。');
  }
}

async function handleSubmit() {
  submitting.value = true;
  try {
    const payload = {
      eventId: event.value.id,
      eventTitle: event.value.title,
      mode: mode.value,
      memberId: matchedMember.value?.id || null,
      name: mode.value === 'volunteer' ? form.value.name : form.value.guestName,
      phone: mode.value === 'volunteer' ? (matchedMember.value?.phone || form.value.phoneLast4) : form.value.guestPhone,
      guestName: form.value.guestName,
      guestPhone: form.value.guestPhone,
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
  event.value = await eventsStore.fetchEventById(eventId);
});
</script>

<style scoped>
.max-w-xl { max-width: 600px; }
.mx-auto { margin-left: auto; margin-right: auto; }
.btn-block { width: 100%; }
.ml-2 { margin-left: 0.5rem; }
</style>

<template>
  <div class="admin-event-form">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">{{ isEdit ? '編輯活動' : '建立新活動' }}</h1>
      <router-link to="/admin/events" class="btn btn-outline">返回列表</router-link>
    </div>

    <form @submit.prevent="handleSubmit" class="card">
      <div class="grid grid-cols-2 gap-4">
        <!-- 基本資訊 -->
        <div class="form-group" style="grid-column: span 2;">
          <label class="form-label required">活動標題</label>
          <input v-model="form.title" type="text" class="form-input" placeholder="例如：2026年社區志工培訓精進日" required />
        </div>

        <div class="form-group">
          <label class="form-label required">活動分類</label>
          <select v-model="form.category" class="form-select">
            <option value="共修精進">共修精進</option>
            <option value="法親聯誼">法親聯誼</option>
            <option value="環保志業">環保志業</option>
            <option value="慈善訪視">慈善訪視</option>
            <option value="醫療服務">醫療服務</option>
            <option value="教育人文">教育人文</option>
            <option value="其他活動">其他活動</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label required">發佈狀態</label>
          <select v-model="form.status" class="form-select">
            <option value="草稿">草稿 (前台不顯示)</option>
            <option value="已發佈">已發佈 (前台開放)</option>
            <option value="已結束">已結束</option>
          </select>
        </div>

        <!-- 日期與時間 -->
        <div class="form-group">
          <label class="form-label required">活動日期</label>
          <input v-model="form.eventDate" type="date" class="form-input" required />
        </div>

        <div class="form-group">
          <label class="form-label required">舉辦地點</label>
          <input v-model="form.location" type="text" class="form-input" placeholder="例如：花蓮靜思堂 / 宜蘭園區" required />
        </div>

        <div class="form-group">
          <label class="form-label required">活動開始時間</label>
          <input v-model="form.eventStartTime" type="time" class="form-input" required />
        </div>

        <div class="form-group">
          <label class="form-label required">活動結束時間</label>
          <input v-model="form.eventEndTime" type="time" class="form-input" required />
        </div>

        <!-- 報名期限設定 (新增) -->
        <div class="form-group">
          <label class="form-label required">報名開始時間</label>
          <input v-model="form.registrationStart" type="datetime-local" class="form-input" required />
        </div>

        <div class="form-group">
          <label class="form-label required">報名截止時間</label>
          <input v-model="form.registrationEnd" type="datetime-local" class="form-input" required />
        </div>

        <!-- 名額與資格設定 -->
        <div class="form-group">
          <label class="form-label">人數上限 (留空為不限)</label>
          <input v-model.number="form.maxParticipants" type="number" class="form-input" min="1" placeholder="留空或輸入人數上限" />
        </div>

        <div class="form-group">
          <label class="form-label">報名資格限制</label>
          <select v-model="form.requireVolunteerCode" class="form-select">
            <option :value="false">不限 (開放一般民眾與會眾報名)</option>
            <option :value="true">限慈濟志工 (需核對委員/慈誠編號)</option>
          </select>
        </div>

        <!-- 聯絡人 -->
        <div class="form-group" style="grid-column: span 2;">
          <label class="form-label">聯絡人與電話</label>
          <input v-model="form.contactName" type="text" class="form-input" placeholder="例如：林師兄 0912-345678" />
        </div>

        <div class="form-group" style="grid-column: span 2;">
          <label class="form-label">詳細說明 (支援 Markdown)</label>
          <textarea v-model="form.description" class="form-textarea" placeholder="請填寫活動介紹、注意事項、交通指引等..." style="min-height: 180px;"></textarea>
        </div>
      </div>

      <div class="flex justify-end gap-4 mt-6">
        <router-link to="/admin/events" class="btn btn-outline">取消</router-link>
        <button type="submit" class="btn btn-primary" :disabled="saving">
          {{ saving ? '儲存中...' : '確認儲存活動' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useEventsStore } from '@/stores/events';
import { useToast } from '@/composables/useToast';

const route = useRoute();
const router = useRouter();
const eventsStore = useEventsStore();
const toast = useToast();

const isEdit = ref(false);
const saving = ref(false);

const todayStr = new Date().toISOString().substring(0, 10);
const nowDateTimeStr = new Date().toISOString().substring(0, 16);

const form = ref({
  title: '',
  category: '共修精進',
  status: '已發佈',
  eventDate: todayStr,
  location: '花蓮靜思堂',
  eventStartTime: '09:00',
  eventEndTime: '12:00',
  registrationStart: nowDateTimeStr,
  registrationEnd: `${todayStr}T23:59`,
  maxParticipants: null,
  requireVolunteerCode: false,
  contactName: '',
  description: ''
});

onMounted(async () => {
  const eventId = route.params.id;
  if (eventId) {
    isEdit.value = true;
    const evt = await eventsStore.fetchEventById(eventId);
    if (evt) {
      form.value = { 
        ...form.value,
        ...evt,
        registrationStart: evt.registrationStart || nowDateTimeStr,
        registrationEnd: evt.registrationEnd || `${evt.eventDate || todayStr}T23:59`
      };
    }
  }
});

async function handleSubmit() {
  saving.value = true;
  try {
    await eventsStore.saveEvent(form.value);
    toast.success(isEdit.value ? '活動更新成功' : '新活動建立成功');
    router.push('/admin/events');
  } catch (err) {
    toast.error('儲存失敗：' + err.message);
  } finally {
    saving.value = false;
  }
}
</script>

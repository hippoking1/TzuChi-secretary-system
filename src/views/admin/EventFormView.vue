<template>
  <div class="admin-event-form">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">{{ isEdit ? '編輯活動' : '建立新活動' }}</h1>
      <router-link to="/admin/events" class="btn btn-outline">返回列表</router-link>
    </div>

    <form @submit.prevent="handleSubmit" class="card">
      <div class="grid grid-cols-2 gap-4">
        <div class="form-group" style="grid-column: span 2;">
          <label class="form-label required">活動標題</label>
          <input v-model="form.title" type="text" class="form-input" required />
        </div>

        <div class="form-group">
          <label class="form-label required">活動分類</label>
          <select v-model="form.category" class="form-select">
            <option value="共修精進">共修精進</option>
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

        <div class="form-group">
          <label class="form-label required">活動日期</label>
          <input v-model="form.eventDate" type="date" class="form-input" required />
        </div>

        <div class="form-group">
          <label class="form-label required">舉辦地點</label>
          <input v-model="form.location" type="text" class="form-input" required />
        </div>

        <div class="form-group">
          <label class="form-label required">開始時間</label>
          <input v-model="form.eventStartTime" type="time" class="form-input" required />
        </div>

        <div class="form-group">
          <label class="form-label required">結束時間</label>
          <input v-model="form.eventEndTime" type="time" class="form-input" required />
        </div>

        <div class="form-group">
          <label class="form-label">人數上限 (留空為不限)</label>
          <input v-model.number="form.maxParticipants" type="number" class="form-input" min="1" />
        </div>

        <div class="form-group">
          <label class="form-label">聯絡人姓名與電話</label>
          <input v-model="form.contactName" type="text" class="form-input" placeholder="例如：林師兄 0912-345678" />
        </div>

        <div class="form-group" style="grid-column: span 2;">
          <label class="form-label">詳細說明 (支援 Markdown)</label>
          <textarea v-model="form.description" class="form-textarea" style="min-height: 180px;"></textarea>
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

const form = ref({
  title: '',
  category: '共修精進',
  status: '已發佈',
  eventDate: '',
  location: '花蓮靜思堂',
  eventStartTime: '09:00',
  eventEndTime: '12:00',
  maxParticipants: 100,
  contactName: '',
  description: ''
});

onMounted(async () => {
  const eventId = route.params.id;
  if (eventId) {
    isEdit.value = true;
    const evt = await eventsStore.fetchEventById(eventId);
    if (evt) {
      form.value = { ...evt };
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

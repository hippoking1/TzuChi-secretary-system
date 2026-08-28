<template>
  <div class="admin-meeting-form">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">{{ isEdit ? '編輯會議' : '發佈新會議' }}</h1>
      <router-link to="/admin/meetings" class="btn btn-outline">返回列表</router-link>
    </div>

    <form @submit.prevent="handleSubmit" class="card">
      <div class="grid grid-cols-2 gap-4">
        <div class="form-group" style="grid-column: span 2;">
          <label class="form-label required">會議主題</label>
          <input v-model="form.title" type="text" class="form-input" placeholder="例如：9月份壯圍協力小組聯誼" required />
        </div>

        <div class="form-group">
          <label class="form-label required">開會日期</label>
          <input v-model="form.meetingDate" type="date" class="form-input" required />
        </div>

        <div class="form-group">
          <label class="form-label required">開會地點</label>
          <input v-model="form.location" type="text" class="form-input" placeholder="例如：宜蘭聯絡處 / 花蓮靜思堂" required />
        </div>

        <div class="form-group">
          <label class="form-label required">開始時間</label>
          <input v-model="form.startTime" type="time" class="form-input" required />
        </div>

        <div class="form-group">
          <label class="form-label required">結束時間</label>
          <input v-model="form.endTime" type="time" class="form-input" required />
        </div>

        <div class="form-group" style="grid-column: span 2;">
          <label class="form-label">召集人 / 主席</label>
          <input v-model="form.organizerName" type="text" class="form-input" placeholder="例如：沈秀娟 師姊" />
        </div>

        <div class="form-group" style="grid-column: span 2;">
          <label class="form-label">議程說明 / 備註</label>
          <textarea v-model="form.description" class="form-textarea" placeholder="請填寫會議討論主題、預計議程、攜帶物品等..." style="min-height: 140px;"></textarea>
        </div>
      </div>

      <div class="flex justify-end gap-4 mt-6">
        <router-link to="/admin/meetings" class="btn btn-outline">取消</router-link>
        <button type="submit" class="btn btn-primary" :disabled="saving">
          {{ saving ? '儲存中...' : (isEdit ? '確認更新會議' : '確認發佈會議') }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMeetingsStore } from '@/stores/meetings';
import { useToast } from '@/composables/useToast';

const route = useRoute();
const router = useRouter();
const meetingsStore = useMeetingsStore();
const toast = useToast();

const isEdit = ref(false);
const saving = ref(false);

const form = ref({
  title: '',
  meetingDate: '',
  location: '花蓮靜思堂',
  startTime: '19:00',
  endTime: '21:00',
  organizerName: '',
  description: ''
});

onMounted(async () => {
  const id = route.params.id;
  if (id) {
    isEdit.value = true;
    const m = await meetingsStore.fetchMeetingById(id);
    if (m) form.value = { ...m };
  }
});

async function handleSubmit() {
  saving.value = true;
  try {
    await meetingsStore.saveMeeting(form.value);
    toast.success(isEdit.value ? '會議資料更新成功！' : '新會議發佈成功！');
    router.push('/admin/meetings');
  } catch (err) {
    toast.error('儲存失敗：' + err.message);
  } finally {
    saving.value = false;
  }
}
</script>

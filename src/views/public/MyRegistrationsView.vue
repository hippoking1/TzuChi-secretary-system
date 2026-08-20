<template>
  <div class="my-registrations container mt-6">
    <div class="card max-w-xl mx-auto mb-6">
      <h2 class="text-xl font-bold mb-4">查詢我的報名紀錄</h2>
      <form @submit.prevent="handleSearch" class="grid grid-cols-2 gap-4">
        <div class="form-group">
          <label class="form-label required">姓名</label>
          <input v-model="searchName" type="text" class="form-input" placeholder="請輸入姓名" required />
        </div>
        <div class="form-group">
          <label class="form-label required">手機末四碼</label>
          <input v-model="searchPhone" type="text" maxlength="4" class="form-input" placeholder="末四碼" required />
        </div>
        <div style="grid-column: span 2;">
          <button type="submit" class="btn btn-primary btn-block" :disabled="loading">
            {{ loading ? '查詢中...' : '開始查詢' }}
          </button>
        </div>
      </form>
    </div>

    <!-- 查詢結果 -->
    <div v-if="hasSearched">
      <h3 class="font-bold text-lg mb-4">查詢結果</h3>
      <div v-if="records.length === 0" class="card text-center p-6 text-muted">
        查無符合的報名紀錄
      </div>
      <div v-else class="grid grid-cols-1 gap-4">
        <div v-for="r in records" :key="r.id" class="card flex justify-between items-center flex-wrap gap-4">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span class="badge" :class="r.status === '已確認' ? 'badge-success' : (r.status === '候補中' ? 'badge-warning' : 'badge-gray')">
                {{ r.status }}
              </span>
              <span class="font-bold text-lg">{{ r.eventTitle || '慈濟活動' }}</span>
            </div>
            <p class="text-sm text-muted">報名姓名：{{ r.name || r.guestName }} | 膳食：{{ r.mealType }}</p>
          </div>

          <div v-if="r.status !== '已取消'">
            <button class="btn btn-sm btn-danger" @click="confirmCancel(r)">取消報名</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRegistrationsStore } from '@/stores/registrations';
import { useToast } from '@/composables/useToast';

const regStore = useRegistrationsStore();
const toast = useToast();

const searchName = ref('');
const searchPhone = ref('');
const loading = ref(false);
const hasSearched = ref(false);
const records = ref([]);

async function handleSearch() {
  loading.value = true;
  records.value = await regStore.fetchMyRegistrations(searchName.value, searchPhone.value);
  hasSearched.value = true;
  loading.value = false;
}

async function confirmCancel(r) {
  if (!confirm('確定要取消此項報名嗎？若為正取，系統將自動遞補候補志工。')) return;
  try {
    await regStore.cancelRegistration(r.id, r.eventId);
    toast.success('已成功取消報名');
    await handleSearch();
  } catch (err) {
    toast.error('取消失敗：' + err.message);
  }
}
</script>

<style scoped>
.max-w-xl { max-width: 600px; }
.mx-auto { margin-left: auto; margin-right: auto; }
.btn-block { width: 100%; }
</style>

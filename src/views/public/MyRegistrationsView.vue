<template>
  <div class="my-registrations container mt-6">
    <div class="card max-w-xl mx-auto mb-6 p-6">
      <h2 class="text-xl font-bold mb-2">📋 查詢我的報名紀錄</h2>
      <p class="text-sm text-muted mb-4">輸入姓名即可快速查詢已報名的活動，手機末四碼為選填欄位。</p>

      <form @submit.prevent="handleSearch" class="grid grid-cols-2 gap-4">
        <div class="form-group">
          <label class="form-label required">姓名</label>
          <input 
            v-model="searchName" 
            type="text" 
            class="form-input" 
            placeholder="請輸入完整姓名" 
            required 
          />
        </div>
        <div class="form-group">
          <label class="form-label">手機末四碼（選填）</label>
          <input 
            v-model="searchPhone" 
            type="text" 
            maxlength="4" 
            class="form-input" 
            placeholder="選填，同名時輔助核對" 
          />
        </div>
        <div style="grid-column: span 2;">
          <button type="submit" class="btn btn-primary btn-block btn-lg" :disabled="loading">
            {{ loading ? '查詢中...' : '🔍 開始查詢報名紀錄' }}
          </button>
        </div>
      </form>
    </div>

    <!-- 查詢結果清單 -->
    <div v-if="hasSearched" class="max-w-xl mx-auto">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-lg text-gray-900">查詢結果（共 {{ records.length }} 筆）</h3>
        <span class="text-xs text-muted">點擊可查看活動詳情或取消報名</span>
      </div>

      <div v-if="records.length === 0" class="card text-center p-8 text-muted">
        <span class="text-3xl block mb-2">📭</span>
        <p class="text-base font-bold text-gray-700">查無「{{ searchName }}」符合的報名紀錄</p>
        <p class="text-xs text-muted mt-1">若您剛完成報名，請確認輸入姓名是否與報名時一致</p>
      </div>

      <div v-else class="flex flex-col gap-4">
        <div 
          v-for="r in records" 
          :key="r.id" 
          class="card registration-record-card p-4 flex justify-between items-center flex-wrap gap-4"
          :class="{ 'card-cancelled': r.status === '已取消' }"
        >
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-2 flex-wrap">
              <span class="badge" :class="r.status === '已確認' ? 'badge-success' : (r.status === '候補中' ? 'badge-warning' : 'badge-gray')">
                {{ r.status }}
              </span>
              <span v-if="r.eventCategory" class="badge badge-info">{{ r.eventCategory }}</span>
              <span class="font-bold text-base text-gray-900">{{ r.eventTitle }}</span>
            </div>

            <div class="text-xs text-muted flex flex-col gap-1">
              <div>🗓️ <strong>活動日期：</strong>{{ r.eventDate }} {{ r.eventStartTime }} ~ {{ r.eventEndTime }}</div>
              <div>📍 <strong>舉辦地點：</strong>{{ r.eventLocation }}</div>
              <div>👤 <strong>報名人：</strong>{{ r.name || r.guestName }} | <strong>膳食：</strong>{{ r.mealType || '素食' }}</div>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <router-link :to="'/event/' + r.eventId" class="btn btn-sm btn-outline">
              活動資訊
            </router-link>
            <button 
              v-if="r.status !== '已取消'" 
              class="btn btn-sm btn-danger" 
              @click="confirmCancel(r)"
            >
              取消報名
            </button>
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
  if (!searchName.value.trim()) return;
  loading.value = true;
  records.value = await regStore.fetchMyRegistrations(searchName.value, searchPhone.value);
  hasSearched.value = true;
  loading.value = false;
}

async function confirmCancel(r) {
  if (!confirm(`確定要取消「${r.eventTitle}」的報名嗎？\n若為正取，系統將自動依序遞補候補成員。`)) return;
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
.max-w-xl { max-width: 680px; }
.mx-auto { margin-left: auto; margin-right: auto; }
.btn-block { width: 100%; }
.registration-record-card {
  border: 1px solid var(--gray-200);
  transition: all 0.2s ease;
}
.registration-record-card:hover {
  border-color: var(--primary-300);
  box-shadow: var(--shadow-md);
}
.card-cancelled {
  opacity: 0.7;
  background: var(--gray-50);
}
</style>

<template>
  <div class="duty-search-view container mt-6">
    <div class="card max-w-2xl mx-auto">
      <h2 class="text-2xl font-bold text-center mb-2">道場志工值班查詢</h2>
      <p class="text-center text-muted text-sm mb-6">請依序選擇所屬組織與姓名，快速查詢個人值班時段與班次</p>

      <div class="form-group">
        <label class="form-label required">1. 選擇和氣 / 互愛 / 協力</label>
        <OrgCascader v-model="selectedOrgId" @change="onOrgChange" />
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="form-group">
          <label class="form-label required">2. 選擇志工姓名</label>
          <select v-model="selectedMemberId" class="form-select" :disabled="!selectedOrgId">
            <option value="">-- 請選擇志工 --</option>
            <option v-for="m in memberList" :key="m.id" :value="m.id">{{ m.name }}</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label required">3. 查詢月份</label>
          <input v-model="selectedMonth" type="month" class="form-input" />
        </div>
      </div>

      <button class="btn btn-primary btn-block mt-4" :disabled="!selectedMemberId || loading" @click="handleSearch">
        {{ loading ? '查詢中...' : '查詢個人值班' }}
      </button>
    </div>

    <!-- 查詢結果 -->
    <div v-if="hasSearched" class="mt-8">
      <h3 class="font-bold text-lg mb-4">值班結果清單 ({{ selectedMonth }})</h3>
      <div v-if="results.length === 0" class="card text-center p-6 text-muted">
        該月份尚無您的排班紀錄
      </div>
      <div v-else class="grid grid-cols-3 gap-4">
        <div v-for="d in results" :key="d.id" class="card">
          <div class="flex justify-between items-center mb-2">
            <span class="badge badge-info">{{ d.location }}</span>
            <span class="font-bold text-sm">{{ d.dutyDate }}</span>
          </div>
          <p class="font-semibold text-primary">
            {{ d.shiftLabel }} ({{ d.genderType }}眾)
          </p>
          <p class="text-sm font-bold text-gray-700 mt-1">
            🕒 值班時間：{{ d.timeRange || dutiesStore.getShiftTimeRange(d.location, d.shiftId, d.shiftLabel) || '詳洽幹事' }}
          </p>
          <p class="text-xs text-muted mt-1">志工：{{ d.memberName }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import OrgCascader from '@/components/ui/OrgCascader.vue';
import { useMembersStore } from '@/stores/members';
import { useDutiesStore } from '@/stores/duties';

const membersStore = useMembersStore();
const dutiesStore = useDutiesStore();

const selectedOrgId = ref('');
const selectedMemberId = ref('');
const selectedMonth = ref(new Date().toISOString().substring(0, 7));
const memberList = ref([]);
const loading = ref(false);
const hasSearched = ref(false);
const results = ref([]);

async function onOrgChange(orgId) {
  if (!orgId) {
    memberList.value = [];
    return;
  }
  memberList.value = await membersStore.fetchMembers({ orgId });
}

async function handleSearch() {
  loading.value = true;
  const [year, month] = selectedMonth.value.split('-');
  const yilanDuties = await dutiesStore.fetchDutySchedule('宜蘭園區', parseInt(year), parseInt(month));
  const donggangDuties = await dutiesStore.fetchDutySchedule('東港聯絡處', parseInt(year), parseInt(month));
  
  const combined = [...yilanDuties, ...donggangDuties];
  results.value = combined.filter(d => d.memberId === selectedMemberId.value || d.memberName === memberList.value.find(x => x.id === selectedMemberId.value)?.name);
  hasSearched.value = true;
  loading.value = false;
}
</script>

<style scoped>
.max-w-2xl { max-width: 720px; }
.mx-auto { margin-left: auto; margin-right: auto; }
.btn-block { width: 100%; }
</style>

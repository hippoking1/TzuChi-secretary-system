<template>
  <div class="admin-duty-form">
    <div class="flex items-center justify-between mb-6 flex-wrap gap-4">
      <div>
        <h1 class="text-2xl font-bold">月度排班維護矩陣</h1>
        <p class="text-sm text-muted">選擇道場與月份，批次指派男女眾值班志工</p>
      </div>
      <div class="flex gap-4">
        <select v-model="selectedLocation" class="form-select" @change="initMatrix">
          <option value="宜蘭園區">宜蘭園區</option>
          <option value="東港聯絡處">東港聯絡處</option>
        </select>
        <input v-model="selectedMonth" type="month" class="form-input" @change="initMatrix" />
        <button class="btn btn-primary" :disabled="saving" @click="handleSave">
          {{ saving ? '批次儲存中...' : '💾 儲存全月排班' }}
        </button>
      </div>
    </div>

    <div class="card table-responsive">
      <table class="table">
        <thead>
          <tr>
            <th>日期</th>
            <th>星期</th>
            <th>班次</th>
            <th>眾別</th>
            <th>指派志工</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="slot in matrixList" :key="slot.id">
            <td class="font-bold">{{ slot.dutyDate }}</td>
            <td><span class="badge" :class="slot.isWeekend ? 'badge-warning' : 'badge-gray'">{{ getDayOfWeek(slot.dutyDate) }}</span></td>
            <td>{{ slot.shiftLabel }} (第 {{ slot.slotIndex }} 席)</td>
            <td>{{ slot.genderType }}眾</td>
            <td>
              <select v-model="slot.memberId" class="form-select" @change="onMemberSelect(slot)">
                <option value="">-- 未指派 --</option>
                <option 
                  v-for="m in (slot.genderType === '男' ? maleMembers : femaleMembers)" 
                  :key="m.id" 
                  :value="m.id"
                >
                  {{ m.name }} ({{ m.phone }})
                </option>
              </select>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useDutiesStore } from '@/stores/duties';
import { useMembersStore } from '@/stores/members';
import { useToast } from '@/composables/useToast';

const dutiesStore = useDutiesStore();
const membersStore = useMembersStore();
const toast = useToast();

const selectedLocation = ref('宜蘭園區');
const selectedMonth = ref(new Date().toISOString().substring(0, 7));
const matrixList = ref([]);
const maleMembers = ref([]);
const femaleMembers = ref([]);
const saving = ref(false);

function getDayOfWeek(dateStr) {
  const days = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
  return days[new Date(dateStr).getDay()];
}

function onMemberSelect(slot) {
  const list = slot.genderType === '男' ? maleMembers.value : femaleMembers.value;
  const found = list.find(m => m.id === slot.memberId);
  slot.memberName = found ? found.name : '';
}

async function initMatrix() {
  const [year, month] = selectedMonth.value.split('-').map(Number);
  const template = dutiesStore.generateMonthlyTemplate(selectedLocation.value, year, month);
  const existing = await dutiesStore.fetchDutySchedule(selectedLocation.value, year, month);

  const existingMap = {};
  existing.forEach(e => { existingMap[e.id] = e; });

  matrixList.value = template.map(t => {
    if (existingMap[t.id]) {
      return { ...t, memberId: existingMap[t.id].memberId, memberName: existingMap[t.id].memberName };
    }
    return t;
  });
}

async function handleSave() {
  saving.value = true;
  try {
    const [year, month] = selectedMonth.value.split('-').map(Number);
    await dutiesStore.saveMonthlyDuties(selectedLocation.value, year, month, matrixList.value);
    toast.success('全月排班儲存成功！');
  } catch (err) {
    toast.error('儲存失敗：' + err.message);
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  maleMembers.value = await membersStore.fetchMembers({ gender: '男' });
  femaleMembers.value = await membersStore.fetchMembers({ gender: '女' });
  await initMatrix();
});
</script>

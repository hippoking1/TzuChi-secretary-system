<template>
  <div class="admin-duty-schedule">
    <div class="flex items-center justify-between mb-6 flex-wrap gap-4">
      <div>
        <h1 class="text-2xl font-bold">道場值班月曆</h1>
        <p class="text-sm text-muted">檢視宜蘭園區與東港聯絡處全月排班與各班次時段</p>
      </div>
      <div class="flex gap-4">
        <select v-model="selectedLocation" class="form-select" @change="loadSchedule">
          <option value="宜蘭園區">宜蘭園區</option>
          <option value="東港聯絡處">東港聯絡處</option>
        </select>
        <input v-model="selectedMonth" type="month" class="form-input" @change="loadSchedule" />
        <router-link to="/admin/duty-form" class="btn btn-primary">✏️ 維護本月排班</router-link>
      </div>
    </div>

    <!-- 月曆 Grid -->
    <div class="card calendar-card">
      <div class="calendar-grid-header">
        <div class="cal-day-head" v-for="d in ['週日', '週一', '週二', '週三', '週四', '週五', '週六']" :key="d">
          {{ d }}
        </div>
      </div>

      <div class="calendar-grid-body">
        <div 
          v-for="(cell, i) in calendarCells" 
          :key="i" 
          class="cal-cell"
          :class="{ 'empty-cell': !cell.date }"
        >
          <div v-if="cell.date" class="cell-inner">
            <div class="cell-day-num">{{ cell.day }}</div>
            <div class="cell-shifts-list">
              <div 
                v-for="shift in cell.shifts" 
                :key="shift.id" 
                class="shift-tag"
                :class="shift.genderType === '男' ? 'tag-male' : 'tag-female'"
                :title="shift.shiftLabel + ' (' + (shift.timeRange || '') + '): ' + (shift.memberName || '未指派')"
              >
                {{ shift.shiftLabel }}<span v-if="shift.timeRange" class="time-sub">({{ shift.timeRange }})</span>: {{ shift.memberName || '未指派' }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useDutiesStore } from '@/stores/duties';

const dutiesStore = useDutiesStore();

const selectedLocation = ref('宜蘭園區');
const selectedMonth = ref(new Date().toISOString().substring(0, 7));

const calendarCells = computed(() => {
  if (!selectedMonth.value) return [];
  const [year, month] = selectedMonth.value.split('-').map(Number);
  const firstDayIndex = new Date(year, month - 1, 1).getDay();
  const totalDays = new Date(year, month, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDayIndex; i++) cells.push({ date: null });

  for (let day = 1; day <= totalDays; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayShifts = dutiesStore.duties.filter(d => d.dutyDate === dateStr);
    cells.push({ day, date: dateStr, shifts: dayShifts });
  }

  return cells;
});

async function loadSchedule() {
  const [year, month] = selectedMonth.value.split('-').map(Number);
  await dutiesStore.fetchDutySchedule(selectedLocation.value, year, month);
}

onMounted(() => {
  loadSchedule();
});
</script>

<style scoped>
.calendar-card { padding: 1rem; }
.calendar-grid-header {
  display: grid; grid-template-columns: repeat(7, 1fr);
  text-align: center; font-weight: 700; padding: 0.75rem 0; border-bottom: 2px solid var(--gray-200);
}
.calendar-grid-body {
  display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; background: var(--gray-200);
}
.cal-cell { background: #ffffff; min-height: 120px; padding: 0.4rem; }
.empty-cell { background: var(--gray-50); }
.cell-day-num { font-weight: 700; font-size: 0.85rem; color: var(--gray-600); margin-bottom: 0.25rem; }
.shift-tag {
  font-size: 0.72rem; padding: 0.2rem 0.35rem; border-radius: var(--radius-sm);
  margin-bottom: 0.25rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.time-sub { font-size: 0.65rem; opacity: 0.85; margin: 0 2px; }
.tag-female { background: var(--accent-50); color: var(--accent-600); }
.tag-male { background: var(--primary-50); color: var(--primary-600); }
</style>

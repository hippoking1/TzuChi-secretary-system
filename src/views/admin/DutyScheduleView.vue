<template>
  <div class="admin-duty-schedule">
    <div class="flex items-center justify-between mb-6 flex-wrap gap-4">
      <div>
        <h1 class="text-2xl font-bold">道場值班月曆</h1>
        <p class="text-sm text-muted">檢視宜蘭園區與東港聯絡處全月排班與各班次時段（點擊日期卡片可檢視完整名單）</p>
      </div>
      <div class="flex gap-3 flex-wrap">
        <select v-model="selectedLocation" class="form-select" style="min-width: 140px;" @change="loadSchedule">
          <option value="宜蘭園區">宜蘭園區</option>
          <option value="東港聯絡處">東港聯絡處</option>
        </select>
        <input v-model="selectedMonth" type="month" class="form-input" style="min-width: 150px;" @change="loadSchedule" />
        <router-link to="/admin/duty-form" class="btn btn-primary">✏️ 維護本月排班</router-link>
      </div>
    </div>

    <!-- 月曆滾動外框 (防止橫向壓縮破版) -->
    <div class="card calendar-card table-responsive">
      <div class="calendar-wrapper">
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
            :class="{ 'empty-cell': !cell.date, 'weekend-cell': cell.isWeekend }"
            @click="cell.date && openDayDetails(cell)"
          >
            <div v-if="cell.date" class="cell-inner">
              <div class="cell-top-bar flex items-center justify-between mb-1">
                <span class="cell-day-num" :class="{ 'text-gold': cell.isWeekend }">{{ cell.day }}</span>
                <span v-if="cell.shifts.length > 0" class="shift-count-badge">
                  {{ cell.shifts.filter(s => !!s.memberName).length }}/{{ cell.shifts.length }}
                </span>
              </div>

              <!-- 班次清單 (緊湊俐落設計，不爆版) -->
              <div class="cell-shifts-list">
                <div 
                  v-for="shift in cell.shifts.slice(0, 5)" 
                  :key="shift.id" 
                  class="shift-chip"
                  :class="shift.genderType === '男' ? 'chip-male' : 'chip-female'"
                  :title="shift.shiftLabel + ' (' + (shift.timeRange || '') + '): ' + (shift.memberName || '未指派')"
                >
                  <span class="chip-label">{{ shift.shiftLabel.replace('班', '') }}</span>
                  <span class="chip-name font-bold">{{ shift.memberName || '未指派' }}</span>
                </div>

                <!-- 若超過 5 席，顯示 +N 更多按鈕 -->
                <div v-if="cell.shifts.length > 5" class="more-chip">
                  + 還有 {{ cell.shifts.length - 5 }} 席...
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 點擊日期彈出之完整當日值班詳情 Modal -->
    <div v-if="showDayModal" class="modal-backdrop" @click="showDayModal = false">
      <div class="modal-content" style="max-width: 600px;" @click.stop>
        <div class="modal-header">
          <div>
            <h3 class="modal-title">🗓️ {{ selectedDayCell?.date }} ({{ selectedLocation }}) 值班明細</h3>
            <p class="text-xs text-muted mt-1">共 {{ selectedDayCell?.shifts.length }} 席位</p>
          </div>
          <button class="modal-close" @click="showDayModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="flex flex-col gap-3">
            <div 
              v-for="s in selectedDayCell?.shifts" 
              :key="s.id" 
              class="card p-3 flex items-center justify-between border"
              :class="s.genderType === '男' ? 'border-primary' : 'border-accent'"
            >
              <div>
                <span class="badge" :class="s.genderType === '男' ? 'badge-info' : 'badge-danger'">
                  {{ s.genderType }}眾
                </span>
                <strong class="text-sm ml-2">{{ s.shiftLabel }}</strong>
                <span class="text-xs text-muted ml-2">({{ s.timeRange }})</span>
              </div>
              <div class="text-right">
                <span class="font-bold text-base" :class="s.memberName ? 'text-primary' : 'text-muted'">
                  {{ s.memberName || '（未指派）' }}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <router-link to="/admin/duty-form" class="btn btn-primary btn-sm">前往維護排班</router-link>
          <button class="btn btn-outline btn-sm" @click="showDayModal = false">關閉</button>
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
const showDayModal = ref(false);
const selectedDayCell = ref(null);

const calendarCells = computed(() => {
  if (!selectedMonth.value) return [];
  const [year, month] = selectedMonth.value.split('-').map(Number);
  const firstDayIndex = new Date(year, month - 1, 1).getDay();
  const totalDays = new Date(year, month, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDayIndex; i++) cells.push({ date: null });

  for (let day = 1; day <= totalDays; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dateObj = new Date(year, month - 1, day);
    const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
    const dayShifts = dutiesStore.duties.filter(d => d.dutyDate === dateStr);
    cells.push({ day, date: dateStr, isWeekend, shifts: dayShifts });
  }

  return cells;
});

function openDayDetails(cell) {
  selectedDayCell.value = cell;
  showDayModal.value = true;
}

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
.calendar-wrapper { min-width: 860px; }
.calendar-grid-header {
  display: grid; grid-template-columns: repeat(7, 1fr);
  text-align: center; font-weight: 700; padding: 0.75rem 0; border-bottom: 2px solid var(--gray-200); background: #ffffff;
}
.cal-day-head { font-size: 0.9rem; color: var(--gray-700); }
.calendar-grid-body {
  display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; background: var(--gray-200); border: 1px solid var(--gray-200);
}
.cal-cell {
  background: #ffffff; min-height: 145px; height: 100%; padding: 0.5rem; display: flex; flex-direction: column; cursor: pointer; transition: background 0.15s ease;
}
.cal-cell:hover:not(.empty-cell) { background: #f8fafc; }
.empty-cell { background: var(--gray-50); cursor: default; }
.weekend-cell { background: #fffdf5; }
.cell-inner { width: 100%; height: 100%; display: flex; flex-direction: column; }
.cell-day-num { font-weight: 800; font-size: 0.95rem; color: var(--gray-700); }
.text-gold { color: #b8922f; }
.shift-count-badge { font-size: 0.65rem; background: var(--gray-100); color: var(--gray-600); padding: 0.1rem 0.35rem; border-radius: 9999px; font-weight: 600; }
.cell-shifts-list { display: flex; flex-direction: column; gap: 0.25rem; margin-top: 0.25rem; }

.shift-chip {
  display: flex; align-items: center; justify-content: space-between; gap: 0.25rem; font-size: 0.74rem; padding: 0.2rem 0.4rem; border-radius: var(--radius-sm); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2;
}
.chip-female { background: #fdf2f8; color: #be185d; border-left: 2px solid #db2777; }
.chip-male { background: #eff6ff; color: #1d4ed8; border-left: 2px solid #2563eb; }
.chip-label { font-size: 0.68rem; opacity: 0.85; }
.chip-name { overflow: hidden; text-overflow: ellipsis; }

.more-chip {
  font-size: 0.68rem; text-align: center; color: var(--primary-600); font-weight: 600; padding: 0.15rem 0; background: var(--primary-50); border-radius: var(--radius-sm);
}

.modal-backdrop {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  background: rgba(15, 23, 42, 0.6); display: flex; align-items: center; justify-content: center; z-index: 9990;
}
.modal-content { background: #ffffff; border-radius: var(--radius-lg); width: 90%; }
.modal-header { padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--gray-200); display: flex; justify-content: space-between; align-items: center; }
.modal-body { padding: 1.5rem; max-height: 65vh; overflow-y: auto; }
.modal-footer { padding: 1rem 1.5rem; display: flex; justify-content: flex-end; gap: 0.5rem; background: var(--gray-50); border-top: 1px solid var(--gray-200); }
.modal-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; }
.border-primary { border-color: var(--primary-200) !important; }
.border-accent { border-color: var(--accent-200) !important; }
.ml-2 { margin-left: 0.5rem; }
</style>

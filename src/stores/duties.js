import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getCollectionDocs, batchWriteItems } from '@/firebase/db';
import { where } from 'firebase/firestore';

export const useDutiesStore = defineStore('duties', () => {
  const duties = ref([]);
  const loading = ref(false);

  // 道場班次時段常數定義 (含標準時段字串)
  const DUTY_SHIFTS_CONFIG = {
    '東港聯絡處': [
      { shiftId: 'DG_F', label: '女眾班', startTime: '08:00', endTime: '13:00', timeRange: '08:00~13:00', gender: '女', quota: 2 },
      { shiftId: 'DG_M', label: '男眾班', startTime: '13:00', endTime: '17:00', timeRange: '13:00~17:00', gender: '男', quota: 1 }
    ],
    '宜蘭園區': [
      { shiftId: 'YL_F', label: '女眾班', startTime: '08:00', endTime: '16:00', timeRange: '08:00~16:00', gender: '女', quota: 4 },
      { shiftId: 'YL_M1', label: '男眾班(一)', startTime: '16:00', endTime: '18:30', timeRange: '16:00~18:30', gender: '男', quota: 2 },
      { shiftId: 'YL_M2', label: '男眾班(二)', startTime: '18:30', endTime: '20:30', timeRange: '18:30~20:30', gender: '男', quota: 2 }
    ]
  };

  function getShiftTimeRange(location, shiftId, label) {
    const list = DUTY_SHIFTS_CONFIG[location] || [];
    const found = list.find(s => s.shiftId === shiftId || s.label === label);
    return found ? found.timeRange : '';
  }

  async function fetchDutySchedule(location, year, month) {
    loading.value = true;
    try {
      const prefix = `${year}-${String(month).padStart(2, '0')}`;
      const list = await getCollectionDocs('dutyShifts', [
        where('location', '==', location)
      ]);
      duties.value = list
        .filter(d => (d.dutyDate || '').startsWith(prefix))
        .map(d => ({
          ...d,
          timeRange: d.timeRange || getShiftTimeRange(location, d.shiftId, d.shiftLabel)
        }));
      return duties.value;
    } finally {
      loading.value = false;
    }
  }

  async function saveMonthlyDuties(location, year, month, dutyList) {
    loading.value = true;
    try {
      await batchWriteItems('dutyShifts', dutyList);
      await fetchDutySchedule(location, year, month);
    } finally {
      loading.value = false;
    }
  }

  function generateMonthlyTemplate(location, year, month) {
    const shiftsConfig = DUTY_SHIFTS_CONFIG[location] || [];
    const daysInMonth = new Date(year, month, 0).getDate();
    const result = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dateObj = new Date(year, month - 1, day);
      const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

      shiftsConfig.forEach(conf => {
        for (let slot = 1; slot <= conf.quota; slot++) {
          result.push({
            id: `${location}_${dateStr}_${conf.shiftId}_${slot}`,
            location,
            dutyDate: dateStr,
            shiftId: conf.shiftId,
            shiftLabel: conf.label,
            shiftStart: conf.startTime,
            shiftEnd: conf.endTime,
            timeRange: conf.timeRange,
            quota: conf.quota,
            slotIndex: slot,
            genderType: conf.gender,
            isWeekend,
            memberId: '',
            memberName: '',
            orgPath: ''
          });
        }
      });
    }
    return result;
  }

  return {
    duties,
    loading,
    DUTY_SHIFTS_CONFIG,
    getShiftTimeRange,
    fetchDutySchedule,
    saveMonthlyDuties,
    generateMonthlyTemplate
  };
});

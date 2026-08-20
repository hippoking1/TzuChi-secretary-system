import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getCollectionDocs, batchWriteItems } from '@/firebase/db';
import { where } from 'firebase/firestore';

export const useDutiesStore = defineStore('duties', () => {
  const duties = ref([]);
  const loading = ref(false);

  // 道場班次時段常數定義
  const DUTY_SHIFTS_CONFIG = {
    '東港聯絡處': [
      { shiftId: 'donggang_female', label: '女眾班', startTime: '08:00', endTime: '12:00', gender: '女', quota: 2 },
      { shiftId: 'donggang_male', label: '男眾班', startTime: '08:00', endTime: '12:00', gender: '男', quota: 1 }
    ],
    '宜蘭園區': [
      { shiftId: 'yilan_female', label: '女眾班', startTime: '08:30', endTime: '16:30', gender: '女', quota: 4 },
      { shiftId: 'yilan_male_1', label: '男眾一班', startTime: '08:30', endTime: '16:30', gender: '男', quota: 2 },
      { shiftId: 'yilan_male_2', label: '男眾二班', startTime: '08:30', endTime: '16:30', gender: '男', quota: 2 }
    ]
  };

  async function fetchDutySchedule(location, year, month) {
    loading.value = true;
    try {
      const prefix = `${year}-${String(month).padStart(2, '0')}`;
      const list = await getCollectionDocs('dutyShifts', [
        where('location', '==', location)
      ]);
      duties.value = list.filter(d => (d.dutyDate || '').startsWith(prefix));
      return duties.value;
    } finally {
      loading.value = false;
    }
  }

  async function saveMonthlyDuties(location, year, month, dutyList) {
    loading.value = true;
    try {
      // 批次儲存
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
            slotIndex: slot,
            genderType: conf.gender,
            isWeekend,
            memberId: '',
            memberName: ''
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
    fetchDutySchedule,
    saveMonthlyDuties,
    generateMonthlyTemplate
  };
});

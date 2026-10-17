import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getCollectionDocs, batchWriteItems } from '@/firebase/db';
import { where } from 'firebase/firestore';

// 道場班次時段常數定義 (含標準時段字串與席次需求 quota)
export const DUTY_SHIFTS_CONFIG = {
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

export function getStandardShiftConfig(location, shiftId, label) {
  const list = DUTY_SHIFTS_CONFIG[location] || [];
  return list.find(s => s.shiftId === shiftId || s.label === label) || null;
}

export function getStandardShiftQuota(location, shiftId, genderType = '女') {
  const found = getStandardShiftConfig(location, shiftId);
  if (found && typeof found.quota === 'number') return found.quota;
  // 若為未預設之道場或班次，根據已知代碼或眾別推導
  if (shiftId === 'DG_F') return 2;
  if (shiftId === 'DG_M') return 1;
  if (shiftId === 'YL_F') return 4;
  return genderType === '男' ? 2 : 4;
}

export const useDutiesStore = defineStore('duties', () => {
  const duties = ref([]);
  const hospitalDuties = ref([]);
  const loading = ref(false);

  function getShiftTimeRange(location, shiftId, label) {
    const found = getStandardShiftConfig(location, shiftId, label);
    return found ? found.timeRange : '';
  }

  async function fetchDutySchedule(location, year, month) {
    loading.value = true;
    try {
      const prefix = `${year}-${String(month).padStart(2, '0')}`;
      const list = await getCollectionDocs('dutyShifts', [
        where('location', '==', location)
      ]);
      const mapped = list
        .filter(d => (d.dutyDate || '').startsWith(prefix))
        .map(d => ({
          ...d,
          timeRange: d.timeRange || getShiftTimeRange(location, d.shiftId, d.shiftLabel)
        }))
        .sort((a, b) => (a.dutyDate + a.id).localeCompare(b.dutyDate + b.id));
      if (location === '醫院志工') {
        hospitalDuties.value = mapped;
      } else {
        duties.value = mapped;
      }
      return mapped;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 取得指定道場在指定日期區間之排班清單 (純讀取，不覆蓋 duties 狀態，避免並行衝突)
   */
  async function getDutyScheduleByRange(location, startDate, endDate) {
    try {
      const list = await getCollectionDocs('dutyShifts', [
        where('location', '==', location)
      ]);
      return list
        .filter(d => {
          if (!d.dutyDate) return false;
          if (startDate && d.dutyDate < startDate) return false;
          if (endDate && d.dutyDate > endDate) return false;
          return true;
        })
        .map(d => ({
          ...d,
          timeRange: d.timeRange || getShiftTimeRange(location, d.shiftId, d.shiftLabel)
        }))
        .sort((a, b) => {
          const cmp = (a.dutyDate || '').localeCompare(b.dutyDate || '');
          if (cmp !== 0) return cmp;
          return (a.id || '').localeCompare(b.id || '');
        });
    } catch (err) {
      console.error('getDutyScheduleByRange error:', err);
      return [];
    }
  }

  /**
   * 依自訂日期區間 (startDate ~ endDate) 載入指定道場排班清單
   */
  async function fetchDutyScheduleByRange(location, startDate, endDate) {
    loading.value = true;
    try {
      const mapped = await getDutyScheduleByRange(location, startDate, endDate);
      if (location === '醫院志工') {
        hospitalDuties.value = mapped;
      } else {
        duties.value = mapped;
      }
      return mapped;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 讀取指定年月之預排醫院志工清單
   */
  async function fetchHospitalVolunteerSchedule(year, month) {
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    const list = await getCollectionDocs('dutyShifts', [
      where('location', '==', '醫院志工')
    ]);
    const mapped = list
      .filter(d => (d.dutyDate || '').startsWith(prefix) && !!d.memberName)
      .sort((a, b) => (a.dutyDate + (a.memberName || '')).localeCompare(b.dutyDate + (b.memberName || '')));
    hospitalDuties.value = mapped;
    return mapped;
  }

  /**
   * 讀取指定日期區間之預排醫院志工清單
   */
  async function getHospitalVolunteerScheduleByRange(startDate, endDate) {
    const list = await getDutyScheduleByRange('醫院志工', startDate, endDate);
    return list.filter(d => !!d.memberName);
  }

  /**
   * 批次新增預排醫院志工及日期
   * @param {Object} payload { dates: string[], members: Array<{id, name, gender}>, hospitalName: string, note: string }
   */
  async function addHospitalVolunteerSchedules({ dates = [], members = [], hospitalName = '醫院志工', note = '' }) {
    if (!dates.length || !members.length) return [];
    const items = [];
    const cleanLabel = (hospitalName || '醫院志工').trim() || '醫院志工';

    dates.forEach(dateStr => {
      if (!dateStr) return;
      const [y, m, d] = dateStr.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

      members.forEach(mem => {
        const memberName = (mem.name || '').trim();
        if (!memberName) return;
        const memberId = mem.id || memberName;
        const safeKey = String(memberId).replace(/[\/\s.#$[\]]/g, '_');
        items.push({
          id: `醫院志工_${dateStr}_HOSP_${safeKey}`,
          location: '醫院志工',
          dutyDate: dateStr,
          shiftId: 'HOSP_VOL',
          shiftLabel: cleanLabel,
          hospitalName: cleanLabel,
          shiftStart: '08:00',
          shiftEnd: '17:00',
          timeRange: '全天',
          slotIndex: 1,
          genderType: mem.gender || '女',
          isWeekend,
          memberId: mem.id || '',
          memberName,
          note: (note || '').trim(),
          status: '已排班'
        });
      });
    });

    if (items.length > 0) {
      await batchWriteItems('dutyShifts', items, 'set');
    }
    return items;
  }

  const hospitalBatchTemplates = ref([]);

  /**
   * 讀取所有歷史預排醫院志工紀錄（供跨月份複製歷史批次名單使用）
   */
  async function fetchAllHospitalVolunteerSchedules() {
    const list = await getCollectionDocs('dutyShifts', [
      where('location', '==', '醫院志工')
    ]);
    return list
      .filter(d => !!d.dutyDate && !!d.memberName)
      .sort((a, b) => (b.dutyDate + (a.memberName || '')).localeCompare(a.dutyDate + (b.memberName || '')));
  }

  /**
   * 讀取常用醫院志工批次名單模板
   */
  async function fetchHospitalBatchTemplates() {
    const list = await getCollectionDocs('dutyShifts', [
      where('location', '==', '醫院志工模板')
    ]);
    const sorted = list
      .filter(t => Array.isArray(t.members) && t.members.length > 0)
      .sort((a, b) => (a.templateName || '').localeCompare(b.templateName || ''));
    hospitalBatchTemplates.value = sorted;
    return sorted;
  }

  /**
   * 儲存常用醫院志工批次名單模板
   */
  async function saveHospitalBatchTemplate({ id = '', templateName = '', hospitalName = '醫院志工', members = [] }) {
    const cleanName = (templateName || '').trim() || '常用醫院志工批次名單';
    const docId = id || `醫院志工模板_${Date.now()}`;
    const item = {
      id: docId,
      location: '醫院志工模板',
      templateName: cleanName,
      hospitalName: (hospitalName || '醫院志工').trim() || '醫院志工',
      members: members.map(m => ({
        id: m.id || '',
        name: (m.name || '').trim(),
        gender: m.gender || '女',
        orgText: m.orgText || ''
      })).filter(m => !!m.name)
    };
    await batchWriteItems('dutyShifts', [item], 'set');
    await fetchHospitalBatchTemplates();
    return item;
  }

  /**
   * 刪除常用醫院志工批次名單模板
   */
  async function deleteHospitalBatchTemplate(templateId) {
    if (!templateId) return;
    await batchWriteItems('dutyShifts', [{ id: templateId }], 'delete');
    await fetchHospitalBatchTemplates();
  }

  /**
   * 批次刪除預排醫院志工紀錄
   */
  async function deleteHospitalVolunteerSchedules(itemsOrIds = []) {
    if (!itemsOrIds || itemsOrIds.length === 0) return;
    const toDelete = itemsOrIds
      .map(x => (typeof x === 'string' ? { id: x } : { id: x.id }))
      .filter(x => !!x.id);
    if (toDelete.length > 0) {
      await batchWriteItems('dutyShifts', toDelete, 'delete');
    }
  }

  async function saveMonthlyDuties(location, year, month, dutyList) {
    loading.value = true;
    try {
      const cleanedItems = dutyList.map(item => ({
        id: item.id || `${location}_${item.dutyDate}_${item.shiftId}_${item.slotIndex}`,
        location: location,
        dutyDate: item.dutyDate,
        shiftId: item.shiftId,
        shiftLabel: item.shiftLabel,
        shiftStart: item.shiftStart || '',
        shiftEnd: item.shiftEnd || '',
        timeRange: item.timeRange || getShiftTimeRange(location, item.shiftId, item.shiftLabel),
        slotIndex: item.slotIndex,
        genderType: item.genderType,
        isWeekend: item.isWeekend || false,
        memberId: item.memberId || '',
        memberName: item.memberName || '',
        status: item.memberName ? '已排班' : '未指派'
      }));

      await batchWriteItems('dutyShifts', cleanedItems, 'set');
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
            memberName: ''
          });
        }
      });
    }
    return result;
  }

  return {
    duties,
    hospitalDuties,
    hospitalBatchTemplates,
    loading,
    DUTY_SHIFTS_CONFIG,
    getShiftTimeRange,
    fetchDutySchedule,
    fetchDutyScheduleByRange,
    getDutyScheduleByRange,
    fetchHospitalVolunteerSchedule,
    fetchAllHospitalVolunteerSchedules,
    getHospitalVolunteerScheduleByRange,
    addHospitalVolunteerSchedules,
    deleteHospitalVolunteerSchedules,
    fetchHospitalBatchTemplates,
    saveHospitalBatchTemplate,
    deleteHospitalBatchTemplate,
    saveMonthlyDuties,
    generateMonthlyTemplate
  };
});

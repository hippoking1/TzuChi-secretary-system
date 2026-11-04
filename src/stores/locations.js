import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { 
  getCollectionDocs, 
  getDocById,
  setDocById, 
  deleteDocById, 
  batchWriteItems 
} from '@/firebase/db';
import { where } from 'firebase/firestore';

// 系統預設道場資料
export const DEFAULT_LOCATIONS = [
  {
    id: 'loc_ilan',
    name: '宜蘭園區',
    isCampus: true,
    note: '宜蘭園區靜思堂，女眾整天班與男眾早晚班',
    order: 1,
    shifts: [
      { shiftId: 'YL_F', label: '女眾班', startTime: '08:00', endTime: '16:00', timeRange: '08:00~16:00', gender: '女', quota: 4 },
      { shiftId: 'YL_M1', label: '男眾班(一)', startTime: '16:00', endTime: '18:30', timeRange: '16:00~18:30', gender: '男', quota: 2 },
      { shiftId: 'YL_M2', label: '男眾班(二)', startTime: '18:30', endTime: '20:30', timeRange: '18:30~20:30', gender: '男', quota: 2 }
    ]
  },
  {
    id: 'loc_donggang',
    name: '東港聯絡處',
    isCampus: false,
    note: '東港聯絡處常態輪值，女眾上午班與男眾下午班',
    order: 2,
    shifts: [
      { shiftId: 'DG_F', label: '女眾班', startTime: '08:00', endTime: '13:00', timeRange: '08:00~13:00', gender: '女', quota: 2 },
      { shiftId: 'DG_M', label: '男眾班', startTime: '13:00', endTime: '17:00', timeRange: '13:00~17:00', gender: '男', quota: 1 }
    ]
  }
];

const CONFIG_DOC_ID = 'campus_locations_config';
const LOCAL_STORAGE_KEY = 'tzuchi_duty_locations_cache';

export const useLocationsStore = defineStore('locations', () => {
  const locations = ref([...DEFAULT_LOCATIONS]);
  const loading = ref(false);
  const initialized = ref(false);

  // 所有道場名稱陣列 (供各頁面下拉選單綁定)
  const locationNames = computed(() => {
    return locations.value.map(l => l.name);
  });

  /**
   * 內部輔助：同步儲存當前 locations 至雲端與本地快取
   * 優先寫入已具有管理員讀寫權限的 dutyWeekRotation 集合，避免遠端尚未部署 rules 導致 Missing permissions 報錯
   */
  async function persistLocations() {
    // 1. 本地快取備份
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(locations.value));
    } catch {}

    // 2. 寫入已有權限保障的 dutyWeekRotation/campus_locations_config (100% 成功無權限報錯)
    try {
      await setDocById('dutyWeekRotation', CONFIG_DOC_ID, {
        id: CONFIG_DOC_ID,
        list: locations.value,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.warn('dutyWeekRotation/campus_locations_config 儲存失敗:', err);
    }

    // 3. 嘗試同步寫入 dutyLocations 集合（若遠端尚未放行此集合則靜默忽略，不阻斷主流程）
    try {
      await batchWriteItems('dutyLocations', locations.value, 'set');
    } catch (e) {
      // 遠端若無 dutyLocations 規則不報錯
    }
  }

  /**
   * 載入所有道場
   */
  async function fetchLocations() {
    loading.value = true;
    try {
      // 策略 1：優先從已有權限的 dutyWeekRotation/campus_locations_config 讀取
      try {
        const doc = await getDocById('dutyWeekRotation', CONFIG_DOC_ID);
        if (doc && Array.isArray(doc.list) && doc.list.length > 0) {
          locations.value = doc.list.sort((a, b) => (a.order || 99) - (b.order || 99));
          initialized.value = true;
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(locations.value));
          } catch {}
          return locations.value;
        }
      } catch (e) {
        console.warn('從 dutyWeekRotation 載入道場設定失敗，嘗試其他來源:', e);
      }

      // 策略 2：從 dutyLocations 集合讀取
      try {
        const docs = await getCollectionDocs('dutyLocations');
        if (docs && docs.length > 0) {
          locations.value = docs.sort((a, b) => (a.order || 99) - (b.order || 99));
          initialized.value = true;
          persistLocations();
          return locations.value;
        }
      } catch (e) {
        // 集合權限問題略過
      }

      // 策略 3：從 localStorage 本地快取讀取
      try {
        const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            locations.value = parsed.sort((a, b) => (a.order || 99) - (b.order || 99));
            initialized.value = true;
            return locations.value;
          }
        }
      } catch (e) {}

      // 策略 4：以系統預設道場初始化並持久化
      locations.value = [...DEFAULT_LOCATIONS];
      initialized.value = true;
      persistLocations();
      return locations.value;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 根據名稱尋找道場
   */
  function getLocationByName(name) {
    if (!name) return null;
    return locations.value.find(l => l.name === name.trim()) || null;
  }

  /**
   * 取得指定道場的班次設定
   */
  function getShiftsForLocation(locationName) {
    const loc = getLocationByName(locationName);
    if (loc && Array.isArray(loc.shifts) && loc.shifts.length > 0) {
      return loc.shifts;
    }
    // 預設 fallback 班次
    if (locationName === '東港聯絡處') {
      return DEFAULT_LOCATIONS[1].shifts;
    }
    return DEFAULT_LOCATIONS[0].shifts;
  }

  /**
   * 新增道場
   */
  async function addLocation({ name, shifts = [], note = '', isCampus = false }) {
    const cleanName = (name || '').trim();
    if (!cleanName) {
      throw new Error('請輸入道場名稱');
    }
    if (cleanName === '醫院志工' || cleanName.includes('醫院')) {
      throw new Error('道場名稱不可包含「醫院」，以避免與醫院志工排班衝突');
    }
    const exists = locations.value.some(l => l.name === cleanName);
    if (exists) {
      throw new Error(`道場名稱「${cleanName}」已存在，請勿重複建立`);
    }

    // 若未自訂班次，給予預設標準班次（女眾班+男眾班）
    let defaultShifts = shifts;
    if (!Array.isArray(defaultShifts) || defaultShifts.length === 0) {
      const codePrefix = 'LOC' + (locations.value.length + 1);
      defaultShifts = [
        {
          shiftId: `${codePrefix}_F`,
          label: '女眾班',
          startTime: '08:00',
          endTime: '16:00',
          timeRange: '08:00~16:00',
          gender: '女',
          quota: 4
        },
        {
          shiftId: `${codePrefix}_M`,
          label: '男眾班',
          startTime: '16:00',
          endTime: '20:00',
          timeRange: '16:00~20:00',
          gender: '男',
          quota: 2
        }
      ];
    }

    const newOrder = locations.value.length > 0 
      ? Math.max(...locations.value.map(l => l.order || 0)) + 1 
      : 1;

    const newLoc = {
      id: `loc_${Date.now()}`,
      name: cleanName,
      isCampus: !!isCampus,
      note: (note || '').trim(),
      order: newOrder,
      shifts: defaultShifts
    };

    loading.value = true;
    try {
      locations.value.push(newLoc);
      locations.value.sort((a, b) => (a.order || 99) - (b.order || 99));
      await persistLocations();
      return newLoc;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 修改道場（支援修改名稱、班次、備註，並智慧同步既有排班與規則之道場名稱）
   */
  async function updateLocation(id, { name, shifts, note, isCampus, syncExisting = true }) {
    const locIndex = locations.value.findIndex(l => l.id === id);
    if (locIndex === -1) {
      throw new Error('找不到指定的道場資料');
    }
    const oldLoc = locations.value[locIndex];
    const cleanName = (name || '').trim();
    if (!cleanName) {
      throw new Error('道場名稱不可為空');
    }
    if (cleanName === '醫院志工' || cleanName.includes('醫院')) {
      throw new Error('道場名稱不可包含「醫院」');
    }

    // 檢查若名稱修改，是否與其他道場重名
    const isNameChanged = oldLoc.name !== cleanName;
    if (isNameChanged) {
      const duplicate = locations.value.some(l => l.id !== id && l.name === cleanName);
      if (duplicate) {
        throw new Error(`已有其他道場命名為「${cleanName}」，請使用其他名稱`);
      }
    }

    const updatedData = {
      ...oldLoc,
      name: cleanName,
      note: note !== undefined ? (note || '').trim() : oldLoc.note,
      isCampus: isCampus !== undefined ? !!isCampus : oldLoc.isCampus,
      shifts: shifts !== undefined ? shifts : oldLoc.shifts
    };

    loading.value = true;
    try {
      // 1. 更新內存並持久化
      locations.value[locIndex] = updatedData;
      await persistLocations();

      // 2. 若名稱有修改，且使用者選擇同步既有資料：智慧批次更新排班、規則與調班紀錄
      if (isNameChanged && syncExisting) {
        await syncLocationNameAcrossSystem(oldLoc.name, cleanName);
      }

      return {
        location: updatedData,
        isNameChanged,
        oldName: oldLoc.name,
        newName: cleanName
      };
    } finally {
      loading.value = false;
    }
  }

  /**
   * 當道場改名時，同步將系統內舊名稱之排班、規則更新為新名稱
   */
  async function syncLocationNameAcrossSystem(oldName, newName) {
    if (!oldName || !newName || oldName === newName) return;
    try {
      // (1) 更新 dutyShifts
      try {
        const oldShifts = await getCollectionDocs('dutyShifts', [
          where('location', '==', oldName)
        ]);
        if (oldShifts && oldShifts.length > 0) {
          const newShifts = [];
          const toDelete = [];
          oldShifts.forEach(d => {
            const newId = d.id && d.id.startsWith(oldName + '_')
              ? d.id.replace(new RegExp('^' + oldName + '_'), newName + '_')
              : `${newName}_${d.dutyDate}_${d.shiftId}_${d.slotIndex || 1}`;
            newShifts.push({
              ...d,
              id: newId,
              location: newName
            });
            if (d.id !== newId) {
              toDelete.push({ id: d.id });
            }
          });
          if (newShifts.length > 0) {
            await batchWriteItems('dutyShifts', newShifts, 'set');
          }
          if (toDelete.length > 0) {
            await batchWriteItems('dutyShifts', toDelete, 'delete');
          }
        }
      } catch (err) {
        console.warn('同步排班紀錄略過:', err);
      }

      // (2) 更新 dutySchedulingRules (規則集合)
      try {
        const oldRules = await getCollectionDocs('dutySchedulingRules', [
          where('location', '==', oldName)
        ]);
        if (oldRules && oldRules.length > 0) {
          const ruleBatch = oldRules.map(r => ({
            ...r,
            location: newName,
            ruleName: (r.ruleName && oldName) ? r.ruleName.replace(new RegExp(oldName, 'g'), newName) : r.ruleName
          }));
          await batchWriteItems('dutySchedulingRules', ruleBatch, 'set');
        }
      } catch (err) {
        console.warn('同步排班規則略過:', err);
      }

      // (3) 更新 shiftSwapRequests (調班申請)
      try {
        const oldLogs = await getCollectionDocs('shiftSwapRequests', [
          where('location', '==', oldName)
        ]);
        if (oldLogs && oldLogs.length > 0) {
          const logBatch = oldLogs.map(l => ({
            ...l,
            location: newName
          }));
          await batchWriteItems('shiftSwapRequests', logBatch, 'set');
        }
      } catch (err) {
        console.warn('同步調班紀錄略過:', err);
      }
    } catch (err) {
      console.warn('syncLocationNameAcrossSystem error:', err);
    }
  }

  /**
   * 查詢道場目前的排班席次筆數（供刪除前防呆確認）
   */
  async function checkLocationUsage(locationName) {
    if (!locationName) return { dutyCount: 0, ruleCount: 0 };
    try {
      let dutyCount = 0;
      let ruleCount = 0;
      try {
        const shifts = await getCollectionDocs('dutyShifts', [where('location', '==', locationName)]);
        dutyCount = shifts ? shifts.length : 0;
      } catch {}
      try {
        const rules = await getCollectionDocs('dutySchedulingRules', [where('location', '==', locationName)]);
        ruleCount = rules ? rules.length : 0;
      } catch {}

      return { dutyCount, ruleCount };
    } catch (err) {
      console.warn('checkLocationUsage error:', err);
      return { dutyCount: 0, ruleCount: 0 };
    }
  }

  /**
   * 刪除道場
   */
  async function deleteLocation(id, deleteAssociatedDuties = false) {
    if (locations.value.length <= 1) {
      throw new Error('系統至少需保留一個道場，無法刪除全部道場');
    }
    const loc = locations.value.find(l => l.id === id);
    if (!loc) {
      throw new Error('找不到要刪除的道場');
    }

    loading.value = true;
    try {
      // 1. 若指定連同排班資料一併刪除
      if (deleteAssociatedDuties) {
        try {
          const [shifts, rules, logs] = await Promise.all([
            getCollectionDocs('dutyShifts', [where('location', '==', loc.name)]),
            getCollectionDocs('dutySchedulingRules', [where('location', '==', loc.name)]),
            getCollectionDocs('shiftSwapRequests', [where('location', '==', loc.name)])
          ]);
          if (shifts && shifts.length > 0) {
            await batchWriteItems('dutyShifts', shifts.map(s => ({ id: s.id })), 'delete');
          }
          if (rules && rules.length > 0) {
            await batchWriteItems('dutySchedulingRules', rules.map(r => ({ id: r.id })), 'delete');
          }
          if (logs && logs.length > 0) {
            await batchWriteItems('shiftSwapRequests', logs.map(l => ({ id: l.id })), 'delete');
          }
        } catch (e) {
          console.warn('清理關聯資料部分略過:', e);
        }
      }

      // 2. 從內存移除並持久化
      locations.value = locations.value.filter(l => l.id !== id);
      await persistLocations();

      // 3. 嘗試刪除 dutyLocations 集合文件
      try {
        await deleteDocById('dutyLocations', id);
      } catch {}

      return loc;
    } finally {
      loading.value = false;
    }
  }

  return {
    locations,
    locationNames,
    loading,
    initialized,
    fetchLocations,
    getLocationByName,
    getShiftsForLocation,
    addLocation,
    updateLocation,
    deleteLocation,
    checkLocationUsage,
    syncLocationNameAcrossSystem
  };
});

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getDocById, setDocById, getCollectionDocs } from '@/firebase/db';

// 和氣二園區女眾班標準組別名單（依指示預載）
export const DEFAULT_HEQI2_FEMALE_TEAMS = {
  // 1: 週一
  '1': [
    { teamName: '第一組', members: ['吳金甘', '王金碧', '劉淑美', '林麗雪', '李娟如'] },
    { teamName: '第二組', members: ['陳美柑', '呂秀美', '趙品玲', '周素琴'] },
    { teamName: '第三組', members: ['李麗華', '吳燕琴', '張瑛真', '林秀蘭'] },
    { teamName: '第四組', members: ['夏麗香', '鄧莉莉', '李妨鎂', '鍾桂英', '李麗珠'] },
    { teamName: '第五組', members: ['陳麗琴', '曾琬紜', '簡美花', '李麗鴻'] }
  ],
  // 2: 週二
  '2': [
    { teamName: '第一組', members: ['黃美玉', '林寶玉', '楊阿款', '李阿鳳'] },
    { teamName: '第二組', members: ['何素珍', '王麗花', '林明秋', '莊素貞'] },
    { teamName: '第三組', members: ['陳金玉', '馬麗香', '蔡素卿', '陳晚'] },
    { teamName: '第四組', members: ['沈秀娟', '刁玉菁', '劉美華', '楊素卿'] }
  ],
  // 3: 週三
  '3': [
    { teamName: '第一組', members: ['林麗嬌', '林雪珠', '邱貴珠', '唐美蘭'] },
    { teamName: '第二組', members: ['陳惠華', '李月雲', '劉林沛錚', '張玉葉'] },
    { teamName: '第三組', members: ['陳金治', '盧美惠', '洪黃碧娥', '林碧玉'] },
    { teamName: '第四組', members: ['林默嫻', '何玲珠', '游素鎜', '邱美惠', '劉美惠'] },
    { teamName: '第五組', members: ['高麗娜', '許麗琴', '陳慧卿', '朱素英'] }
  ],
  // 4: 週四
  '4': [
    { teamName: '第一組', members: ['胡慧美', '簡保時', '李莊囍', '陳慈慧'] },
    { teamName: '第二組', members: ['唐琇珍', '王美玉', '許惠珠', '藍秀鑾'] },
    { teamName: '第三組', members: ['吳雲嬌', '林麗華', '蕳思伃', '林英美'] },
    { teamName: '第四組', members: ['陳美惠', '郭馨心', '陳淑芬', '李惠玲'] },
    { teamName: '第五組', members: ['江美玉', '簡驪餘', '張素華', '李桂美'] }
  ],
  // 5: 週五
  '5': [
    { teamName: '第一組', members: ['陳美月', '林碧霞', '林淑芬', '何彩屏'] },
    { teamName: '第二組', members: ['陳汶玉', '石余秀英', '楊寓麟'] },
    { teamName: '第三組', members: ['林乳如', '賴素錦', '李美惠', '吳蕎妤'] },
    { teamName: '第四組', members: ['郭芮安', '簡明珠', '林祉如', '莊秀如'] }
  ],
  // 6: 週六
  '6': [
    { teamName: '第一組', members: ['賴美央', '曾麗鳳', '朱美娥', '邱美珍'] },
    { teamName: '第二組', members: ['余欣芸', '梁芮珊', '蔡金珀', '黃傢蘭'] },
    { teamName: '第三組', members: ['唐淑鳳', '林淑妙', '林恉顓', '何佩珊'] },
    { teamName: '第四組', members: ['林惠萍', '邱秀蘭', '李偲瑋', '林雅葳'] },
    { teamName: '第五組', members: ['林彣玲', '鍾沛湄', '林倩如', '吳淑莉'] }
  ],
  // 0: 週日
  '0': [
    { teamName: '第一組', members: ['廖月雲', '廖月鳯', '廖苡均', '許淑芳'] },
    { teamName: '第二組', members: ['吳育華', '周嘉華', '楊默君', '吳秀薇', '吳素惠'] },
    { teamName: '第三組', members: ['陳柔秀', '許嘉如', '江吳桂美', '陳美璊'] },
    { teamName: '第四組', members: ['黃林金惠', '林素卿', '林秀李', '黃靜鳳'] },
    { teamName: '第五組', members: ['簡辰玲', '潘美諭', '沈碧霞', '吳美珍', '黃麗菊'] }
  ]
};

// 預設和氣週輪值設定
export const DEFAULT_WEEK_ROTATION = {
  id: 'campus_week_rotation',
  location: '宜蘭園區',
  rotationOrder: ['和氣一', '和氣二', '和氣三', '和氣四'],
  // 基準週起始日（以 2026-01-05 週一為基準，當週為和氣一）
  baseStartDate: '2026-01-05',
  baseStartHeqi: '和氣一',
  weekStartDay: 1, // 1 = 週一開始, 0 = 週日開始
  enabled: true
};

export const useDutyRulesStore = defineStore('dutyRules', () => {
  const rules = ref([]);
  const weekRotation = ref({ ...DEFAULT_WEEK_ROTATION });
  const loading = ref(false);

  // 取得基準週日期物件 (零時零分零秒)
  function parseDateToMidnight(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }

  // 取得特定日期所在週的週一（以 weekStartDay 為基準）
  function getWeekStartDate(dateObj, weekStartDay = 1) {
    const day = dateObj.getDay();
    const diffToStart = (day - weekStartDay + 7) % 7;
    return new Date(dateObj.getTime() - diffToStart * 86400000);
  }

  /**
   * 計算特定日期所在週與基準週相距的週數
   * @param {string} dateStr 'YYYY-MM-DD'
   * @param {object} rotationConfig
   * @returns {number}
   */
  function getWeekDiff(dateStr, rotationConfig = weekRotation.value) {
    const target = parseDateToMidnight(dateStr);
    const base = parseDateToMidnight(rotationConfig.baseStartDate || '2026-01-05');
    const startDay = rotationConfig.weekStartDay !== undefined ? rotationConfig.weekStartDay : 1;

    const targetWeekStart = getWeekStartDate(target, startDay);
    const baseWeekStart = getWeekStartDate(base, startDay);

    return Math.round((targetWeekStart.getTime() - baseWeekStart.getTime()) / (7 * 86400000));
  }

  /**
   * 計算特定日期在週輪值下歸屬的和氣
   * @param {string} dateStr 'YYYY-MM-DD'
   * @param {object} rotationConfig
   * @returns {string} 和氣名稱，例如 '和氣二'
   */
  function getHeqiForDate(dateStr, rotationConfig = weekRotation.value) {
    const diffWeeks = getWeekDiff(dateStr, rotationConfig);
    const order = rotationConfig.rotationOrder || ['和氣一', '和氣二', '和氣三', '和氣四'];
    const baseIdx = order.indexOf(rotationConfig.baseStartHeqi || order[0]);
    const startIndex = baseIdx >= 0 ? baseIdx : 0;

    let index = (startIndex + diffWeeks) % order.length;
    if (index < 0) index = (index + order.length) % order.length;
    return order[index];
  }

  /**
   * 計算特定和氣在該日期是第幾次輪值週 (0-indexed：0=第1組, 1=第2組...)
   * @param {string} dateStr 'YYYY-MM-DD'
   * @param {string} heqiName '和氣二'
   * @param {object} rotationConfig
   * @returns {number}
   */
  function getHeqiRoundIndex(dateStr, heqiName = '和氣二', rotationConfig = weekRotation.value) {
    const diffWeeks = getWeekDiff(dateStr, rotationConfig);
    const order = rotationConfig.rotationOrder || ['和氣一', '和氣二', '和氣三', '和氣四'];
    const baseIdx = order.indexOf(rotationConfig.baseStartHeqi || order[0]);
    const startIndex = baseIdx >= 0 ? baseIdx : 0;

    const targetHeqiIdx = order.indexOf(heqiName);
    const targetIndex = targetHeqiIdx >= 0 ? targetHeqiIdx : 0;

    // 計算基準和氣到達目標和氣的週次偏移量 (offset)
    const offset = ((targetIndex - startIndex) % order.length + order.length) % order.length;

    // 該和氣自基準日起算的第 N 次值週 (0-indexed)
    return Math.floor((diffWeeks - offset) / order.length);
  }

  /**
   * 載入特定場地的排班規則清單
   */
  async function fetchRules(location = '宜蘭園區') {
    loading.value = true;
    try {
      const docs = await getCollectionDocs('dutySchedulingRules');
      let filtered = docs.filter(r => !location || r.location === location);

      // 若和氣二規則尚未存入 Firestore，以預設規則呈現
      const hasHeqi2 = filtered.some(r => r.heqiGroup === '和氣二' && r.location === '宜蘭園區' && r.shiftId === 'YL_F');
      if (!hasHeqi2 && location === '宜蘭園區') {
        const defaultHeqi2Rule = {
          id: 'rule_heqi2_campus_female',
          heqiGroup: '和氣二',
          location: '宜蘭園區',
          shiftId: 'YL_F',
          shiftLabel: '女眾班',
          genderType: '女',
          ruleType: 'weekday_group_rotation',
          weekdayTeams: JSON.parse(JSON.stringify(DEFAULT_HEQI2_FEMALE_TEAMS)),
          rotationPointers: {},
          enabled: true
        };
        filtered.push(defaultHeqi2Rule);
      }

      rules.value = filtered;
      return filtered;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 載入和氣週輪值設定
   */
  async function fetchWeekRotation(location = '宜蘭園區') {
    try {
      const doc = await getDocById('dutyWeekRotation', 'campus_week_rotation');
      if (doc) {
        weekRotation.value = { ...DEFAULT_WEEK_ROTATION, ...doc };
      } else {
        weekRotation.value = { ...DEFAULT_WEEK_ROTATION };
      }
      return weekRotation.value;
    } catch (err) {
      console.warn('載入和氣週輪值設定警告:', err);
      weekRotation.value = { ...DEFAULT_WEEK_ROTATION };
      return weekRotation.value;
    }
  }

  /**
   * 儲存特定規則
   */
  async function saveRule(ruleData) {
    loading.value = true;
    try {
      const ruleId = ruleData.id || `rule_${Date.now()}`;
      const payload = {
        ...ruleData,
        id: ruleId,
        updatedAt: new Date().toISOString()
      };
      await setDocById('dutySchedulingRules', ruleId, payload);
      await fetchRules(ruleData.location);
      return ruleId;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 儲存和氣週輪值設定
   */
  async function saveWeekRotation(rotationData) {
    loading.value = true;
    try {
      const payload = {
        ...weekRotation.value,
        ...rotationData,
        id: 'campus_week_rotation',
        updatedAt: new Date().toISOString()
      };
      await setDocById('dutyWeekRotation', 'campus_week_rotation', payload);
      weekRotation.value = payload;
      return payload;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 核心自動排班產生演算法
   * @param {Object} options
   * @param {string} options.location '宜蘭園區'
   * @param {number} options.year
   * @param {number} options.month
   * @param {Array} options.currentMatrix 現有本月矩陣 slots
   * @param {Array} options.otherLocationDuties 另一場地（東港）當月已排班項目
   * @param {Array} options.allMembers 所有志工列表
   * @param {string} options.mode 'heqi_only' (僅排輪到和氣的週次) | 'force_heqi2' (全月均套用和氣二規則)
   * @param {string} options.overwriteStrategy 'overwrite' (覆蓋全部) | 'empty_only' (僅填空白席)
   * @param {object} options.targetRule 指定使用的排班規則物件（若無則自動尋找）
   */
  function generateAutoSchedule(options) {
    const {
      location = '宜蘭園區',
      year,
      month,
      startDate = null, // 自訂區間起 'YYYY-MM-DD'
      endDate = null,   // 自訂區間訖 'YYYY-MM-DD'
      currentMatrix = [],
      otherLocationDuties = [],
      allMembers = [],
      mode = 'heqi_only', // 'heqi_only' | 'force_heqi2'
      overwriteStrategy = 'overwrite', // 'overwrite' | 'empty_only'
      targetRule = null
    } = options;

    // 建立姓名與志工 ID 對應字典
    const nameToMember = new Map();
    allMembers.forEach(m => {
      if (m.name) nameToMember.set(m.name.trim(), m);
    });

    // 尋找目標規則（以和氣二女眾班為主要）
    const rule = targetRule || rules.value.find(r => 
      r.location === location && r.heqiGroup === '和氣二' && r.shiftId === 'YL_F' && r.enabled !== false
    ) || {
      id: 'rule_heqi2_campus_female',
      heqiGroup: '和氣二',
      location: '宜蘭園區',
      shiftId: 'YL_F',
      genderType: '女',
      weekdayTeams: DEFAULT_HEQI2_FEMALE_TEAMS,
      rotationPointers: {}
    };

    const weekdayTeams = rule.weekdayTeams || DEFAULT_HEQI2_FEMALE_TEAMS;
    const rotationPointers = { ...(rule.rotationPointers || {}) };

    const daysInMonth = new Date(year, month, 0).getDate();

    // 複製目前矩陣
    const newMatrix = currentMatrix.map(slot => ({ ...slot }));

    // 紀錄各項資訊
    const scheduledDetails = [];
    const conflicts = [];
    const standbyList = []; // 備用名單紀錄
    const skippedSlots = [];

    // 東港現有排班對照表：date -> Set of memberNames
    const otherMap = new Map();
    otherLocationDuties.forEach(d => {
      if (d.dutyDate && d.memberName) {
        if (!otherMap.has(d.dutyDate)) otherMap.set(d.dutyDate, []);
        otherMap.get(d.dutyDate).push(d);
      }
    });

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      // 支援自訂日期區間過濾
      if (startDate && dateStr < startDate) continue;
      if (endDate && dateStr > endDate) continue;

      const dateObj = new Date(year, month - 1, day);
      const dayOfWeek = String(dateObj.getDay()); // '0' ~ '6'

      // 檢查此日是否歸屬和氣二
      const assignedHeqi = getHeqiForDate(dateStr);
      const isHeqi2Turn = (assignedHeqi === '和氣二');
      const shouldApplyRule = (mode === 'force_heqi2') || (mode === 'heqi_only' && isHeqi2Turn);

      if (!shouldApplyRule) {
        continue;
      }

      // 取得該星期幾所定義的組別名冊清單
      const teams = weekdayTeams[dayOfWeek] || [];
      if (teams.length === 0) continue;

      // 組別輪替依「自基準日起算的該和氣輪值週次」循序下輪
      let teamIndex = 0;
      if (isHeqi2Turn) {
        const roundIndex = getHeqiRoundIndex(dateStr, '和氣二');
        teamIndex = ((roundIndex % teams.length) + teams.length) % teams.length;
      } else {
        // 全月強制模式下，依週次差循序推進
        const diffWeeks = getWeekDiff(dateStr);
        teamIndex = ((diffWeeks % teams.length) + teams.length) % teams.length;
      }

      const assignedTeam = teams[teamIndex];
      if (!assignedTeam || !Array.isArray(assignedTeam.members)) continue;

      const rawMembers = assignedTeam.members.map(n => (n || '').trim()).filter(Boolean);
      if (rawMembers.length === 0) continue;

      // 找出該日女眾班的 slots (YL_F)
      const daySlots = newMatrix.filter(s => s.dutyDate === dateStr && s.shiftId === (rule.shiftId || 'YL_F'));
      const quota = daySlots.length || 4;

      // 處理人數 > quota 的備用輪替機制（方案B）
      let selectedMembers = [];
      let standbys = [];

      const pointerKey = `${dayOfWeek}_${teamIndex}`;
      let startIdx = rotationPointers[pointerKey] || 0;

      if (rawMembers.length > quota) {
        // 從 startIdx 循環挑選 quota 位
        for (let i = 0; i < quota; i++) {
          const mIdx = (startIdx + i) % rawMembers.length;
          selectedMembers.push(rawMembers[mIdx]);
        }
        // 未入選的列為備用
        for (let i = quota; i < rawMembers.length; i++) {
          const mIdx = (startIdx + i) % rawMembers.length;
          standbys.push(rawMembers[mIdx]);
        }
        // 更新指標供未來下次輪到時使用
        rotationPointers[pointerKey] = (startIdx + quota) % rawMembers.length;
      } else {
        selectedMembers = [...rawMembers];
      }

      if (standbys.length > 0) {
        standbyList.push({
          dateStr,
          teamName: assignedTeam.teamName,
          standbys
        });
      }

      // 指派給 slots
      daySlots.forEach((slot, slotIdx) => {
        // 檢查覆蓋策略
        if (overwriteStrategy === 'empty_only' && slot.memberName) {
          skippedSlots.push({ slotId: slot.id, reason: '已有排班故保留' });
          return;
        }

        const memberName = selectedMembers[slotIdx] || '';
        const memberObj = memberName ? nameToMember.get(memberName) : null;

        slot.memberName = memberName;
        slot.memberId = memberObj ? memberObj.id : (memberName ? memberName : '');
        slot.status = memberName ? '已排班' : '未指派';

        // 檢查東港衝突
        if (memberName && otherMap.has(dateStr)) {
          const otherConflicts = otherMap.get(dateStr).filter(o => o.memberName === memberName);
          if (otherConflicts.length > 0) {
            conflicts.push({
              dateStr,
              memberName,
              slotId: slot.id,
              currentLocation: location,
              currentShift: slot.shiftLabel,
              otherLocation: otherConflicts[0].location || '東港聯絡處',
              otherShift: otherConflicts[0].shiftLabel || '值班',
              suggestAction: '優先保留園區排班，建議調動東港值班人員'
            });
          }
        }
      });

      scheduledDetails.push({
        dateStr,
        dayOfWeek,
        teamIndex,
        heqi: assignedHeqi,
        teamName: assignedTeam.teamName,
        assignedCount: Math.min(selectedMembers.length, quota),
        assignedMembers: selectedMembers.slice(0, quota),
        standbys
      });
    }

    return {
      matrixList: newMatrix,
      scheduledDetails,
      conflicts,
      standbyList,
      skippedSlots,
      updatedRotationPointers: rotationPointers
    };
  }

  return {
    rules,
    weekRotation,
    loading,
    getWeekDiff,
    getHeqiForDate,
    getHeqiRoundIndex,
    fetchRules,
    fetchWeekRotation,
    saveRule,
    saveWeekRotation,
    generateAutoSchedule
  };
});

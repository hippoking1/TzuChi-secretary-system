import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getDocById, setDocById, deleteDocById, getCollectionDocs, batchWriteItems } from '@/firebase/db';
import { getStandardShiftConfig, getStandardShiftQuota } from '@/stores/duties';

/**
 * 取得排班規則之基本需求人數 (自適應當前道場與班次)
 */
export function getRuleQuota(rule) {
  if (!rule) return 4;
  if (typeof rule.quota === 'number' && rule.quota > 0) {
    return rule.quota;
  }
  return getStandardShiftQuota(rule.location, rule.shiftId, rule.genderType);
}

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

// 宜蘭園區和氣二女眾標準規則物件
export const DEFAULT_HEQI2_CAMPUS_FEMALE_RULE = {
  id: 'rule_heqi2_campus_female',
  ruleName: '宜蘭園區和氣二女眾值班規則',
  heqiGroup: '和氣二',
  location: '宜蘭園區',
  shiftId: 'YL_F',
  shiftLabel: '女眾班',
  genderType: '女',
  quota: 4,
  ruleType: 'weekday_group_rotation', // 星期 × 整組輪替
  weekdayTeams: JSON.parse(JSON.stringify(DEFAULT_HEQI2_FEMALE_TEAMS)),
  rotationPointers: {},
  enabled: true
};

// 東港聯絡處男眾班平日/假日輪值標準名單
export const DEFAULT_DONGGANG_MALE_WEEKDAY_MEMBERS = [
  '游天祥', '林茂祥', '林明村', '鄭文松', '石有杉', '陳振川', '林東建', '李長和',
  '吳福源', '陳榮忠', '吳順王', '陳茂春', '李世清', '吳金福', '楊志忠', '呂連通',
  '黃國材', '吳世明', '許國基', '林俊宏', '趙正文', '黃木村'
];

export const DEFAULT_DONGGANG_MALE_WEEKEND_MEMBERS = [
  '何忠憲', '黃文彬', '徐棟樑', '洪光賢', '林子民', '羅文熙', '龔福鳴', '張振益',
  '莊盧達', '黃志煌', '葉文熙', '薛登霖', '李自強', '莊漢僑'
];

export const DEFAULT_DONGGANG_MALE_RULE = {
  id: 'rule_donggang_male',
  ruleName: '東港聯絡處男眾值班規則',
  heqiGroup: '全區通用',
  location: '東港聯絡處',
  shiftId: 'DG_M',
  shiftLabel: '男眾班',
  genderType: '男',
  quota: 1,
  ruleType: 'weekday_weekend_sequential', // 平日/假日雙軌循序循環輪替
  weekdayMembers: [...DEFAULT_DONGGANG_MALE_WEEKDAY_MEMBERS],
  weekendMembers: [...DEFAULT_DONGGANG_MALE_WEEKEND_MEMBERS],
  rotationPointers: {
    weekday: 0,
    weekend: 0
  },
  enabled: true
};

// 預設和氣週輪值設定（宜蘭園區）
export const DEFAULT_WEEK_ROTATION = {
  id: 'campus_week_rotation',
  location: '宜蘭園區',
  rotationOrder: ['和氣一', '和氣二', '和氣三', '和氣四'],
  // 基準週起始日（以 2027-01-04 週一為基準，當週為和氣一）
  baseStartDate: '2027-01-04',
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
    const base = parseDateToMidnight(rotationConfig.baseStartDate || '2027-01-04');
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
   * 載入排班規則清單（若未指定 location 則載入所有道場與和氣之規則）
   */
  async function fetchRules(location = null) {
    loading.value = true;
    try {
      const docs = await getCollectionDocs('dutySchedulingRules');
      let all = [...docs];

      // 若和氣二宜蘭女眾規則尚未存在，以預設規則呈現
      const hasHeqi2 = all.some(r => r.heqiGroup === '和氣二' && r.location === '宜蘭園區' && r.shiftId === 'YL_F');
      if (!hasHeqi2) {
        all.push({ ...DEFAULT_HEQI2_CAMPUS_FEMALE_RULE });
      }

      // 若東港聯絡處男眾規則尚未存在，以預設規則呈現
      const hasDonggangMale = all.some(r => r.location === '東港聯絡處' && r.shiftId === 'DG_M');
      if (!hasDonggangMale) {
        all.push({ ...DEFAULT_DONGGANG_MALE_RULE });
      }

      const filtered = location ? all.filter(r => r.location === location) : all;
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
      await fetchRules();
      return ruleId;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 刪除特定規則
   */
  async function deleteRule(ruleId) {
    loading.value = true;
    try {
      await deleteDocById('dutySchedulingRules', ruleId);
      rules.value = rules.value.filter(r => r.id !== ruleId);
      return true;
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
   * 核心自動排班產生演算法（支援宜蘭園區與東港聯絡處、支援跨月自訂區間）
   * @param {Object} options
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

    // 尋找目標規則：依據傳入 ruleId、場地自選或自動配對
    let rule = targetRule;
    if (!rule && ruleId) {
      rule = rules.value.find(r => r.id === ruleId);
    }
    if (!rule) {
      if (location === '東港聯絡處') {
        rule = rules.value.find(r => r.location === '東港聯絡處' && r.enabled !== false) || DEFAULT_DONGGANG_MALE_RULE;
      } else {
        rule = rules.value.find(r => r.location === '宜蘭園區' && r.heqiGroup === '和氣二' && r.shiftId === 'YL_F' && r.enabled !== false) || DEFAULT_HEQI2_CAMPUS_FEMALE_RULE;
      }
    }

    const rotationPointers = { ...(rule.rotationPointers || {}) };

    // 決定遍歷起訖範圍（支援跨越任意月份之自訂區間）
    let startD = startDate ? parseDateToMidnight(startDate) : new Date(year, month - 1, 1);
    let endD = endDate ? parseDateToMidnight(endDate) : new Date(year, month, 0);

    if (startD.getTime() > endD.getTime()) {
      const tmp = startD;
      startD = endD;
      endD = tmp;
    }

    // 複製目前矩陣
    const newMatrix = currentMatrix.map(slot => ({ ...slot }));
    const allGeneratedSlots = [];

    // 紀錄各項資訊
    const scheduledDetails = [];
    const conflicts = [];
    const standbyList = []; // 備用名單紀錄
    const skippedSlots = [];

    // 另一場地現有排班對照表：date -> list of duties
    const otherMap = new Map();
    otherLocationDuties.forEach(d => {
      if (d.dutyDate && d.memberName) {
        if (!otherMap.has(d.dutyDate)) otherMap.set(d.dutyDate, []);
        otherMap.get(d.dutyDate).push(d);
      }
    });

    const curr = new Date(startD.getTime());
    while (curr <= endD) {
      const y = curr.getFullYear();
      const m = String(curr.getMonth() + 1).padStart(2, '0');
      const d = String(curr.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      const dayOfWeek = String(curr.getDay()); // '0' ~ '6'

      // ─── 模式 A：平日/假日雙軌循序循環輪替（依據規則類型判定，不再硬編碼道場） ───
      if (rule.ruleType === 'weekday_weekend_sequential') {
        const isWeekend = (dayOfWeek === '0' || dayOfWeek === '6');
        const pool = isWeekend ? (rule.weekendMembers || []) : (rule.weekdayMembers || []);
        
        if (pool.length === 0) {
          curr.setDate(curr.getDate() + 1);
          continue;
        }

        const pointerKey = isWeekend ? 'weekend' : 'weekday';
        let curPointer = rotationPointers[pointerKey] || 0;

        // 挑選志工（支援宜蘭園區衝突時優先保留園區，東港自動調動順延接替）
        let chosenMember = null;
        let conflictAdjustedInfo = null;

        for (let attempt = 0; attempt < pool.length; attempt++) {
          const candidateIdx = (curPointer + attempt) % pool.length;
          const candidateName = (pool[candidateIdx] || '').trim();
          if (!candidateName) continue;

          // 檢查該候選志工當日是否已排在宜蘭園區 (以園區為優先)
          const hasCampusConflict = otherMap.has(dateStr) && otherMap.get(dateStr).some(o => o.memberName === candidateName);
          
          if (!hasCampusConflict) {
            chosenMember = candidateName;
            curPointer = (candidateIdx + 1) % pool.length;
            break;
          } else {
            if (!conflictAdjustedInfo) {
              const conflictShift = otherMap.get(dateStr).find(o => o.memberName === candidateName);
              conflictAdjustedInfo = {
                dateStr,
                originalMember: candidateName,
                conflictLocation: conflictShift?.location || '宜蘭園區',
                conflictShiftLabel: conflictShift?.shiftLabel || '值班'
              };
            }
          }
        }

        if (!chosenMember) {
          chosenMember = (pool[curPointer % pool.length] || '').trim();
          curPointer = (curPointer + 1) % pool.length;
        }

        rotationPointers[pointerKey] = curPointer;

        if (conflictAdjustedInfo) {
          conflicts.push({
            dateStr,
            memberName: conflictAdjustedInfo.originalMember,
            replaceName: chosenMember,
            currentLocation: location,
            currentShift: rule.shiftLabel || '男眾班',
            otherLocation: conflictAdjustedInfo.conflictLocation,
            otherShift: conflictAdjustedInfo.conflictShiftLabel,
            suggestAction: `已優先保留園區排班，東港排班由「${chosenMember}」接替輪值`
          });
        }

        const slotNumber = 1;
        const memberObj = chosenMember ? nameToMember.get(chosenMember) : null;
        const daySlotsInMatrix = newMatrix.filter(s => s.dutyDate === dateStr && s.shiftId === (rule.shiftId || 'DG_M'));
        const matrixSlot = daySlotsInMatrix.find(s => s.slotIndex === slotNumber);

        if (overwriteStrategy === 'empty_only' && matrixSlot && matrixSlot.memberName) {
          skippedSlots.push({ slotId: matrixSlot.id, reason: '已有排班故保留' });
          curr.setDate(curr.getDate() + 1);
          continue;
        }

        if (matrixSlot) {
          matrixSlot.memberName = chosenMember;
          matrixSlot.memberId = memberObj ? memberObj.id : (chosenMember || '');
          matrixSlot.status = chosenMember ? '已排班' : '未指派';
        }

        const slotItem = {
          id: `${location}_${dateStr}_${rule.shiftId || 'DG_M'}_${slotNumber}`,
          location,
          dutyDate: dateStr,
          shiftId: rule.shiftId || 'DG_M',
          shiftLabel: rule.shiftLabel || '男眾班',
          shiftStart: '13:00',
          shiftEnd: '17:00',
          timeRange: '13:00~17:00',
          quota: 1,
          slotIndex: slotNumber,
          genderType: '男',
          isWeekend,
          memberId: memberObj ? memberObj.id : (chosenMember || ''),
          memberName: chosenMember || '',
          status: chosenMember ? '已排班' : '未指派'
        };
        allGeneratedSlots.push(slotItem);

        scheduledDetails.push({
          dateStr,
          dayOfWeek,
          teamName: isWeekend ? '假日輪值' : '平日輪值',
          heqi: isWeekend ? '假日組' : '平日組',
          assignedCount: 1,
          assignedMembers: [chosenMember],
          standbys: [],
          adjustedFrom: conflictAdjustedInfo?.originalMember || null
        });

        curr.setDate(curr.getDate() + 1);
        continue;
      }

      // ─── 模式 B：星期 × 整組循環輪替（自適應當前道場與班次基本需求席次） ───
      const weekdayTeams = rule.weekdayTeams || DEFAULT_HEQI2_FEMALE_TEAMS;

      // 檢查此日是否符合該規則輪值和氣
      const targetHeqi = rule.heqiGroup || '全區通用';
      const assignedHeqi = getHeqiForDate(dateStr);
      const isTargetHeqiTurn = (targetHeqi === '全區通用') || (assignedHeqi === targetHeqi);
      const shouldApplyRule = (mode === 'force_heqi2') || isTargetHeqiTurn;

      if (!shouldApplyRule) {
        curr.setDate(curr.getDate() + 1);
        continue;
      }

      // 取得該星期幾所定義的組別名冊清單
      const teams = weekdayTeams[dayOfWeek] || [];
      if (teams.length === 0) {
        curr.setDate(curr.getDate() + 1);
        continue;
      }

      // 組別輪替依「自基準日起算的該和氣輪值週次」循序下輪
      let teamIndex = 0;
      if (isTargetHeqiTurn && targetHeqi !== '全區通用') {
        const roundIndex = getHeqiRoundIndex(dateStr, targetHeqi);
        teamIndex = ((roundIndex % teams.length) + teams.length) % teams.length;
      } else {
        // 全區通用或強制模式下，依週次差循序推進
        const diffWeeks = getWeekDiff(dateStr);
        teamIndex = ((diffWeeks % teams.length) + teams.length) % teams.length;
      }

      const assignedTeam = teams[teamIndex];
      if (!assignedTeam || !Array.isArray(assignedTeam.members)) {
        curr.setDate(curr.getDate() + 1);
        continue;
      }

      const rawMembers = assignedTeam.members.map(n => (n || '').trim()).filter(Boolean);
      if (rawMembers.length === 0) {
        curr.setDate(curr.getDate() + 1);
        continue;
      }

      // 自適應取得該道場與班次所需人數（例如東港女眾班為 2，園區女眾班為 4）
      const quota = getRuleQuota(rule);

      // 處理人數 > quota 的備用輪替機制（方案B）
      let selectedMembers = [];
      let standbys = [];

      const pointerKey = `${dayOfWeek}_${teamIndex}`;
      let startIdx = rotationPointers[pointerKey] || 0;

      if (rawMembers.length > quota) {
        for (let i = 0; i < quota; i++) {
          const mIdx = (startIdx + i) % rawMembers.length;
          selectedMembers.push(rawMembers[mIdx]);
        }
        for (let i = quota; i < rawMembers.length; i++) {
          const mIdx = (startIdx + i) % rawMembers.length;
          standbys.push(rawMembers[mIdx]);
        }
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

      // 取得班次時間常數配置
      const shiftConfig = getStandardShiftConfig(location, rule.shiftId, rule.shiftLabel);
      const shiftStart = shiftConfig?.startTime || '08:00';
      const shiftEnd = shiftConfig?.endTime || (quota <= 2 ? '13:00' : '16:00');
      const timeRange = shiftConfig?.timeRange || `${shiftStart}~${shiftEnd}`;

      const daySlotsInMatrix = newMatrix.filter(s => s.dutyDate === dateStr && s.shiftId === (rule.shiftId || 'YL_F'));

      for (let slotIdx = 0; slotIdx < quota; slotIdx++) {
        const slotNumber = slotIdx + 1;
        const memberName = selectedMembers[slotIdx] || '';
        const memberObj = memberName ? nameToMember.get(memberName) : null;

        const matrixSlot = daySlotsInMatrix.find(s => s.slotIndex === slotNumber);
        if (overwriteStrategy === 'empty_only' && matrixSlot && matrixSlot.memberName) {
          skippedSlots.push({ slotId: matrixSlot.id, reason: '已有排班故保留' });
          continue;
        }

        if (matrixSlot) {
          matrixSlot.memberName = memberName;
          matrixSlot.memberId = memberObj ? memberObj.id : (memberName || '');
          matrixSlot.status = memberName ? '已排班' : '未指派';
        }

        const slotItem = {
          id: `${location}_${dateStr}_${rule.shiftId || 'YL_F'}_${slotNumber}`,
          location,
          dutyDate: dateStr,
          shiftId: rule.shiftId || 'YL_F',
          shiftLabel: rule.shiftLabel || '女眾班',
          shiftStart,
          shiftEnd,
          timeRange,
          quota,
          slotIndex: slotNumber,
          genderType: rule.genderType || '女',
          isWeekend: dayOfWeek === '0' || dayOfWeek === '6',
          memberId: memberObj ? memberObj.id : (memberName || ''),
          memberName: memberName || '',
          status: memberName ? '已排班' : '未指派'
        };
        allGeneratedSlots.push(slotItem);

        // 檢查跨場地衝突
        if (memberName && otherMap.has(dateStr)) {
          const otherConflicts = otherMap.get(dateStr).filter(o => o.memberName === memberName);
          if (otherConflicts.length > 0) {
            conflicts.push({
              dateStr,
              memberName,
              slotId: slotItem.id,
              currentLocation: location,
              currentShift: slotItem.shiftLabel,
              otherLocation: otherConflicts[0].location || '東港聯絡處',
              otherShift: otherConflicts[0].shiftLabel || '值班',
              suggestAction: '優先保留園區排班，建議調動東港值班人員'
            });
          }
        }
      }

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

      curr.setDate(curr.getDate() + 1);
    }

    return {
      matrixList: newMatrix,
      allGeneratedSlots,
      scheduledDetails,
      conflicts,
      standbyList,
      skippedSlots,
      updatedRotationPointers: rotationPointers,
      ruleId: rule?.id
    };
  }

  /**
   * 將自動排班產生的席位清單批次儲存至 Firestore
   * @param {Array} slots
   * @param {Object} updatedPointers
   * @param {string} ruleId
   */
  async function saveAutoScheduleToDb(slots = [], updatedPointers = null, ruleId = null) {
    loading.value = true;
    try {
      if (slots && slots.length > 0) {
        await batchWriteItems('dutyShifts', slots, 'set');
      }
      if (updatedPointers && Object.keys(updatedPointers).length > 0 && ruleId) {
        const found = rules.value.find(r => r.id === ruleId);
        if (found) {
          found.rotationPointers = { ...(found.rotationPointers || {}), ...updatedPointers };
          await setDocById('dutySchedulingRules', ruleId, found);
        }
      }
      return true;
    } finally {
      loading.value = false;
    }
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
    deleteRule,
    saveWeekRotation,
    generateAutoSchedule,
    saveAutoScheduleToDb
  };
});

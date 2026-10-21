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

export const DEFAULT_DONGGANG_FEMALE_RULE = {
  id: 'rule_donggang_female',
  ruleName: '東港聯絡處女眾值班規則',
  heqiGroup: '全區通用',
  location: '東港聯絡處',
  shiftId: 'DG_F',
  shiftLabel: '女眾班',
  genderType: '女',
  quota: 2,
  ruleType: 'weekday_group_rotation', // 星期 × 整組循環輪替 (依組別人員數全員排班，不限人數上限)
  weekdayTeams: {
    '1': [{ teamName: '第一組', members: [] }],
    '2': [{ teamName: '第一組', members: [] }],
    '3': [{ teamName: '第一組', members: [] }],
    '4': [{ teamName: '第一組', members: [] }],
    '5': [{ teamName: '第一組', members: [] }],
    '6': [{ teamName: '第一組', members: [] }],
    '0': [{ teamName: '第一組', members: [] }]
  },
  rotationPointers: {},
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

      // 若東港聯絡處女眾規則尚未存在，以預設規則呈現
      const hasDonggangFemale = all.some(r => r.location === '東港聯絡處' && r.shiftId === 'DG_F');
      if (!hasDonggangFemale) {
        all.push({ ...DEFAULT_DONGGANG_FEMALE_RULE });
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
  function generateAutoSchedule(options = {}) {
    const {
      location = '宜蘭園區',
      year,
      month,
      startDate = null, // 自訂區間起 'YYYY-MM-DD'
      endDate = null,   // 自訂區間訖 'YYYY-MM-DD'
      currentMatrix = [],
      otherLocationDuties = [],
      hospitalDuties = [], // 預排醫院志工清單 (第一優先級：醫院志工 > 宜蘭園區 > 東港聯絡處)
      allMembers = [],
      ruleId = null,    // 目標規則 ID
      mode = 'heqi_only', // 'heqi_only' | 'force_heqi2'
      overwriteStrategy = 'overwrite', // 'overwrite' | 'empty_only'
      targetRule = null,
      customStartTeamIndex = null,   // 自訂星期整組輪替起始組別 (0-indexed: 0=第一組, 1=第二組...)
      startWeekdayMember = null,     // 自訂平日輪值起始志工姓名
      startWeekendMember = null,     // 自訂假日輪值起始志工姓名
      balanceScope = 'local'         // 輪值均衡基準：'local' (各道場獨立公平，預設) | 'cross_location' (跨場地總量平衡)
    } = options;

    // 尋找目標規則：依據傳入 targetRule、ruleId、場地自選或自動配對
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
    if (!rule) {
      rule = DEFAULT_HEQI2_CAMPUS_FEMALE_RULE;
    }

    // 建立姓名與志工物件對應字典 (若有同名同姓，優先配對符合當前規則眾別與所屬和氣之志工)
    const nameToMembers = new Map();
    allMembers.forEach(m => {
      const name = (m.name || '').trim();
      if (!name) return;
      if (!nameToMembers.has(name)) nameToMembers.set(name, []);
      nameToMembers.get(name).push(m);
    });

    function findMemberObj(name) {
      if (!name) return null;
      const clean = name.replace(/^[★*☆\s]+/, '').trim();
      const list = nameToMembers.get(clean) || nameToMembers.get(name);
      if (!list || list.length === 0) return null;
      if (list.length === 1) return list[0];

      // 若同名同姓，優先配對眾別相符者
      const targetGender = rule?.genderType;
      const genderMatches = targetGender ? list.filter(m => m.gender === targetGender) : list;
      if (genderMatches.length === 1) return genderMatches[0];

      // 若仍有多位，優先配對與規則所屬和氣相符者
      const ruleHeqi = rule?.heqiGroup;
      if (ruleHeqi && ruleHeqi !== '全區通用') {
        const heqiMatch = (genderMatches.length > 0 ? genderMatches : list).find(m => {
          return (m.orgName && m.orgName.includes(ruleHeqi)) || (m.orgPath && m.orgPath.includes(ruleHeqi));
        });
        if (heqiMatch) return heqiMatch;
      }

      return (genderMatches.length > 0 ? genderMatches[0] : list[0]);
    }

    const rotationPointers = { ...(rule?.rotationPointers || {}) };

    // 若有自訂平日或假日起始志工，設定起始 pointer
    if (startWeekdayMember && Array.isArray(rule?.weekdayMembers)) {
      const idx = rule.weekdayMembers.findIndex(n => (n || '').trim() === startWeekdayMember.trim());
      if (idx >= 0) {
        rotationPointers.weekday = idx;
      }
    }
    if (startWeekendMember && Array.isArray(rule?.weekendMembers)) {
      const idx = rule.weekendMembers.findIndex(n => (n || '').trim() === startWeekendMember.trim());
      if (idx >= 0) {
        rotationPointers.weekend = idx;
      }
    }

    // 決定遍歷起訖範圍（支援跨越任意月份之自訂區間）
    let startD = startDate ? parseDateToMidnight(startDate) : new Date(year, month - 1, 1);
    let endD = endDate ? parseDateToMidnight(endDate) : new Date(year, month, 0);

    if (startD.getTime() > endD.getTime()) {
      const tmp = startD;
      startD = endD;
      endD = tmp;
    }

    // 計算排班區間起始週差與組別控制變數
    const hasCustomStartTeam = (customStartTeamIndex !== null && customStartTeamIndex !== undefined && customStartTeamIndex !== '' && !isNaN(Number(customStartTeamIndex)));
    const forcedStartTeamIndex = hasCustomStartTeam ? Number(customStartTeamIndex) : null;

    const startYear = startD.getFullYear();
    const startMonth = String(startD.getMonth() + 1).padStart(2, '0');
    const startDay = String(startD.getDate()).padStart(2, '0');
    const startDateStr = `${startYear}-${startMonth}-${startDay}`;
    const firstWeekDiff = getWeekDiff(startDateStr);
    let firstCampusRoundIndex = null;

    // 複製目前矩陣
    const newMatrix = currentMatrix.map(slot => ({ ...slot }));
    const allGeneratedSlots = [];
    const deletedSlots = [];

    // 紀錄各項資訊
    const scheduledDetails = [];
    const conflicts = [];
    const standbyList = []; // 備用名單紀錄
    const skippedSlots = [];

    // 1. 醫院志工預排對照表 (最高優先權：醫院志工 > 宜蘭園區 > 東港聯絡處)
    const hospitalMap = new Map();
    hospitalDuties.forEach(d => {
      if (d.dutyDate && d.memberName) {
        if (!hospitalMap.has(d.dutyDate)) hospitalMap.set(d.dutyDate, []);
        hospitalMap.get(d.dutyDate).push(d);
      }
    });

    // 2. 另一場地現有排班對照表：date -> list of duties
    const otherMap = new Map();
    otherLocationDuties.forEach(d => {
      if (d.dutyDate && d.memberName) {
        if (!otherMap.has(d.dutyDate)) otherMap.set(d.dutyDate, []);
        otherMap.get(d.dutyDate).push(d);
      }
    });

    // 跨場地/醫院志工衝突同星期組別互換映射表：dayOfWeek -> { [swappedTeamIdx]: Array<{ paybackIdx, sinceDate }> }
    // 升級為 FIFO 佇列陣列，支援跨週次與跨月份記憶，多次代班不覆蓋待還紀錄（自動忽略該區間之後的互換紀錄以維持冪等性）
    const pendingTeamSwaps = {};
    if (rotationPointers._pendingTeamSwaps && typeof rotationPointers._pendingTeamSwaps === 'object') {
      for (const [dKey, dayObj] of Object.entries(rotationPointers._pendingTeamSwaps)) {
        if (dayObj && typeof dayObj === 'object') {
          pendingTeamSwaps[dKey] = {};
          for (const [tKey, entries] of Object.entries(dayObj)) {
            const rawList = Array.isArray(entries) ? entries : [entries];
            const validList = rawList
              .filter(entry => {
                const since = typeof entry === 'object' ? (entry.sinceDate || '') : '';
                return !since || since < startDateStr;
              })
              .map(entry => typeof entry === 'object' ? { ...entry } : { paybackIdx: Number(entry), sinceDate: '' });
            if (validList.length > 0) {
              pendingTeamSwaps[dKey][tKey] = validList;
            }
          }
        }
      }
    }

    // 個人雙軌輪替（如東港男眾）之「待補班佇列」與「預支代班抵扣清單」持久化支援
    const pendingSeqOwed = { weekday: [], weekend: [] };
    if (rotationPointers._pendingSeqOwed && typeof rotationPointers._pendingSeqOwed === 'object') {
      ['weekday', 'weekend'].forEach(k => {
        const list = rotationPointers._pendingSeqOwed[k];
        if (Array.isArray(list)) {
          pendingSeqOwed[k] = list.filter(item => !item.sinceDate || item.sinceDate < startDateStr).map(x => ({ ...x }));
        }
      });
    }

    const preServedSeqCredits = { weekday: [], weekend: [] };
    if (rotationPointers._preServedSeqCredits && typeof rotationPointers._preServedSeqCredits === 'object') {
      ['weekday', 'weekend'].forEach(k => {
        const list = rotationPointers._preServedSeqCredits[k];
        if (Array.isArray(list)) {
          preServedSeqCredits[k] = list.filter(item => !item.sinceDate || item.sinceDate < startDateStr).map(x => ({ ...x }));
        }
      });
    }

    // 累積值班次數動態追蹤（用於負載平衡最少班次優先）
    const memberLocalCounts = new Map();
    const memberCrossCounts = new Map();

    function cleanMemberName(name) {
      if (!name) return '';
      return name.replace(/[★*☆\s]/g, '').trim();
    }

    // 初始化跨場地次數 (醫院志工 + 宜蘭園區)
    hospitalDuties.forEach(d => {
      const c = cleanMemberName(d.memberName);
      if (c) memberCrossCounts.set(c, (memberCrossCounts.get(c) || 0) + 1);
    });
    otherLocationDuties.forEach(d => {
      const c = cleanMemberName(d.memberName);
      if (c) memberCrossCounts.set(c, (memberCrossCounts.get(c) || 0) + 1);
    });

    // 初始化本場地既有排班次數 (若保留現有排班)
    if (overwriteStrategy === 'empty_only') {
      currentMatrix.forEach(s => {
        const c = cleanMemberName(s.memberName);
        if (c) memberLocalCounts.set(c, (memberLocalCounts.get(c) || 0) + 1);
      });
    }

    function getMemberBalanceWeight(name) {
      const clean = cleanMemberName(name);
      const local = memberLocalCounts.get(clean) || 0;
      if (balanceScope === 'cross_location') {
        const cross = memberCrossCounts.get(clean) || 0;
        return local + cross;
      }
      return local;
    }

    // 組別在當前區間內的累積執勤次數（避免東港女眾固定與園區 4 週輪值共振撞期）
    const teamServeCounts = {};

    function getTeamCandidates(team, q, startIdx = 0, isWholeTeam = false) {
      if (!team || !Array.isArray(team.members)) return { selected: [], standbys: [] };
      const raw = team.members.map(n => (n || '').trim()).filter(Boolean);
      if (raw.length === 0) return { selected: [], standbys: [] };
      if (isWholeTeam) {
        return { selected: [...raw], standbys: [] };
      }
      const selected = [];
      const standbys = [];
      if (raw.length > q) {
        for (let i = 0; i < q; i++) {
          selected.push(raw[(startIdx + i) % raw.length]);
        }
        for (let i = q; i < raw.length; i++) {
          standbys.push(raw[(startIdx + i) % raw.length]);
        }
      } else {
        selected.push(...raw);
      }
      return { selected, standbys };
    }

    const isCampusDuty = (location === '宜蘭園區');

    /**
     * 依排班優先順序（醫院志工 > 宜蘭園區值班 > 東港聯絡處值班）檢查單一志工於指定日期是否與高優先級排班衝突
     */
    function checkSingleMemberHigherPriorityConflict(name, dStr) {
      const clean = cleanMemberName(name);
      if (!clean) return null;

      // 第一優先：醫院志工 (宜蘭園區與東港聯絡處遇到醫院志工皆須迴避調換)
      if (hospitalMap.has(dStr)) {
        const dayHosp = hospitalMap.get(dStr);
        const hospHit = dayHosp.find(h => {
          const hName = cleanMemberName(h.memberName);
          return hName === clean || h.memberName === name;
        });
        if (hospHit) {
          return {
            memberName: name,
            cleanName: clean,
            conflictType: 'hospital',
            conflictLocation: '醫院志工',
            conflictShift: hospHit.hospitalName || hospHit.shiftLabel || '醫院志工'
          };
        }
      }

      // 第二優先：宜蘭園區值班 (當排定東港聯絡處等非園區班表時，遇到宜蘭園區值班須迴避調換)
      if (!isCampusDuty && otherMap.has(dStr)) {
        const dayOther = otherMap.get(dStr);
        const hit = dayOther.find(o => {
          const oName = cleanMemberName(o.memberName);
          return oName === clean || o.memberName === name;
        });
        if (hit) {
          return {
            memberName: name,
            cleanName: clean,
            conflictType: 'campus',
            conflictLocation: hit.location || '宜蘭園區',
            conflictShift: hit.shiftLabel || '值班'
          };
        }
      }

      return null;
    }

    /**
     * 檢查組別候選名單是否與更高優先級排班（醫院志工 / 宜蘭園區）衝突
     */
    function checkMembersHigherPriorityConflict(memberList, dStr) {
      const res = [];
      memberList.forEach(name => {
        const hit = checkSingleMemberHigherPriorityConflict(name, dStr);
        if (hit) res.push(hit);
      });
      return res;
    }

    const curr = new Date(startD.getTime());
    while (curr <= endD) {
      const y = curr.getFullYear();
      const m = String(curr.getMonth() + 1).padStart(2, '0');
      const d = String(curr.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      const dayOfWeek = String(curr.getDay()); // '0' ~ '6'

      // ─── 模式 A：平日/假日雙軌循序循環輪替（依據規則類型判定，支援醫院志工 > 宜蘭園區 > 東港聯絡處） ───
      if (rule.ruleType === 'weekday_weekend_sequential') {
        const isWeekend = (dayOfWeek === '0' || dayOfWeek === '6');
        const pool = isWeekend ? (rule.weekendMembers || []) : (rule.weekdayMembers || []);
        
        if (pool.length === 0) {
          curr.setDate(curr.getDate() + 1);
          continue;
        }

        const pointerKey = isWeekend ? 'weekend' : 'weekday';
        let curPointer = rotationPointers[pointerKey] || 0;

        let chosenMember = null;
        let conflictAdjustedInfo = null;
        let isPaybackDuty = false;
        let paybackOriginInfo = null;

        // Step 1: 檢查是否有待補班的志工 (因先前高優先級衝突被延後者)
        if (pendingSeqOwed[pointerKey] && pendingSeqOwed[pointerKey].length > 0) {
          const owedIdx = pendingSeqOwed[pointerKey].findIndex(item => {
            const hit = checkSingleMemberHigherPriorityConflict(item.memberName, dateStr);
            return !hit;
          });
          if (owedIdx >= 0) {
            const owedItem = pendingSeqOwed[pointerKey].splice(owedIdx, 1)[0];
            chosenMember = owedItem.memberName;
            isPaybackDuty = true;
            paybackOriginInfo = owedItem;
            // 補班排定：主指標 curPointer 保持不動，完整保留原本正常輪序
          }
        }

        // Step 2: 若今日無人補班，依常規指標指派（自動跳過已預支代班的志工）
        if (!chosenMember) {
          // 若 pool[curPointer] 先前已代班過 (在 preServedSeqCredits 中)，扣抵一次並推進指標
          let maxCreditsChecks = pool.length;
          while (maxCreditsChecks > 0 && preServedSeqCredits[pointerKey] && preServedSeqCredits[pointerKey].length > 0) {
            const currentCandidateName = cleanMemberName(pool[curPointer % pool.length]);
            const creditIdx = preServedSeqCredits[pointerKey].findIndex(c => cleanMemberName(c.memberName) === currentCandidateName);
            if (creditIdx >= 0) {
              preServedSeqCredits[pointerKey].splice(creditIdx, 1);
              curPointer = (curPointer + 1) % pool.length;
              maxCreditsChecks--;
            } else {
              break;
            }
          }

          const primaryCandidateName = (pool[curPointer % pool.length] || '').trim();
          const primaryConflictHit = checkSingleMemberHigherPriorityConflict(primaryCandidateName, dateStr);

          if (!primaryConflictHit) {
            // 常規當值志工無衝突：直接排定，主指標前進
            chosenMember = primaryCandidateName;
            curPointer = (curPointer + 1) % pool.length;
          } else {
            // 常規當值志工有高優先級衝突：
            // 1. 將原定志工記入待補班佇列 pendingSeqOwed，保留其值班義務
            if (!pendingSeqOwed[pointerKey]) pendingSeqOwed[pointerKey] = [];
            pendingSeqOwed[pointerKey].push({
              memberName: primaryCandidateName,
              sinceDate: dateStr,
              conflictLocation: primaryConflictHit.conflictLocation,
              conflictShift: primaryConflictHit.conflictShift
            });

            conflictAdjustedInfo = {
              dateStr,
              originalMember: primaryCandidateName,
              conflictLocation: primaryConflictHit.conflictLocation,
              conflictShiftLabel: primaryConflictHit.conflictShift
            };

            // 推進主指標，避免整個輪值被卡死在同一人
            curPointer = (curPointer + 1) % pool.length;

            // 2. 挑選代班志工：從剩餘池中挑選「無衝突」且「區間累計值班次數最少」者接替
            const viableSubs = [];
            for (let i = 0; i < pool.length; i++) {
              const subIdx = (curPointer + i) % pool.length;
              const subName = (pool[subIdx] || '').trim();
              if (!subName || subName === primaryCandidateName) continue;
              const subConflict = checkSingleMemberHigherPriorityConflict(subName, dateStr);
              if (subConflict) continue;

              const weight = getMemberBalanceWeight(subName);
              const alreadyCredited = (preServedSeqCredits[pointerKey] || []).filter(c => cleanMemberName(c.memberName) === cleanMemberName(subName)).length;
              viableSubs.push({
                subName,
                subIdx,
                weight: weight + alreadyCredited * 2,
                distance: i
              });
            }

            if (viableSubs.length > 0) {
              // 負載權重越少越優先；平手時依輪替順位距離最近者優先
              viableSubs.sort((a, b) => a.weight - b.weight || a.distance - b.distance);
              const bestSub = viableSubs[0];
              chosenMember = bestSub.subName;

              // 將代班者記入 preServedSeqCredits，未來輪到其順位時可抵扣跳過一次
              if (!preServedSeqCredits[pointerKey]) preServedSeqCredits[pointerKey] = [];
              preServedSeqCredits[pointerKey].push({
                memberName: bestSub.subName,
                sinceDate: dateStr,
                replacedFor: primaryCandidateName
              });
            } else {
              chosenMember = primaryCandidateName;
            }
          }
        }

        rotationPointers[pointerKey] = curPointer;

        if (conflictAdjustedInfo) {
          const priorityTarget = conflictAdjustedInfo.conflictLocation === '醫院志工' ? '醫院志工' : `${conflictAdjustedInfo.conflictLocation}排班`;
          conflicts.push({
            dateStr,
            memberName: conflictAdjustedInfo.originalMember,
            replaceName: chosenMember,
            currentLocation: location,
            currentShift: rule.shiftLabel || '男眾班',
            otherLocation: conflictAdjustedInfo.conflictLocation,
            otherShift: conflictAdjustedInfo.conflictShiftLabel,
            suggestAction: `已優先保留${priorityTarget}，${location}排班由「${chosenMember}」代班輪值（原定志工將於下次優先補班）`
          });
        }

        // 累計本場地值班次數
        if (chosenMember) {
          const cName = cleanMemberName(chosenMember);
          memberLocalCounts.set(cName, (memberLocalCounts.get(cName) || 0) + 1);
        }

        const slotNumber = 1;
        const memberObj = chosenMember ? findMemberObj(chosenMember) : null;
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
          isPayback: isPaybackDuty,
          adjustedFrom: conflictAdjustedInfo?.originalMember || null,
          adjustedNotice: isPaybackDuty
            ? `🔄 【優先補班】補回原定 ${paybackOriginInfo?.sinceDate} 因【${paybackOriginInfo?.conflictLocation}】衝突之班次`
            : (conflictAdjustedInfo
              ? `⚠️ 原定「${conflictAdjustedInfo.originalMember}」因參與【${conflictAdjustedInfo.conflictLocation}】優先，已由「${chosenMember}」代班（原志工保留優先補班）`
              : null)
        });

        curr.setDate(curr.getDate() + 1);
        continue;
      }

      // ─── 模式 B：星期 × 整組循環輪替（自適應當前道場與班次基本需求席次） ───
      const weekdayTeams = rule.weekdayTeams || DEFAULT_HEQI2_FEMALE_TEAMS;

      // 和氣週輪值判定：僅在宜蘭園區且特定和氣規則時生效，非園區道場（如東港聯絡處）或全區通用規則採常態輪替
      const targetHeqi = rule.heqiGroup || '全區通用';
      const assignedHeqi = getHeqiForDate(dateStr);
      
      let shouldApplyRule = true;
      let isTargetHeqiTurn = false;

      if (isCampusDuty && targetHeqi !== '全區通用') {
        isTargetHeqiTurn = (assignedHeqi === targetHeqi);
        shouldApplyRule = (mode === 'force_heqi2' || mode === 'full_month') || isTargetHeqiTurn;
      }

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

      // 組別輪替依「週次」循序下輪（支援自訂起始組別）
      let teamIndex = 0;
      if (isCampusDuty && targetHeqi !== '全區通用') {
        const roundIndex = getHeqiRoundIndex(dateStr, targetHeqi);
        if (forcedStartTeamIndex !== null) {
          if (firstCampusRoundIndex === null) {
            firstCampusRoundIndex = roundIndex;
          }
          const roundOffset = roundIndex - firstCampusRoundIndex;
          teamIndex = ((forcedStartTeamIndex + roundOffset) % teams.length + teams.length) % teams.length;
        } else {
          teamIndex = ((roundIndex % teams.length) + teams.length) % teams.length;
        }
      } else {
        // 非園區（如東港聯絡處）或全區通用或全月強制模式：依自基準日起算的週次差循序推進
        const diffWeeks = getWeekDiff(dateStr);
        if (forcedStartTeamIndex !== null) {
          const weekOffset = diffWeeks - firstWeekDiff;
          teamIndex = ((forcedStartTeamIndex + weekOffset) % teams.length + teams.length) % teams.length;
        } else {
          teamIndex = ((diffWeeks % teams.length) + teams.length) % teams.length;
        }
      }

      // 檢查是否先前曾對換過組別（若先前的週一第一組與第二組對換，則後續輪到第二組時優先對調還給第一組，適用宜蘭園區與東港聯絡處）
      // 升級為多重欠班 FIFO 陣列佇列：若該組幫別人代過班，優先檢查待還班名冊
      const isWholeTeam = (rule.ruleType === 'weekday_group_rotation') || (rule.genderType === '女');
      let isTeamPayback = false;
      let paybackOriginInfo = null;

      if (pendingTeamSwaps[dayOfWeek] && Array.isArray(pendingTeamSwaps[dayOfWeek][teamIndex]) && pendingTeamSwaps[dayOfWeek][teamIndex].length > 0) {
        const swapQueue = pendingTeamSwaps[dayOfWeek][teamIndex];
        const pOwedIdx = swapQueue.findIndex(entry => {
          const paybackIdx = entry.paybackIdx;
          const sinceDate = entry.sinceDate || '';
          if (sinceDate && dateStr <= sinceDate) return false;
          const paybackTeam = teams[paybackIdx];
          if (!paybackTeam || !Array.isArray(paybackTeam.members) || paybackTeam.members.length === 0) return false;
          const pTest = getTeamCandidates(paybackTeam, paybackTeam.members.length, 0, isWholeTeam);
          const pConflicts = checkMembersHigherPriorityConflict(pTest.selected, dateStr);
          return pConflicts.length === 0;
        });

        if (pOwedIdx >= 0) {
          const matchedEntry = swapQueue.splice(pOwedIdx, 1)[0];
          teamIndex = matchedEntry.paybackIdx;
          isTeamPayback = true;
          paybackOriginInfo = matchedEntry;
        }
      }

      let effectiveTeamIndex = teamIndex;
      let assignedTeam = teams[effectiveTeamIndex];
      if (!assignedTeam || !Array.isArray(assignedTeam.members)) {
        curr.setDate(curr.getDate() + 1);
        continue;
      }

      const rawMembers = assignedTeam.members.map(n => (n || '').trim()).filter(Boolean);
      if (rawMembers.length === 0) {
        curr.setDate(curr.getDate() + 1);
        continue;
      }

      // 女眾整組輪替依組別實際人員數進行排班，以整組人員進行排班而不限定一班別的人員上限
      const baseQuota = getRuleQuota(rule);
      let quota = isWholeTeam ? Math.max(1, rawMembers.length) : baseQuota;

      let selectedMembers = [];
      let standbys = [];
      let swapConflictNotice = null;

      // 檢查更高優先級排班衝突（優先順序：醫院志工 > 宜蘭園區值班 > 東港聯絡處值班）並執行同星期後一組對換機制
      // 規則：無論宜蘭園區或東港聯絡處，若當日組別成員與更高優先級排班衝突，與同星期的後一組對換；若後一組也有衝突，換成與再後一組對換，以此類推直到沒有衝突為止
      const pointerKey = `${dayOfWeek}_${effectiveTeamIndex}`;
      const startIdx = isWholeTeam ? 0 : (rotationPointers[pointerKey] || 0);
      const initialCandidates = getTeamCandidates(assignedTeam, quota, startIdx, isWholeTeam);
      const initialConflicts = checkMembersHigherPriorityConflict(initialCandidates.selected, dateStr);

      if (initialConflicts.length > 0) {
        let swappedSuccess = false;
        const originalTeamName = assignedTeam.teamName || `第${effectiveTeamIndex + 1}組`;
        const conflictMembersText = initialConflicts.map(c => c.memberName).join('、');
        const conflictLocNames = [...new Set(initialConflicts.map(c => c.conflictLocation))].join('、');
        const conflictBadgeTitle = conflictLocNames.includes('醫院志工') ? '醫院志工衝突自動調換' : '跨場地衝突自動調換';

        // 收集所有無衝突的同星期後續候選組別
        const candidatePool = [];
        for (let step = 1; step < teams.length; step++) {
          const candidateTeamIdx = (effectiveTeamIndex + step) % teams.length;
          const candidateTeam = teams[candidateTeamIdx];
          if (!candidateTeam || !Array.isArray(candidateTeam.members) || candidateTeam.members.length === 0) continue;

          const candMembers = candidateTeam.members.map(n => (n || '').trim()).filter(Boolean);
          if (candMembers.length === 0) continue;

          const candQuota = isWholeTeam ? Math.max(1, candMembers.length) : baseQuota;
          const candPointerKey = `${dayOfWeek}_${candidateTeamIdx}`;
          const candStartIdx = isWholeTeam ? 0 : (rotationPointers[candPointerKey] || 0);
          const candCandidates = getTeamCandidates(candidateTeam, candQuota, candStartIdx, isWholeTeam);
          const candConflicts = checkMembersHigherPriorityConflict(candCandidates.selected, dateStr);

          if (candConflicts.length === 0) {
            // 計算該組累積執勤次數（負載）
            const servedCount = (teamServeCounts[dayOfWeek] && teamServeCounts[dayOfWeek][candidateTeamIdx]) || 0;
            candidatePool.push({
              candidateTeamIdx,
              candidateTeam,
              candQuota,
              candCandidates,
              candPointerKey,
              candStartIdx,
              servedCount,
              distance: step
            });
          }
        }

        if (candidatePool.length > 0) {
          // 關鍵優化：累積值班次數最少者優先代班！平手時依順位距離最近者優先
          candidatePool.sort((a, b) => a.servedCount - b.servedCount || a.distance - b.distance);
          const bestCand = candidatePool[0];

          swappedSuccess = true;
          effectiveTeamIndex = bestCand.candidateTeamIdx;
          assignedTeam = bestCand.candidateTeam;
          quota = bestCand.candQuota; // 對換組別之席次數依該組實際成員數決定
          selectedMembers = bestCand.candCandidates.selected;
          standbys = bestCand.candCandidates.standbys;

          // 更新 pointer (非整組輪替時)
          if (!isWholeTeam && bestCand.candidateTeam.members.length > quota) {
            rotationPointers[bestCand.candPointerKey] = (bestCand.candStartIdx + quota) % bestCand.candidateTeam.members.length;
          }

          // 記錄組別對換互償映射 (FIFO 陣列佇列，多次代班不覆蓋)
          if (!pendingTeamSwaps[dayOfWeek]) pendingTeamSwaps[dayOfWeek] = {};
          if (!Array.isArray(pendingTeamSwaps[dayOfWeek][bestCand.candidateTeamIdx])) {
            pendingTeamSwaps[dayOfWeek][bestCand.candidateTeamIdx] = [];
          }
          pendingTeamSwaps[dayOfWeek][bestCand.candidateTeamIdx].push({
            paybackIdx: teamIndex,
            sinceDate: dateStr
          });

          const swappedTeamName = bestCand.candidateTeam.teamName || `第${bestCand.candidateTeamIdx + 1}組`;
          const alertNotice = `⚠️ 【${conflictBadgeTitle}】原定${originalTeamName}之成員（${conflictMembersText}）與${conflictLocNames}排班衝突，已依規則與同星期累積值班最少之【${swappedTeamName}】對換值班`;
          swapConflictNotice = {
            dateStr,
            originalTeamName,
            swappedTeamName,
            conflictMembersText,
            conflictLocation: conflictLocNames,
            reason: alertNotice
          };

          conflicts.push({
            dateStr,
            isSwapped: true,
            originalTeamName,
            swappedTeamName,
            memberName: conflictMembersText,
            slotId: `${location}_${dateStr}_${rule.shiftId || (location === '東港聯絡處' ? 'DG_F' : 'YL_F')}_1`,
            currentLocation: location,
            currentShift: rule.shiftLabel || '女眾班',
            otherLocation: conflictLocNames,
            otherShift: initialConflicts.map(c => c.conflictShift).filter(Boolean).join(' / ') || '值班',
            notice: alertNotice,
            suggestAction: `原定【${originalTeamName}】成員與${conflictLocNames}衝突，已自動與同星期後續【${swappedTeamName}】對換值班（原組別保留優先還班）`
          });
        }

        if (!swappedSuccess) {
          selectedMembers = initialCandidates.selected;
          standbys = initialCandidates.standbys;
          if (!isWholeTeam && assignedTeam.members && assignedTeam.members.length > quota) {
            rotationPointers[pointerKey] = (startIdx + quota) % assignedTeam.members.length;
          }
          conflicts.push({
            dateStr,
            isSwapped: false,
            originalTeamName,
            memberName: conflictMembersText,
            slotId: `${location}_${dateStr}_${rule.shiftId || (location === '東港聯絡處' ? 'DG_F' : 'YL_F')}_1`,
            currentLocation: location,
            currentShift: rule.shiftLabel || '女眾班',
            otherLocation: conflictLocNames,
            otherShift: initialConflicts[0]?.conflictShift || '值班',
            notice: `⚠️ 【排班衝突未解】原定${originalTeamName}之成員（${conflictMembersText}）與${conflictLocNames}排班衝突，且同星期後續組別均無法對換，請手動調整！`,
            suggestAction: `優先保留${conflictLocNames}排班，請手動調動${location}值班人員`
          });
        }
      } else {
        selectedMembers = initialCandidates.selected;
        standbys = initialCandidates.standbys;
        if (!isWholeTeam && assignedTeam.members && assignedTeam.members.length > quota) {
          rotationPointers[pointerKey] = (startIdx + quota) % assignedTeam.members.length;
        }
      }

      if (standbys.length > 0) {
        standbyList.push({
          dateStr,
          teamName: assignedTeam.teamName,
          standbys
        });
      }

      // 累計組別執勤次數
      if (!teamServeCounts[dayOfWeek]) teamServeCounts[dayOfWeek] = {};
      teamServeCounts[dayOfWeek][effectiveTeamIndex] = (teamServeCounts[dayOfWeek][effectiveTeamIndex] || 0) + 1;

      // 累計組員執勤次數
      selectedMembers.forEach(memName => {
        const c = cleanMemberName(memName);
        if (c) memberLocalCounts.set(c, (memberLocalCounts.get(c) || 0) + 1);
      });

      // 取得班次時間常數配置
      const shiftConfig = getStandardShiftConfig(location, rule.shiftId, rule.shiftLabel);
      const shiftStart = shiftConfig?.startTime || '08:00';
      const shiftEnd = shiftConfig?.endTime || (location === '東港聯絡處' ? '13:00' : '16:00');
      const timeRange = shiftConfig?.timeRange || `${shiftStart}~${shiftEnd}`;
      const targetShiftId = rule.shiftId || (location === '東港聯絡處' ? 'DG_F' : 'YL_F');

      const daySlotsInMatrix = newMatrix.filter(s => s.dutyDate === dateStr && s.shiftId === targetShiftId);

      for (let slotIdx = 0; slotIdx < quota; slotIdx++) {
        const slotNumber = slotIdx + 1;
        const memberName = selectedMembers[slotIdx] || '';
        const memberObj = memberName ? findMemberObj(memberName) : null;

        const matrixSlot = daySlotsInMatrix.find(s => s.slotIndex === slotNumber);
        if (overwriteStrategy === 'empty_only' && matrixSlot && matrixSlot.memberName) {
          skippedSlots.push({ slotId: matrixSlot.id, reason: '已有排班故保留' });
          continue;
        }

        if (matrixSlot) {
          matrixSlot.memberName = memberName;
          matrixSlot.memberId = memberObj ? memberObj.id : (memberName || '');
          matrixSlot.quota = quota;
          matrixSlot.status = memberName ? '已排班' : '未指派';
        } else {
          // 若原矩陣席位數少於當前組別人數，動態新增席位至 newMatrix
          const newSlotItem = {
            id: `${location}_${dateStr}_${targetShiftId}_${slotNumber}`,
            location,
            dutyDate: dateStr,
            shiftId: targetShiftId,
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
          newMatrix.push(newSlotItem);
        }

        const slotItem = {
          id: `${location}_${dateStr}_${targetShiftId}_${slotNumber}`,
          location,
          dutyDate: dateStr,
          shiftId: targetShiftId,
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

        // 若依然有高優先級衝突則記錄（若無對換成功）
        if (memberName && !swapConflictNotice) {
          const remainConflict = checkSingleMemberHigherPriorityConflict(memberName, dateStr);
          if (remainConflict) {
            conflicts.push({
              dateStr,
              memberName,
              slotId: slotItem.id,
              currentLocation: location,
              currentShift: slotItem.shiftLabel,
              otherLocation: remainConflict.conflictLocation,
              otherShift: remainConflict.conflictShift,
              notice: `⚠️ 【重複排班衝突】志工「${memberName}」與${remainConflict.conflictLocation}同日排班衝突`,
              suggestAction: `優先保留${remainConflict.conflictLocation}排班，建議調動${location}值班人員`
            });
          }
        }
      }

      // 若在覆蓋模式下且該日原矩陣有大於 quota 的多餘席位，予以清理並記錄刪除
      if (overwriteStrategy === 'overwrite') {
        const extraSlots = daySlotsInMatrix.filter(s => s.slotIndex > quota);
        extraSlots.forEach(extra => {
          const rmIdx = newMatrix.findIndex(s => s.id === extra.id);
          if (rmIdx >= 0) {
            newMatrix.splice(rmIdx, 1);
          }
          deletedSlots.push({ id: extra.id });
        });
      }

      scheduledDetails.push({
        dateStr,
        dayOfWeek,
        teamIndex: effectiveTeamIndex,
        heqi: isCampusDuty ? assignedHeqi : (rule.heqiGroup || '常態輪值'),
        teamName: isTeamPayback
          ? `${assignedTeam.teamName} (優先還班)`
          : (swapConflictNotice ? `${assignedTeam.teamName} (與${swapConflictNotice.originalTeamName}對換)` : assignedTeam.teamName),
        originalTeamName: swapConflictNotice ? swapConflictNotice.originalTeamName : null,
        swappedTeamName: swapConflictNotice ? swapConflictNotice.swappedTeamName : null,
        conflictLocation: swapConflictNotice ? swapConflictNotice.conflictLocation : null,
        assignedCount: selectedMembers.length,
        assignedMembers: selectedMembers, // 整組人員排班，不設上限
        standbys: [],
        isPayback: isTeamPayback,
        adjustedNotice: isTeamPayback
          ? `🔄 【優先還班】歸還原定 ${paybackOriginInfo?.sinceDate} 代班之班次`
          : (swapConflictNotice ? swapConflictNotice.reason : null),
        swapNotice: swapConflictNotice ? swapConflictNotice.reason : null
      });

      curr.setDate(curr.getDate() + 1);
    }

    // 同步保存組別對換互償狀態與個人待補班/預支抵扣清單至 rotationPointers
    rotationPointers._pendingTeamSwaps = pendingTeamSwaps;
    rotationPointers._pendingSeqOwed = pendingSeqOwed;
    rotationPointers._preServedSeqCredits = preServedSeqCredits;

    // 計算公平性摘要統計 (Fairness Summary)
    const memberStats = [];
    memberLocalCounts.forEach((count, name) => {
      const cross = memberCrossCounts.get(name) || 0;
      memberStats.push({
        name,
        localCount: count,
        crossCount: cross,
        totalCount: count + cross
      });
    });
    memberStats.sort((a, b) => b.localCount - a.localCount || b.totalCount - a.totalCount);

    const minLocal = memberStats.length ? Math.min(...memberStats.map(s => s.localCount)) : 0;
    const maxLocal = memberStats.length ? Math.max(...memberStats.map(s => s.localCount)) : 0;
    const avgLocal = memberStats.length ? (memberStats.reduce((acc, s) => acc + s.localCount, 0) / memberStats.length).toFixed(1) : 0;

    const fairnessSummary = {
      balanceScope,
      minLocal,
      maxLocal,
      avgLocal,
      spread: maxLocal - minLocal,
      memberStats,
      pendingOwedList: [
        ...(pendingSeqOwed.weekday || []).map(x => ({ ...x, track: '平日' })),
        ...(pendingSeqOwed.weekend || []).map(x => ({ ...x, track: '假日' }))
      ],
      preServedCreditsCount: (preServedSeqCredits.weekday?.length || 0) + (preServedSeqCredits.weekend?.length || 0),
      teamSwapDebtsCount: Object.values(pendingTeamSwaps).reduce((sum, dayMap) => {
        return sum + Object.values(dayMap).reduce((s2, list) => s2 + (Array.isArray(list) ? list.length : 0), 0);
      }, 0)
    };

    return {
      matrixList: newMatrix,
      allGeneratedSlots,
      deletedSlots,
      scheduledDetails,
      conflicts,
      standbyList,
      skippedSlots,
      fairnessSummary,
      updatedRotationPointers: rotationPointers,
      ruleId: rule?.id
    };
  }

  /**
   * 將自動排班產生的席位清單批次儲存至 Firestore
   * @param {Array} slots
   * @param {Object} updatedPointers
   * @param {string} ruleId
   * @param {Array} deletedSlots
   */
  async function saveAutoScheduleToDb(slots = [], updatedPointers = null, ruleId = null, deletedSlots = []) {
    loading.value = true;
    try {
      if (slots && slots.length > 0) {
        await batchWriteItems('dutyShifts', slots, 'set');
      }
      if (deletedSlots && deletedSlots.length > 0) {
        await batchWriteItems('dutyShifts', deletedSlots, 'delete');
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

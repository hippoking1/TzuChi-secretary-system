import * as XLSX from 'xlsx';

const DAYS_OF_WEEK = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
const DAYS_SHORT = ['日', '一', '二', '三', '四', '五', '六'];

function getDayOfWeekText(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  return DAYS_OF_WEEK[dateObj.getDay()] || '';
}

export function getDayOfWeekShort(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  return DAYS_SHORT[dateObj.getDay()] || '';
}

/**
 * 取得對應國曆日期的農曆顯示文字（比照 2026宜蘭園區值班 委員.pdf 官方規格）
 * - 初一顯示農曆月名 (如 正月、二月、閏二月、臘月)
 * - 初二起顯示月/日 (如 1/13、2/2)
 * - 特殊節日顯示如 5/5端午、8/15中秋
 */
export function getLunarDateText(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  try {
    const formatter = new Intl.DateTimeFormat('zh-TW-u-ca-chinese', { month: 'numeric', day: 'numeric' });
    const parts = formatter.formatToParts(dateObj);
    const lMonth = parts.find(p => p.type === 'month')?.value || '';
    const lDay = parts.find(p => p.type === 'day')?.value || '';
    if (lDay === '1' || lDay === '01') {
      const monthNames = ['', '正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '臘月'];
      const isLeap = lMonth.includes('閏');
      const mNum = parseInt(lMonth.replace('閏', ''), 10);
      const name = monthNames[mNum] || `${mNum}月`;
      return isLeap ? `閏${name}` : name;
    }
    if (lMonth === '5' && lDay === '5') return '5/5端午';
    if (lMonth === '8' && lDay === '15') return '8/15中秋';
    return `${lMonth}/${lDay}`;
  } catch {
    return '';
  }
}

/**
 * 取得和氣代碼符號（- 為和氣一，= 為和氣二，A 為和氣三，B 為和氣四）
 */
export function getHeqiCode(heqi) {
  if (!heqi) return '';
  if (heqi.includes('和氣一')) return '-';
  if (heqi.includes('和氣二')) return '=';
  if (heqi.includes('和氣三')) return 'A';
  if (heqi.includes('和氣四')) return 'B';
  return '';
}

/**
 * 解析組織階層 (和氣 / 互愛 / 協力)
 */
export function parseOrgHierarchy(orgId, orgsList = []) {
  if (!orgId) {
    return { heqi: '全區/未指定', huai: '全區', xieli: '未指定協力', fullPath: '全區通用' };
  }
  const map = {};
  orgsList.forEach(o => { map[o.id] = o; });

  const chain = [];
  let curr = map[orgId];
  let depth = 0;
  while (curr && depth < 10) {
    chain.unshift(curr);
    curr = curr.parentId ? map[curr.parentId] : null;
    depth++;
  }

  const heqiObj = chain.find(c => c.type === 'heqi' || (c.name && c.name.includes('和氣'))) || (chain.length > 0 ? chain[0] : null);
  const huaiObj = chain.find(c => c.type === 'huai' || (c.name && c.name.includes('互愛'))) || (chain.length > 1 ? chain[1] : null);
  const xieliObj = chain.find(c => c.type === 'xieli' || (c.name && c.name.includes('協力'))) || (chain.length > 2 ? chain[2] : null);

  const heqi = heqiObj ? heqiObj.name : '未指定和氣';
  const huai = huaiObj ? huaiObj.name : '未指定互愛';
  const xieli = xieliObj ? xieliObj.name : (huaiObj ? `${huaiObj.name}直屬` : '未指定協力');

  return {
    heqi,
    huai,
    xieli,
    fullPath: chain.map(c => c.name).join(' / ')
  };
}

/**
 * 取得特定日期在宜蘭園區排班下歸屬的值週和氣
 * 基準：2027-01-04 週一為和氣一，每週輪替
 */
export function getCampusDutyHeqiForDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d, 0, 0, 0, 0);
  const base = new Date(2027, 0, 4, 0, 0, 0, 0);

  const targetDay = target.getDay();
  const diffToStart = (targetDay - 1 + 7) % 7;
  const targetWeekStart = new Date(target.getTime() - diffToStart * 86400000);

  const diffWeeks = Math.round((targetWeekStart.getTime() - base.getTime()) / (7 * 86400000));
  const order = ['和氣一', '和氣二', '和氣三', '和氣四'];
  let index = diffWeeks % order.length;
  if (index < 0) index = (index + order.length) % order.length;
  return order[index];
}

/**
 * 整合與豐富排班資料（補充志工電話與所屬組織階層，支援未建檔/培訓志工與班次夥伴智慧和氣繼承）
 */
export function enrichDutyList(duties = [], members = [], orgs = []) {
  const memberMapById = new Map();
  const memberMapByName = new Map();

  members.forEach(m => {
    if (m.id) memberMapById.set(m.id, m);
    if (m.name) {
      const trimmed = m.name.trim();
      memberMapByName.set(trimmed, m);
      const clean = trimmed.replace(/^[★*☆\s]+/, '').trim();
      if (clean) memberMapByName.set(clean, m);
    }
  });

  const validDuties = duties.filter(d => !!d.memberName);

  // 第一階段 (Pass 1)：建立每筆基礎組織資料，並統計同班次中已登記明確組織之出勤夥伴
  const shiftPartnerOrgMap = new Map();

  const baseList = validDuties.map(d => {
    const rawName = (d.memberName || '').trim();
    const cleanName = rawName.replace(/^[★*☆\s]+/, '').trim();
    const m = memberMapById.get(d.memberId) || memberMapByName.get(cleanName) || memberMapByName.get(rawName) || null;
    const orgId = m?.orgId || d.orgId || '';
    const orgInfo = parseOrgHierarchy(orgId, orgs);
    const hasRegisteredOrg = !!(orgInfo.heqi && orgInfo.heqi !== '未指定和氣' && orgInfo.heqi !== '全區/未指定');

    const shiftKey = `${d.dutyDate}_${d.location || '宜蘭園區'}_${d.shiftId || ''}`;
    if (hasRegisteredOrg && !shiftPartnerOrgMap.has(shiftKey)) {
      shiftPartnerOrgMap.set(shiftKey, {
        heqi: orgInfo.heqi,
        huai: orgInfo.huai,
        xieli: orgInfo.xieli,
        fullPath: orgInfo.fullPath
      });
    }

    return {
      d,
      rawName,
      cleanName,
      m,
      orgInfo,
      hasRegisteredOrg,
      shiftKey
    };
  });

  // 第二階段 (Pass 2)：智慧推導有效執勤和氣與所屬組織（未建檔/培訓志工優先繼承同班夥伴之和氣與協力）
  return baseList.map(({ d, rawName, cleanName, m, orgInfo, hasRegisteredOrg, shiftKey }) => {
    const partnerOrg = shiftPartnerOrgMap.get(shiftKey);
    const isCampus = (d.location === '宜蘭園區' || !d.location);
    const campusDutyHeqi = isCampus ? getCampusDutyHeqiForDate(d.dutyDate) : '';

    let effectiveHeqi = '全區/未指定';
    let effectiveHuai = orgInfo.huai || '全區';
    let effectiveXieli = orgInfo.xieli || '未指定協力';
    let effectivePath = orgInfo.fullPath || '全區通用';

    if (hasRegisteredOrg) {
      // 1. 個人名冊已登記明確組織
      effectiveHeqi = orgInfo.heqi;
    } else if (partnerOrg) {
      // 2. 未建檔或未登記組織志工 (如培訓志工)：優先智慧繼承同班次出勤夥伴的和氣與互愛協力
      effectiveHeqi = partnerOrg.heqi;
      effectiveHuai = partnerOrg.huai;
      effectiveXieli = partnerOrg.xieli;
      effectivePath = `${partnerOrg.fullPath} (培訓/非名冊志工)`;
    } else if (campusDutyHeqi) {
      // 3. 宜蘭園區排班：依當日值週和氣輪值歸屬
      effectiveHeqi = campusDutyHeqi;
      effectivePath = `${campusDutyHeqi} (值週輪值)`;
    } else if (d.location === '東港聯絡處') {
      // 4. 東港聯絡處常態女眾/男眾值班：預設為和氣二主責輪值
      effectiveHeqi = '和氣二';
      effectivePath = '和氣二 (聯絡處輪值/培訓志工)';
    }

    const dutyHeqi = effectiveHeqi || campusDutyHeqi || '全區通用';

    return {
      ...d,
      rawMemberName: rawName,
      cleanMemberName: cleanName,
      displayName: cleanName || rawName,
      memberPhone: m?.phone || '',
      memberCode: m?.volunteerCode || '',
      dutyHeqi, // 該班次值週/執勤和氣
      heqi: effectiveHeqi, // 志工有效執勤和氣
      personalHeqi: orgInfo.heqi, // 志工原始登記和氣
      huai: effectiveHuai,
      xieli: effectiveXieli,
      orgPath: effectivePath,
      dayOfWeek: getDayOfWeekText(d.dutyDate)
    };
  }).sort((a, b) => {
    const cmpDate = (a.dutyDate || '').localeCompare(b.dutyDate || '');
    if (cmpDate !== 0) return cmpDate;
    const cmpShift = (a.shiftId || '').localeCompare(b.shiftId || '');
    if (cmpShift !== 0) return cmpShift;
    return (a.slotIndex || 0) - (b.slotIndex || 0);
  });
}

/**
 * 匯出志工值班排班表至 Excel (.xlsx)
 * - 支援整月或自訂日期區間
 * - 依所選和氣過濾（或全部和氣）
 * - mode = 'date'：不論組織別，完全依日期順序匯出單一完整排程總清冊
 * - mode = 'org'：依「互愛及協力」建立獨立分頁工作表 (Worksheet)
 */
export function exportDutyScheduleToExcel({
  location = '宜蘭園區',
  year,
  month,
  startDate = null,
  endDate = null,
  duties = [],
  members = [],
  orgs = [],
  targetHeqi = 'all', // 'all' | '和氣一' | '和氣二' | '和氣三' | '和氣四' ...
  targetGender = 'all', // 'all' | '男' | '女'
  mode = 'date' // 'date' (依日期順序) | 'org' (依互愛協力分組)
}) {
  const enrichedList = enrichDutyList(duties, members, orgs);

  // 依和氣、眾別與日期區間過濾（只要該值週和氣負責，或志工所屬和氣符合均納入，避免遺漏）
  const filteredList = enrichedList.filter(item => {
    if (startDate && item.dutyDate < startDate) return false;
    if (endDate && item.dutyDate > endDate) return false;
    const matchHeqi = (targetHeqi === 'all' || !targetHeqi) 
      ? true 
      : (item.dutyHeqi === targetHeqi || item.heqi === targetHeqi || item.heqi === '全區/未指定');
    const matchGender = (targetGender === 'all' || !targetGender) 
      ? true 
      : (item.genderType === targetGender);
    return matchHeqi && matchGender;
  });

  const genderLabel = targetGender === 'all' ? '全部志工' : (targetGender === '男' ? '男眾' : '女眾');
  const heqiLabel = targetHeqi === 'all' ? '全部和氣' : targetHeqi;

  // 決定區間文字標籤與檔名標記
  let dateRangeLabel = '';
  let filenameDateTag = '';
  if (startDate && endDate) {
    if (startDate === endDate) {
      dateRangeLabel = `${startDate}`;
      filenameDateTag = `${startDate}`;
    } else {
      dateRangeLabel = `${startDate} ~ ${endDate}`;
      filenameDateTag = `${startDate}至${endDate}`;
    }
  } else if (year && month) {
    const monthStr = String(month).padStart(2, '0');
    dateRangeLabel = `${year}年${monthStr}月`;
    filenameDateTag = `${year}年${monthStr}月`;
  } else {
    dateRangeLabel = '值班名冊';
    filenameDateTag = '值班名冊';
  }

  if (filteredList.length === 0) {
    throw new Error(`在【${location}】${dateRangeLabel} (${heqiLabel} / ${genderLabel}) 尚無已排班的名冊可供匯出`);
  }

  // 確保依照日期 -> 班次 -> 眾別 -> 席位順序升冪排序
  const sortedList = [...filteredList].sort((a, b) => {
    const cmpDate = (a.dutyDate || '').localeCompare(b.dutyDate || '');
    if (cmpDate !== 0) return cmpDate;
    const cmpShift = (a.shiftId || '').localeCompare(b.shiftId || '');
    if (cmpShift !== 0) return cmpShift;
    const cmpGender = (a.genderType || '').localeCompare(b.genderType || '');
    if (cmpGender !== 0) return cmpGender;
    return (a.slotIndex || 0) - (b.slotIndex || 0);
  });

  const wb = XLSX.utils.book_new();
  const nowStr = new Date().toLocaleString('zh-TW', { hour12: false });
  const genderSuffix = targetGender === 'all' ? '' : `(${genderLabel})`;
  const scopeLabel = targetHeqi === 'all' ? '全區' : targetHeqi;
  const genderTag = targetGender === 'all' ? '' : `_${genderLabel}`;

  // ───── 模式一：依日期順序排列（不分組織別，單一完整清冊） ─────
  if (mode === 'date') {
    const sheetTitle = targetHeqi === 'all' 
      ? (genderSuffix ? `值班名冊(日期序)${genderSuffix}` : '值班名冊(依日期順序)') 
      : `${targetHeqi}_日期序${genderSuffix ? genderSuffix : ''}`;

    const headers = [
      '序號', '值班日期', '星期', '班次名稱', '值班時段', '眾別', '志工姓名', '所屬和氣', '所屬互愛', '所屬協力', '出勤簽章 / 備註'
    ];
    const rows = sortedList.map((item, idx) => [
      idx + 1,
      item.dutyDate,
      item.dayOfWeek,
      item.shiftLabel,
      item.timeRange || '',
      item.genderType,
      item.displayName || item.cleanMemberName || item.memberName,
      item.heqi,
      item.huai,
      item.xieli,
      ''
    ]);

    const aoa = [
      [`【慈濟 ${location}】${dateRangeLabel} 志工值班排班表 (依日期順序)`],
      [`輸出範圍：${heqiLabel} ｜ 眾別：${genderLabel} ｜ 區間：${dateRangeLabel} ｜ 總席次：${sortedList.length} 席 ｜ 產表時間：${nowStr}`],
      [],
      headers,
      ...rows,
      ['合計', `共 ${sortedList.length} 席次`, '', '', '', '', '', '', '', '', '']
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [
      { wch: 6 },  // 序號
      { wch: 13 }, // 值班日期
      { wch: 8 },  // 星期
      { wch: 14 }, // 班次名稱
      { wch: 16 }, // 值班時段
      { wch: 8 },  // 眾別
      { wch: 14 }, // 志工姓名
      { wch: 14 }, // 所屬和氣
      { wch: 14 }, // 所屬互愛
      { wch: 16 }, // 所屬協力
      { wch: 22 }  // 出勤簽章 / 備註
    ];
    XLSX.utils.book_append_sheet(wb, ws, sheetTitle.slice(0, 30));

    const filename = `${location}_${filenameDateTag}_${scopeLabel}${genderTag}_志工值班名冊(依日期順序).xlsx`;
    XLSX.writeFile(wb, filename);

    return {
      filename,
      totalCount: sortedList.length,
      groupCount: 1,
      mode: 'date'
    };
  }

  // ───── 模式二：依「互愛及協力」分組建立獨立工作頁 ─────
  // 1. 建立「總表」工作頁
  const totalSheetTitle = targetHeqi === 'all' 
    ? (genderSuffix ? `全區總表${genderSuffix}` : '全道場值班總表') 
    : `${targetHeqi}總表${genderSuffix ? genderSuffix : ''}`;
  const totalHeaders = [
    '序號', '值班日期', '星期', '班次名稱', '值班時段', '眾別', '志工姓名', '和氣', '互愛', '協力', '出勤簽章'
  ];
  const totalRows = sortedList.map((item, idx) => [
    idx + 1,
    item.dutyDate,
    item.dayOfWeek,
    item.shiftLabel,
    item.timeRange || '',
    item.genderType,
    item.memberName,
    item.heqi,
    item.huai,
    item.xieli,
    ''
  ]);

  const totalAoa = [
    [`【慈濟 ${location}】${dateRangeLabel} 志工值班排班表 - ${totalSheetTitle}`],
    [`輸出範圍：${heqiLabel} ｜ 眾別：${genderLabel} ｜ 區間：${dateRangeLabel} ｜ 總席次：${sortedList.length} 席 ｜ 產表時間：${nowStr}`],
    [],
    totalHeaders,
    ...totalRows,
    ['合計', `共 ${sortedList.length} 席次`, '', '', '', '', '', '', '', '', '']
  ];

  const wsTotal = XLSX.utils.aoa_to_sheet(totalAoa);
  wsTotal['!cols'] = [
    { wch: 6 },  // 序號
    { wch: 13 }, // 值班日期
    { wch: 8 },  // 星期
    { wch: 14 }, // 班次名稱
    { wch: 16 }, // 值班時段
    { wch: 8 },  // 眾別
    { wch: 14 }, // 志工姓名
    { wch: 12 }, // 和氣
    { wch: 14 }, // 互愛
    { wch: 16 }, // 協力
    { wch: 16 }  // 出勤簽章
  ];
  XLSX.utils.book_append_sheet(wb, wsTotal, totalSheetTitle.slice(0, 30));

  // 2. 依「互愛及協力」分組建立獨立工作頁
  const groupsMap = new Map();
  sortedList.forEach(item => {
    const groupKey = `${item.huai} - ${item.xieli}`;
    if (!groupsMap.has(groupKey)) {
      groupsMap.set(groupKey, {
        heqi: item.heqi,
        huai: item.huai,
        xieli: item.xieli,
        list: []
      });
    }
    groupsMap.get(groupKey).list.push(item);
  });

  const usedSheetNames = new Set([totalSheetTitle.slice(0, 30)]);

  groupsMap.forEach((grp, key) => {
    let sheetName = `${grp.huai}-${grp.xieli}`.replace(/[\/\\?*\[\]:]/g, '_').trim();
    if (genderSuffix) {
      sheetName = `${sheetName}_${genderLabel}`;
    }
    if (sheetName.length > 28) sheetName = sheetName.slice(0, 28);
    let uniqueName = sheetName;
    let counter = 2;
    while (usedSheetNames.has(uniqueName)) {
      uniqueName = `${sheetName}_${counter}`;
      counter++;
    }
    usedSheetNames.add(uniqueName);

    const grpHeaders = ['序號', '值班日期', '星期', '班次名稱', '值班時段', '眾別', '志工姓名', '出勤簽章 / 備註'];
    const grpRows = grp.list.map((item, idx) => [
      idx + 1,
      item.dutyDate,
      item.dayOfWeek,
      item.shiftLabel,
      item.timeRange || '',
      item.genderType,
      item.memberName,
      ''
    ]);

    const grpAoa = [
      [`【慈濟 ${location}】${dateRangeLabel} 志工值班名冊${genderSuffix ? ` (${genderLabel})` : ''}`],
      [`所屬單位：${grp.heqi} / ${grp.huai} / ${grp.xieli} ｜ 眾別：${genderLabel} ｜ 區間：${dateRangeLabel} ｜ 出勤人次：${grp.list.length} 席 ｜ 產表時間：${nowStr}`],
      [],
      grpHeaders,
      ...grpRows,
      ['合計', `共 ${grp.list.length} 席次`, '', '', '', '', '', '']
    ];

    const wsGrp = XLSX.utils.aoa_to_sheet(grpAoa);
    wsGrp['!cols'] = [
      { wch: 6 },  // 序號
      { wch: 13 }, // 值班日期
      { wch: 8 },  // 星期
      { wch: 14 }, // 班次名稱
      { wch: 16 }, // 值班時段
      { wch: 8 },  // 眾別
      { wch: 14 }, // 志工姓名
      { wch: 22 }  // 出勤簽章
    ];
    XLSX.utils.book_append_sheet(wb, wsGrp, uniqueName);
  });

  const filename = `${location}_${filenameDateTag}_${scopeLabel}${genderTag}_志工值班名冊(依協力分頁).xlsx`;
  XLSX.writeFile(wb, filename);

  return {
    filename,
    totalCount: sortedList.length,
    groupCount: groupsMap.size,
    mode: 'org'
  };
}

/**
 * 批次將所有和氣個別產生獨立 Excel 檔案並依序下載
 */
export function exportBatchHeqiExcel({
  location = '宜蘭園區',
  year,
  month,
  startDate = null,
  endDate = null,
  duties = [],
  members = [],
  orgs = [],
  targetGender = 'all',
  mode = 'date'
}) {
  const enrichedList = enrichDutyList(duties, members, orgs);
  const dateFiltered = enrichedList.filter(item => {
    if (startDate && item.dutyDate < startDate) return false;
    if (endDate && item.dutyDate > endDate) return false;
    return true;
  });
  const genderFiltered = (targetGender === 'all' || !targetGender)
    ? dateFiltered
    : dateFiltered.filter(item => item.genderType === targetGender);

  const heqiSet = new Set();
  genderFiltered.forEach(item => {
    if (item.heqi && item.heqi !== '未指定和氣') heqiSet.add(item.heqi);
  });

  const targetList = Array.from(heqiSet).sort();
  if (targetList.length === 0) {
    targetList.push('all');
  }

  let downloadedCount = 0;
  targetList.forEach((hq, index) => {
    setTimeout(() => {
      try {
        exportDutyScheduleToExcel({
          location,
          year,
          month,
          startDate,
          endDate,
          duties,
          members,
          orgs,
          targetHeqi: hq,
          targetGender,
          mode
        });
      } catch (err) {
        console.warn(`匯出 ${hq} 失敗:`, err);
      }
    }, index * 400); // 稍微錯開下載間隔避免瀏覽器阻擋多檔下載
    downloadedCount++;
  });

  return downloadedCount;
}

/**
 * 產生比照【2026宜蘭園區值班 委員.pdf】標準規格的月曆式 PDF 列印報表
 * - 依月份自動單頁排版 (A4 portrait)，一月一頁
 * - 每日一列，左側國曆/農曆/星期 (週末紅字)，右側席位欄橫向展開
 * - 培訓未建檔志工標註 (培)
 * - 支援和氣代碼 (-/=/A/B) 標示於交接日與首末日
 * - 頁尾包含準時到班、提醒機制、依季節動態服儀說明、和氣圖例與精神標語
 * 透過隱藏 iframe 自動觸發原生列印對話框，可直接「另存為 PDF」或實體列印
 */
export function printDutySchedulePdf({
  location = '宜蘭園區',
  year,
  month,
  startDate = null,
  endDate = null,
  duties = [],
  members = [],
  orgs = [],
  targetHeqi = 'all',
  targetGender = 'all',
  mode = 'date' // 'date' (標準月曆表) | 'org' (依互愛協力分組)
}) {
  const enrichedList = enrichDutyList(duties, members, orgs);
  const filteredList = enrichedList.filter(item => {
    if (startDate && item.dutyDate < startDate) return false;
    if (endDate && item.dutyDate > endDate) return false;
    const matchHeqi = (targetHeqi === 'all' || !targetHeqi) 
      ? true 
      : (item.dutyHeqi === targetHeqi || item.heqi === targetHeqi || item.heqi === '全區/未指定');
    const matchGender = (targetGender === 'all' || !targetGender) 
      ? true 
      : (item.genderType === targetGender);
    return matchHeqi && matchGender;
  });

  const genderLabel = targetGender === 'all' ? '全部志工' : (targetGender === '男' ? '男眾' : '女眾');
  const heqiLabel = targetHeqi === 'all' ? '全部和氣' : targetHeqi;

  // 決定區間文字標籤與檔名標記
  let dateRangeLabel = '';
  let filenameDateTag = '';
  if (startDate && endDate) {
    if (startDate === endDate) {
      dateRangeLabel = `${startDate}`;
      filenameDateTag = `${startDate}`;
    } else {
      dateRangeLabel = `${startDate} ~ ${endDate}`;
      filenameDateTag = `${startDate}至${endDate}`;
    }
  } else if (year && month) {
    const monthStr = String(month).padStart(2, '0');
    dateRangeLabel = `${year}年${monthStr}月`;
    filenameDateTag = `${year}年${monthStr}月`;
  } else {
    dateRangeLabel = '值班名冊';
    filenameDateTag = '值班名冊';
  }

  if (filteredList.length === 0) {
    throw new Error(`在【${location}】${dateRangeLabel} (${heqiLabel} / ${genderLabel}) 尚無已排班的名冊可供列印 PDF`);
  }

  const printDateStr = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const scopeLabel = targetHeqi === 'all' ? '全區' : targetHeqi;
  const genderTag = targetGender === 'all' ? '' : `_${genderLabel}`;

  let bodyContentHtml = '';

  if (mode === 'org') {
    // 依「互愛及協力」分組模式 (出勤簽到清冊)
    const groupsMap = new Map();
    filteredList.forEach(item => {
      const groupKey = `${item.huai} - ${item.xieli}`;
      if (!groupsMap.has(groupKey)) {
        groupsMap.set(groupKey, {
          heqi: item.heqi,
          huai: item.huai,
          xieli: item.xieli,
          list: []
        });
      }
      groupsMap.get(groupKey).list.push(item);
    });

    const pagesHtml = [];
    groupsMap.forEach((grp) => {
      const rowsHtml = grp.list.map((item, idx) => `
        <tr>
          <td style="width: 45px; text-align: center;">${idx + 1}</td>
          <td style="width: 100px; text-align: center; font-weight: bold;">${item.dutyDate}</td>
          <td style="width: 55px; text-align: center;">${item.dayOfWeek}</td>
          <td style="width: 115px; text-align: center;">${item.shiftLabel}</td>
          <td style="width: 125px; text-align: center;">${item.timeRange || ''}</td>
          <td style="width: 55px; text-align: center;">${item.genderType}眾</td>
          <td style="width: 105px; text-align: center; font-weight: bold;">${item.displayName || item.cleanMemberName || item.memberName}</td>
          <td style="text-align: center;"></td>
        </tr>
      `).join('');

      pagesHtml.push(`
        <div class="print-page-org">
          <div class="header-org">
            <h1 class="title-org">慈濟【${location}】志工值班排班名冊</h1>
            <p class="subtitle-org">${dateRangeLabel} 值班表 ｜ 範圍：${heqiLabel} ｜ 眾別：${genderLabel}</p>
          </div>

          <div class="meta-box-org">
            <div><strong>所屬組織：</strong>${grp.heqi} ➔ ${grp.huai} ➔ <span class="highlight">${grp.xieli}</span></div>
            <div><strong>眾別：</strong>${genderLabel} ｜ <strong>區間值班總人次：</strong>${grp.list.length} 席</div>
          </div>

          <table class="duty-table-org">
            <thead>
              <tr>
                <th style="width: 45px;">序號</th>
                <th style="width: 100px;">值班日期</th>
                <th style="width: 55px;">星期</th>
                <th style="width: 115px;">班次名稱</th>
                <th style="width: 125px;">值班時段</th>
                <th style="width: 55px;">眾別</th>
                <th style="width: 105px;">志工姓名</th>
                <th>出勤簽名 / 備註</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="footer-sign-org">
            <div class="footer-col">協力隊長/組長簽署：____________________</div>
            <div class="footer-col">印表日期：${printDateStr}</div>
            <div class="footer-col" style="text-align: right;">慈濟小祕書系統 2.0</div>
          </div>
        </div>
      `);
    });
    bodyContentHtml = pagesHtml.join('');
  } else {
    // ───── 標準月曆排版模式 (完全比照 2026宜蘭園區值班 委員.pdf 官方規格) ─────
    // 1. 整理出涵蓋的所有月份 (YYYY-MM)
    const monthSet = new Set();
    filteredList.forEach(item => {
      if (item.dutyDate && item.dutyDate.length >= 7) {
        monthSet.add(item.dutyDate.slice(0, 7));
      }
    });

    if (monthSet.size === 0 && year && month) {
      monthSet.add(`${year}-${String(month).padStart(2, '0')}`);
    }

    const sortedMonths = Array.from(monthSet).sort();

    // 2. 決定眾別分組 (若為 all 且同時有男眾與女眾，則各產生獨立月曆頁)
    const genderTypes = [];
    if (targetGender === 'all' || !targetGender) {
      const gSet = new Set();
      filteredList.forEach(d => {
        if (d.genderType) gSet.add(d.genderType);
      });
      if (gSet.has('女')) genderTypes.push('女');
      if (gSet.has('男')) genderTypes.push('男');
      if (genderTypes.length === 0) genderTypes.push('女');
    } else {
      genderTypes.push(targetGender);
    }

    const calendarPages = [];

    genderTypes.forEach(gType => {
      const gTitle = gType === '男' ? '慈誠師兄' : '委員師姊';

      sortedMonths.forEach(ymStr => {
        const [curYear, curMonth] = ymStr.split('-').map(Number);
        const daysInMonth = new Date(curYear, curMonth, 0).getDate();
        const pageTitle = `${curYear}年${location}${gTitle}值班表`;

        // 篩選出該月份、該眾別的 duties
        const monthDuties = filteredList.filter(d => {
          return d.dutyDate.startsWith(ymStr) && (d.genderType === gType || !d.genderType);
        });

        // 依日期組織每日席位陣列
        const dayMap = {};
        for (let d = 1; d <= daysInMonth; d++) {
          const dStr = `${curYear}-${String(curMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          dayMap[dStr] = [];
        }

        monthDuties.forEach(item => {
          if (dayMap[item.dutyDate]) {
            dayMap[item.dutyDate].push(item);
          }
        });

        // 計算席位欄數（宜蘭園區預設 5 欄，東港或男眾預設 4 欄，若單日席位較多則動態擴充）
        let maxSlotsOnAnyDay = 0;
        Object.values(dayMap).forEach(list => {
          if (list.length > maxSlotsOnAnyDay) maxSlotsOnAnyDay = list.length;
        });
        const defaultCols = location === '宜蘭園區' ? 5 : (gType === '男' ? 3 : 4);
        const colCount = Math.max(defaultCols, maxSlotsOnAnyDay);

        // 時段判定 (取 duties 中的 timeRange，若無則採園區預設規格)
        let effectiveTimeRange = '';
        const foundWithTime = monthDuties.find(d => d.timeRange);
        if (foundWithTime) {
          effectiveTimeRange = foundWithTime.timeRange;
        } else {
          if (location === '東港聯絡處') {
            effectiveTimeRange = '08:00 ~ 13:00';
          } else {
            effectiveTimeRange = gType === '男' ? '08:30 ~ 12:30' : '08:30 ~ 16:00';
          }
        }

        // 起始到班時間
        const startMatch = effectiveTimeRange.match(/^(\d{1,2}:\d{2})/);
        const shiftStart = startMatch ? startMatch[1] : (location === '東港聯絡處' ? '08:00' : '08:30');

        // 服儀說明 (5~10月著短袖八正道+背心，11~4月著八正道+外套+背心)
        const isSummer = curMonth >= 5 && curMonth <= 10;
        const clothesNote = isSummer
          ? `${String(curMonth).padStart(2, '0')}月穿著八正道, 著志工背心.`
          : `11月~04月穿著八正道+外套, 著志工背心.`;

        // 逐日產出橫列
        let rowsHtml = '';
        let prevHeqi = '';

        for (let d = 1; d <= daysInMonth; d++) {
          const dateStr = `${curYear}-${String(curMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const dateObj = new Date(curYear, curMonth - 1, d);
          const dayOfWeekIdx = dateObj.getDay();
          const isWeekend = (dayOfWeekIdx === 0 || dayOfWeekIdx === 6);
          const dayOfWeekStr = DAYS_SHORT[dayOfWeekIdx];
          const lunarText = getLunarDateText(dateStr);

          const slots = (dayMap[dateStr] || []).sort((a, b) => (a.slotIndex || 0) - (b.slotIndex || 0));

          // 當日輪值和氣與代碼
          const campusDutyHeqi = getCampusDutyHeqiForDate(dateStr);
          const dayHeqi = slots[0]?.dutyHeqi || slots[0]?.heqi || campusDutyHeqi;
          const code = getHeqiCode(dayHeqi);

          // 和氣代碼出現時機：每月首日、末日、週日、週一、或輪值和氣交替日
          const isFirstOrLast = (d === 1 || d === daysInMonth);
          const isSunOrMon = (dayOfWeekIdx === 0 || dayOfWeekIdx === 1);
          const isHeqiChange = (prevHeqi && dayHeqi && prevHeqi !== dayHeqi);
          const showCode = (isFirstOrLast || isSunOrMon || isHeqiChange) ? code : '';
          prevHeqi = dayHeqi;

          const redCls = isWeekend ? 'text-red' : '';

          let slotTds = '';
          for (let c = 0; c < colCount; c++) {
            const slot = slots[c];
            let name = '';
            if (slot) {
              name = slot.displayName || slot.cleanMemberName || slot.memberName || '';
              const isTrainee = (slot.orgPath && slot.orgPath.includes('培訓')) || slot.isCustom;
              if (isTrainee && !name.includes('(培)')) {
                name += '(培)';
              }
            }
            slotTds += `<td class="slot-td">${name || '&nbsp;'}</td>`;
          }

          rowsHtml += `
            <tr class="day-row ${isWeekend ? 'weekend-row' : ''}">
              <td class="col-date-td ${redCls}">${curMonth}/${d}</td>
              <td class="col-lunar-td ${redCls}">${lunarText}</td>
              <td class="col-day-td ${redCls}">${dayOfWeekStr}</td>
              ${slotTds}
              <td class="col-code-td font-bold">${showCode || '&nbsp;'}</td>
            </tr>
          `;
        }

        calendarPages.push(`
          <div class="duty-month-page">
            <div class="page-header">
              <h1 class="page-title">${pageTitle}</h1>
            </div>

            <table class="duty-sheet">
              <thead>
                <tr>
                  <th rowspan="2" class="th-date">國曆</th>
                  <th rowspan="2" class="th-lunar">農曆</th>
                  <th rowspan="2" class="th-day">星期</th>
                  <th colspan="${colCount + 1}" class="th-group-title">值班志工</th>
                </tr>
                <tr>
                  <th colspan="${colCount}" class="th-time">${effectiveTimeRange}</th>
                  <th class="th-code"></th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>

            <div class="page-footer">
              <div class="footer-top">
                <div class="footer-left">
                  <div>1. 上午${shiftStart}準時到班.</div>
                  <div>2. 聯絡提醒隔天值班師兄師姊.</div>
                  <div>3. 值班服儀: ${clothesNote}</div>
                </div>
                <div class="footer-right">
                  <div>(-為和氣一)(=為和氣二)</div>
                  <div>(A為和氣三)(B為和氣四)</div>
                </div>
              </div>
              <div class="footer-slogan">
                感恩您的承擔 &nbsp; 讓我們共同守護道場
              </div>
            </div>
          </div>
        `);
      });
    });

    bodyContentHtml = calendarPages.join('');
  }

  const docTitle = mode === 'org'
    ? `${location}_${filenameDateTag}_${scopeLabel}${genderTag}_志工值班名冊(依協力分頁)`
    : `${location}_${filenameDateTag}_${scopeLabel}${genderTag}_志工值班表`;

  const fullHtml = `
    <!DOCTYPE html>
    <html lang="zh-TW">
    <head>
      <meta charset="utf-8">
      <title>${docTitle}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 6mm 10mm 6mm 10mm;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          font-family: "Microsoft JhengHei", "PingFang TC", "Heiti TC", "Noto Sans TC", sans-serif;
          color: #000000;
          margin: 0;
          padding: 0;
          background: #ffffff;
        }

        /* ───── 標準月曆版面 (同 2026宜蘭園區值班 委員.pdf) ───── */
        .duty-month-page {
          width: 100%;
          page-break-after: always;
          break-after: page;
          padding: 0;
          margin: 0 auto;
        }
        .duty-month-page:last-child {
          page-break-after: auto;
          break-after: auto;
        }
        .page-header {
          text-align: center;
          margin-bottom: 6px;
        }
        .page-title {
          font-family: "標楷體", "DFKai-SB", "BiauKai", "BiauKaiTC", serif;
          font-size: 21px;
          font-weight: bold;
          letter-spacing: 2px;
          margin: 0;
          color: #000000;
        }

        .duty-sheet {
          width: 100%;
          border-collapse: collapse;
          border: 1.5px solid #000000;
          font-size: 11.5px;
          table-layout: fixed;
        }
        .duty-sheet th, .duty-sheet td {
          border: 1px solid #000000;
          text-align: center;
          vertical-align: middle;
          padding: 2.2px 1px;
          line-height: 1.15;
        }
        .duty-sheet thead th {
          background-color: #ffffff;
          font-weight: bold;
          color: #000000;
        }
        .th-date { width: 44px; }
        .th-lunar { width: 56px; }
        .th-day { width: 36px; }
        .th-group-title {
          font-size: 13px;
          font-weight: bold;
          letter-spacing: 1px;
          padding: 3px 2px;
        }
        .th-time {
          font-size: 12px;
          font-weight: bold;
          letter-spacing: 0.5px;
          padding: 2px;
        }
        .th-code { width: 26px; }

        .col-date-td { width: 44px; }
        .col-lunar-td { width: 56px; }
        .col-day-td { width: 36px; }
        .col-code-td {
          width: 26px;
          font-size: 12px;
          font-weight: bold;
        }
        .slot-td {
          font-size: 12px;
          letter-spacing: 0.5px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .text-red {
          color: #dc2626 !important;
          font-weight: bold !important;
        }
        .font-bold {
          font-weight: bold !important;
        }

        .page-footer {
          margin-top: 8px;
          font-size: 11px;
          line-height: 1.35;
          color: #000000;
        }
        .footer-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 0 4px;
        }
        .footer-left {
          font-weight: normal;
        }
        .footer-right {
          font-weight: normal;
          text-align: right;
          letter-spacing: 0.5px;
        }
        .footer-slogan {
          color: #c00000;
          font-family: "標楷體", "DFKai-SB", "BiauKai", serif;
          font-size: 17px;
          font-weight: bold;
          letter-spacing: 2px;
          text-align: center;
          margin-top: 6px;
        }

        /* ───── 依協力分頁模式樣式 (Mode: org) ───── */
        .print-page-org {
          page-break-after: always;
          break-after: page;
          padding: 8px 0;
        }
        .print-page-org:last-child {
          page-break-after: auto;
          break-after: auto;
        }
        .header-org {
          text-align: center;
          border-bottom: 2px solid #1a5faa;
          padding-bottom: 6px;
          margin-bottom: 10px;
        }
        .title-org {
          font-size: 19px;
          color: #1a5faa;
          margin: 0 0 4px 0;
          font-weight: 800;
        }
        .subtitle-org {
          font-size: 12px;
          color: #475569;
          margin: 0;
        }
        .meta-box-org {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11.5px;
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          padding: 5px 10px;
          margin-bottom: 8px;
        }
        .duty-table-org {
          width: 100%;
          border-collapse: collapse;
          font-size: 11.5px;
          margin-bottom: 12px;
        }
        .duty-table-org th, .duty-table-org td {
          border: 1px solid #94a3b8;
          padding: 5px 3px;
        }
        .duty-table-org th {
          background-color: #e2e8f0;
          font-weight: 700;
        }
        .footer-sign-org {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 14px;
          padding-top: 6px;
          border-top: 1px dashed #cbd5e1;
          font-size: 11px;
          color: #64748b;
        }

        @media print {
          body {
            margin: 0;
            padding: 0;
          }
          .duty-month-page {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .duty-sheet tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
      </style>
    </head>
    <body>
      ${bodyContentHtml}
    </body>
    </html>
  `;

  // 透過隱藏 iframe 呼叫列印，避免瀏覽器彈出阻擋視窗
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(fullHtml);
  doc.close();

  iframe.contentWindow.focus();
  setTimeout(() => {
    iframe.contentWindow.print();
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 3000);
  }, 400);

  return {
    totalCount: filteredList.length,
    mode
  };
}

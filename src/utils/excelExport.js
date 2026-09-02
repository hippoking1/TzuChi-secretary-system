import * as XLSX from 'xlsx';

/**
 * 將指定活動之報名成功（已確認）名冊依「各協力」建立獨立工作頁並匯出為 Excel (.xlsx) 檔案
 * @param {Object} event 活動物件
 * @param {Array} registrations 該活動全部報名紀錄
 * @param {Array} orgs 全部組織架構 (可選)
 */
export function exportEventRegistrationsToExcel(event, registrations = [], orgs = [], lineBindings = []) {
  const eventTitle = event?.title || '慈濟活動';
  const eventDate = event?.eventDate || '';
  
  // 1. 嚴格過濾：僅匯出報名成功（已確認正取）之名單
  const confirmedList = (registrations || []).filter(r => {
    if (r.status === '已取消' || r.status === '候補中') return false;
    return r.status === '已確認' || !r.status;
  });

  if (confirmedList.length === 0) {
    throw new Error('此活動目前尚無報名成功的名單可供匯出');
  }

  // 組織 ID -> 組織物件 Map
  const orgMap = {};
  (orgs || []).forEach(o => { orgMap[o.id] = o; });

  // LINE 綁定查找索引
  const bindingMap = {};
  (lineBindings || []).forEach(b => {
    if (b.lineUserId) {
      if (b.memberId) bindingMap[b.memberId] = true;
      if (b.memberName) bindingMap[b.memberName] = true;
      const cleanPh = (b.memberPhone || b.phone || '').replace(/\D/g, '');
      if (cleanPh) bindingMap[cleanPh] = true;
    }
  });

  function isBound(r) {
    if (r.lineUserId) return true;
    if (r.memberId && bindingMap[r.memberId]) return true;
    const cleanPh = (r.phone || r.guestPhone || '').replace(/\D/g, '');
    if (cleanPh && bindingMap[cleanPh]) return true;
    if (r.name && bindingMap[r.name.trim()]) return true;
    return false;
  }

  // 輔助函式：提取志工所屬的「協力」名稱
  function getXieLiName(r) {
    if (!r.memberId && !r.orgId && !r.orgPath) {
      return '一般會眾與其他';
    }

    // 優先檢查 orgPath（例如：宜蘭和氣 / 宜蘭互愛一 / 宜蘭協力一）
    const path = r.orgPath || r.orgDisplay || '';
    if (path) {
      const parts = path.split('/').map(s => s.trim()).filter(Boolean);
      // 尋找包含「協力」的層級
      const xieliPart = parts.find(p => p.includes('協力'));
      if (xieliPart) return xieliPart;
      if (parts.length >= 3) return parts[2];
      if (parts.length > 0) return parts[parts.length - 1];
    }

    if (r.orgId && orgMap[r.orgId]) {
      const org = orgMap[r.orgId];
      if (org.type === '協力' || org.name.includes('協力')) return org.name;
      return org.name;
    }

    return '未指定組織志工';
  }

  function formatTime(val) {
    if (!val) return '';
    try {
      const d = val.toDate ? val.toDate() : new Date(val);
      return d.toLocaleString('zh-TW', { hour12: false });
    } catch {
      return '';
    }
  }

  // 2. 建立新活頁簿 (Workbook)
  const wb = XLSX.utils.book_new();

  // 欄位定義
  const headers = ['序號', '姓名', '身分', 'LINE 綁定', '組織架構 (和氣 / 互愛 / 協力)', '聯絡電話', '報名人數', '備註說明', '報名時間'];
  const colWidths = [
    { wch: 6 },  // 序號
    { wch: 14 }, // 姓名
    { wch: 12 }, // 身分
    { wch: 12 }, // LINE 綁定
    { wch: 32 }, // 組織架構
    { wch: 16 }, // 聯絡電話
    { wch: 10 }, // 報名人數
    { wch: 26 }, // 備註說明
    { wch: 20 }  // 報名時間
  ];

  // 3. 建立第一頁：「全部正取總表」
  const allRows = confirmedList.map((r, idx) => [
    idx + 1,
    r.name || r.guestName || '志工',
    r.identityType || r.volunteerRole || (r.memberId ? '慈誠/委員' : '一般會眾'),
    isBound(r) ? '已綁定' : '未綁定',
    r.orgPath || r.orgDisplay || (r.memberId ? '慈濟組織' : '一般大德'),
    r.phone || r.guestPhone || '',
    Number(r.participantCount) || 1,
    r.note || '',
    formatTime(r.registeredAt || r.createdAt)
  ]);

  const totalHeadcountAll = confirmedList.reduce((sum, r) => sum + (Number(r.participantCount) || 1), 0);
  allRows.push(['總計', `共 ${confirmedList.length} 筆表單`, '', '', '', '', totalHeadcountAll, '', '']);

  const wsAll = XLSX.utils.aoa_to_sheet([headers, ...allRows]);
  wsAll['!cols'] = colWidths;
  XLSX.utils.book_append_sheet(wb, wsAll, '全部正取總表');

  // 4. 依照「各協力」分組建立獨立工作頁 (Worksheet)
  const groups = {};
  confirmedList.forEach(r => {
    const xieli = getXieLiName(r);
    if (!groups[xieli]) groups[xieli] = [];
    groups[xieli].push(r);
  });

  // 排序工作頁名稱（讓協力排前面，會眾放後面）
  const groupNames = Object.keys(groups).sort((a, b) => {
    if (a.includes('協力') && !b.includes('協力')) return -1;
    if (!a.includes('協力') && b.includes('協力')) return 1;
    return a.localeCompare(b, 'zh-TW');
  });

  groupNames.forEach(xieliName => {
    const list = groups[xieliName];
    const sheetHeaders = ['序號', '姓名', '身分', 'LINE 綁定', '組織歸屬', '聯絡電話', '報名人數', '備註說明', '報名時間'];
    const sheetWidths = [
      { wch: 6 },
      { wch: 14 },
      { wch: 12 },
      { wch: 12 },
      { wch: 30 },
      { wch: 16 },
      { wch: 10 },
      { wch: 26 },
      { wch: 20 }
    ];

    const rows = list.map((r, idx) => [
      idx + 1,
      r.name || r.guestName || '志工',
      r.identityType || r.volunteerRole || (r.memberId ? '慈誠/委員' : '一般會眾'),
      isBound(r) ? '已綁定' : '未綁定',
      r.orgPath || r.orgDisplay || xieliName,
      r.phone || r.guestPhone || '',
      Number(r.participantCount) || 1,
      r.note || '',
      formatTime(r.registeredAt || r.createdAt)
    ]);

    const subTotalHeadcount = list.reduce((sum, r) => sum + (Number(r.participantCount) || 1), 0);
    rows.push(['合計', `共 ${list.length} 筆`, '', '', '', '', subTotalHeadcount, '', '']);

    const ws = XLSX.utils.aoa_to_sheet([sheetHeaders, ...rows]);
    ws['!cols'] = sheetWidths;

    // Excel 工作頁名稱長度上限 31 字元且不可含特殊符號
    const cleanSheetName = xieliName.replace(/[\/\\?*\[\]:]/g, '_').slice(0, 30);
    XLSX.utils.book_append_sheet(wb, ws, cleanSheetName);
  });

  // 5. 輸出下載 Excel 檔案
  const dateStr = eventDate ? `_${eventDate}` : '';
  const filename = `${eventTitle}_報名成功名冊(依協力分頁)${dateStr}.xlsx`;
  XLSX.writeFile(wb, filename);
  return { filename, totalForms: confirmedList.length, totalHeadcount: totalHeadcountAll, groupCount: groupNames.length };
}

/**
 * 將 LINE 官方帳號已綁定名單依「各協力」建立獨立工作頁並匯出為 Excel (.xlsx) 檔案
 * @param {Array} bindings lineBindings 集合全部資料
 * @param {Array} members members 集合全部資料 (可選)
 * @param {Array} orgs organizations 集合全部資料 (可選)
 */
export function exportLineBindingsToExcel(bindings = [], members = [], orgs = []) {
  if (!bindings || bindings.length === 0) {
    throw new Error('目前尚無已綁定之志工名單可供匯出');
  }

  // 1. 建立組織與志工快速索引 Map
  const orgMap = {};
  (orgs || []).forEach(o => { orgMap[o.id] = o; });

  function buildOrgPath(orgId) {
    if (!orgId) return '';
    const parts = [];
    let curr = orgMap[orgId];
    let count = 0;
    while (curr && count < 10) {
      parts.unshift(curr.name);
      curr = curr.parentId ? orgMap[curr.parentId] : null;
      count++;
    }
    return parts.join(' / ');
  }

  const memberById = {};
  const memberByName = {};
  (members || []).forEach(m => {
    if (m.id) memberById[m.id] = m;
    if (m.name) memberByName[m.name.trim()] = m;
  });

  function formatTime(val) {
    if (!val) return '-';
    try {
      if (val.toDate && typeof val.toDate === 'function') {
        return val.toDate().toLocaleString('zh-TW', { hour12: false });
      }
      if (val.seconds) {
        return new Date(val.seconds * 1000).toLocaleString('zh-TW', { hour12: false });
      }
      const d = new Date(val);
      return isNaN(d.getTime()) ? String(val) : d.toLocaleString('zh-TW', { hour12: false });
    } catch {
      return String(val);
    }
  }

  function getXieLiName(b, member) {
    // 1. 優先從 member 的 orgId 取得完整階層並擷取協力
    const orgId = member?.orgId;
    if (orgId) {
      const path = buildOrgPath(orgId);
      if (path) {
        const parts = path.split('/').map(s => s.trim()).filter(Boolean);
        const xieliPart = parts.find(p => p.includes('協力'));
        if (xieliPart) return xieliPart;
        if (parts.length >= 3) return parts[2];
        if (parts.length > 0) return parts[parts.length - 1];
      }
      if (orgMap[orgId]) {
        return orgMap[orgId].name;
      }
    }

    // 2. 從志工綁定時填寫的 orgInput 檢查
    const orgInput = (b.orgInput || '').trim();
    if (orgInput) {
      if (orgInput.includes('協力')) {
        const match = orgInput.match(/[^/ ]*協力[^/ ]*/);
        if (match) return match[0];
      }
      return orgInput;
    }

    return '未指定組織';
  }

  // 2. 彙整各筆綁定志工完整資料
  const enrichedList = bindings.map(b => {
    const member = (b.memberId && memberById[b.memberId]) || (b.memberName && memberByName[b.memberName.trim()]) || null;
    const orgPath = member?.orgId ? buildOrgPath(member.orgId) : (b.orgInput || '-');
    const xieliName = getXieLiName(b, member);
    const gender = member?.gender || b.memberGender || '女';
    const phone = b.memberPhone || member?.phone || '-';
    const dharmaName = member?.dharmaName || '-';
    const volunteerCode = member?.volunteerCode || '-';
    const bindingTimeStr = formatTime(b.bindingTime || b.updatedAt || b.migratedAt || b.createdAt);

    return {
      id: b.id,
      name: b.memberName || member?.name || '慈濟志工',
      gender: gender === '男' ? '男眾 (師兄)' : '女眾 (師姊)',
      phone,
      lineDisplayName: b.lineDisplayName || '慈濟志工',
      orgPath: orgPath || '-',
      xieliName,
      dharmaName,
      volunteerCode,
      bindingTime: bindingTimeStr,
      rawTime: b.bindingTime || b.updatedAt || b.createdAt
    };
  });

  // 依綁定時間新到舊排序
  enrichedList.sort((a, b) => {
    const tA = new Date(a.rawTime || 0).getTime() || 0;
    const tB = new Date(b.rawTime || 0).getTime() || 0;
    return tB - tA;
  });

  // 3. 建立 Workbook
  const wb = XLSX.utils.book_new();

  const headers = ['序號', '志工姓名', '眾別', '聯絡電話', 'LINE 顯示名稱', '所屬組織架構 (和氣 / 互愛 / 協力)', '法號', '委員/慈誠編號', '綁定時間'];
  const colWidths = [
    { wch: 6 },  // 序號
    { wch: 14 }, // 姓名
    { wch: 12 }, // 眾別
    { wch: 16 }, // 聯絡電話
    { wch: 20 }, // LINE 顯示名稱
    { wch: 34 }, // 組織架構
    { wch: 12 }, // 法號
    { wch: 16 }, // 編號
    { wch: 22 }  // 綁定時間
  ];

  // (A) 第一頁：「全體綁定志工總表」
  const allRows = enrichedList.map((item, idx) => [
    idx + 1,
    item.name,
    item.gender,
    item.phone,
    item.lineDisplayName,
    item.orgPath,
    item.dharmaName,
    item.volunteerCode,
    item.bindingTime
  ]);
  allRows.push(['總計', `共 ${enrichedList.length} 位已綁定志工`, '', '', '', '', '', '', '']);

  const wsAll = XLSX.utils.aoa_to_sheet([headers, ...allRows]);
  wsAll['!cols'] = colWidths;
  XLSX.utils.book_append_sheet(wb, wsAll, '全體綁定志工總表');

  // (B) 後續各頁：依「各協力」建立獨立分頁
  const groups = {};
  enrichedList.forEach(item => {
    const groupName = item.xieliName || '未指定組織';
    if (!groups[groupName]) groups[groupName] = [];
    groups[groupName].push(item);
  });

  // 排序工作頁名稱（讓各協力依數字/名稱升冪排序，未指定的放最末尾）
  const groupNames = Object.keys(groups).sort((a, b) => {
    if (a.includes('未指定') && !b.includes('未指定')) return 1;
    if (!a.includes('未指定') && b.includes('未指定')) return -1;
    return a.localeCompare(b, 'zh-Hant', { numeric: true });
  });

  groupNames.forEach(groupName => {
    const list = groups[groupName];
    const sheetRows = list.map((item, idx) => [
      idx + 1,
      item.name,
      item.gender,
      item.phone,
      item.lineDisplayName,
      item.orgPath,
      item.dharmaName,
      item.volunteerCode,
      item.bindingTime
    ]);
    sheetRows.push(['合計', `共 ${list.length} 位`, '', '', '', '', '', '', '']);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...sheetRows]);
    ws['!cols'] = colWidths;

    // Excel 工作頁命名防呆（去除特殊字元，上限 30 字元）
    const cleanSheetName = groupName.replace(/[\/\\?*\[\]:]/g, '_').slice(0, 30);
    XLSX.utils.book_append_sheet(wb, ws, cleanSheetName);
  });

  // 4. 輸出 Excel 檔案
  const todayStr = new Date().toISOString().substring(0, 10);
  const filename = `LINE志工帳號綁定名冊(依協力分頁)_${todayStr}.xlsx`;
  XLSX.writeFile(wb, filename);

  return {
    filename,
    totalBindings: enrichedList.length,
    groupCount: groupNames.length
  };
}


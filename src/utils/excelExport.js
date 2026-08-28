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

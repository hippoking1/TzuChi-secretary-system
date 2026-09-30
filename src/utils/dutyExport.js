import * as XLSX from 'xlsx';

const DAYS_OF_WEEK = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

function getDayOfWeekText(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  return DAYS_OF_WEEK[dateObj.getDay()] || '';
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
 * 整合與豐富排班資料（補充志工電話與所屬組織階層）
 */
export function enrichDutyList(duties = [], members = [], orgs = []) {
  const memberMapById = new Map();
  const memberMapByName = new Map();

  members.forEach(m => {
    if (m.id) memberMapById.set(m.id, m);
    if (m.name) memberMapByName.set(m.name.trim(), m);
  });

  return duties
    .filter(d => !!d.memberName)
    .map(d => {
      const m = memberMapById.get(d.memberId) || memberMapByName.get(d.memberName.trim()) || null;
      const orgId = m?.orgId || d.orgId || '';
      const orgInfo = parseOrgHierarchy(orgId, orgs);

      return {
        ...d,
        memberPhone: m?.phone || '',
        memberCode: m?.volunteerCode || '',
        heqi: orgInfo.heqi,
        huai: orgInfo.huai,
        xieli: orgInfo.xieli,
        orgPath: orgInfo.fullPath,
        dayOfWeek: getDayOfWeekText(d.dutyDate)
      };
    })
    .sort((a, b) => {
      const cmpDate = (a.dutyDate || '').localeCompare(b.dutyDate || '');
      if (cmpDate !== 0) return cmpDate;
      return (a.shiftId || '').localeCompare(b.shiftId || '');
    });
}

/**
 * 匯出志工值班排班表至 Excel (.xlsx)
 * - 支援整月或自訂日期區間
 * - 依所選和氣過濾（或全部和氣）
 * - 自動依「互愛及協力」建立獨立分頁工作表 (Worksheet)
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
  targetGender = 'all' // 'all' | '男' | '女'
}) {
  const enrichedList = enrichDutyList(duties, members, orgs);

  // 依和氣、眾別與日期區間過濾
  const filteredList = enrichedList.filter(item => {
    if (startDate && item.dutyDate < startDate) return false;
    if (endDate && item.dutyDate > endDate) return false;
    const matchHeqi = (targetHeqi === 'all' || !targetHeqi) ? true : (item.heqi === targetHeqi);
    const matchGender = (targetGender === 'all' || !targetGender) ? true : (item.genderType === targetGender);
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

  const wb = XLSX.utils.book_new();
  const nowStr = new Date().toLocaleString('zh-TW', { hour12: false });

  // ───── 1. 建立「總表」工作頁 ─────
  const genderSuffix = targetGender === 'all' ? '' : `(${genderLabel})`;
  const totalSheetTitle = targetHeqi === 'all' 
    ? (genderSuffix ? `全區總表${genderSuffix}` : '全道場值班總表') 
    : `${targetHeqi}總表${genderSuffix ? genderSuffix : ''}`;
  const totalHeaders = [
    '序號', '值班日期', '星期', '班次名稱', '值班時段', '眾別', '志工姓名', '聯絡電話', '和氣', '互愛', '協力', '出勤簽章'
  ];
  const totalRows = filteredList.map((item, idx) => [
    idx + 1,
    item.dutyDate,
    item.dayOfWeek,
    item.shiftLabel,
    item.timeRange || '',
    item.genderType,
    item.memberName,
    item.memberPhone,
    item.heqi,
    item.huai,
    item.xieli,
    ''
  ]);

  const totalAoa = [
    [`【慈濟 ${location}】${dateRangeLabel} 志工值班排班表 - ${totalSheetTitle}`],
    [`輸出範圍：${heqiLabel} ｜ 眾別：${genderLabel} ｜ 區間：${dateRangeLabel} ｜ 總席次：${filteredList.length} 席 ｜ 產表時間：${nowStr}`],
    [],
    totalHeaders,
    ...totalRows,
    ['合計', `共 ${filteredList.length} 席次`, '', '', '', '', '', '', '', '', '', '']
  ];

  const wsTotal = XLSX.utils.aoa_to_sheet(totalAoa);
  wsTotal['!cols'] = [
    { wch: 6 },  // 序號
    { wch: 13 }, // 值班日期
    { wch: 8 },  // 星期
    { wch: 14 }, // 班次名稱
    { wch: 16 }, // 值班時段
    { wch: 8 },  // 眾別
    { wch: 12 }, // 志工姓名
    { wch: 16 }, // 聯絡電話
    { wch: 12 }, // 和氣
    { wch: 14 }, // 互愛
    { wch: 16 }, // 協力
    { wch: 14 }  // 出勤簽章
  ];
  XLSX.utils.book_append_sheet(wb, wsTotal, totalSheetTitle.slice(0, 30));

  // ───── 2. 依「互愛及協力」分組建立獨立工作頁 ─────
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

  const usedSheetNames = new Set([totalSheetTitle.slice(0, 30)]);

  groupsMap.forEach((grp, key) => {
    // 檔名消毒與長度限制 (Excel Sheet 名稱上限 31 字元且不可含特殊字元)
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

    const grpHeaders = ['序號', '值班日期', '星期', '班次名稱', '值班時段', '眾別', '志工姓名', '聯絡電話', '出勤簽章 / 備註'];
    const grpRows = grp.list.map((item, idx) => [
      idx + 1,
      item.dutyDate,
      item.dayOfWeek,
      item.shiftLabel,
      item.timeRange || '',
      item.genderType,
      item.memberName,
      item.memberPhone,
      ''
    ]);

    const grpAoa = [
      [`【慈濟 ${location}】${dateRangeLabel} 志工值班名冊${genderSuffix ? ` (${genderLabel})` : ''}`],
      [`所屬單位：${grp.heqi} / ${grp.huai} / ${grp.xieli} ｜ 眾別：${genderLabel} ｜ 區間：${dateRangeLabel} ｜ 出勤人次：${grp.list.length} 席 ｜ 產表時間：${nowStr}`],
      [],
      grpHeaders,
      ...grpRows,
      ['合計', `共 ${grp.list.length} 席次`, '', '', '', '', '', '', '']
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
      { wch: 16 }, // 聯絡電話
      { wch: 20 }  // 出勤簽章
    ];
    XLSX.utils.book_append_sheet(wb, wsGrp, uniqueName);
  });

  const scopeLabel = targetHeqi === 'all' ? '全區' : targetHeqi;
  const genderTag = targetGender === 'all' ? '' : `_${genderLabel}`;
  const filename = `${location}_${filenameDateTag}_${scopeLabel}${genderTag}_志工值班名冊(依協力分頁).xlsx`;
  XLSX.writeFile(wb, filename);

  return {
    filename,
    totalCount: filteredList.length,
    groupCount: groupsMap.size
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
  targetGender = 'all'
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
          targetGender
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
 * 產生依「互愛及協力」獨立分頁的 PDF 列印報表
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
  targetGender = 'all'
}) {
  const enrichedList = enrichDutyList(duties, members, orgs);
  const filteredList = enrichedList.filter(item => {
    if (startDate && item.dutyDate < startDate) return false;
    if (endDate && item.dutyDate > endDate) return false;
    const matchHeqi = (targetHeqi === 'all' || !targetHeqi) ? true : (item.heqi === targetHeqi);
    const matchGender = (targetGender === 'all' || !targetGender) ? true : (item.genderType === targetGender);
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
  const genderSuffix = targetGender === 'all' ? '' : `（${genderLabel}）`;

  // 依「互愛及協力」分組
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

  groupsMap.forEach((grp, key) => {
    const rowsHtml = grp.list.map((item, idx) => `
      <tr>
        <td style="width: 40px; text-align: center;">${idx + 1}</td>
        <td style="width: 95px; text-align: center; font-weight: bold;">${item.dutyDate}</td>
        <td style="width: 50px; text-align: center;">${item.dayOfWeek}</td>
        <td style="width: 100px; text-align: center;">${item.shiftLabel}</td>
        <td style="width: 110px; text-align: center;">${item.timeRange || ''}</td>
        <td style="width: 50px; text-align: center;">${item.genderType}眾</td>
        <td style="width: 90px; text-align: center; font-weight: bold;">${item.memberName}</td>
        <td style="width: 110px; text-align: center;">${item.memberPhone || '-'}</td>
        <td style="width: 120px; text-align: center;"></td>
      </tr>
    `).join('');

    pagesHtml.push(`
      <div class="print-page">
        <div class="header">
          <h1 class="title">慈濟【${location}】志工值班排班名冊${genderSuffix}</h1>
          <p class="subtitle">${dateRangeLabel} 值班表 ｜ 範圍：${heqiLabel} ｜ 眾別：${genderLabel}</p>
        </div>

        <div class="meta-box">
          <div><strong>所屬組織：</strong>${grp.heqi} ➔ ${grp.huai} ➔ <span class="highlight">${grp.xieli}</span></div>
          <div><strong>眾別：</strong>${genderLabel} ｜ <strong>區間值班總人次：</strong>${grp.list.length} 席</div>
        </div>

        <table class="duty-table">
          <thead>
            <tr>
              <th>序號</th>
              <th>值班日期</th>
              <th>星期</th>
              <th>班次名稱</th>
              <th>值班時段</th>
              <th>眾別</th>
              <th>志工姓名</th>
              <th>聯絡電話</th>
              <th>出勤簽名 / 備註</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="footer-sign">
          <div class="footer-col">協力隊長/組長簽署：____________________</div>
          <div class="footer-col">印表日期：${printDateStr}</div>
          <div class="footer-col" style="text-align: right;">慈濟小祕書系統 2.0</div>
        </div>
      </div>
    `);
  });

  const scopeLabel = targetHeqi === 'all' ? '全區' : targetHeqi;
  const genderTag = targetGender === 'all' ? '' : `_${genderLabel}`;

  const fullHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${location}_${filenameDateTag}_${scopeLabel}${genderTag}_志工值班名冊</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 14mm 12mm 14mm 12mm;
        }
        * { box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Microsoft JhengHei", "PingFang TC", sans-serif;
          color: #0f172a;
          margin: 0;
          padding: 0;
          background: #ffffff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .print-page {
          page-break-after: always;
          break-after: page;
          padding-bottom: 10px;
        }
        .print-page:last-child {
          page-break-after: auto;
          break-after: auto;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #1a5faa;
          padding-bottom: 6px;
          margin-bottom: 10px;
        }
        .title {
          font-size: 20px;
          color: #1a5faa;
          margin: 0 0 4px 0;
          font-weight: 800;
          letter-spacing: 1px;
        }
        .subtitle {
          font-size: 13px;
          color: #475569;
          margin: 0;
          font-weight: 600;
        }
        .meta-box {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 13px;
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          padding: 6px 12px;
          margin-bottom: 10px;
        }
        .highlight {
          color: #1a5faa;
          font-weight: bold;
        }
        .duty-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
          margin-bottom: 14px;
        }
        .duty-table th, .duty-table td {
          border: 1px solid #94a3b8;
          padding: 6px 4px;
          line-height: 1.3;
        }
        .duty-table th {
          background-color: #e2e8f0;
          font-weight: 700;
          color: #1e293b;
          text-align: center;
        }
        .duty-table tr:nth-child(even) {
          background-color: #f8fafc;
        }
        .footer-sign {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 20px;
          padding-top: 8px;
          border-top: 1px dashed #cbd5e1;
          font-size: 12px;
          color: #64748b;
        }
      </style>
    </head>
    <body>
      ${pagesHtml.join('')}
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
    groupCount: groupsMap.size
  };
}

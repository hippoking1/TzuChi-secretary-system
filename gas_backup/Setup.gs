/**
 * Setup.gs
 * 慈濟活動報名系統 — 一鍵初始化試算表結構與種子資料
 */

/**
 * 【一鍵初始化函式】
 * 請在 GAS 編輯器選取 setupSheets 函式並點擊「執行」
 */
function setupSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // 定義 12 個工作表及其欄位標頭 (Headers)
  const schema = {
    '系統設定': {
      headers: ['key', 'value', 'description', 'updatedAt'],
      defaultRows: [
        ['admin_password', 'admin123', '後台管理員登入密碼', new Date().toISOString()],
        ['system_name', '慈濟活動管理系統', '系統顯示名稱', new Date().toISOString()],
        ['allow_guest_register', 'true', '是否允許非名單人員以訪客身份報名', new Date().toISOString()]
      ]
    },
    '組織架構': {
      headers: ['id', 'name', 'level', 'parentId', 'sortOrder', 'isActive', 'createdAt'],
      defaultRows: generateDefaultOrgs()
    },
    '成員名單': {
      headers: ['id', 'name', 'phone', 'email', 'volunteerCode', 'orgId', 'dharmaName', 'gender', 'role', 'isActive', 'note', 'createdAt', 'updatedAt'],
      defaultRows: [
        ['m_admin', '系統管理員', '038266779', 'admin@tzuchi.org', '', '', '', '男', 'super_admin', true, '系統預設', new Date().toISOString(), new Date().toISOString()],
        ['m_001', '張志工', '0912345678', 'volunteer1@tzuchi.org', 'TC20260001', 'xieli_1_1_1', '明志', '男', 'member', true, '測試成員', new Date().toISOString(), new Date().toISOString()],
        ['m_002', '李師姊', '0923456789', 'volunteer2@tzuchi.org', 'TC20260002', 'xieli_1_2_1', '靜觀', '女', 'member', true, '測試成員', new Date().toISOString(), new Date().toISOString()]
      ]
    },
    '活動列表': {
      headers: ['id', 'title', 'description', 'coverImageUrl', 'location', 'organizer', 'category', 'status', 'eventDate', 'eventStartTime', 'eventEndTime', 'targetOrgs', 'maxParticipants', 'requireVolunteerCode', 'mealOption', 'registrationStart', 'registrationEnd', 'contactName', 'contactPhone', 'createdBy', 'createdAt', 'updatedAt'],
      defaultRows: [
        [
          'event_sample_1',
          '2026 社區環保日 — 七星潭淨灘行動',
          '## 活動宗旨\n秉持「與地球共生息」理念，邀請志工齊心守護海洋。\n\n## 注意事項\n1. 請自備環保水壺。\n2. 著輕便服裝與運動鞋。',
          '',
          '花蓮七星潭海灘',
          '花蓮區環保組',
          '環保',
          '已發佈',
          '2026-08-15',
          '09:00',
          '17:00',
          '',
          50,
          false,
          '全素',
          '2026-07-01',
          '2026-08-31',
          '林師姊',
          '03-8266779',
          'admin',
          new Date().toISOString(),
          new Date().toISOString()
        ]
      ]
    },
    '活動場次': {
      headers: ['id', 'eventId', 'sessionName', 'startTime', 'endTime', 'maxParticipants'],
      defaultRows: [
        ['sess_1_1', 'event_sample_1', '上午場 09:00 - 12:00', '2026-08-15 09:00', '2026-08-15 12:00', 30],
        ['sess_1_2', 'event_sample_1', '下午場 13:30 - 16:30', '2026-08-15 13:30', '2026-08-15 16:30', 20]
      ]
    },
    '報名紀錄': {
      headers: ['id', 'eventId', 'memberId', 'guestName', 'guestPhone', 'sessionId', 'status', 'mealType', 'specialNeeds', 'note', 'registeredAt', 'cancelledAt', 'checkedInAt'],
      defaultRows: []
    },
    '簽到紀錄': {
      headers: ['id', 'registrationId', 'checkedInBy', 'checkedInAt', 'method'],
      defaultRows: []
    },
    '操作日誌': {
      headers: ['id', 'timestamp', 'userId', 'action', 'targetType', 'targetId', 'detail'],
      defaultRows: []
    },
    '會議列表': {
      headers: ['id', 'title', 'meetingDate', 'startTime', 'endTime', 'location', 'description', 'organizerId', 'organizerName', 'status', 'lineNotifyStatus', 'createdBy', 'createdAt', 'updatedAt'],
      defaultRows: []
    },
    '會議參與人員': {
      headers: ['id', 'meetingId', 'memberId', 'memberName', 'memberPhone', 'attendance', 'note', 'createdAt'],
      defaultRows: []
    },
    '值班排程': {
      headers: ['id', 'location', 'dutyDate', 'shiftId', 'shiftLabel', 'shiftStart', 'shiftEnd', 'genderType', 'memberId', 'memberName', 'status', 'createdBy', 'createdAt', 'updatedAt'],
      defaultRows: []
    },
    'LINE用戶綁定': {
      headers: ['id', 'memberId', 'memberName', 'memberPhone', 'lineUserId', 'lineDisplayName', 'bindingTime', 'isActive'],
      defaultRows: []
    }
  };

  // 逐一檢查與建立工作表
  Object.keys(schema).forEach(sheetName => {
    let sheet = ss.getSheetByName(sheetName);
    const conf = schema[sheetName];

    // 若工作表不存在則建立
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }

    // 檢查第一列標頭
    const data = sheet.getDataRange().getValues();
    if (data.length === 0 || data[0].length === 0 || data[0][0] === '') {
      // 寫入 Headers
      sheet.getRange(1, 1, 1, conf.headers.length).setValues([conf.headers]);
      sheet.getRange(1, 1, 1, conf.headers.length).setFontWeight('bold').setBackground('#EDF5FF');

      // 寫入預設資料 Row
      if (conf.defaultRows && conf.defaultRows.length > 0) {
        sheet.getRange(2, 1, conf.defaultRows.length, conf.headers.length).setValues(conf.defaultRows);
      }
    }
  });

  // 自動補齊既有工作表中缺失的 Header (如活動列表自動補齊 eventDate, eventStartTime, eventEndTime)
  autoFixHeaders(ss, schema);

  // 刪除預設建立的「工作表1」 (Sheet1) 若存在且非目標工作表
  const defaultSheet = ss.getSheetByName('工作表1') || ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    try { ss.deleteSheet(defaultSheet); } catch(e) {}
  }

  // 自動設定每日早上 08:00 值班提醒觸發器
  try { setupDailyTriggers(); } catch(e) { Logger.log('Trigger setup notice: ' + e.toString()); }

  Logger.log('✅ 一鍵初始化完成！12 個工作表與欄位標頭皆已設置與修復，08:00 定時提醒已成功建立。');
}

/**
 * 自動檢查並補齊試算表中缺失的 Header
 */
function autoFixHeaders(ss, schema) {
  if (!ss) ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  if (!schema) {
    schema = {
      '活動列表': {
        headers: ['id', 'title', 'description', 'coverImageUrl', 'location', 'organizer', 'category', 'status', 'eventDate', 'eventStartTime', 'eventEndTime', 'targetOrgs', 'maxParticipants', 'requireVolunteerCode', 'mealOption', 'registrationStart', 'registrationEnd', 'contactName', 'contactPhone', 'createdBy', 'createdAt', 'updatedAt']
      }
    };
  }

  Object.keys(schema).forEach(sheetName => {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;

    const data = sheet.getDataRange().getValues();
    if (data.length > 0) {
      const currentHeaders = data[0];
      const targetHeaders = schema[sheetName].headers;

      const missing = targetHeaders.filter(h => !currentHeaders.includes(h));
      if (missing.length > 0) {
        const newHeaders = [...currentHeaders, ...missing];
        sheet.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]);
        sheet.getRange(1, 1, 1, newHeaders.length).setFontWeight('bold').setBackground('#EDF5FF');
      }
    }
  });
}

/**
 * 產生四個和氣的組織架構資料 (和氣 -> 互愛 -> 協力)
 */
function generateDefaultOrgs() {
  const now = new Date().toISOString();
  const rows = [];

  // 4 個和氣
  for (let h = 1; h <= 4; h++) {
    const heqiId = `heqi_${h}`;
    rows.push([heqiId, `第${numberToChinese(h)}和氣`, '和氣', '', h, true, now]);

    // 每個和氣下 3 個互愛
    for (let a = 1; a <= 3; a++) {
      const huaiId = `huai_${h}_${a}`;
      rows.push([huaiId, `第${numberToChinese(a)}互愛`, '互愛', heqiId, a, true, now]);

      // 每個互愛下 2 個協力
      for (let x = 1; x <= 2; x++) {
        const xieliId = `xieli_${h}_${a}_${x}`;
        rows.push([xieliId, `第${numberToChinese(x)}協力`, '協力', huaiId, x, true, now]);
      }
    }
  }

  return rows;
}

function numberToChinese(num) {
  const map = ['', '一', '二', '三', '四', '五'];
  return map[num] || num;
}

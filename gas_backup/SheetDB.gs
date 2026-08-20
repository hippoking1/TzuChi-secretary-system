/**
 * SheetDB.gs
 * 慈濟活動報名系統 — Google Sheets ORM 封裝層
 */

/**
 * 取得指定工作表物件
 */
function getSheet(sheetName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('找不到工作表: ' + sheetName);
  }
  return sheet;
}

/**
 * 讀取全表資料，轉換為 JSON 物件陣列
 */
function readAll(sheetName) {
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0];
  const phoneFields = ['phone', 'memberPhone', 'guestPhone', 'contactPhone'];

  const dateFields = ['dutyDate', 'meetingDate', 'registrationStart', 'registrationEnd', 'eventDate'];

  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      // 處理日期格式轉換 (依據 Asia/Taipei 時區格式化，避免 toISOString() 造成 -8 小時時差使日期少一天)
      if (row[i] instanceof Date) {
        if (dateFields.includes(h)) {
          obj[h] = Utilities.formatDate(row[i], 'Asia/Taipei', 'yyyy-MM-dd');
        } else {
          obj[h] = Utilities.formatDate(row[i], 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');
        }
      } else if (phoneFields.includes(h)) {
        // 自動補齊電話開頭被抹除的 0
        obj[h] = formatPhoneNumber(row[i]);
      } else {
        obj[h] = row[i];
      }
    });
    return obj;
  });
}

/**
 * 依條件過濾查詢
 */
function findWhere(sheetName, conditions) {
  const all = readAll(sheetName);
  return all.filter(row => {
    return Object.keys(conditions).every(key => {
      return String(row[key]) === String(conditions[key]);
    });
  });
}

/**
 * 依日期區間與條件過濾查詢
 */
function findWhereBetween(sheetName, dateField, startDate, endDate, extraConditions) {
  const all = readAll(sheetName);
  return all.filter(row => {
    const val = String(row[dateField] || '').substring(0, 10);
    const dateMatch = (!startDate || val >= startDate) && (!endDate || val <= endDate);
    if (!dateMatch) return false;

    if (extraConditions) {
      return Object.keys(extraConditions).every(key => {
        return String(row[key]) === String(extraConditions[key]);
      });
    }
    return true;
  });
}

/**
 * 依 ID 尋找單筆資料
 */
function findById(sheetName, id) {
  const all = readAll(sheetName);
  return all.find(row => String(row.id) === String(id)) || null;
}

/**
 * 新增一筆紀錄
 */
function insertRow(sheetName, data) {
  const sheet = getSheet(sheetName);
  const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  const phoneFields = ['phone', 'memberPhone', 'guestPhone', 'contactPhone'];
  const textDateFields = ['dutyDate', 'meetingDate', 'eventDate'];

  if (!data.id) {
    data.id = Utilities.getUuid();
  }

  const row = headers.map(h => {
    let val = data[h];
    if (val === undefined || val === null) return '';
    if (phoneFields.includes(h)) {
      val = "'" + formatPhoneNumber(val); // 前加單引號強制作為文字儲存，避免被 Sheet 自動轉為數值抹去 0
    } else if (textDateFields.includes(h) && typeof val === 'string' && val.length === 10) {
      val = "'" + val; // 強制做為文字儲存，避免 Google Sheet 解析為 Date 物件
    }
    return val;
  });

  sheet.appendRow(row);
  return data.id;
}

/**
 * 依 ID 更新紀錄
 */
function updateById(sheetName, id, updates) {
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return false;

  const headers = data[0];
  const idCol = headers.indexOf('id');
  if (idCol === -1) return false;

  const phoneFields = ['phone', 'memberPhone', 'guestPhone', 'contactPhone'];
  const textDateFields = ['dutyDate', 'meetingDate', 'eventDate'];

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(id)) {
      Object.keys(updates).forEach(key => {
        const col = headers.indexOf(key);
        if (col !== -1) {
          let val = updates[key];
          if (val === undefined || val === null) val = '';
          if (phoneFields.includes(key)) {
            val = "'" + formatPhoneNumber(val);
          } else if (textDateFields.includes(key) && typeof val === 'string' && val.length === 10) {
            val = "'" + val;
          }
          sheet.getRange(i + 1, col + 1).setValue(val);
        }
      });
      return true;
    }
  }
  return false;
}

/**
 * 依 ID 刪除紀錄
 */
function deleteById(sheetName, id) {
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return false;

  const headers = data[0];
  const idCol = headers.indexOf('id');
  if (idCol === -1) return false;

  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][idCol]) === String(id)) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

/**
 * 計算符合條件筆數
 */
function countWhere(sheetName, conditions) {
  return findWhere(sheetName, conditions).length;
}

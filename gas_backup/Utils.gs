/**
 * Utils.gs
 * 慈濟活動報名系統 — 通用工具函式與格式化
 */

/**
 * 格式化日期時間 (Asia/Taipei)
 */
function formatDateTime(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return Utilities.formatDate(d, 'Asia/Taipei', 'yyyy/MM/dd HH:mm');
  } catch (e) {
    return dateStr;
  }
}

/**
 * 格式化日期
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return Utilities.formatDate(d, 'Asia/Taipei', 'yyyy/MM/dd');
  } catch (e) {
    return dateStr;
  }
}

/**
 * 格式化電話號碼 (自動補齊被 Google Sheet 轉為數值後遺失的開頭 0)
 */
function formatPhoneNumber(phone) {
  if (!phone && phone !== 0) return '';
  let str = String(phone).trim().replace(/^'+/, '');
  
  // 台灣手機 9 位數缺開頭 0 (如 912345678 -> 0912345678)
  if (/^9\d{8}$/.test(str)) {
    return '0' + str;
  }
  // 台灣市話 8 位數缺開頭 0 (如 38266779 -> 038266779)
  if (/^[2-8]\d{7}$/.test(str)) {
    return '0' + str;
  }
  return str;
}

/**
 * 格式化時間字串，過濾掉 Google Sheet 自動產生的 1899-12-30 日期
 */
function formatShiftTimeOnly(val) {
  if (!val) return '';
  let str = String(val).trim();
  if (val instanceof Date) {
    return Utilities.formatDate(val, 'Asia/Taipei', 'HH:mm');
  }
  if (str.includes('1899-12-30')) {
    const parts = str.split(' ');
    if (parts.length > 1) {
      return parts[1].substring(0, 5);
    }
  }
  if (str.includes('T')) {
    try {
      return Utilities.formatDate(new Date(str), 'Asia/Taipei', 'HH:mm');
    } catch (e) {}
  }
  if (/^\d{2}:\d{2}/.test(str)) {
    return str.substring(0, 5);
  }
  return str;
}

/**
 * 產生唯一識別碼
 */
function generateId() {
  return Utilities.getUuid();
}

/**
 * 紀錄操作日誌
 */
function logAction(action, targetType, targetId, detail) {
  try {
    insertRow(SHEETS.LOGS, {
      timestamp: new Date().toISOString(),
      userId: getCurrentAdminId(),
      action: action,
      targetType: targetType,
      targetId: targetId,
      detail: detail ? JSON.stringify(detail) : ''
    });
  } catch (e) {
    console.error('日誌寫入失敗:', e);
  }
}

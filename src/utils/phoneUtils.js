/**
 * 台灣電話號碼格式化與驗證工具 (行動電話 / 家用電話)
 * 規則：
 * 1. 行動電話：09開頭，共 10 碼（如 0912345678）。若包含 "-" 或空格在存入時自動省略。
 * 2. 家用電話：自動判斷區碼，區碼前後加上小括號，號碼間省略 "-"（如 03-9123456 轉為 (03)9123456）。
 *    支援常見區碼：02, 03, 04, 05, 06, 07, 08 (2碼), 082 (金門 3碼), 0836 (馬祖 4碼)。
 */

export function normalizeAndValidatePhone(rawPhone, { required = false } = {}) {
  if (!rawPhone || !rawPhone.trim()) {
    if (required) {
      return {
        valid: false,
        formatted: '',
        type: null,
        error: '請填寫聯絡電話（行動電話或家用電話）'
      };
    }
    return { valid: true, formatted: '', type: null };
  }

  let str = rawPhone.trim();
  // 清除括號、空白、破折號與全形符號
  let digits = str.replace(/[\s\-\(\)（）—－_]/g, '');

  // 若使用者少輸入開頭 0 (如 911895795 共 9 碼且 9 開頭)，自動補上 0
  if (/^9\d{8}$/.test(digits)) {
    digits = '0' + digits;
  }

  // 1. 行動電話檢核：09 開頭，共 10 碼
  if (/^09\d{8}$/.test(digits)) {
    return {
      valid: true,
      formatted: digits, // 存入資料庫時省略 "-"，存為純數字 10 碼
      type: 'mobile'
    };
  }

  // 2. 家用電話檢核：自動識別區碼並加上括號，中間省略 "-"
  let areaCode = '';
  let localNumber = '';

  if (digits.startsWith('0836') && digits.length >= 9 && digits.length <= 10) {
    areaCode = '0836';
    localNumber = digits.slice(4);
  } else if (digits.startsWith('082') && digits.length >= 8 && digits.length <= 9) {
    areaCode = '082';
    localNumber = digits.slice(3);
  } else if (/^0[2-8]/.test(digits) && (digits.length === 9 || digits.length === 10)) {
    areaCode = digits.slice(0, 2);
    localNumber = digits.slice(2);
  }

  if (areaCode && localNumber && localNumber.length >= 6) {
    return {
      valid: true,
      formatted: `(${areaCode})${localNumber}`, // 區碼加上小括號，號碼間不含破折號
      type: 'landline'
    };
  }

  // 不符合規範時的警示訊息
  return {
    valid: false,
    formatted: rawPhone,
    type: null,
    error: '聯絡電話格式不正確！\n\n• 行動電話：請輸入 09 開頭共 10 碼（例如：0912345678）\n• 家用電話：請包含區碼（例如：03-9123456 或 02-27001234）'
  };
}

/**
 * AuthService.gs
 * 慈濟活動報名系統 — 管理員驗證與 Session 管理
 */

/**
 * 管理員登入
 */
function adminLogin(password) {
  const settings = readAll(SHEETS.SETTINGS);
  const adminPwSetting = settings.find(s => s.key === 'admin_password');
  const adminPw = adminPwSetting ? adminPwSetting.value : 'admin123';

  if (String(password).trim() !== String(adminPw).trim()) {
    return { error: '管理密碼不正確' };
  }

  const token = Utilities.getUuid();
  const cache = CacheService.getScriptCache();
  cache.put('admin_session_' + token, JSON.stringify({
    role: 'admin',
    loginAt: new Date().toISOString()
  }), 21600); // 6 小時有效

  return { success: true, token: token };
}

/**
 * 檢查是否具備管理員權限
 */
function isAdmin(token) {
  if (!token) return false;
  const cache = CacheService.getScriptCache();
  const cached = cache.get('admin_session_' + token);
  return !!cached;
}

/**
 * 取得當前操作者識別
 */
function getCurrentAdminId() {
  return 'admin';
}

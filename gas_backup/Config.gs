/**
 * Config.gs
 * 慈濟活動報名系統 — 系統設定與常數
 */

// 慈濟活動報名系統 Google 試算表 ID
const SPREADSHEET_ID = '1-N2k47EO1dYmGDqUgwBZBkPRZvGVtF9F0_JCSJehCq0';

// 各工作表名稱定義
const SHEETS = {
  SETTINGS: '系統設定',
  ORGS: '組織架構',
  MEMBERS: '成員名單',
  EVENTS: '活動列表',
  SESSIONS: '活動場次',
  REGISTRATIONS: '報名紀錄',
  CHECKINS: '簽到紀錄',
  LOGS: '操作日誌',
  MEETINGS: '會議列表',
  MEETING_PARTICIPANTS: '會議參與人員',
  DUTY_SCHEDULE: '值班排程',
  LINE_USERS: 'LINE用戶綁定'
};

// 角色定義 (B方案：區分管理員與會議召集人)
const ROLES = {
  SUPER_ADMIN: '超級管理員',
  ADMIN: '管理員',
  CONVENER: '會議召集人'
};

// 活動模組
const MODULES = {
  EVENT: '一般活動',
  MEETING: '會議',
  DUTY: '道場值班'
};

// 道場場地
const DUTY_LOCATIONS = {
  YILAN: '宜蘭園區',
  DONGGANG: '東港聯絡處'
};

// 道場值班時段與人數規則
const DUTY_SHIFTS = {
  '東港聯絡處': [
    { id: 'DG_F', label: '女眾班', gender: '女', start: '08:00', end: '13:00', quota: 2 },
    { id: 'DG_M', label: '男眾班', gender: '男', start: '13:00', end: '17:00', quota: 1 }
  ],
  '宜蘭園區': [
    { id: 'YL_F', label: '女眾班', gender: '女', start: '08:00', end: '16:00', quota: 4 },
    { id: 'YL_M1', label: '男眾班(一)', gender: '男', start: '16:00', end: '18:30', quota: 2 },
    { id: 'YL_M2', label: '男眾班(二)', gender: '男', start: '18:30', end: '20:30', quota: 2 }
  ]
};

// 會議出席狀態
const MEETING_ATTENDANCE = {
  PENDING: '未回覆',
  ATTENDING: '出席',
  ABSENT: '缺席',
  LEAVE: '請假'
};

// 活動分類
const EVENT_CATEGORIES = [
  { value: '慈善', label: '慈善', icon: '❤️', color: '#E8607A' },
  { value: '環保', label: '環保', icon: '🌿', color: '#10B981' },
  { value: '教育', label: '教育', icon: '📚', color: '#3B82F6' },
  { value: '醫療', label: '醫療', icon: '🏥', color: '#8B5CF6' },
  { value: '人文', label: '人文', icon: '🎨', color: '#F59E0B' },
  { value: '其他', label: '其他', icon: '📋', color: '#78716C' }
];

// 報名狀態與視覺對應
const REGISTRATION_STATUS = {
  CONFIRMED: { value: '已確認', bg: '#D1FAE5', text: '#065F46', icon: '✅' },
  WAITLISTED: { value: '候補中', bg: '#FEF3C7', text: '#92400E', icon: '⏳' },
  CANCELLED: { value: '已取消', bg: '#FEE2E2', text: '#991B1B', icon: '❌' },
  ATTENDED: { value: '已簽到', bg: '#DBEAFE', text: '#1E40AF', icon: '📋' }
};

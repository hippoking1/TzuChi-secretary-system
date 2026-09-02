const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');

// 全域指定部署至台灣機房 (彰化 asia-east1)
setGlobalOptions({ region: 'asia-east1' });

admin.initializeApp();

const { lineWebhook } = require('./lineWebhook');
const { 
  sendDailyUnifiedRemindersScheduled,
  sendDailyUnifiedRemindersForDate,
  expireStaleSwapRequestsScheduled 
} = require('./scheduledTasks');
const { syncBackupToSheetsScheduled } = require('./googleSheetsBackup');
const { sendTestLineMessage } = require('./testLine');
const { sendMeetingNotifications, sendMeetingRemindersForDate } = require('./meetingNotify');
const { sendDutyRemindersForDate } = require('./dutyNotify');
const { sendEventRemindersForDate } = require('./eventNotify');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { revertSwapByAdmin } = require('./shiftSwap');

// 管理員撤銷調班 Callable Function
exports.revertDutySwap = onCall(async (request) => {
  const { swapId } = request.data || {};
  if (!swapId) {
    throw new HttpsError('invalid-argument', '缺少 swapId 參數');
  }
  const uid = request.auth?.uid || 'admin';
  try {
    const result = await revertSwapByAdmin(swapId, uid);
    return result;
  } catch (err) {
    console.error('revertDutySwap error:', err);
    throw new HttpsError('internal', err.message || '撤銷失敗');
  }
});

exports.lineWebhook = lineWebhook;
exports.sendDailyUnifiedRemindersScheduled = sendDailyUnifiedRemindersScheduled;
exports.sendDailyUnifiedRemindersForDate = sendDailyUnifiedRemindersForDate;
exports.expireStaleSwapRequestsScheduled = expireStaleSwapRequestsScheduled;
exports.syncBackupToSheetsScheduled = syncBackupToSheetsScheduled;
exports.sendTestLineMessage = sendTestLineMessage;
exports.sendMeetingNotifications = sendMeetingNotifications;
exports.sendMeetingRemindersForDate = sendMeetingRemindersForDate;
exports.sendDutyRemindersForDate = sendDutyRemindersForDate;
exports.sendEventRemindersForDate = sendEventRemindersForDate;



const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');

// 全域指定部署至台灣機房 (彰化 asia-east1)
setGlobalOptions({ region: 'asia-east1' });

admin.initializeApp();

const { lineWebhook } = require('./lineWebhook');
const { sendDutyRemindersScheduled, sendEventRemindersScheduled, sendMeetingRemindersScheduled } = require('./scheduledTasks');
const { syncBackupToSheetsScheduled } = require('./googleSheetsBackup');
const { sendTestLineMessage } = require('./testLine');
const { sendMeetingNotifications, sendMeetingRemindersForDate } = require('./meetingNotify');
const { sendDutyRemindersForDate } = require('./dutyNotify');
const { sendEventRemindersForDate } = require('./eventNotify');

exports.lineWebhook = lineWebhook;
exports.sendDutyRemindersScheduled = sendDutyRemindersScheduled;
exports.sendEventRemindersScheduled = sendEventRemindersScheduled;
exports.sendMeetingRemindersScheduled = sendMeetingRemindersScheduled;
exports.syncBackupToSheetsScheduled = syncBackupToSheetsScheduled;
exports.sendTestLineMessage = sendTestLineMessage;
exports.sendMeetingNotifications = sendMeetingNotifications;
exports.sendMeetingRemindersForDate = sendMeetingRemindersForDate;
exports.sendDutyRemindersForDate = sendDutyRemindersForDate;
exports.sendEventRemindersForDate = sendEventRemindersForDate;

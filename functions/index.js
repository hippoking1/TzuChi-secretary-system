const admin = require('firebase-admin');
admin.initializeApp();

const { lineWebhook } = require('./lineWebhook');
const { sendDutyRemindersScheduled } = require('./scheduledTasks');
const { syncBackupToSheets } = require('./googleSheetsBackup');

exports.lineWebhook = lineWebhook;
exports.sendDutyRemindersScheduled = sendDutyRemindersScheduled;
exports.syncBackupToSheets = syncBackupToSheets;

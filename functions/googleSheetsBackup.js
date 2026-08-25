const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

exports.syncBackupToSheets = onSchedule({
  schedule: 'every day 02:00',
  timeZone: 'Asia/Taipei'
}, async () => {
  const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
  if (!fs.existsSync(serviceAccountPath)) {
    console.log("未配置 serviceAccountKey.json，略過自動備份");
    return;
  }

  const SPREADSHEET_ID = process.env.BACKUP_SPREADSHEET_ID || '1-N2k47EO1dYmGDqUgwBZBkPRZvGVtF9F0_JCSJehCq0';
  const auth = new google.auth.GoogleAuth({
    keyFile: serviceAccountPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const db = admin.firestore();

  const collections = ['events', 'registrations', 'members', 'dutyShifts', 'meetings'];
  for (const col of collections) {
    const snap = await db.collection(col).get();
    if (snap.empty) continue;

    const docs = snap.docs.map(d => d.data());
    const headers = Object.keys(docs[0]);
    const values = [headers];

    docs.forEach(d => {
      values.push(headers.map(h => {
        const val = d[h];
        if (val && typeof val === 'object' && val._seconds) {
          return new Date(val._seconds * 1000).toISOString();
        }
        return val !== undefined ? String(val) : '';
      }));
    });

    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${col}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values }
      });
      console.log(`備份 ${col} 至 Google Sheets 成功，共 ${docs.length} 筆`);
    } catch (err) {
      console.error(`備份 ${col} 失敗:`, err.message);
    }
  }
});

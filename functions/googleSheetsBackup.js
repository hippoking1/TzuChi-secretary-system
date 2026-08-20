const functions = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { google } = require('googleapis');

const db = admin.firestore();

// 將 Firestore 12 Collections 同步備份回 Google Sheets
exports.syncBackupToSheets = functions.onCall({ cors: true }, async (request) => {
  const spreadsheetId = process.env.BACKUP_SPREADSHEET_ID;
  if (!spreadsheetId) {
    return { success: false, message: '未設定 BACKUP_SPREADSHEET_ID 環境變數' };
  }

  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  const sheets = google.sheets({ version: 'v4', auth });

  const collections = ['events', 'registrations', 'members', 'organizations', 'meetings', 'dutyShifts'];
  for (const col of collections) {
    const snap = await db.collection(col).get();
    const rows = [];
    if (!snap.empty) {
      const headers = Object.keys(snap.docs[0].data());
      rows.push(headers);
      snap.docs.forEach(doc => {
        const data = doc.data();
        rows.push(headers.map(h => String(data[h] || '')));
      });

      try {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${col}!A1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: rows }
        });
      } catch (e) {
        console.warn(`Backup sheet update for ${col} skipped or sheet tab missing:`, e.message);
      }
    }
  }

  return { success: true, timestamp: new Date().toISOString() };
});

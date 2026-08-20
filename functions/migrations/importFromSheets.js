/**
 * Google Sheets 到 Firestore 歷史資料遷移腳本
 * 使用方式：
 * 1. 設定 GCP Service Account 金鑰檔案 (serviceAccountKey.json)
 * 2. 執行 node importFromSheets.js <SPREADSHEET_ID>
 */

const admin = require('firebase-admin');
const { google } = require('googleapis');
const path = require('path');

const serviceAccountPath = path.join(__dirname, '../serviceAccountKey.json');
if (!fs.existsSync(serviceAccountPath)) {
  console.error("請先將 Firebase Service Account JSON 放置於 functions/serviceAccountKey.json");
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrate() {
  const spreadsheetId = process.argv[2] || process.env.SPREADSHEET_ID;
  if (!spreadsheetId) {
    console.error("請提供 Google Sheets ID，例如：node importFromSheets.js 1-N2k47EO1dYmGDqUgwBZBkPRZvGVtF9F0_JCSJehCq0");
    process.exit(1);
  }

  console.log("開始從 Google Sheets 遷移資料至 Firestore:", spreadsheetId);

  const auth = new google.auth.GoogleAuth({
    keyFile: serviceAccountPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });
  const sheets = google.sheets({ version: 'v4', auth });

  const sheetToCollectionMap = {
    '組織架構': 'organizations',
    '成員名單': 'members',
    '活動列表': 'events',
    '報名紀錄': 'registrations',
    '會議列表': 'meetings',
    '值班排程': 'dutyShifts',
    'LINE用戶綁定': 'lineBindings'
  };

  for (const [sheetName, colName] of Object.entries(sheetToCollectionMap)) {
    try {
      console.log(`讀取工作表：${sheetName} -> Firestore Collection: ${colName} ...`);
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A1:Z`
      });

      const rows = res.data.values;
      if (!rows || rows.length <= 1) {
        console.log(`  - ${sheetName} 無資料，略過。`);
        continue;
      }

      const headers = rows[0];
      const items = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const obj = {};
        headers.forEach((h, idx) => {
          obj[h] = row[idx] !== undefined ? row[idx] : '';
        });
        items.push(obj);
      }

      // 批次寫入 Firestore
      const chunkSize = 400;
      for (let i = 0; i < items.length; i += chunkSize) {
        const batch = db.batch();
        const chunk = items.slice(i, i + chunkSize);
        for (const item of chunk) {
          const docId = item.id || db.collection(colName).doc().id;
          const ref = db.collection(colName).doc(String(docId));
          batch.set(ref, { ...item, migratedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        }
        await batch.commit();
      }
      console.log(`  ✓ 成功遷移 ${items.length} 筆資料至 ${colName}`);
    } catch (err) {
      console.error(`  ✕ 遷移 ${sheetName} 時發生錯誤:`, err.message);
    }
  }

  console.log("全部工作表遷移完成！");
}

migrate();

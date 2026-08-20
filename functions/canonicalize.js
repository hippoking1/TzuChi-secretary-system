const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// 班次時段定義
const SHIFT_CONFIG = {
  '東港聯絡處': {
    'DG_F': { label: '女眾班', start: '08:00', end: '13:00', timeRange: '08:00~13:00', gender: '女', quota: 2 },
    'DG_M': { label: '男眾班', start: '13:00', end: '17:00', timeRange: '13:00~17:00', gender: '男', quota: 1 }
  },
  '宜蘭園區': {
    'YL_F': { label: '女眾班', start: '08:00', end: '16:00', timeRange: '08:00~16:00', gender: '女', quota: 4 },
    'YL_M1': { label: '男眾班(一)', start: '16:00', end: '18:30', timeRange: '16:00~18:30', gender: '男', quota: 2 },
    'YL_M2': { label: '男眾班(二)', start: '18:30', end: '20:30', timeRange: '18:30~20:30', gender: '男', quota: 2 }
  }
};

async function canonicalizeDuties() {
  console.log('--- 開始標準化 Firestore dutyShifts 集合 ---');
  const snap = await db.collection('dutyShifts').get();
  console.log('當前總文件數:', snap.size);

  const legacyMap = {};
  const allExistingDocs = [];

  snap.docs.forEach(doc => {
    allExistingDocs.push(doc);
    const d = doc.data();
    if (!doc.id.includes('_') && d.location && d.dutyDate && d.shiftId) {
      const key = d.location + '_' + d.dutyDate + '_' + d.shiftId;
      if (!legacyMap[key]) legacyMap[key] = [];
      legacyMap[key].push({ oldId: doc.id, ...d });
    }
  });

  console.log('已索引原始班表鍵組數:', Object.keys(legacyMap).length);

  const canonicalDocs = [];
  const locations = ['宜蘭園區', '東港聯絡處'];
  const yearMonths = new Set();
  snap.docs.forEach(doc => {
    const d = doc.data();
    if (d.dutyDate) {
      yearMonths.add(d.dutyDate.substring(0, 7));
    }
  });

  for (const ym of Array.from(yearMonths)) {
    const [year, month] = ym.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    for (const loc of locations) {
      const shiftsConf = SHIFT_CONFIG[loc] || {};

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
        const dateObj = new Date(year, month - 1, day);
        const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

        for (const [shiftId, conf] of Object.entries(shiftsConf)) {
          const key = loc + '_' + dateStr + '_' + shiftId;
          const legacyItems = legacyMap[key] || [];

          for (let slot = 1; slot <= conf.quota; slot++) {
            const canonicalId = loc + '_' + dateStr + '_' + shiftId + '_' + slot;
            const matchedLegacy = legacyItems[slot - 1];

            canonicalDocs.push({
              id: canonicalId,
              location: loc,
              dutyDate: dateStr,
              shiftId: shiftId,
              shiftLabel: conf.label,
              shiftStart: conf.start,
              shiftEnd: conf.end,
              timeRange: conf.timeRange,
              slotIndex: slot,
              genderType: conf.gender,
              isWeekend: isWeekend,
              memberId: matchedLegacy ? (matchedLegacy.memberId || '') : '',
              memberName: matchedLegacy ? (matchedLegacy.memberName || '') : '',
              status: (matchedLegacy && matchedLegacy.memberName) ? '已排班' : '未指派'
            });
          }
        }
      }
    }
  }

  console.log('產生標準槽位總數:', canonicalDocs.length);

  console.log('清理舊文件...');
  const batchSize = 400;
  for (let i = 0; i < allExistingDocs.length; i += batchSize) {
    const batch = db.batch();
    allExistingDocs.slice(i, i + batchSize).forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  }

  console.log('寫入標準化槽位文件...');
  for (let i = 0; i < canonicalDocs.length; i += batchSize) {
    const batch = db.batch();
    canonicalDocs.slice(i, i + batchSize).forEach(item => {
      const ref = db.collection('dutyShifts').doc(item.id);
      batch.set(ref, {
        ...item,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });
    await batch.commit();
  }

  console.log('✓ Firestore dutyShifts 標準化完成！');
}

canonicalizeDuties().catch(console.error);

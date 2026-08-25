const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const line = require('@line/bot-sdk');
const { LINE_CHANNEL_ACCESS_TOKEN } = require('./secrets');

const SHIFT_TIMES = {
  '東港聯絡處': { 'DG_F': '08:00~13:00', 'DG_M': '13:00~17:00' },
  '宜蘭園區': { 'YL_F': '08:00~16:00', 'YL_M1': '16:00~18:30', 'YL_M2': '18:30~20:30' }
};

exports.sendDutyRemindersForDate = onCall({
  secrets: [LINE_CHANNEL_ACCESS_TOKEN],
  cors: true
}, async (request) => {
  let targetDate = (request.data && request.data.dateStr);
  if (!targetDate) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    targetDate = tomorrow.toISOString().substring(0, 10);
  }

  const db = admin.firestore();
  const dutiesSnap = await db.collection('dutyShifts').where('dutyDate', '==', targetDate).get();
  if (dutiesSnap.empty) {
    return { success: true, sentCount: 0, unsentCount: 0, message: `${targetDate} 當天查無排班紀錄` };
  }

  const bindingsSnap = await db.collection('lineBindings').get();
  const bindingByMemberId = {};
  const bindingByMemberName = {};

  bindingsSnap.docs.forEach(doc => {
    const b = doc.data();
    if (b.lineUserId) {
      if (b.memberId) bindingByMemberId[b.memberId] = b.lineUserId;
      if (b.memberName) bindingByMemberName[b.memberName] = b.lineUserId;
    }
  });

  const client = new line.messagingApi.MessagingApiClient({
    channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN.value() || ''
  });

  let sentCount = 0;
  let unsentCount = 0;
  const sentDetails = [];

  for (const doc of dutiesSnap.docs) {
    const duty = doc.data();
    if (!duty.memberName) continue;

    const lineUserId = bindingByMemberId[duty.memberId] || bindingByMemberName[duty.memberName];
    const shiftTime = duty.timeRange || (SHIFT_TIMES[duty.location] && SHIFT_TIMES[duty.location][duty.shiftId]) || '詳見排班表';

    if (lineUserId) {
      const msgText = `【值班溫馨提醒】\n${duty.memberName} 師兄/師姊 阿彌陀佛！\n您於 (${targetDate}) 有排定道場值班服務：\n• 道場地點：${duty.location}\n• 時段班次：${duty.shiftLabel} (${duty.genderType}眾)\n• 值班時間：${shiftTime}\n\n感恩您的護持與付出！🌸`;

      try {
        await client.pushMessage({
          to: lineUserId,
          messages: [{ type: 'text', text: msgText }]
        });
        sentCount++;
        sentDetails.push({ name: duty.memberName, location: duty.location, shift: duty.shiftLabel, status: '成功' });
      } catch (err) {
        console.error(`值班提醒發送失敗給 ${duty.memberName}:`, err);
        unsentCount++;
      }
    } else {
      unsentCount++;
    }
  }

  return {
    success: true,
    targetDate,
    totalAssigned: sentCount + unsentCount,
    sentCount,
    unsentCount,
    sentDetails,
    message: `已成功發送 ${sentCount} 則值班提醒！${unsentCount > 0 ? '（' + unsentCount + ' 席次志工尚未綁定 LINE）' : ''}`
  };
});

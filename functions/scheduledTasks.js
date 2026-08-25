const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const line = require('@line/bot-sdk');
const { LINE_CHANNEL_ACCESS_TOKEN } = require('./secrets');

const SHIFT_TIMES = {
  '東港聯絡處': { 'DG_F': '08:00~13:00', 'DG_M': '13:00~17:00' },
  '宜蘭園區': { 'YL_F': '08:00~16:00', 'YL_M1': '16:00~18:30', 'YL_M2': '18:30~20:30' }
};

exports.sendDutyRemindersScheduled = onSchedule({
  schedule: 'every day 08:00',
  timeZone: 'Asia/Taipei',
  secrets: [LINE_CHANNEL_ACCESS_TOKEN]
}, async () => {
  const db = admin.firestore();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().substring(0, 10);

  const dutiesSnap = await db.collection('dutyShifts').where('dutyDate', '==', tomorrowStr).get();
  if (dutiesSnap.empty) return;

  const client = new line.messagingApi.MessagingApiClient({
    channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN.value() || ''
  });

  for (const doc of dutiesSnap.docs) {
    const duty = doc.data();
    if (!duty.memberName) continue;

    let bindingSnap = await db.collection('lineBindings').where('memberId', '==', duty.memberId).get();
    if (bindingSnap.empty && duty.memberName) {
      bindingSnap = await db.collection('lineBindings').where('memberName', '==', duty.memberName).get();
    }

    if (!bindingSnap.empty) {
      const binding = bindingSnap.docs[0].data();
      const shiftTime = duty.timeRange || (SHIFT_TIMES[duty.location] && SHIFT_TIMES[duty.location][duty.shiftId]) || '詳見排班表';
      try {
        await client.pushMessage({
          to: binding.lineUserId,
          messages: [{
            type: 'text',
            text: `【明日值班溫馨提醒】\n${binding.memberName} 師兄/師姊 阿彌陀佛！\n您明天 (${tomorrowStr}) 於「${duty.location}」有值班服務：\n• 時段班次：${duty.shiftLabel} (${duty.genderType}眾)\n• 值班時間：${shiftTime}\n\n感恩您的護持與付出！🌸`
          }]
        });
      } catch (err) {
        console.error(`Failed to push reminder to ${binding.memberName}:`, err);
      }
    }
  }
});

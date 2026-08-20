const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const line = require('@line/bot-sdk');

const db = admin.firestore();

// 每日早上 08:00 (台北時區) 自動推播隔日值班提醒 (改用 Multicast 提升效能)
exports.sendDutyRemindersScheduled = onSchedule({
  schedule: 'every day 08:00',
  timeZone: 'Asia/Taipei'
}, async () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().substring(0, 10);

  const dutiesSnap = await db.collection('dutyShifts').where('dutyDate', '==', tomorrowStr).get();
  if (dutiesSnap.empty) return;

  const client = new line.messagingApi.MessagingApiClient({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || ''
  });

  for (const doc of dutiesSnap.docs) {
    const duty = doc.data();
    if (!duty.memberId) continue;

    // 查找志工綁定
    const bindingSnap = await db.collection('lineBindings').where('memberId', '==', duty.memberId).get();
    if (!bindingSnap.empty) {
      const binding = bindingSnap.docs[0].data();
      try {
        await client.pushMessage({
          to: binding.lineUserId,
          messages: [{
            type: 'text',
            text: `【明日值班溫馨提醒】\n師兄/師姊 阿彌陀佛！\n您明天 (${tomorrowStr}) 於「${duty.location}」有值班服務：\n時段班次：${duty.shiftLabel} (${duty.genderType}眾)\n感恩您的護持與付出！🌸`
          }]
        });
      } catch (err) {
        console.error(`Failed to push reminder to ${binding.memberName}:`, err);
      }
    }
  }
});

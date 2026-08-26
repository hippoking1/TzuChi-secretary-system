const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const line = require('@line/bot-sdk');
const { LINE_CHANNEL_ACCESS_TOKEN } = require('./secrets');

const SHIFT_TIMES = {
  '東港聯絡處': { 'DG_F': '08:00~13:00', 'DG_M': '13:00~17:00' },
  '宜蘭園區': { 'YL_F': '08:00~16:00', 'YL_M1': '16:00~18:30', 'YL_M2': '18:30~20:30' }
};

// 1. 每日 08:00 自動推播隔日【道場值班提醒】
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

// 2. 每日 08:30 自動推播隔日【活動參與提醒】
exports.sendEventRemindersScheduled = onSchedule({
  schedule: 'every day 08:30',
  timeZone: 'Asia/Taipei',
  secrets: [LINE_CHANNEL_ACCESS_TOKEN]
}, async () => {
  const db = admin.firestore();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().substring(0, 10);

  const eventsSnap = await db.collection('events').where('eventDate', '==', tomorrowStr).get();
  if (eventsSnap.empty) return;

  const bindingsSnap = await db.collection('lineBindings').get();
  const bindingByMemberId = {};
  const bindingByName = {};
  const bindingByPhone = {};

  bindingsSnap.docs.forEach(doc => {
    const b = doc.data();
    if (b.lineUserId) {
      if (b.memberId) bindingByMemberId[b.memberId] = b.lineUserId;
      if (b.memberName) bindingByName[b.memberName] = b.lineUserId;
      if (b.memberPhone) bindingByPhone[b.memberPhone] = b.lineUserId;
    }
  });

  const client = new line.messagingApi.MessagingApiClient({
    channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN.value() || ''
  });

  for (const eventDoc of eventsSnap.docs) {
    const event = eventDoc.data();
    const regsSnap = await db.collection('registrations')
      .where('eventId', '==', eventDoc.id)
      .where('status', '==', '已確認')
      .get();

    for (const regDoc of regsSnap.docs) {
      const reg = regDoc.data();
      const name = reg.name || reg.guestName || reg.memberName || '';
      const phone = reg.phone || reg.guestPhone || reg.memberPhone || '';
      const memberId = reg.memberId || '';

      const lineUserId = bindingByMemberId[memberId] || bindingByName[name] || (phone ? bindingByPhone[phone] : null);

      if (lineUserId) {
        const msgText = `【明日活動溫馨提醒】\n${name} 菩薩/大德 阿彌陀佛！\n提醒您明天 (${event.eventDate}) 有報名參加慈濟活動：\n• 活動名稱：${event.title}\n• 活動分類：${event.category || '慈濟活動'}\n• 活動時間：${event.eventStartTime || ''} ~ ${event.eventEndTime || ''}\n• 舉辦地點：${event.location || '慈濟園區'}\n• 聯絡窗口：${event.contactName ? event.contactName + ' ' + (event.contactPhone || '') : '活動幹事'}\n\n誠摯期待您的蒞臨參與，感恩！🌸`;

        try {
          await client.pushMessage({
            to: lineUserId,
            messages: [{ type: 'text', text: msgText }]
          });
        } catch (err) {
          console.error(`定時活動通知發送失敗 (${name}):`, err);
        }
      }
    }
  }
});

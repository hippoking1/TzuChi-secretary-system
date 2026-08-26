const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const line = require('@line/bot-sdk');
const { LINE_CHANNEL_ACCESS_TOKEN } = require('./secrets');

exports.sendEventRemindersForDate = onCall({
  secrets: [LINE_CHANNEL_ACCESS_TOKEN],
  cors: true
}, async (request) => {
  let { dateStr, eventId } = request.data || {};
  if (!dateStr && !eventId) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    dateStr = tomorrow.toISOString().substring(0, 10);
  }

  const db = admin.firestore();
  let eventsToNotify = [];

  if (eventId) {
    const doc = await db.collection('events').doc(eventId).get();
    if (doc.exists) {
      eventsToNotify.push({ id: doc.id, ...doc.data() });
    }
  } else if (dateStr) {
    const snap = await db.collection('events').where('eventDate', '==', dateStr).get();
    eventsToNotify = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  if (eventsToNotify.length === 0) {
    return {
      success: true,
      sentCount: 0,
      unsentCount: 0,
      message: `查無 ${dateStr || eventId} 的活動資料`
    };
  }

  // 讀取所有 LINE 綁定資料建立索引
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

  let totalRegistrations = 0;
  let sentCount = 0;
  let unsentCount = 0;
  const sentDetails = [];

  for (const event of eventsToNotify) {
    const regsSnap = await db.collection('registrations')
      .where('eventId', '==', event.id)
      .where('status', '==', '已確認')
      .get();

    totalRegistrations += regsSnap.size;

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
          sentCount++;
          sentDetails.push({ name, eventTitle: event.title, status: '成功' });

          await regDoc.ref.update({
            reminderSentAt: admin.firestore.FieldValue.serverTimestamp()
          });
        } catch (err) {
          console.error(`活動通知發送失敗 (${name}):`, err);
          unsentCount++;
        }
      } else {
        unsentCount++;
      }
    }
  }

  return {
    success: true,
    targetDate: dateStr,
    totalEvents: eventsToNotify.length,
    totalRegistrations,
    sentCount,
    unsentCount,
    sentDetails,
    message: `活動提醒已成功推播給 ${sentCount} 位已綁定 LINE 的報名成員！${unsentCount > 0 ? '（另有 ' + unsentCount + ' 位尚未綁定 LINE）' : ''}`
  };
});

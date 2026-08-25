const { onCall } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const line = require('@line/bot-sdk');

const LINE_CHANNEL_ACCESS_TOKEN = defineSecret('LINE_CHANNEL_ACCESS_TOKEN');
const db = admin.firestore();

exports.sendMeetingNotifications = onCall({
  secrets: [LINE_CHANNEL_ACCESS_TOKEN],
  cors: true
}, async (request) => {
  const { meetingId } = request.data || {};
  if (!meetingId) {
    throw new Error('未提供會議 ID (meetingId)');
  }

  // 1. 讀取會議資料
  const meetingDoc = await db.collection('meetings').doc(meetingId).get();
  if (!meetingDoc.exists) {
    throw new Error('找不到該會議記錄');
  }
  const meeting = meetingDoc.data();

  // 2. 讀取會議出席名單
  const participantsSnap = await db.collection(`meetings/${meetingId}/participants`).get();
  if (participantsSnap.empty) {
    return {
      success: true,
      total: 0,
      sentCount: 0,
      unsentCount: 0,
      message: '此會議目前尚無出席志工'
    };
  }

  // 3. 讀取所有 LINE 綁定資料建立對照表
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
  const sentNames = [];
  const unsentNames = [];

  for (const doc of participantsSnap.docs) {
    const p = doc.data();
    const lineUserId = bindingByMemberId[p.memberId] || bindingByMemberName[p.memberName];

    if (lineUserId) {
      const msgText = `【慈濟會議出席通知】\n${p.memberName} 師兄/師姊 阿彌陀佛！\n您有排定出席以下會議，請撥冗準時出席：\n• 會議主題：${meeting.title || '社區組隊會議'}\n• 開會時間：${meeting.meetingDate} ${meeting.startTime || ''}${meeting.endTime ? ' ~ ' + meeting.endTime : ''}\n• 開會地點：${meeting.location || '待定'}\n• 備註說明：${meeting.description || '無'}\n\n感恩您的護持與付出！🌸`;

      try {
        await client.pushMessage({
          to: lineUserId,
          messages: [{ type: 'text', text: msgText }]
        });
        sentCount++;
        sentNames.push(p.memberName);

        // 標記通知時間
        await doc.ref.update({
          notifiedAt: admin.firestore.FieldValue.serverTimestamp(),
          notifyStatus: '已發送'
        });
      } catch (err) {
        console.error(`發送會議通知給 ${p.memberName} (${lineUserId}) 失敗:`, err);
        unsentCount++;
        unsentNames.push(p.memberName);
      }
    } else {
      unsentCount++;
      unsentNames.push(p.memberName);
    }
  }

  // 更新會議本身的推播狀態
  await meetingDoc.ref.update({
    lastNotifyAt: admin.firestore.FieldValue.serverTimestamp(),
    notifySentCount: sentCount
  });

  return {
    success: true,
    total: participantsSnap.size,
    sentCount,
    unsentCount,
    sentNames,
    unsentNames,
    message: `會議通知已成功發送給 ${sentCount} 位志工！${unsentCount > 0 ? '（另有 ' + unsentCount + ' 位志工尚未綁定 LINE）' : ''}`
  };
});

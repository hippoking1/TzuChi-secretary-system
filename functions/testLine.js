const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const line = require('@line/bot-sdk');
const { LINE_CHANNEL_ACCESS_TOKEN } = require('./secrets');
const { buildSwapConfirmFlexMessage } = require('./shiftSwap');

exports.sendTestLineMessage = onCall({
  secrets: [LINE_CHANNEL_ACCESS_TOKEN],
  cors: true
}, async (request) => {
  const { lineUserId, type, memberName, memberId } = request.data || {};
  if (!lineUserId) {
    throw new Error('未提供 LINE User ID');
  }

  const client = new line.messagingApi.MessagingApiClient({
    channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN.value() || ''
  });

  const db = admin.firestore();

  // 1. 換班 / 轉班 Flex Message 測試
  if (type === 'swap' || type === 'transfer') {
    const isTransfer = type === 'transfer';
    const testSwapId = `test_swap_${Date.now()}`;
    const deadlineStr = '明日 20:00';

    const testSwapData = {
      id: testSwapId,
      swapType: isTransfer ? 'transfer' : 'exchange',
      requesterId: 'test_requester_id',
      requesterName: '系統測試員',
      requesterLineUserId: '',
      targetId: memberId || 'test_target_id',
      targetName: memberName || '志工',
      targetLineUserId: lineUserId,

      requesterDutyId: 'test_duty_req',
      requesterDutyDate: '2026-11-08',
      requesterLocation: '宜蘭園區',
      requesterShiftId: 'YL_F',
      requesterShiftLabel: '女眾班',
      requesterTimeRange: '08:00~16:00',
      genderType: '女',

      targetDutyId: isTransfer ? null : 'test_duty_target',
      targetDutyDate: isTransfer ? null : '2026-11-15',
      targetLocation: isTransfer ? null : '宜蘭園區',
      targetShiftId: isTransfer ? null : 'YL_F',
      targetShiftLabel: isTransfer ? null : '女眾班',
      targetTimeRange: isTransfer ? null : '08:00~16:00',

      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      deadline: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 24 * 3600 * 1000)),
      deadlineStr: deadlineStr,
      isTest: true
    };

    // 建立臨時測試申請記錄
    await db.collection('shiftSwapRequests').doc(testSwapId).set(testSwapData);

    const flexMsg = buildSwapConfirmFlexMessage(testSwapData);

    try {
      await client.pushMessage({
        to: lineUserId,
        messages: [flexMsg]
      });
      return { success: true, message: `已成功向 ${memberName || '志工'} 發送【${isTransfer ? '轉班代班' : '雙向換班'}測試卡片】！` };
    } catch (err) {
      console.error("LINE Push Error:", err);
      throw new Error('LINE 發送失敗：' + (err.message || '請確認 Access Token 與 User ID 是否有效'));
    }
  }

  // 2. 一般文字推播測試 (值班提醒 / 開會通知 / 連線測試)
  let messageText = '';
  if (type === 'duty') {
    messageText = `【系統測試 — 明日值班提醒】\n${memberName || '師兄/師姊'} 阿彌陀佛！\n這是系統發送的「值班提醒」測試訊息。\n您明天於道場有值班服務，感恩您的護持與付出！🌸`;
  } else if (type === 'meeting') {
    messageText = `【系統測試 — 開會通知推播】\n${memberName || '師兄/師姊'} 阿彌陀佛！\n這是系統發送的「會議通知」測試訊息。\n主題：慈濟社區組隊月例會\n時間：明晚 19:30\n地點：靜思堂 201 會議室\n請準時出席，感恩！`;
  } else {
    messageText = `【系統測試】\n${memberName || '志工'} 您好，這是一則來自慈濟小祕書系統的 LINE 推播連線測試訊息！✓`;
  }

  try {
    await client.pushMessage({
      to: lineUserId,
      messages: [{ type: 'text', text: messageText }]
    });
    return { success: true, message: '測試訊息已成功送達 LINE！' };
  } catch (err) {
    console.error("LINE Push Error:", err);
    throw new Error('LINE 發送失敗：' + (err.message || '請確認 Access Token 與 User ID 是否有效'));
  }
});


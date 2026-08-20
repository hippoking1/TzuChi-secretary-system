const { onCall } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const line = require('@line/bot-sdk');

const LINE_CHANNEL_ACCESS_TOKEN = defineSecret('LINE_CHANNEL_ACCESS_TOKEN');

// 測試發送 LINE 推播訊息
exports.sendTestLineMessage = onCall({
  secrets: [LINE_CHANNEL_ACCESS_TOKEN],
  cors: true
}, async (request) => {
  const { lineUserId, type, memberName } = request.data || {};
  if (!lineUserId) {
    throw new Error('未提供 LINE User ID');
  }

  const client = new line.messagingApi.MessagingApiClient({
    channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN.value() || ''
  });

  let messageText = '';
  if (type === 'duty') {
    messageText = `【系統測試 — 明日值班提醒】\n${memberName || '師兄/師姊'} 阿彌陀佛！\n這是系統發送的「值班提醒」測試訊息。\n您明天於「花蓮/宜蘭/東港」有值班服務，感恩您的護持與付出！🌸`;
  } else if (type === 'meeting') {
    messageText = `【系統測試 — 開會通知推播】\n${memberName || '師兄/師姊'} 阿彌陀佛！\n這是系統發送的「會議通知」測試訊息。\n主題：慈濟社區組隊月例會\n時間：明晚 19:30\n地點：靜思堂 201 會議室\n請準時出席，感恩！`;
  } else {
    messageText = `【系統測試】\n${memberName || '志工'} 您好，這是一則來自慈濟活動系統的 LINE 推播連線測試訊息！✓`;
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

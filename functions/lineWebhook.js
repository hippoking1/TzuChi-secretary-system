const functions = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const crypto = require('crypto');
const line = require('@line/bot-sdk');

const db = admin.firestore();

// LINE Webhook 端點 (含 HMAC-SHA256 簽名驗證)
exports.lineWebhook = functions.onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const channelSecret = process.env.LINE_CHANNEL_SECRET || functions.params.defineSecret('LINE_CHANNEL_SECRET').value();
  const signature = req.headers['x-line-signature'];

  // 1. 驗證 LINE 簽名 (徹底修復資安弱點)
  if (channelSecret && signature) {
    const bodyString = JSON.stringify(req.body);
    const hash = crypto.createHmac('SHA256', channelSecret).update(bodyString).digest('base64');
    if (hash !== signature) {
      console.warn("Invalid LINE Webhook Signature");
      return res.status(401).send('Invalid signature');
    }
  }

  const events = req.body.events || [];
  const client = new line.messagingApi.MessagingApiClient({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || ''
  });

  for (const event of events) {
    if (event.type === 'message' && event.message.type === 'text') {
      const text = event.message.text.trim();
      const userId = event.source.userId;

      // 檢查是否為綁定指令 (格式：姓名 組織)
      if (text.includes(' ') || text.includes('　')) {
        const [name, orgName] = text.split(/[\s　]+/);
        const membersSnap = await db.collection('members').where('name', '==', name).get();
        
        if (!membersSnap.empty) {
          const member = membersSnap.docs[0].data();
          await db.collection('lineBindings').doc(userId).set({
            memberId: membersSnap.docs[0].id,
            memberName: member.name,
            memberPhone: member.phone,
            lineUserId: userId,
            bindingTime: new Date().toISOString()
          }, { merge: true });

          await client.replyMessage({
            replyToken: event.replyToken,
            messages: [{
              type: 'text',
              text: `感恩 ${member.name} 師兄/師姊！您已成功綁定慈濟活動系統，日後將為您推播值班提醒與開會通知。`
            }]
          });
          continue;
        }
      }

      // 一般關鍵字選單回覆
      if (text === '值班查詢') {
        const bindingSnap = await db.collection('lineBindings').doc(userId).get();
        if (!bindingSnap.exists) {
          await client.replyMessage({
            replyToken: event.replyToken,
            messages: [{
              type: 'text',
              text: '您尚未綁定志工身分，請輸入「姓名 所屬協力」（例如：張志工 第一協力）進行綁定。'
            }]
          });
        } else {
          const binding = bindingSnap.data();
          const todayStr = new Date().toISOString().substring(0, 10);
          const dutiesSnap = await db.collection('dutyShifts')
            .where('memberId', '==', binding.memberId)
            .where('dutyDate', '>=', todayStr)
            .limit(5)
            .get();

          let msg = `【${binding.memberName} 師兄/師姊 近期值班】\n`;
          if (dutiesSnap.empty) {
            msg += '近期尚無排班紀錄，感恩您的付出！';
          } else {
            dutiesSnap.forEach(d => {
              const dt = d.data();
              msg += `• ${dt.dutyDate} ${dt.location} - ${dt.shiftLabel}\n`;
            });
          }

          await client.replyMessage({
            replyToken: event.replyToken,
            messages: [{ type: 'text', text: msg }]
          });
        }
      }
    }
  }

  return res.status(200).send('OK');
});

const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const crypto = require('crypto');
const line = require('@line/bot-sdk');
const { LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN } = require('./secrets');

exports.lineWebhook = onRequest({
  cors: true,
  secrets: [LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN]
}, async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const channelSecret = LINE_CHANNEL_SECRET.value();
  const signature = req.headers['x-line-signature'];

  if (channelSecret && signature) {
    const rawBody = req.rawBody ? req.rawBody : Buffer.from(JSON.stringify(req.body));
    const hash = crypto.createHmac('SHA256', channelSecret).update(rawBody).digest('base64');
    if (hash !== signature) {
      console.warn("Invalid LINE Webhook Signature. Expected:", signature, "Computed:", hash);
      return res.status(401).send('Invalid signature');
    }
  }

  const db = admin.firestore();
  const events = req.body.events || [];
  const client = new line.messagingApi.MessagingApiClient({
    channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN.value() || ''
  });

  for (const event of events) {
    if (event.type === 'message' && event.message.type === 'text') {
      const text = (event.message.text || '').trim();
      const userId = event.source.userId;
      const replyToken = event.replyToken;

      if (!text || !userId) continue;

      // 1. 指令：值班查詢
      if (text === '值班查詢') {
        const bindingSnap = await db.collection('lineBindings').doc(userId).get();
        if (!bindingSnap.exists) {
          await client.replyMessage({
            replyToken,
            messages: [{
              type: 'text',
              text: '您尚未綁定志工身分，請輸入「姓名 所屬組織」（例如：何忠憲 互愛三）進行綁定。'
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
            msg += '近期尚無排班紀錄，感恩您的護持與付出！🌸';
          } else {
            dutiesSnap.forEach(d => {
              const dt = d.data();
              msg += `• ${dt.dutyDate} ${dt.location} - ${dt.shiftLabel}\n`;
            });
            msg += '\n感恩您的護持與付出！🌸';
          }

          await client.replyMessage({
            replyToken,
            messages: [{ type: 'text', text: msg }]
          });
        }
        continue;
      }

      // 2. 指令：查詢綁定 / 我的綁定
      if (text === '查詢綁定' || text === '我的綁定') {
        const bindingSnap = await db.collection('lineBindings').doc(userId).get();
        if (!bindingSnap.exists) {
          await client.replyMessage({
            replyToken,
            messages: [{
              type: 'text',
              text: '【尚未綁定】\n您尚未將此 LINE 帳號綁定志工名冊。\n請輸入「姓名 所屬組織」（例如：何忠憲 互愛三）即可完成綁定！'
            }]
          });
        } else {
          const binding = bindingSnap.data();
          await client.replyMessage({
            replyToken,
            messages: [{
              type: 'text',
              text: `【目前綁定資訊】✓\n• 志工姓名：${binding.memberName}\n• 聯絡電話：${binding.memberPhone || '未設定'}\n• 綁定時間：${binding.bindingTime || '已綁定'}\n\n若需重新綁定，請直接輸入新的「姓名 組織別」。`
            }]
          });
        }
        continue;
      }

      // 3. 指令：解除綁定
      if (text === '解除綁定') {
        await db.collection('lineBindings').doc(userId).delete();
        await client.replyMessage({
          replyToken,
          messages: [{
            type: 'text',
            text: '已成功解除 LINE 帳號與志工名冊之綁定。如需重新啟用通知，隨時輸入「姓名 組織別」即可！'
          }]
        });
        continue;
      }

      // 4. 志工核身與綁定 (支援：姓名 組織、姓名+組織、姓名/組織，或純姓名)
      const parts = text.split(/[\s\t　,，、/+\-]+/).map(p => p.trim()).filter(Boolean);
      const nameInput = parts[0] || text;
      const orgInput = parts[1] || '';

      // 先依姓名精確查詢
      let membersSnap = await db.collection('members').where('name', '==', nameInput).get();

      // 若未找到且全文不同，試全文
      if (membersSnap.empty && text !== nameInput) {
        membersSnap = await db.collection('members').where('name', '==', text).get();
      }

      // 若仍未找到，嘗試依電話號碼查詢
      if (membersSnap.empty && /^\d+$/.test(nameInput)) {
        membersSnap = await db.collection('members').where('phone', '==', nameInput).get();
      }

      if (!membersSnap.empty) {
        // 若有多位同名志工，可比對電話或組織
        let matchedDoc = membersSnap.docs[0];
        const member = matchedDoc.data();

        await db.collection('lineBindings').doc(userId).set({
          memberId: matchedDoc.id,
          memberName: member.name,
          memberPhone: member.phone || '',
          lineUserId: userId,
          orgInput: orgInput || '',
          bindingTime: new Date().toISOString(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        await client.replyMessage({
          replyToken,
          messages: [{
            type: 'text',
            text: `🌸 感恩 ${member.name} 師兄/師姊 阿彌陀佛！\n\n您已成功將 LINE 帳號綁定「慈濟小祕書系統」。\n\n📌 系統將自動為您推播：\n• 每日 08:00：道場值班溫馨提醒\n• 每日 08:30：志業活動行前提醒\n• 每日 09:00：各項會議出席提醒\n• 幹部發起之即時開會通知\n\n💡 隨時輸入「值班查詢」可查詢近期排班；輸入「查詢綁定」可確認狀態。\n感恩您的護持與付出！🙏`
          }]
        });
        continue;
      }

      // 5. 若皆未匹配，回覆引導說明
      await client.replyMessage({
        replyToken,
        messages: [{
          type: 'text',
          text: `⚠️ 查無志工名冊資料\n\n系統中尚未找到姓名為「${nameInput}」的志工記錄。\n\n請確認：\n1. 輸入之姓名是否與志工名冊完全相符。\n2. 若尚未建立名冊，請洽組隊幹部先於後台「志工名冊」中建檔後再行綁定。\n\n📌 綁定格式範例：\n何忠憲 互愛三`
        }]
      });
    }
  }

  return res.status(200).send('OK');
});

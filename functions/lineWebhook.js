const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const crypto = require('crypto');
const line = require('@line/bot-sdk');
const { LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN } = require('./secrets');
const {
  getTaiwanTodayStr,
  createTransferRequest,
  createExchangeRequest,
  confirmSwap,
  rejectSwap,
  buildSwapConfirmFlexMessage,
  buildDutySelectionFlexMessage,
  buildWelcomeFlexMessage
} = require('./shiftSwap');

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
    const userId = event.source?.userId;
    const replyToken = event.replyToken;

    if (!userId) continue;

    // ─────────────────────────────────────────────
    // 1. Follow 事件（志工加入或重新加入官方帳號）
    // ─────────────────────────────────────────────
    if (event.type === 'follow') {
      try {
        await client.replyMessage({
          replyToken,
          messages: [buildWelcomeFlexMessage()]
        });
      } catch (err) {
        console.error('Failed to send follow welcome message:', err);
      }
      continue;
    }

    // ─────────────────────────────────────────────
    // 2. Postback 事件（Flex Message 按鈕回調）
    // ─────────────────────────────────────────────
    if (event.type === 'postback') {
      const dataStr = event.postback.data || '';
      const params = new URLSearchParams(dataStr);
      const action = params.get('action');

      // (A) 同意調班 / 換班
      if (action === 'confirmSwap') {
        const swapId = params.get('swapId');
        const result = await confirmSwap(swapId, userId);

        if (result.success) {
          const swap = result.swap;
          const isTransfer = swap.swapType === 'transfer';

          // 回覆接班/換班人
          await client.replyMessage({
            replyToken,
            messages: [{
              type: 'text',
              text: `✅ 您已成功確認同意【${isTransfer ? '代班' : '互換班次'}】！\n系統已自動更新排班表。感恩您的護持與承擔！🌸`
            }]
          });

          // 推播給發起者
          if (swap.requesterLineUserId) {
            try {
              const notifyMsg = isTransfer
                ? `🎉【轉班成功通知】\n${swap.targetName} 師兄/師姊 已同意接下您的值班：\n• 道場：${swap.requesterLocation}\n• 日期：${swap.requesterDutyDate}\n• 班次：${swap.requesterShiftLabel} (${swap.requesterTimeRange})\n\n系統排班已同步更新，感恩彼此成就！🌸`
                : `🎉【換班成功通知】\n${swap.targetName} 師兄/師姊 已同意與您互換班次：\n• 您讓出的班次：${swap.requesterDutyDate} ${swap.requesterShiftLabel}\n• 您接手的班次：${swap.targetDutyDate} ${swap.targetShiftLabel}\n\n系統排班已同步更新，感恩彼此成就！🌸`;

              await client.pushMessage({
                to: swap.requesterLineUserId,
                messages: [{ type: 'text', text: notifyMsg }]
              });
            } catch (pushErr) {
              console.error('Failed to push swap success to requester:', pushErr);
            }
          }
        } else {
          await client.replyMessage({
            replyToken,
            messages: [{ type: 'text', text: `⚠️ ${result.message}` }]
          });
        }
        continue;
      }

      // (B) 婉拒調班 / 換班
      if (action === 'rejectSwap') {
        const swapId = params.get('swapId');
        const result = await rejectSwap(swapId, userId);

        if (result.success) {
          const swap = result.swap;
          await client.replyMessage({
            replyToken,
            messages: [{
              type: 'text',
              text: '已記錄您的回覆，感恩告知。🌸'
            }]
          });

          // 推播通知發起者被婉拒
          if (swap.requesterLineUserId) {
            try {
              await client.pushMessage({
                to: swap.requesterLineUserId,
                messages: [{
                  type: 'text',
                  text: `⚠️【調班未完成】\n${swap.targetName} 師兄/師姊 因時段無法配合，已婉拒您的【${swap.requesterDutyDate} ${swap.requesterShiftLabel}】調班請求。請另尋其他志工協調，感恩！`
                }]
              });
            } catch (pushErr) {
              console.error('Failed to push swap rejection to requester:', pushErr);
            }
          }
        } else {
          await client.replyMessage({
            replyToken,
            messages: [{ type: 'text', text: `⚠️ ${result.message}` }]
          });
        }
        continue;
      }

      // (C) 志工點選「轉班 (找人代班)」
      if (action === 'selectForTransfer') {
        const dutyId = params.get('dutyId');
        // 寫入 session (10 分鐘有效)
        await db.collection('swapSessions').doc(userId).set({
          step: 'awaiting_transfer_target',
          dutyId,
          createdAt: Date.now(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        await client.replyMessage({
          replyToken,
          messages: [{
            type: 'text',
            text: '📝 請輸入您想委託代班的【志工姓名】\n（例如：李小華，或 李小華 互愛一）：'
          }]
        });
        continue;
      }

      // (D) 志工點選「換班 (與對方互換)」
      if (action === 'selectForExchange') {
        const dutyId = params.get('dutyId');
        // 寫入 session
        await db.collection('swapSessions').doc(userId).set({
          step: 'awaiting_exchange_target',
          dutyId,
          createdAt: Date.now(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        await client.replyMessage({
          replyToken,
          messages: [{
            type: 'text',
            text: '📝 請輸入【對方志工姓名】與【對方值班日期】\n（格式範例：李小華 2026-09-03）：'
          }]
        });
        continue;
      }

      continue;
    }

    // ─────────────────────────────────────────────
    // 3. Message 事件（文字訊息輸入）
    // ─────────────────────────────────────────────
    if (event.type === 'message' && event.message.type === 'text') {
      const text = (event.message.text || '').trim();
      if (!text) continue;

      // ── 指令 A：綁定引導 ──
      if (text === '綁定' || text === '身分綁定' || text === '志工綁定') {
        const bindingSnap = await db.collection('lineBindings').doc(userId).get();
        if (bindingSnap.exists) {
          const b = bindingSnap.data();
          await client.replyMessage({
            replyToken,
            messages: [{
              type: 'text',
              text: `【您目前已綁定】✓\n• 志工姓名：${b.memberName}\n• 聯絡電話：${b.memberPhone || '未設定'}\n• 綁定時間：${b.bindingTime || '已綁定'}\n\n若需重新綁定其他身分，直接輸入新的「姓名 所屬組織」即可。`
            }]
          });
        } else {
          await client.replyMessage({
            replyToken,
            messages: [{
              type: 'text',
              text: `🌸【志工身分綁定】\n\n請直接在此輸入您的「姓名 所屬組織」（例如：何忠憲 互愛三），系統將自動比對名冊並為您開啟每日值班、活動與會議溫馨提醒！`
            }]
          });
        }
        continue;
      }

      // ── 指令 B：值班查詢 ──
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
          const todayStr = getTaiwanTodayStr();
          const dutiesSnap = await db.collection('dutyShifts')
            .where('memberId', '==', binding.memberId)
            .where('dutyDate', '>=', todayStr)
            .limit(6)
            .get();

          let msg = `【${binding.memberName} 師兄/師姊 近期值班】\n`;
          if (dutiesSnap.empty) {
            msg += '近期尚無排班紀錄，感恩您的護持與付出！🌸';
          } else {
            dutiesSnap.forEach(d => {
              const dt = d.data();
              msg += `• ${dt.dutyDate} ${dt.location} - ${dt.shiftLabel} (${dt.timeRange || ''})\n`;
            });
            msg += '\n💡 輸入「調班」可發起轉班或換班申請。\n感恩您的護持與付出！🌸';
          }

          await client.replyMessage({
            replyToken,
            messages: [{ type: 'text', text: msg }]
          });
        }
        continue;
      }

      // ── 指令 C：調班 / 換班 (發起調班) ──
      if (text === '調班' || text === '換班' || text === '我要調班' || text === '我要換班') {
        const bindingSnap = await db.collection('lineBindings').doc(userId).get();
        if (!bindingSnap.exists) {
          await client.replyMessage({
            replyToken,
            messages: [{
              type: 'text',
              text: '您尚未綁定志工身分，請先輸入「姓名 所屬組織」完成身分綁定後再使用調班功能。'
            }]
          });
        } else {
          const binding = bindingSnap.data();
          const todayStr = getTaiwanTodayStr();
          const dutiesSnap = await db.collection('dutyShifts')
            .where('memberId', '==', binding.memberId)
            .where('dutyDate', '>=', todayStr)
            .limit(10)
            .get();

          const duties = dutiesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          const flexMsg = buildDutySelectionFlexMessage(duties, binding.memberName);

          await client.replyMessage({
            replyToken,
            messages: [flexMsg]
          });
        }
        continue;
      }

      // ── 指令 D：調班紀錄 ──
      if (text === '調班紀錄' || text === '換班紀錄' || text === '我的調班') {
        const bindingSnap = await db.collection('lineBindings').doc(userId).get();
        if (!bindingSnap.exists) {
          await client.replyMessage({
            replyToken,
            messages: [{ type: 'text', text: '您尚未綁定志工身分，請先進行綁定。' }]
          });
        } else {
          const binding = bindingSnap.data();
          const reqSnap = await db.collection('shiftSwapRequests')
            .where('requesterId', '==', binding.memberId)
            .orderBy('createdAt', 'desc')
            .limit(5)
            .get();

          const targetSnap = await db.collection('shiftSwapRequests')
            .where('targetId', '==', binding.memberId)
            .orderBy('createdAt', 'desc')
            .limit(5)
            .get();

          let msg = `【${binding.memberName} 師兄/師姊 近期調班紀錄】\n\n`;
          const allSwaps = [...reqSnap.docs, ...targetSnap.docs]
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
            .slice(0, 5);

          if (allSwaps.length === 0) {
            msg += '近期無任何調班或換班記錄。🌸';
          } else {
            allSwaps.forEach((s, idx) => {
              const statusTag = s.status === 'approved' ? '✅已完成' : s.status === 'pending' ? '⏳待確認' : s.status === 'rejected' ? '❌已婉拒' : s.status === 'expired' ? '⚠️已逾期' : s.status;
              const isReq = s.requesterId === binding.memberId;
              const typeText = s.swapType === 'transfer' ? '轉班(代班)' : '雙向換班';

              msg += `${idx + 1}. [${statusTag}] ${typeText}\n`;
              if (isReq) {
                msg += `   轉給：${s.targetName}\n   原班：${s.requesterDutyDate} ${s.requesterShiftLabel}\n`;
              } else {
                msg += `   發起人：${s.requesterName}\n   接班：${s.requesterDutyDate} ${s.requesterShiftLabel}\n`;
              }
              if (s.swapType === 'exchange' && s.targetDutyDate) {
                msg += `   互換班：${s.targetDutyDate} ${s.targetShiftLabel}\n`;
              }
              msg += '\n';
            });
          }

          await client.replyMessage({
            replyToken,
            messages: [{ type: 'text', text: msg.trim() }]
          });
        }
        continue;
      }

      // ── 指令 E：功能說明 / help ──
      if (text === '功能說明' || text === '說明' || text === 'help' || text === 'HELP' || text === '選單') {
        await client.replyMessage({
          replyToken,
          messages: [buildWelcomeFlexMessage()]
        });
        continue;
      }

      // ── 指令 F：查詢綁定 / 我的綁定 ──
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

      // ── 指令 G：解除綁定 ──
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

      // ── 檢查是否有調班中途之 Session (狀態機) ──
      const sessionSnap = await db.collection('swapSessions').doc(userId).get();
      if (sessionSnap.exists) {
        const session = sessionSnap.data();
        const sessionAge = Date.now() - (session.createdAt || 0);

        // Session 10 分鐘內有效
        if (sessionAge < 10 * 60 * 1000) {
          // (1) 等待輸入代班人姓名 (轉班)
          if (session.step === 'awaiting_transfer_target') {
            const parts = text.split(/[\s\t　,，、/+\-]+/).map(p => p.trim()).filter(Boolean);
            const targetName = parts[0];
            const targetOrg = parts[1] || '';

            const result = await createTransferRequest(userId, session.dutyId, targetName, targetOrg);
            await db.collection('swapSessions').doc(userId).delete();

            if (result.success) {
              // 回覆發起者
              await client.replyMessage({
                replyToken,
                messages: [{ type: 'text', text: result.message }]
              });

              // 推播 Flex Message 給對方
              try {
                await client.pushMessage({
                  to: result.swapRequest.targetLineUserId,
                  messages: [buildSwapConfirmFlexMessage(result.swapRequest)]
                });
              } catch (pushErr) {
                console.error('Failed to push transfer request to target:', pushErr);
              }
            } else {
              await client.replyMessage({
                replyToken,
                messages: [{ type: 'text', text: result.message }]
              });
            }
            continue;
          }

          // (2) 等待輸入對方姓名與日期 (換班)
          if (session.step === 'awaiting_exchange_target') {
            const parts = text.split(/[\s\t　,，、/+\-]+/).map(p => p.trim()).filter(Boolean);
            let targetName = '';
            let targetDutyDate = '';
            let targetOrg = '';

            parts.forEach(p => {
              if (/^\d{4}-\d{2}-\d{2}$/.test(p)) {
                targetDutyDate = p;
              } else if (!targetName) {
                targetName = p;
              } else {
                targetOrg = p;
              }
            });

            if (!targetName || !targetDutyDate) {
              await client.replyMessage({
                replyToken,
                messages: [{
                  type: 'text',
                  text: '⚠️ 格式不完整。請同時提供【對方姓名】與【對方值班日期 (YYYY-MM-DD)】\n範例：李小華 2026-09-03'
                }]
              });
              continue;
            }

            const result = await createExchangeRequest(userId, session.dutyId, targetName, targetDutyDate, targetOrg);
            await db.collection('swapSessions').doc(userId).delete();

            if (result.success) {
              await client.replyMessage({
                replyToken,
                messages: [{ type: 'text', text: result.message }]
              });

              try {
                await client.pushMessage({
                  to: result.swapRequest.targetLineUserId,
                  messages: [buildSwapConfirmFlexMessage(result.swapRequest)]
                });
              } catch (pushErr) {
                console.error('Failed to push exchange request to target:', pushErr);
              }
            } else {
              await client.replyMessage({
                replyToken,
                messages: [{ type: 'text', text: result.message }]
              });
            }
            continue;
          }
        } else {
          // 已逾期，清除過期 session
          await db.collection('swapSessions').doc(userId).delete();
        }
      }

      // ── 指令 H：快速轉班指令（例如：轉班 2026-09-01 李小華） ──
      if (text.startsWith('轉班 ') || text.startsWith('轉班　')) {
        const bindingSnap = await db.collection('lineBindings').doc(userId).get();
        if (!bindingSnap.exists) {
          await client.replyMessage({
            replyToken,
            messages: [{ type: 'text', text: '您尚未綁定志工身分，請先輸入「姓名 組織」進行綁定。' }]
          });
          continue;
        }

        const args = text.replace(/^轉班[\s　]+/, '').split(/[\s\t　,，、/+\-]+/).filter(Boolean);
        const dateArg = args.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a));
        const nameArg = args.find(a => !/^\d{4}-\d{2}-\d{2}$/.test(a));

        if (!dateArg || !nameArg) {
          await client.replyMessage({
            replyToken,
            messages: [{
              type: 'text',
              text: '⚠️ 格式錯誤。快速轉班格式為：\n轉班 [值班日期] [接班志工姓名]\n範例：轉班 2026-09-01 李小華'
            }]
          });
          continue;
        }

        const binding = bindingSnap.data();
        const myDutiesSnap = await db.collection('dutyShifts')
          .where('memberId', '==', binding.memberId)
          .where('dutyDate', '==', dateArg)
          .get();

        if (myDutiesSnap.empty) {
          await client.replyMessage({
            replyToken,
            messages: [{ type: 'text', text: `您在 ${dateArg} 並無排定值班。` }]
          });
          continue;
        }

        const dutyId = myDutiesSnap.docs[0].id;
        const result = await createTransferRequest(userId, dutyId, nameArg);

        if (result.success) {
          await client.replyMessage({
            replyToken,
            messages: [{ type: 'text', text: result.message }]
          });
          try {
            await client.pushMessage({
              to: result.swapRequest.targetLineUserId,
              messages: [buildSwapConfirmFlexMessage(result.swapRequest)]
            });
          } catch (pushErr) {
            console.error('Failed to push quick transfer to target:', pushErr);
          }
        } else {
          await client.replyMessage({
            replyToken,
            messages: [{ type: 'text', text: result.message }]
          });
        }
        continue;
      }

      // ── 指令 I：志工核身與綁定 (姓名 組織 / 姓名 / 純電話) ──
      const parts = text.split(/[\s\t　,，、/+\-]+/).map(p => p.trim()).filter(Boolean);
      const nameInput = parts[0] || text;
      const orgInput = parts[1] || '';

      let membersSnap = await db.collection('members').where('name', '==', nameInput).get();

      if (membersSnap.empty && text !== nameInput) {
        membersSnap = await db.collection('members').where('name', '==', text).get();
      }

      if (membersSnap.empty && /^\d+$/.test(nameInput)) {
        membersSnap = await db.collection('members').where('phone', '==', nameInput).get();
      }

      if (!membersSnap.empty) {
        let matchedDoc = membersSnap.docs[0];
        if (membersSnap.docs.length > 1 && orgInput) {
          const found = membersSnap.docs.find(d => {
            const data = d.data();
            return (data.orgName && data.orgName.includes(orgInput)) || (data.phone && data.phone.includes(orgInput));
          });
          if (found) matchedDoc = found;
        }

        const member = matchedDoc.data();

        await db.collection('lineBindings').doc(userId).set({
          memberId: matchedDoc.id,
          memberName: member.name,
          memberPhone: member.phone || '',
          memberGender: member.gender || '',
          lineUserId: userId,
          orgInput: orgInput || '',
          bindingTime: new Date().toISOString(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        await client.replyMessage({
          replyToken,
          messages: [{
            type: 'text',
            text: `🌸 感恩 ${member.name} 師兄/師姊 阿彌陀佛！\n\n您已成功將 LINE 帳號綁定「慈濟小祕書系統」。\n\n📌 系統將自動為您推播：\n• 每日 08:00：道場值班溫馨提醒\n• 每日 08:30：志業活動行前提醒\n• 每日 09:00：各項會議出席提醒\n• 🔄 自助調班 / 換班推播確認\n\n💡 隨時輸入「值班查詢」可查詢近期排班；輸入「調班」可進行調班換班！\n感恩您的護持與付出！🙏`
          }]
        });
        continue;
      }

      // ── 指令 J：未匹配任何指令或名冊 ──
      await client.replyMessage({
        replyToken,
        messages: [{
          type: 'text',
          text: `⚠️ 查無志工名冊資料\n\n系統中尚未找到姓名為「${nameInput}」的志工記錄。\n\n請確認：\n1. 輸入之姓名是否與志工名冊完全相符。\n2. 若尚未建立名冊，請洽組隊幹部先於後台「志工名冊」中建檔後再行綁定。\n\n📌 綁定格式範例：\n何忠憲 互愛三\n\n💡 輸入「功能說明」可查看所有可用功能！`
        }]
      });
    }
  }

  return res.status(200).send('OK');
});


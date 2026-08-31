const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const crypto = require('crypto');
const line = require('@line/bot-sdk');
const { LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN } = require('./secrets');
const {
  getTaiwanTodayStr,
  normalizeName,
  checkPersonMatch,
  createTransferRequest,
  createExchangeRequest,
  confirmSwap,
  rejectSwap,
  buildSwapConfirmFlexMessage,
  buildDutySelectionFlexMessage,
  buildWelcomeFlexMessage
} = require('./shiftSwap');

/**
 * 健壯取得使用者的 LINE 綁定資料（相容 docId=userId 或 docId=uuid+field=lineUserId）
 */
async function getBindingByUserId(db, userId) {
  const docSnap = await db.collection('lineBindings').doc(userId).get();
  if (docSnap.exists) {
    return { id: docSnap.id, ...docSnap.data() };
  }
  const qSnap = await db.collection('lineBindings').where('lineUserId', '==', userId).limit(1).get();
  if (!qSnap.empty) {
    return { id: qSnap.docs[0].id, ...qSnap.docs[0].data() };
  }
  return null;
}

/**
 * 健壯取得志工未來的排班清單（免依賴複合索引，支援姓名、異體字與法號模糊比對）
 */
async function getDutiesForUser(db, binding, todayStr) {
  const dutiesSnap = await db.collection('dutyShifts')
    .where('dutyDate', '>=', todayStr)
    .get();

  const myDuties = [];
  dutiesSnap.forEach(d => {
    const dt = { id: d.id, ...d.data() };
    const isMatch = checkPersonMatch(dt.memberId, dt.memberName, binding.memberId, binding.memberName, binding.dharmaName);
    if (isMatch) {
      myDuties.push(dt);
    }
  });

  return myDuties.sort((a, b) => (a.dutyDate + (a.shiftStart || '')).localeCompare(b.dutyDate + (b.shiftStart || '')));
}

/**
 * 健壯解析換班輸入（支援跨行、多種日期格式如 YYYY-MM-DD, YYYY/M/D, M/D, YYYY年M月D日）
 */
function parseExchangeInput(rawText) {
  if (!rawText) return { targetName: '', targetDutyDate: '', targetOrg: '' };
  const text = rawText.trim();

  let matchedDate = '';
  // 1. 完整年月日格式 (2026-11-08, 2026-11-8, 2026/11/8, 2026.11.8, 2026年11月8日)
  const fullYearDateMatch = text.match(/(\d{4})[./\-\s年](\d{1,2})[./\-\s月](\d{1,2})[日號]?/);
  if (fullYearDateMatch) {
    const y = fullYearDateMatch[1];
    const m = fullYearDateMatch[2].padStart(2, '0');
    const d = fullYearDateMatch[3].padStart(2, '0');
    matchedDate = `${y}-${m}-${d}`;
  } else {
    // 2. 無年份格式 (11/8, 11-8, 11月8日) - 自動補上當前年份
    const monthDayMatch = text.match(/(?:^|[^\d])(\d{1,2})[./\-\s月](\d{1,2})[日號]?(?:[^\d]|$)/);
    if (monthDayMatch) {
      const currentYear = new Date().getFullYear();
      const m = monthDayMatch[1].padStart(2, '0');
      const d = monthDayMatch[2].padStart(2, '0');
      matchedDate = `${currentYear}-${m}-${d}`;
    }
  }

  // 將日期部分自字串中移除，剩下的即為姓名與組織
  let cleanText = text;
  if (fullYearDateMatch) {
    cleanText = cleanText.replace(fullYearDateMatch[0], ' ');
  } else {
    cleanText = cleanText.replace(/(?:^|[^\d])(\d{1,2})[./\-\s月](\d{1,2})[日號]?(?:[^\d]|$)/, ' ');
  }

  const remainingParts = cleanText.split(/[\s\t\r\n　,，、]+/).map(p => p.trim()).filter(Boolean);
  const targetName = remainingParts[0] || '';
  const targetOrg = remainingParts[1] || '';

  return { targetName, targetDutyDate: matchedDate, targetOrg };
}

/**
 * 健壯解析轉班輸入
 */
function parseTransferInput(rawText) {
  if (!rawText) return { targetName: '', targetOrg: '' };
  const parts = rawText.split(/[\s\t\r\n　,，、]+/).map(p => p.trim()).filter(Boolean);
  const targetName = parts[0] || '';
  const targetOrg = parts[1] || '';
  return { targetName, targetOrg };
}

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

    try {
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

            await client.replyMessage({
              replyToken,
              messages: [{
                type: 'text',
                text: `✅ 您已成功確認同意【${isTransfer ? '代班' : '互換班次'}】！\n系統已自動更新排班表。感恩您的護持與承擔！🌸`
              }]
            });

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
              text: '📝 請輸入您想委託代班的【志工姓名】\n（例如：李麗珠，或 李麗珠 互愛一）：'
            }]
          });
          continue;
        }

        // (D) 志工點選「換班 (與對方互換)」
        if (action === 'selectForExchange') {
          const dutyId = params.get('dutyId');
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
              text: '📝 請輸入【對方志工姓名】與【對方值班日期】\n（格式範例：李麗珠 2026-11-08，或 李麗珠 11/8）：'
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
          const binding = await getBindingByUserId(db, userId);
          if (binding) {
            await client.replyMessage({
              replyToken,
              messages: [{
                type: 'text',
                text: `【您目前已綁定】✓\n• 志工姓名：${binding.memberName}\n• 聯絡電話：${binding.memberPhone || '未設定'}\n• 綁定時間：${binding.bindingTime || '已綁定'}\n\n若需重新綁定其他身分，直接輸入新的「姓名 所屬組織」即可。`
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
          const binding = await getBindingByUserId(db, userId);
          if (!binding) {
            await client.replyMessage({
              replyToken,
              messages: [{
                type: 'text',
                text: '您尚未綁定志工身分，請輸入「姓名 所屬組織」（例如：何忠憲 互愛三）進行綁定。'
              }]
            });
          } else {
            const todayStr = getTaiwanTodayStr();
            const myDuties = await getDutiesForUser(db, binding, todayStr);

            let msg = `【${binding.memberName} 師兄/師姊 近期值班】\n`;
            if (myDuties.length === 0) {
              msg += '近期尚無排班紀錄，感恩您的護持與付出！🌸';
            } else {
              myDuties.slice(0, 6).forEach(dt => {
                msg += `• ${dt.dutyDate} ${dt.location} - ${dt.shiftLabel} (${dt.timeRange || ''})\n`;
              });
              if (myDuties.length > 6) {
                msg += `... 還有 ${myDuties.length - 6} 班\n`;
              }
              msg += '\n💡 點擊底部「調班換班」或輸入「調班」可發起轉班或換班申請。\n感恩您的護持與付出！🌸';
            }

            await client.replyMessage({
              replyToken,
              messages: [{ type: 'text', text: msg }]
            });
          }
          continue;
        }

        // ── 指令 C：調班 / 換班 (發起調班) ──
        if (text === '調班' || text === '換班' || text === '我要調班' || text === '我要換班' || text === '調班換班') {
          const binding = await getBindingByUserId(db, userId);
          if (!binding) {
            await client.replyMessage({
              replyToken,
              messages: [{
                type: 'text',
                text: '您尚未綁定志工身分，請先輸入「姓名 所屬組織」完成身分綁定後再使用調班功能。'
              }]
            });
          } else {
            const todayStr = getTaiwanTodayStr();
            const myDuties = await getDutiesForUser(db, binding, todayStr);
            const flexMsg = buildDutySelectionFlexMessage(myDuties, binding.memberName);

            await client.replyMessage({
              replyToken,
              messages: [flexMsg]
            });
          }
          continue;
        }

        // ── 指令 D：調班紀錄 ──
        if (text === '調班紀錄' || text === '換班紀錄' || text === '我的調班') {
          const binding = await getBindingByUserId(db, userId);
          if (!binding) {
            await client.replyMessage({
              replyToken,
              messages: [{ type: 'text', text: '您尚未綁定志工身分，請先進行綁定。' }]
            });
          } else {
            const reqSnap = await db.collection('shiftSwapRequests')
              .where('requesterId', '==', binding.memberId)
              .get();

            const targetSnap = await db.collection('shiftSwapRequests')
              .where('targetId', '==', binding.memberId)
              .get();

            let msg = `【${binding.memberName} 師兄/師姊 近期調班紀錄】\n\n`;
            const allSwaps = [...reqSnap.docs, ...targetSnap.docs]
              .map(d => ({ id: d.id, ...d.data() }))
              .sort((a, b) => {
                const tA = a.createdAt?.seconds || (a.createdAt ? new Date(a.createdAt).getTime() / 1000 : 0);
                const tB = b.createdAt?.seconds || (b.createdAt ? new Date(b.createdAt).getTime() / 1000 : 0);
                return tB - tA;
              })
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
          const binding = await getBindingByUserId(db, userId);
          if (!binding) {
            await client.replyMessage({
              replyToken,
              messages: [{
                type: 'text',
                text: '【尚未綁定】\n您尚未將此 LINE 帳號綁定志工名冊。\n請輸入「姓名 所屬組織」（例如：何忠憲 互愛三）即可完成綁定！'
              }]
            });
          } else {
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
          const binding = await getBindingByUserId(db, userId);
          if (binding) {
            await db.collection('lineBindings').doc(binding.id).delete();
          }
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

          if (sessionAge < 10 * 60 * 1000) {
            // 使用者主動取消
            if (text === '取消' || text === '放棄' || text === '退出' || text === '返回') {
              await db.collection('swapSessions').doc(userId).delete();
              await client.replyMessage({
                replyToken,
                messages: [{ type: 'text', text: '已取消本次調班作業。若有需要，隨時點擊底部「調班換班」即可重新發起！🌸' }]
              });
              continue;
            }

            // (1) 等待輸入代班人姓名 (轉班)
            if (session.step === 'awaiting_transfer_target') {
              const { targetName, targetOrg } = parseTransferInput(text);

              if (!targetName) {
                await client.replyMessage({
                  replyToken,
                  messages: [{
                    type: 'text',
                    text: '⚠️ 請輸入有效的志工姓名（例如：李麗珠 或 李麗珠 互愛一）：\n（或輸入「取消」結束）'
                  }]
                });
                continue;
              }

              const result = await createTransferRequest(userId, session.dutyId, targetName, targetOrg);

              if (result.success) {
                // 成功才清除 Session
                await db.collection('swapSessions').doc(userId).delete();
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
                  console.error('Failed to push transfer request to target:', pushErr);
                }
              } else {
                // 失敗時保留 Session，讓志工可再次輸入
                await client.replyMessage({
                  replyToken,
                  messages: [{
                    type: 'text',
                    text: `${result.message}\n\n💡 請重新輸入欲委託代班的志工姓名，或輸入「取消」結束調班。`
                  }]
                });
              }
              continue;
            }

            // (2) 等待輸入對方姓名與日期 (換班)
            if (session.step === 'awaiting_exchange_target') {
              const { targetName, targetDutyDate, targetOrg } = parseExchangeInput(text);

              if (!targetName || !targetDutyDate) {
                await client.replyMessage({
                  replyToken,
                  messages: [{
                    type: 'text',
                    text: '⚠️ 格式不完整。請同時提供【對方姓名】與【對方值班日期】\n\n💡 格式範例：\n• 黃志煌 2026-10-24\n• 李麗珠 11/8\n\n（或輸入「取消」結束換班作業）'
                  }]
                });
                continue;
              }

              const result = await createExchangeRequest(userId, session.dutyId, targetName, targetDutyDate, targetOrg);

              if (result.success) {
                // 成功才清除 Session
                await db.collection('swapSessions').doc(userId).delete();
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
                // 失敗時保留 Session，讓志工可直接再次輸入正確資料
                await client.replyMessage({
                  replyToken,
                  messages: [{
                    type: 'text',
                    text: `${result.message}\n\n💡 請確認後重新輸入【對方志工姓名】與【正確值班日期】，或輸入「取消」結束換班。`
                  }]
                });
              }
              continue;
            }
          } else {
            await db.collection('swapSessions').doc(userId).delete();
          }
        }

        // ── 指令 H：快速轉班指令（例如：轉班 2026-09-01 李小華） ──
        if (text.startsWith('轉班 ') || text.startsWith('轉班　') || text.startsWith('轉班\n')) {
          const binding = await getBindingByUserId(db, userId);
          if (!binding) {
            await client.replyMessage({
              replyToken,
              messages: [{ type: 'text', text: '您尚未綁定志工身分，請先輸入「姓名 組織」進行綁定。' }]
            });
            continue;
          }

          const rawArg = text.replace(/^轉班[\s　\n]+/, '');
          const { targetName: nameArg, targetDutyDate: dateArg } = parseExchangeInput(rawArg);

          if (!dateArg || !nameArg) {
            await client.replyMessage({
              replyToken,
              messages: [{
                type: 'text',
                text: '⚠️ 格式錯誤。快速轉班格式為：\n轉班 [值班日期] [接班志工姓名]\n範例：轉班 2026-11-08 李麗珠'
              }]
            });
            continue;
          }

          const myDuties = await getDutiesForUser(db, binding, dateArg);
          const matchedDuty = myDuties.find(d => d.dutyDate === dateArg);

          if (!matchedDuty) {
            await client.replyMessage({
              replyToken,
              messages: [{ type: 'text', text: `您在 ${dateArg} 並無排定值班。` }]
            });
            continue;
          }

          const result = await createTransferRequest(userId, matchedDuty.id, nameArg);

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

        // ── 防呆檢查：若文字包含日期格式，不可誤判為身分綁定 ──
        const hasDatePattern = /(\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}|\d{1,2}[-/.月]\d{1,2})/.test(text);
        if (hasDatePattern) {
          await client.replyMessage({
            replyToken,
            messages: [{
              type: 'text',
              text: '💡 您輸入了包含日期的訊息。\n若要申請調班或換班，請先點擊底部【調班換班】按鈕，或輸入「調班」選擇要調整的班次！🌸'
            }]
          });
          continue;
        }

        // ── 指令 I：志工核身與綁定 (姓名 組織 / 姓名 / 純電話) ──
        const parts = text.split(/[\s\t　,，、/+\-]+/).map(p => p.trim()).filter(Boolean);
        const nameInput = parts[0] || text;
        const orgInput = parts[1] || '';

        // 排除常見關鍵字或非人名
        const nonNameKeywords = ['取消', '沒有', '不用', '不是', '謝謝', '感恩', '你好', '哈囉', '早安', '午安', '晚安'];
        if (nonNameKeywords.includes(nameInput)) {
          await client.replyMessage({
            replyToken,
            messages: [{
              type: 'text',
              text: '阿彌陀佛！隨時點選下方功能選單即可使用小祕書各項服務。感恩您的護持！🌸'
            }]
          });
          continue;
        }

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
    } catch (eventErr) {
      console.error('Error handling LINE event:', eventErr);
      try {
        await client.replyMessage({
          replyToken,
          messages: [{
            type: 'text',
            text: '⚠️ 系統處理此請求時發生異常，請稍後再試，或輸入「功能說明」重新嘗試。'
          }]
        });
      } catch (replyErr) {
        console.error('Failed to reply error message:', replyErr);
      }
    }
  }

  return res.status(200).send('OK');
});



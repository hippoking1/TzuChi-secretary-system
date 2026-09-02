const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const line = require('@line/bot-sdk');
const { LINE_CHANNEL_ACCESS_TOKEN } = require('./secrets');
const { expireStaleSwaps, normalizeName, checkPersonMatch } = require('./shiftSwap');

const SHIFT_TIMES = {
  '東港聯絡處': { 'DG_F': '08:00~13:00', 'DG_M': '13:00~17:00' },
  '宜蘭園區': { 'YL_F': '08:00~16:00', 'YL_M1': '16:00~18:30', 'YL_M2': '18:30~20:30' }
};

/**
 * 取得明日台灣時間 (UTC+8) 日期字串 YYYY-MM-DD
 */
function getTomorrowTaiwanDateStr() {
  const now = new Date();
  const utc8 = new Date(now.getTime() + (8 * 60 + now.getTimezoneOffset()) * 60000);
  utc8.setDate(utc8.getDate() + 1);
  return utc8.toISOString().substring(0, 10);
}

/**
 * 核心：每日跨模組整合通知推播 (Message Aggregation 訊息合併)
 * 將「值班」、「活動」、「會議」於單一排程聚合，同一志工當天多項行程合併在單一則 Push Message 發送
 * @param {string} targetDateStr 目標日期 YYYY-MM-DD（預設為明日）
 * @param {string} token LINE Channel Access Token
 */
async function executeUnifiedDailyReminders(targetDateStr, token) {
  const db = admin.firestore();
  const dateStr = targetDateStr || getTomorrowTaiwanDateStr();

  const client = new line.messagingApi.MessagingApiClient({
    channelAccessToken: token || ''
  });

  // 1. 平行讀取：LINE 綁定名冊、志工名冊、明日值班、明日活動、明日會議
  const [
    bindingsSnap,
    membersSnap,
    dutiesSnap,
    eventsSnap,
    meetingsSnap
  ] = await Promise.all([
    db.collection('lineBindings').get(),
    db.collection('members').get(),
    db.collection('dutyShifts').where('dutyDate', '==', dateStr).get(),
    db.collection('events').where('eventDate', '==', dateStr).get(),
    db.collection('meetings').where('meetingDate', '==', dateStr).get()
  ]);

  // 建立 LINE 綁定查找索引
  const bindingsList = bindingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const membersList = membersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const memberMap = new Map();
  membersList.forEach(m => {
    if (m.id) memberMap.set(m.id, m);
  });

  /**
   * 健壯查找志工的 LINE 綁定資料
   */
  function findBinding(memberId, memberName, phone) {
    // 1. 精確 ID 匹配
    if (memberId) {
      const b = bindingsList.find(item => item.memberId === memberId);
      if (b && b.lineUserId) return b;
    }
    // 2. 電話號碼匹配
    const cleanPh = (phone || '').replace(/\D/g, '');
    if (cleanPh && cleanPh.length >= 8) {
      const b = bindingsList.find(item => {
        const bPh = (item.memberPhone || '').replace(/\D/g, '');
        return bPh && (bPh === cleanPh || bPh.endsWith(cleanPh) || cleanPh.endsWith(bPh));
      });
      if (b && b.lineUserId) return b;
    }
    // 3. 姓名 / 法號 / 異體字相容匹配
    if (memberName) {
      const b = bindingsList.find(item => {
        return checkPersonMatch(memberId, memberName, item.memberId, item.memberName, item.dharmaName);
      });
      if (b && b.lineUserId) return b;
    }
    return null;
  }

  // 2. 志工行程聚合結構：Map<lineUserId, { memberName, lineUserId, duties: [], events: [], meetings: [] }>
  const userAgendas = new Map();

  function getOrCreateAgenda(binding, fallbackName) {
    const lineUserId = binding.lineUserId;
    if (!userAgendas.has(lineUserId)) {
      userAgendas.set(lineUserId, {
        lineUserId,
        memberName: binding.memberName || fallbackName || '師兄/師姊',
        duties: [],
        events: [],
        meetings: []
      });
    }
    return userAgendas.get(lineUserId);
  }

  // (A) 收集明日【道場值班】
  dutiesSnap.docs.forEach(doc => {
    const duty = doc.data();
    if (!duty.memberName) return;

    const binding = findBinding(duty.memberId, duty.memberName, null);
    if (!binding || !binding.lineUserId) return;

    const shiftTime = duty.timeRange || (SHIFT_TIMES[duty.location] && SHIFT_TIMES[duty.location][duty.shiftId]) || '詳見排班表';
    const agenda = getOrCreateAgenda(binding, duty.memberName);
    agenda.duties.push({
      location: duty.location || '慈濟道場',
      shiftLabel: duty.shiftLabel || '值班服務',
      genderType: duty.genderType || '',
      timeRange: shiftTime
    });
  });

  // (B) 收集明日【志業活動】
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

      const binding = findBinding(memberId, name, phone);
      if (!binding || !binding.lineUserId) continue;

      const timeRange = `${event.eventStartTime || ''}${event.eventEndTime ? ' ~ ' + event.eventEndTime : ''}`.trim() || '全天活動';
      const agenda = getOrCreateAgenda(binding, name);
      agenda.events.push({
        title: event.title || '慈濟活動',
        category: event.category || '志業活動',
        timeRange,
        location: event.location || '慈濟園區',
        contact: event.contactName ? `${event.contactName} ${event.contactPhone || ''}`.trim() : '',
        regRef: regDoc.ref
      });
    }
  }

  // (C) 收集明日【組隊會議】
  for (const meetingDoc of meetingsSnap.docs) {
    const meeting = meetingDoc.data();
    const participantsSnap = await db.collection(`meetings/${meetingDoc.id}/participants`).get();

    for (const pDoc of participantsSnap.docs) {
      const p = pDoc.data();
      const binding = findBinding(p.memberId, p.memberName, null);
      if (!binding || !binding.lineUserId) continue;

      const timeRange = `${meeting.startTime || ''}${meeting.endTime ? ' ~ ' + meeting.endTime : ''}`.trim() || '依通知';
      const agenda = getOrCreateAgenda(binding, p.memberName);
      agenda.meetings.push({
        title: meeting.title || '組隊會議',
        timeRange,
        location: meeting.location || '指定會議室',
        description: meeting.description || '',
        participantRef: pDoc.ref
      });
    }
  }

  // 3. 組合合併訊息並推播發送 (Message Aggregation)
  let sentUserCount = 0;
  let aggregatedCount = 0;
  let singleCount = 0;
  let failCount = 0;
  const notifyDetails = [];

  for (const [lineUserId, agenda] of userAgendas.entries()) {
    const totalItems = agenda.duties.length + agenda.events.length + agenda.meetings.length;
    if (totalItems === 0) continue;

    let msgText = '';

    if (totalItems === 1) {
      // ── 單一項目提醒 ──
      singleCount++;
      if (agenda.duties.length === 1) {
        const d = agenda.duties[0];
        msgText = `【明日值班溫馨提醒】🌸\n${agenda.memberName} 師兄/師姊 阿彌陀佛！\n\n您明天 (${dateStr}) 於「${d.location}」有排定值班服務：\n• 時段班次：${d.shiftLabel} ${d.genderType ? '(' + d.genderType + '眾)' : ''}\n• 值班時間：${d.timeRange}\n\n感恩您的護持與付出！🙏`;
      } else if (agenda.events.length === 1) {
        const e = agenda.events[0];
        msgText = `【明日活動溫馨提醒】🌸\n${agenda.memberName} 菩薩/大德 阿彌陀佛！\n\n提醒您明天 (${dateStr}) 有報名參加慈濟活動：\n• 活動名稱：${e.title}\n• 活動分類：${e.category}\n• 活動時間：${e.timeRange}\n• 舉辦地點：${e.location}\n${e.contact ? '• 聯絡窗口：' + e.contact + '\n' : ''}\n誠摯期待您的蒞臨參與，感恩！🙏`;
      } else if (agenda.meetings.length === 1) {
        const m = agenda.meetings[0];
        msgText = `【明日會議溫馨提醒】🌸\n${agenda.memberName} 師兄/師姊 阿彌陀佛！\n\n您明天 (${dateStr}) 有排定出席以下會議，請撥冗準時出席：\n• 會議主題：${m.title}\n• 開會時間：${m.timeRange}\n• 開會地點：${m.location}\n${m.description ? '• 備註說明：' + m.description + '\n' : ''}\n感恩您的護持與付出！🙏`;
      }
    } else {
      // ── 多項行程合併提醒 (Message Aggregation 訊息合併) ──
      aggregatedCount++;
      let bodyLines = [];

      if (agenda.duties.length > 0) {
        bodyLines.push('📋【道場值班】');
        agenda.duties.forEach(d => {
          bodyLines.push(`• ${d.location}：${d.shiftLabel} (${d.timeRange})`);
        });
        bodyLines.push('');
      }

      if (agenda.events.length > 0) {
        bodyLines.push('🎉【志業活動】');
        agenda.events.forEach(e => {
          bodyLines.push(`• ${e.title} (${e.timeRange})`);
          bodyLines.push(`  地點：${e.location}`);
        });
        bodyLines.push('');
      }

      if (agenda.meetings.length > 0) {
        bodyLines.push('📅【組隊會議】');
        agenda.meetings.forEach(m => {
          bodyLines.push(`• ${m.title} (${m.timeRange})`);
          bodyLines.push(`  地點：${m.location}`);
        });
        bodyLines.push('');
      }

      msgText = `🌸【明日行程綜合提醒】\n${agenda.memberName} 師兄/師姊 阿彌陀佛！\n\n提醒您明天 (${dateStr}) 共有 ${totalItems} 項排定行程，請撥冗留意：\n\n${bodyLines.join('\n').trim()}\n\n感恩您的發心護持與付出，祝福法喜充滿、平安吉祥！🙏`;
    }

    try {
      await client.pushMessage({
        to: lineUserId,
        messages: [{ type: 'text', text: msgText }]
      });
      sentUserCount++;
      notifyDetails.push({
        name: agenda.memberName,
        itemsCount: totalItems,
        isAggregated: totalItems > 1,
        status: '成功'
      });

      // 4. 更新活動與會議之提醒狀態
      for (const e of agenda.events) {
        if (e.regRef) {
          await e.regRef.update({ reminderSentAt: admin.firestore.FieldValue.serverTimestamp() }).catch(() => {});
        }
      }
      for (const m of agenda.meetings) {
        if (m.participantRef) {
          await m.participantRef.update({
            remindedAt: admin.firestore.FieldValue.serverTimestamp(),
            remindStatus: '已推播'
          }).catch(() => {});
        }
      }
    } catch (pushErr) {
      console.error(`推播綜合提醒失敗 (${agenda.memberName}):`, pushErr);
      failCount++;
    }
  }

  return {
    success: true,
    targetDate: dateStr,
    totalUsersNotified: sentUserCount,
    aggregatedCount,
    singleCount,
    failCount,
    notifyDetails,
    message: `已成功完成 ${dateStr} 綜合提醒推播！共發送 ${sentUserCount} 則訊息（其中 ${aggregatedCount} 位為多項行程合併發送，${singleCount} 位為單一行程發送）`
  };
}

// ── 1. 每日 08:30 自動推播隔日【綜合行程提醒 (訊息合併排程)】 ──
exports.sendDailyUnifiedRemindersScheduled = onSchedule({
  schedule: 'every day 08:30',
  timeZone: 'Asia/Taipei',
  secrets: [LINE_CHANNEL_ACCESS_TOKEN]
}, async () => {
  const token = LINE_CHANNEL_ACCESS_TOKEN.value() || '';
  const result = await executeUnifiedDailyReminders(null, token);
  console.log('Daily Unified Reminders Result:', result);
});

// ── 2. Callable Function：提供後台手動一鍵即刻測試綜合行程推播 ──
exports.sendDailyUnifiedRemindersForDate = onCall({
  secrets: [LINE_CHANNEL_ACCESS_TOKEN],
  cors: true
}, async (request) => {
  const { dateStr } = request.data || {};
  const token = LINE_CHANNEL_ACCESS_TOKEN.value() || '';
  const result = await executeUnifiedDailyReminders(dateStr, token);
  return result;
});

// ── 3. 每日 20:30 自動掃描並標註逾期之【調班換班申請】 ──
exports.expireStaleSwapRequestsScheduled = onSchedule({
  schedule: 'every day 20:30',
  timeZone: 'Asia/Taipei',
  secrets: [LINE_CHANNEL_ACCESS_TOKEN]
}, async () => {
  const expiredList = await expireStaleSwaps();
  if (!expiredList || expiredList.length === 0) return;

  const client = new line.messagingApi.MessagingApiClient({
    channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN.value() || ''
  });

  for (const swap of expiredList) {
    const isTransfer = swap.swapType === 'transfer';
    const desc = isTransfer
      ? `【${swap.requesterDutyDate} ${swap.requesterShiftLabel}】代班申請`
      : `【${swap.requesterDutyDate} 與 ${swap.targetDutyDate}】換班申請`;

    if (swap.requesterLineUserId) {
      try {
        await client.pushMessage({
          to: swap.requesterLineUserId,
          messages: [{
            type: 'text',
            text: `⚠️【調班申請逾期失效】\n您向 ${swap.targetName} 發起的 ${desc}，因已超過確認截止期限 (${swap.deadlineStr || '前一日 20:00'}) 未獲回應，系統已自動將該申請作廢失效。若仍需調班請重新協調發起。`
          }]
        });
      } catch (err) {
        console.error('Failed to notify requester of expired swap:', err);
      }
    }

    if (swap.targetLineUserId) {
      try {
        await client.pushMessage({
          to: swap.targetLineUserId,
          messages: [{
            type: 'text',
            text: `⚠️【調班申請逾期失效】\n由 ${swap.requesterName} 向您發起的 ${desc} 已超過截止期限，該調班請求已自動失效。`
          }]
        });
      } catch (err) {
        console.error('Failed to notify target of expired swap:', err);
      }
    }
  }
});



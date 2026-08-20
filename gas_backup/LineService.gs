/**
 * LineService.gs
 * 慈濟活動管理系統 — LINE Bot 訊息推播與 Webhook 服務
 */

/**
 * 發送 LINE Push Message
 */
function pushMessage(toLineUserId, messages) {
  const config = getLineConfig();
  if (!config.CHANNEL_ACCESS_TOKEN) return { error: '未設定 LINE Channel Access Token' };

  const payload = {
    to: toLineUserId,
    messages: Array.isArray(messages) ? messages : [messages]
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + config.CHANNEL_ACCESS_TOKEN
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const res = UrlFetchApp.fetch(config.API_PUSH_URL, options);
    const code = res.getResponseCode();
    if (code === 200) {
      return { success: true };
    } else {
      return { error: 'LINE Push 失敗: ' + res.getContentText() };
    }
  } catch (e) {
    return { error: e.toString() };
  }
}

/**
 * 發送 LINE Reply Message
 */
function replyMessage(replyToken, messages) {
  const config = getLineConfig();
  if (!config.CHANNEL_ACCESS_TOKEN) return;

  const payload = {
    replyToken: replyToken,
    messages: Array.isArray(messages) ? messages : [messages]
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + config.CHANNEL_ACCESS_TOKEN
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    UrlFetchApp.fetch(config.API_REPLY_URL, options);
  } catch (e) {}
}

/**
 * 【會議推播】發送開會通知給應參與人員
 * 依據通知內容將會議主題、時間、地點發送至個人 LINE
 */
function sendMeetingNotification(token, meetingId) {
  const meeting = findById(SHEETS.MEETINGS, meetingId);
  if (!meeting) return { error: '找不到會議' };

  const participants = findWhere(SHEETS.MEETING_PARTICIPANTS, { meetingId: meetingId });
  if (participants.length === 0) return { error: '該會議尚無指定參與人員' };

  const lineUsers = readAll(SHEETS.LINE_USERS);
  let sentCount = 0;

  participants.forEach(p => {
    const binding = lineUsers.find(u =>
      String(u.memberId) === String(p.memberId) &&
      (u.isActive !== false && String(u.isActive).toUpperCase() !== 'FALSE')
    );

    if (binding && binding.lineUserId) {
      const sTime = formatShiftTimeOnly(meeting.startTime);
      const eTime = formatShiftTimeOnly(meeting.endTime);
      const mDate = String(meeting.meetingDate || '').substring(0, 10);

      const msgText = `📋【慈濟會議開會通知】\n\n` +
                      `🔹 會議主題：${meeting.title}\n` +
                      `📅 會議日期：${mDate}\n` +
                      `⏰ 會議時間：${sTime} ~ ${eTime}\n` +
                      `📍 會議地點：${meeting.location || '另行通知'}\n` +
                      `👤 召集人：${meeting.organizerName || '會議召集人'}\n\n` +
                      `請準時出席，感恩！`;

      const res = pushMessage(binding.lineUserId, { type: 'text', text: msgText });
      if (res.success) sentCount++;
    }
  });

  // 更新會議通知狀態
  updateById(SHEETS.MEETINGS, meetingId, {
    lineNotifyStatus: '已發送',
    updatedAt: new Date().toISOString()
  });

  logAction('SEND_MEETING_NOTIFY', 'meeting', meetingId, { sentCount: sentCount, total: participants.length });
  return { success: true, sentCount: sentCount, total: participants.length };
}

/**
 * 【個人值班提醒】提前一天發送值班提醒給應到班人員 (時間及地點)
 */
function sendDutyReminders() {
  const tomorrowDuties = getTomorrowDuties(); // 取得明日值班
  if (tomorrowDuties.length === 0) {
    Logger.log('明日無排班紀錄。');
    return;
  }

  const lineUsers = readAll(SHEETS.LINE_USERS);
  let sentCount = 0;

  tomorrowDuties.forEach(d => {
    const binding = lineUsers.find(u => String(u.memberId) === String(d.memberId) && (String(u.isActive) === 'true' || u.isActive === true));
    if (binding && binding.lineUserId) {
      const sStart = formatShiftTimeOnly(d.shiftStart);
      const sEnd = formatShiftTimeOnly(d.shiftEnd);
      const msgText = `🏛️【慈濟道場值班提醒】\n\n` +
                      `阿彌陀佛，${d.memberName} 師兄/師姊：\n` +
                      `提醒您明天有道場值班行程：\n\n` +
                      `📍 值班地點：${d.location}\n` +
                      `📅 值班日期：${String(d.dutyDate).substring(0, 10)}\n` +
                      `⏰ 值班時段：${d.shiftLabel} (${sStart} ~ ${sEnd})\n\n` +
                      `感恩您的護持與付出！`;

      const res = pushMessage(binding.lineUserId, { type: 'text', text: msgText });
      if (res.success) sentCount++;
    }
  });

  logAction('SEND_DUTY_REMINDERS', 'duty', 'daily', { sentCount: sentCount });
  Logger.log(`✅ 已完成發送 ${sentCount} 筆明日值班提醒。`);
}

/**
 * 設定每日自動定時觸發器 (每天早上 08:00 執行 sendDutyReminders)
 */
function setupDailyTriggers() {
  // 先清理舊觸發器
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'sendDutyReminders') {
      ScriptApp.deleteTrigger(t);
    }
  });

  // 建立新觸發器 (每天早上 8 點發送隔天值班提醒)
  ScriptApp.newTrigger('sendDutyReminders')
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();

  Logger.log('✅ 已設定每日早上 08:00 自動執行隔天值班提醒觸發器。');
}

/**
 * 【LINE Webhook 入口】
 */
function handleLineWebhook(postData) {
  if (!postData || !postData.events) return;

  postData.events.forEach(event => {
    if (event.type === 'follow') {
      handleFollowEvent(event);
    } else if (event.type === 'message' && event.message.type === 'text') {
      handleTextMessageEvent(event);
    }
  });
}

function handleFollowEvent(event) {
  const replyToken = event.replyToken;
  const welcomeText = `🪷 歡迎加入「慈濟活動管理系統」LINE 官方帳號！\n\n` +
                      `為符合個資保護規範，本系統採用「姓名 與 組織名稱」進行帳號綁定。\n` +
                      `請直接回覆您的「姓名 + 組織組別」（例如：張志工 第一協力 或 綁定 李靜觀 第一和氣）。`;
  replyMessage(replyToken, { type: 'text', text: welcomeText });
}

function handleTextMessageEvent(event) {
  const replyToken = event.replyToken;
  const lineUserId = event.source.userId;
  const userText = event.message.text.trim();

  // 1. 指令回覆選單
  if (userText === '選單' || userText === '幫助' || userText === '說明') {
    const menuText = `🪷【功能指令與綁定說明】\n\n` +
                      `1. 帳號綁定：輸入「姓名 組織組別」\n` +
                      `   (例如：張志工 第一協力)\n` +
                      `2. 輸入「我的值班」：查詢本月值班紀錄\n` +
                      `3. 輸入「我的會議」：查詢參加之會議`;
    replyMessage(replyToken, { type: 'text', text: menuText });
    return;
  }

  // 2. 處理綁定指令 (輸入 姓名 + 組織名稱)
  const bindRes = bindLineUserByNameAndOrg(lineUserId, userText);
  if (bindRes.handled) {
    if (bindRes.success) {
      replyMessage(replyToken, { type: 'text', text: `✅ 綁定成功！\n\n感恩 ${bindRes.memberName} 師兄/師姊 (${bindRes.orgPath})\n您將會在此收到個人會議開會通知與值班提醒。` });
    } else {
      replyMessage(replyToken, { type: 'text', text: `❌ 綁定失敗：${bindRes.error}` });
    }
    return;
  }

  // 3. 預設引導
  replyMessage(replyToken, { type: 'text', text: `阿彌陀佛！若要綁定個人通知，請輸入您的「姓名與組別」（例如: 張志工 第一協力）。輸入「選單」可查看說明。` });
}

/**
 * 依「姓名」與「組織架構」進行 LINE 帳號綁定 (保障個資法規範)
 */
function bindLineUserByNameAndOrg(lineUserId, inputText) {
  // 去除「綁定」等前綴關鍵字與多餘符號
  let cleanText = inputText.replace(/^綁定\s*/, '').trim();

  const members = readAll(SHEETS.MEMBERS).filter(m =>
    String(m.isActive) === 'true' || String(m.isActive) === 'TRUE' || m.isActive === true
  );

  // 在成員名單中比對，找出姓名有出現在輸入文字中的所有成員
  const matchedMembers = members.filter(m => {
    const nameStr = String(m.name).trim();
    return nameStr.length > 0 && cleanText.includes(nameStr);
  });

  if (matchedMembers.length === 0) {
    // 沒有匹配到姓名
    return { handled: false };
  }

  // 若有多位同名或匹配到姓名者，再根據輸入文字中的組織名稱進行過濾
  const matchedWithOrg = matchedMembers.filter(m => {
    const orgPath = getOrgPath(m.orgId);
    // 檢查 cleanText 中剩餘的字是否出現在組織路徑中
    const nameStr = String(m.name).trim();
    const remainingText = cleanText.replace(nameStr, '').trim();

    if (!remainingText) return true; // 如果沒填組織但名字唯一的場合

    // 檢查組織關鍵字是否匹配
    return orgPath.includes(remainingText) || remainingText.split(/\s+/).some(kw => orgPath.includes(kw));
  });

  if (matchedWithOrg.length === 1) {
    const member = matchedWithOrg[0];
    const orgPath = getOrgPath(member.orgId);

    // 寫入/更新綁定記錄
    const lineUsers = readAll(SHEETS.LINE_USERS);
    const existing = lineUsers.find(u => String(u.memberId) === String(member.id));
    const now = new Date().toISOString();

    if (existing) {
      updateById(SHEETS.LINE_USERS, existing.id, {
        lineUserId: lineUserId,
        memberName: member.name,
        orgPath: orgPath,
        bindingTime: now,
        isActive: true
      });
    } else {
      insertRow(SHEETS.LINE_USERS, {
        memberId: member.id,
        memberName: member.name,
        orgPath: orgPath,
        lineUserId: lineUserId,
        bindingTime: now,
        isActive: true
      });
    }

    logAction('BIND_LINE_USER', 'line_user', member.id, { name: member.name, orgPath: orgPath });
    return { handled: true, success: true, memberName: member.name, orgPath: orgPath };
  } else if (matchedWithOrg.length > 1) {
    return {
      handled: true,
      success: false,
      error: '查有多位同名志工，請提供更完整的組別名稱（例如：第一和氣 第一互愛 第一協力 張志工）。'
    };
  } else {
    return {
      handled: true,
      success: false,
      error: '查無符合此姓名與組別之志工資料，請確認姓名與組織名稱是否正確。'
    };
  }
}

/**
 * 後台取得 LINE 綁定列表 (包含組織資訊)
 */
function getLineBindings(token) {
  if (!isAdmin(token)) return [];
  const bindings = readAll(SHEETS.LINE_USERS);
  const members = readAll(SHEETS.MEMBERS);

  return bindings.map(b => {
    const member = members.find(m => String(m.id) === String(b.memberId));
    return {
      ...b,
      orgPath: b.orgPath || (member ? getOrgPath(member.orgId) : '未分組')
    };
  });
}

/**
 * 解除 LINE 綁定
 */
function unbindLineUser(token, bindingId) {
  if (!isAdmin(token)) return { error: '權限不足' };
  deleteById(SHEETS.LINE_USERS, bindingId);
  return { success: true };
}

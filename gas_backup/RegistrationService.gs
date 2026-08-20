/**
 * RegistrationService.gs
 * 慈濟活動報名系統 — 報名與簽到服務
 */

/**
 * 辨識成員身份 (前台姓名 + 電話末四碼)
 */
function identifyMember(name, phoneLast4) {
  if (!name || !phoneLast4) {
    return { status: 'invalid_input' };
  }

  const members = readAll(SHEETS.MEMBERS).filter(m =>
    String(m.isActive) === 'true' || String(m.isActive) === 'TRUE' || m.isActive === true
  );

  const matched = members.filter(m => {
    const matchName = String(m.name).trim() === String(name).trim();
    const phoneStr = String(m.phone).replace(/\D/g, '');
    const matchPhone = phoneStr.slice(-4) === String(phoneLast4).trim();
    return matchName && matchPhone;
  });

  if (matched.length === 1) {
    const m = matched[0];
    return {
      status: 'found',
      member: {
        ...m,
        orgPath: getOrgPath(m.orgId)
      }
    };
  } else if (matched.length > 1) {
    return {
      status: 'multiple',
      candidates: matched.map(m => ({
        id: m.id,
        name: m.name,
        orgPath: getOrgPath(m.orgId)
      }))
    };
  } else {
    return { status: 'not_found' };
  }
}

/**
 * 提交活動報名
 */
function registerForEvent(data) {
  const event = findById(SHEETS.EVENTS, data.eventId);
  if (!event) return { error: '活動不存在' };
  if (event.status !== '已發佈') return { error: '活動尚未開放報名' };

  const now = new Date();
  if (now < new Date(event.registrationStart)) return { error: '報名時間尚未開始' };
  if (now > new Date(event.registrationEnd)) return { error: '報名已經截止' };

  const existingRegs = findWhere(SHEETS.REGISTRATIONS, { eventId: data.eventId });

  if (data.memberId) {
    const dup = existingRegs.find(r =>
      String(r.memberId) === String(data.memberId) && r.status !== '已取消'
    );
    if (dup) return { error: '您已報名此活動，請勿重複報名' };
  } else if (data.guestPhone) {
    const dup = existingRegs.find(r =>
      String(r.guestPhone) === String(data.guestPhone) && r.status !== '已取消'
    );
    if (dup) return { error: '此電話已報名此活動' };
  }

  const pCount = Math.max(1, Number(data.participantCount) || 1);

  const confirmedCount = existingRegs
    .filter(r => r.status === '已確認' || r.status === '已簽到')
    .reduce((sum, r) => sum + (Number(r.participantCount) || 1), 0);

  const max = Number(event.maxParticipants) || 0;
  const isFull = max > 0 && (confirmedCount + pCount) > max;

  const regId = insertRow(SHEETS.REGISTRATIONS, {
    eventId: data.eventId,
    memberId: data.memberId || '',
    guestName: data.guestName || '',
    guestPhone: data.guestPhone || '',
    sessionId: data.sessionId || '',
    participantCount: pCount,
    status: isFull ? '候補中' : '已確認',
    mealType: data.mealType || '素食',
    specialNeeds: data.specialNeeds || '',
    note: data.note || '',
    registeredAt: new Date().toISOString(),
    cancelledAt: '',
    checkedInAt: ''
  });

  logAction('REGISTER', 'registration', regId, { status: isFull ? '候補中' : '已確認', pCount: pCount });

  return {
    success: true,
    status: isFull ? '候補中' : '已確認',
    message: isFull ? '該活動正取人數已滿，已為您登記為「候補」，若有缺額將自動遞補！' : '報名成功！感謝您的熱心參與。'
  };
}

/**
 * 查詢個人報名紀錄
 */
function getMyRegistrations(memberId, phoneLast4) {
  let regs = [];

  if (memberId) {
    regs = findWhere(SHEETS.REGISTRATIONS, { memberId: memberId });
  }

  const events = readAll(SHEETS.EVENTS);
  const sessions = readAll(SHEETS.SESSIONS);

  return regs.map(reg => {
    const event = events.find(e => String(e.id) === String(reg.eventId));
    const session = reg.sessionId ? sessions.find(s => String(s.id) === String(reg.sessionId)) : null;

    return {
      ...reg,
      participantCount: Number(reg.participantCount) || 1,
      eventTitle: event ? event.title : '未知活動',
      eventStart: event ? event.registrationStart : '',
      eventLocation: event ? event.location : '',
      sessionName: session ? session.sessionName : ''
    };
  }).sort((a, b) => new Date(b.registeredAt) - new Date(a.registeredAt));
}

/**
 * 取消報名
 */
function cancelRegistration(regId, memberId) {
  const reg = findById(SHEETS.REGISTRATIONS, regId);
  if (!reg) return { error: '找不到報名紀錄' };

  if (memberId && String(reg.memberId) !== String(memberId)) {
    return { error: '無權取消此報名' };
  }

  const wasConfirmed = reg.status === '已確認';

  updateById(SHEETS.REGISTRATIONS, regId, {
    status: '已取消',
    cancelledAt: new Date().toISOString()
  });

  // 自動遞補第一位候補者
  if (wasConfirmed) {
    const waitlisted = findWhere(SHEETS.REGISTRATIONS, {
      eventId: reg.eventId,
      status: '候補中'
    }).sort((a, b) => new Date(a.registeredAt) - new Date(b.registeredAt));

    if (waitlisted.length > 0) {
      updateById(SHEETS.REGISTRATIONS, waitlisted[0].id, {
        status: '已確認'
      });
    }
  }

  logAction('CANCEL_REG', 'registration', regId);
  return { success: true };
}

/**
 * 後台管理員修改報名狀態
 */
function updateRegistrationStatus(token, regId, newStatus) {
  if (!isAdmin(token)) return { error: '權限不足' };

  updateById(SHEETS.REGISTRATIONS, regId, {
    status: newStatus
  });

  logAction('UPDATE_REG_STATUS', 'registration', regId, { newStatus: newStatus });
  return { success: true };
}

/**
 * 現場簽到點名
 */
function checkInRegistration(token, regId) {
  if (!isAdmin(token)) return { error: '權限不足' };

  const now = new Date().toISOString();
  updateById(SHEETS.REGISTRATIONS, regId, {
    status: '已簽到',
    checkedInAt: now
  });

  insertRow(SHEETS.CHECKINS, {
    registrationId: regId,
    checkedInBy: getCurrentAdminId(),
    checkedInAt: now,
    method: '手動'
  });

  logAction('CHECK_IN', 'registration', regId);
  return { success: true };
}

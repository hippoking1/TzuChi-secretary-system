/**
 * ExportService.gs
 * 慈濟活動報名系統 — 資料匯出與統計報表服務
 */

/**
 * 取得特定活動之完整報名名單 (後台管理員使用)
 */
function getEventRegistrations(token, eventId) {
  if (!isAdmin(token)) return { error: '權限不足' };

  const regs = findWhere(SHEETS.REGISTRATIONS, { eventId: eventId });
  const members = readAll(SHEETS.MEMBERS);
  const sessions = findWhere(SHEETS.SESSIONS, { eventId: eventId });

  return regs.map(reg => {
    const member = reg.memberId ? members.find(m => String(m.id) === String(reg.memberId)) : null;
    const session = reg.sessionId ? sessions.find(s => String(s.id) === String(reg.sessionId)) : null;

    return {
      id: reg.id,
      name: member ? member.name : (reg.guestName || '訪客'),
      phone: member ? member.phone : (reg.guestPhone || ''),
      volunteerCode: member ? (member.volunteerCode || '') : '',
      orgPath: member ? getOrgPath(member.orgId) : '訪客',
      sessionName: session ? session.sessionName : '一般',
      participantCount: Number(reg.participantCount) || 1,
      mealType: reg.mealType || '素食',
      status: reg.status,
      specialNeeds: reg.specialNeeds || '',
      note: reg.note || '',
      registeredAt: formatDateTime(reg.registeredAt),
      checkedInAt: formatDateTime(reg.checkedInAt)
    };
  });
}

/**
 * 匯出 CSV 字串 (含 UTF-8 BOM 避免 Excel 開啟亂碼)
 */
function exportRegistrationsCsv(token, eventId) {
  if (!isAdmin(token)) return { error: '權限不足' };

  const event = findById(SHEETS.EVENTS, eventId);
  if (!event) return { error: '活動不存在' };

  const dataList = getEventRegistrations(token, eventId);

  const BOM = '\uFEFF';
  const header = '序號,姓名,電話,委員/慈誠編號,組織架構,報名人數,場次,餐食,狀態,特殊需求,報名時間,簽到時間,備註\n';

  const rows = dataList.map((item, idx) => {
    return [
      idx + 1,
      item.name,
      item.phone,
      item.volunteerCode,
      item.orgPath,
      item.participantCount,
      item.sessionName,
      item.mealType,
      item.status,
      item.specialNeeds,
      item.registeredAt,
      item.checkedInAt,
      item.note
    ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(',');
  }).join('\n');

  return {
    csv: BOM + header + rows,
    filename: `${event.title}_報名名單.csv`
  };
}

/**
 * 匯出會議參與名單 CSV (含 UTF-8 BOM)
 */
function exportMeetingParticipantsCsv(token, meetingId) {
  if (!isAdmin(token)) return { error: '權限不足' };

  const meeting = findById(SHEETS.MEETINGS, meetingId);
  if (!meeting) return { error: '會議不存在' };

  const participants = findWhere(SHEETS.MEETING_PARTICIPANTS, { meetingId: meetingId });

  const BOM = '\uFEFF';
  const header = '序號,會議主題,會議日期,成員姓名,電話,出席狀態,備註\n';

  const rows = participants.map((item, idx) => {
    return [
      idx + 1,
      meeting.title,
      meeting.meetingDate,
      item.memberName,
      item.memberPhone,
      item.attendance || '未回覆',
      item.note || ''
    ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(',');
  }).join('\n');

  return {
    csv: BOM + header + rows,
    filename: `${meeting.title}_參與名單.csv`
  };
}

/**
 * 匯出月度值班排程 CSV (含 UTF-8 BOM)
 */
function exportDutyScheduleCsv(token, location, year, month) {
  if (!isAdmin(token)) return { error: '權限不足' };

  const monthStr = month < 10 ? '0' + parseInt(month) : String(month);
  const prefix = `${year}-${monthStr}`;

  const allDuties = readAll(SHEETS.DUTY_SCHEDULE);
  const duties = allDuties.filter(d =>
    String(d.location) === String(location) &&
    String(d.dutyDate).startsWith(prefix)
  );

  const BOM = '\uFEFF';
  const header = '序號,場地,值班日期,班次名稱,開始時間,結束時間,眾別,值班志工\n';

  const rows = duties.map((item, idx) => {
    return [
      idx + 1,
      item.location,
      item.dutyDate,
      item.shiftLabel,
      item.shiftStart,
      item.shiftEnd,
      item.genderType,
      item.memberName
    ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(',');
  }).join('\n');

  return {
    csv: BOM + header + rows,
    filename: `${location}_${year}年${month}月_值班表.csv`
  };
}

/**
 * 取得管理員儀表板統計指標
 */
function getAdminDashboardStats(token) {
  if (!isAdmin(token)) return { error: '權限不足' };

  const events = readAll(SHEETS.EVENTS);
  const regs = readAll(SHEETS.REGISTRATIONS);
  const members = readAll(SHEETS.MEMBERS);
  const meetings = readAll(SHEETS.MEETINGS);
  const duties = readAll(SHEETS.DUTY_SCHEDULE);
  const lineUsers = readAll(SHEETS.LINE_USERS);

  const todayStr = new Date().toISOString().substring(0, 10);

  const activeEvents = events.filter(e => e.status === '已發佈').length;
  const totalRegs = regs.filter(r => r.status === '已確認' || r.status === '已簽到')
    .reduce((sum, r) => sum + (Number(r.participantCount) || 1), 0);
  const attendedRegs = regs.filter(r => r.status === '已簽到')
    .reduce((sum, r) => sum + (Number(r.participantCount) || 1), 0);
  const attendanceRate = totalRegs > 0 ? Math.round((attendedRegs / totalRegs) * 100) : 0;

  const totalMeetings = meetings.length;
  const todayDuties = duties.filter(d => String(d.dutyDate) === todayStr).length;
  const lineBindingCount = lineUsers.filter(u => String(u.isActive) === 'true' || u.isActive === true).length;

  const recentRegs = regs.slice(-10).reverse().map(r => {
    const event = events.find(e => String(e.id) === String(r.eventId));
    const member = r.memberId ? members.find(m => String(m.id) === String(r.memberId)) : null;
    return {
      id: r.id,
      name: member ? member.name : (r.guestName || '訪客'),
      eventTitle: event ? event.title : '活動',
      orgPath: member ? getOrgPath(member.orgId) : '訪客',
      participantCount: Number(r.participantCount) || 1,
      status: r.status,
      time: formatDateTime(r.registeredAt)
    };
  });

  return {
    activeEvents: activeEvents,
    totalRegs: totalRegs,
    totalMembers: members.length,
    attendanceRate: attendanceRate,
    totalMeetings: totalMeetings,
    todayDuties: todayDuties,
    lineBindingCount: lineBindingCount,
    recentRegs: recentRegs
  };
}

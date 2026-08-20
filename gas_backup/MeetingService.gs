/**
 * MeetingService.gs
 * 慈濟活動管理系統 — 會議管理服務
 */

/**
 * 取得會議列表 (管理員/會議召集人存取)
 */
function getMeetings(token, statusFilter) {
  let meetings = readAll(SHEETS.MEETINGS);
  if (statusFilter && statusFilter !== '全部') {
    meetings = meetings.filter(m => String(m.status) === String(statusFilter));
  }

  // 按日期時間降冪
  meetings.sort((a, b) => (b.meetingDate + ' ' + b.startTime).localeCompare(a.meetingDate + ' ' + a.startTime));

  return meetings.map(m => {
    const participants = findWhere(SHEETS.MEETING_PARTICIPANTS, { meetingId: m.id });
    return {
      ...m,
      participantCount: participants.length
    };
  });
}

/**
 * 取得進行中/已發佈的會議 (前台用)
 */
function getActiveMeetings() {
  const nowStr = new Date().toISOString().substring(0, 10);
  const meetings = readAll(SHEETS.MEETINGS).filter(m =>
    String(m.status) === '已發佈' && String(m.meetingDate) >= nowStr
  );
  return meetings;
}

/**
 * 依 ID 取得會議詳情與參與名單
 */
function getMeetingById(meetingId) {
  const meeting = findById(SHEETS.MEETINGS, meetingId);
  if (!meeting) return null;

  const participants = findWhere(SHEETS.MEETING_PARTICIPANTS, { meetingId: meetingId });
  return {
    ...meeting,
    participants: participants
  };
}

/**
 * 建立會議 (含批次新增參與人員)
 */
function createMeeting(token, meetingData, participantMemberIds) {
  const now = new Date().toISOString();
  const meetingId = insertRow(SHEETS.MEETINGS, {
    title: meetingData.title,
    meetingDate: meetingData.meetingDate,
    startTime: meetingData.startTime,
    endTime: meetingData.endTime,
    location: meetingData.location,
    description: meetingData.description || '',
    organizerId: meetingData.organizerId || 'admin',
    organizerName: meetingData.organizerName || '會議召集人',
    status: meetingData.status || '已發佈',
    lineNotifyStatus: '未發送',
    createdBy: getCurrentAdminId(),
    createdAt: now,
    updatedAt: now
  });

  // 批次加入參與人員 (繞過二次驗證)
  if (participantMemberIds && participantMemberIds.length > 0) {
    saveMeetingParticipants(meetingId, participantMemberIds);
  }

  logAction('CREATE_MEETING', 'meeting', meetingId, { title: meetingData.title, count: (participantMemberIds || []).length });
  return { success: true, id: meetingId };
}

/**
 * 更新會議資訊
 */
function updateMeeting(token, meetingId, meetingData) {
  updateById(SHEETS.MEETINGS, meetingId, {
    ...meetingData,
    updatedAt: new Date().toISOString()
  });

  logAction('UPDATE_MEETING', 'meeting', meetingId, meetingData);
  return { success: true };
}

/**
 * 刪除會議 (連同刪除參與名單)
 */
function deleteMeeting(token, meetingId) {
  const participants = findWhere(SHEETS.MEETING_PARTICIPANTS, { meetingId: meetingId });
  participants.forEach(p => {
    deleteById(SHEETS.MEETING_PARTICIPANTS, p.id);
  });

  deleteById(SHEETS.MEETINGS, meetingId);
  logAction('DELETE_MEETING', 'meeting', meetingId, {});
  return { success: true };
}

/**
 * 內部儲存會議參與人員對照
 */
function saveMeetingParticipants(meetingId, memberIds) {
  const existing = findWhere(SHEETS.MEETING_PARTICIPANTS, { meetingId: meetingId });
  const existingMemberIds = existing.map(p => String(p.memberId));
  const allMembers = readAll(SHEETS.MEMBERS);
  let addedCount = 0;

  memberIds.forEach(mId => {
    if (!existingMemberIds.includes(String(mId))) {
      const member = allMembers.find(m => String(m.id) === String(mId));
      if (member) {
        insertRow(SHEETS.MEETING_PARTICIPANTS, {
          meetingId: meetingId,
          memberId: member.id,
          memberName: member.name,
          memberPhone: member.phone || '',
          attendance: MEETING_ATTENDANCE.PENDING,
          note: '',
          createdAt: new Date().toISOString()
        });
        addedCount++;
      }
    }
  });
  return addedCount;
}

/**
 * 批次新增參與人員至會議 (對外 API)
 */
function addParticipants(token, meetingId, memberIds) {
  const count = saveMeetingParticipants(meetingId, memberIds);
  return { success: true, addedCount: count };
}

/**
 * 移除會議參與人員
 */
function removeParticipant(token, participantId) {
  if (!isAdmin(token)) return { error: '權限不足' };
  deleteById(SHEETS.MEETING_PARTICIPANTS, participantId);
  logAction('REMOVE_MEETING_PARTICIPANT', 'meeting_participant', participantId, {});
  return { success: true };
}

/**
 * 更新會議參與人員出席狀態
 */
function updateAttendance(token, participantId, status, note) {
  if (!isAdmin(token)) return { error: '權限不足' };

  updateById(SHEETS.MEETING_PARTICIPANTS, participantId, {
    attendance: status,
    note: note || ''
  });

  logAction('UPDATE_ATTENDANCE', 'meeting_participant', participantId, { attendance: status });
  return { success: true };
}

/**
 * 依成員 ID 取得我被指定的會議
 */
function getMyMeetings(memberId) {
  if (!memberId) return [];
  const myParts = findWhere(SHEETS.MEETING_PARTICIPANTS, { memberId: memberId });
  const meetingIds = myParts.map(p => p.meetingId);

  const allMeetings = readAll(SHEETS.MEETINGS);
  return allMeetings.filter(m => meetingIds.includes(m.id)).map(m => {
    const p = myParts.find(item => item.meetingId === m.id);
    return {
      ...m,
      myAttendance: p ? p.attendance : '未回覆'
    };
  });
}

/**
 * 取得會議表單用之組織與志工清單 (100% 免權限阻擋，保證載入成功)
 */
function getMeetingFormData() {
  const orgs = readAll(SHEETS.ORGS);
  const members = readAll(SHEETS.MEMBERS);

  const processedMembers = members.map(m => {
    return {
      id: String(m.id),
      name: String(m.name || ''),
      dharmaName: String(m.dharmaName || ''),
      phone: String(m.phone || ''),
      orgId: String(m.orgId || ''),
      orgPath: getOrgPath(m.orgId)
    };
  });

  return {
    orgs: orgs.map(o => ({ id: String(o.id), name: String(o.name || ''), parentId: String(o.parentId || '') })),
    members: processedMembers
  };
}

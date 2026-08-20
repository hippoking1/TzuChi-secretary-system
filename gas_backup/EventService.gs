/**
 * EventService.gs
 * 慈濟活動報名系統 — 活動 CRUD 服務
 */

/**
 * 取得前台已發佈且未過期之活動列表
 */
function getPublishedEvents(category) {
  const now = new Date();
  let events = readAll(SHEETS.EVENTS).filter(e =>
    e.status === '已發佈' && new Date(e.registrationEnd) >= now
  );

  if (category && category !== '全部') {
    events = events.filter(e => e.category === category);
  }

  const regs = readAll(SHEETS.REGISTRATIONS);
  events = events.map(event => {
    const confirmedCount = regs.filter(r =>
      String(r.eventId) === String(event.id) && (r.status === '已確認' || r.status === '已簽到')
    ).length;
    return { ...event, confirmedCount: confirmedCount };
  });

  events.sort((a, b) => new Date(a.registrationEnd) - new Date(b.registrationEnd));
  return events;
}

/**
 * 取得所有活動 (後台使用)
 */
function getAllEvents(token, statusFilter) {
  if (!isAdmin(token)) return { error: '權限不足' };

  let events = readAll(SHEETS.EVENTS);
  if (statusFilter && statusFilter !== '全部') {
    events = events.filter(e => e.status === statusFilter);
  }

  const regs = readAll(SHEETS.REGISTRATIONS);
  return events.map(event => {
    const confirmedCount = regs.filter(r =>
      String(r.eventId) === String(event.id) && (r.status === '已確認' || r.status === '已簽到')
    ).length;
    const waitlistedCount = regs.filter(r =>
      String(r.eventId) === String(event.id) && r.status === '候補中'
    ).length;

    return {
      ...event,
      confirmedCount: confirmedCount,
      waitlistedCount: waitlistedCount
    };
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * 取得單一活動詳情 (含場次明細與報名狀況)
 */
function getEventDetail(eventId) {
  const event = findById(SHEETS.EVENTS, eventId);
  if (!event) return null;

  const sessions = findWhere(SHEETS.SESSIONS, { eventId: eventId });
  const regs = findWhere(SHEETS.REGISTRATIONS, { eventId: eventId });

  const confirmedCount = regs.filter(r => r.status === '已確認' || r.status === '已簽到').length;
  const max = Number(event.maxParticipants) || 0;

  return {
    ...event,
    sessions: sessions,
    confirmedCount: confirmedCount,
    isFull: max > 0 && confirmedCount >= max
  };
}

/**
 * 建立新活動 (後台)
 */
function createEvent(token, eventData, sessionsData) {
  if (!isAdmin(token)) return { error: '權限不足' };

  try { autoFixHeaders(); } catch(e) {}

  const eventId = insertRow(SHEETS.EVENTS, {
    ...eventData,
    status: eventData.status || '草稿',
    createdBy: getCurrentAdminId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  if (sessionsData && sessionsData.length > 0) {
    sessionsData.forEach(s => {
      insertRow(SHEETS.SESSIONS, {
        ...s,
        eventId: eventId
      });
    });
  }

  logAction('CREATE_EVENT', 'event', eventId, eventData);
  return { success: true, eventId: eventId };
}

/**
 * 更新活動
 */
function updateEvent(token, eventId, eventData, sessionsData) {
  if (!isAdmin(token)) return { error: '權限不足' };

  try { autoFixHeaders(); } catch(e) {}

  updateById(SHEETS.EVENTS, eventId, {
    ...eventData,
    updatedAt: new Date().toISOString()
  });

  if (sessionsData) {
    // 刪除舊場次
    const oldSessions = findWhere(SHEETS.SESSIONS, { eventId: eventId });
    oldSessions.forEach(s => deleteById(SHEETS.SESSIONS, s.id));
    // 新增新場次
    sessionsData.forEach(s => {
      insertRow(SHEETS.SESSIONS, {
        ...s,
        eventId: eventId
      });
    });
  }

  logAction('UPDATE_EVENT', 'event', eventId, eventData);
  return { success: true };
}

/**
 * 複製活動
 */
function duplicateEvent(token, eventId) {
  if (!isAdmin(token)) return { error: '權限不足' };

  const event = findById(SHEETS.EVENTS, eventId);
  if (!event) return { error: '活動不存在' };

  const sessions = findWhere(SHEETS.SESSIONS, { eventId: eventId });

  const newEvent = { ...event };
  delete newEvent.id;
  newEvent.title = event.title + ' (複製)';
  newEvent.status = '草稿';
  newEvent.createdAt = new Date().toISOString();
  newEvent.updatedAt = new Date().toISOString();

  const newEventId = insertRow(SHEETS.EVENTS, newEvent);

  sessions.forEach(s => {
    const newSession = { ...s };
    delete newSession.id;
    newSession.eventId = newEventId;
    insertRow(SHEETS.SESSIONS, newSession);
  });

  logAction('DUPLICATE_EVENT', 'event', newEventId, { sourceId: eventId });
  return { success: true, eventId: newEventId };
}

/**
 * 刪除活動 (連同刪除場次與報名紀錄)
 */
function deleteEvent(token, eventId) {
  if (!isAdmin(token)) return { error: '權限不足' };

  // 1. 刪除該活動場次
  const sessions = findWhere(SHEETS.SESSIONS, { eventId: eventId });
  sessions.forEach(s => deleteById(SHEETS.SESSIONS, s.id));

  // 2. 刪除該活動報名紀錄
  const regs = findWhere(SHEETS.REGISTRATIONS, { eventId: eventId });
  regs.forEach(r => deleteById(SHEETS.REGISTRATIONS, r.id));

  // 3. 刪除活動主體
  deleteById(SHEETS.EVENTS, eventId);

  logAction('DELETE_EVENT', 'event', eventId, {});
  return { success: true };
}

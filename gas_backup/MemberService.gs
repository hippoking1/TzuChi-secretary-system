/**
 * MemberService.gs
 * 慈濟活動報名系統 — 成員管理服務 (預建人員名單與比對)
 */

/**
 * 取得成員列表 (含組織過濾與搜尋，支援前台報名選單存取)
 */
function getMembers(token, filters) {
  const isUserAdmin = isAdmin(token);

  let members = readAll(SHEETS.MEMBERS).filter(m =>
    m.isActive !== false && String(m.isActive).toUpperCase() !== 'FALSE'
  );

  if (filters && filters.orgId) {
    const orgIds = getDescendantOrgIds(filters.orgId);
    orgIds.push(filters.orgId);
    members = members.filter(m => orgIds.includes(String(m.orgId)));
  }

  if (filters && filters.search) {
    const q = filters.search.toLowerCase();
    members = members.filter(m =>
      String(m.name).toLowerCase().includes(q) ||
      String(m.volunteerCode || '').toLowerCase().includes(q) ||
      String(m.phone || '').includes(q) ||
      String(m.dharmaName || '').toLowerCase().includes(q)
    );
  }

  return members.map(m => {
    const phoneStr = String(m.phone || '');
    return {
      id: m.id,
      name: m.name,
      phone: isUserAdmin ? phoneStr : (phoneStr.length >= 4 ? '***' + phoneStr.slice(-4) : phoneStr),
      volunteerCode: m.volunteerCode || '',
      dharmaName: m.dharmaName || '',
      gender: m.gender || '',
      orgId: m.orgId,
      orgPath: getOrgPath(m.orgId),
      role: m.role || 'member'
    };
  });
}

/**
 * 依性別取得啟用中之成員列表 (值班排班用)
 */
function getMembersByGender(token, gender) {
  let members = readAll(SHEETS.MEMBERS).filter(m =>
    (m.isActive !== false && String(m.isActive).toUpperCase() !== 'FALSE') &&
    (!gender || String(m.gender) === String(gender))
  );

  return members.map(m => {
    return {
      id: m.id,
      name: m.name,
      phone: m.phone || '',
      volunteerCode: m.volunteerCode || '',
      dharmaName: m.dharmaName || '',
      gender: m.gender || '',
      orgId: m.orgId,
      orgPath: getOrgPath(m.orgId)
    };
  });
}

/**
 * 新增成員
 */
function createMember(token, memberData) {
  if (!isAdmin(token)) return { error: '權限不足' };

  const id = insertRow(SHEETS.MEMBERS, {
    ...memberData,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  logAction('CREATE_MEMBER', 'member', id, memberData);
  return { success: true, id: id };
}

/**
 * 更新成員資料
 */
function updateMember(token, id, updates) {
  if (!isAdmin(token)) return { error: '權限不足' };

  updateById(SHEETS.MEMBERS, id, {
    ...updates,
    updatedAt: new Date().toISOString()
  });

  logAction('UPDATE_MEMBER', 'member', id, updates);
  return { success: true };
}

/**
 * 批次匯入成員 (二維 JSON 陣列)
 */
function batchImportMembers(token, rows) {
  if (!isAdmin(token)) return { error: '權限不足' };

  let successCount = 0;
  const errorRows = [];

  rows.forEach((row, idx) => {
    try {
      if (!row.name) {
        errorRows.push({ row: idx + 1, reason: '缺少姓名' });
        return;
      }
      insertRow(SHEETS.MEMBERS, {
        name: row.name,
        phone: row.phone ? String(row.phone) : '',
        email: row.email || '',
        volunteerCode: row.volunteerCode || '',
        orgId: row.orgId || '',
        dharmaName: row.dharmaName || '',
        gender: row.gender || '',
        role: row.role || 'member',
        isActive: true,
        note: row.note || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      successCount++;
    } catch (e) {
      errorRows.push({ row: idx + 1, reason: e.toString() });
    }
  });

  logAction('BATCH_IMPORT_MEMBERS', 'member', 'batch', { count: successCount });
  return { successCount: successCount, errorRows: errorRows };
}

/**
 * DutyService.gs
 * 慈濟活動管理系統 — 道場值班排程服務
 */

/**
 * 取得指定場地與年月份的值班排程 (後台用)
 */
function getDutySchedule(token, location, year, month) {
  if (!isAdmin(token)) return { error: '權限不足' };

  const monthStr = month < 10 ? '0' + parseInt(month) : String(month);
  const prefix = `${year}-${monthStr}`;

  const allDuties = readAll(SHEETS.DUTY_SCHEDULE);
  const filtered = allDuties.filter(d =>
    String(d.location) === String(location) &&
    String(d.dutyDate).substring(0, 7) === prefix
  );

  return filtered;
}

/**
 * 建立單筆值班排程
 */
function createDutyShift(token, dutyData) {
  if (!isAdmin(token)) return { error: '權限不足' };

  // 驗證人數上限
  const shiftsConfig = DUTY_SHIFTS[dutyData.location] || [];
  const shiftConf = shiftsConfig.find(s => s.id === dutyData.shiftId);
  
  if (shiftConf) {
    const existing = findWhere(SHEETS.DUTY_SCHEDULE, {
      location: dutyData.location,
      dutyDate: dutyData.dutyDate,
      shiftId: dutyData.shiftId
    });
    if (existing.length >= shiftConf.quota) {
      return { error: `該班次人數限制為 ${shiftConf.quota} 人，已達名額上限` };
    }
  }

  const now = new Date().toISOString();
  const id = insertRow(SHEETS.DUTY_SCHEDULE, {
    location: dutyData.location,
    dutyDate: dutyData.dutyDate,
    shiftId: dutyData.shiftId,
    shiftLabel: dutyData.shiftLabel || (shiftConf ? shiftConf.label : ''),
    shiftStart: dutyData.shiftStart || (shiftConf ? shiftConf.start : ''),
    shiftEnd: dutyData.shiftEnd || (shiftConf ? shiftConf.end : ''),
    genderType: dutyData.genderType || (shiftConf ? shiftConf.gender : ''),
    memberId: dutyData.memberId,
    memberName: dutyData.memberName,
    status: '已排班',
    createdBy: getCurrentAdminId(),
    createdAt: now,
    updatedAt: now
  });

  logAction('CREATE_DUTY_SHIFT', 'duty', id, dutyData);
  return { success: true, id: id };
}

/**
 * 批次建立/取代值班排程 (以月份為單位)
 */
function batchSaveDutyShifts(token, location, year, month, dutyList) {
  if (!isAdmin(token)) return { error: '權限不足' };

  const monthStr = month < 10 ? '0' + parseInt(month) : String(month);
  const prefix = `${year}-${monthStr}`;

  // 1. 刪除該場地與月份原有的值班紀錄
  const allDuties = readAll(SHEETS.DUTY_SCHEDULE);
  const oldDuties = allDuties.filter(d =>
    String(d.location) === String(location) &&
    String(d.dutyDate).substring(0, 7) === prefix
  );

  oldDuties.forEach(d => {
    deleteById(SHEETS.DUTY_SCHEDULE, d.id);
  });

  // 2. 寫入新值班記錄
  const now = new Date().toISOString();
  let count = 0;

  dutyList.forEach(item => {
    insertRow(SHEETS.DUTY_SCHEDULE, {
      location: location,
      dutyDate: item.dutyDate,
      shiftId: item.shiftId,
      shiftLabel: item.shiftLabel,
      shiftStart: item.shiftStart,
      shiftEnd: item.shiftEnd,
      genderType: item.genderType,
      memberId: item.memberId,
      memberName: item.memberName,
      status: '已排班',
      createdBy: getCurrentAdminId(),
      createdAt: now,
      updatedAt: now
    });
    count++;
  });

  logAction('BATCH_SAVE_DUTY_SHIFTS', 'duty', `${location}_${year}_${month}`, { count: count });
  return { success: true, count: count };
}

/**
 * 刪除單筆值班
 */
function deleteDutyShift(token, dutyId) {
  if (!isAdmin(token)) return { error: '權限不足' };
  deleteById(SHEETS.DUTY_SCHEDULE, dutyId);
  logAction('DELETE_DUTY_SHIFT', 'duty', dutyId, {});
  return { success: true };
}

/**
 * 產生月份排班基礎模板 (依場地規則展開每天所需時段)
 */
function generateMonthlyTemplate(location, year, month) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const shiftsConfig = DUTY_SHIFTS[location] || [];
  const monthStr = month < 10 ? '0' + parseInt(month) : String(month);

  const template = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const dayStr = day < 10 ? '0' + day : String(day);
    const dateStr = `${year}-${monthStr}-${dayStr}`;

    shiftsConfig.forEach(shift => {
      template.push({
        dutyDate: dateStr,
        shiftId: shift.id,
        shiftLabel: shift.label,
        shiftStart: shift.start,
        shiftEnd: shift.end,
        genderType: shift.gender,
        quota: shift.quota
      });
    });
  }

  return template;
}

/**
 * 【前台多層下拉選單值班搜尋】
 * 下拉順序：和氣 -> 互愛 -> 協力 -> 志工姓名 -> 年月 -> 顯示該志工的值班列表
 */
function searchDutyByMemberAndMonth(memberId, yearMonth) {
  if (!memberId || !yearMonth) return [];

  const allDuties = readAll(SHEETS.DUTY_SCHEDULE);
  const filtered = allDuties.filter(d =>
    String(d.memberId) === String(memberId) &&
    String(d.dutyDate).substring(0, 7) === yearMonth
  );

  // 按日期降冪
  filtered.sort((a, b) => (String(a.dutyDate) + String(a.shiftStart)).localeCompare(String(b.dutyDate) + String(b.shiftStart)));

  return filtered.map(d => {
    const sStart = formatShiftTimeOnly(d.shiftStart);
    const sEnd = formatShiftTimeOnly(d.shiftEnd);
    return {
      id: d.id,
      location: d.location,
      dutyDate: String(d.dutyDate).substring(0, 10),
      shiftLabel: d.shiftLabel,
      shiftTime: (sStart && sEnd) ? `${sStart} ~ ${sEnd}` : (sStart || sEnd || '-'),
      genderType: d.genderType,
      memberName: d.memberName
    };
  });
}

/**
 * 取得明天所有道場值班記錄 (供 LINE 定時提醒觸發器使用)
 */
function getTomorrowDuties() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = Utilities.formatDate(tomorrow, 'Asia/Taipei', 'yyyy-MM-dd');

  const allDuties = readAll(SHEETS.DUTY_SCHEDULE);
  return allDuties.filter(d => String(d.dutyDate).substring(0, 10) === dateStr);
}

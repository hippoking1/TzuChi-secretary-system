const admin = require('firebase-admin');

const SHIFT_TIMES = {
  '東港聯絡處': { 'DG_F': '08:00~13:00', 'DG_M': '13:00~17:00' },
  '宜蘭園區': { 'YL_F': '08:00~16:00', 'YL_M1': '16:00~18:30', 'YL_M2': '18:30~20:30' }
};

/**
 * 計算班次截止期限（值班日前一天台灣時間 20:00，即 UTC 12:00）
 * @param {string} dutyDateStr - "YYYY-MM-DD"
 * @returns {{ deadline: Date, deadlineStr: string, prevDateStr: string }}
 */
function getDeadlineInfo(dutyDateStr) {
  const [year, month, day] = dutyDateStr.split('-').map(Number);
  const targetUtc = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  // 減去 1 天
  targetUtc.setUTCDate(targetUtc.getUTCDate() - 1);
  // 設定為 UTC 12:00（台灣時間 UTC+8 即 20:00）
  targetUtc.setUTCHours(12, 0, 0, 0);

  const prevYear = targetUtc.getUTCFullYear();
  const prevMonth = String(targetUtc.getUTCMonth() + 1).padStart(2, '0');
  const prevDay = String(targetUtc.getUTCDate()).padStart(2, '0');
  const prevDateStr = `${prevYear}-${prevMonth}-${prevDay}`;
  const deadlineStr = `${prevDateStr} 20:00`;

  return {
    deadline: targetUtc,
    deadlineStr,
    prevDateStr
  };
}

/**
 * 取得台灣目前時間字串 YYYY-MM-DD
 */
function getTaiwanTodayStr() {
  const now = new Date();
  const twTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return twTime.toISOString().substring(0, 10);
}

/**
 * 健壯取得 LINE 綁定資料
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
 * 1. 發起【單向轉班】申請
 */
async function createTransferRequest(requesterUserId, dutyId, targetNameInput, targetOrgInput = '') {
  const db = admin.firestore();

  // (1) 檢查發起者 LINE 綁定
  const requesterBinding = await getBindingByUserId(db, requesterUserId);
  if (!requesterBinding) {
    return { success: false, message: '您尚未綁定志工身分，請先輸入「姓名 組織」進行綁定。' };
  }

  // (2) 檢查班次席位
  const dutySnap = await db.collection('dutyShifts').doc(dutyId).get();
  if (!dutySnap.exists) {
    return { success: false, message: '找不到該值班席位資料。' };
  }
  const duty = dutySnap.data();

  // 驗證是否為自己的班
  const isMine = (duty.memberId && duty.memberId === requesterBinding.memberId) ||
                 (duty.memberName && duty.memberName === requesterBinding.memberName);
  if (!isMine) {
    return { success: false, message: `您並非【${duty.dutyDate} ${duty.location} ${duty.shiftLabel}】的排班志工。` };
  }

  // (3) 檢查調班期限（值班日前一天 20:00 前）
  const { deadline, deadlineStr } = getDeadlineInfo(duty.dutyDate);
  const now = new Date();
  if (now.getTime() >= deadline.getTime()) {
    return {
      success: false,
      message: `❌ 已超過此班次之調班期限！\n規定需於值班日前一天 20:00 前完成（期限為 ${deadlineStr}）。`
    };
  }

  // (4) 查詢目標接班志工 (members)
  const targetCleanName = targetNameInput.trim();
  let membersSnap = await db.collection('members').where('name', '==', targetCleanName).get();
  if (membersSnap.empty) {
    return {
      success: false,
      message: `⚠️ 志工名冊中查無姓名為「${targetCleanName}」的志工，請確認姓名是否正確。`
    };
  }

  let targetMemberDoc = membersSnap.docs[0];
  if (membersSnap.docs.length > 1 && targetOrgInput) {
    const matched = membersSnap.docs.find(d => {
      const data = d.data();
      return (data.orgName && data.orgName.includes(targetOrgInput)) || (data.phone && data.phone.includes(targetOrgInput));
    });
    if (matched) targetMemberDoc = matched;
  }
  const targetMember = targetMemberDoc.data();
  const targetMemberId = targetMemberDoc.id;

  // 不能轉給自己
  if (targetMemberId === requesterBinding.memberId || targetMember.name === requesterBinding.memberName) {
    return { success: false, message: '無法將班次轉給自己。' };
  }

  // (5) 性別限制檢核
  if (duty.genderType && targetMember.gender && duty.genderType !== targetMember.gender) {
    return {
      success: false,
      message: `⚠️ 性別不符：此班次為【${duty.genderType}眾班】，${targetMember.name} 師兄/師姊 為【${targetMember.gender}眾】，無法進行轉班。`
    };
  }

  // (6) 檢查目標志工是否已綁定 LINE
  let targetLineSnap = await db.collection('lineBindings').where('memberId', '==', targetMemberId).get();
  if (targetLineSnap.empty) {
    targetLineSnap = await db.collection('lineBindings').where('memberName', '==', targetMember.name).get();
  }
  if (targetLineSnap.empty) {
    return {
      success: false,
      message: `⚠️ ${targetMember.name} 師兄/師姊 尚未將 LINE 帳號綁定系統，無法接收調班確認通知。請先請對方在 LINE 官方帳號完成綁定。`
    };
  }
  const targetLineBinding = targetLineSnap.docs[0].data();

  // (7) 檢查目標志工在該日是否已有排班衝突（同日同場地或跨場地）
  const targetConflictSnap = await db.collection('dutyShifts')
    .where('dutyDate', '==', duty.dutyDate)
    .where('memberId', '==', targetMemberId)
    .get();

  if (!targetConflictSnap.empty) {
    const conflictDuty = targetConflictSnap.docs[0].data();
    return {
      success: false,
      message: `⚠️ 排班衝突：${targetMember.name} 師兄/師姊 於 ${duty.dutyDate} 已排有「${conflictDuty.location} ${conflictDuty.shiftLabel}」，無法再接此班次。`
    };
  }

  // (8) 檢查此席位是否已有 pending 申請
  const existingPendingSnap = await db.collection('shiftSwapRequests')
    .where('requesterDutyId', '==', dutyId)
    .where('status', '==', 'pending')
    .get();

  if (!existingPendingSnap.empty) {
    const existing = existingPendingSnap.docs[0].data();
    const expDate = existing.deadline ? (existing.deadline.toDate ? existing.deadline.toDate() : new Date(existing.deadline)) : null;
    if (!expDate || expDate.getTime() > now.getTime()) {
      return {
        success: false,
        message: `⚠️ 此班次已有發給「${existing.targetName}」的調班申請等待確認中，請勿重複發起。`
      };
    }
  }

  // (9) 建立 shiftSwapRequests 紀錄
  const swapId = `swap_${Date.now()}_${requesterBinding.memberId || 'req'}`;
  const swapData = {
    id: swapId,
    swapType: 'transfer',
    requesterId: requesterBinding.memberId || '',
    requesterName: requesterBinding.memberName || '',
    requesterLineUserId: requesterUserId,

    targetId: targetMemberId,
    targetName: targetMember.name,
    targetLineUserId: targetLineBinding.lineUserId,

    requesterDutyId: dutyId,
    requesterDutyDate: duty.dutyDate,
    requesterLocation: duty.location,
    requesterShiftId: duty.shiftId,
    requesterShiftLabel: duty.shiftLabel,
    requesterTimeRange: duty.timeRange || (SHIFT_TIMES[duty.location] && SHIFT_TIMES[duty.location][duty.shiftId]) || '',
    genderType: duty.genderType || '',

    targetDutyId: null,
    targetDutyDate: null,
    targetLocation: null,
    targetShiftId: null,
    targetShiftLabel: null,
    targetTimeRange: null,

    status: 'pending',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    resolvedAt: null,
    deadline: admin.firestore.Timestamp.fromDate(deadline),
    deadlineStr: deadlineStr
  };

  await db.collection('shiftSwapRequests').doc(swapId).set(swapData);

  return {
    success: true,
    swapRequest: swapData,
    message: `已向 ${targetMember.name} 師兄/師姊 發送【轉班確認請求】！\n請提醒對方於 ${deadlineStr} 前在 LINE 點選確認。`
  };
}

/**
 * 2. 發起【雙向換班】申請
 */
async function createExchangeRequest(requesterUserId, requesterDutyId, targetNameInput, targetDutyDate, targetOrgInput = '') {
  const db = admin.firestore();

  // (1) 發起者檢核
  const requesterBinding = await getBindingByUserId(db, requesterUserId);
  if (!requesterBinding) {
    return { success: false, message: '您尚未綁定志工身分，請先進行綁定。' };
  }

  // (2) 發起者班次
  const reqDutySnap = await db.collection('dutyShifts').doc(requesterDutyId).get();
  if (!reqDutySnap.exists) {
    return { success: false, message: '找不到發起者值班席位資料。' };
  }
  const reqDuty = reqDutySnap.data();

  const isMine = (reqDuty.memberId && reqDuty.memberId === requesterBinding.memberId) ||
                 (reqDuty.memberName && reqDuty.memberName === requesterBinding.memberName);
  if (!isMine) {
    return { success: false, message: `您並非【${reqDuty.dutyDate} ${reqDuty.location} ${reqDuty.shiftLabel}】的排班志工。` };
  }

  // (3) 查詢對方志工
  const targetCleanName = targetNameInput.trim();
  let membersSnap = await db.collection('members').where('name', '==', targetCleanName).get();
  if (membersSnap.empty) {
    return { success: false, message: `⚠️ 志工名冊中查無「${targetCleanName}」志工。` };
  }
  let targetMemberDoc = membersSnap.docs[0];
  if (membersSnap.docs.length > 1 && targetOrgInput) {
    const matched = membersSnap.docs.find(d => {
      const data = d.data();
      return (data.orgName && data.orgName.includes(targetOrgInput)) || (data.phone && data.phone.includes(targetOrgInput));
    });
    if (matched) targetMemberDoc = matched;
  }
  const targetMember = targetMemberDoc.data();
  const targetMemberId = targetMemberDoc.id;

  if (targetMemberId === requesterBinding.memberId || targetMember.name === requesterBinding.memberName) {
    return { success: false, message: '無法與自己換班。' };
  }

  // (4) 性別限制
  if (reqDuty.genderType && targetMember.gender && reqDuty.genderType !== targetMember.gender) {
    return {
      success: false,
      message: `⚠️ 性別不符：此班次為【${reqDuty.genderType}眾班】，${targetMember.name} 師兄/師姊 為【${targetMember.gender}眾】。`
    };
  }

  // (5) 對方 LINE 綁定
  let targetLineSnap = await db.collection('lineBindings').where('memberId', '==', targetMemberId).get();
  if (targetLineSnap.empty) {
    targetLineSnap = await db.collection('lineBindings').where('memberName', '==', targetMember.name).get();
  }
  if (targetLineSnap.empty) {
    return {
      success: false,
      message: `⚠️ ${targetMember.name} 師兄/師姊 尚未將 LINE 帳號綁定系統，無法接收換班確認通知。`
    };
  }
  const targetLineBinding = targetLineSnap.docs[0].data();

  // (6) 查詢對方在 targetDutyDate 的班次
  const targetDutySnap = await db.collection('dutyShifts')
    .where('dutyDate', '==', targetDutyDate)
    .where('memberId', '==', targetMemberId)
    .get();

  let targetDuty = null;
  let targetDutyDocId = null;
  if (!targetDutySnap.empty) {
    targetDutyDocId = targetDutySnap.docs[0].id;
    targetDuty = targetDutySnap.docs[0].data();
  } else {
    const targetDutyByNameSnap = await db.collection('dutyShifts')
      .where('dutyDate', '==', targetDutyDate)
      .where('memberName', '==', targetMember.name)
      .get();
    if (!targetDutyByNameSnap.empty) {
      targetDutyDocId = targetDutyByNameSnap.docs[0].id;
      targetDuty = targetDutyByNameSnap.docs[0].data();
    }
  }

  if (!targetDuty) {
    return {
      success: false,
      message: `⚠️ ${targetMember.name} 師兄/師姊 於 ${targetDutyDate} 並無排定任何值班，無法進行互換。若要直接交由對方代班，請使用「轉班」功能。`
    };
  }

  // (7) 計算調班截止時間（取兩班次中較早者的前一天 20:00）
  const infoReq = getDeadlineInfo(reqDuty.dutyDate);
  const infoTarget = getDeadlineInfo(targetDuty.dutyDate);
  const effectiveDeadline = infoReq.deadline.getTime() <= infoTarget.deadline.getTime() ? infoReq.deadline : infoTarget.deadline;
  const effectiveDeadlineStr = infoReq.deadline.getTime() <= infoTarget.deadline.getTime() ? infoReq.deadlineStr : infoTarget.deadlineStr;

  const now = new Date();
  if (now.getTime() >= effectiveDeadline.getTime()) {
    return {
      success: false,
      message: `❌ 已超過換班期限！雙方班次中較早者之期限為 ${effectiveDeadlineStr}。`
    };
  }

  // (8) 衝突檢查
  const reqConflictSnap = await db.collection('dutyShifts')
    .where('dutyDate', '==', targetDutyDate)
    .where('memberId', '==', requesterBinding.memberId)
    .get();
  if (!reqConflictSnap.empty) {
    return {
      success: false,
      message: `⚠️ 排班衝突：您於 ${targetDutyDate} 已有其他排班，無法換入該日班次。`
    };
  }

  const targetConflictSnap = await db.collection('dutyShifts')
    .where('dutyDate', '==', reqDuty.dutyDate)
    .where('memberId', '==', targetMemberId)
    .get();
  if (!targetConflictSnap.empty) {
    return {
      success: false,
      message: `⚠️ 排班衝突：${targetMember.name} 於 ${reqDuty.dutyDate} 已有其他排班，無法換入該日班次。`
    };
  }

  // (9) 建立 shiftSwapRequests 紀錄
  const swapId = `swap_${Date.now()}_${requesterBinding.memberId || 'req'}`;
  const swapData = {
    id: swapId,
    swapType: 'exchange',
    requesterId: requesterBinding.memberId || '',
    requesterName: requesterBinding.memberName || '',
    requesterLineUserId: requesterUserId,

    targetId: targetMemberId,
    targetName: targetMember.name,
    targetLineUserId: targetLineBinding.lineUserId,

    requesterDutyId: requesterDutyId,
    requesterDutyDate: reqDuty.dutyDate,
    requesterLocation: reqDuty.location,
    requesterShiftId: reqDuty.shiftId,
    requesterShiftLabel: reqDuty.shiftLabel,
    requesterTimeRange: reqDuty.timeRange || (SHIFT_TIMES[reqDuty.location] && SHIFT_TIMES[reqDuty.location][reqDuty.shiftId]) || '',

    targetDutyId: targetDutyDocId,
    targetDutyDate: targetDuty.dutyDate,
    targetLocation: targetDuty.location,
    targetShiftId: targetDuty.shiftId,
    targetShiftLabel: targetDuty.shiftLabel,
    targetTimeRange: targetDuty.timeRange || (SHIFT_TIMES[targetDuty.location] && SHIFT_TIMES[targetDuty.location][targetDuty.shiftId]) || '',

    status: 'pending',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    resolvedAt: null,
    deadline: admin.firestore.Timestamp.fromDate(effectiveDeadline),
    deadlineStr: effectiveDeadlineStr
  };

  await db.collection('shiftSwapRequests').doc(swapId).set(swapData);

  return {
    success: true,
    swapRequest: swapData,
    message: `已向 ${targetMember.name} 師兄/師姊 發送【雙向換班確認請求】！\n請提醒對方於 ${effectiveDeadlineStr} 前在 LINE 點選確認。`
  };
}

/**
 * 3. 對方確認接班 / 換班 (Transaction 原子操作)
 */
async function confirmSwap(swapId, confirmerUserId) {
  const db = admin.firestore();
  const swapRef = db.collection('shiftSwapRequests').doc(swapId);

  return await db.runTransaction(async (transaction) => {
    const swapSnap = await transaction.get(swapRef);
    if (!swapSnap.exists) {
      return { success: false, message: '找不到此調班申請記錄。' };
    }
    const swap = swapSnap.data();

    if (swap.status !== 'pending') {
      return {
        success: false,
        message: `此調班申請已被處理過（目前狀態：${swap.status === 'approved' ? '已同意' : swap.status === 'rejected' ? '已拒絕' : swap.status === 'expired' ? '已逾期' : swap.status}）。`
      };
    }

    if (swap.targetLineUserId !== confirmerUserId) {
      return { success: false, message: '您非此調班申請之指定對象，無法進行確認。' };
    }

    // 檢查截止期限
    const now = new Date();
    const expDate = swap.deadline ? (swap.deadline.toDate ? swap.deadline.toDate() : new Date(swap.deadline)) : null;
    if (expDate && now.getTime() >= expDate.getTime()) {
      transaction.update(swapRef, {
        status: 'expired',
        resolvedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return { success: false, message: '此調班申請已超過有效確認期限（逾期自動失效）。' };
    }

    // 執行排班席位更新
    if (swap.swapType === 'transfer') {
      const dutyRef = db.collection('dutyShifts').doc(swap.requesterDutyId);
      const dutySnap = await transaction.get(dutyRef);
      if (!dutySnap.exists) {
        return { success: false, message: '原值班席位資料不存在。' };
      }

      transaction.update(dutyRef, {
        memberId: swap.targetId,
        memberName: swap.targetName,
        status: '已排班',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else if (swap.swapType === 'exchange') {
      const reqDutyRef = db.collection('dutyShifts').doc(swap.requesterDutyId);
      const targetDutyRef = db.collection('dutyShifts').doc(swap.targetDutyId);

      const reqDutySnap = await transaction.get(reqDutyRef);
      const targetDutySnap = await transaction.get(targetDutyRef);

      if (!reqDutySnap.exists || !targetDutySnap.exists) {
        return { success: false, message: '換班之席位資料不存在。' };
      }

      // 互換志工資訊
      transaction.update(reqDutyRef, {
        memberId: swap.targetId,
        memberName: swap.targetName,
        status: '已排班',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      transaction.update(targetDutyRef, {
        memberId: swap.requesterId,
        memberName: swap.requesterName,
        status: '已排班',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    // 更新調班申請狀態
    transaction.update(swapRef, {
      status: 'approved',
      resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
      resolvedBy: confirmerUserId
    });

    return {
      success: true,
      swap: { ...swap, status: 'approved' },
      message: '調班確認成功！系統已同步更新值班排班表。'
    };
  });
}

/**
 * 4. 對方拒絕接班 / 換班
 */
async function rejectSwap(swapId, rejecterUserId) {
  const db = admin.firestore();
  const swapRef = db.collection('shiftSwapRequests').doc(swapId);
  const swapSnap = await swapRef.get();

  if (!swapSnap.exists) {
    return { success: false, message: '找不到此調班申請記錄。' };
  }
  const swap = swapSnap.data();

  if (swap.status !== 'pending') {
    return { success: false, message: '此調班申請已處理過。' };
  }

  await swapRef.update({
    status: 'rejected',
    resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
    resolvedBy: rejecterUserId
  });

  return {
    success: true,
    swap: { ...swap, status: 'rejected' },
    message: '已婉拒此調班申請。'
  };
}

/**
 * 5. 管理員在後台撤銷調班（回復原排班）
 */
async function revertSwapByAdmin(swapId, adminUserId) {
  const db = admin.firestore();
  const swapRef = db.collection('shiftSwapRequests').doc(swapId);

  return await db.runTransaction(async (transaction) => {
    const swapSnap = await transaction.get(swapRef);
    if (!swapSnap.exists) {
      throw new Error('找不到此調班記錄。');
    }
    const swap = swapSnap.data();

    if (swap.status !== 'approved') {
      throw new Error('僅能撤銷狀態為「已同意」的調班記錄。');
    }

    if (swap.swapType === 'transfer') {
      const dutyRef = db.collection('dutyShifts').doc(swap.requesterDutyId);
      transaction.update(dutyRef, {
        memberId: swap.requesterId,
        memberName: swap.requesterName,
        status: swap.requesterName ? '已排班' : '未指派',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else if (swap.swapType === 'exchange') {
      const reqDutyRef = db.collection('dutyShifts').doc(swap.requesterDutyId);
      const targetDutyRef = db.collection('dutyShifts').doc(swap.targetDutyId);

      transaction.update(reqDutyRef, {
        memberId: swap.requesterId,
        memberName: swap.requesterName,
        status: '已排班',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      transaction.update(targetDutyRef, {
        memberId: swap.targetId,
        memberName: swap.targetName,
        status: '已排班',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    transaction.update(swapRef, {
      status: 'reverted',
      revertedAt: admin.firestore.FieldValue.serverTimestamp(),
      revertedBy: adminUserId || 'admin'
    });

    return { success: true, message: '已成功撤銷調班，排班名冊已回復原狀。' };
  });
}

/**
 * 6. 定時掃描並標註過期的調班申請
 */
async function expireStaleSwaps() {
  const db = admin.firestore();
  const now = new Date();

  const pendingSnaps = await db.collection('shiftSwapRequests')
    .where('status', '==', 'pending')
    .get();

  const expiredList = [];
  const batch = db.batch();

  pendingSnaps.forEach(doc => {
    const data = doc.data();
    const expDate = data.deadline ? (data.deadline.toDate ? data.deadline.toDate() : new Date(data.deadline)) : null;
    if (expDate && expDate.getTime() < now.getTime()) {
      batch.update(doc.ref, {
        status: 'expired',
        resolvedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      expiredList.push({ id: doc.id, ...data });
    }
  });

  if (expiredList.length > 0) {
    await batch.commit();
  }

  return expiredList;
}

// ─────────────────────────────────────────────
// Flex Message 產生器
// ─────────────────────────────────────────────

/**
 * 產生給對方的調班/換班確認 Flex Message
 */
function buildSwapConfirmFlexMessage(swap) {
  const isTransfer = swap.swapType === 'transfer';
  const title = isTransfer ? '📋 志工轉班確認請求' : '🔄 志工雙向換班請求';
  const themeColor = isTransfer ? '#1b5e20' : '#854d0e';

  const contents = [
    {
      type: 'text',
      text: `${swap.requesterName} 師兄/師姊 向您發起${isTransfer ? '轉班（代班）' : '換班'}請求：`,
      wrap: true,
      size: 'sm',
      color: '#27272a'
    },
    { type: 'separator', margin: 'md' }
  ];

  if (isTransfer) {
    contents.push({
      type: 'box',
      layout: 'vertical',
      margin: 'md',
      spacing: 'xs',
      contents: [
        { type: 'text', text: '【轉出班次（請您代班）】', weight: 'bold', size: 'xs', color: '#15803d' },
        { type: 'text', text: `📍 道場：${swap.requesterLocation}`, size: 'sm' },
        { type: 'text', text: `📅 日期：${swap.requesterDutyDate}`, size: 'sm', weight: 'bold' },
        { type: 'text', text: `⏰ 班次：${swap.requesterShiftLabel} (${swap.requesterTimeRange})`, size: 'sm' }
      ]
    });
  } else {
    contents.push(
      {
        type: 'box',
        layout: 'vertical',
        margin: 'md',
        spacing: 'xs',
        contents: [
          { type: 'text', text: '【您將接手的班次】', weight: 'bold', size: 'xs', color: '#15803d' },
          { type: 'text', text: `📍 ${swap.requesterLocation} (${swap.requesterDutyDate})`, size: 'sm', weight: 'bold' },
          { type: 'text', text: `⏰ ${swap.requesterShiftLabel} ${swap.requesterTimeRange}`, size: 'xs', color: '#52525b' }
        ]
      },
      {
        type: 'box',
        layout: 'vertical',
        margin: 'md',
        spacing: 'xs',
        contents: [
          { type: 'text', text: '【您讓給對方的班次】', weight: 'bold', size: 'xs', color: '#c2410c' },
          { type: 'text', text: `📍 ${swap.targetLocation} (${swap.targetDutyDate})`, size: 'sm', weight: 'bold' },
          { type: 'text', text: `⏰ ${swap.targetShiftLabel} ${swap.targetTimeRange}`, size: 'xs', color: '#52525b' }
        ]
      }
    );
  }

  contents.push(
    { type: 'separator', margin: 'md' },
    {
      type: 'text',
      text: `⏳ 確認截止期限：${swap.deadlineStr || '值班日前一天 20:00'}`,
      size: 'xs',
      color: '#dc2626',
      margin: 'sm'
    }
  );

  return {
    type: 'flex',
    altText: `【調班請求】${swap.requesterName} 向您發送了值班調整請求`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: title, weight: 'bold', size: 'md', color: '#ffffff' }
        ],
        backgroundColor: themeColor
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: contents
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        spacing: 'md',
        contents: [
          {
            type: 'button',
            action: {
              type: 'postback',
              label: isTransfer ? '✅ 同意代班' : '✅ 同意換班',
              data: `action=confirmSwap&swapId=${swap.id}`,
              displayText: isTransfer ? '我同意接下此代班！' : '我同意此換班！'
            },
            style: 'primary',
            color: '#16a34a',
            height: 'sm'
          },
          {
            type: 'button',
            action: {
              type: 'postback',
              label: '❌ 婉拒',
              data: `action=rejectSwap&swapId=${swap.id}`,
              displayText: '抱歉，該時段無法配合。'
            },
            style: 'secondary',
            height: 'sm'
          }
        ]
      }
    }
  };
}

/**
 * 產生志工未來排班清單 Flex Bubble（提供轉班 / 換班快捷按鈕）
 */
function buildDutySelectionFlexMessage(duties, memberName) {
  if (!duties || duties.length === 0) {
    return {
      type: 'text',
      text: `【${memberName} 師兄/師姊】\n您近期尚無已排定的值班班次，無需進行調班。🌸`
    };
  }

  const bubbles = duties.slice(0, 10).map(duty => {
    const timeStr = duty.timeRange || (SHIFT_TIMES[duty.location] && SHIFT_TIMES[duty.location][duty.shiftId]) || '';
    const { deadlineStr } = getDeadlineInfo(duty.dutyDate);

    return {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: `🗓️ ${duty.dutyDate}`, weight: 'bold', size: 'md', color: '#166534' },
          { type: 'text', text: `${duty.location} · ${duty.shiftLabel}`, size: 'xs', color: '#4b5563' }
        ],
        backgroundColor: '#f0fdf4'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          { type: 'text', text: `• 時段：${timeStr}`, size: 'xs', color: '#374151' },
          { type: 'text', text: `• 性別限制：${duty.genderType || '不限'}眾`, size: 'xs', color: '#6b7280' },
          { type: 'text', text: `• 截止期限：${deadlineStr}`, size: 'xs', color: '#dc2626' }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'xs',
        contents: [
          {
            type: 'button',
            action: {
              type: 'postback',
              label: '📋 轉班 (找人代班)',
              data: `action=selectForTransfer&dutyId=${duty.id}`,
              displayText: `我要為 ${duty.dutyDate} ${duty.shiftLabel} 申請轉班`
            },
            style: 'primary',
            color: '#15803d',
            height: 'sm'
          },
          {
            type: 'button',
            action: {
              type: 'postback',
              label: '🔄 換班 (與對方互換)',
              data: `action=selectForExchange&dutyId=${duty.id}`,
              displayText: `我要為 ${duty.dutyDate} ${duty.shiftLabel} 申請換班`
            },
            style: 'secondary',
            height: 'sm'
          }
        ]
      }
    };
  });

  return {
    type: 'flex',
    altText: `【值班調班】請選擇您要調整的班次`,
    contents: {
      type: 'carousel',
      contents: bubbles
    }
  };
}

/**
 * 歡迎加入與功能總覽 Flex Message (溫馨慈濟人文風)
 */
function buildWelcomeFlexMessage() {
  return {
    type: 'flex',
    altText: '🌸 歡迎加入慈濟小祕書！',
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: '🌸 慈濟小祕書', weight: 'bold', size: 'lg', color: '#166534' },
          { type: 'text', text: '道場值班 · 活動 · 會議 智慧推播', size: 'xs', color: '#4b5563' }
        ],
        backgroundColor: '#f0fdf4'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'text',
            text: '阿彌陀佛！歡迎加入慈濟小祕書。請先完成志工身分綁定，即可享有完整推播與調班服務：',
            wrap: true,
            size: 'sm',
            color: '#374151'
          },
          {
            type: 'box',
            layout: 'vertical',
            spacing: 'xs',
            backgroundColor: '#fbf8f3',
            paddingAll: 'md',
            cornerRadius: 'md',
            contents: [
              { type: 'text', text: '🔔 每日定時推播提醒：', weight: 'bold', size: 'xs', color: '#166534' },
              { type: 'text', text: '• 08:00 明日道場值班提醒', size: 'xs', color: '#4b5563' },
              { type: 'text', text: '• 08:30 明日活動行前提醒', size: 'xs', color: '#4b5563' },
              { type: 'text', text: '• 09:00 明日會議出席提醒', size: 'xs', color: '#4b5563' },
              { type: 'text', text: '• 🔄 自助調班 / 雙向換班推播確認', size: 'xs', color: '#15803d' }
            ]
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            action: {
              type: 'message',
              label: '🔗 立即綁定志工身分',
              text: '綁定'
            },
            style: 'primary',
            color: '#166534',
            height: 'sm'
          },
          {
            type: 'box',
            layout: 'horizontal',
            spacing: 'sm',
            contents: [
              {
                type: 'button',
                action: {
                  type: 'message',
                  label: '📋 值班查詢',
                  text: '值班查詢'
                },
                style: 'secondary',
                height: 'sm'
              },
              {
                type: 'button',
                action: {
                  type: 'message',
                  label: '🔄 自助調班',
                  text: '調班'
                },
                style: 'secondary',
                height: 'sm'
              }
            ]
          },
          {
            type: 'button',
            action: {
              type: 'message',
              label: 'ℹ️ 完整功能說明',
              text: '功能說明'
            },
            style: 'link',
            height: 'sm'
          }
        ]
      }
    }
  };
}


module.exports = {
  SHIFT_TIMES,
  getDeadlineInfo,
  getTaiwanTodayStr,
  createTransferRequest,
  createExchangeRequest,
  confirmSwap,
  rejectSwap,
  revertSwapByAdmin,
  expireStaleSwaps,
  buildSwapConfirmFlexMessage,
  buildDutySelectionFlexMessage,
  buildWelcomeFlexMessage
};
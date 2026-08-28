import { defineStore } from 'pinia';
import { ref } from 'vue';
import { 
  getCollectionDocs, getDocById, createDoc, updateDocById,
  registerWithTransaction, cancelRegistrationWithPromotion
} from '@/firebase/db';
import { where, orderBy } from 'firebase/firestore';

export const useRegistrationsStore = defineStore('registrations', () => {
  const registrations = ref([]);
  const myRegistrations = ref([]);
  const loading = ref(false);

  async function fetchEventRegistrations(eventId) {
    loading.value = true;
    try {
      const data = await getCollectionDocs('registrations', [
        where('eventId', '==', eventId)
      ]);
      registrations.value = data.sort((a, b) => (a.registeredAt?.seconds || 0) - (b.registeredAt?.seconds || 0));
      return registrations.value;
    } finally {
      loading.value = false;
    }
  }

  async function submitRegistration(regData) {
    loading.value = true;
    try {
      // 1. 嚴格重複報名防呆檢查 (排除已取消紀錄)
      const eventRegs = await getCollectionDocs('registrations', [
        where('eventId', '==', regData.eventId)
      ]);
      
      const activeRegs = eventRegs.filter(r => r.status !== '已取消');
      let duplicate = null;

      if (regData.memberId) {
        duplicate = activeRegs.find(r => r.memberId === regData.memberId);
      }
      
      if (!duplicate && regData.name) {
        const targetName = (regData.name || '').trim();
        if (regData.mode === 'volunteer') {
          // 志工比對姓名與組織
          duplicate = activeRegs.find(r => {
            const rName = (r.name || r.guestName || '').trim();
            if (rName !== targetName) return false;
            if (regData.orgId && r.orgId) return r.orgId === regData.orgId;
            if (regData.orgPath && r.orgPath) return r.orgPath === regData.orgPath;
            return true;
          });
        } else {
          // 會眾比對姓名與電話
          const targetPhone = (regData.phone || regData.guestPhone || '').trim();
          duplicate = activeRegs.find(r => {
            const rName = (r.name || r.guestName || '').trim();
            const rPhone = (r.phone || r.guestPhone || '').trim();
            if (rName !== targetName) return false;
            if (targetPhone && rPhone) return targetPhone === rPhone;
            return false;
          });
        }
      }

      if (duplicate) {
        const name = duplicate.name || duplicate.guestName;
        const st = duplicate.status || '已確認';
        const count = duplicate.participantCount || 1;
        const err = new Error(`志工/大德「${name}」已報名過此活動（狀態：${st}，共 ${count} 位），請勿重複報名！`);
        err.isDuplicate = true;
        err.duplicateRecord = duplicate;
        throw err;
      }

      return await registerWithTransaction(regData);
    } finally {
      loading.value = false;
    }
  }

  // 查詢個人報名紀錄（姓名為必填，電話末四碼改為選填）
  async function fetchMyRegistrations(name, phoneLast4 = '') {
    loading.value = true;
    try {
      const kw = (name || '').trim();
      const p4 = (phoneLast4 || '').trim();
      if (!kw) return [];

      // 1. 查找志工名冊
      const members = await getCollectionDocs('members', [
        where('name', '==', kw)
      ]);
      const matchedMembers = p4 
        ? members.filter(m => (m.phone || '').endsWith(p4))
        : members;
      
      const memberIds = matchedMembers.map(m => m.id);
      
      // 2. 查找志工與一般會眾報名
      const [allGuestRegs, allMemberRegs, allNameRegs] = await Promise.all([
        getCollectionDocs('registrations', [where('guestName', '==', kw)]),
        memberIds.length > 0 ? getCollectionDocs('registrations', [where('memberId', 'in', memberIds)]) : Promise.resolve([]),
        getCollectionDocs('registrations', [where('name', '==', kw)])
      ]);

      const map = {};
      [...allGuestRegs, ...allMemberRegs, ...allNameRegs].forEach(r => {
        if (p4) {
          const ph = r.phone || r.guestPhone || r.memberPhone || '';
          if (!ph.endsWith(p4)) return;
        }
        map[r.id] = r;
      });

      // 3. 補齊活動標題與地點日期
      const results = Object.values(map);
      const eventsSnap = await getCollectionDocs('events');
      const eventMap = {};
      eventsSnap.forEach(e => { eventMap[e.id] = e; });

      myRegistrations.value = results
        .map(r => {
          const evt = eventMap[r.eventId] || {};
          return {
            ...r,
            eventTitle: r.eventTitle || evt.title || '慈濟志業活動',
            eventDate: evt.eventDate || '',
            eventStartTime: evt.eventStartTime || '',
            eventEndTime: evt.eventEndTime || '',
            eventLocation: evt.location || '慈濟園區',
            eventCategory: evt.category || '活動'
          };
        })
        .sort((a, b) => (b.registeredAt?.seconds || 0) - (a.registeredAt?.seconds || 0));

      return myRegistrations.value;
    } finally {
      loading.value = false;
    }
  }

  async function cancelRegistration(regId, eventId) {
    loading.value = true;
    try {
      await cancelRegistrationWithPromotion(regId, eventId);
      myRegistrations.value = myRegistrations.value.map(r => r.id === regId ? { ...r, status: '已取消' } : r);
      registrations.value = registrations.value.map(r => r.id === regId ? { ...r, status: '已取消' } : r);
    } finally {
      loading.value = false;
    }
  }

  async function checkIn(regId, method = '現場點名') {
    await updateDocById('registrations', regId, {
      checkedIn: true,
      checkInTime: new Date().toISOString(),
      checkInMethod: method
    });
    registrations.value = registrations.value.map(r => r.id === regId ? { ...r, checkedIn: true } : r);
  }

  async function unCheckIn(regId) {
    await updateDocById('registrations', regId, {
      checkedIn: false,
      checkInTime: null,
      checkInMethod: null
    });
    registrations.value = registrations.value.map(r => r.id === regId ? { ...r, checkedIn: false } : r);
  }

  return {
    registrations,
    myRegistrations,
    loading,
    fetchEventRegistrations,
    submitRegistration,
    fetchMyRegistrations,
    cancelRegistration,
    checkIn,
    unCheckIn
  };
});

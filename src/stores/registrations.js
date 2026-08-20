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
      return await registerWithTransaction(regData);
    } finally {
      loading.value = false;
    }
  }

  async function fetchMyRegistrations(name, phoneLast4) {
    loading.value = true;
    try {
      const members = await getCollectionDocs('members', [
        where('name', '==', name)
      ]);
      const matchedMember = members.find(m => (m.phone || '').endsWith(phoneLast4));
      
      let allRegs = [];
      if (matchedMember) {
        allRegs = await getCollectionDocs('registrations', [
          where('memberId', '==', matchedMember.id)
        ]);
      } else {
        allRegs = await getCollectionDocs('registrations', [
          where('guestName', '==', name)
        ]);
        allRegs = allRegs.filter(r => (r.guestPhone || '').endsWith(phoneLast4));
      }

      myRegistrations.value = allRegs.sort((a, b) => (b.registeredAt?.seconds || 0) - (a.registeredAt?.seconds || 0));
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
      checkedInAt: new Date().toISOString(),
      checkInMethod: method
    });
    await createDoc('checkins', {
      registrationId: regId,
      method,
      timestamp: new Date().toISOString()
    });
    registrations.value = registrations.value.map(r => r.id === regId ? { ...r, checkedIn: true } : r);
  }

  return {
    registrations,
    myRegistrations,
    loading,
    fetchEventRegistrations,
    submitRegistration,
    fetchMyRegistrations,
    cancelRegistration,
    checkIn
  };
});

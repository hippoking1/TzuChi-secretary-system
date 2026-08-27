import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getCollectionDocs, createDoc, updateDocById, deleteDocById, batchWriteItems } from '@/firebase/db';
import { where } from 'firebase/firestore';

export const useMembersStore = defineStore('members', () => {
  const members = ref([]);
  const loading = ref(false);

  async function syncPhonesFromRegistrations() {
    try {
      const [regs, allMembers] = await Promise.all([
        getCollectionDocs('registrations'),
        getCollectionDocs('members')
      ]);
      const memMap = {};
      const memByName = {};
      allMembers.forEach(m => {
        memMap[m.id] = m;
        if (!memByName[m.name]) memByName[m.name] = [];
        memByName[m.name].push(m);
      });

      const updates = [];
      regs.forEach(r => {
        const ph = (r.phone || r.guestPhone || '').trim();
        if (!ph) return;

        if (r.memberId && memMap[r.memberId]) {
          const m = memMap[r.memberId];
          if ((m.phone || '').trim() !== ph) {
            updates.push({ id: m.id, phone: ph });
            m.phone = ph;
          }
        } else if (r.name && memByName[r.name]) {
          memByName[r.name].forEach(m => {
            if ((m.phone || '').trim() !== ph) {
              updates.push({ id: m.id, phone: ph });
              m.phone = ph;
            }
          });
        }
      });

      if (updates.length > 0) {
        console.log(`[MembersStore] 自動同步 ${updates.length} 位志工最新電話號碼...`);
        for (const u of updates) {
          await updateDocById('members', u.id, { phone: u.phone });
        }
      }
      return updates.length;
    } catch (e) {
      console.warn("自動同步志工電話警告:", e);
      return 0;
    }
  }

  async function fetchMembers(filters = {}) {
    loading.value = true;
    try {
      const constraints = [];
      if (filters.gender) {
        constraints.push(where('gender', '==', filters.gender));
      }
      let list = await getCollectionDocs('members', constraints);

      if (filters.orgIds && Array.isArray(filters.orgIds) && filters.orgIds.length > 0) {
        list = list.filter(m => filters.orgIds.includes(m.orgId));
      } else if (filters.orgId) {
        list = list.filter(m => m.orgId === filters.orgId);
      }

      if (filters.search) {
        const keyword = filters.search.toLowerCase();
        list = list.filter(m => 
          (m.name || '').toLowerCase().includes(keyword) ||
          (m.phone || '').includes(keyword) ||
          (m.volunteerCode || '').includes(keyword) ||
          (m.dharmaName || '').includes(keyword)
        );
      }
      members.value = list;
      return list;
    } finally {
      loading.value = false;
    }
  }

  async function saveMember(memberData) {
    if (memberData.id) {
      await updateDocById('members', memberData.id, memberData);
    } else {
      await createDoc('members', memberData);
    }
  }

  async function deleteMember(id) {
    await deleteDocById('members', id);
    members.value = members.value.filter(m => m.id !== id);
  }

  async function batchImportMembers(rows) {
    loading.value = true;
    try {
      await batchWriteItems('members', rows);
      await fetchMembers();
    } finally {
      loading.value = false;
    }
  }

  return {
    members,
    loading,
    fetchMembers,
    syncPhonesFromRegistrations,
    saveMember,
    deleteMember,
    batchImportMembers
  };
});

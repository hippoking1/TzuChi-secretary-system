import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getCollectionDocs, createDoc, updateDocById, deleteDocById, batchWriteItems } from '@/firebase/db';
import { where } from 'firebase/firestore';
import { normalizeAndValidatePhone } from '@/utils/phoneUtils';

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
        const rawPh = (r.phone || r.guestPhone || '').trim();
        if (!rawPh) return;
        const norm = normalizeAndValidatePhone(rawPh);
        const ph = norm.valid ? norm.formatted : rawPh;

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

      if (filters.position) {
        list = list.filter(m => {
          const roles = m.cadreRoles || m.positions || [];
          return roles.includes(filters.position);
        });
      }

      if (filters.search) {
        const keyword = filters.search.toLowerCase();
        list = list.filter(m => 
          (m.name || '').toLowerCase().includes(keyword) ||
          (m.phone || '').includes(keyword) ||
          (m.volunteerCode || '').includes(keyword) ||
          (m.dharmaName || '').includes(keyword) ||
          (m.cadreRoles || m.positions || []).some(r => r.toLowerCase().includes(keyword))
        );
      }
      members.value = list;
      return list;
    } finally {
      loading.value = false;
    }
  }

  async function saveMember(memberData) {
    const cleanData = { ...memberData };
    cleanData.cadreRoles = cleanData.cadreRoles || cleanData.positions || [];
    cleanData.positions = cleanData.cadreRoles; // 雙向相容
    if (cleanData.phone) {
      const norm = normalizeAndValidatePhone(cleanData.phone);
      if (norm.valid) cleanData.phone = norm.formatted;
    }
    const memberId = cleanData.id;
    delete cleanData.id;

    if (memberId) {
      await updateDocById('members', memberId, cleanData);
    } else {
      await createDoc('members', cleanData);
    }
  }

  async function deleteMember(id) {
    if (!id) {
      throw new Error('未指定欲刪除志工的 ID');
    }
    await deleteDocById('members', id);
    members.value = members.value.filter(m => m.id !== id);
  }

  async function batchImportMembers(rows) {
    loading.value = true;
    try {
      const cleanRows = (rows || []).map(r => {
        if (r.phone) {
          const norm = normalizeAndValidatePhone(r.phone);
          if (norm.valid) return { ...r, phone: norm.formatted };
        }
        return r;
      });
      await batchWriteItems('members', cleanRows);
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

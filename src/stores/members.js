import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getCollectionDocs, createDoc, updateDocById, deleteDocById, batchWriteItems } from '@/firebase/db';
import { where } from 'firebase/firestore';

export const useMembersStore = defineStore('members', () => {
  const members = ref([]);
  const loading = ref(false);

  async function fetchMembers(filters = {}) {
    loading.value = true;
    try {
      const constraints = [];
      if (filters.gender) {
        constraints.push(where('gender', '==', filters.gender));
      }
      if (filters.orgId) {
        constraints.push(where('orgId', '==', filters.orgId));
      }
      let list = await getCollectionDocs('members', constraints);
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
    saveMember,
    deleteMember,
    batchImportMembers
  };
});

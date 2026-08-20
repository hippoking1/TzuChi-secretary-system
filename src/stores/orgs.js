import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { getCollectionDocs, createDoc, updateDocById, deleteDocById } from '@/firebase/db';

export const useOrgsStore = defineStore('orgs', () => {
  const orgs = ref([]);
  const loading = ref(false);

  const orgTree = computed(() => {
    const map = {};
    const roots = [];
    const sorted = [...orgs.value].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    sorted.forEach(item => {
      map[item.id] = { ...item, children: [] };
    });

    sorted.forEach(item => {
      if (item.parentId && map[item.parentId]) {
        map[item.parentId].children.push(map[item.id]);
      } else {
        roots.push(map[item.id]);
      }
    });

    return roots;
  });

  async function fetchOrgs() {
    loading.value = true;
    try {
      orgs.value = await getCollectionDocs('organizations');
      return orgs.value;
    } finally {
      loading.value = false;
    }
  }

  function getDescendantOrgIds(orgId) {
    if (!orgId) return [];
    const result = [orgId];
    const queue = [orgId];
    while (queue.length > 0) {
      const current = queue.shift();
      const children = orgs.value.filter(o => o.parentId === current);
      children.forEach(c => {
        result.push(c.id);
        queue.push(c.id);
      });
    }
    return result;
  }

  function getOrgPath(orgId) {
    if (!orgId) return '';
    const map = {};
    orgs.value.forEach(o => { map[o.id] = o; });
    
    const parts = [];
    let curr = map[orgId];
    let count = 0;
    while (curr && count < 10) {
      parts.unshift(curr.name);
      curr = curr.parentId ? map[curr.parentId] : null;
      count++;
    }
    return parts.join(' / ');
  }

  async function saveOrg(orgData) {
    if (orgData.id) {
      await updateDocById('organizations', orgData.id, orgData);
    } else {
      await createDoc('organizations', orgData);
    }
    await fetchOrgs();
  }

  async function deleteOrg(id) {
    await deleteDocById('organizations', id);
    await fetchOrgs();
  }

  return {
    orgs,
    orgTree,
    loading,
    fetchOrgs,
    getOrgPath,
    getDescendantOrgIds,
    saveOrg,
    deleteOrg
  };
});

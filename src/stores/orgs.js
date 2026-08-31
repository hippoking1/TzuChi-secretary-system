import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { getCollectionDocs, createDoc, updateDocById, deleteDocById, batchWriteItems } from '@/firebase/db';

const CHINESE_NUM_MAP = {
  '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
  '十一': 11, '十二': 12, '十三': 13, '十四': 14, '十五': 15, '十六': 16, '十七': 17, '十八': 18, '十九': 19, '二十': 20,
  '廿': 20, '廿一': 21, '廿二': 22, '廿三': 23, '廿四': 24, '廿五': 25
};

function extractSortKey(name) {
  if (!name) return 999;
  const arabicMatch = name.match(/\d+/);
  if (arabicMatch) return parseInt(arabicMatch[0], 10);
  for (const [cn, num] of Object.entries(CHINESE_NUM_MAP)) {
    if (name.includes(cn)) return num;
  }
  return 999;
}

export const useOrgsStore = defineStore('orgs', () => {
  const orgs = ref([]);
  const loading = ref(false);

  const orgTree = computed(() => {
    const map = {};
    const roots = [];
    const sorted = [...orgs.value].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    sorted.forEach(item => {
      map[item.id] = { ...item, children: [] };
    });

    sorted.forEach(item => {
      if (item.parentId && map[item.parentId]) {
        map[item.parentId].children.push(map[item.id]);
      } else if (!item.parentId) {
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
    const cleanData = { ...orgData };
    if (!cleanData.id && cleanData.sortOrder === undefined) {
      // 自動設定為同層最大 sortOrder + 1
      const siblings = orgs.value.filter(o => (o.parentId || null) === (cleanData.parentId || null));
      const maxOrder = siblings.reduce((max, s) => Math.max(max, s.sortOrder ?? 0), 0);
      cleanData.sortOrder = maxOrder + 1;
    }

    if (cleanData.id) {
      await updateDocById('organizations', cleanData.id, cleanData);
    } else {
      await createDoc('organizations', cleanData);
    }
    await fetchOrgs();
  }

  async function deleteOrg(id) {
    const allIds = getDescendantOrgIds(id);
    for (const docId of allIds) {
      await deleteDocById('organizations', docId);
    }
    await fetchOrgs();
  }

  /**
   * 同層級上下移動排序
   * @param {string} orgId 
   * @param {'up' | 'down'} direction 
   */
  async function moveOrg(orgId, direction) {
    const current = orgs.value.find(o => o.id === orgId);
    if (!current) return;

    // 取得同層所有節點並依目前順序排列
    const siblings = orgs.value
      .filter(o => (o.parentId || null) === (current.parentId || null))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    const idx = siblings.findIndex(s => s.id === orgId);
    if (idx === -1) return;

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= siblings.length) return;

    const sibling = siblings[targetIdx];

    // 交換兩者 sortOrder
    let currOrder = current.sortOrder ?? idx;
    let sibOrder = sibling.sortOrder ?? targetIdx;
    if (currOrder === sibOrder) {
      currOrder = idx;
      sibOrder = targetIdx;
    }

    await Promise.all([
      updateDocById('organizations', current.id, { sortOrder: sibOrder }),
      updateDocById('organizations', sibling.id, { sortOrder: currOrder })
    ]);

    await fetchOrgs();
  }

  /**
   * 一鍵依組織名稱標準自動排序 (和氣一、和氣二... 互愛一、互愛二... 協力一、協力二...)
   */
  async function autoSortAllOrgs() {
    loading.value = true;
    try {
      const parentGroups = {};
      orgs.value.forEach(o => {
        const pId = o.parentId || 'root';
        if (!parentGroups[pId]) parentGroups[pId] = [];
        parentGroups[pId].push(o);
      });

      const updates = [];
      Object.keys(parentGroups).forEach(pId => {
        const list = parentGroups[pId];
        list.sort((a, b) => {
          const keyA = extractSortKey(a.name);
          const keyB = extractSortKey(b.name);
          if (keyA !== keyB) return keyA - keyB;
          return (a.name || '').localeCompare(b.name || '', 'zh-Hant');
        });

        list.forEach((item, index) => {
          updates.push({
            id: item.id,
            name: item.name,
            level: item.level,
            parentId: item.parentId || null,
            sortOrder: index + 1
          });
        });
      });

      await batchWriteItems('organizations', updates);
      await fetchOrgs();
    } finally {
      loading.value = false;
    }
  }

  return {
    orgs,
    orgTree,
    loading,
    fetchOrgs,
    getOrgPath,
    getDescendantOrgIds,
    saveOrg,
    deleteOrg,
    moveOrg,
    autoSortAllOrgs
  };
});

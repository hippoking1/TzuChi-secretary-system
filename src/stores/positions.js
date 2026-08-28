import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { getCollectionDocs, createDoc, updateDocById, deleteDocById } from '@/firebase/db';

export const usePositionsStore = defineStore('positions', () => {
  const positions = ref([]);
  const loading = ref(false);

  // 階層樹狀架構 (例如：合心幹事 ➔ 各項合心職務；和氣幹事 ➔ 各項和氣職務)
  const positionTree = computed(() => {
    const map = {};
    const roots = [];
    const sorted = [...positions.value].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

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

  // 所有可選的職稱名稱清單 (扁平陣列)
  const allPositionNames = computed(() => {
    return positions.value.map(p => p.name).filter(Boolean);
  });

  async function fetchPositions() {
    loading.value = true;
    try {
      let data = await getCollectionDocs('positions');
      
      // 若資料庫尚未建立職稱架構，自動初始化慈濟標準幹部架構 (合心幹事 下轄 和氣幹事 與各功能組)
      if (!data || data.length === 0) {
        data = await initDefaultPositions();
      }

      positions.value = data;
      return positions.value;
    } finally {
      loading.value = false;
    }
  }

  async function initDefaultPositions() {
    const defaultData = [
      { name: '合心幹事', level: '合心', parentId: null, sortOrder: 1 },
      { name: '合心活動幹事', level: '合心', parentName: '合心幹事', sortOrder: 2 },
      { name: '合心訪視幹事', level: '合心', parentName: '合心幹事', sortOrder: 3 },
      { name: '合心總務幹事', level: '合心', parentName: '合心幹事', sortOrder: 4 },
      { name: '合心法親關懷幹事', level: '合心', parentName: '合心幹事', sortOrder: 5 },
      { name: '合心教育幹事', level: '合心', parentName: '合心幹事', sortOrder: 6 },
      { name: '合心環保幹事', level: '合心', parentName: '合心幹事', sortOrder: 7 },
      { name: '合心人文幹事', level: '合心', parentName: '合心幹事', sortOrder: 8 },

      { name: '和氣幹事', level: '和氣', parentName: '合心幹事', sortOrder: 10 },
      { name: '和氣活動幹事', level: '和氣', parentName: '和氣幹事', sortOrder: 11 },
      { name: '和氣訪視幹事', level: '和氣', parentName: '和氣幹事', sortOrder: 12 },
      { name: '和氣總務幹事', level: '和氣', parentName: '和氣幹事', sortOrder: 13 },
      { name: '和氣法親關懷幹事', level: '和氣', parentName: '和氣幹事', sortOrder: 14 },
      { name: '和氣教育幹事', level: '和氣', parentName: '和氣幹事', sortOrder: 15 },
      { name: '和氣環保幹事', level: '和氣', parentName: '和氣幹事', sortOrder: 16 },
      { name: '和氣人文幹事', level: '和氣', parentName: '和氣幹事', sortOrder: 17 }
    ];

    const createdMap = {};
    for (const item of defaultData) {
      const parentId = item.parentName ? (createdMap[item.parentName] || null) : null;
      const id = await createDoc('positions', {
        name: item.name,
        level: item.level,
        parentId,
        sortOrder: item.sortOrder
      });
      createdMap[item.name] = id;
    }

    return await getCollectionDocs('positions');
  }

  async function savePosition(posData) {
    if (posData.id) {
      await updateDocById('positions', posData.id, posData);
    } else {
      await createDoc('positions', posData);
    }
    await fetchPositions();
  }

  async function deletePosition(id) {
    // 同時遞迴刪除其子職稱
    const toDelete = [id];
    const queue = [id];
    while (queue.length > 0) {
      const curr = queue.shift();
      const children = positions.value.filter(p => p.parentId === curr);
      children.forEach(c => {
        toDelete.push(c.id);
        queue.push(c.id);
      });
    }

    for (const did of toDelete) {
      await deleteDocById('positions', did);
    }
    await fetchPositions();
  }

  return {
    positions,
    positionTree,
    allPositionNames,
    loading,
    fetchPositions,
    savePosition,
    deletePosition
  };
});

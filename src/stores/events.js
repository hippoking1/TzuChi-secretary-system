import { defineStore } from 'pinia';
import { ref } from 'vue';
import { 
  getCollectionDocs, getDocById, createDoc, updateDocById, deleteDocById,
  batchWriteItems
} from '@/firebase/db';
import { where, orderBy } from 'firebase/firestore';

export const useEventsStore = defineStore('events', () => {
  const events = ref([]);
  const currentEvent = ref(null);
  const loading = ref(false);

  async function fetchPublishedEvents(category = '全部') {
    loading.value = true;
    try {
      const constraints = [where('status', '==', '已發佈')];
      if (category && category !== '全部') {
        constraints.push(where('category', '==', category));
      }
      const data = await getCollectionDocs('events', constraints);
      events.value = data.sort((a, b) => (a.eventDate || '').localeCompare(b.eventDate || ''));
      return events.value;
    } finally {
      loading.value = false;
    }
  }

  async function fetchAllEvents(statusFilter = '全部') {
    loading.value = true;
    try {
      const constraints = [];
      if (statusFilter && statusFilter !== '全部') {
        constraints.push(where('status', '==', statusFilter));
      }
      const data = await getCollectionDocs('events', constraints);
      events.value = data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      return events.value;
    } finally {
      loading.value = false;
    }
  }

  async function fetchEventById(id) {
    loading.value = true;
    try {
      const evt = await getDocById('events', id);
      if (evt) {
        const sessions = await getCollectionDocs(`events/${id}/sessions`);
        evt.sessions = sessions;
      }
      currentEvent.value = evt;
      return evt;
    } finally {
      loading.value = false;
    }
  }

  async function saveEvent(eventData, sessions = []) {
    loading.value = true;
    try {
      let id = eventData.id;
      if (id) {
        await updateDocById('events', id, eventData);
      } else {
        id = await createDoc('events', {
          ...eventData,
          currentConfirmedCount: 0
        });
      }
      // 處理場次子集合
      if (sessions && sessions.length > 0) {
        await batchWriteItems(`events/${id}/sessions`, sessions);
      }
      return id;
    } finally {
      loading.value = false;
    }
  }

  async function deleteEvent(id) {
    loading.value = true;
    try {
      await deleteDocById('events', id);
      events.value = events.value.filter(e => e.id !== id);
    } finally {
      loading.value = false;
    }
  }

  async function duplicateEvent(id) {
    const original = await fetchEventById(id);
    if (!original) throw new Error("找不到活動");
    const copyData = {
      ...original,
      title: original.title + ' (複製草稿)',
      status: '草稿',
      currentConfirmedCount: 0
    };
    delete copyData.id;
    return await saveEvent(copyData, original.sessions || []);
  }

  return {
    events,
    currentEvent,
    loading,
    fetchPublishedEvents,
    fetchAllEvents,
    fetchEventById,
    saveEvent,
    deleteEvent,
    duplicateEvent
  };
});

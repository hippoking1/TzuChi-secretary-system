import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getCollectionDocs, getDocById, createDoc, updateDocById, deleteDocById, batchWriteItems } from '@/firebase/db';

export const useMeetingsStore = defineStore('meetings', () => {
  const meetings = ref([]);
  const currentMeeting = ref(null);
  const participants = ref([]);
  const loading = ref(false);

  async function fetchMeetings() {
    loading.value = true;
    try {
      meetings.value = await getCollectionDocs('meetings');
      return meetings.value;
    } finally {
      loading.value = false;
    }
  }

  async function fetchMeetingById(id) {
    loading.value = true;
    try {
      const m = await getDocById('meetings', id);
      if (m) {
        participants.value = await getCollectionDocs(`meetings/${id}/participants`);
        m.participants = participants.value;
      }
      currentMeeting.value = m;
      return m;
    } finally {
      loading.value = false;
    }
  }

  async function saveMeeting(meetingData) {
    if (meetingData.id) {
      await updateDocById('meetings', meetingData.id, meetingData);
      return meetingData.id;
    } else {
      return await createDoc('meetings', meetingData);
    }
  }

  async function deleteMeeting(id) {
    await deleteDocById('meetings', id);
    meetings.value = meetings.value.filter(m => m.id !== id);
  }

  async function addParticipants(meetingId, memberList) {
    const formatted = memberList.map(m => ({
      memberId: m.id,
      memberName: m.name,
      memberPhone: m.phone || '',
      cadreRoles: m.cadreRoles || m.positions || [],
      orgPath: m.orgPath || '',
      attendance: '未回覆',
      note: ''
    }));
    await batchWriteItems(`meetings/${meetingId}/participants`, formatted);
    await fetchMeetingById(meetingId);
  }

  async function removeParticipant(meetingId, pId) {
    await deleteDocById(`meetings/${meetingId}/participants`, pId);
    participants.value = participants.value.filter(p => p.id !== pId);
  }

  async function updateAttendance(meetingId, pId, attendance, note = '') {
    await updateDocById(`meetings/${meetingId}/participants`, pId, { attendance, note });
    participants.value = participants.value.map(p => p.id === pId ? { ...p, attendance, note } : p);
  }

  return {
    meetings,
    currentMeeting,
    participants,
    loading,
    fetchMeetings,
    fetchMeetingById,
    saveMeeting,
    deleteMeeting,
    addParticipants,
    removeParticipant,
    updateAttendance
  };
});

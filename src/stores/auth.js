import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { loginUser, logoutUser, subscribeAuthState } from '@/firebase/auth';

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null);
  const profile = ref(null);
  const loading = ref(true);

  const isAuthenticated = computed(() => !!user.value);
  const role = computed(() => profile.value?.role || 'guest');
  const isSuperAdmin = computed(() => role.value === 'super_admin');
  const isAdmin = computed(() => role.value === 'super_admin' || role.value === 'admin');
  const isConvener = computed(() => ['super_admin', 'admin', 'convener'].includes(role.value));

  // 模組功能細緻化權限判定
  function hasPermission(moduleKey) {
    if (!isAuthenticated.value) return false;
    if (isSuperAdmin.value) return true;

    const userPerms = profile.value?.permissions;
    if (Array.isArray(userPerms) && userPerms.length > 0) {
      return userPerms.includes(moduleKey);
    }

    // 既有舊帳號預設降級相容邏輯
    if (role.value === 'admin') {
      return ['events', 'duty', 'members', 'export'].includes(moduleKey);
    }
    if (role.value === 'convener') {
      return moduleKey === 'meetings';
    }
    return false;
  }

  const canAccessEvents = computed(() => hasPermission('events'));
  const canAccessMeetings = computed(() => hasPermission('meetings'));
  const canAccessDuty = computed(() => hasPermission('duty'));
  const canAccessMembers = computed(() => hasPermission('members'));
  const canAccessExport = computed(() => hasPermission('export'));

  function init() {
    return new Promise((resolve) => {
      subscribeAuthState((currentUser, currentProfile) => {
        user.value = currentUser;
        profile.value = currentProfile;
        loading.value = false;
        resolve(currentUser);
      });
    });
  }

  async function login(email, password) {
    loading.value = true;
    try {
      const result = await loginUser(email, password);
      user.value = result.user;
      profile.value = result.profile;
      return result;
    } finally {
      loading.value = false;
    }
  }

  async function logout() {
    await logoutUser();
    user.value = null;
    profile.value = null;
  }

  return {
    user,
    profile,
    role,
    loading,
    isAuthenticated,
    isSuperAdmin,
    isAdmin,
    isConvener,
    hasPermission,
    canAccessEvents,
    canAccessMeetings,
    canAccessDuty,
    canAccessMembers,
    canAccessExport,
    init,
    login,
    logout
  };
});

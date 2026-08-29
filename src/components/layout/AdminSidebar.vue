<template>
  <aside class="admin-sidebar">
    <div class="sidebar-user-card mb-4">
      <div class="flex items-center justify-between">
        <div class="user-role-badge" :class="'role-' + authStore.role">
          {{ roleTitle }}
        </div>
        <button v-if="isMobile" class="btn-drawer-close" @click="$emit('close')">
          ✕
        </button>
      </div>
      <div class="user-email text-xs text-muted mt-2">
        {{ authStore.user?.email || '已登入管理端' }}
      </div>
    </div>

    <nav class="sidebar-nav">
      <!-- 核心概況 (全體可見) -->
      <div class="nav-section">
        <span class="nav-section-title">核心概況</span>
        <router-link to="/admin" class="nav-item" active-class="active" exact @click="$emit('close')">
          <span>📊 總覽儀表板</span>
        </router-link>
      </div>

      <!-- 1. 活動管理模組 -->
      <div v-if="authStore.canAccessEvents" class="nav-section">
        <span class="nav-section-title">活動管理</span>
        <router-link to="/admin/events" class="nav-item" active-class="active" @click="$emit('close')">
          <span>📋 活動列表與發佈</span>
        </router-link>
        <router-link to="/admin/events/new" class="nav-item" active-class="active" @click="$emit('close')">
          <span>➕ 建立新活動</span>
        </router-link>
        <router-link to="/admin/registrations" class="nav-item" active-class="active" @click="$emit('close')">
          <span>👥 報名名單管理</span>
        </router-link>
        <router-link to="/admin/checkin" class="nav-item" active-class="active" @click="$emit('close')">
          <span>✅ 現場簽到點名</span>
        </router-link>
      </div>

      <!-- 2. 會議管理模組 -->
      <div v-if="authStore.canAccessMeetings" class="nav-section">
        <span class="nav-section-title">會議管理</span>
        <router-link to="/admin/meetings" class="nav-item" active-class="active" @click="$emit('close')">
          <span>📅 會議列表與名單</span>
        </router-link>
        <router-link to="/admin/meetings/new" class="nav-item" active-class="active" @click="$emit('close')">
          <span>➕ 發佈新會議</span>
        </router-link>
      </div>

      <!-- 3. 道場值班模組 -->
      <div v-if="authStore.canAccessDuty" class="nav-section">
        <span class="nav-section-title">道場值班</span>
        <router-link to="/admin/duty-schedule" class="nav-item" active-class="active" @click="$emit('close')">
          <span>🗓️ 值班排程月曆</span>
        </router-link>
        <router-link to="/admin/duty-form" class="nav-item" active-class="active" @click="$emit('close')">
          <span>✏️ 月度排班維護</span>
        </router-link>
        <router-link to="/admin/shift-swap-log" class="nav-item" active-class="active" @click="$emit('close')">
          <span>🔄 調班紀錄查詢</span>
        </router-link>
      </div>

      <!-- 4. 組織與志工模組 -->
      <div v-if="authStore.canAccessMembers" class="nav-section">
        <span class="nav-section-title">組織與志工</span>
        <router-link to="/admin/members" class="nav-item" active-class="active" @click="$emit('close')">
          <span>📒 志工名冊維護</span>
        </router-link>
        <router-link to="/admin/positions" class="nav-item" active-class="active" @click="$emit('close')">
          <span>🎖️ 幹部職稱架構</span>
        </router-link>
        <router-link to="/admin/orgs" class="nav-item" active-class="active" @click="$emit('close')">
          <span>🏛️ 組織階層架構</span>
        </router-link>
        <router-link to="/admin/line-bindings" class="nav-item" active-class="active" @click="$emit('close')">
          <span>💬 LINE 綁定管理</span>
        </router-link>
      </div>

      <!-- 5. 報表與系統管理模組 -->
      <div class="nav-section">
        <span class="nav-section-title">報表與系統</span>
        <router-link v-if="authStore.canAccessExport" to="/admin/export" class="nav-item" active-class="active" @click="$emit('close')">
          <span>📥 匯出與備份中心</span>
        </router-link>
        <router-link v-if="authStore.isSuperAdmin" to="/admin/users" class="nav-item" active-class="active" @click="$emit('close')">
          <span>🔐 權限與管理員帳號</span>
        </router-link>
      </div>
    </nav>
  </aside>
</template>

<script setup>
import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth';

defineProps({
  isMobile: { type: Boolean, default: false }
});
defineEmits(['close']);

const authStore = useAuthStore();

const roleTitle = computed(() => {
  if (authStore.role === 'super_admin') return '🌟 超級管理員';
  if (authStore.role === 'admin') return '🛡️ 一般管理員';
  if (authStore.role === 'convener') return '📢 會議召集人';
  return '志工幹部';
});
</script>

<style scoped>
.admin-sidebar {
  width: 240px;
  background: #ffffff;
  border-right: 1px solid var(--gray-200);
  min-height: calc(100vh - 70px);
  padding: 1.5rem 1rem;
}

.sidebar-user-card {
  background: var(--gray-50);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-md);
  padding: 0.85rem;
}

.user-role-badge {
  display: inline-block;
  font-size: 0.8rem;
  font-weight: 700;
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-sm);
}
.role-super_admin { background: #fef3c7; color: #92400e; }
.role-admin { background: var(--primary-100); color: var(--primary-800); }
.role-convener { background: var(--secondary-100); color: var(--secondary-800); }

.nav-section {
  margin-bottom: 1.25rem;
}

.nav-section-title {
  display: block;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--gray-400);
  margin-bottom: 0.4rem;
  padding-left: 0.5rem;
}

.nav-item {
  display: flex;
  align-items: center;
  padding: 0.6rem 0.75rem;
  border-radius: var(--radius-md);
  color: var(--gray-700);
  font-weight: 500;
  font-size: 0.9rem;
  margin-bottom: 0.2rem;
  transition: all 0.2s;
  text-decoration: none;
}

.nav-item:hover {
  background: var(--gray-100);
  color: var(--primary-500);
}

.nav-item.active {
  background: var(--primary-500);
  color: #ffffff;
  font-weight: 600;
}

.btn-drawer-close {
  background: none;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  color: var(--gray-500);
  padding: 0.2rem;
}
</style>

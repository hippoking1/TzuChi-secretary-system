<template>
  <div class="admin-layout flex flex-col md:flex-row">
    <!-- 手機端專屬頂部導航列 (<= 992px 顯示) -->
    <div class="mobile-admin-bar md:hidden flex items-center justify-between p-3 bg-white border-b sticky top-0 z-30">
      <button class="btn btn-sm btn-outline flex items-center gap-1" @click="showMobileDrawer = true">
        <span class="text-base">☰</span>
        <span class="font-bold text-xs">後台選單</span>
      </button>

      <span class="text-xs font-bold text-primary truncate max-w-[160px]">
        {{ currentPageTitle }}
      </span>

      <span class="user-role-badge-sm" :class="'role-' + authStore.role">
        {{ roleShortTitle }}
      </span>
    </div>

    <!-- 手機端滑動快捷功能條 (Swipeable Pills) -->
    <div class="mobile-quick-pills md:hidden bg-gray-50 border-b px-3 py-2 flex items-center gap-2 overflow-x-auto whitespace-nowrap">
      <router-link to="/admin" class="pill-item" active-class="active" exact>📊 總覽</router-link>
      <router-link to="/admin/events" class="pill-item" active-class="active">📋 活動</router-link>
      <router-link to="/admin/registrations" class="pill-item" active-class="active">👥 名單</router-link>
      <router-link to="/admin/checkin" class="pill-item" active-class="active">✅ 簽到</router-link>
      <router-link to="/admin/meetings" class="pill-item" active-class="active">📅 會議</router-link>
      <router-link v-if="authStore.isAdmin" to="/admin/duty-schedule" class="pill-item" active-class="active">🗓️ 值班</router-link>
      <router-link v-if="authStore.isAdmin" to="/admin/duty-form" class="pill-item" active-class="active">✏️ 排班</router-link>
      <router-link v-if="authStore.isAdmin" to="/admin/members" class="pill-item" active-class="active">📒 志工</router-link>
      <router-link v-if="authStore.isAdmin" to="/admin/line-bindings" class="pill-item" active-class="active">💬 LINE</router-link>
      <router-link to="/admin/export" class="pill-item" active-class="active">📥 匯出</router-link>
    </div>

    <!-- 電腦端靜態側邊欄 (> 992px 顯示) -->
    <AdminSidebar class="admin-layout-sidebar hidden md:block" />

    <!-- 手機端側邊抽屜 (Mobile Off-canvas Drawer) -->
    <div v-if="showMobileDrawer" class="mobile-drawer-backdrop md:hidden" @click="showMobileDrawer = false">
      <div class="mobile-drawer-content" @click.stop>
        <AdminSidebar :is-mobile="true" @close="showMobileDrawer = false" />
      </div>
    </div>

    <!-- 主要內容區 -->
    <main class="admin-main flex-1 p-4 md:p-6 w-full overflow-x-hidden">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import AdminSidebar from './AdminSidebar.vue';

const route = useRoute();
const authStore = useAuthStore();
const showMobileDrawer = ref(false);

const roleShortTitle = computed(() => {
  if (authStore.role === 'super_admin') return '超管';
  if (authStore.role === 'admin') return '管理員';
  if (authStore.role === 'convener') return '召集人';
  return '幹部';
});

const pageTitleMap = {
  '/admin': '📊 總覽儀表板',
  '/admin/events': '📋 活動列表',
  '/admin/events/new': '➕ 建立新活動',
  '/admin/registrations': '👥 報名名單管理',
  '/admin/checkin': '✅ 現場簽到點名',
  '/admin/meetings': '📅 會議列表',
  '/admin/meetings/new': '➕ 發佈新會議',
  '/admin/duty-schedule': '🗓️ 值班排程月曆',
  '/admin/duty-form': '✏️ 月度排班維護',
  '/admin/members': '📒 志工名冊維護',
  '/admin/orgs': '🏛️ 組織階層架構',
  '/admin/line-bindings': '💬 LINE 綁定管理',
  '/admin/export': '📥 匯出與備份',
  '/admin/users': '🔐 管理員權限'
};

const currentPageTitle = computed(() => {
  return pageTitleMap[route.path] || '後台管理系統';
});
</script>

<style scoped>
.admin-layout {
  min-height: calc(100vh - 70px);
  background: var(--gray-50);
}
.admin-main {
  max-width: 1300px;
  margin: 0 auto;
}

/* 快捷滑動藥丸按鈕 (Pills) */
.mobile-quick-pills {
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}
.mobile-quick-pills::-webkit-scrollbar { display: none; }
.pill-item {
  font-size: 0.78rem;
  font-weight: 600;
  padding: 0.3rem 0.65rem;
  border-radius: 9999px;
  background: #ffffff;
  border: 1px solid var(--gray-200);
  color: var(--gray-700);
  text-decoration: none;
}
.pill-item.active {
  background: var(--primary-500);
  color: #ffffff;
  border-color: var(--primary-500);
}

.user-role-badge-sm {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.15rem 0.4rem;
  border-radius: var(--radius-sm);
}
.role-super_admin { background: #fef3c7; color: #92400e; }
.role-admin { background: var(--primary-100); color: var(--primary-800); }
.role-convener { background: var(--secondary-100); color: var(--secondary-800); }

/* 手機端側滑抽屜 */
.mobile-drawer-backdrop {
  position: fixed;
  top: 0; left: 0; width: 100vw; height: 100vh;
  background: rgba(15, 23, 42, 0.6);
  z-index: 9999;
  display: flex;
}
.mobile-drawer-content {
  width: 270px;
  max-width: 80vw;
  height: 100%;
  background: #ffffff;
  box-shadow: var(--shadow-lg);
  overflow-y: auto;
}

@media (min-width: 993px) {
  .md\:hidden { display: none !important; }
  .md\:block { display: block !important; }
  .md\:flex-row { flex-direction: row !important; }
}
@media (max-width: 992px) {
  .hidden.md\:block { display: none !important; }
  .admin-layout-sidebar { display: none !important; }
}
</style>

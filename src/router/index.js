import { createRouter, createWebHashHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

// Public Views
import HomeView from '@/views/public/HomeView.vue';
import EventDetailView from '@/views/public/EventDetailView.vue';
import RegisterView from '@/views/public/RegisterView.vue';
import MyRegistrationsView from '@/views/public/MyRegistrationsView.vue';
import DutySearchView from '@/views/public/DutySearchView.vue';
import LoginView from '@/views/public/LoginView.vue';

// Admin Views
import AdminLayout from '@/components/layout/AdminLayout.vue';
import DashboardView from '@/views/admin/DashboardView.vue';
import EventsView from '@/views/admin/EventsView.vue';
import EventFormView from '@/views/admin/EventFormView.vue';
import RegistrationsView from '@/views/admin/RegistrationsView.vue';
import CheckInView from '@/views/admin/CheckInView.vue';
import MeetingsView from '@/views/admin/MeetingsView.vue';
import MeetingFormView from '@/views/admin/MeetingFormView.vue';
import DutyScheduleView from '@/views/admin/DutyScheduleView.vue';
import DutyFormView from '@/views/admin/DutyFormView.vue';
import MembersView from '@/views/admin/MembersView.vue';
import OrgsView from '@/views/admin/OrgsView.vue';
import LineBindingView from '@/views/admin/LineBindingView.vue';
import PositionsView from '@/views/admin/PositionsView.vue';
import ExportView from '@/views/admin/ExportView.vue';
import AdminUsersView from '@/views/admin/AdminUsersView.vue';

const routes = [
  { path: '/', name: 'home', component: HomeView },
  { path: '/event/:id', name: 'event-detail', component: EventDetailView },
  { path: '/register/:id', name: 'register', component: RegisterView },
  { path: '/my', name: 'my-registrations', component: MyRegistrationsView },
  { path: '/duty-search', name: 'duty-search', component: DutySearchView },
  { path: '/login', name: 'login', component: LoginView },

  // 後台管理巢狀路由 (支援 RBAC 角色守衛)
  {
    path: '/admin',
    component: AdminLayout,
    meta: { requiresAuth: true },
    children: [
      { path: '', name: 'admin-dashboard', component: DashboardView },
      
      // 活動管理模組
      { path: 'events', name: 'admin-events', component: EventsView, meta: { permission: 'events' } },
      { path: 'events/new', name: 'admin-event-new', component: EventFormView, meta: { permission: 'events' } },
      { path: 'events/edit/:id', name: 'admin-event-edit', component: EventFormView, meta: { permission: 'events' } },
      { path: 'registrations', name: 'admin-registrations', component: RegistrationsView, meta: { permission: 'events' } },
      { path: 'checkin', name: 'admin-checkin', component: CheckInView, meta: { permission: 'events' } },
      
      // 會議管理模組
      { path: 'meetings', name: 'admin-meetings', component: MeetingsView, meta: { permission: 'meetings' } },
      { path: 'meetings/new', name: 'admin-meeting-new', component: MeetingFormView, meta: { permission: 'meetings' } },
      { path: 'meetings/edit/:id', name: 'admin-meeting-edit', component: MeetingFormView, meta: { permission: 'meetings' } },
      
      // 道場值班管理模組
      { path: 'duty-schedule', name: 'admin-duty-schedule', component: DutyScheduleView, meta: { permission: 'duty' } },
      { path: 'duty-form', name: 'admin-duty-form', component: DutyFormView, meta: { permission: 'duty' } },
      
      // 組織與志工管理模組
      { path: 'members', name: 'admin-members', component: MembersView, meta: { permission: 'members' } },
      { path: 'positions', name: 'admin-positions', component: PositionsView, meta: { permission: 'members' } },
      { path: 'orgs', name: 'admin-orgs', component: OrgsView, meta: { permission: 'members' } },
      { path: 'line-bindings', name: 'admin-line-bindings', component: LineBindingView, meta: { permission: 'members' } },
      
      // 報表與系統模組
      { path: 'export', name: 'admin-export', component: ExportView, meta: { permission: 'export' } },
      { path: 'users', name: 'admin-users', component: AdminUsersView, meta: { roles: ['super_admin'] } }
    ]
  },
  { path: '/:pathMatch(.*)*', redirect: '/' }
];

const router = createRouter({
  history: createWebHashHistory(), // Hash mode 適配 GitHub Pages 靜態環境
  routes,
  scrollBehavior() {
    return { top: 0 };
  }
});

// RBAC 與功能模組權限導航守衛
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();
  
  if (authStore.loading) {
    await authStore.init();
  }

  if (to.matched.some(record => record.meta.requiresAuth)) {
    if (!authStore.isAuthenticated) {
      next({ path: '/login', query: { redirect: to.fullPath } });
      return;
    }

    // 超級管理員專屬路徑檢查
    const requiredRoles = to.meta.roles;
    if (requiredRoles && !requiredRoles.includes(authStore.role)) {
      alert('您的角色無權存取此頁面（僅限超級管理員）');
      next({ path: '/admin' });
      return;
    }

    // 細緻化功能模組權限檢查
    const requiredPerm = to.meta.permission;
    if (requiredPerm && !authStore.hasPermission(requiredPerm)) {
      alert('您的帳號未獲授權存取此功能模組，請洽超級管理員設定權限。');
      next({ path: '/admin' });
      return;
    }
  }

  next();
});

export default router;

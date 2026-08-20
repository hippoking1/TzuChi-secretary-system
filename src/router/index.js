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
      { path: 'events', name: 'admin-events', component: EventsView },
      { path: 'events/new', name: 'admin-event-new', component: EventFormView },
      { path: 'events/edit/:id', name: 'admin-event-edit', component: EventFormView },
      { path: 'registrations', name: 'admin-registrations', component: RegistrationsView },
      { path: 'checkin', name: 'admin-checkin', component: CheckInView },
      { path: 'meetings', name: 'admin-meetings', component: MeetingsView },
      { path: 'meetings/new', name: 'admin-meeting-new', component: MeetingFormView },
      { path: 'meetings/edit/:id', name: 'admin-meeting-edit', component: MeetingFormView },
      { path: 'duty-schedule', name: 'admin-duty-schedule', component: DutyScheduleView, meta: { roles: ['super_admin', 'admin'] } },
      { path: 'duty-form', name: 'admin-duty-form', component: DutyFormView, meta: { roles: ['super_admin', 'admin'] } },
      { path: 'members', name: 'admin-members', component: MembersView, meta: { roles: ['super_admin', 'admin'] } },
      { path: 'orgs', name: 'admin-orgs', component: OrgsView, meta: { roles: ['super_admin', 'admin'] } },
      { path: 'line-bindings', name: 'admin-line-bindings', component: LineBindingView, meta: { roles: ['super_admin', 'admin'] } },
      { path: 'export', name: 'admin-export', component: ExportView },
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

// RBAC 路由導航守衛
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

    const requiredRoles = to.meta.roles;
    if (requiredRoles && !requiredRoles.includes(authStore.role)) {
      alert('您的權限不足以存取此頁面');
      next({ path: '/admin' });
      return;
    }
  }

  next();
});

export default router;

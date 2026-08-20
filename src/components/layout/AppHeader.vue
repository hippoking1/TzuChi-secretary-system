<template>
  <header class="app-header">
    <div class="container flex items-center justify-between">
      <router-link to="/" class="logo-group">
        <span class="logo-symbol">慈</span>
        <div class="logo-text">
          <span class="logo-title">慈濟小祕書系統</span>
          <span class="logo-subtitle">社區志工與道場服務平台</span>
        </div>
      </router-link>

      <nav class="nav-links flex items-center gap-4">
        <router-link to="/" class="nav-link" active-class="active">活動總覽</router-link>
        <router-link to="/my" class="nav-link" active-class="active">報名查詢</router-link>
        <router-link to="/duty-search" class="nav-link" active-class="active">個人值班</router-link>
        
        <div v-if="authStore.isAuthenticated" class="user-action flex items-center gap-2">
          <router-link to="/admin" class="btn btn-sm btn-primary">
            後台管理 ({{ roleLabel }})
          </router-link>
          <button class="btn btn-sm btn-outline" @click="handleLogout">登出</button>
        </div>
        <router-link v-else to="/login" class="btn btn-sm btn-outline-primary">
          管理員登入
        </router-link>
      </nav>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();
const router = useRouter();

const roleLabel = computed(() => {
  if (authStore.role === 'super_admin') return '超級管理員';
  if (authStore.role === 'admin') return '管理員';
  if (authStore.role === 'convener') return '召集人';
  return '幹部';
});

async function handleLogout() {
  await authStore.logout();
  router.push('/');
}
</script>

<style scoped>
.app-header {
  background: #ffffff;
  border-bottom: 1px solid var(--gray-200);
  box-shadow: var(--shadow-sm);
  position: sticky;
  top: 0;
  z-index: 500;
  padding: 0.75rem 0;
}

.logo-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.logo-symbol {
  width: 38px;
  height: 38px;
  background: var(--primary-500);
  color: #ffffff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1.2rem;
}

.logo-text {
  display: flex;
  flex-direction: column;
}

.logo-title {
  font-weight: 700;
  font-size: 1.15rem;
  color: var(--primary-900);
  line-height: 1.2;
}

.logo-subtitle {
  font-size: 0.75rem;
  color: var(--gray-500);
}

.nav-link {
  font-weight: 600;
  color: var(--gray-600);
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-sm);
  transition: all 0.2s;
}

.nav-link:hover, .nav-link.active {
  color: var(--primary-500);
  background: var(--primary-50);
}

@media (max-width: 768px) {
  .logo-subtitle { display: none; }
  .nav-links { gap: 0.25rem; }
  .nav-link { font-size: 0.85rem; padding: 0.25rem 0.5rem; }
}
</style>

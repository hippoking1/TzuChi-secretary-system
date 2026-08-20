<template>
  <div class="login-view container flex items-center justify-center" style="min-height: 70vh;">
    <div class="card login-card">
      <div class="text-center mb-6">
        <div class="logo-symbol mx-auto mb-3">慈</div>
        <h2 class="text-xl font-bold">管理員 / 召集人登入</h2>
        <p class="text-sm text-muted">請使用授權帳號與密碼進行驗證</p>
      </div>

      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label class="form-label required">電子郵件 / 帳號</label>
          <input v-model="email" type="email" class="form-input" placeholder="admin@tzuchi.org" required />
        </div>

        <div class="form-group">
          <label class="form-label required">密碼</label>
          <input v-model="password" type="password" class="form-input" placeholder="請輸入密碼" required />
        </div>

        <button type="submit" class="btn btn-primary btn-block btn-lg mt-4" :disabled="loading">
          {{ loading ? '驗證中...' : '登入後台' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';

const authStore = useAuthStore();
const router = useRouter();
const toast = useToast();

const email = ref('');
const password = ref('');
const loading = ref(false);

async function handleLogin() {
  loading.value = true;
  try {
    await authStore.login(email.value, password.value);
    toast.success('登入成功！');
    router.push('/admin');
  } catch (err) {
    toast.error('登入失敗：' + err.message);
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-card {
  max-width: 420px;
  width: 100%;
  padding: 2.5rem;
}
.logo-symbol {
  width: 48px;
  height: 48px;
  background: var(--primary-500);
  color: #ffffff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1.5rem;
  margin-left: auto;
  margin-right: auto;
}
.btn-block { width: 100%; }
</style>

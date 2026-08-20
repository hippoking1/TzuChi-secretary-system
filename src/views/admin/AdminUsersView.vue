<template>
  <div class="admin-users-view">
    <div class="flex items-center justify-between mb-6 flex-wrap gap-4">
      <div>
        <h1 class="text-2xl font-bold">權限與管理員帳號 (RBAC)</h1>
        <p class="text-sm text-muted">僅超級管理員可管理各角色帳號（建立登入密碼、指派超級管理員 / 一般管理員 / 召集人）</p>
      </div>
      <button class="btn btn-primary" @click="openCreateModal">➕ 新增管理帳號</button>
    </div>

    <div class="card table-responsive">
      <table class="table">
        <thead>
          <tr>
            <th>管理員姓名</th>
            <th>登入電子郵件</th>
            <th>權限角色</th>
            <th>建立時間</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="users.length === 0">
            <td colspan="5" class="text-center text-muted p-4">目前尚無其他管理員帳號</td>
          </tr>
          <tr v-for="u in users" :key="u.id">
            <td class="font-bold text-gray-900">{{ u.name }}</td>
            <td>{{ u.email }}</td>
            <td>
              <span class="badge" :class="'role-' + u.role">
                {{ getRoleLabel(u.role) }}
              </span>
            </td>
            <td>{{ formatDate(u.createdAt) }}</td>
            <td>
              <div class="flex gap-2">
                <button class="btn btn-sm btn-outline-primary" @click="openPasswordReset(u)">
                  🔑 重設密碼
                </button>
                <button class="btn btn-sm btn-danger" @click="handleDelete(u.id, u.email)">
                  刪除
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 新增管理員 Modal (包含密碼設定) -->
    <div v-if="showCreateModal" class="modal-backdrop" @click="showCreateModal = false">
      <div class="modal-content" style="max-width: 520px;" @click.stop>
        <div class="modal-header">
          <h3 class="modal-title">新增管理員帳號與設定密碼</h3>
          <button class="modal-close" @click="showCreateModal = false">×</button>
        </div>
        <form @submit.prevent="handleCreate">
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label required">管理員姓名</label>
              <input v-model="form.name" type="text" class="form-input" placeholder="例如：陳大明" required />
            </div>

            <div class="form-group">
              <label class="form-label required">登入電子郵件 (Email)</label>
              <input v-model="form.email" type="email" class="form-input" placeholder="例如：admin@tzuchi.org.tw" required />
            </div>

            <div class="form-group">
              <label class="form-label required">登入密碼 (至少 6 位字元)</label>
              <input 
                v-model="form.password" 
                type="password" 
                class="form-input" 
                placeholder="請輸入至少 6 位字元密碼" 
                minlength="6" 
                required 
              />
            </div>

            <div class="form-group">
              <label class="form-label required">確認密碼</label>
              <input 
                v-model="form.confirmPassword" 
                type="password" 
                class="form-input" 
                placeholder="請再次輸入密碼" 
                minlength="6" 
                required 
              />
            </div>

            <div class="form-group">
              <label class="form-label required">角色分級</label>
              <select v-model="form.role" class="form-select">
                <option value="super_admin">🌟 超級管理員 (全部權限 + 帳號管理)</option>
                <option value="admin">🛡️ 一般管理員 (活動、排班、志工名冊)</option>
                <option value="convener">📢 會議召集人 (僅會議發佈與出席名單)</option>
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" @click="showCreateModal = false">取消</button>
            <button type="submit" class="btn btn-primary" :disabled="creating">
              {{ creating ? '建立帳號中...' : '確認建立帳號' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- 重設密碼 Modal -->
    <div v-if="showResetModal" class="modal-backdrop" @click="showResetModal = false">
      <div class="modal-content" style="max-width: 480px;" @click.stop>
        <div class="modal-header">
          <h3 class="modal-title">發送重設密碼信件</h3>
          <button class="modal-close" @click="showResetModal = false">×</button>
        </div>
        <div class="modal-body">
          <p class="text-sm text-gray-700 mb-4">
            確定要向 <strong>{{ selectedUser?.email }}</strong> 發送官方密碼重設連結嗎？
            該管理員可透過 Email 連結自行設定新密碼。
          </p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline" @click="showResetModal = false">取消</button>
          <button type="button" class="btn btn-primary" :disabled="resetting" @click="sendPasswordResetLink">
            {{ resetting ? '發送中...' : '發送重設信件' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { getCollectionDocs, setDocWithId, deleteDocById } from '@/firebase/db';
import { auth, firebaseConfig } from '@/firebase/config';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { useToast } from '@/composables/useToast';

const toast = useToast();
const users = ref([]);
const showCreateModal = ref(false);
const showResetModal = ref(false);
const creating = ref(false);
const resetting = ref(false);
const selectedUser = ref(null);

const form = ref({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: 'admin'
});

function formatDate(val) {
  if (!val) return '-';
  try {
    const d = val.toDate ? val.toDate() : new Date(val);
    return d.toLocaleDateString('zh-TW');
  } catch {
    return '-';
  }
}

function getRoleLabel(role) {
  if (role === 'super_admin') return '🌟 超級管理員';
  if (role === 'admin') return '🛡️ 一般管理員';
  if (role === 'convener') return '📢 召集人';
  return role;
}

function openCreateModal() {
  form.value = {
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'admin'
  };
  showCreateModal.value = true;
}

function openPasswordReset(user) {
  selectedUser.value = user;
  showResetModal.value = true;
}

async function loadUsers() {
  users.value = await getCollectionDocs('adminUsers');
}

// 透過 Secondary App 在 Auth 中建立帳號，確保不中斷當前管理者登入狀態
async function handleCreate() {
  if (form.value.password !== form.value.confirmPassword) {
    toast.error('兩次輸入的密碼不一致，請重新檢查');
    return;
  }
  if (form.value.password.length < 6) {
    toast.error('密碼長度至少需 6 個字元');
    return;
  }

  creating.value = true;
  let secondaryApp = null;
  try {
    // 建立臨時 Firebase 實例完成帳號註冊
    const appName = 'SecondaryAuth_' + Date.now();
    secondaryApp = initializeApp(firebaseConfig, appName);
    const secondaryAuth = getAuth(secondaryApp);

    const cred = await createUserWithEmailAndPassword(
      secondaryAuth,
      form.value.email.trim(),
      form.value.password
    );

    // 同步將角色與資訊寫入 Firestore adminUsers 集合 (以 uid 為主鍵)
    await setDocWithId('adminUsers', cred.user.uid, {
      name: form.value.name.trim(),
      email: form.value.email.trim().toLowerCase(),
      role: form.value.role,
      uid: cred.user.uid,
      createdAt: new Date().toISOString()
    });

    toast.success(`管理員「${form.value.name}」帳號已成功建立，已可使用該密碼登入！`);
    showCreateModal.value = false;
    await loadUsers();
  } catch (err) {
    let msg = err.message;
    if (err.code === 'auth/email-already-in-use') {
      msg = '此電子郵件已被註冊，請更換或直接調整權限。';
    } else if (err.code === 'auth/invalid-email') {
      msg = '電子郵件格式不正確。';
    } else if (err.code === 'auth/weak-password') {
      msg = '密碼強度不足（需至少 6 碼）。';
    }
    toast.error('建立帳號失敗：' + msg);
  } finally {
    if (secondaryApp) {
      await deleteApp(secondaryApp).catch(() => {});
    }
    creating.value = false;
  }
}

async function sendPasswordResetLink() {
  if (!selectedUser.value?.email) return;
  resetting.value = true;
  try {
    await sendPasswordResetEmail(auth, selectedUser.value.email);
    toast.success(`密碼重設信件已成功寄送至 ${selectedUser.value.email}！`);
    showResetModal.value = false;
  } catch (err) {
    toast.error('發送重設信件失敗：' + err.message);
  } finally {
    resetting.value = false;
  }
}

async function handleDelete(id, email) {
  if (!confirm(`確定要刪除管理員「${email}」的權限嗎？`)) return;
  try {
    await deleteDocById('adminUsers', id);
    toast.success('管理員權限已移除');
    await loadUsers();
  } catch (err) {
    toast.error('刪除失敗：' + err.message);
  }
}

onMounted(() => {
  loadUsers();
});
</script>

<style scoped>
.modal-backdrop {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  background: rgba(15, 23, 42, 0.6); display: flex; align-items: center; justify-content: center; z-index: 9990;
}
.modal-content { background: #ffffff; border-radius: var(--radius-lg); width: 90%; }
.modal-header { padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--gray-200); display: flex; justify-content: space-between; align-items: center; }
.modal-body { padding: 1.5rem; }
.modal-footer { padding: 1rem 1.5rem; display: flex; justify-content: flex-end; gap: 0.5rem; background: var(--gray-50); border-top: 1px solid var(--gray-200); }
.modal-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; }
.role-super_admin { background: #fef3c7; color: #92400e; font-weight: 700; }
.role-admin { background: var(--primary-100); color: var(--primary-800); font-weight: 700; }
.role-convener { background: var(--secondary-100); color: var(--secondary-800); font-weight: 700; }
</style>

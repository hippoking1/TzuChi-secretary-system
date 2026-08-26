<template>
  <div class="admin-users-view">
    <div class="flex items-center justify-between mb-6 flex-wrap gap-4">
      <div>
        <h1 class="text-2xl font-bold">權限與管理員帳號 (RBAC)</h1>
        <p class="text-sm text-muted">僅超級管理員可管理各角色帳號（建立登入密碼、指派超級管理員 / 一般管理員 / 召集人）</p>
      </div>
      <button class="btn btn-primary" @click="openCreateModal">➕ 新增管理帳號</button>
    </div>

    <!-- 管理員清單 Table -->
    <div class="card table-responsive">
      <table class="table">
        <thead>
          <tr>
            <th>管理員姓名</th>
            <th>登入電子郵件</th>
            <th>身分角色</th>
            <th>已授權功能模組</th>
            <th>建立時間</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="users.length === 0">
            <td colspan="6" class="text-center text-muted p-4">目前尚無其他管理員帳號</td>
          </tr>
          <tr v-for="u in users" :key="u.id">
            <td class="font-bold text-gray-900">{{ u.name }}</td>
            <td>{{ u.email }}</td>
            <td>
              <span class="badge" :class="'role-' + u.role">
                {{ getRoleLabel(u.role) }}
              </span>
            </td>
            <td>
              <!-- 若為超級管理員顯示全部 -->
              <div v-if="u.role === 'super_admin'" class="flex gap-1 flex-wrap">
                <span class="badge badge-success text-xs">🌟 全部模組權限</span>
              </div>
              <!-- 一般管理員顯示細項標籤 -->
              <div v-else class="flex gap-1 flex-wrap">
                <span 
                  v-for="mod in ALL_MODULES" 
                  :key="mod.key" 
                  class="badge text-xs"
                  :class="hasUserPerm(u, mod.key) ? 'badge-primary' : 'badge-gray opacity-40'"
                >
                  {{ hasUserPerm(u, mod.key) ? '✓ ' + mod.label : '✕ ' + mod.label }}
                </span>
              </div>
            </td>
            <td>{{ formatDate(u.createdAt) }}</td>
            <td>
              <div class="flex gap-2 flex-wrap">
                <button class="btn btn-sm btn-outline-primary" @click="openEditModal(u)">
                  ✏️ 編輯權限
                </button>
                <button class="btn btn-sm btn-outline" @click="openPasswordReset(u)">
                  🔑 重設密碼
                </button>
                <button 
                  v-if="u.email !== authStore.user?.email" 
                  class="btn btn-sm btn-danger" 
                  @click="handleDelete(u.id, u.email)"
                >
                  刪除
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 1. 新增管理員 Modal -->
    <div v-if="showCreateModal" class="modal-backdrop" @click="showCreateModal = false">
      <div class="modal-content admin-modal-dialog" @click.stop>
        <div class="modal-header">
          <h3 class="modal-title">➕ 新增管理員帳號與指派權限</h3>
          <button class="modal-close" @click="showCreateModal = false">×</button>
        </div>
        <form @submit.prevent="handleCreate">
          <div class="modal-body">
            <div class="grid grid-cols-2 gap-4">
              <div class="form-group">
                <label class="form-label required">管理員姓名</label>
                <input v-model="form.name" type="text" class="form-input" placeholder="例如：黃志煌" required />
              </div>

              <div class="form-group">
                <label class="form-label required">登入電子郵件 (Email)</label>
                <input v-model="form.email" type="email" class="form-input" placeholder="例如：admin@tzuchi.org.tw" required />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div class="form-group">
                <label class="form-label required">登入密碼 (至少 6 位字元)</label>
                <input 
                  v-model="form.password" 
                  type="password" 
                  class="form-input" 
                  placeholder="輸入登入密碼" 
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
                  placeholder="再次輸入密碼" 
                  minlength="6" 
                  required 
                />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label required font-bold">角色分級</label>
              <select v-model="form.role" class="form-select" @change="onRoleChange(form)">
                <option value="admin">🛡️ 一般管理員 (可自訂指派各功能模組)</option>
                <option value="convener">📢 會議召集人 (預設僅會議發佈與名單)</option>
                <option value="super_admin">🌟 超級管理員 (全功能模組 + 帳號權限管理)</option>
              </select>
            </div>

            <!-- 功能模組權限自由指派 (若非超管) -->
            <div class="permission-group-box mb-2 p-3 bg-gray-50 border border-gray-200 rounded">
              <div class="flex items-center justify-between mb-2">
                <label class="font-bold text-sm text-gray-800">
                  📋 自由指派功能模組權限：
                </label>
                <div v-if="form.role !== 'super_admin'" class="flex gap-2">
                  <button type="button" class="btn btn-xs btn-outline" @click="selectAllPerms(form)">全選</button>
                  <button type="button" class="btn btn-xs btn-outline" @click="clearAllPerms(form)">清空</button>
                </div>
              </div>

              <div v-if="form.role === 'super_admin'" class="text-xs text-primary font-bold p-2 bg-primary-50 rounded">
                ✓ 超級管理員自動享有所有功能模組之最高管理權限
              </div>

              <div v-else class="grid grid-cols-1 gap-2">
                <label 
                  v-for="mod in ALL_MODULES" 
                  :key="mod.key" 
                  class="perm-checkbox-item"
                  :class="{ active: form.permissions.includes(mod.key) }"
                >
                  <input type="checkbox" :value="mod.key" v-model="form.permissions" />
                  <div class="flex-1">
                    <strong class="text-sm block">{{ mod.icon }} {{ mod.label }}</strong>
                    <span class="text-xs text-muted">{{ mod.desc }}</span>
                  </div>
                </label>
              </div>
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

    <!-- 2. 編輯管理員權限 Modal -->
    <div v-if="showEditModal" class="modal-backdrop" @click="showEditModal = false">
      <div class="modal-content admin-modal-dialog" @click.stop>
        <div class="modal-header">
          <div>
            <h3 class="modal-title">✏️ 編輯管理員權限</h3>
            <p class="text-xs text-muted mt-1">{{ editForm.name }} ({{ editForm.email }})</p>
          </div>
          <button class="modal-close" @click="showEditModal = false">×</button>
        </div>
        <form @submit.prevent="handleSaveEdit">
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label required">管理員姓名</label>
              <input v-model="editForm.name" type="text" class="form-input" required />
            </div>

            <div class="form-group">
              <label class="form-label required font-bold">角色分級</label>
              <select v-model="editForm.role" class="form-select" @change="onRoleChange(editForm)">
                <option value="admin">🛡️ 一般管理員 (可自訂指派各功能模組)</option>
                <option value="convener">📢 會議召集人 (預設僅會議發佈與名單)</option>
                <option value="super_admin">🌟 超級管理員 (全功能模組 + 帳號權限管理)</option>
              </select>
            </div>

            <!-- 功能模組權限自由勾選 -->
            <div class="permission-group-box mb-2 p-3 bg-gray-50 border border-gray-200 rounded">
              <div class="flex items-center justify-between mb-2">
                <label class="font-bold text-sm text-gray-800">
                  📋 指派開放之功能模組權限：
                </label>
                <div v-if="editForm.role !== 'super_admin'" class="flex gap-2">
                  <button type="button" class="btn btn-xs btn-outline" @click="selectAllPerms(editForm)">全選</button>
                  <button type="button" class="btn btn-xs btn-outline" @click="clearAllPerms(editForm)">清空</button>
                </div>
              </div>

              <div v-if="editForm.role === 'super_admin'" class="text-xs text-primary font-bold p-2 bg-primary-50 rounded">
                ✓ 超級管理員自動享有系統內所有功能之最高管理權限
              </div>

              <div v-else class="grid grid-cols-1 gap-2">
                <label 
                  v-for="mod in ALL_MODULES" 
                  :key="mod.key" 
                  class="perm-checkbox-item"
                  :class="{ active: editForm.permissions.includes(mod.key) }"
                >
                  <input type="checkbox" :value="mod.key" v-model="editForm.permissions" />
                  <div class="flex-1">
                    <strong class="text-sm block">{{ mod.icon }} {{ mod.label }}</strong>
                    <span class="text-xs text-muted">{{ mod.desc }}</span>
                  </div>
                </label>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" @click="showEditModal = false">取消</button>
            <button type="submit" class="btn btn-primary" :disabled="savingEdit">
              {{ savingEdit ? '儲存中...' : '💾 儲存權限設定' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- 3. 重設密碼 Modal -->
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
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';

const authStore = useAuthStore();
const toast = useToast();
const users = ref([]);

const showCreateModal = ref(false);
const showEditModal = ref(false);
const showResetModal = ref(false);

const creating = ref(false);
const savingEdit = ref(false);
const resetting = ref(false);
const selectedUser = ref(null);

// 5 大功能模組標準定義
const ALL_MODULES = [
  { key: 'events', label: '活動管理', icon: '📋', desc: '活動列表、發佈新活動、報名名單與現場簽到點名' },
  { key: 'meetings', label: '會議管理', icon: '📅', desc: '發佈組隊會議、出席名單管理與一鍵推播開會通知' },
  { key: 'duty', label: '道場值班管理', icon: '🗓️', desc: '道場值班排程月曆檢視與全月值班排班維護' },
  { key: 'members', label: '組織與志工管理', icon: '📒', desc: '志工名冊維護、組織階層架構與 LINE 官方帳號綁定' },
  { key: 'export', label: '報表與系統管理', icon: '📥', desc: '資料匯出至 CSV 與 Google Sheets 雲端備份中心' }
];

const form = ref({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: 'admin',
  permissions: ['events', 'duty', 'members', 'export']
});

const editForm = ref({
  id: '',
  name: '',
  email: '',
  role: 'admin',
  permissions: []
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

function hasUserPerm(user, modKey) {
  if (user.role === 'super_admin') return true;
  if (Array.isArray(user.permissions) && user.permissions.length > 0) {
    return user.permissions.includes(modKey);
  }
  if (user.role === 'admin') return ['events', 'duty', 'members', 'export'].includes(modKey);
  if (user.role === 'convener') return modKey === 'meetings';
  return false;
}

function onRoleChange(target) {
  if (target.role === 'super_admin') {
    target.permissions = ALL_MODULES.map(m => m.key);
  } else if (target.role === 'convener') {
    target.permissions = ['meetings'];
  } else if (target.role === 'admin' && target.permissions.length === 0) {
    target.permissions = ['events', 'duty', 'members', 'export'];
  }
}

function selectAllPerms(target) {
  target.permissions = ALL_MODULES.map(m => m.key);
}

function clearAllPerms(target) {
  target.permissions = [];
}

function openCreateModal() {
  form.value = {
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'admin',
    permissions: ['events', 'duty', 'members', 'export']
  };
  showCreateModal.value = true;
}

function openEditModal(user) {
  selectedUser.value = user;
  
  let currentPerms = [];
  if (user.role === 'super_admin') {
    currentPerms = ALL_MODULES.map(m => m.key);
  } else if (Array.isArray(user.permissions) && user.permissions.length > 0) {
    currentPerms = [...user.permissions];
  } else if (user.role === 'admin') {
    currentPerms = ['events', 'duty', 'members', 'export'];
  } else if (user.role === 'convener') {
    currentPerms = ['meetings'];
  }

  editForm.value = {
    id: user.id,
    name: user.name || '',
    email: user.email || '',
    role: user.role || 'admin',
    permissions: currentPerms
  };
  showEditModal.value = true;
}

function openPasswordReset(user) {
  selectedUser.value = user;
  showResetModal.value = true;
}

async function loadUsers() {
  users.value = await getCollectionDocs('adminUsers');
}

// 建立帳號
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
    const appName = 'SecondaryAuth_' + Date.now();
    secondaryApp = initializeApp(firebaseConfig, appName);
    const secondaryAuth = getAuth(secondaryApp);

    const cred = await createUserWithEmailAndPassword(
      secondaryAuth,
      form.value.email.trim(),
      form.value.password
    );

    await setDocWithId('adminUsers', cred.user.uid, {
      name: form.value.name.trim(),
      email: form.value.email.trim().toLowerCase(),
      role: form.value.role,
      permissions: form.value.role === 'super_admin' ? ALL_MODULES.map(m => m.key) : form.value.permissions,
      uid: cred.user.uid,
      createdAt: new Date().toISOString()
    });

    toast.success(`管理員「${form.value.name}」帳號已成功建立，並已配置指定權限！`);
    showCreateModal.value = false;
    await loadUsers();
  } catch (err) {
    let msg = err.message;
    if (err.code === 'auth/email-already-in-use') {
      msg = '此電子郵件已被註冊，請更換或直接編輯該帳號權限。';
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

// 儲存編輯權限
async function handleSaveEdit() {
  if (!editForm.value.id) return;
  savingEdit.value = true;
  try {
    const finalPerms = editForm.value.role === 'super_admin' 
      ? ALL_MODULES.map(m => m.key) 
      : editForm.value.permissions;

    await setDocWithId('adminUsers', editForm.value.id, {
      name: editForm.value.name.trim(),
      role: editForm.value.role,
      permissions: finalPerms,
      updatedAt: new Date().toISOString()
    }, true);

    toast.success(`已成功更新管理員「${editForm.value.name}」的權限！`);
    showEditModal.value = false;
    await loadUsers();
  } catch (err) {
    toast.error('更新權限失敗：' + err.message);
  } finally {
    savingEdit.value = false;
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
.admin-modal-dialog {
  background: #ffffff;
  border-radius: var(--radius-lg);
  width: 90%;
  max-width: 600px;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.modal-header { padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--gray-200); display: flex; justify-content: space-between; align-items: center; }
.modal-body { padding: 1.25rem 1.5rem; overflow-y: auto; flex: 1; }
.modal-footer { padding: 1rem 1.5rem; display: flex; justify-content: flex-end; gap: 0.5rem; background: var(--gray-50); border-top: 1px solid var(--gray-200); }
.modal-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; }

.role-super_admin { background: #fef3c7; color: #92400e; font-weight: 700; }
.role-admin { background: var(--primary-100); color: var(--primary-800); font-weight: 700; }
.role-convener { background: var(--secondary-100); color: var(--secondary-800); font-weight: 700; }

.perm-checkbox-item {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-sm);
  background: #ffffff;
  cursor: pointer;
  transition: all 0.15s ease;
}
.perm-checkbox-item:hover {
  background: #f8fafc;
  border-color: var(--primary-300);
}
.perm-checkbox-item.active {
  background: var(--primary-50);
  border-color: var(--primary-400);
}
.btn-xs { padding: 0.15rem 0.45rem; font-size: 0.75rem; }
.opacity-40 { opacity: 0.4; }
</style>

<template>
  <div class="admin-users-view">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold">權限與管理員帳號 (RBAC)</h1>
        <p class="text-sm text-muted">僅超級管理員可管理各角色帳號（超級管理員 / 一般管理員 / 召集人）</p>
      </div>
      <button class="btn btn-primary" @click="showCreateModal = true">➕ 新增管理帳號</button>
    </div>

    <div class="card table-responsive">
      <table class="table">
        <thead>
          <tr>
            <th>管理員姓名</th>
            <th>電子郵件</th>
            <th>權限角色</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id">
            <td class="font-bold">{{ u.name }}</td>
            <td>{{ u.email }}</td>
            <td>
              <span class="badge" :class="'role-' + u.role">
                {{ getRoleLabel(u.role) }}
              </span>
            </td>
            <td>
              <button class="btn btn-sm btn-danger" @click="handleDelete(u.id)">刪除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 新增管理員 Modal -->
    <div v-if="showCreateModal" class="modal-backdrop" @click="showCreateModal = false">
      <div class="modal-content" style="max-width: 500px;" @click.stop>
        <div class="modal-header">
          <h3 class="modal-title">新增管理員帳號</h3>
          <button class="modal-close" @click="showCreateModal = false">×</button>
        </div>
        <form @submit.prevent="handleCreate">
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label required">管理員姓名</label>
              <input v-model="form.name" type="text" class="form-input" required />
            </div>
            <div class="form-group">
              <label class="form-label required">電子郵件</label>
              <input v-model="form.email" type="email" class="form-input" required />
            </div>
            <div class="form-group">
              <label class="form-label required">角色分級</label>
              <select v-model="form.role" class="form-select">
                <option value="super_admin">🌟 超級管理員 (全部權限 + 帳號管理)</option>
                <option value="admin">🛡️ 一般管理員 (活動、排班、志工名冊)</option>
                <option value="convener">📢 會議召集人 (僅會議發佈與名單)</option>
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" @click="showCreateModal = false">取消</button>
            <button type="submit" class="btn btn-primary">確認建立</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { getCollectionDocs, createDoc, deleteDocById } from '@/firebase/db';
import { useToast } from '@/composables/useToast';

const toast = useToast();
const users = ref([]);
const showCreateModal = ref(false);

const form = ref({
  name: '',
  email: '',
  role: 'admin'
});

function getRoleLabel(role) {
  if (role === 'super_admin') return '🌟 超級管理員';
  if (role === 'admin') return '🛡️ 一般管理員';
  if (role === 'convener') return '📢 召集人';
  return role;
}

async function loadUsers() {
  users.value = await getCollectionDocs('adminUsers');
}

async function handleCreate() {
  await createDoc('adminUsers', form.value);
  toast.success('管理員已建立');
  showCreateModal.value = false;
  form.value = { name: '', email: '', role: 'admin' };
  await loadUsers();
}

async function handleDelete(id) {
  if (!confirm('確定要刪除此管理員嗎？')) return;
  await deleteDocById('adminUsers', id);
  toast.success('已刪除');
  await loadUsers();
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
.modal-content { background: #ffffff; border-radius: var(--radius-lg); width: 100%; }
.modal-header { padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--gray-200); display: flex; justify-content: space-between; }
.modal-body { padding: 1.5rem; }
.modal-footer { padding: 1rem 1.5rem; display: flex; justify-content: flex-end; gap: 0.5rem; background: var(--gray-50); }
.modal-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; }
.role-super_admin { background: #fef3c7; color: #92400e; }
.role-admin { background: var(--primary-100); color: var(--primary-800); }
.role-convener { background: var(--secondary-100); color: var(--secondary-800); }
</style>

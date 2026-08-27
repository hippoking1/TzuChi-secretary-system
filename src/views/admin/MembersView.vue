<template>
  <div class="admin-members">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">志工名冊維護</h1>
      <div class="flex gap-2">
        <button class="btn btn-outline-primary" @click="showImportModal = true">📥 批次匯入名冊</button>
        <button class="btn btn-primary" @click="openCreate">➕ 新增志工</button>
      </div>
    </div>

    <div class="card mb-4 grid grid-cols-3 gap-4">
      <input v-model="search" type="text" class="form-input" placeholder="搜尋志工姓名、電話、委員編號..." @input="handleSearch" />
      <select v-model="genderFilter" class="form-select" @change="handleSearch">
        <option value="">全部眾別</option>
        <option value="男">男眾</option>
        <option value="女">女眾</option>
      </select>
    </div>

    <div class="card table-responsive">
      <table class="table">
        <thead>
          <tr>
            <th>姓名</th>
            <th>性別</th>
            <th>電話</th>
            <th>委員/慈誠編號</th>
            <th>所屬組織</th>
            <th>法號</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in membersStore.members" :key="m.id">
            <td class="font-bold">{{ m.name }}</td>
            <td>{{ m.gender }}</td>
            <td>{{ m.phone }}</td>
            <td>{{ m.volunteerCode || '-' }}</td>
            <td>{{ orgsStore.getOrgPath(m.orgId) || '-' }}</td>
            <td>{{ m.dharmaName || '-' }}</td>
            <td>
              <div class="flex gap-2">
                <button class="btn btn-sm btn-outline" @click="openEdit(m)">編輯</button>
                <button class="btn btn-sm btn-danger" @click="handleDelete(m.id)">刪除</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 批次匯入 Modal (含即時預覽表格) -->
    <div v-if="showImportModal" class="modal-backdrop" @click="showImportModal = false">
      <div class="modal-content" style="max-width: 800px;" @click.stop>
        <div class="modal-header">
          <h3 class="modal-title">批次匯入志工名單 (Excel / CSV 複製貼上)</h3>
          <button class="modal-close" @click="showImportModal = false">×</button>
        </div>
        <div class="modal-body">
          <p class="text-sm text-muted mb-2">請從 Excel 複製表格內容並直接貼上於下方文字框（格式：姓名, 性別, 電話, 委員編號, 法號）：</p>
          <textarea v-model="rawImportText" class="form-textarea" placeholder="王大明, 男, 0912345678, 12345, 慈明" style="min-height: 120px;" @input="parseImportText"></textarea>

          <div v-if="parsedRows.length > 0" class="mt-4">
            <h4 class="font-bold text-sm mb-2">解析預覽 (共 {{ parsedRows.length }} 筆)：</h4>
            <div class="table-responsive" style="max-height: 200px; overflow-y: auto;">
              <table class="table">
                <thead>
                  <tr><th>姓名</th><th>性別</th><th>電話</th><th>編號</th><th>法號</th></tr>
                </thead>
                <tbody>
                  <tr v-for="(p, idx) in parsedRows" :key="idx">
                    <td>{{ p.name }}</td><td>{{ p.gender }}</td><td>{{ p.phone }}</td><td>{{ p.volunteerCode }}</td><td>{{ p.dharmaName }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="showImportModal = false">取消</button>
          <button class="btn btn-primary" :disabled="parsedRows.length === 0 || importing" @click="submitBatchImport">
            {{ importing ? '匯入中...' : '確認批次匯入' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useMembersStore } from '@/stores/members';
import { useOrgsStore } from '@/stores/orgs';
import { useToast } from '@/composables/useToast';

const membersStore = useMembersStore();
const orgsStore = useOrgsStore();
const toast = useToast();

const search = ref('');
const genderFilter = ref('');
const showImportModal = ref(false);
const rawImportText = ref('');
const parsedRows = ref([]);
const importing = ref(false);

async function handleSearch() {
  await membersStore.fetchMembers({ search: search.value, gender: genderFilter.value });
}

function parseImportText() {
  const lines = rawImportText.value.split(/\r?\n/).filter(l => l.trim().length > 0);
  parsedRows.value = lines.map(line => {
    const parts = line.split(/[,	]+/).map(p => p.trim());
    return {
      name: parts[0] || '',
      gender: parts[1] || '女',
      phone: parts[2] || '',
      volunteerCode: parts[3] || '',
      dharmaName: parts[4] || ''
    };
  });
}

async function submitBatchImport() {
  importing.value = true;
  try {
    await membersStore.batchImportMembers(parsedRows.value);
    toast.success(`成功匯入 ${parsedRows.value.length} 筆志工資料！`);
    showImportModal.value = false;
    rawImportText.value = '';
    parsedRows.value = [];
  } catch (err) {
    toast.error('匯入失敗：' + err.message);
  } finally {
    importing.value = false;
  }
}

async function openCreate() {
  const name = prompt('請輸入志工姓名：');
  if (!name) return;
  const phone = prompt('請輸入聯絡電話：') || '';
  const gender = prompt('性別（男/女）：', '女') || '女';
  await membersStore.saveMember({ name, phone, gender });
  toast.success('志工建立成功');
  await handleSearch();
}

async function openEdit(m) {
  const name = prompt('修改志工姓名：', m.name);
  if (!name) return;
  const phone = prompt('修改聯絡電話：', m.phone) || '';
  await membersStore.saveMember({ ...m, name, phone });
  toast.success('志工更新成功');
  await handleSearch();
}

async function handleDelete(id) {
  if (!confirm('確定要刪除此志工資料嗎？')) return;
  await membersStore.deleteMember(id);
  toast.success('已刪除');
}

onMounted(async () => {
  await orgsStore.fetchOrgs();
  await membersStore.fetchMembers();
  // 檢測並自動同步活動報名時填寫的最新志工電話
  const updatedCount = await membersStore.syncPhonesFromRegistrations();
  if (updatedCount > 0) {
    await membersStore.fetchMembers();
    toast.info(`已自動為 ${updatedCount} 位志工同步活動報名時填寫的最新電話！`);
  }
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
</style>
